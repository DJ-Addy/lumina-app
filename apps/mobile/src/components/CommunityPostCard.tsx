import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import type { CommunityPost } from "@lumina/shared";
import { GlassCard } from "./GlassCard";
import { MediaPreview } from "./MediaPreview";
import { PollCard } from "./PollCard";
import { PostActionBar } from "./PostActionBar";
import { colors, spacing, typography, radius } from "../theme/tokens";

interface CommunityPostCardProps {
  post: CommunityPost;
  onPress?: () => void;
  onFollowPress?: () => void;
}

export function CommunityPostCard({ post, onPress, onFollowPress }: CommunityPostCardProps) {
  const timeAgo = formatTimeAgo(post.createdAt);

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.authorProfile?.alias?.[0]?.toUpperCase() ?? "✦"}
            </Text>
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.alias}>{post.authorProfile?.alias ?? "Anonymous"}</Text>
            <Text style={styles.time}>
              {timeAgo}
              {post.postType !== "text" ? ` · ${labelForType(post.postType)}` : ""}
            </Text>
          </View>
          {onFollowPress && !post.viewerIsFollowing && (
            <Pressable style={styles.followBtn} onPress={onFollowPress}>
              <Text style={styles.followBtnLabel}>Follow</Text>
            </Pressable>
          )}
        </View>

        {/* Repost preview */}
        {post.postType === "repost" && post.repostOf && (
          <View style={styles.repostBox}>
            <Text style={styles.repostHeader}>
              ↻ from @{post.repostOf.authorProfile?.alias ?? "anonymous"}
            </Text>
            {!!post.repostOf.content && (
              <Text style={styles.repostContent} numberOfLines={4}>
                {post.repostOf.excerpt ?? post.repostOf.content}
              </Text>
            )}
            {post.repostOf.media.length > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <MediaPreview
                  media={post.repostOf.media}
                  onVideoPress={() => router.push("/community/reels" as never)}
                />
              </View>
            )}
          </View>
        )}

        {!!post.content && post.postType !== "repost" && (
          <Text style={styles.content}>{post.excerpt ?? post.content}</Text>
        )}

        {post.media.length > 0 && (
          <View style={styles.mediaWrap}>
            <MediaPreview
              media={post.media}
              onVideoPress={() => router.push("/community/reels" as never)}
            />
          </View>
        )}

        {post.poll && (
          <PollCard poll={post.poll} />
        )}

        {post.isFromJournal && (
          <Text style={styles.journalBadge}>✍ from journal</Text>
        )}

        <PostActionBar post={post} orientation="horizontal" />
      </GlassCard>
    </Pressable>
  );
}

function labelForType(t: CommunityPost["postType"]): string {
  switch (t) {
    case "image": return "photo";
    case "video": return "reel";
    case "poll": return "poll";
    case "repost": return "repost";
    default: return "";
  }
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  card: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: `${colors.accent.purple}30`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${colors.accent.purple}50`,
  },
  avatarText: {
    fontSize: typography.size.md,
    color: colors.accent.purple,
    fontWeight: typography.weight.bold,
  },
  authorInfo: { flex: 1, gap: 2 },
  alias: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  time: { fontSize: typography.size.xs, color: colors.text.muted },
  followBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent.purple,
  },
  followBtnLabel: {
    fontSize: typography.size.xs,
    color: colors.accent.purple,
    fontWeight: typography.weight.semibold,
  },
  content: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.sm,
  },
  mediaWrap: {
    marginBottom: spacing.sm,
  },
  journalBadge: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  repostBox: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  repostHeader: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  repostContent: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
});
