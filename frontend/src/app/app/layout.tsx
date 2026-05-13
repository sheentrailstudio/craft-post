import Sidebar from "@/components/layout/Sidebar";
import AppAuthGate from "@/components/auth/AppAuthGate";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppAuthGate>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>
    </AppAuthGate>
  );
}
