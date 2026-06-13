import { describe, it, expect } from 'vitest';

import { buildSchemaPrompt, SCHEMA_PROMPT_EXAMPLE_JSON } from './schema-prompt';
import { importTripFromJson } from './trip-io';

describe('Schema Prompt', () => {
  // The strongest guarantee we can make about the prompt without running an LLM:
  // the worked example it teaches the model to imitate must itself clear the same
  // strict TripSchema gate that JSON Import enforces. If our own example can't be
  // imported, the format the prompt describes is wrong.
  it('ships a worked example that passes JSON Import validation', () => {
    const result = importTripFromJson(SCHEMA_PROMPT_EXAMPLE_JSON, 'fresh-id-placeholder');
    expect(result.ok).toBe(true);
  });

  it('describes the strict persisted fields JSON Import requires', () => {
    const prompt = buildSchemaPrompt();
    // The full persisted shape — not the lenient draft schema — because the
    // output re-enters through JSON Import's strict TripSchema gate (ADR-0006).
    for (const field of [
      'schemaVersion',
      'createdAt',
      'updatedAt',
      'startDate',
      'endDate',
      'UUID',
    ]) {
      expect(prompt).toContain(field);
    }
  });

  it('embeds the worked example and asks for JSON output only', () => {
    const prompt = buildSchemaPrompt();
    expect(prompt).toContain(SCHEMA_PROMPT_EXAMPLE_JSON);
    expect(prompt).toMatch(/JSON only/i);
    // ADR-0006: locations are address text only, never coordinates (geocoding
    // is a network service this feature rules out).
    expect(prompt).toMatch(/never lat|address text only/i);
  });
});
