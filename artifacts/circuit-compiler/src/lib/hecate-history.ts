import type { HecateAnalyzeResult } from "@workspace/api-client-react";

const STORAGE_KEY = "scc_hecate_history";
const MAX_ENTRIES = 5;
const THUMB_WIDTH  = 120;
const THUMB_HEIGHT = 90;

export interface HecateHistoryEntry {
  id: string;
  timestamp: number;
  thumbnailUrl: string;
  description: string;
  result: HecateAnalyzeResult;
}

export function loadHistory(): HecateHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as HecateHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HecateHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded — silently skip
  }
}

/**
 * Resize a data URL to a small thumbnail using an off-screen canvas.
 * Falls back to the original if canvas is unavailable.
 */
function makeThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const aspect = img.height / Math.max(img.width, 1);
        const w = THUMB_WIDTH;
        const h = Math.round(Math.min(w * aspect, THUMB_HEIGHT));
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function addHistoryEntry(
  photoDataUrl: string,
  description: string,
  result: HecateAnalyzeResult,
): Promise<void> {
  const thumbnailUrl = await makeThumbnail(photoDataUrl);
  const entry: HecateHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    thumbnailUrl,
    description,
    result,
  };
  const history = loadHistory();
  // Prepend, keep only latest MAX_ENTRIES
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  saveHistory(updated);
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function timeAgo(timestamp: number): string {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
