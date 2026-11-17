import { describe, expect, it, vi } from 'vitest';
import { getLocale } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { drugOrderSummaryText } from './drug-order-summary.component';

// A French session's translations, as i18next would answer them
const french = ((key: string, defaultValue: string, options?: Record<string, unknown>) => {
  const text =
    { medicationDurationAndUnit: 'pour {{duration}} {{durationUnit}}', orderActionRevise: 'Modifier' }[key] ??
    defaultValue;
  return text.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''));
}) as any;

const order = {
  uuid: 'order-uuid',
  action: 'NEW',
  drug: { uuid: 'drug-uuid', display: 'Paracetamol Sirop 120mg/5ml' },
  dose: 2.5,
  doseUnits: { uuid: 'ml', display: 'Millilitre' },
  route: { uuid: 'oral', display: 'Orale' },
  frequency: { uuid: 'bd', display: 'Deux fois par jour' },
  duration: 3,
  durationUnits: { uuid: 'days', display: 'Jours' },
} as unknown as Order;

describe('drugOrderSummaryText', () => {
  it('writes the order in the session language, the dose with its decimal mark (UVL-EMR #752)', () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    expect(drugOrderSummaryText(order, french)).toBe(
      'Paracetamol Sirop 120mg/5ml — 2,5 millilitre — orale — deux fois par jour — pour 3 jours',
    );
  });

  it('names a revised order, and leaves out what the order does not have', () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    expect(
      drugOrderSummaryText(
        { ...order, action: 'REVISE', dose: null, duration: null, frequency: null } as unknown as Order,
        french,
      ),
    ).toBe('(Modifier) Paracetamol Sirop 120mg/5ml — orale');
  });
});
