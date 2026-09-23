import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/jobs");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center">
        <section className="max-w-3xl">
          <p className="text-sm font-bold tracking-tight">
            Career<span className="text-blue-400">OS</span>
          </p>
          <p className="mt-16 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Your job-search workspace
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Know your story. Find the right work. Move with confidence.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            CareerOS brings your professional profile, resumes, opportunities,
            and future application history into one grounded workspace.
          </p>
          <SignInButton>
            <button className="mt-8 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
              Sign in to CareerOS
            </button>
          </SignInButton>
        </section>
      </div>
    </main>
  );
}
