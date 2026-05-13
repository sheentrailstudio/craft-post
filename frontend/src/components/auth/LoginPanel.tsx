"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AUTH_REDIRECT,
  getSupabaseBrowserClient,
} from "@/lib/supabase";
import { ensureBackendProfile } from "@/lib/api";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function LoginPanel() {
  const searchParams = useSearchParams();
  const { configured, loading, session } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const redirectTo = useMemo(() => {
    const value = searchParams.get("redirectTo");
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return DEFAULT_AUTH_REDIRECT;
    }
    return value;
  }, [searchParams]);

  useEffect(() => {
    if (!session) return;

    async function finishSignIn() {
      try {
        await ensureBackendProfile();
        window.location.replace(redirectTo);
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Profile setup failed.",
        );
      }
    }

    finishSignIn();
  }, [redirectTo, session]);

  async function handleGoogleSignIn() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setSigningIn(true);
    setError(null);

    const callbackUrl = new URL("/login", window.location.origin);
    callbackUrl.searchParams.set("redirectTo", redirectTo);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (signInError) {
      setSigningIn(false);
      setError(signInError.message);
    }
  }

  return (
    <section className="surface w-full max-w-md p-8 text-center">
      <p className="text-mono mb-4">
        <span>Craft</span>
        <span className="text-[var(--accent)]">post</span>
      </p>
      <h1 className="text-h2 mb-3">Sign in</h1>
      <p className="text-body mb-6">
        Continue with Google to save drafts and publish posts.
      </p>

      <button
        className="btn btn-secondary w-full"
        type="button"
        disabled={!configured || loading || signingIn}
        onClick={handleGoogleSignIn}
      >
        <span className="text-mono">G</span>
        {signingIn ? "Redirecting..." : "Continue with Google"}
      </button>

      {!configured ? (
        <p className="text-sm mt-4">
          Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      ) : null}
      {error ? <p className="text-sm mt-4 text-[var(--error)]">{error}</p> : null}
    </section>
  );
}
