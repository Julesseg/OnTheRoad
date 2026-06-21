import { describe, it, expect } from 'vitest';
import { pluralCategory } from './plural';

describe('pluralCategory', () => {
  it('English: only 1 is singular', () => {
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
  });

  it('French: groups 0 and 1 as singular', () => {
    expect(pluralCategory('fr', 0)).toBe('one');
    expect(pluralCategory('fr', 1)).toBe('one');
    expect(pluralCategory('fr', 2)).toBe('other');
  });
});
