"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createIdentity,
  deleteIdentity,
  disconnectSocialAccount,
  getIdentities,
  Identity,
  IdentityLimits,
  SocialAccount,
  updateIdentity,
  connectSocialAccount,
} from "@/lib/api";

const COLORS = ["#6366f1", "#10b981", "#ff5c3a", "#f59e0b", "#ef4444", "#06b6d4", "#c084fc", "#f0ede8"];
const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "threads", label: "Threads" },
] as const;

type FormState = {
  name: string;
  description: string;
  avatar_color: string;
  is_default: boolean;
};

export default function IdentitiesSettings() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Identity[]>([]);
  const [limits, setLimits] = useState<IdentityLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice] = useState<string | null>(() => {
    const connected = searchParams.get("connected");
    return connected ? `${connected} 已連結` : null;
  });
  const [editing, setEditing] = useState<Identity | "new" | null>(null);
  const [connecting, setConnecting] = useState<Identity | null>(null);
  const [deleting, setDeleting] = useState<Identity | null>(null);

  const reachedLimit = Boolean(limits && items.length >= limits.max_identities);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await getIdentities();
      setItems(response.items);
      setLimits(response.limits);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "無法載入身份");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(identity: Identity) {
    await saveIdentity(identity, { is_default: true });
  }

  async function saveIdentity(identity: Identity | "new", form: Partial<FormState>) {
    setError(null);
    try {
      if (identity === "new") {
        await createIdentity({
          name: form.name ?? "",
          description: form.description ?? "",
          avatar_color: form.avatar_color ?? COLORS[0],
          is_default: form.is_default,
        });
      } else {
        await updateIdentity(identity.id, form);
      }
      setEditing(null);
      await refresh();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.upgradeUrl) {
        setError(`${requestError.message}，請升級方案`);
      } else {
        setError(requestError instanceof Error ? requestError.message : "儲存失敗");
      }
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await deleteIdentity(deleting.id);
      setDeleting(null);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "刪除失敗");
    }
  }

  async function handleDisconnect(account: SocialAccount) {
    setError(null);
    try {
      await disconnectSocialAccount(account.id);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "斷開失敗");
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label mb-2">Settings</p>
          <h1 className="text-h2">身份管理</h1>
        </div>
        <button
          className="btn btn-primary"
          disabled={loading || reachedLimit}
          type="button"
          onClick={() => setEditing("new")}
        >
          新增身份
        </button>
      </header>

      {limits ? (
        <p className="text-body">
          {limits.plan.toUpperCase()} 方案：{items.length}/{limits.max_identities} 個身份，每個身份最多{" "}
          {limits.max_accounts_per_identity} 個社群帳號
        </p>
      ) : null}
      {reachedLimit ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-muted)] px-3 py-2 text-sm text-[var(--warning)]">
          目前方案已達身份數上限
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--success)] bg-[var(--success-muted)] px-3 py-2 text-sm text-[var(--success)]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-body">載入中...</p> : null}

      {!loading && !items.length ? (
        <section className="surface p-6">
          <h2 className="text-h3 mb-2">
            {limits?.plan === "free" ? "發布功能需要付費方案" : "建立第一個身份"}
          </h2>
          <p className="text-body mb-4">
            身份會保存品牌名稱、描述，以及底下連結的 Instagram / Threads 帳號。
          </p>
          {limits?.plan === "free" ? (
            <Link className="btn btn-primary" href="/pricing">
              前往 pricing
            </Link>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => setEditing("new")}>
              建立身份
            </button>
          )}
        </section>
      ) : null}

      <div className="grid gap-4">
        {items.map((identity) => (
          <IdentityCard
            key={identity.id}
            identity={identity}
            onConnect={() => setConnecting(identity)}
            onDelete={() => setDeleting(identity)}
            onDisconnect={handleDisconnect}
            onEdit={() => setEditing(identity)}
            onSetDefault={() => handleSetDefault(identity)}
          />
        ))}
      </div>

      {editing ? (
        <IdentityFormModal
          identity={editing}
          limitReached={editing === "new" && reachedLimit}
          onClose={() => setEditing(null)}
          onSave={saveIdentity}
        />
      ) : null}
      {connecting ? (
        <ConnectModal
          identity={connecting}
          onClose={() => setConnecting(null)}
          onDisconnect={handleDisconnect}
        />
      ) : null}
      {deleting ? (
        <ConfirmDeleteModal
          identity={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function IdentityCard({
  identity,
  onConnect,
  onDelete,
  onDisconnect,
  onEdit,
  onSetDefault,
}: {
  identity: Identity;
  onConnect: () => void;
  onDelete: () => void;
  onDisconnect: (account: SocialAccount) => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span
            className="mt-1 h-10 w-10 rounded-[var(--radius-sm)] border border-[var(--bg-border-2)]"
            style={{ background: identity.avatar_color }}
          />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-h3">{identity.name}</h2>
              {identity.is_default ? <span className="badge">Default</span> : null}
            </div>
            <p className="text-body">{identity.description || "未設定描述"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!identity.is_default ? (
            <button className="btn btn-secondary btn-sm" type="button" onClick={onSetDefault}>
              設為預設
            </button>
          ) : null}
          <button className="btn btn-secondary btn-sm" type="button" onClick={onConnect}>
            連結帳號
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onEdit}>
            編輯
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onDelete}>
            刪除
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {PLATFORMS.map((platform) => {
          const account = identity.social_accounts.find((item) => item.platform === platform.id);
          return (
            <div className="account-row" key={platform.id}>
              <span className="text-h3">{platform.label}</span>
              {account ? (
                <>
                  <span className="text-body">{account.username}</span>
                  <span className={account.status === "connected" ? "status-ok" : "status-warn"}>
                    {account.status === "connected" && !isExpired(account)
                      ? "已連結"
                      : "需要重新連結"}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => onDisconnect(account)}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <span className="text-body">未連結</span>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function IdentityFormModal({
  identity,
  limitReached,
  onClose,
  onSave,
}: {
  identity: Identity | "new";
  limitReached: boolean;
  onClose: () => void;
  onSave: (identity: Identity | "new", form: FormState) => void;
}) {
  const initial = identity === "new" ? null : identity;
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    avatar_color: initial?.avatar_color ?? COLORS[0],
    is_default: initial?.is_default ?? false,
  });
  const canSave = form.name.trim().length > 0 && !limitReached;

  return (
    <Modal onClose={onClose} title={identity === "new" ? "新增身份" : "編輯身份"}>
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-label">名稱</span>
          <input
            className="input-surface px-4 py-3 outline-none"
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-label">描述</span>
          <textarea
            className="input-surface min-h-24 resize-none px-4 py-3 outline-none"
            maxLength={300}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <div className="grid gap-2">
          <span className="text-label">顏色</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                aria-label={color}
                className={form.avatar_color === color ? "swatch swatch-active" : "swatch"}
                key={color}
                style={{ background: color }}
                type="button"
                onClick={() => setForm({ ...form, avatar_color: color })}
              />
            ))}
          </div>
        </div>
        <label className="radio-card w-fit">
          <input
            checked={form.is_default}
            type="checkbox"
            onChange={(event) => setForm({ ...form, is_default: event.target.checked })}
          />
          設為預設
        </label>
        {limitReached ? <p className="text-sm text-[var(--warning)]">目前方案已達身份數上限</p> : null}
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSave}
            type="button"
            onClick={() => onSave(identity, form)}
          >
            儲存
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConnectModal({
  identity,
  onClose,
  onDisconnect,
}: {
  identity: Identity;
  onClose: () => void;
  onDisconnect: (account: SocialAccount) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const accounts = useMemo(
    () => Object.fromEntries(identity.social_accounts.map((account) => [account.platform, account])),
    [identity.social_accounts],
  );

  async function connect(platform: string) {
    setError(null);
    try {
      await connectSocialAccount(platform, identity.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "無法建立連結");
    }
  }

  return (
    <Modal onClose={onClose} title="連結社群帳號">
      <div className="grid gap-3">
        {PLATFORMS.map((platform) => {
          const account = accounts[platform.id] as SocialAccount | undefined;
          return (
            <div className="account-row" key={platform.id}>
              <span className="text-h3">{platform.label}</span>
              <span className="text-body">
                {account ? `已連結 ${account.username}` : "未連結"}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => connect(platform.id)}
              >
                {account ? "重新連結" : "連結"}
              </button>
              {account ? (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => onDisconnect(account)}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          );
        })}
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  identity,
  onClose,
  onConfirm,
}: {
  identity: Identity;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onClose} title={`刪除「${identity.name}」？`}>
      <p className="text-body mb-5">
        這會移除此身份底下已連結的社群帳號，但不會刪除已發布的貼文。
      </p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" type="button" onClick={onConfirm}>
          刪除
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="modal-backdrop">
      <section className="surface modal-panel p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-h2">{title}</h2>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
            關閉
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function isExpired(account: SocialAccount) {
  if (!account.token_expires_at) return false;
  return new Date(account.token_expires_at).getTime() <= Date.now();
}
