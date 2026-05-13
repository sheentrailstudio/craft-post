"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  listStoredDrafts,
  StoredDraft,
  subscribeStoredDrafts,
} from "@/lib/drafts";

const STATUS_LABELS: Record<StoredDraft["status"], string> = {
  draft: "草稿",
  confirmed: "確認",
  scheduled: "排程",
  published: "發布",
};

export default function DraftsList() {
  const drafts = useSyncExternalStore(
    subscribeStoredDrafts,
    listStoredDrafts,
    () => [],
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label mb-2">Drafts</p>
          <h1 className="text-h1 mb-3">草稿清單</h1>
          <p className="text-body max-w-2xl">
            查看每則草稿的內容預覽、素材縮圖與目前進度。
          </p>
        </div>
        <Link className="btn btn-primary" href="/app/drafts/new">
          新增草稿
        </Link>
      </header>

      {drafts.length ? (
        <div className="draft-list">
          {drafts.map((draft) => (
            <Link className="draft-row card-interactive" href={`/app/drafts/${draft.id}`} key={draft.id}>
              <DraftThumbnail draft={draft} />
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`progress-pill progress-${draft.status}`}>
                    {STATUS_LABELS[draft.status]}
                  </span>
                  <span className="text-sm">{formatUpdatedAt(draft.updated_at)}</span>
                </div>
                <p className="draft-preview">{previewText(draft.text)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.platforms.map((platform) => (
                    <span className="badge" key={platform}>
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="surface grid gap-4 p-6">
          <div>
            <h2 className="text-h2 mb-2">尚未建立草稿</h2>
            <p className="text-body">開始編輯後，草稿會自動出現在這裡。</p>
          </div>
          <Link className="btn btn-secondary w-fit" href="/app/drafts/new">
            建立第一則草稿
          </Link>
        </section>
      )}
    </div>
  );
}

function DraftThumbnail({ draft }: { draft: StoredDraft }) {
  if (draft.thumbnail_url && draft.media_kind === "image") {
    return (
      <div className="draft-thumb" style={{ aspectRatio: draft.aspect_ratio.replace(":", " / ") }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.thumbnail_url} alt="" />
      </div>
    );
  }

  if (draft.thumbnail_url && draft.media_kind === "video") {
    return (
      <div className="draft-thumb" style={{ aspectRatio: draft.aspect_ratio.replace(":", " / ") }}>
        <video src={draft.thumbnail_url} muted playsInline />
      </div>
    );
  }

  return (
    <div className="draft-thumb draft-thumb-text" aria-hidden="true">
      {draft.text.trim().slice(0, 1).toUpperCase() || "D"}
    </div>
  );
}

function previewText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 100 ? `${compact.slice(0, 100)}...` : compact;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
