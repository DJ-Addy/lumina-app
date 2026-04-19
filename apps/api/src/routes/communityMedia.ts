import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { SignUploadRequestSchema, FinalizeUploadRequestSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import {
  COMMUNITY_MEDIA_BUCKET,
  buildStorageKey,
  createSignedUploadUrl,
  publicUrl,
  validateMediaUpload,
} from "../lib/storage.js";
import { queues } from "../lib/queue.js";
import { getCommunityProfile } from "./communityHelpers.js";

export async function communityMediaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireActiveCommunityProfile);

  /**
   * POST /v1/community/media/sign-upload
   * Create a media row + Supabase signed upload URL.
   * The mobile app PUTs the bytes directly to Storage, then calls /finalize.
   */
  fastify.post("/sign-upload", async (request, reply) => {
    const parsed = SignUploadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: parsed.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const validation = validateMediaUpload(parsed.data.kind, parsed.data.mimeType, parsed.data.bytes);
    if (!validation.ok) {
      return reply.status(400).send({ code: "INVALID_MEDIA", message: validation.message });
    }

    const mediaId = randomUUID();
    const storageKey = buildStorageKey(request.user.id, mediaId, parsed.data.mimeType);

    const { error: insertErr } = await supabase.from("community_media").insert({
      id: mediaId,
      community_profile_id: profile["id"] as string,
      kind: parsed.data.kind,
      status: "pending",
      storage_bucket: COMMUNITY_MEDIA_BUCKET,
      storage_key: storageKey,
      bytes: parsed.data.bytes,
      mime_type: parsed.data.mimeType,
    });
    if (insertErr) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to register media" });
    }

    let signed;
    try {
      signed = await createSignedUploadUrl(storageKey);
    } catch (err) {
      await supabase.from("community_media").update({ status: "failed" }).eq("id", mediaId);
      return reply
        .status(500)
        .send({ code: "STORAGE_ERROR", message: (err as Error).message ?? "Sign failed" });
    }

    return reply.send({
      mediaId,
      uploadUrl: signed.signedUrl,
      storageKey,
      storageBucket: COMMUNITY_MEDIA_BUCKET,
      token: signed.token,
    });
  });

  /**
   * POST /v1/community/media/:id/finalize
   * Marks the media as `processing` and either:
   *   - image: immediately mark `ready` (no transcoding needed)
   *   - video: enqueue ffmpeg pipeline (transcode + thumbnail)
   */
  fastify.post<{ Params: { id: string } }>("/:id/finalize", async (request, reply) => {
    const parsed = FinalizeUploadRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: parsed.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const { data: media, error } = await supabase
      .from("community_media")
      .select("*")
      .eq("id", request.params.id)
      .eq("community_profile_id", profile["id"] as string)
      .single();
    if (error || !media) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Media not found" });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.width) updates["width"] = parsed.data.width;
    if (parsed.data.height) updates["height"] = parsed.data.height;
    if (parsed.data.durationMs) updates["duration_ms"] = parsed.data.durationMs;

    if ((media["kind"] as string) === "image") {
      updates["status"] = "ready";
    } else {
      updates["status"] = "processing";
    }

    const { error: updateErr } = await supabase
      .from("community_media")
      .update(updates)
      .eq("id", request.params.id);
    if (updateErr) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to finalize" });
    }

    if ((media["kind"] as string) === "video") {
      await queues.videoProcess.add("transcode", {
        mediaId: request.params.id,
        userId: request.user.id,
        storageKey: media["storage_key"] as string,
      });
    }

    return reply.send({
      mediaId: request.params.id,
      status: updates["status"],
      url: publicUrl(media["storage_key"] as string),
    });
  });

  /** Allow author to delete their own (unposted) media. */
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    await supabase
      .from("community_media")
      .update({ status: "deleted" })
      .eq("id", request.params.id)
      .eq("community_profile_id", profile["id"] as string);

    return reply.status(204).send();
  });
}
