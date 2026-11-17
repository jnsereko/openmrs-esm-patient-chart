import type { Order } from '@openmrs/esm-patient-common-lib';
import { describe, it, expect, vi } from 'vitest';
import { getLocale } from '@openmrs/esm-framework';
import { buildMedicationOrder, interpretObservation } from './index';

const medicationOrder = {
  uuid: 'order-uuid',
  action: 'NEW',
  asNeeded: false,
  asNeededCondition: null,
  autoExpireDate: null,
  careSetting: { uuid: 'care-setting-uuid', display: 'Outpatient' },
  commentToFulfiller: '',
  concept: { uuid: 'concept-uuid', display: 'Aspirin' },
  dateActivated: '2026-03-15T08:00:00.000+0000',
  dateStopped: null,
  dispenseAsWritten: false,
  dose: 1,
  doseUnits: { uuid: 'unit-uuid', display: 'tablet' },
  dosingInstructions: 'Take with food',
  dosingType: 'org.openmrs.SimpleDosingInstructions',
  drug: {
    uuid: 'drug-uuid',
    display: 'Aspirin 81 mg',
    strength: '81 mg',
    concept: { uuid: 'concept-uuid', display: 'Aspirin' },
    dosageForm: { uuid: 'dosage-form-uuid', display: 'Tablet' },
  },
  duration: 10,
  durationUnits: { uuid: 'duration-unit-uuid', display: 'Days' },
  encounter: { uuid: 'encounter-uuid', visit: { uuid: 'visit-uuid' } },
  frequency: { uuid: 'frequency-uuid', display: 'Once daily' },
  instructions: null,
  numRefills: 1,
  orderNumber: 'ORD-1',
  orderReason: null,
  orderReasonNonCoded: 'Pain',
  orderType: {
    conceptClasses: [],
    description: '',
    display: 'Drug order',
    name: 'Drug order',
    parent: null,
    retired: false,
    uuid: 'order-type-uuid',
  },
  orderer: {
    display: 'Provider',
    person: { display: 'Provider' },
    uuid: 'provider-uuid',
  },
  patient: { uuid: 'patient-uuid', display: 'Patient' },
  previousOrder: null,
  quantity: 10,
  quantityUnits: { uuid: 'quantity-unit-uuid', display: 'tablet' },
  route: { uuid: 'route-uuid', display: 'Oral' },
  scheduleDate: null,
  urgency: 'ROUTINE',
  accessionNumber: '',
  scheduledDate: '',
  display: 'Aspirin 81 mg',
  auditInfo: {
    creator: { uuid: 'creator-uuid', display: 'Creator' },
    dateCreated: '2026-03-15T08:00:00.000+0000',
    changedBy: '',
    dateChanged: '',
  },
  fulfillerStatus: 'RECEIVED',
  fulfillerComment: '',
  specimenSource: '',
  laterality: '',
  clinicalHistory: '',
  numberOfRepeats: '',
  type: 'drugorder',
} as unknown as Order;

describe('buildMedicationOrder', () => {
  it('defaults RENEW basket items to now instead of the previous activation date', () => {
    const before = Date.now();
    const result = buildMedicationOrder(medicationOrder, 'RENEW');
    const after = Date.now();

    expect(result.scheduledDate).toBeInstanceOf(Date);
    expect((result.scheduledDate as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((result.scheduledDate as Date).getTime()).toBeLessThanOrEqual(after);
    expect(result.scheduledDate).not.toBe(medicationOrder.dateActivated);
  });

  it('defaults REVISE basket items to now instead of the previous activation or scheduled date', () => {
    const before = Date.now();
    const scheduledDate = '2026-05-01T00:00:00.000+0000';
    const result = buildMedicationOrder({ ...medicationOrder, scheduledDate } as Order, 'REVISE');
    const after = Date.now();

    expect(result.scheduledDate).toBeInstanceOf(Date);
    expect((result.scheduledDate as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((result.scheduledDate as Date).getTime()).toBeLessThanOrEqual(after);
    expect(result.scheduledDate).not.toBe(scheduledDate);
    expect(result.scheduledDate).not.toBe(medicationOrder.dateActivated);
  });

  it.each(['RENEW', 'REVISE'] as const)(
    'preserves the future scheduled date when building a %s basket item for an upcoming order',
    (action) => {
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = buildMedicationOrder(
        {
          ...medicationOrder,
          urgency: 'ON_SCHEDULED_DATE',
          scheduledDate: scheduledDate.toISOString(),
        } as Order,
        action,
      );

      expect(result.scheduledDate).toEqual(scheduledDate);
    },
  );

  it.each(['RENEW', 'REVISE'] as const)(
    'defaults %s basket items to now when a future scheduled date is not marked ON_SCHEDULED_DATE',
    (action) => {
      const before = Date.now();
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = buildMedicationOrder(
        {
          ...medicationOrder,
          urgency: 'ROUTINE',
          scheduledDate,
        } as Order,
        action,
      );
      const after = Date.now();

      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect((result.scheduledDate as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((result.scheduledDate as Date).getTime()).toBeLessThanOrEqual(after);
      expect(result.scheduledDate).not.toEqual(new Date(scheduledDate));
    },
  );

  it('uses the original activation date when building a DISCONTINUE basket item', () => {
    const result = buildMedicationOrder(medicationOrder, 'DISCONTINUE');

    expect(result.scheduledDate).toBeInstanceOf(Date);
    expect((result.scheduledDate as Date).toISOString()).toBe(new Date(medicationOrder.dateActivated).toISOString());
  });

  it('captures the previous order activation date for REVISE validation', () => {
    const result = buildMedicationOrder(medicationOrder, 'REVISE');

    expect(result.previousOrderDateActivated).toBe(medicationOrder.dateActivated);
  });
});

describe('interpretObservation', () => {
  const obs = (value: unknown) => ({ uuid: 'obs-uuid', value }) as any;

  it("writes a numeric result with the session language's decimal mark, before its units (UVL-EMR #752)", () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    expect(interpretObservation(obs(95.4), { units: 'mg/dl' }).displayValue).toBe('95,4 mg/dl');
    expect(interpretObservation(obs(4.5), { units: '%' }).displayValue).toBe('4,5 %');
    expect(interpretObservation(obs(140), { units: 'mmol/L' }).displayValue).toBe('140 mmol/L');

    vi.mocked(getLocale).mockReturnValue('en');
    expect(interpretObservation(obs(95.4), { units: 'mg/dl' }).displayValue).toBe('95.4 mg/dl');
  });

  it('still judges the value by the number, and leaves a coded or text result alone', () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    expect(interpretObservation(obs(12.5), { hiNormal: 10, units: 'g/dL' }).interpretation).toBe('HIGH');
    expect(interpretObservation(obs({ uuid: 'positive', display: 'Positif' }), {}).displayValue).toBe('Positif');
    expect(interpretObservation(obs('1.5 x 10^9'), {}).displayValue).toBe('1.5 x 10^9');
  });
});
