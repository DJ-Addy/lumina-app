import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { CommunityPost } from "@lumina/shared";
import { colors, spacing, typography } from "../theme/tokens";
import { PostActionBar } from "./PostActionBar";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  post: CommunityPost;
  isActive: boolean;
  onAuthorPress?: () => void;
  onCommentsPress?: () => void;
}

export function ReelCard({ post, isActive, onAuthorPress, onCommentsPress }: Props) {
  const video = post.media.find((m) => m.kind === "video");
  // Prefer the highest-quality variant url (720p > 480p) > the source url
  const videoUrl = useMemo(() => {
    const variant720 = video?.variants.find((v) => v.label === "720p" && v.url)?.url;
    const variant480 = video?.variants.find((v) => v.label === "480p" && v.url)?.url;
    return variant720 ?? variant480 ?? video?.url ?? null;
  }, [video]);

  const player = useVideoPlayer(videoUrl ?? "", (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!videoUrl) return;
    if (isActive) {
      try {
        player.play();
      } catch {
        // ignore
      }
    } else {
      try {
        player.pause();
      } catch {
        // ignore
      }
    }
  }, [isActive, player, videoUrl]);

  return (
    <View style={styles.container}>
      {videoUrl ? (
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <View style={[styles.video, styles.placeholder]}>
          <Text style={styles.glyph}>☽</Text>
          <Text style={styles.placeholderText}>Loading reel…</Text>
        </View>
      )}

      {/* Bottom gradient overlay area */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        <View style={styles.captionContainer}>
          <Pressable onPress={onAuthorPress}>
            <Text style={styles.alias}>@{post.authorProfile?.alias ?? "anonymous"}</Text>
          </Pressable>
          {!!post.content && (
            <Text style={styles.caption} numberOfLines={3}>
              {post.content}
            </Text>
          )}
        </View>
      </View>

      {/* Right rail with action bar */}
      <View style={styles.actionRail} pointerEvents="box-none">
        <PostActionBar
          post={post}
          orientation="vertical"
          onChange={onCommentsPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.primary,
    gap: spacing.md,
  },
  glyph: { fontSize: 48, color: colors.accent.purple },
  placeholderText: { color: colors.text.muted, fontSize: typography.size.sm },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    backgroundColor: "rgba(0,0,0,0.0)",
  },
  captionContainer: {
    maxWidth: SCREEN_WIDTH * 0.72,
    gap: spacing.xs,
  },
  alias: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
  caption: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 4,
  },
  actionRail: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.xxxl,
  },
});
