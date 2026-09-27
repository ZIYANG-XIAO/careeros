import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./theme";

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span>current: {theme}</span>
      <button onClick={() => setTheme("dark")}>go dark</button>
      <button onClick={() => setTheme("light")}>go light</button>
      <button onClick={() => setTheme("system")}>go system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  it("defaults to system with no data-theme attribute", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("current: system")).toBeInTheDocument();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("honors an explicit initial theme", () => {
    render(
      <ThemeProvider initialTheme="dark">
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("current: dark")).toBeInTheDocument();
  });

  it("sets data-theme and persists to localStorage and cookie on change", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByText("go dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("careeros.theme")).toBe("dark");
    expect(document.cookie).toContain("careeros_theme=dark");

    await user.click(screen.getByText("go light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await user.click(screen.getByText("go system"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem("careeros.theme")).toBe("system");
  });
});
