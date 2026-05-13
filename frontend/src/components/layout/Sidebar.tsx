"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/app/drafts/new", label: "+ New draft" },
  { href: "/app/settings", label: "Settings" },
  { href: "/pricing", label: "Pricing" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link href="/" className="text-mono text-base">
        <span>Craft</span>
        <span className="text-[var(--accent)]">post</span>
      </Link>

      <nav className="mt-10 grid gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "app-nav-link",
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "app-nav-link-active"
                : "",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
