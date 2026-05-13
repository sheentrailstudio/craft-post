"use client";

import { Platform } from "@/lib/api";
import Link from "next/link";

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
    <div>
      <h2 className="text-h3 mb-3">Publish to</h2>
      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => {
          const active = selected.includes(platform.id);
          const disabled = !platform.account_connected || platform.token_expired;
          return (
            <label
              key={platform.id}
              className={active ? "platform-choice platform-choice-active" : "platform-choice"}
            >
              <input
                className="sr-only"
                type="checkbox"
                checked={active}
                disabled={disabled}
                onChange={() => {
                  if (!disabled) onToggle(platform.id);
                }}
              />
              <span className="platform-check" aria-hidden="true">
                {active ? "✓" : ""}
              </span>
              <span>{platform.display_name}</span>
              {disabled ? (
                <Link className="text-sm text-[var(--accent)]" href="/app/identities">
                  連結帳號
                </Link>
              ) : (
                <span className="text-sm">{platform.account_username}</span>
              )}
            </label>
          );
        })}
      </div>
      {!selected.length ? (
        <p className="mt-3 text-sm text-[var(--error)]">請至少選擇一個平台</p>
      ) : null}
    </div>
  );
}
