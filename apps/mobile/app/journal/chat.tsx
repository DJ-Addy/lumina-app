import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { BreathingOrb, type OrbState } from "../../src/components/BreathingOrb";
import { UpgradeSheet } from "../../src/components/UpgradeSheet";
import { streamChat, type ChatTurn } from "../../src/services/chat";
import { journalService } from "../../src/services/journal";
import { alertJournalCrisisIfNeeded } from "../../src/lib/journalCrisis";
import { hasSupabaseConfig } from "../../src/lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export default function ChatJournalScreen() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const queryClient = useQueryClient();

  const saveReflectionToJournal = useCallback(
    async (userText: string, assistantText: string) => {
      try {
        const saved = await journalService.createEntry({
          mode: "text",
          content: `${userText}\n\n— Lumina reflected:\n${assistantText}`,
          moodTags: [],
          isNightEntry: false,
        });
        alertJournalCrisisIfNeeded(saved);
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      } catch (e) {
        console.warn("[chat] failed to save reflection", e);
      }
    },
    [queryClient],
  );

  const liveTranscript = useMemo(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.isStreaming) {
      return last.content;
    }
    return "";
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || orbState === "speaking" || orbState === "thinking") return;

    setInput("");
    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const placeholderId = `a-${Date.now()}`;
    const placeholder: UiMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    const history: ChatTurn[] = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setOrbState("thinking");

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    await streamChat({
      message: text,
      history,
      signal: ctrl.signal,
      onStart: () => setOrbState("speaking"),
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, content: m.content + delta } : m,
          ),
        );
      },
      onDone: (full) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, content: full, isStreaming: false }
              : m,
          ),
        );
        setOrbState("idle");
        if (full.length > 0) {
          void saveReflectionToJournal(text, full);
        }
      },
      onError: (err) => {
        if (err.message === "CREDITS_EXHAUSTED") {
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setOrbState("idle");
          setShowUpgrade(true);
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content:
                    "I lost my breath for a second. Try saying that again?",
                  isStreaming: false,
                }
              : m,
          ),
        );
        setOrbState("idle");
        console.warn("[chat] error", err.message);
      },
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [input, messages, orbState, saveReflectionToJournal]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setOrbState("idle");
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }, []);

  const showHistory = messages.length > 1 || (messages.length === 1 && !liveTranscript);
  const isBusy = orbState === "speaking" || orbState === "thinking";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerBtn}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Talk with Lumina</Text>
        <Pressable
          onPress={isBusy ? stop : undefined}
          hitSlop={12}
          disabled={!isBusy}
        >
          <Text style={[styles.headerBtn, !isBusy && { opacity: 0.3 }]}>
            Stop
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.orbWrap}>
          <BreathingOrb state={orbState} size={180} />
          <Text style={styles.statusText}>{statusLabel(orbState)}</Text>
        </View>

        {liveTranscript.length > 0 ? (
          <View style={styles.transcriptWrap}>
            <Text style={styles.transcriptText}>{liveTranscript}</Text>
          </View>
        ) : (
          <View style={styles.transcriptWrap}>
            <Text style={styles.placeholderText}>
              {messages.length === 0
                ? "Tell Lumina what you're carrying. She'll listen first."
                : "…"}
            </Text>
          </View>
        )}

        {showHistory && (
          <ScrollView
            ref={scrollRef}
            style={styles.history}
            contentContainerStyle={styles.historyContent}
            showsVerticalScrollIndicator={false}
          >
            {messages
              .slice(0, liveTranscript ? -1 : messages.length)
              .map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.bubble,
                    m.role === "user" ? styles.bubbleUser : styles.bubbleAi,
                  ]}
                >
                  <Text
                    style={
                      m.role === "user"
                        ? styles.bubbleUserText
                        : styles.bubbleAiText
                    }
                  >
                    {m.content}
                  </Text>
                </View>
              ))}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Say what's true right now…"
            placeholderTextColor={colors.text.muted}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isBusy}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || isBusy}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || isBusy) && styles.sendBtnDisabled,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.sendBtnLabel}>↑</Text>
          </Pressable>
        </View>

        {!hasSupabaseConfig && (
          <Text style={styles.demoNote}>
            Demo mode · responses are simulated. Add Supabase + API keys for
            real Claude.
          </Text>
        )}

        <UpgradeSheet
          visible={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          onUpgraded={() => {
            queryClient.invalidateQueries({ queryKey: ["credits"] });
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function statusLabel(state: OrbState): string {
  switch (state) {
    case "thinking":
      return "Lumina is sitting with that…";
    case "speaking":
      return "Lumina is reflecting";
    case "listening":
      return "Listening";
    default:
      return "Here when you're ready";
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background.primary },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerBtn: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    minWidth: 50,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  orbWrap: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  statusText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  transcriptWrap: {
    minHeight: 80,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  transcriptText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
    textAlign: "center",
    fontWeight: typography.weight.regular,
  },
  placeholderText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  history: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  historyContent: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleUser: {
    backgroundColor: `${colors.accent.purple}40`,
    alignSelf: "flex-end",
    borderBottomRightRadius: radius.sm,
  },
  bubbleAi: {
    backgroundColor: colors.background.card,
    alignSelf: "flex-start",
    borderBottomLeftRadius: radius.sm,
  },
  bubbleUserText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  bubbleAiText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: colors.background.card,
  },
  sendBtnLabel: {
    color: colors.text.inverse,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: -2,
  },
  demoNote: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontStyle: "italic",
  },
});
