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

// Lets the Web app show that the extension is installed and signed in. Sends
// only the build version; the API stamps the time and derives the user.
export async function reportPresence(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  buildVersion: string,
): Promise<void> {
  const token = await tokenProvider.getToken();
  if (!token) return;

  const response = await request(`${apiUrl}/me/extension-presence`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ build_version: buildVersion }),
  });
  if (!response.ok) throw new Error(`CareerOS API returned ${response.status}`);
}
