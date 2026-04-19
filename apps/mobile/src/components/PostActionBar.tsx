import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActionSheetIOS, Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import type { CommunityPost, ReportReason } from "@lumina/shared";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { communityService } from "../services/community";
import { shareNative } from "../lib/socialShare";

interface Props {
  post: CommunityPost;
  /** Vertical orientation = right rail of a reel; horizontal = card footer. */
  orientation?: "horizontal" | "vertical";
  onChange?: () => void;
}

export function PostActionBar({ post, orientation = "horizontal", onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [liked, setLiked] = useState<boolean>(post.viewerReaction === "heart");
  const [saved, setSaved] = useState<boolean>(post.viewerHasSaved);
  const [reposted, setReposted] = useState<boolean>(post.viewerHasReposted);
  const [likeCount, setLikeCount] = useState<number>(post.likeCount);
  const [repostCount, setRepostCount] = useState<number>(post.repostCount);
  const [saveCount, setSaveCount] = useState<number>(post.saveCount);

  const isVertical = orientation === "vertical";

  async function toggleLike() {
    if (busy) return;
    setBusy("like");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      if (liked) {
        await communityService.removeReaction(post.id);
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await communityService.addReaction(post.id, { reaction: "heart" as never });
        setLiked(true);
        setLikeCount((n) => n + 1);
      }
      onChange?.();
    } catch {
      // revert on failure
    } finally {
      setBusy(null);
    }
  }

  async function toggleSave() {
    if (busy) return;
    setBusy("save");
    Haptics.selectionAsync().catch(() => undefined);
    try {
      if (saved) {
        await communityService.unsavePost(post.id);
        setSaved(false);
        setSaveCount((n) => Math.max(0, n - 1));
      } else {
        await communityService.savePost(post.id);
        setSaved(true);
        setSaveCount((n) => n + 1);
      }
      onChange?.();
    } finally {
      setBusy(null);
    }
  }

  async function repost() {
    if (busy || reposted) return;
    setBusy("repost");
    try {
      await communityService.createPost({
        postType: "repost" as never,
        repostOfId: post.id,
        visibility: "public" as never,
      });
      setReposted(true);
      setRepostCount((n) => n + 1);
      onChange?.();
    } catch {
      Alert.alert("Couldn’t repost", "Please try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const author = post.authorProfile?.alias ?? "a Lumina mom";
    await shareNative({
      title: `${author} on Lumina`,
      body: post.excerpt ?? post.content ?? "Shared from Lumina",
      url: `https://lumina.app/c/${post.id}`,
    });
  }

  function openMore() {
    const options = ["Cancel", "Not interested", "Report this post"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          userInterfaceStyle: "dark",
        },
        (idx) => handleMore(idx),
      );
    } else {
      Alert.alert("Post options", undefined, [
        { text: "Not interested", onPress: () => handleMore(1) },
        { text: "Report this post", style: "destructive", onPress: () => handleMore(2) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  async function handleMore(idx: number) {
    if (idx === 1) {
      await communityService.dismissPost(post.id, { reason: "not_interested" });
      onChange?.();
    } else if (idx === 2) {
      askForReportReason();
    }
  }

  function askForReportReason() {
    const reasons: { label: string; value: ReportReason }[] = [
      { label: "Harmful content", value: "harmful_content" as ReportReason },
      { label: "Spam", value: "spam" as ReportReason },
      { label: "Misinformation", value: "misinformation" as ReportReason },
      { label: "Harassment", value: "harassment" as ReportReason },
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Why are you reporting this?",
          options: ["Cancel", ...reasons.map((r) => r.label)],
          cancelButtonIndex: 0,
          userInterfaceStyle: "dark",
        },
        (idx) => idx > 0 && submitReport(reasons[idx - 1]!.value),
      );
    } else {
      Alert.alert(
        "Why are you reporting this?",
        undefined,
        [
          ...reasons.map((r) => ({
            text: r.label,
            onPress: () => submitReport(r.value),
          })),
          { text: "Cancel", style: "cancel" as const },
        ],
      );
    }
  }

  async function submitReport(reason: ReportReason) {
    try {
      await communityService.report({
        targetType: "post",
        targetId: post.id,
        reason,
      });
      Alert.alert("Thanks", "Our team is reviewing this post.");
    } catch {
      Alert.alert("Could not report", "Please try again later.");
    }
  }

  const containerStyle = isVertical ? styles.vertical : styles.horizontal;
  const buttonStyle = isVertical ? styles.verticalButton : styles.horizontalButton;
  const labelColor = isVertical ? colors.text.primary : colors.text.muted;

  return (
    <View style={containerStyle}>
      <Pressable onPress={toggleLike} style={buttonStyle}>
        <Text style={[styles.icon, liked && styles.iconActive]}>{liked ? "♥" : "♡"}</Text>
        <Text style={[styles.count, { color: labelColor }]}>{formatCount(likeCount)}</Text>
      </Pressable>

      <Pressable onPress={() => onChange && onChange()} style={buttonStyle}>
        <Text style={styles.icon}>◌</Text>
        <Text style={[styles.count, { color: labelColor }]}>{formatCount(post.commentCount)}</Text>
      </Pressable>

      <Pressable onPress={repost} style={buttonStyle} disabled={reposted}>
        <Text style={[styles.icon, reposted && styles.iconActive]}>↻</Text>
        <Text style={[styles.count, { color: labelColor }]}>{formatCount(repostCount)}</Text>
      </Pressable>

      <Pressable onPress={toggleSave} style={buttonStyle}>
        <Text style={[styles.icon, saved && styles.iconActive]}>{saved ? "★" : "☆"}</Text>
        <Text style={[styles.count, { color: labelColor }]}>{formatCount(saveCount)}</Text>
      </Pressable>

      <Pressable onPress={share} style={buttonStyle}>
        <Text style={styles.icon}>↗</Text>
      </Pressable>

      <Pressable onPress={openMore} style={buttonStyle}>
        <Text style={styles.icon}>⋯</Text>
      </Pressable>
    </View>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

const styles = StyleSheet.create({
  horizontal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  horizontalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  vertical: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  verticalButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: "rgba(13,11,42,0.45)",
    paddingVertical: spacing.xs,
  },
  icon: {
    fontSize: 22,
    color: colors.text.primary,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  iconActive: {
    color: colors.accent.rose,
  },
  count: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },
});
