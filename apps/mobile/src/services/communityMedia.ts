import type {
  CommunityMedia,
  CommunityMediaKind,
  SignUploadResponse,
  FinalizeUploadRequest,
} from "@lumina/shared";
import { apiPost, apiDelete } from "../lib/api";

export interface UploadProgress {
  phase: "signing" | "uploading" | "finalizing" | "done" | "error";
  progress: number; // 0..1
  error?: string;
}

export interface UploadInput {
  uri: string;
  kind: CommunityMediaKind;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface UploadResult {
  mediaId: string;
  status: CommunityMedia["status"];
  url: string | null;
}

/**
 * Three-phase upload:
 *   1. POST /sign-upload         — get a signed Supabase URL + mediaId
 *   2. PUT the file bytes to it  — direct device → storage (no API server hop)
 *   3. POST /finalize            — server enqueues video processing or marks ready
 */
export async function uploadCommunityMedia(
  input: UploadInput,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadResult> {
  onProgress?.({ phase: "signing", progress: 0.05 });
  const sign = await apiPost<SignUploadResponse>("/v1/community/media/sign-upload", {
    kind: input.kind,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  onProgress?.({ phase: "uploading", progress: 0.1 });
  await uploadToStorage(sign.uploadUrl, input.uri, input.mimeType, (loaded, total) => {
    const ratio = total > 0 ? loaded / total : 0;
    onProgress?.({ phase: "uploading", progress: 0.1 + 0.8 * ratio });
  });

  onProgress?.({ phase: "finalizing", progress: 0.92 });
  const finalize: FinalizeUploadRequest = {};
  if (input.width) finalize.width = input.width;
  if (input.height) finalize.height = input.height;
  if (input.durationMs) finalize.durationMs = input.durationMs;
  const result = await apiPost<UploadResult>(
    `/v1/community/media/${sign.mediaId}/finalize`,
    finalize,
  );

  onProgress?.({ phase: "done", progress: 1 });
  return result;
}

export function deleteCommunityMedia(mediaId: string) {
  return apiDelete(`/v1/community/media/${mediaId}`);
}

/**
 * PUT the local file at `uri` to Supabase Storage's signed URL.
 * RN's fetch can read `file://` URIs and stream them over the network without
 * loading the whole thing into memory at once.
 */
async function uploadToStorage(
  signedUrl: string,
  fileUri: string,
  mimeType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  // Best-effort progress: we report 0 → 1 around the fetch since RN's fetch
  // doesn't expose upload progress natively. Falls back to two pings.
  onProgress(0, 1);
  const fileBody = await fetch(fileUri).then((r) => r.blob());
  onProgress(0.4, 1);
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: fileBody,
  });
  onProgress(1, 1);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
}
