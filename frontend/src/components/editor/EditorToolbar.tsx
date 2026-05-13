"use client";

import { useRouter } from "next/navigation";

type EditorToolbarProps = {
  canRefine: boolean;
  isRefining: boolean;
  onRefine: () => void;
  onPublish: () => string | null;
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
            const postId = onPublish();
            if (postId) {
              router.push(`/app/publish/${postId}`);
            } else {
              router.push("/app/identities");
            }
          }}
        >
          前往發布 -&gt;
        </button>
      </div>
    </section>
  );
}
