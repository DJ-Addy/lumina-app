import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommunityPostVisibility, CommunityPostType } from "@lumina/shared";
import { communityService } from "../../src/services/community";
import {
  uploadCommunityMedia,
  type UploadProgress,
  type UploadResult,
} from "../../src/services/communityMedia";
import { CTAButton } from "../../src/components/CTAButton";
import { PollComposer, isValidPoll, type DraftPoll } from "../../src/components/PollComposer";
import { screenText } from "../../src/lib/moderation";
import { MODERATION_LABEL_COPY, type ModerationLabel } from "@lumina/shared";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

type Mode = "text" | "image" | "video" | "poll";

interface DraftMedia extends UploadResult {
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  uploadProgress?: UploadProgress;
}

export default function ShareComposerScreen() {
  const [mode, setMode] = useState<Mode>("text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<CommunityPostVisibility>("public");
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [poll, setPoll] = useState<DraftPoll>({
    question: "",
    options: ["", ""],
    endsInHours: 72,
  });
  const queryClient = useQueryClient();

  const isUploading = media.some(
    (m) => m.uploadProgress && !["done", "error"].includes(m.uploadProgress.phase),
  );

  const shareMutation = useMutation({
    mutationFn: async () => {
      const postType: CommunityPostType =
        mode === "poll" ? "poll" : mode === "video" ? "video" : mode === "image" ? "image" : "text";

      // Pre-flight text moderation: combine content + poll text and screen.
      const textToCheck = [
        content.trim(),
        mode === "poll" ? poll.question.trim() : "",
        mode === "poll" ? poll.options.map((o) => o.trim()).filter(Boolean).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (textToCheck) {
        const verdict = await screenText(textToCheck, mode === "poll" ? "poll" : "post");
        if (verdict.severity === "block") {
          const reasons = verdict.labels
            .slice(0, 3)
            .map((l) => MODERATION_LABEL_COPY[l.label as ModerationLabel] ?? l.label)
            .join(", ");
          throw new ContentRejectedError(
            verdict.reason ?? "This post can't be shared as written.",
            reasons,
          );
        }
        if (verdict.severity === "crisis") {
          throw new CrisisInterventionError();
        }
        if (verdict.severity === "warn") {
          // Soft warning: ask the user to confirm before sending.
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Just checking in",
              verdict.reason ?? "This post may not land well. Share anyway?",
              [
                { text: "Edit", style: "cancel", onPress: () => resolve(false) },
                { text: "Share anyway", onPress: () => resolve(true) },
              ],
            );
          });
          if (!proceed) throw new SoftAbortError();
        }
      }

      return communityService.createPost({
        postType,
        visibility,
        content: content.trim() || undefined,
        excerpt: content.length > 280 ? content.slice(0, 280) + "…" : content || undefined,
        mediaIds: media.length ? media.map((m) => m.mediaId) : undefined,
        poll:
          mode === "poll"
            ? {
                question: poll.question.trim(),
                options: poll.options.map((o) => o.trim()).filter(Boolean),
                endsInHours: poll.endsInHours,
              }
            : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      queryClient.invalidateQueries({ queryKey: ["community-reels"] });
      router.back();
    },
    onError: (err) => {
      if (err instanceof SoftAbortError) return;
      if (err instanceof CrisisInterventionError) {
        Alert.alert(
          "We're here for you",
          "What you wrote has us a little worried. You're not alone in this.\n\n" +
            "If you're in the US, call or text 988 — the Suicide & Crisis Lifeline.\n" +
            "If you'd rather talk to a postpartum-trained listener, call 1-833-943-5746 (PSI HelpLine).\n\n" +
            "Your post wasn't sent — but if you'd like, save it as a journal entry just for you.",
          [{ text: "Okay" }],
        );
        return;
      }
      if (err instanceof ContentRejectedError) {
        Alert.alert(
          "Post can't be shared",
          err.reasons ? `${err.message}\n\nFlagged for: ${err.reasons}` : err.message,
        );
        return;
      }
      Alert.alert("Could not share", String((err as Error).message ?? err));
    },
  });

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "We need access to your library to attach photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 4,
    });
    if (result.canceled) return;
    setMode("image");
    for (const asset of result.assets) {
      await startUpload({
        uri: asset.uri,
        kind: "image",
        mimeType: asset.mimeType ?? "image/jpeg",
        bytes: asset.fileSize ?? 0,
        width: asset.width,
        height: asset.height,
      });
    }
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "We need access to your library to attach video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: 90,
      quality: 0.85,
    });
    if (result.canceled) return;
    setMode("video");
    setMedia([]); // video posts are single-asset
    const asset = result.assets[0]!;
    await startUpload({
      uri: asset.uri,
      kind: "video",
      mimeType: asset.mimeType ?? "video/mp4",
      bytes: asset.fileSize ?? 0,
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ?? undefined,
    });
  }

  async function startUpload(input: {
    uri: string;
    kind: "image" | "video";
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
  }) {
    const tempId = Math.random().toString(36).slice(2);
    const placeholder: DraftMedia = {
      mediaId: tempId,
      status: "pending",
      url: null,
      uri: input.uri,
      mimeType: input.mimeType,
      uploadProgress: { phase: "signing", progress: 0 },
    };
    if (input.width !== undefined) placeholder.width = input.width;
    if (input.height !== undefined) placeholder.height = input.height;
    if (input.durationMs !== undefined) placeholder.durationMs = input.durationMs;
    setMedia((prev) => [...prev, placeholder]);

    try {
      const result = await uploadCommunityMedia(
        {
          uri: input.uri,
          kind: input.kind,
          mimeType: input.mimeType,
          bytes: input.bytes,
          ...(input.width !== undefined ? { width: input.width } : {}),
          ...(input.height !== undefined ? { height: input.height } : {}),
          ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        },
        (progress) => {
          setMedia((prev) =>
            prev.map((m) => (m.mediaId === tempId ? { ...m, uploadProgress: progress } : m)),
          );
        },
      );
      setMedia((prev) =>
        prev.map((m) =>
          m.mediaId === tempId
            ? {
                ...m,
                mediaId: result.mediaId,
                status: result.status,
                url: result.url,
                uploadProgress: { phase: "done", progress: 1 },
              }
            : m,
        ),
      );
    } catch (err) {
      setMedia((prev) =>
        prev.map((m) =>
          m.mediaId === tempId
            ? {
                ...m,
                uploadProgress: {
                  phase: "error",
                  progress: 0,
                  error: (err as Error).message,
                },
              }
            : m,
        ),
      );
    }
  }

  function removeMedia(mediaId: string) {
    setMedia((prev) => prev.filter((m) => m.mediaId !== mediaId));
  }

  const canShare = (() => {
    if (shareMutation.isPending || isUploading) return false;
    if (mode === "poll") return isValidPoll(poll);
    if (mode === "image" || mode === "video") return media.some((m) => m.status === "ready" || m.status === "processing");
    return content.trim().length > 0;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyIcon}>◉</Text>
          <Text style={styles.privacyText}>
            Posts appear under your anonymous alias. Your real identity is never revealed.
          </Text>
        </View>

        <View style={styles.modeRow}>
          {(["text", "image", "video", "poll"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipActive]}
              onPress={() => {
                setMode(m);
                if (m === "text" || m === "poll") setMedia([]);
              }}
            >
              <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
                {m === "text" ? "Text" : m === "image" ? "Photo" : m === "video" ? "Video" : "Poll"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode !== "poll" && (
          <TextInput
            style={styles.input}
            placeholder={
              mode === "video"
                ? "Add a caption (optional)…"
                : mode === "image"
                ? "Add a caption…"
                : "What do you want to share with other moms tonight?"
            }
            placeholderTextColor={colors.text.muted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
          />
        )}

        {mode !== "poll" && (
          <Text style={styles.charCount}>{content.length} / 1000</Text>
        )}

        {(mode === "image" || mode === "video") && (
          <View style={styles.mediaActions}>
            {mode === "image" && (
              <CTAButton label="Pick photos" variant="secondary" size="sm" onPress={pickImages} />
            )}
            {mode === "video" && (
              <CTAButton label="Pick a reel" variant="secondary" size="sm" onPress={pickVideo} />
            )}
          </View>
        )}

        {media.length > 0 && (
          <View style={styles.mediaPreview}>
            {media.map((m) => (
              <View key={m.mediaId} style={styles.mediaTile}>
                <Image source={{ uri: m.uri }} style={styles.mediaImage} resizeMode="cover" />
                {m.uploadProgress && m.uploadProgress.phase !== "done" && (
                  <View style={styles.mediaOverlay}>
                    {m.uploadProgress.phase === "error" ? (
                      <Text style={styles.mediaError}>Upload failed</Text>
                    ) : (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.mediaProgress}>
                          {Math.round((m.uploadProgress.progress ?? 0) * 100)}%
                        </Text>
                      </>
                    )}
                  </View>
                )}
                <Pressable style={styles.removeMediaBtn} onPress={() => removeMedia(m.mediaId)}>
                  <Text style={styles.removeMediaLabel}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {mode === "poll" && (
          <PollComposer value={poll} onChange={setPoll} />
        )}

        <View style={styles.visibilitySection}>
          <Text style={styles.label}>Who can see this?</Text>
          <View style={styles.visibilityRow}>
            {(["public", "followers"] as CommunityPostVisibility[]).map((vis) => (
              <Pressable
                key={vis}
                style={[styles.visOption, visibility === vis && styles.visOptionActive]}
                onPress={() => setVisibility(vis)}
              >
                <Text style={[styles.visLabel, visibility === vis && styles.visLabelActive]}>
                  {vis === "public" ? "All moms" : "Followers only"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <CTAButton label="Cancel" variant="ghost" size="md" onPress={() => router.back()} />
          <CTAButton
            label={isUploading ? "Uploading…" : "Share"}
            size="md"
            isLoading={shareMutation.isPending}
            disabled={!canShare}
            onPress={() => shareMutation.mutate()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

class ContentRejectedError extends Error {
  constructor(message: string, public reasons?: string) {
    super(message);
    this.name = "ContentRejectedError";
  }
}
class CrisisInterventionError extends Error {
  constructor() {
    super("crisis_intervention");
    this.name = "CrisisInterventionError";
  }
}
class SoftAbortError extends Error {
  constructor() {
    super("soft_abort");
    this.name = "SoftAbortError";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: `${colors.accent.purple}15`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacyIcon: { fontSize: typography.size.md, color: colors.accent.purple, marginTop: 2 },
  privacyText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  modeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
  },
  modeChipActive: {
    borderColor: colors.accent.purple,
    backgroundColor: `${colors.accent.purple}15`,
  },
  modeLabel: { color: colors.text.muted, fontSize: typography.size.sm },
  modeLabelActive: { color: colors.accent.purple, fontWeight: typography.weight.semibold },
  input: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    minHeight: 140,
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
    textAlignVertical: "top",
  },
  charCount: { fontSize: typography.size.xs, color: colors.text.muted, textAlign: "right" },
  mediaActions: { flexDirection: "row", gap: spacing.sm },
  mediaPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mediaTile: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.background.card,
  },
  mediaImage: { width: "100%", height: "100%" },
  mediaOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(13,11,42,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  mediaProgress: { color: "#fff", fontSize: typography.size.xs },
  mediaError: { color: "#FCA5A5", fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  removeMediaBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(13,11,42,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeMediaLabel: { color: "#fff", fontSize: 18, lineHeight: 18 },
  visibilitySection: { gap: spacing.sm, marginTop: spacing.md },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  visibilityRow: { flexDirection: "row", gap: spacing.sm },
  visOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
  },
  visOptionActive: {
    borderColor: colors.accent.purple,
    backgroundColor: `${colors.accent.purple}15`,
  },
  visLabel: { fontSize: typography.size.sm, color: colors.text.muted },
  visLabelActive: { color: colors.accent.purple, fontWeight: typography.weight.semibold },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.md },
});
