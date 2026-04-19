import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  Text,
  ActivityIndicator,
  type ViewToken,
} from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { CommunityPost } from "@lumina/shared";
import { communityService } from "../../src/services/community";
import { ReelCard } from "../../src/components/ReelCard";
import { MindfulnessModal } from "../../src/components/MindfulnessModal";
import { useReelsStore } from "../../src/stores/reelsStore";
import { colors, spacing, typography } from "../../src/theme/tokens";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ReelsScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showMindfulness, setShowMindfulness] = useState(false);
  const recordWatch = useReelsStore((s) => s.recordWatch);
  const acknowledgeBreak = useReelsStore((s) => s.acknowledgeBreak);
  const reset = useReelsStore((s) => s.reset);
  const watched = useReelsStore((s) => s.watchedThisSession);
  const lastViewedRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ["community-reels"],
      queryFn: ({ pageParam }) => communityService.getReels(pageParam ?? 0, 8),
      initialPageParam: 0 as number,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    });

  const posts: CommunityPost[] = data?.pages.flatMap((p) => p.posts) ?? [];

  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken[] }) => {
      const first = info.viewableItems[0];
      if (!first || first.index == null) return;
      setActiveIndex(first.index);

      const post = first.item as CommunityPost;
      if (lastViewedRef.current === post.id) return;
      lastViewedRef.current = post.id;

      // Fire-and-forget view ping (snappy; backend writes to Redis only)
      communityService.pingView(post.id).catch(() => undefined);

      const { shouldShowMindfulness } = recordWatch();
      if (shouldShowMindfulness) setShowMindfulness(true);
    },
    [recordWatch],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.purple} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.glyph}>☽</Text>
          <Text style={styles.emptyTitle}>No reels yet</Text>
          <Text style={styles.emptyBody}>Be the first to post a video.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/community/share-composer")}>
            <Text style={styles.primaryBtnLabel}>Share something</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <ReelCard post={item} isActive={index === activeIndex} />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          onRefresh={refetch}
          refreshing={false}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.accent.purple} />
              </View>
            ) : null
          }
        />
      )}

      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeIcon}>×</Text>
      </Pressable>

      <MindfulnessModal
        visible={showMindfulness}
        reelsWatched={watched}
        onKeepGoing={() => {
          acknowledgeBreak();
          setShowMindfulness(false);
        }}
        onTakeBreath={() => {
          // analytics hook; no immediate close (the modal handles in-place breathing)
        }}
        onLeave={() => {
          acknowledgeBreak();
          setShowMindfulness(false);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  glyph: { fontSize: 56, color: colors.accent.purple },
  emptyTitle: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  emptyBody: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    marginTop: spacing.md,
  },
  primaryBtnLabel: {
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
  },
  closeBtn: {
    position: "absolute",
    top: spacing.xxxl,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,11,42,0.5)",
  },
  closeIcon: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
  },
  footer: {
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
