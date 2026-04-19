import type { MemoryBookExportResponse, RequestMemoryBookExport, MemoryBookExport } from "@lumina/shared";
import { apiGet, apiPost } from "../lib/api";

export const memoryBookService = {
  requestExport: (data: RequestMemoryBookExport) =>
    apiPost<MemoryBookExportResponse>("/v1/memory-book/export", data),
  getExportStatus: (id: string) =>
    apiGet<{ export: MemoryBookExport }>(`/v1/memory-book/export/${id}`),
};
