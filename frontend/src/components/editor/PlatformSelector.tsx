"use client";

import { Platform } from "@/lib/api";

type PlatformSelectorProps = {
  platforms: Platform[];
  selected: string[];
  onToggle: (platformId: string) => void;
};

export default function PlatformSelector({
  platforms,
  selected,
  onToggle,
}: PlatformSelectorProps) {
  return (
    <section className="surface editor-pane">
      <h2 className="text-h3 mb-3">Publish to</h2>
      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => {
          const active = selected.includes(platform.id);
          return (
            <label
              key={platform.id}
              className={active ? "platform-choice platform-choice-active" : "platform-choice"}
            >
              <input
                className="sr-only"
                type="checkbox"
                checked={active}
                onChange={() => onToggle(platform.id)}
              />
              <span className="platform-check" aria-hidden="true">
                {active ? "✓" : ""}
              </span>
              <span>{platform.display_name}</span>
            </label>
          );
        })}
      </div>
      {!selected.length ? (
        <p className="mt-3 text-sm text-[var(--error)]">請至少選擇一個平台</p>
      ) : null}
    </section>
  );
}
