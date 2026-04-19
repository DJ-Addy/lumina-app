import { supabase } from "./supabase";

const RAW_BASE = process.env["EXPO_PUBLIC_API_BASE_URL"];
const BASE_URL = RAW_BASE ?? "http://localhost:3000";

/** True when an API server URL was actually provided via env. */
export const hasApiConfig = Boolean(RAW_BASE);

let warnedNoApi = false;
function warnNoApi() {
  if (warnedNoApi) return;
  warnedNoApi = true;
  console.warn(
    "[lumina-mobile] EXPO_PUBLIC_API_BASE_URL is not set — running in demo mode. Network calls will be skipped.",
  );
}

class DemoModeError extends Error {
  override readonly name = "DemoModeError";
  constructor() {
    super("Lumina is running in demo mode (no API configured).");
  }
}

export function isDemoModeError(err: unknown): boolean {
  return err instanceof DemoModeError;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!hasApiConfig) {
    warnNoApi();
    throw new DemoModeError();
  }
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body["code"] ?? "UNKNOWN", body["message"] ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (!hasApiConfig) {
    warnNoApi();
    throw new DemoModeError();
  }
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody["code"] ?? "UNKNOWN", errBody["message"] ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  if (!hasApiConfig) {
    warnNoApi();
    throw new DemoModeError();
  }
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody["code"] ?? "UNKNOWN", errBody["message"] ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  if (!hasApiConfig) {
    warnNoApi();
    throw new DemoModeError();
  }
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody["code"] ?? "UNKNOWN", errBody["message"] ?? res.statusText);
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
