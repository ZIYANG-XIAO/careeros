import { expect, test } from "@playwright/test";

test("generic application fixture is usable in a real browser", async ({
  page,
}) => {
  await page.goto("/application-page.html");

  await expect(
    page.getByRole("heading", { name: "Example Engineer Application" }),
  ).toBeVisible();
  await expect(page.getByLabel("First name")).toBeEditable();
  await expect(page.getByLabel("Email")).toBeEditable();
  await expect(
    page.getByRole("button", { name: "Continue application" }),
  ).toBeVisible();
});
