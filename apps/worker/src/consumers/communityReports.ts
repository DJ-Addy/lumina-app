import { Worker } from "bullmq";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../lib/env.js";
import { sendTOSViolationEmail, sendAccountSuspendedEmail } from "../lib/email.js";

const log = pino({ level: "info" });

const QUEUE_NAME = "community.reports.review";
const REPORT_KEY_PREFIX = "reports";

type TargetType = "post" | "comment" | "profile";

interface ReportJobData {
  targetType: TargetType;
  targetId: string;
  reason: string;
  reportCount: number;
}

interface OwnerInfo {
  profileId: string;
  authUserId: string;
  email: string | null;
  violationCount: number;
}

export function startCommunityReportsWorker() {
  const worker = new Worker<ReportJobData>(
    QUEUE_NAME,
    async (job) => {
      const { targetType, targetId, reason, reportCount } = job.data;
      log.info({ targetType, targetId, reportCount, reason }, "Reviewing report");

      // Below threshold? just leave a breadcrumb.
      if (reportCount < env.REPORT_DELETE_THRESHOLD) {
        log.info({ targetId, reportCount }, "Below auto-delete threshold");
        return;
      }

      if (targetType === "post") {
        await actionPost(targetId, reason, reportCount);
      } else if (targetType === "comment") {
        await actionComment(targetId, reason, reportCount);
      } else {
        log.warn({ targetType }, "Profile reports require manual review");
      }

      // Reset counter so future reports start fresh
      await redis.del(`${REPORT_KEY_PREFIX}:${targetType}:${targetId}`);
    },
    { connection: redis, concurrency: 1 },
  );

  worker.on("failed", (job, err) =>
    log.error({ jobId: job?.id, err }, "Community reports job failed"),
  );

  log.info({ queue: QUEUE_NAME }, "community.reports.review worker started");
  return worker;
}

async function actionPost(postId: string, reason: string, reportCount: number) {
  // 1. Look up the post + owner
  const { data: post, error: pErr } = await supabase
    .from("community_posts")
    .select("id, content, excerpt, profile_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();
  if (pErr || !post) {
    log.warn({ postId, pErr }, "Post not found for moderation");
    return;
  }
  if (post["deleted_at"]) {
    log.info({ postId }, "Post already deleted, skipping");
    return;
  }

  const owner = await getOwnerInfo(post["profile_id"] as string);
  if (!owner) {
    log.warn({ postId }, "Could not resolve owner for post");
    return;
  }

  // 2. Soft-delete the post
  const { error: delErr } = await supabase
    .from("community_posts")
    .update({ deleted_at: new Date().toISOString(), is_under_review: false })
    .eq("id", postId);
  if (delErr) {
    log.error({ postId, delErr }, "Failed to soft-delete post");
    return;
  }

  // 3. Mark all report rows as actioned
  await supabase
    .from("community_reports")
    .update({ status: "actioned", action_taken: "deleted", reviewed_at: new Date().toISOString() })
    .eq("target_type", "post")
    .eq("target_id", postId);

  // 4. Bump the owner's violation count
  const newViolationCount = owner.violationCount + 1;
  await supabase
    .from("community_profiles")
    .update({
      violation_count: newViolationCount,
      last_violation_at: new Date().toISOString(),
    })
    .eq("id", owner.profileId);

  // 5. Notify the user
  if (owner.email) {
    await sendTOSViolationEmail(owner.email, {
      postExcerpt: (post["excerpt"] as string) ?? (post["content"] as string) ?? "",
      reason,
      reportCount,
    });
  } else {
    log.warn({ postId, ownerId: owner.profileId }, "Owner has no email; skipping email");
  }

  log.info(
    { postId, ownerId: owner.profileId, violationCount: newViolationCount },
    "Post auto-deleted by moderation",
  );

  // 6. Suspend if over threshold
  if (newViolationCount >= env.VIOLATION_SUSPEND_THRESHOLD) {
    await suspendOwner(owner, `Repeated guideline violations (${newViolationCount} strikes)`);
  }
}

async function actionComment(commentId: string, reason: string, reportCount: number) {
  const { data: comment, error } = await supabase
    .from("community_comments")
    .select("id, content, profile_id, deleted_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error || !comment) {
    log.warn({ commentId, error }, "Comment not found for moderation");
    return;
  }
  if (comment["deleted_at"]) return;

  const owner = await getOwnerInfo(comment["profile_id"] as string);
  if (!owner) return;

  await supabase
    .from("community_comments")
    .update({ deleted_at: new Date().toISOString(), is_under_review: false })
    .eq("id", commentId);

  await supabase
    .from("community_reports")
    .update({ status: "actioned", action_taken: "deleted", reviewed_at: new Date().toISOString() })
    .eq("target_type", "comment")
    .eq("target_id", commentId);

  const newViolationCount = owner.violationCount + 1;
  await supabase
    .from("community_profiles")
    .update({
      violation_count: newViolationCount,
      last_violation_at: new Date().toISOString(),
    })
    .eq("id", owner.profileId);

  if (owner.email) {
    await sendTOSViolationEmail(owner.email, {
      postExcerpt: (comment["content"] as string) ?? "",
      reason,
      reportCount,
    });
  }

  log.info(
    { commentId, ownerId: owner.profileId, violationCount: newViolationCount },
    "Comment auto-deleted by moderation",
  );

  if (newViolationCount >= env.VIOLATION_SUSPEND_THRESHOLD) {
    await suspendOwner(owner, `Repeated guideline violations (${newViolationCount} strikes)`);
  }
}

async function getOwnerInfo(profileId: string): Promise<OwnerInfo | null> {
  const { data: profile, error } = await supabase
    .from("community_profiles")
    .select("id, user_id, violation_count")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !profile) return null;

  const authUserId = profile["user_id"] as string;

  // Pull the email from auth.users via service-role API
  const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(authUserId);
  if (userErr) {
    log.warn({ authUserId, userErr }, "Could not fetch auth user");
  }

  return {
    profileId: profile["id"] as string,
    authUserId,
    email: userResp?.user?.email ?? null,
    violationCount: (profile["violation_count"] as number) ?? 0,
  };
}

async function suspendOwner(owner: OwnerInfo, reason: string) {
  const { error } = await supabase
    .from("community_profiles")
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq("id", owner.profileId);

  if (error) {
    log.error({ ownerId: owner.profileId, error }, "Failed to suspend community profile");
    return;
  }

  log.warn({ ownerId: owner.profileId, reason }, "Community profile suspended");

  // Also flip a Redis flag so the API auth plugin can short-circuit without a DB hit
  await redis.set(`community:suspended:${owner.authUserId}`, "1", "EX", 60 * 60 * 24 * 7);

  if (owner.email) {
    await sendAccountSuspendedEmail(owner.email, reason);
  }
}
