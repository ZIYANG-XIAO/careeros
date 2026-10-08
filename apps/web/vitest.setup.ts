import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// The full suite runs files in parallel; under that load a few multi-step
// async interactions exceed the 1s default and fail intermittently.
configure({ asyncUtilTimeout: 3000 });
