"use client";

import Link from "next/link";
import { useAuthSession } from "@/hooks/useAuthSession";

const plans = [
  {
    name: "Free",
    price: "$0",
    caption: "適合先把草稿與 AI 修稿流程跑順。",
    features: ["Unlimited AI refine", "No publishing", "No identities"],
    cta: "開始修稿",
    href: "/app/drafts/new",
    featured: false,
  },
  {
    name: "Basic",
    price: "$8/mo",
    caption: "單一品牌或個人帳號的發布工作流。",
    features: ["Unlimited AI refine", "1 identity", "2 accounts per identity", "Publish enabled"],
    cta: "設定 Basic 身份",
    href: "/app/identities",
    featured: true,
  },
  {
    name: "Pro",
    price: "$12/mo",
    caption: "多品牌、多身份與更多社群帳號管理。",
    features: ["Unlimited AI refine", "5 identities", "10 accounts per identity", "Publish enabled"],
    cta: "設定 Pro 身份",
    href: "/app/identities",
    featured: false,
  },
];

export default function PricingPage() {
  const { session } = useAuthSession();

  function targetHref(href: string) {
    if (session) return href;
    return `/login?next=${encodeURIComponent(href)}`;
  }

  return (
    <main className="landing-shell min-h-screen">
      <div className="landing-content">
        <nav className="site-container flex items-center justify-between py-6">
          <Link href="/" className="text-mono">
            <span>Craft</span>
            <span className="text-[var(--accent)]">post</span>
          </Link>
          <Link className="btn btn-secondary btn-sm" href={session ? "/app/drafts/new" : "/login"}>
            {session ? "回到 App" : "登入"}
          </Link>
        </nav>

        <section className="site-container grid gap-10 pb-20 pt-14">
          <div className="max-w-2xl">
            <p className="text-label mb-3">Pricing</p>
            <h1 className="text-h1 mb-4">免費修稿，需要發布時再升級。</h1>
            <p className="text-body text-base">
              Free 保留無限 AI 修稿。Basic 與 Pro 解鎖身份管理、帳號連結與發布流程。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                className={[
                  "surface flex min-h-[360px] flex-col p-6",
                  plan.featured ? "border-[var(--accent-border)] bg-[var(--accent-muted)]" : "",
                ].join(" ")}
                key={plan.name}
              >
                <div className="mb-7">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="text-h2">{plan.name}</h2>
                    {plan.featured ? <span className="badge">Popular</span> : null}
                  </div>
                  <p className="text-display text-5xl">{plan.price}</p>
                  <p className="text-body mt-4">{plan.caption}</p>
                </div>

                <ul className="mb-8 grid gap-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-3 text-sm text-[var(--text-secondary)]" key={feature}>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  className={plan.featured ? "btn btn-primary mt-auto" : "btn btn-secondary mt-auto"}
                  href={targetHref(plan.href)}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>

          <section className="surface grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-h3 mb-2">付款串接尚未啟用</h2>
              <p className="text-body">
                目前頁面先承接方案資訊與升級入口；實際 Paddle 訂閱會在計費 slice 接上。
              </p>
            </div>
            <Link className="btn btn-secondary" href="/app/identities">
              管理身份與帳號
            </Link>
          </section>
        </section>
      </div>
    </main>
  );
}
