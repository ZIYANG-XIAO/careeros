import type { ApplicationStatus } from "@/lib/types";

const HAPPY_PATH: ApplicationStatus[] = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

const CLOSED_STATUSES = new Set<ApplicationStatus>(["REJECTED", "WITHDRAWN"]);

function ApplicationStepper({ status }: { status: ApplicationStatus }) {
  if (CLOSED_STATUSES.has(status)) return null;
  const currentIndex = HAPPY_PATH.indexOf(status);

  return (
    <div aria-hidden="true" className="mt-4 flex items-center">
      {HAPPY_PATH.map((step, index) => (
        <div key={step} className="flex flex-1 items-center last:flex-none">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              index <= currentIndex ? "bg-blue-600" : "bg-slate-200"
            }`}
          />
          {index < HAPPY_PATH.length - 1 && (
            <span
              className={`mx-0.5 h-0.5 flex-1 ${
                index < currentIndex ? "bg-blue-600" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export { ApplicationStepper };
