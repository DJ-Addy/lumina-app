import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communityService } from "../../../src/services/community";
import { CommunityPostCard } from "../../../src/components/CommunityPostCard";
import { CTAButton } from "../../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../../src/theme/tokens";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const postQuery = useQuery({
    queryKey: ["community-post", id],
    queryFn: () => communityService.getPost(id!),
    enabled: !!id,
  });

  const commentsQuery = useQuery({
    queryKey: ["community-comments", id],
    queryFn: () => communityService.getComments(id!),
    enabled: !!id,
  });

  const commentMutation = useMutation({
    mutationFn: () => communityService.createComment(id!, { content: commentText }),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["community-comments", id] });
      queryClient.invalidateQueries({ queryKey: ["community-post", id] });
    },
    onError: () => Alert.alert("Error", "Could not post your comment."),
  });

  if (postQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.accent.purple} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {postQuery.data && <CommunityPostCard post={postQuery.data.post} />}

        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeader}>
            {commentsQuery.data?.total ?? 0} replies
          </Text>

          {commentsQuery.data?.comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={styles.commentAlias}>{comment.authorProfile?.alias ?? "Mom"}</Text>
              <Text style={styles.commentContent}>{comment.content}</Text>
              <Text style={styles.commentTime}>
                {formatTimeAgo(comment.createdAt)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.commentBox}>
        <TextInput
          style={styles.commentInput}
          placeholder="Reply with kindness…"
          placeholderTextColor={colors.text.muted}
          value={commentText}
          onChangeText={setCommentText}
          maxLength={500}
          multiline
        />
        <CTAButton
          label="Reply"
          size="sm"
          isLoading={commentMutation.isPending}
          disabled={!commentText.trim()}
          onPress={() => commentMutation.mutate()}
        />
      </View>
    </SafeAreaView>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.md, gap: spacing.lg, paddingBottom: 120 },
  commentsSection: { gap: spacing.md },
  commentsHeader: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: typography.weight.semibold,
  },
  comment: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  commentAlias: {
    fontSize: typography.size.sm,
    color: colors.accent.purple,
    fontWeight: typography.weight.semibold,
  },
  commentContent: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  commentTime: { fontSize: typography.size.xs, color: colors.text.muted },
  commentBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.text.primary,
    maxHeight: 100,
  },
});
