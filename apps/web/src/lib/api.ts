export type HealthResponse = {
  status: "ok";
  database: "connected";
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
