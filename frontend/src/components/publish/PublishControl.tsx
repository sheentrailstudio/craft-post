"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BestTimeSuggestion,
  connectSocialAccount,
  getIdentities,
  getBestTime,
  getPlatforms,
  Identity,
  Platform,
  publishPost,
  PublishResult,
} from "@/lib/api";
import { updateDraftStatus } from "@/lib/drafts";

type PublishControlProps = {
  postId: string;
};

type PublishDraft = {
  text: string;
  identity_id: string | null;
  platforms: string[];
  media: {
    aspectRatio: string;
    items: {
      id: string;
      name: string;
      url: string;
      kind: "image" | "video";
    }[];
  } | null;
};

const DEFAULT_TEXT =
  "今天把草稿整理成一篇可以發布的貼文。保留原本的語氣，讓內容更清楚，也讓讀者更容易接住重點。";

const DEFAULT_PLATFORMS: Platform[] = [
  {
    id: "instagram",
    display_name: "Instagram",
    max_chars: 2200,
    media_limits: { max_images: 10, max_videos: 1 },
    account_connected: false,
    account_username: null,
    token_expired: false,
  },
  {
    id: "threads",
    display_name: "Threads",
    max_chars: 500,
    media_limits: { max_images: 10, max_videos: 1 },
    account_connected: false,
    account_username: null,
    token_expired: false,
  },
];

export default function PublishControl({ postId }: PublishControlProps) {
  const [draft] = useState<PublishDraft>(() => readStoredDraft());
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [identityId, setIdentityId] = useState<string | null>(draft.identity_id);
  const [platforms, setPlatforms] = useState<Platform[]>(DEFAULT_PLATFORMS);
  const [platformTexts, setPlatformTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      readStoredDraft().platforms.map((platform) => [platform, readStoredDraft().text]),
    ),
  );
  const [openPlatforms, setOpenPlatforms] = useState<Record<string, boolean>>({
    instagram: true,
    threads: true,
  });
  const [mode, setMode] = useState<"immediate" | "scheduled">("immediate");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [bestTime, setBestTime] = useState<BestTimeSuggestion | null>(null);
  const [isBestTimeLoading, setIsBestTimeLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIdentities()
      .then(async (response) => {
        setIdentities(response.items);
        const selected =
          draft.identity_id && response.items.some((identity) => identity.id === draft.identity_id)
            ? draft.identity_id
            : (response.items.find((identity) => identity.is_default) ?? response.items[0])?.id;
        if (!selected) {
          window.location.href = "/app/identities";
          return;
        }
        setIdentityId(selected);
        setPlatforms(await getPlatforms(selected));
      })
      .catch(() => setPlatforms(DEFAULT_PLATFORMS));
  }, [draft.identity_id]);

  useEffect(() => {
    if (mode !== "scheduled") return;

    let active = true;
    getBestTime(draft.platforms)
      .then((response) => {
        if (!active) return;
        setBestTime(response.recommended);
      })
      .catch(() => {
        if (active) setBestTime(null);
      })
      .finally(() => {
        if (active) setIsBestTimeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [draft.platforms, mode]);

  const selectedPlatforms = useMemo(
    () => platforms.filter((platform) => draft.platforms.includes(platform.id)),
    [draft.platforms, platforms],
  );

  const hasOverLimit = selectedPlatforms.some(
    (platform) => (platformTexts[platform.id] ?? "").length > platform.max_chars,
  );

  const canSubmit =
    !isSubmitting &&
    Boolean(identityId) &&
    draft.platforms.length > 0 &&
    !hasOverLimit &&
    (mode === "immediate" || (date !== "" && time !== "" && scheduleError === null));

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    setResults(null);

    try {
      const response = await publishPost({
        identity_id: identityId ?? "",
        platforms: draft.platforms,
        platform_texts: Object.fromEntries(
          draft.platforms.map((platform) => [platform, platformTexts[platform] ?? ""]),
        ),
        media_urls: [],
        scheduled_at:
          mode === "scheduled" ? new Date(`${date}T${time}:00`).toISOString() : null,
      });

      if (response.mode === "scheduled") {
        updateDraftStatus(postId, "scheduled", response.scheduled_at);
        setNotice(`已排程：${formatLocalDateTime(new Date(response.scheduled_at))} 發布`);
      } else {
        updateDraftStatus(postId, "published");
        setResults(response.results);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "發布失敗");
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyBestTime() {
    if (!bestTime) return;
    updateSchedule(bestTime.local_date, bestTime.local_time);
  }

  function updateSchedule(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);

    if (!nextDate || !nextTime) {
      setScheduleError(null);
      return;
    }

    const nextDateTime = new Date(`${nextDate}T${nextTime}:00`);
    setScheduleError(
      nextDateTime.getTime() <= new Date().getTime() ? "請選擇未來的時間" : null,
    );
  }

  async function updateIdentity(nextIdentityId: string) {
    setIdentityId(nextIdentityId);
    setPlatforms(await getPlatforms(nextIdentityId));
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="btn btn-ghost px-0" href={`/app/drafts/${postId}`}>
          &lt;- 返回編輯
        </Link>
        <span className="text-mono text-[var(--text-tertiary)]">{postId}</span>
      </div>

      {draft.media?.items.length ? (
        <section className="surface p-4">
          <div className="flex gap-3 overflow-x-auto">
            {draft.media.items.map((item) => (
              <div
                key={item.id}
                className="media-thumb"
                style={{ aspectRatio: draft.media?.aspectRatio.replace(":", " / ") }}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.name} />
                ) : (
                  <video src={item.url} muted playsInline controls />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface p-5">
        <p className="text-label mb-3">Identity</p>
        <select
          className="input-surface w-full px-4 py-3 outline-none"
          value={identityId ?? ""}
          onChange={(event) => updateIdentity(event.target.value)}
        >
          {identities.map((identity) => (
            <option key={identity.id} value={identity.id}>
              {identity.name}
              {identity.is_default ? " (Default)" : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="surface p-5">
        <p className="text-label mb-3">Platform copy</p>
        <div className="grid gap-3">
          {selectedPlatforms.map((platform) => {
            const value = platformTexts[platform.id] ?? draft.text;
            const isOpen = openPlatforms[platform.id] ?? false;
            const overLimit = value.length > platform.max_chars;

            return (
              <div
                className="rounded-[var(--radius-md)] border border-[var(--bg-border)]"
                key={platform.id}
              >
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  type="button"
                  onClick={() =>
                    setOpenPlatforms((current) => ({
                      ...current,
                      [platform.id]: !isOpen,
                    }))
                  }
                >
                  <span className="text-h3">{platform.display_name}</span>
                  <span className="text-sm">{isOpen ? "收合" : "展開"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <div className="border-t border-[var(--bg-border)] p-4">
                        <textarea
                          className="input-surface min-h-36 w-full resize-none p-4 leading-7 outline-none"
                          value={value}
                          onChange={(event) =>
                            setPlatformTexts((current) => ({
                              ...current,
                              [platform.id]: event.target.value,
                            }))
                          }
                        />
                        <div
                          className={
                            overLimit
                              ? "input-count over"
                              : "input-count text-[var(--text-tertiary)]"
                          }
                        >
                          {value.length}/{platform.max_chars}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface p-5">
        <p className="text-label mb-4">Publish time</p>
        <div className="flex flex-wrap gap-3">
          <label className={mode === "immediate" ? "radio-card radio-card-active" : "radio-card"}>
            <input
              checked={mode === "immediate"}
              name="publish-mode"
              type="radio"
              onChange={() => setMode("immediate")}
            />
            立即發布
          </label>
          <label className={mode === "scheduled" ? "radio-card radio-card-active" : "radio-card"}>
            <input
              checked={mode === "scheduled"}
              name="publish-mode"
              type="radio"
              onChange={() => {
                setIsBestTimeLoading(true);
                setMode("scheduled");
              }}
            />
            排程發布
          </label>
        </div>

        <AnimatePresence initial={false}>
          {mode === "scheduled" ? (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="mt-5 grid gap-4 border-t border-[var(--bg-border)] pt-5">
                <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3">
                  <p className="text-body flex-1">
                    {isBestTimeLoading
                      ? "正在取得建議時間"
                      : bestTime
                        ? `建議：${bestTime.local_date} ${bestTime.local_time}（${bestTime.reason}）`
                        : "目前沒有可用建議"}
                  </p>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!bestTime}
                    type="button"
                    onClick={applyBestTime}
                  >
                    套用
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-label">Date</span>
                    <input
                      className="input-surface w-full px-4 py-3 outline-none"
                      type="date"
                      value={date}
                      onChange={(event) => updateSchedule(event.target.value, time)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-label">Time</span>
                    <input
                      className="input-surface w-full px-4 py-3 outline-none"
                      type="time"
                      value={time}
                      onChange={(event) => updateSchedule(date, event.target.value)}
                    />
                  </label>
                </div>
                {scheduleError ? (
                  <p className="text-sm text-[var(--error)]">{scheduleError}</p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!identityId}
                key={platform.id}
                type="button"
                onClick={() => {
                  if (identityId) connectSocialAccount(platform.id, identityId).catch(() => null);
                }}
              >
                {platform.account_connected
                  ? `${platform.display_name} ${platform.account_username}`
                  : `連結 ${platform.display_name}`}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            type="button"
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                發布中
              </>
            ) : (
              "發布 ->"
            )}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--success)] bg-[var(--success-muted)] px-3 py-2 text-sm text-[var(--success)]">
            {notice}
          </p>
        ) : null}

        {results ? (
          <div className="mt-4 grid gap-2">
            {results.map((result) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--bg-border)] px-3 py-2"
                key={result.platform}
              >
                <span className="text-h3 capitalize">{result.platform}</span>
                {result.success ? (
                  <a
                    className="text-sm text-[var(--success)] hover:underline"
                    href={result.url ?? "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    成功 查看貼文
                  </a>
                ) : (
                  <span className="text-sm text-[var(--error)]">
                    失敗 {result.error ?? "未知錯誤"}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatLocalDateTime(value: Date) {
  return value.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function readStoredDraft(): PublishDraft {
  if (typeof window === "undefined") {
    return {
      text: DEFAULT_TEXT,
      identity_id: null,
      platforms: ["instagram", "threads"],
      media: null,
    };
  }

  const stored = window.sessionStorage.getItem("craftpost.publishDraft");
  if (!stored) {
    return {
      text: DEFAULT_TEXT,
      identity_id: null,
      platforms: ["instagram", "threads"],
      media: null,
    };
  }

  try {
    const parsed = JSON.parse(stored) as PublishDraft;
    return {
      text: parsed.text?.trim() || DEFAULT_TEXT,
      identity_id: parsed.identity_id ?? null,
      platforms: parsed.platforms?.length
        ? parsed.platforms
        : ["instagram", "threads"],
      media: parsed.media,
    };
  } catch {
    return {
      text: DEFAULT_TEXT,
      identity_id: null,
      platforms: ["instagram", "threads"],
      media: null,
    };
  }
}
