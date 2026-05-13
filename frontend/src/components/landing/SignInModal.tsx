"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LandingDraftState } from "./TextRefineBlock";

type SignInModalProps = {
  open: boolean;
  onClose: () => void;
  landingDraft: LandingDraftState;
};

export default function SignInModal({
  open,
  onClose,
  landingDraft,
}: SignInModalProps) {
  function handleGoogleSignIn() {
    window.localStorage.setItem(
      "craftpost_landing",
      JSON.stringify(landingDraft),
    );
    window.location.href = "/login?redirectTo=/app/drafts/new";
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="surface w-full max-w-md p-6"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="text-mono font-medium">
                <span>Craft</span>
                <span className="text-[var(--accent)]">post</span>
              </p>
              <button
                className="btn btn-ghost px-3"
                type="button"
                aria-label="Close sign in modal"
                onClick={onClose}
              >
                ×
              </button>
            </div>

            <h2 className="text-h2 mb-2">Sign in to publish your post</h2>
            <p className="text-body mb-6">Your draft will be saved.</p>

            <button
              className="btn btn-secondary w-full"
              type="button"
              onClick={handleGoogleSignIn}
            >
              <span className="text-mono">G</span>
              Continue with Google
            </button>

            <p className="text-sm mt-5">Free to start · Cancel anytime</p>
            <div className="text-sm mt-3 flex gap-4">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
