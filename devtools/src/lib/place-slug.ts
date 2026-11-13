/**
 * Place slugs can contain Thai letters. Next.js hands a dynamic route segment to the page as it was
 * requested, so a non-ASCII slug may arrive percent-encoded and in either Unicode normalization form,
 * while the database stores it as one raw string. These are the spellings worth looking up.
 */
export function placeSlugCandidates(raw: string): string[] {
  const spellings = new Set<string>();
  const add = (value: string) => {
    spellings.add(value);
    spellings.add(value.normalize('NFC'));
    spellings.add(value.normalize('NFD'));
  };
  add(raw);
  try {
    add(decodeURIComponent(raw));
  } catch {
    // Not valid percent-encoding (for example a literal "%"): keep the raw spelling only.
  }
  return [...spellings];
}
