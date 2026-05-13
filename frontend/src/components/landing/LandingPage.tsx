"use client";

import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";
import LandingNav from "./LandingNav";
import ImageUploadBlock from "./ImageUploadBlock";
import TextRefineBlock, { TextRefineBlockHandle } from "./TextRefineBlock";
import SignInModal from "./SignInModal";
import HowItWorks from "./HowItWorks";
import LandingPricing from "./LandingPricing";

export default function LandingPage() {
  const textBlockRef = useRef<TextRefineBlockHandle>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuthStorage,
    getAuthSnapshot,
    () => false,
  );
  const [landingDraft, setLandingDraft] = useState({
    draft: "",
    refined: "",
    user_subprompt: "",
  });

  function handleUseCaption(caption: string) {
    textBlockRef.current?.setDraft(caption);
    textBlockRef.current?.scrollIntoView();
  }

  function openPublishModal() {
    window.localStorage.setItem(
      "craftpost_landing",
      JSON.stringify(landingDraft),
    );

    if (isAuthenticated) {
      window.location.href = "/app/drafts/new";
      return;
    }

    setSignInOpen(true);
  }

  return (
    <div className="landing-shell min-h-screen">
      <BackgroundDecor />
      <div className="landing-content">
        <div className="fade-up fade-up-delay-one">
          <LandingNav isAuthenticated={isAuthenticated} />
        </div>
        <main>
        <section className="site-container fade-up fade-up-delay-two flex flex-col items-center pb-16 pt-20 text-center md:pb-20 md:pt-28">
          <Image
            src="/icon.png"
            alt="Craftpost"
            width={64}
            height={64}
            className="mb-8 h-16 w-16 rounded-[var(--radius-lg)]"
            priority
          />
          <h1 className="text-display max-w-4xl">
            Your AI writing
            <br />
            co-pilot for social.
          </h1>
          <p className="text-body mt-6 max-w-xl text-base">
            Draft smarter. Refine with AI. Publish everywhere.
          </p>
        </section>

        <section className="site-container fade-up fade-up-delay-three pb-24">
          <div className="demo-container space-y-6">
            <ImageUploadBlock onUseCaption={handleUseCaption} />
            <TextRefineBlock
              ref={textBlockRef}
              isAuthenticated={isAuthenticated}
              onDraftChange={setLandingDraft}
              onPublish={openPublishModal}
            />
          </div>
        </section>

        <HowItWorks />
        <LandingPricing
          isAuthenticated={isAuthenticated}
          onRequireSignIn={() => setSignInOpen(true)}
        />
        </main>

        <footer className="site-container border-t border-[var(--bg-border)] py-10">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-mono mb-2">
              <span>Craft</span>
              <span className="text-[var(--accent)]">post</span>
            </p>
            <p className="text-body">AI writing co-pilot for social media.</p>
          </div>
          <div className="text-sm flex flex-wrap gap-4">
            <a href="/terms">Terms of Service</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/refund-policy">Refund Policy</a>
          </div>
        </div>
        <p className="text-sm mt-8">© 2026 Craftpost</p>
        </footer>
      </div>

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        landingDraft={landingDraft}
      />
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div className="landing-decor" aria-hidden="true">
      <span className="decor-glow decor-glow-one" />
      <span className="decor-glow decor-glow-two" />
      <span className="decor-glow decor-glow-three" />
      <span className="decor-grid decor-grid-one" />
      <span className="decor-grid decor-grid-two" />
      <span className="decor-lines">
        <span className="decor-line decor-line-one" />
        <span className="decor-line decor-line-two" />
        <span className="decor-line decor-line-three" />
      </span>
      <span className="decor-square decor-square-one" />
      <span className="decor-square decor-square-two" />
      <span className="decor-square decor-square-three" />
      <span className="decor-cross" />
      <span className="floating-label floating-label-one">
        ✦ Caption ready
      </span>
      <span className="floating-label floating-label-two">
        <span className="platform-dot platform-dot-active" />
        Threads selected
      </span>
    </div>
  );
}

function subscribeToAuthStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getAuthSnapshot() {
  return window.localStorage.getItem("craftpost_user") === "1";
}
