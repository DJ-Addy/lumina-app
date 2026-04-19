import { supabase } from "./supabase.js";

export const COMMUNITY_MEDIA_BUCKET = "community-media";

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250MB

export function validateMediaUpload(kind: "image" | "video", mimeType: string, bytes: number) {
  if (kind === "image") {
    if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
      return { ok: false as const, message: `Unsupported image type ${mimeType}` };
    }
    if (bytes > MAX_IMAGE_BYTES) {
      return { ok: false as const, message: "Image is larger than 25 MB" };
    }
  } else {
    if (!ALLOWED_VIDEO_MIME.has(mimeType)) {
      return { ok: false as const, message: `Unsupported video type ${mimeType}` };
    }
    if (bytes > MAX_VIDEO_BYTES) {
      return { ok: false as const, message: "Video is larger than 250 MB" };
    }
  }
  return { ok: true as const };
}

export function buildStorageKey(userId: string, mediaId: string, mimeType: string): string {
  const ext = mimeExtension(mimeType);
  return `${userId}/${mediaId}/source.${ext}`;
}

export function buildVariantKey(
  userId: string,
  mediaId: string,
  label: "480p" | "720p" | "1080p" | "thumb",
): string {
  if (label === "thumb") return `${userId}/${mediaId}/thumb.jpg`;
  return `${userId}/${mediaId}/${label}.mp4`;
}

function mimeExtension(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    case "video/mp4": return "mp4";
    case "video/quicktime": return "mov";
    case "video/webm": return "webm";
    case "video/x-m4v": return "m4v";
    default: return "bin";
  }
}

/** Create a one-shot signed upload URL for the supplied storage key. */
export async function createSignedUploadUrl(storageKey: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const { data, error } = await supabase.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .createSignedUploadUrl(storageKey);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Resolve a public CDN URL for a stored object. Bucket is public, so this is direct. */
export function publicUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const { data } = supabase.storage.from(COMMUNITY_MEDIA_BUCKET).getPublicUrl(storageKey);
  return data.publicUrl;
}
