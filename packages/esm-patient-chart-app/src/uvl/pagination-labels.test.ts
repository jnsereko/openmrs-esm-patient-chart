import { describe, expect, it } from 'vitest';
import { paginationLabels } from './pagination-labels';

// A French session's translations, as i18next would answer them
const french = ((key: string, defaultValue: string, options?: Record<string, unknown>) => {
  const text =
    {
      itemsPerPage: 'Éléments par page',
      paginationItemRange: '{{min}}–{{max}} sur {{count}} éléments',
      paginationPageText: 'sur {{count}} pages',
    }[key] ?? defaultValue;
  return text.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''));
}) as any;

describe('paginationLabels', () => {
  it("writes Carbon's pagination texts in the session language (UVL-EMR #767)", () => {
    const labels = paginationLabels(french);

    expect(labels.itemsPerPageText).toBe('Éléments par page:');
    expect(labels.itemRangeText(1, 1, 1)).toBe('1–1 sur 1 éléments');
    expect(labels.pageRangeText(1, 1)).toBe('sur 1 pages');
  });
});
