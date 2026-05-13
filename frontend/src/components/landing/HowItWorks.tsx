const steps = [
  {
    number: "01",
    title: "Draft",
    body: "Write or paste your content.",
  },
  {
    number: "02",
    title: "Refine",
    body: "AI refines your copy instantly.",
  },
  {
    number: "03",
    title: "Publish",
    body: "One click to all platforms.",
  },
];

export default function HowItWorks() {
  return (
    <section className="site-container pb-20">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="text-label mb-2">How it works</p>
          <h2 className="text-h2">From rough draft to ready post.</h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <article className="surface p-7" key={step.number}>
            <p className="text-mono mb-5 text-[var(--accent)]">
              {step.number}
            </p>
            <h3 className="text-h3 mb-3">{step.title}</h3>
            <p className="text-body">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
