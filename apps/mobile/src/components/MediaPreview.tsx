import React, { useMemo } from "react";
import { View, Image, StyleSheet, Pressable, Text, Dimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { CommunityMedia } from "@lumina/shared";
import { colors, radius, spacing, typography } from "../theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");
const MAX_HEIGHT = SCREEN_W * 1.2;

interface Props {
  media: CommunityMedia[];
  onVideoPress?: (m: CommunityMedia) => void;
}

export function MediaPreview({ media, onVideoPress }: Props) {
  if (!media.length) return null;
  const first = media[0]!;

  if (first.kind === "video") {
    return <VideoCover media={first} onPress={() => onVideoPress?.(first)} />;
  }

  if (media.length === 1) {
    return <ImageItem media={first} />;
  }

  return (
    <View style={styles.gallery}>
      {media.slice(0, 4).map((m) => (
        <View key={m.id} style={styles.galleryCell}>
          <ImageItem media={m} compact />
          {media.length > 4 && m.id === media[3]?.id && (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{media.length - 4}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function ImageItem({ media, compact = false }: { media: CommunityMedia; compact?: boolean }) {
  const aspect = media.width && media.height ? media.width / media.height : 1;
  const height = useMemo(() => {
    if (compact) return 140;
    return Math.min(MAX_HEIGHT, SCREEN_W / aspect);
  }, [aspect, compact]);

  if (!media.url) return <View style={[styles.placeholder, { height }]} />;

  return (
    <Image
      source={{ uri: media.url }}
      style={[styles.image, { height, width: compact ? "100%" : SCREEN_W - spacing.lg * 2 }]}
      resizeMode={compact ? "cover" : "contain"}
    />
  );
}

function VideoCover({ media, onPress }: { media: CommunityMedia; onPress: () => void }) {
  const thumbUrl = media.thumbnailUrl;

  return (
    <Pressable onPress={onPress} style={styles.videoCover}>
      {thumbUrl ? (
        <Image source={{ uri: thumbUrl }} style={styles.videoThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.videoThumb, styles.placeholder]} />
      )}
      <View style={styles.playPill}>
        <Text style={styles.playGlyph}>▶</Text>
        <Text style={styles.playLabel}>Tap to enter reels</Text>
      </View>
      {media.status === "processing" && (
        <View style={styles.processingPill}>
          <Text style={styles.processingText}>Processing…</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: radius.md,
    backgroundColor: colors.background.card,
  },
  placeholder: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  galleryCell: {
    width: "49%",
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  moreOverlay: {
    position: "absolute",
    inset: 0 as unknown as undefined,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(13,11,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  videoCover: {
    height: SCREEN_W * 1.0,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  videoThumb: {
    width: "100%",
    height: "100%",
  },
  playPill: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(13,11,42,0.7)",
    borderRadius: radius.full,
  },
  playGlyph: { color: "#fff", fontSize: 14 },
  playLabel: { color: "#fff", fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  processingPill: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: "rgba(13,11,42,0.85)",
    borderRadius: radius.full,
  },
  processingText: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
  },
});
