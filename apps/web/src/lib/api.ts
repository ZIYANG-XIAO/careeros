export type HealthResponse = {
  status: "ok";
  database: "connected";
};

export type CareerBrainResponse = {
  id: string;
  created_at: string;
};

export type UserResponse = {
  id: string;
  email: string | null;
  created_at: string;
};

function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL is required");
  }

  return value.replace(/\/$/, "");
}

export async function getSystemHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl()}/health`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("CareerOS API health check failed");
  }

  return (await response.json()) as HealthResponse;
}

export async function getCareerBrain(
  token: string,
): Promise<CareerBrainResponse> {
  const response = await fetch(`${apiBaseUrl()}/career-brain`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch career brain");
  }

  return (await response.json()) as CareerBrainResponse;
}

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const response = await fetch(`${apiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }

  return (await response.json()) as UserResponse;
}
