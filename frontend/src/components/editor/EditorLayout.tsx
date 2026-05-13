"use client";

import DraftPane from "@/components/editor/DraftPane";
import EditorToolbar from "@/components/editor/EditorToolbar";
import MediaZone from "@/components/editor/MediaZone";
import PlatformSelector from "@/components/editor/PlatformSelector";
import PromptPane from "@/components/editor/PromptPane";
import { useEditorState } from "@/hooks/useEditor";
import {
  createDraftId,
  getStoredDraft,
  upsertStoredDraft,
  updateDraftStatus,
} from "@/lib/drafts";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

export default function EditorLayout() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { state, identities, availablePlatforms, strictMaxChars, actions } = useEditorState();
  const loadedDraftId = useRef<string | null>(null);
  const canRefine = Boolean(state.draft.trim()) && state.platforms.length > 0;
  const firstMedia = state.media?.items[0] ?? null;
  const isNewDraftRoute = useMemo(() => pathname.endsWith("/drafts/new"), [pathname]);
  const generatedNewDraftId = useMemo(
    () => (isNewDraftRoute ? createDraftId() : null),
    [isNewDraftRoute],
  );
  const draftId = params.id ?? generatedNewDraftId;
  const visibleDraftId = draftId ?? "unsaved";
  const visibleError =
    state.error &&
    !state.error.includes("最多上傳") &&
    !state.error.includes("影片") &&
    !state.error.includes("圖片") &&
    !state.error.includes("檔案")
      ? state.error
      : null;

  useEffect(() => {
    if (!isNewDraftRoute || !generatedNewDraftId) return;

    router.replace(`/app/drafts/${generatedNewDraftId}`);
  }, [generatedNewDraftId, isNewDraftRoute, router]);

  useEffect(() => {
    if (!params.id || loadedDraftId.current === params.id) return;

    const storedDraft = getStoredDraft(params.id);
    if (storedDraft) {
      actions.loadSnapshot({
        draft: storedDraft.text,
        user_subprompt: storedDraft.prompt ?? "",
        platforms: storedDraft.platforms,
        identity_id: storedDraft.identity_id,
      });
    }

    loadedDraftId.current = params.id;
  }, [actions, params.id]);

  useEffect(() => {
    if (!draftId || !state.draft.trim()) return;

    const timeout = window.setTimeout(() => {
      upsertStoredDraft({
        id: draftId,
        text: state.draft,
        prompt: state.user_subprompt,
        status: "draft",
        platforms: state.platforms,
        identity_id: state.identity_id,
        thumbnail_url: firstMedia?.url ?? null,
        media_kind: firstMedia?.kind ?? null,
        aspect_ratio: state.media?.aspectRatio ?? "1:1",
        updated_at: new Date().toISOString(),
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [
    draftId,
    firstMedia?.kind,
    firstMedia?.url,
    state.draft,
    state.identity_id,
    state.media?.aspectRatio,
    state.platforms,
    state.user_subprompt,
  ]);

  return (
    <div className="editor-layout">
      <MediaZone
        media={state.media}
        error={
          state.error &&
          (state.error.includes("最多上傳") ||
            state.error.includes("影片") ||
            state.error.includes("圖片") ||
            state.error.includes("檔案"))
            ? state.error
            : null
        }
        onAddFiles={actions.addMediaFiles}
        onAspectRatioChange={actions.setAspectRatio}
        onClear={actions.clearMedia}
      />

      <div className="editor-grid">
        <DraftPane
          draft={state.draft}
          isRefining={state.is_refining}
          maxChars={strictMaxChars}
          onChange={actions.setDraft}
        />
        <PromptPane value={state.user_subprompt} onChange={actions.setPrompt} />
      </div>

      {visibleError ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
          {visibleError}
        </p>
      ) : null}

      <div className="editor-grid editor-grid-bottom">
        <section className="surface editor-pane">
          <h2 className="text-h3 mb-3">身份</h2>
          {identities.length ? (
            <select
              className="input-surface w-full px-4 py-3 outline-none"
              value={state.identity_id ?? ""}
              onChange={(event) => actions.setIdentity(event.target.value)}
            >
              {identities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.name}
                  {identity.is_default ? " (Default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-body">尚未建立身份，前往發布前需要先新增身份。</p>
          )}
          <div className="mt-4">
            <PlatformSelector
              platforms={availablePlatforms}
              selected={state.platforms}
              onToggle={actions.togglePlatform}
            />
          </div>
        </section>
        <EditorToolbar
          canRefine={canRefine}
          isRefining={state.is_refining}
          onRefine={actions.refineDraft}
          onPublish={() => {
            if (!state.identity_id) return null;
            sessionStorage.setItem(
              "craftpost.publishDraft",
              JSON.stringify({
                identity_id: state.identity_id,
                draft_id: visibleDraftId,
                text: state.draft,
                platforms: state.platforms,
                media: state.media
                  ? {
                      aspectRatio: state.media.aspectRatio,
                      items: state.media.items.map((item) => ({
                        id: item.id,
                        name: item.file.name,
                        url: item.url,
                        kind: item.kind,
                      })),
                    }
                  : null,
              }),
            );
            if (draftId) updateDraftStatus(draftId, "confirmed");
            return visibleDraftId;
          }}
        />
      </div>
    </div>
  );
}
