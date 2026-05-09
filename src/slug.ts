import { randomBase62 } from "./crypto";

// Short, professional alphanumeric IDs. 7 chars × 62-char alphabet =
// 3.5 trillion combinations — collision risk is irrelevant for our scale,
// and the URL stays compact: htmlbin.dev/p/aB3xK7g
const SLUG_LENGTH = 7;

export function generateSlug(_title?: string): string {
  return randomBase62(SLUG_LENGTH);
}

// Accept anything that looks like one of our IDs. We allow 6–12 chars so
// any past data with slightly different lengths still works.
export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[A-Za-z0-9]{6,12}$/.test(slug);
}
