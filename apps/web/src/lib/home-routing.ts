import { cookies } from "next/headers";

import { getCareerBrain, listResumes } from "./api";
import { hasMeaningfulProfile, ONBOARDING_SKIP_COOKIE } from "./onboarding";

export async function resolveHomeRedirect(
  token: string,
  userId: string,
): Promise<"/home" | "/start"> {
  const cookieStore = await cookies();
  const skipCookie = cookieStore.get(ONBOARDING_SKIP_COOKIE);
  if (skipCookie?.value === userId) return "/home";

  try {
    const [resumes, brain] = await Promise.all([
      listResumes(token),
      getCareerBrain(token),
    ]);
    return hasMeaningfulProfile(resumes, brain) ? "/home" : "/start";
  } catch {
    return "/start";
  }
}
