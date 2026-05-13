"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";

type AppAuthGateProps = {
  children: React.ReactNode;
};

export default function AppAuthGate({ children }: AppAuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, loading, session } = useAuthSession();

  useEffect(() => {
    if (!configured || loading || session) return;

    const redirectTo = pathname || "/app/drafts/new";
    router.replace(`/login?next=${encodeURIComponent(redirectTo)}`);
  }, [configured, loading, pathname, router, session]);

  if (!configured) {
    return (
      <main className="app-main flex min-h-screen items-center justify-center px-6">
        <section className="surface max-w-md p-6 text-center">
          <h1 className="text-h2 mb-3">Supabase is not configured</h1>
          <p className="text-body">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
            enable Google sign-in.
          </p>
        </section>
      </main>
    );
  }

  if (loading || !session) {
    return (
      <main className="app-main flex min-h-screen items-center justify-center px-6">
        <p className="text-body">Checking session...</p>
      </main>
    );
  }

  return children;
}
