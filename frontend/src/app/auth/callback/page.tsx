"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ensureBackendProfile } from "@/lib/api";
import { DEFAULT_AUTH_REDIRECT, getSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell />}>
      <AuthCallbackFlow />
    </Suspense>
  );
}

function AuthCallbackFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => {
    const value =
      searchParams.get("next") ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem("craftpost_auth_next")
        : null);
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return DEFAULT_AUTH_REDIRECT;
    }
    return value;
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const hashParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.hash.replace(/^#/, ""))
          : null;
      const hashError = hashParams?.get("error_description") ?? hashParams?.get("error");
      if (hashError) {
        setError(hashError);
        return;
      }

      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Google sign in did not return a session.");
        return;
      }

      try {
        await ensureBackendProfile();
        window.localStorage.removeItem("craftpost_auth_next");
        if (active) router.replace(next);
      } catch (profileError) {
        if (!active) return;
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Profile setup failed.",
        );
      }
    }

    finishSignIn();

    return () => {
      active = false;
    };
  }, [next, router, searchParams]);

  return (
    <CallbackShell message={error ?? "Finishing Google sign in..."} />
  );
}

function CallbackShell({ message = "Finishing Google sign in..." }: { message?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
      <section className="surface w-full max-w-md p-8 text-center">
        <p className="text-mono mb-4">
          <span>Craft</span>
          <span className="text-[var(--accent)]">post</span>
        </p>
        <h1 className="text-h2 mb-3">Signing in</h1>
        <p className="text-body">{message}</p>
      </section>
    </main>
  );
}
