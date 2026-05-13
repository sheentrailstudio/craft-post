"use client";

import DraftPane from "@/components/editor/DraftPane";
import EditorToolbar from "@/components/editor/EditorToolbar";
import MediaZone from "@/components/editor/MediaZone";
import PlatformSelector from "@/components/editor/PlatformSelector";
import PromptPane from "@/components/editor/PromptPane";
import { useEditorState } from "@/hooks/useEditor";

export default function EditorLayout() {
  const { state, availablePlatforms, strictMaxChars, actions } = useEditorState();
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
        <PlatformSelector
          platforms={availablePlatforms}
          selected={state.platforms}
          onToggle={actions.togglePlatform}
        />
        <EditorToolbar
          canRefine={canRefine}
          isRefining={state.is_refining}
          onRefine={actions.refineDraft}
          onPublish={() => {
            sessionStorage.setItem(
              "craftpost.publishDraft",
              JSON.stringify({
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
          }}
        />
      </div>
    </div>
  );
}
