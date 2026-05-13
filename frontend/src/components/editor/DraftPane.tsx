"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type DraftPaneProps = {
  draft: string;
  isRefining: boolean;
  maxChars: number | null;
  onChange: (draft: string) => void;
};

export default function DraftPane({
  draft,
  isRefining,
  maxChars,
  onChange,
}: DraftPaneProps) {
  const lastAppliedDraft = useRef(draft);
  const editor = useEditor({
    extensions: [StarterKit],
    content: textToHtml(draft),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "input-surface min-h-[300px]",
      },
    },
    onUpdate({ editor: activeEditor }) {
      const text = activeEditor.getText();
      lastAppliedDraft.current = text;
      onChange(text);
    },
  });

  useEffect(() => {
    if (!editor || draft === lastAppliedDraft.current) return;
    lastAppliedDraft.current = draft;
    editor.commands.setContent(textToHtml(draft));
  }, [draft, editor]);

  const isOverLimit = maxChars !== null && draft.length > maxChars;

  return (
    <section className="surface editor-pane">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-h3">草稿</h2>
        <span className={isOverLimit ? "text-sm text-[var(--error)]" : "text-sm"}>
          字數: {draft.length}
          {maxChars ? ` / ${maxChars}` : ""}
        </span>
      </div>

      <div className="editor-wrap">
        {!draft && !isRefining ? (
          <span className="editor-placeholder text-sm">在這裡輸入草稿</span>
        ) : null}
        <EditorContent editor={editor} />
        {isRefining ? <div className="editor-skeleton" aria-hidden="true" /> : null}
      </div>
    </section>
  );
}

function textToHtml(value: string) {
  if (!value) return "";
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
