import type { AspectRatio } from "@/hooks/useEditor";

export type DraftProgress = "draft" | "confirmed" | "scheduled" | "published";

export type StoredDraft = {
  id: string;
  text: string;
  prompt?: string;
  status: DraftProgress;
  platforms: string[];
  identity_id: string | null;
  thumbnail_url: string | null;
  media_kind: "image" | "video" | null;
  aspect_ratio: AspectRatio;
  updated_at: string;
  scheduled_at?: string | null;
};

const DRAFTS_KEY = "craftpost.drafts";
const DRAFTS_EVENT = "craftpost:drafts-changed";
let cachedDraftsRaw: string | null = null;
let cachedDrafts: StoredDraft[] = [];

export function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}`;
}

export function listStoredDrafts(): StoredDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY) ?? "[]";
    if (raw === cachedDraftsRaw) return cachedDrafts;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    cachedDraftsRaw = raw;
    cachedDrafts = parsed
      .filter(isStoredDraft)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return cachedDrafts;
  } catch {
    return [];
  }
}

export function subscribeStoredDrafts(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === DRAFTS_KEY) onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(DRAFTS_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DRAFTS_EVENT, onStoreChange);
  };
}

export function getStoredDraft(id: string): StoredDraft | null {
  return listStoredDrafts().find((draft) => draft.id === id) ?? null;
}

export function upsertStoredDraft(nextDraft: StoredDraft): void {
  if (typeof window === "undefined") return;

  const drafts = listStoredDrafts();
  const nextDrafts = [
    nextDraft,
    ...drafts.filter((draft) => draft.id !== nextDraft.id),
  ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(nextDrafts));
  window.dispatchEvent(new Event(DRAFTS_EVENT));
}

export function updateDraftStatus(
  id: string,
  status: DraftProgress,
  scheduledAt?: string | null,
): void {
  const draft = getStoredDraft(id);
  if (!draft) return;

  upsertStoredDraft({
    ...draft,
    status,
    scheduled_at: scheduledAt ?? draft.scheduled_at ?? null,
    updated_at: new Date().toISOString(),
  });
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<StoredDraft>;
  return (
    typeof draft.id === "string" &&
    typeof draft.text === "string" &&
    typeof draft.updated_at === "string" &&
    ["draft", "confirmed", "scheduled", "published"].includes(draft.status ?? "")
  );
}
