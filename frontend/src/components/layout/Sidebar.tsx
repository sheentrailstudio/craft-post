"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/app/drafts", label: "Drafts", section: "drafts" },
  { href: "/app/drafts/new", label: "+ New draft", exact: true },
  { href: "/app/identities", label: "身份管理" },
  { href: "/app/account", label: "帳戶管理" },
  { href: "/pricing", label: "Pricing", exact: true },
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
              isActiveNavItem(pathname, item)
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

function isActiveNavItem(
  pathname: string,
  item: { href: string; exact?: boolean; section?: string },
) {
  if (item.section === "drafts") {
    return pathname === "/app/drafts" || (
      pathname.startsWith("/app/drafts/") && pathname !== "/app/drafts/new"
    );
  }

  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}
