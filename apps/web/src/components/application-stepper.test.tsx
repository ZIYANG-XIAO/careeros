import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationStepper } from "./application-stepper";

describe("ApplicationStepper", () => {
  it("renders a step for every stage on the happy path", () => {
    const { container } = render(<ApplicationStepper status="INTERVIEW" />);
    const dots = container.querySelectorAll("span.rounded-full");
    expect(dots).toHaveLength(6);
    expect(
      container.querySelectorAll("span.bg-blue-600.rounded-full"),
    ).toHaveLength(4);
  });

  it("renders nothing for closed statuses", () => {
    const { container: rejected } = render(
      <ApplicationStepper status="REJECTED" />,
    );
    expect(rejected).toBeEmptyDOMElement();

    const { container: withdrawn } = render(
      <ApplicationStepper status="WITHDRAWN" />,
    );
    expect(withdrawn).toBeEmptyDOMElement();
  });
});
