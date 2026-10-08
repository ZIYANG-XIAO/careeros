"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/lib/i18n";

const TABS = [
  { href: "/me", key: "me.tab.overview" as const },
  { href: "/me/experience", key: "me.section.experience" as const },
  { href: "/me/projects", key: "me.section.projects" as const },
  { href: "/me/education", key: "me.section.education" as const },
  { href: "/me/skills", key: "me.section.skills" as const },
  { href: "/me/resumes", key: "nav.resumes" as const },
  { href: "/me/goals", key: "nav.goals" as const },
  { href: "/me/contact", key: "nav.contactAnswers" as const },
  { href: "/me/account", key: "nav.account" as const },
];

function MeTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("nav.me")}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
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
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
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
