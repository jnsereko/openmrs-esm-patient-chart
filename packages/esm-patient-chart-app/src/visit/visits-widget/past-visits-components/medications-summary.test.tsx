import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getLocale, useConfig } from '@openmrs/esm-framework';
import { type OrderItem } from '../visit.resource';
import MedicationSummary from './medications-summary.component';

const drugOrderTypeUUID = 'drug-order-type-uuid';

const medication = {
  order: {
    uuid: 'order-uuid',
    orderType: { uuid: drugOrderTypeUUID },
    drug: { display: 'Paracetamol Sirop 120mg/5ml', strength: '120mg/5ml' },
    dose: 3.75,
    doseUnits: { display: 'Millilitre' },
    route: { display: 'Orale' },
    frequency: { display: 'Trois fois par jour' },
    duration: 2.5,
    durationUnits: { display: 'Jours' },
    quantity: 37.5,
    dateActivated: '2026-11-18T08:00:00.000+0200',
    orderer: { display: 'doctor' },
  },
} as unknown as OrderItem;

describe('MedicationSummary', () => {
  it("writes the dose, duration and quantity with the session language's decimal mark (UVL-EMR #767)", () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    vi.mocked(useConfig).mockReturnValue({ drugOrderTypeUUID });

    render(<MedicationSummary medications={[medication]} />);

    expect(screen.getByText(/3,75 millilitre/)).toBeInTheDocument();
    expect(screen.getByText(/37,5/)).toBeInTheDocument();
    expect(screen.queryByText(/3\.75/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\.5/)).not.toBeInTheDocument();
  });
});
