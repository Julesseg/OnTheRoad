import { describe, it, expect } from 'vitest';
import { extractLinks } from './links';

describe('extractLinks', () => {
  it('finds an http(s) URL anywhere in the text', () => {
    expect(extractLinks('book here https://example.com/rooms thanks')).toEqual([
      { label: 'https://example.com/rooms', url: 'https://example.com/rooms' },
    ]);
  });

  it('qualifies a bare www. domain with https://', () => {
    expect(extractLinks('see www.example.com')).toEqual([
      { label: 'www.example.com', url: 'https://www.example.com' },
    ]);
  });

  it('trims trailing sentence punctuation from the match', () => {
    expect(extractLinks('check https://example.com.')).toEqual([
      { label: 'https://example.com', url: 'https://example.com' },
    ]);
  });

  it('de-duplicates by href, keeping first appearance order', () => {
    const links = extractLinks('https://a.com and https://b.com and https://a.com');
    expect(links.map((l) => l.url)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('returns nothing for text without links', () => {
    expect(extractLinks('just a plain note')).toEqual([]);
  });
});
