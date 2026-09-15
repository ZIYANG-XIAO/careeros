import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { getCareerBrain, getSystemHealth } from "@/lib/api";

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

  let careerBrainStatus = "Not signed in";
  const { getToken } = await auth();
  const token = await getToken();

  if (token) {
    try {
      await getCareerBrain(token);
      careerBrainStatus = "Active";
    } catch {
      careerBrainStatus = "Unavailable";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            CareerOS
          </p>
          <div>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
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
          <div className="flex items-center justify-between p-4">
            <dt className="font-medium text-slate-700">Career Brain</dt>
            <dd className="font-semibold text-emerald-700">
              {careerBrainStatus}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
