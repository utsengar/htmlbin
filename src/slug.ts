import { randomBase62 } from "./crypto";

// Short, professional alphanumeric IDs. 9 chars × 62-char alphabet ≈
// 1.3 × 10^16 combinations (~53 bits of entropy) — unguessable even for
// a determined attacker, and the URL stays compact: htmlbin.dev/p/aB3xK7gPq
const SLUG_LENGTH = 9;

export function generateSlug(_title?: string): string {
  return randomBase62(SLUG_LENGTH);
}

// Accept anything that looks like one of our IDs. We allow 6–12 chars so
// any past data with slightly different lengths still works.
export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[A-Za-z0-9]{6,12}$/.test(slug);
}
