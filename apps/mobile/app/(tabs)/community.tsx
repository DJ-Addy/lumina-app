import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { communityService } from "../../src/services/community";
import { CommunityPostCard } from "../../src/components/CommunityPostCard";
import type { CommunityPost } from "@lumina/shared";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

type FeedTab = "latest" | "following" | "saved";

export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>("latest");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isFetching } =
    useInfiniteQuery({
      queryKey: ["community-feed", activeTab],
      queryFn: ({ pageParam }) =>
        communityService.getFeed({
          tab: activeTab,
          cursor: pageParam as string | undefined,
          limit: 20,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    });

  const posts: CommunityPost[] = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>Anonymous moms, witnessed</Text>
      </View>

      {/* Reels entry tile */}
      <Pressable
        style={styles.reelsTile}
        onPress={() => router.push("/community/reels" as never)}
      >
        <View>
          <Text style={styles.reelsTitle}>Reels</Text>
          <Text style={styles.reelsSubtitle}>A vertical scroll of mom moments</Text>
        </View>
        <Text style={styles.reelsGlyph}>▶</Text>
      </Pressable>

      <View style={styles.tabs}>
        {(["latest", "following", "saved"] as FeedTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === "latest" ? "Latest" : tab === "following" ? "Following" : "Saved"}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.shareBtn}
          onPress={() => router.push("/community/share-composer")}
        >
          <Text style={styles.shareBtnLabel}>Share ✦</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent.purple} style={{ marginTop: 60 }} />
      ) : (
        <FlatList<CommunityPost>
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CommunityPostCard
              post={item}
              onPress={() => router.push(`/community/post/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={colors.accent.purple}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent.purple} style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>☽</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === "following"
                  ? "Follow some moms first"
                  : activeTab === "saved"
                  ? "Nothing saved yet"
                  : "Be the first to share"}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === "following"
                  ? "Explore the Latest tab to find moms to follow"
                  : activeTab === "saved"
                  ? "Tap ★ on a post to bookmark it for later"
                  : "Your entry could be exactly what someone needs to read tonight"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  title: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  subtitle: { fontSize: typography.size.sm, color: colors.text.muted, fontStyle: "italic" },
  reelsTile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: `${colors.accent.purple}18`,
    borderWidth: 1,
    borderColor: `${colors.accent.purple}50`,
  },
  reelsTitle: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  reelsSubtitle: { fontSize: typography.size.sm, color: colors.text.muted, marginTop: 2 },
  reelsGlyph: { fontSize: 22, color: colors.accent.purple },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabActive: {
    borderColor: colors.accent.purple,
    backgroundColor: `${colors.accent.purple}20`,
  },
  tabLabel: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
  },
  tabLabelActive: { color: colors.accent.purple },
  shareBtn: {
    marginLeft: "auto",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.accent.purple,
  },
  shareBtnLabel: {
    fontSize: typography.size.sm,
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
  },
  list: { padding: spacing.md, paddingBottom: spacing.xxxl },
  separator: { height: spacing.md },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.size.lg,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  emptySub: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
});
