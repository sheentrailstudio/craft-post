"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getIdentities, IdentityLimits } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AccountSettings() {
  const { session } = useAuthSession();
  const [limits, setLimits] = useState<IdentityLimits | null>(null);
  const [identityCount, setIdentityCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    getIdentities()
      .then((response) => {
        if (!active) return;
        setLimits(response.limits);
        setIdentityCount(response.items.length);
        setAccountCount(
          response.items.reduce((total, identity) => total + identity.social_accounts.length, 0),
        );
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "無法載入帳戶資訊");
      });

    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label mb-2">Account</p>
          <h1 className="text-h1 mb-3">帳戶管理</h1>
          <p className="text-body max-w-2xl">
            查看目前登入帳號、方案限制與身份使用量。
          </p>
        </div>
        <Link className="btn btn-secondary" href="/app/identities">
          管理身份
        </Link>
      </header>

      {error ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}

      <section className="surface p-5">
        <p className="text-label mb-4">Profile</p>
        <div className="grid gap-3">
          <InfoRow label="Email" value={session?.user.email ?? "未提供"} />
          <InfoRow label="User ID" value={session?.user.id ?? "載入中"} mono />
          <InfoRow label="Plan" value={limits ? limits.plan.toUpperCase() : "載入中"} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <UsageCard label="身份" value={identityCount} limit={limits?.max_identities} />
        <UsageCard label="社群帳號" value={accountCount} limit={limits?.max_accounts_per_identity} suffix="/身份" />
        <UsageCard label="發布" value={limits?.can_publish ? "Enabled" : "Locked"} />
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-h3 mb-2">登入工作階段</h2>
        </div>
        <button className="btn btn-secondary" disabled={signingOut} type="button" onClick={signOut}>
          {signingOut ? "登出中" : "登出"}
        </button>
      </section>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-[var(--bg-border)] pb-3 last:border-b-0 last:pb-0">
      <span className="text-label">{label}</span>
      <span className={mono ? "text-mono break-all text-[var(--text-primary)]" : "text-body text-[var(--text-primary)]"}>
        {value}
      </span>
    </div>
  );
}

function UsageCard({
  label,
  value,
  limit,
  suffix = "",
}: {
  label: string;
  value: number | string;
  limit?: number;
  suffix?: string;
}) {
  return (
    <article className="surface p-5">
      <p className="text-label mb-3">{label}</p>
      <p className="text-h2">
        {value}
        {typeof value === "number" && typeof limit === "number" ? (
          <span className="text-body"> / {limit}{suffix}</span>
        ) : null}
      </p>
    </article>
  );
}
