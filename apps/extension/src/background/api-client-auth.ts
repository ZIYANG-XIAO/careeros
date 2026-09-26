import type { AuthStatus } from "../shared/messages";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

export async function getAuthStatus(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
): Promise<AuthStatus> {
  const token = await tokenProvider.getToken();
  if (!token) return { authenticated: false };

  const response = await request(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return { authenticated: false };
  if (!response.ok) throw new Error(`CareerOS API returned ${response.status}`);

  // The identity payload proves that the backend resolved the authenticated
  // owner. It is intentionally not forwarded to the content script.
  await response.json();
  return { authenticated: true };
}
