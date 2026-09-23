import Link from "next/link";

export default function ApplicationsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Applications
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Your application history, in one place
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          CareerOS will remember the role, resume, and progress for applications
          you choose to track. Application tracking arrives in a later V1
          formation milestone.
        </p>
      </header>

      <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <svg
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.3}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm2 5h6m-6 4h6m-6 4h4"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.5 14.5l1.5 1.5 3-3"
              />
            </svg>
          </div>
          <div>
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Coming in V1 formation
            </span>
            <h2 className="mt-4 text-xl font-semibold text-slate-950">
              Nothing is being tracked yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This page is an honest preview—not a simulated pipeline. For now,
              use Jobs to explore opportunities and follow their application
              links directly.
            </p>
            <Link
              href="/jobs"
              className="mt-6 inline-flex items-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Explore jobs
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
