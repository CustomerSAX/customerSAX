/** Normalize visual formatting only; never infer digits or a country prefix. */
function normalize(text: string) {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-");
}
function canonical(phone: string) {
  return normalize(phone).replace(/[ ()-]/g, "");
}
function numbers(text: string) {
  return (
    normalize(text).match(
      /(?<![\p{L}\p{N}+])\+?(?:\(\d{1,4}\)|\d)[\d ()-]*\d(?![\p{L}\p{N}])/gu
    ) ?? []
  )
    .map((value) => value.trim())
    .filter((value) => /^\+?\d{7,15}$/.test(canonical(value)));
}

/** Verify against actual ticket numbers, not the model's reproduction of a sentence. */
export function groundedPhone(
  source: string,
  proposed: string | null,
  evidence: string | null
): string | null {
  if (!proposed || !/^\+?\d{7,15}$/.test(canonical(proposed))) return null;
  const candidates = numbers(source);
  const match = candidates.find(
    (candidate) => canonical(candidate) === canonical(proposed)
  );
  if (!match) return null;
  // A single distinct number is sufficient evidence even if the model rephrased
  // the quote or added punctuation. With multiple numbers, retain quote grounding.
  if (new Set(candidates.map(canonical)).size === 1) return match;
  if (
    evidence &&
    normalize(source).includes(normalize(evidence)) &&
    numbers(evidence).some((candidate) => canonical(candidate) === canonical(proposed))
  )
    return match;
  return null;
}
