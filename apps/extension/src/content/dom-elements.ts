/**
 * `instanceof HTMLInputElement` (etc.) fails for an element that belongs to
 * a different window/realm — including a genuine same-origin <iframe>, whose
 * `HTMLInputElement` constructor is a distinct object from the top frame's.
 * Tag-name checks are realm-safe and behave identically for the common,
 * same-realm case, so this is a drop-in replacement everywhere form elements
 * are type-narrowed.
 */
export function isInputElement(node: Element): node is HTMLInputElement {
  return node.tagName === "INPUT";
}

export function isSelectElement(node: Element): node is HTMLSelectElement {
  return node.tagName === "SELECT";
}

export function isTextAreaElement(node: Element): node is HTMLTextAreaElement {
  return node.tagName === "TEXTAREA";
}
