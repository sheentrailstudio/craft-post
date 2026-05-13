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

export type SocialAccount = {
  id: string;
  platform: "instagram" | "threads";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "connected" | "expired" | "revoked";
  token_expires_at: string | null;
};

export type Identity = {
  id: string;
  name: string;
  description: string | null;
  avatar_color: string;
  is_default: boolean;
  social_accounts: SocialAccount[];
};

export type IdentityLimits = {
  plan: "free" | "basic" | "pro";
  max_identities: number;
  max_accounts_per_identity: number;
  can_publish?: boolean;
};

export type IdentitiesResponse = {
  items: Identity[];
  limits: IdentityLimits;
};

export type IdentityPayload = {
  name: string;
  description?: string | null;
  avatar_color: string;
  is_default?: boolean;
};

export type PublishPayload = {
  identity_id: string;
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

export class ApiError extends Error {
  code?: string;
  upgradeUrl?: string;
  status: number;

  constructor(message: string, status: number, code?: string, upgradeUrl?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.upgradeUrl = upgradeUrl;
  }
}

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

export async function getPlatforms(identityId?: string): Promise<Platform[]> {
  const query = identityId ? `?identity_id=${encodeURIComponent(identityId)}` : "";
  const response = await fetch(`${API_URL}/api/platforms${query}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

export async function getIdentities(): Promise<IdentitiesResponse> {
  const response = await fetch(`${API_URL}/api/identities`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) throw await readApiError(response);
  return response.json();
}

export async function createIdentity(payload: IdentityPayload): Promise<Identity> {
  const response = await fetch(`${API_URL}/api/identities`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await readApiError(response);
  return response.json();
}

export async function updateIdentity(
  id: string,
  payload: Partial<IdentityPayload>,
): Promise<Identity> {
  const response = await fetch(`${API_URL}/api/identities/${id}`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await readApiError(response);
  return response.json();
}

export async function deleteIdentity(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/identities/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!response.ok) throw await readApiError(response);
}

export async function disconnectSocialAccount(accountId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/social/accounts/${accountId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!response.ok) throw await readApiError(response);
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

export async function connectSocialAccount(platform: string, identityId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/social/connect/${platform}?identity_id=${encodeURIComponent(identityId)}`,
    {
      method: "GET",
      headers: await authHeaders(),
    },
  );

  if (!response.ok) throw await readApiError(response);
  const data = (await response.json()) as { url?: string };
  if (data.url) window.location.href = data.url;
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
  const error = await readApiError(response);
  return error.message;
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const error = await response.json();
    const code = error?.code ?? error?.detail?.code;
    const message = error?.message ?? error?.detail?.message ?? code ?? "請求失敗";
    const upgradeUrl = error?.upgrade_url ?? error?.detail?.upgrade_url;
    if (response.status === 401 || code === "INVALID_TOKEN") {
      redirectToLogin();
    }
    return new ApiError(message, response.status, code, upgradeUrl);
  } catch {
    return new ApiError("請求失敗", response.status);
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;

  const redirectTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login?next=${encodeURIComponent(redirectTo)}`;
}
