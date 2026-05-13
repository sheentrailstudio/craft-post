"use client";

import DraftPane from "@/components/editor/DraftPane";
import EditorToolbar from "@/components/editor/EditorToolbar";
import MediaZone from "@/components/editor/MediaZone";
import PlatformSelector from "@/components/editor/PlatformSelector";
import PromptPane from "@/components/editor/PromptPane";
import { useEditorState } from "@/hooks/useEditor";

export default function EditorLayout() {
  const { state, identities, availablePlatforms, strictMaxChars, actions } = useEditorState();
  const canRefine = Boolean(state.draft.trim()) && state.platforms.length > 0;
  const visibleError =
    state.error &&
    !state.error.includes("最多上傳") &&
    !state.error.includes("影片") &&
    !state.error.includes("圖片") &&
    !state.error.includes("檔案")
      ? state.error
      : null;

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
            if (!state.identity_id) return false;
            sessionStorage.setItem(
              "craftpost.publishDraft",
              JSON.stringify({
                identity_id: state.identity_id,
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
            return true;
          }}
        />
      </div>
    </div>
  );
}
