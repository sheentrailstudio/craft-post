"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdentities, getPlatforms, Identity, Platform, refine } from "@/lib/api";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export type MediaItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

export type MediaAttachment = {
  items: MediaItem[];
  aspectRatio: AspectRatio;
};

export interface EditorState {
  draft: string;
  refined: string | null;
  user_subprompt: string;
  platforms: string[];
  media: MediaAttachment | null;
  identity_id: string | null;
  is_refining: boolean;
  error: string | null;
}

const DEFAULT_PLATFORMS: Platform[] = [
  {
    id: "instagram",
    display_name: "Instagram",
    max_chars: 2200,
    media_limits: { max_images: 10, max_videos: 1 },
    account_connected: true,
    account_username: "@demo",
    token_expired: false,
  },
  {
    id: "threads",
    display_name: "Threads",
    max_chars: 500,
    media_limits: { max_images: 10, max_videos: 1 },
    account_connected: true,
    account_username: "@demo",
    token_expired: false,
  },
];

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

export function useEditorState() {
  const [state, setState] = useState<EditorState>({
    draft: "",
    refined: null,
    user_subprompt: "",
    platforms: ["instagram", "threads"],
    media: null,
    identity_id: null,
    is_refining: false,
    error: null,
  });
  const [availablePlatforms, setAvailablePlatforms] =
    useState<Platform[]>(DEFAULT_PLATFORMS);
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    let active = true;

    getIdentities()
      .then(async (response) => {
        if (!active) return;
        setIdentities(response.items);
        const selectedIdentity =
          response.items.find((identity) => identity.is_default) ?? response.items[0] ?? null;
        setState((current) => ({ ...current, identity_id: selectedIdentity?.id ?? null }));
        const platforms = await getPlatforms(selectedIdentity?.id);
        if (active) {
          setAvailablePlatforms(platforms);
          setState((current) => ({
            ...current,
            platforms: current.platforms.filter((id) =>
              platforms.some((platform) => platform.id === id && platform.account_connected),
            ),
          }));
        }
      })
      .catch(() => {
        if (active) setAvailablePlatforms(DEFAULT_PLATFORMS);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      state.media?.items.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [state.media]);

  const selectedPlatforms = useMemo(
    () =>
      availablePlatforms.filter((platform) =>
        state.platforms.includes(platform.id),
      ),
    [availablePlatforms, state.platforms],
  );

  const strictMaxChars = useMemo(() => {
    if (!selectedPlatforms.length) return null;
    return Math.min(...selectedPlatforms.map((platform) => platform.max_chars));
  }, [selectedPlatforms]);

  const setDraft = useCallback((draft: string) => {
    setState((current) => ({ ...current, draft, error: null }));
  }, []);

  const setPrompt = useCallback((user_subprompt: string) => {
    setState((current) => ({
      ...current,
      user_subprompt: user_subprompt.slice(0, 300),
      error: null,
    }));
  }, []);

  const setAspectRatio = useCallback((aspectRatio: AspectRatio) => {
    setState((current) => {
      if (!current.media) return current;
      return {
        ...current,
        media: {
          ...current.media,
          aspectRatio,
        },
      };
    });
  }, []);

  const clearMedia = useCallback(() => {
    setState((current) => {
      current.media?.items.forEach((item) => URL.revokeObjectURL(item.url));
      return { ...current, media: null, error: null };
    });
  }, []);

  const addMediaFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;

    setState((current) => {
      const currentItems = current.media?.items ?? [];
      const currentKind = currentItems[0]?.kind;
      const nextKind = getFileKind(nextFiles[0]);

      if (!nextKind) {
        return { ...current, error: "請上傳 JPG、PNG、WebP、MP4 或 MOV 檔案" };
      }

      if (currentKind && currentKind !== nextKind) {
        return { ...current, error: "圖片與影片不可同時附加" };
      }

      if (nextFiles.some((file) => getFileKind(file) !== nextKind)) {
        return { ...current, error: "圖片與影片不可同時附加" };
      }

      if (nextKind === "video") {
        if (currentItems.length || nextFiles.length > 1) {
          return { ...current, error: "影片最多上傳 1 支" };
        }
        if (nextFiles[0].size > 100 * 1024 * 1024) {
          return { ...current, error: "影片最大 100MB" };
        }
      }

      if (nextKind === "image") {
        if (currentItems.length + nextFiles.length > 10) {
          return { ...current, error: "最多上傳 10 張圖片" };
        }
        if (nextFiles.some((file) => file.size > 10 * 1024 * 1024)) {
          return { ...current, error: "單張圖片最大 10MB" };
        }
      }

      const nextItems = nextFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
        kind: nextKind,
      }));

      return {
        ...current,
        media: {
          items: [...currentItems, ...nextItems],
          aspectRatio: current.media?.aspectRatio ?? "1:1",
        },
        error: null,
      };
    });
  }, []);

  const togglePlatform = useCallback((platformId: string) => {
    setState((current) => {
      const selected = current.platforms.includes(platformId)
        ? current.platforms.filter((id) => id !== platformId)
        : [...current.platforms, platformId];

      return { ...current, platforms: selected, error: null };
    });
  }, []);

  const setIdentity = useCallback(async (identityId: string) => {
    setState((current) => ({ ...current, identity_id: identityId, error: null }));
    try {
      const platforms = await getPlatforms(identityId);
      setAvailablePlatforms(platforms);
      setState((current) => ({
        ...current,
        platforms: current.platforms.filter((id) =>
          platforms.some((platform) => platform.id === id && platform.account_connected),
        ),
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "無法載入身份平台",
      }));
    }
  }, []);

  const refineDraft = useCallback(async () => {
    const draft = state.draft.trim();
    if (!draft || !state.platforms.length || state.is_refining) return;

    setState((current) => ({
      ...current,
      is_refining: true,
      error: null,
    }));

    try {
      const response = await refine({
        draft,
        user_subprompt: state.user_subprompt || undefined,
        media_urls: [],
      });
      setState((current) => ({
        ...current,
        draft: response.refined,
        refined: response.refined,
        is_refining: false,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        is_refining: false,
        error: error instanceof Error ? error.message : "修稿失敗",
      }));
    }
  }, [state.draft, state.is_refining, state.platforms.length, state.user_subprompt]);

  return {
    state,
    identities,
    availablePlatforms,
    selectedPlatforms,
    strictMaxChars,
    actions: {
      addMediaFiles,
      clearMedia,
      refineDraft,
      setAspectRatio,
      setDraft,
      setPrompt,
      togglePlatform,
      setIdentity,
    },
  };
}

function getFileKind(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (VIDEO_TYPES.has(file.type)) return "video";
  return null;
}
