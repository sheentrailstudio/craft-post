"use client";

import { useRouter } from "next/navigation";

type EditorToolbarProps = {
  canRefine: boolean;
  isRefining: boolean;
  onRefine: () => void;
  onPublish: () => boolean;
};

export default function EditorToolbar({
  canRefine,
  isRefining,
  onRefine,
  onPublish,
}: EditorToolbarProps) {
  const router = useRouter();

  return (
    <section className="surface editor-pane">
      <div className="flex flex-wrap justify-end gap-3">
        <button
          className="btn btn-secondary"
          type="button"
          disabled={!canRefine || isRefining}
          onClick={onRefine}
        >
          {isRefining ? (
            <>
              <span className="spinner" aria-hidden="true" />
              修稿中
            </>
          ) : (
            "重新修稿"
          )}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            if (onPublish()) {
              router.push("/app/publish/mock-post-id");
            } else {
              router.push("/app/settings/identities");
            }
          }}
        >
          前往發布 -&gt;
        </button>
      </div>
    </section>
  );
}
