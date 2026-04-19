import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { CommunityPost } from "@lumina/shared";
import { GlassCard } from "./GlassCard";
import { colors, spacing, typography, radius } from "../theme/tokens";

const REACTION_EMOJIS: Record<string, string> = {
  heart: "♥",
  candle: "🕯",
  moon: "◉",
  star: "✦",
};

interface CommunityPostCardProps {
  post: CommunityPost;
  onPress?: () => void;
  onFollowPress?: () => void;
  onReportPress?: () => void;
}

export function CommunityPostCard({ post, onPress, onFollowPress, onReportPress }: CommunityPostCardProps) {
  const totalReactions = Object.values(post.reactionCounts).reduce((a, b) => a + b, 0);
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
            <Text style={styles.time}>{timeAgo}</Text>
          </View>
          {onFollowPress && !post.viewerIsFollowing && (
            <Pressable style={styles.followBtn} onPress={onFollowPress}>
              <Text style={styles.followBtnLabel}>Follow</Text>
            </Pressable>
          )}
          {onReportPress && (
            <Pressable onPress={onReportPress} style={styles.moreBtn}>
              <Text style={styles.moreBtnLabel}>···</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.content}>
          {post.excerpt ?? post.content}
        </Text>

        {post.isFromJournal && (
          <Text style={styles.journalBadge}>✍ from journal</Text>
        )}

        <View style={styles.footer}>
          <View style={styles.reactions}>
            {Object.entries(post.reactionCounts).map(([type, count]) => (
              <View key={type} style={styles.reaction}>
                <Text style={styles.reactionEmoji}>{REACTION_EMOJIS[type] ?? "♥"}</Text>
                <Text style={styles.reactionCount}>{count}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.commentCount}>
            {post.commentCount > 0 ? `${post.commentCount} replies` : ""}
          </Text>
        </View>
      </GlassCard>
    </Pressable>
  );
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
  moreBtn: { padding: spacing.xs },
  moreBtnLabel: { fontSize: typography.size.md, color: colors.text.muted },
  content: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.sm,
  },
  journalBadge: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.sm,
  },
  reactions: { flexDirection: "row", gap: spacing.sm },
  reaction: { flexDirection: "row", alignItems: "center", gap: 4 },
  reactionEmoji: { fontSize: typography.size.sm, color: colors.accent.rose },
  reactionCount: { fontSize: typography.size.xs, color: colors.text.muted },
  commentCount: { fontSize: typography.size.xs, color: colors.text.muted },
});
