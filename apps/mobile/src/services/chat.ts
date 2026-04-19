import EventSource from "react-native-sse";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const BASE_URL = process.env["EXPO_PUBLIC_API_BASE_URL"] ?? "http://localhost:3000";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface StreamChatOptions {
  message: string;
  history: ChatTurn[];
  moodTags?: string[];
  saveToJournal?: boolean;
  onStart?: (messageId: string) => void;
  onDelta: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  if (!hasSupabaseConfig) {
    return runDemoStream(opts);
  }

  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    return runDemoStream(opts);
  }

  if (!token) {
    return runDemoStream(opts);
  }

  return new Promise((resolve) => {
    let full = "";
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        es.close();
      } catch {
        // ignore
      }
      resolve();
    };

    const es = new EventSource(`${BASE_URL}/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: opts.message,
        history: opts.history,
        moodTags: opts.moodTags ?? [],
        saveToJournal: opts.saveToJournal ?? false,
      }),
      pollingInterval: 0,
    });

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        opts.onError(new Error("Aborted"));
        finish();
      });
    }

    es.addEventListener("message", (event) => {
      const raw = event.data;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as
          | { type: "start"; messageId: string }
          | { type: "delta"; text: string }
          | { type: "done"; fullText: string }
          | { type: "error"; message: string };

        if (parsed.type === "start") {
          opts.onStart?.(parsed.messageId);
        } else if (parsed.type === "delta") {
          full += parsed.text;
          opts.onDelta(parsed.text);
        } else if (parsed.type === "done") {
          opts.onDone(parsed.fullText || full);
          finish();
        } else if (parsed.type === "error") {
          opts.onError(new Error(parsed.message));
          finish();
        }
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener("error", (event) => {
      let message = "Stream connection failed";
      const e = event as unknown as { message?: string; xhrStatus?: number };
      if (e.xhrStatus === 402) {
        message = "CREDITS_EXHAUSTED";
      } else if (e.message) {
        message = e.message;
      }
      opts.onError(new Error(message));
      finish();
    });

    es.addEventListener("close", () => {
      if (!settled && full.length > 0) {
        opts.onDone(full);
      }
      finish();
    });
  });
}

const DEMO_REPLIES = [
  "I hear you. That sounds like a lot to hold all at once. What part of it feels heaviest right now?",
  "Thank you for telling me that. You're allowed to feel exactly what you're feeling. What would feel kind to you in this moment?",
  "Mm. The way you said that — there's so much underneath it. Can you stay with that feeling for a breath, and tell me where you feel it in your body?",
  "You don't have to make sense of it. Sometimes the body knows before the words come. Is there an image or a color that comes up with this?",
  "That's real. And you carrying it doesn't mean you're failing — it means you're paying attention. What's one small thing that felt okay today, even briefly?",
];

async function runDemoStream(opts: StreamChatOptions): Promise<void> {
  const reply = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)] ?? DEMO_REPLIES[0]!;
  opts.onStart?.("demo-" + Date.now().toString(36));

  await sleep(250);

  let full = "";
  for (const word of reply.split(" ")) {
    if (opts.signal?.aborted) {
      opts.onError(new Error("Aborted"));
      return;
    }
    const chunk = full.length === 0 ? word : " " + word;
    full += chunk;
    opts.onDelta(chunk);
    await sleep(40 + Math.random() * 60);
  }

  opts.onDone(full);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
