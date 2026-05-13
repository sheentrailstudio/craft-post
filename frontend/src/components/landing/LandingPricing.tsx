"use client";

const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["Unlimited AI refine", "No publishing"],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Basic",
    price: "$8/mo",
    features: ["Unlimited AI refine", "1 identity, 2 accounts", "Publish to all platforms"],
    cta: "Start with Basic",
    featured: true,
  },
  {
    name: "Pro",
    price: "$12/mo",
    features: ["Unlimited AI refine", "5 identities, 10 accounts", "Publish to all platforms"],
    cta: "Start with Pro",
    featured: false,
  },
];

type LandingPricingProps = {
  isAuthenticated: boolean;
  onRequireSignIn: () => void;
};

export default function LandingPricing({
  isAuthenticated,
  onRequireSignIn,
}: LandingPricingProps) {
  function handlePlanClick() {
    if (isAuthenticated) {
      window.location.href = "/app/drafts/new";
      return;
    }

    onRequireSignIn();
  }

  return (
    <section id="pricing" className="site-container pb-20">
      <div className="mb-6">
        <p className="text-label mb-2">Pricing</p>
        <h2 className="text-h2">Free to refine. Upgrade when publishing matters.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            className={[
              "surface flex min-h-80 flex-col p-7",
              plan.featured ? "border-[var(--accent-border)]" : "",
            ].join(" ")}
            key={plan.name}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-h3 mb-3">{plan.name}</h3>
                <p className="text-display text-4xl">{plan.price}</p>
              </div>
              {plan.featured ? (
                <span className="rounded-[var(--radius-sm)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
                  Most Popular
                </span>
              ) : null}
            </div>
            <ul className="mb-7 space-y-3">
              {plan.features.map((feature) => (
                <li className="text-body" key={feature}>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={plan.featured ? "btn btn-primary mt-auto" : "btn btn-secondary mt-auto"}
              type="button"
              onClick={handlePlanClick}
            >
              {plan.cta}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
