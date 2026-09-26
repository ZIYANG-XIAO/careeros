import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __CAREEROS_API_URL__: JSON.stringify("http://localhost:8000"),
    __CAREEROS_WEB_URL__: JSON.stringify("http://localhost:3000"),
    __CAREEROS_BUILD_VERSION__: JSON.stringify("test-build"),
    __CLERK_PUBLISHABLE_KEY__: JSON.stringify("pk_test_example"),
    __CLERK_SYNC_HOST__: JSON.stringify("http://localhost"),
  },
});
