import { describe, expect, it, vi } from 'vitest';
import { getLocale } from '@openmrs/esm-framework';
import { formatDecimal } from './format-decimal';

describe('formatDecimal', () => {
  it("writes a decimal with the session language's mark (UVL-EMR #752)", () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    expect(formatDecimal(2.5)).toBe('2,5');
    expect(formatDecimal('0.25')).toBe('0,25');

    vi.mocked(getLocale).mockReturnValue('en');
    expect(formatDecimal(2.5)).toBe('2.5');
  });

  it('leaves whole numbers, text and empty values as they are', () => {
    expect(formatDecimal(2, 'fr')).toBe(2);
    expect(formatDecimal('10%', 'fr')).toBe('10%');
    expect(formatDecimal(null, 'fr')).toBeNull();
    expect(formatDecimal(undefined, 'fr')).toBeUndefined();
  });
});
