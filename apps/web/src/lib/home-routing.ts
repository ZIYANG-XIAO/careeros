import { cookies } from "next/headers";

import { getCareerBrain, listResumes } from "./api";
import { hasMeaningfulProfile, ONBOARDING_SKIP_COOKIE } from "./onboarding";

export async function resolveHomeRedirect(
  token: string,
  userId: string,
): Promise<"/pipeline" | "/start"> {
  const cookieStore = await cookies();
  const skipCookie = cookieStore.get(ONBOARDING_SKIP_COOKIE);
  if (skipCookie?.value === userId) return "/pipeline";

  try {
    const [resumes, brain] = await Promise.all([
      listResumes(token),
      getCareerBrain(token),
    ]);
    return hasMeaningfulProfile(resumes, brain) ? "/pipeline" : "/start";
  } catch {
    return "/start";
  }
}
