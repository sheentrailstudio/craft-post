"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { refineDraft } from "@/lib/api";

export type LandingDraftState = {
  draft: string;
  refined: string;
  user_subprompt: string;
};

export type TextRefineBlockHandle = {
  setDraft: (draft: string) => void;
  scrollIntoView: () => void;
};

type TextRefineBlockProps = {
  isAuthenticated: boolean;
  onDraftChange: (state: LandingDraftState) => void;
  onPublish: () => void;
};

const TextRefineBlock = forwardRef<TextRefineBlockHandle, TextRefineBlockProps>(
  function TextRefineBlock({ onDraftChange, onPublish }, ref) {
    const rootRef = useRef<HTMLElement>(null);
    const [draft, setDraftState] = useState("");
    const [refined, setRefined] = useState("");
    const [prompt, setPrompt] = useState("");
    const [isRefining, setIsRefining] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const editor = useEditor({
      extensions: [StarterKit],
      content: "",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "input-surface",
        },
      },
      onUpdate({ editor: activeEditor }) {
        const text = activeEditor.getText();
        setDraftState(text);
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        setDraft(nextDraft) {
          editor?.commands.setContent(`<p>${escapeHtml(nextDraft)}</p>`);
          setDraftState(nextDraft);
        },
        scrollIntoView() {
          rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }),
      [editor],
    );

    useEffect(() => {
      onDraftChange({ draft, refined, user_subprompt: prompt });
    }, [draft, refined, onDraftChange, prompt]);

    async function handleRefine() {
      const currentDraft = draft.trim();
      if (!currentDraft) return;

      setError("");
      setIsRefining(true);

      try {
        const result = await refineDraft(currentDraft, prompt);
        const nextText = result || currentDraft;
        setRefined(nextText);
        editor?.commands.setContent(`<p>${escapeHtml(nextText)}</p>`);
        setDraftState(nextText);
      } catch {
        setError("Refine failed. Please try again.");
      } finally {
        setIsRefining(false);
      }
    }

    async function handleCopy() {
      const text = refined || draft;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }

    return (
      <section ref={rootRef} className="surface p-5 md:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-h2">Write</h2>
          <span className="platform-dots" aria-label="Selected platforms">
            <span className="platform-dot platform-dot-active" />
            <span className="platform-dot platform-dot-active" />
            <span className="platform-dot" />
          </span>
        </div>

        <div className="editor-wrap">
          {!draft && (
            <span className="editor-placeholder text-sm">
              Paste your draft here...
            </span>
          )}
          <EditorContent editor={editor} />
        </div>

        <label className="mt-5 block">
          <span className="text-label mb-2 block">AI prompt (optional)</span>
          <div className="relative">
            <textarea
              className="input-surface min-h-28 w-full resize-none p-4 pb-8 text-sm leading-6"
              maxLength={300}
              placeholder="e.g. Add a CTA, keep it under 150 words..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, 300))}
            />
            <span className="text-sm absolute bottom-3 right-4">
              {prompt.length} / 300
            </span>
          </div>
        </label>

        <div className="mt-5 flex justify-end">
          <button
            className="btn btn-primary"
            type="button"
            disabled={!draft.trim() || isRefining}
            onClick={handleRefine}
          >
            {isRefining ? "Refining..." : "✦ Refine ->"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}

        <AnimatePresence>
          {refined ? (
            <motion.div
              className="mt-6 border-t border-[var(--bg-border)] pt-5"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-label">✦ Refined</p>
                  <p className="text-sm">Keep editing above before publishing.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={handleCopy}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={onPublish}
                  >
                    {"Publish ->"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    );
  },
);

export default TextRefineBlock;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}
