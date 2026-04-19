import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { MemoryBookDocument } from "../templates/MemoryBookDocument.js";

export interface MemoryBookData {
  babyName: string;
  monthCheckpoint: number;
  coverVariant: string;
  entries: Array<{
    content: string;
    createdAt: string;
    weekNumber: number;
    moodTags: string[];
  }>;
  letters: Array<{ content: string; createdAt: string }>;
}

export async function generateMemoryBookPdf(data: MemoryBookData): Promise<string> {
  const buffer = await renderToBuffer(createElement(MemoryBookDocument, data));

  const fileName = `memory-book-${Date.now()}.pdf`;
  const filePath = join(tmpdir(), fileName);
  await writeFile(filePath, buffer);
  return filePath;
}
