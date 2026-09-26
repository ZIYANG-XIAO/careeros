import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing-page";
import { resolveHomeRedirect } from "@/lib/home-routing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, getToken } = await auth();

  if (userId) {
    const token = await getToken();
    if (token) {
      redirect(await resolveHomeRedirect(token, userId));
    }
    redirect("/welcome");
  }

  return <LandingPage />;
}
