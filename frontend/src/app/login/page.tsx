import { Suspense } from "react";
import LoginPanel from "@/components/auth/LoginPanel";

export default function LoginPage() {
  return (
    <main className="landing-shell flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={<p className="text-body">Loading sign in...</p>}>
        <LoginPanel />
      </Suspense>
    </main>
  );
}
