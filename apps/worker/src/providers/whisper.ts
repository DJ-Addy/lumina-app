import OpenAI from "openai";
import { createReadStream } from "fs";
import { env } from "../lib/env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function transcribeAudio(localFilePath: string): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(localFilePath),
    model: "whisper-1",
    language: "en",
  });
  return transcription.text;
}
