// Sunny adapter for registry class composition (no global utility CSS).
export const cn=(...values:(string|undefined)[])=>values.filter(Boolean).join(" ");
