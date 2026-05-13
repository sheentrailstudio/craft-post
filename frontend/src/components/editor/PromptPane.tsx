"use client";

type PromptPaneProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function PromptPane({ value, onChange }: PromptPaneProps) {
  const isOverLimit = value.length > 300;

  return (
    <section className="surface editor-pane">
      <label>
        <span className="mb-3 flex items-center justify-between gap-3">
          <span className="text-h3">AI Prompt</span>
          <span className={isOverLimit ? "text-sm text-[var(--error)]" : "text-sm"}>
            {value.length} / 300
          </span>
        </span>
        <textarea
          className="input-surface min-h-[120px] w-full resize-none p-4 text-sm leading-6"
          maxLength={300}
          placeholder="e.g. 結尾加 CTA、字數控制在 150 字以內..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </section>
  );
}
