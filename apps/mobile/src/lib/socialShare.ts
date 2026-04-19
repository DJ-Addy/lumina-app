import { Share } from "react-native";

export interface ShareInput {
  title: string;
  body: string;
  url?: string;
}

/**
 * Shows the native OS share sheet — works for Instagram, Facebook, Snapchat,
 * WhatsApp, SMS, Mail, and any other installed app that accepts the
 * UTI/MIME we're sharing.
 */
export async function shareNative(input: ShareInput): Promise<void> {
  const message = input.url ? `${input.body}\n\n${input.url}` : input.body;
  await Share.share(
    {
      title: input.title,
      message,
      url: input.url,
    },
    {
      dialogTitle: input.title,
      subject: input.title,
    },
  );
}
