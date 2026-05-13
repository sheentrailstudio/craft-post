import { getSupabaseBrowserClient } from "@/lib/supabase";

export type RefinePayload = {
  draft: string;
  user_subprompt?: string;
  media_urls?: string[];
  image_base64?: string;
  image_mime_type?: string;
};

export type RefineResponse = {
  post_id: string;
  refined: string;
};

export type Platform = {
  id: string;
  display_name: string;
  max_chars: number;
  media_limits: {
    max_images: number;
    max_videos: number;
  };
  account_connected: boolean;
  account_username: string | null;
  token_expired: boolean;
};

export type PublishPayload = {
  platforms: string[];
  platform_texts: Record<string, string>;
  media_urls?: string[];
  scheduled_at?: string | null;
};

export type PublishResult = {
  platform: string;
  success: boolean;
  url: string | null;
  error: string | null;
};

export type PublishResponse =
  | {
      mode: "immediate";
      results: PublishResult[];
    }
  | {
      mode: "scheduled";
      scheduled_at: string;
    };

export type BestTimeSuggestion = {
  platform: string;
  time: string;
  reason: string;
  scheduled_at: string;
  local_date: string;
  local_time: string;
};

export type BestTimeResponse = {
  timezone: "Asia/Taipei";
  suggestions: BestTimeSuggestion[];
  recommended: BestTimeSuggestion;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function postRefine(payload: RefinePayload): Promise<RefineResponse> {
  const response = await fetch(`${API_URL}/api/draft/refine`, {
    method: "POST",
    headers: await authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

export async function refine(body: RefinePayload): Promise<RefineResponse> {
  return postRefine({
    draft: body.draft,
    user_subprompt: body.user_subprompt?.slice(0, 300),
    media_urls: body.media_urls ?? [],
  });
}

export async function refineDraft(
  draft: string,
  userSubprompt: string,
): Promise<string> {
  const data = await refine({
    draft,
    user_subprompt: userSubprompt,
  });

  return data.refined ?? "";
}

export async function generateCaption(
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const data = await postRefine({
    draft: "Generate a compelling social media caption for this image.",
    user_subprompt:
      "Generate a compelling social media caption for this image. Be concise and engaging.",
    image_base64: imageBase64,
    image_mime_type: imageMimeType,
  });

  return data.refined ?? "";
}

export async function getPlatforms(): Promise<Platform[]> {
  const response = await fetch(`${API_URL}/api/platforms`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

export async function publishPost(
  payload: PublishPayload,
): Promise<PublishResponse> {
  const response = await fetch(`${API_URL}/api/publish`, {
    method: "POST",
    headers: await authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

export async function getBestTime(
  platforms: string[],
): Promise<BestTimeResponse> {
  const query = encodeURIComponent(platforms.join(","));
  const response = await fetch(`${API_URL}/api/publish/best-time?platforms=${query}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

export function connectSocialAccount(platform: string): void {
  window.location.href = `${API_URL}/api/social/connect/${platform}`;
}

export async function ensureBackendProfile(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/profile`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }
}

async function authHeaders(headers: HeadersInit = {}): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

  if (!session?.access_token) {
    redirectToLogin();
    throw new Error("請先登入");
  }

  return {
    ...headers,
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function readErrorMessage(response: Response) {
  try {
    const error = await response.json();
    if (error?.code === "INVALID_TOKEN" || error?.detail?.code === "INVALID_TOKEN") {
      redirectToLogin();
    }
    if (typeof error?.message === "string") return error.message;
    if (typeof error?.code === "string") return error.code;
    if (typeof error?.detail?.message === "string") return error.detail.message;
    if (typeof error?.detail?.code === "string") return error.detail.code;
  } catch {
    return "請求失敗";
  }

  return "請求失敗";
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;

  const redirectTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
