"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type DropdownMenuProps = {
  children: ReactNode;
  label?: string;
};

function DropdownMenu({ children, label = "Actions" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={label}
      >
        <svg
          className="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-max min-w-36 rounded-lg border border-border bg-surface py-1 shadow-overlay"
          role="menu"
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

type DropdownItemProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
};

function DropdownItem({
  children,
  onClick,
  variant = "default",
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-4 py-2 text-left text-sm ${
        variant === "danger"
          ? "text-[#8A4530] hover:bg-evidence-gap-bg"
          : "text-ink-2 hover:bg-sunken"
      }`}
    >
      {children}
    </button>
  );
}

export { DropdownMenu, DropdownItem };
