"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/lib/i18n";

const TABS = [
  { href: "/me", key: "nav.careerBrain" as const },
  { href: "/me/resumes", key: "nav.resumes" as const },
  { href: "/me/contact", key: "nav.contactAnswers" as const },
];

function MeTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t("nav.me")} className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active =
          tab.href === "/me"
            ? pathname === "/me"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              active
                ? "border-accent text-accent"
                : "border-transparent text-ink-3 hover:text-ink-2"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export { MeTabs };
