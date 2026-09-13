import { getSystemHealth } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let apiStatus = "Unavailable";
  let databaseStatus = "Unavailable";

  try {
    const health = await getSystemHealth();
    apiStatus = health.status === "ok" ? "Healthy" : "Unavailable";
    databaseStatus =
      health.database === "connected" ? "Connected" : "Unavailable";
  } catch {
    // The status page remains usable and reports a clear unavailable state.
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          CareerOS
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          System Status
        </h1>
        <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4">
            <dt className="font-medium text-slate-700">API</dt>
            <dd className="font-semibold text-emerald-700">{apiStatus}</dd>
          </div>
          <div className="flex items-center justify-between p-4">
            <dt className="font-medium text-slate-700">Database</dt>
            <dd className="font-semibold text-emerald-700">{databaseStatus}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
