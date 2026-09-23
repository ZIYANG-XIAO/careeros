import { createClerkClient } from "@clerk/chrome-extension/client";

function createBackgroundClient() {
  return createClerkClient({
    publishableKey: __CLERK_PUBLISHABLE_KEY__,
    syncHost: __CLERK_SYNC_HOST__,
    background: true,
  });
}

let clientPromise: ReturnType<typeof createBackgroundClient> | null = null;

async function getClient() {
  clientPromise ??= createBackgroundClient();
  return clientPromise;
}

export const tokenProvider = {
  async getToken(): Promise<string | null> {
    const clerk = await getClient();
    return clerk.session?.getToken() ?? null;
  },
};
