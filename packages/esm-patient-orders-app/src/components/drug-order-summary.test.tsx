import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getLocale } from '@openmrs/esm-framework';
import { type Order, useDrugOrderByUuid } from '@openmrs/esm-patient-common-lib';
import { DrugOrderSummary, drugOrderSummaryText } from './drug-order-summary.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useDrugOrderByUuid: vi.fn(),
}));

const mockUseDrugOrderByUuid = vi.mocked(useDrugOrderByUuid);

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

describe('DrugOrderSummary', () => {
  // The orders list reads an order without its drug and dosing fields
  const listed = {
    uuid: 'order-uuid',
    action: 'NEW',
    display: '(NEW) Paracetamol Sirop 120mg/5ml: 2.5 Millilitre Orale Deux fois par jour 3 Jours',
    concept: { uuid: 'concept-uuid', display: 'Paracetamol' },
  } as unknown as Order;

  it("shows a placeholder, not the server's text, while the fields are read (UVL-EMR #765)", () => {
    mockUseDrugOrderByUuid.mockReturnValue({ data: null, error: undefined, isLoading: true });
    render(<DrugOrderSummary order={listed} />);

    expect(screen.getByTestId('drug-order-summary-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/\(NEW\)/)).not.toBeInTheDocument();
  });

  it('writes the line from the fields once they are read', () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    mockUseDrugOrderByUuid.mockReturnValue({ data: order, error: undefined, isLoading: false });
    render(<DrugOrderSummary order={listed} />);

    expect(screen.getByText(/^Paracetamol Sirop 120mg\/5ml — 2,5 millilitre — orale/)).toBeInTheDocument();
  });

  it('writes the line from the order itself when it already has its fields, without a request', () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    mockUseDrugOrderByUuid.mockReturnValue({ data: null, error: undefined, isLoading: false });
    render(<DrugOrderSummary order={order} />);

    expect(mockUseDrugOrderByUuid).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/^Paracetamol Sirop 120mg\/5ml — 2,5 millilitre/)).toBeInTheDocument();
  });

  it("falls back to what the order has if its fields cannot be read, never the server's text", () => {
    mockUseDrugOrderByUuid.mockReturnValue({ data: null, error: new Error('500'), isLoading: false });
    render(<DrugOrderSummary order={listed} />);

    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.queryByText(/\(NEW\)/)).not.toBeInTheDocument();
  });
});
