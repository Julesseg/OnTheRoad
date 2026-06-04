/** A URL found in free text, with the text as written and a scheme-qualified href to open. */
export interface NoteLink {
  /** The URL exactly as it appears in the note (e.g. `www.example.com`). */
  label: string;
  /** The href to hand to `Linking.openURL` — bare `www.` matches gain an `https://`. */
  url: string;
}

// http(s) URLs, or bare www.* domains. We grab a greedy run of non-space, then trim
// trailing punctuation below so a URL ending a sentence ("see https://x.com.") keeps
// its real shape. Closing brackets are also trimmed for URLs written inside (parens).
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;
const TRAILING_PUNCT = /[.,!?;:'")\]}>]+$/;

/**
 * Extract the tappable links from a note's free text, in order, de-duplicated by href.
 * The editor's notes fields are plain text, so this is how we surface their links as
 * something the traveller can actually open.
 */
export function extractLinks(text: string): NoteLink[] {
  const out: NoteLink[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(URL_RE)) {
    const label = match[0].replace(TRAILING_PUNCT, '');
    if (!label) continue;
    const url = label.toLowerCase().startsWith('www.') ? `https://${label}` : label;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label, url });
  }
  return out;
}
