/** Same normalization as the Web CompanyMark (apps/web company-mark.tsx). */
export function companyIconKey(company: string): string {
  return company
    .normalize("NFKD")
    .toLowerCase()
    .replace(
      /\b(incorporated|corporation|company|limited|holdings|labs?|inc|corp|co|ltd|llc)\b\.?/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
}
