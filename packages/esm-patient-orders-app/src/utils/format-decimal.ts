import { getLocale } from '@openmrs/esm-framework';

/**
 * A number as the session's language writes it: « 4,5 » in French, "4.5" in English. The result fields take a
 * dot or a comma (UVL-EMR #727); what is shown follows the session language (UVL-EMR #752). Only the decimal
 * mark changes: the digits are those JavaScript writes, without grouping. Anything that is not a number is
 * returned as it is. The same helper as the medications app's: common-lib is shared at runtime, so it is not
 * put there.
 */
export function formatDecimal<T>(value: T, locale?: string): T | string {
  if (value === null || value === undefined || (typeof value !== 'number' && typeof value !== 'string')) {
    return value;
  }
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (!/^-?\d+\.\d+$/.test(text)) {
    return value;
  }
  return text.replace('.', getDecimalSeparator(locale ?? getLocale()));
}

function getDecimalSeparator(locale: string | undefined) {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
  } catch {
    // A language tag Intl does not take
    return '.';
  }
}
