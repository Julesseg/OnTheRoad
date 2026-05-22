import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { newId } from './id';

const uuid = z.string().uuid();

describe('newId', () => {
  it('produces a value accepted by the schema uuid validator', () => {
    expect(() => uuid.parse(newId())).not.toThrow();
  });

  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
