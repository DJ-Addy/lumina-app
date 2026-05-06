import { Alert } from "react-native";
import type { JournalSaveResponse } from "@lumina/shared";

const CRISIS_BODY =
  "What you wrote has us a little worried. You're not alone in this.\n\n" +
  "If you're in the US, call or text 988 — the Suicide & Crisis Lifeline.\n" +
  "If you'd rather talk to a postpartum-trained listener, call 1-833-943-5746 (PSI HelpLine).\n\n" +
  "Your entry was saved privately — only you can see it.";

/** Non-blocking: show support resources when the API flagged crisis-level self-harm language. */
export function alertJournalCrisisIfNeeded(result: JournalSaveResponse): void {
  if (!result.crisis?.showResources) return;
  Alert.alert("We're here for you", CRISIS_BODY, [{ text: "Okay" }]);
}
