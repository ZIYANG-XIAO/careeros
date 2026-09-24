import type {
  CanonicalFieldKey,
  FieldConfidence,
  FormAdapterId,
  NormalizedApplicationForm,
  NormalizedControlType,
  NormalizedFieldOption,
  NormalizedFormField,
} from "../shared/messages";

const MAX_FORMS = 10;
const MAX_FIELDS_PER_FORM = 200;
const MAX_OPTIONS_PER_FIELD = 100;
const MAX_TEXT_LENGTH = 500;

const AUTOCOMPLETE_KEYS: Readonly<Record<string, CanonicalFieldKey>> = {
  "given-name": "PERSON_FIRST_NAME",
  "family-name": "PERSON_LAST_NAME",
  name: "PERSON_FULL_NAME",
  email: "CONTACT_EMAIL",
  tel: "CONTACT_PHONE",
  "address-line1": "ADDRESS_LINE_1",
  "address-line2": "ADDRESS_LINE_2",
  "address-level2": "ADDRESS_CITY",
  "address-level1": "ADDRESS_REGION",
  "postal-code": "ADDRESS_POSTAL_CODE",
  country: "ADDRESS_COUNTRY",
  "country-name": "ADDRESS_COUNTRY",
};

type SupportedControl =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

type CanonicalMatch = {
  key: CanonicalFieldKey;
  confidence: FieldConfidence;
};

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value
    ?.replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
  return cleaned || null;
}

function humanizeIdentifier(value: string | null): string | null {
  if (!value) return null;
  return cleanText(value.replaceAll(/[_\-.]+/g, " "));
}

function structuralText(element: Element): string {
  let content = "";
  const visit = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === child.TEXT_NODE) {
        content += ` ${child.textContent ?? ""}`;
      } else if (
        child.nodeType === child.ELEMENT_NODE &&
        !(child as Element).matches(
          "input, select, textarea, button, script, style",
        )
      ) {
        visit(child);
      }
    }
  };
  visit(element);
  return content;
}

function labelledByText(control: Element): string | null {
  const ids = control.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
  return cleanText(
    ids
      .map((id) => {
        const element = control.ownerDocument.getElementById(id);
        return element ? structuralText(element) : "";
      })
      .join(" "),
  );
}

function fieldsetLegendText(control: Element): string | null {
  const legend = control.closest("fieldset")?.querySelector(":scope > legend");
  return cleanText(legend ? structuralText(legend) : null);
}

function labelText(control: SupportedControl): string | null {
  const nativeLabels = Array.from(control.labels ?? [])
    .map(structuralText)
    .join(" ");
  return (
    cleanText(nativeLabels) ??
    cleanText(control.getAttribute("aria-label")) ??
    labelledByText(control) ??
    fieldsetLegendText(control) ??
    cleanText(control.getAttribute("placeholder")) ??
    humanizeIdentifier(control.getAttribute("name")) ??
    humanizeIdentifier(control.id) ??
    null
  );
}

function hintText(control: SupportedControl, question: string | null): string {
  return [
    question ?? "",
    humanizeIdentifier(control.getAttribute("name")) ?? "",
    humanizeIdentifier(control.id) ?? "",
    control.getAttribute("autocomplete") ?? "",
    control.getAttribute("type") ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function autocompleteMatch(control: SupportedControl): CanonicalMatch | null {
  const tokens = (control.getAttribute("autocomplete") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  for (const token of tokens.reverse()) {
    const key = AUTOCOMPLETE_KEYS[token];
    if (key) return { key, confidence: "HIGH" };
  }
  return null;
}

const TEXT_MATCHERS: ReadonlyArray<[RegExp, CanonicalFieldKey]> = [
  [/\b(first|given)\s*name\b/, "PERSON_FIRST_NAME"],
  [/\b(last|family|sur)\s*name\b/, "PERSON_LAST_NAME"],
  [/\b(full|legal|candidate)\s*name\b|^name$/, "PERSON_FULL_NAME"],
  [/\be[- ]?mail(?: address)?\b/, "CONTACT_EMAIL"],
  [/\b(phone|telephone|mobile)(?: number)?\b/, "CONTACT_PHONE"],
  [/\baddress\s*(line)?\s*1\b|\bstreet address\b/, "ADDRESS_LINE_1"],
  [/\b(address\s*(line)?\s*2|apartment|suite|unit)\b/, "ADDRESS_LINE_2"],
  [/\bcity\b/, "ADDRESS_CITY"],
  [/\b(state|province|region)\b/, "ADDRESS_REGION"],
  [/\b(zip|postal)(?: code)?\b/, "ADDRESS_POSTAL_CODE"],
  [/\bcountry\b/, "ADDRESS_COUNTRY"],
  [/\blinked\s*in\b/, "PROFESSIONAL_LINKEDIN_URL"],
  [/\bgithub\b/, "PROFESSIONAL_GITHUB_URL"],
  [
    /\b(portfolio|personal website|website url)\b/,
    "PROFESSIONAL_PORTFOLIO_URL",
  ],
  [/\b(school|university|college|institution)\b/, "EDUCATION_SCHOOL"],
  [/\bdegree\b/, "EDUCATION_DEGREE"],
  [/\b(field of study|major)\b/, "EDUCATION_FIELD_OF_STUDY"],
  [
    /\b(current|most recent|latest)\s+(company|employer)\b/,
    "EXPERIENCE_COMPANY",
  ],
  [/\b(current|most recent|latest)\s+(job )?title\b/, "EXPERIENCE_TITLE"],
];

function canonicalMatch(
  control: SupportedControl,
  question: string | null,
): CanonicalMatch | null {
  const autocomplete = autocompleteMatch(control);
  if (autocomplete) return autocomplete;

  const inputType =
    control instanceof HTMLInputElement ? control.type.toLowerCase() : "";
  if (inputType === "email") {
    return { key: "CONTACT_EMAIL", confidence: "HIGH" };
  }
  if (inputType === "tel") {
    return { key: "CONTACT_PHONE", confidence: "HIGH" };
  }

  const hints = hintText(control, question);
  if (inputType === "file") {
    if (/\bcover letter\b/.test(hints)) {
      return { key: "COVER_LETTER_FILE", confidence: "MEDIUM" };
    }
    if (/\b(resume|curriculum vitae|cv)\b/.test(hints)) {
      return { key: "RESUME_FILE", confidence: "MEDIUM" };
    }
    return null;
  }
  for (const [pattern, key] of TEXT_MATCHERS) {
    if (pattern.test(hints)) return { key, confidence: "MEDIUM" };
  }
  return null;
}

function controlType(control: SupportedControl): NormalizedControlType | null {
  if (control instanceof HTMLTextAreaElement) return "TEXTAREA";
  if (control instanceof HTMLSelectElement) return "SELECT";
  const type = control.type.toLowerCase();
  if (["hidden", "button", "submit", "reset", "image"].includes(type)) {
    return null;
  }
  if (type === "email") return "EMAIL";
  if (type === "tel") return "PHONE";
  if (type === "url") return "URL";
  if (type === "radio") return "RADIO_GROUP";
  if (type === "checkbox") return "CHECKBOX";
  if (type === "file") return "FILE";
  if (["date", "datetime-local", "month", "week"].includes(type)) return "DATE";
  if (type === "number") return "NUMBER";
  if (["text", "search", ""].includes(type)) return "TEXT";
  return "UNSUPPORTED";
}

function isRequired(control: SupportedControl): boolean {
  return control.required || control.getAttribute("aria-required") === "true";
}

function selectOptions(control: HTMLSelectElement): NormalizedFieldOption[] {
  return Array.from(control.options)
    .slice(0, MAX_OPTIONS_PER_FIELD)
    .map((option, index) => ({
      id: `option-${index}`,
      label: cleanText(option.textContent) ?? `Option ${index + 1}`,
    }));
}

function radioOptions(controls: HTMLInputElement[]): NormalizedFieldOption[] {
  return controls.slice(0, MAX_OPTIONS_PER_FIELD).map((control, index) => ({
    id: `option-${index}`,
    label: labelText(control) ?? `Option ${index + 1}`,
  }));
}

function normalizedField(
  control: SupportedControl,
  fieldId: string,
  radioGroup: HTMLInputElement[] | null = null,
): NormalizedFormField | null {
  const normalizedType = controlType(control);
  if (!normalizedType) return null;
  const question = radioGroup
    ? (fieldsetLegendText(control) ?? labelText(control))
    : labelText(control);
  const match = canonicalMatch(control, question);
  const unsupported = normalizedType === "UNSUPPORTED";
  return {
    id: fieldId,
    controlType: normalizedType,
    question,
    required: isRequired(control),
    canonicalKey: unsupported ? null : (match?.key ?? null),
    support: unsupported ? "UNSUPPORTED" : match ? "SUPPORTED" : "UNKNOWN",
    confidence: unsupported ? "LOW" : (match?.confidence ?? "LOW"),
    options:
      control instanceof HTMLSelectElement
        ? selectOptions(control)
        : radioGroup
          ? radioOptions(radioGroup)
          : [],
  };
}

function inspectForm(
  form: HTMLFormElement,
  formIndex: number,
  adapter: FormAdapterId,
): NormalizedApplicationForm {
  const controls = Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea"),
  ).slice(0, MAX_FIELDS_PER_FORM);
  const visitedRadioNames = new Set<string>();
  const fields: NormalizedFormField[] = [];

  controls.forEach((control, controlIndex) => {
    if (control instanceof HTMLInputElement && control.type === "radio") {
      const groupName = control.name;
      if (groupName && visitedRadioNames.has(groupName)) return;
      if (groupName) visitedRadioNames.add(groupName);
      const group = groupName
        ? controls.filter(
            (candidate): candidate is HTMLInputElement =>
              candidate instanceof HTMLInputElement &&
              candidate.type === "radio" &&
              candidate.name === groupName,
          )
        : [control];
      const field = normalizedField(
        control,
        `field-${formIndex}-${controlIndex}`,
        group,
      );
      if (field) fields.push(field);
      return;
    }

    const field = normalizedField(
      control,
      `field-${formIndex}-${controlIndex}`,
    );
    if (field) fields.push(field);
  });

  const supported = fields.filter(
    (field) => field.support === "SUPPORTED",
  ).length;
  return {
    id: `form-${formIndex}`,
    adapter,
    support:
      fields.length > 0 && supported === fields.length
        ? "SUPPORTED"
        : supported > 0
          ? "PARTIALLY_SUPPORTED"
          : "UNSUPPORTED",
    fields,
  };
}

export function normalizeForms(
  forms: HTMLFormElement[],
  adapter: FormAdapterId,
): NormalizedApplicationForm[] {
  return forms
    .slice(0, MAX_FORMS)
    .map((form, index) => inspectForm(form, index, adapter));
}
