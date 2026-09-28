"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { listApplications, listJobs } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type PaletteItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [dynamicItems, setDynamicItems] = useState<PaletteItem[]>([]);
  const [fetchedFor, setFetchedFor] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setQuery("");
      setHighlighted(0);
      setFetchedFor(false);
    }
  }

  const navItems: PaletteItem[] = [
    {
      id: "nav-home",
      label: t("nav.home"),
      sublabel: "",
      href: "/home",
    },
    {
      id: "nav-pipeline",
      label: t("nav.applications"),
      sublabel: "",
      href: "/pipeline",
    },
    {
      id: "nav-discover",
      label: t("nav.discover"),
      sublabel: "",
      href: "/discover",
    },
    {
      id: "nav-me",
      label: t("nav.careerBrain"),
      sublabel: "",
      href: "/me",
    },
    {
      id: "nav-contact",
      label: t("nav.contactAnswers"),
      sublabel: "",
      href: "/me/contact",
    },
    {
      id: "nav-resumes",
      label: t("nav.resumes"),
      sublabel: "",
      href: "/me/resumes",
    },
    { id: "nav-start", label: t("start.title"), sublabel: "", href: "/start" },
  ];

  useEffect(() => {
    if (!open || fetchedFor) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [applications, jobs] = await Promise.all([
          listApplications(token),
          listJobs(token, { savedOnly: true }),
        ]);
        if (cancelled) return;
        const applicationItems: PaletteItem[] = applications.map(
          (application) => ({
            id: `application-${application.id}`,
            label: `${application.company} · ${application.role}`,
            sublabel: t("nav.applications"),
            href: `/pipeline?focus=${application.id}`,
          }),
        );
        const jobItems: PaletteItem[] = jobs.map((job) => ({
          id: `job-${job.id}`,
          label: `${job.company} · ${job.title}`,
          sublabel: t("nav.discover"),
          href: `/discover?focus=${job.id}`,
        }));
        setDynamicItems([...applicationItems, ...jobItems]);
      } catch {
        setDynamicItems([]);
      } finally {
        if (!cancelled) setFetchedFor(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per open, gated by fetchedFor
  }, [open, fetchedFor]);

  const allItems = [...navItems, ...dynamicItems];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(normalizedQuery),
      )
    : allItems;

  function activate(item: PaletteItem) {
    router.push(item.href);
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[highlighted];
      if (item) activate(item);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("shell.search")}>
      <p className="text-sm text-ink-2">{t("shell.searchHint")}</p>
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        aria-label={t("shell.search")}
        className="mt-3 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-focus-ring"
      />
      <ul role="listbox" className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-ink-3">
            {t("shell.searchEmpty")}
          </li>
        )}
        {filtered.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => activate(item)}
              onMouseEnter={() => setHighlighted(index)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                index === highlighted
                  ? "bg-accent-soft text-accent"
                  : "text-ink-2 hover:bg-sunken"
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.sublabel && (
                <span className="ml-2 shrink-0 text-xs text-ink-3">
                  {item.sublabel}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export { CommandPalette };
