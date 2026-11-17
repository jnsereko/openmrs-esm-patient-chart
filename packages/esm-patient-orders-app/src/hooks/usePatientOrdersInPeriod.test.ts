import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';
import { isActivatedWithin, usePatientOrdersInPeriod } from './usePatientOrdersInPeriod';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

// UVL-EMR #760: a local day in Burundi (UTC+2), as the Orders tab sends it
const startOfLocalDay = '2026-11-18T00:00:00.000+0200';
const endOfLocalDay = '2026-11-18T23:59:59.999+0200';

describe('isActivatedWithin', () => {
  it('keeps an order placed just after local midnight, which is the previous day in UTC', () => {
    expect(isActivatedWithin({ dateActivated: '2026-11-17T22:30:00.000+0000' }, startOfLocalDay, endOfLocalDay)).toBe(
      true,
    );
  });

  it('keeps an order placed just before local midnight', () => {
    expect(isActivatedWithin({ dateActivated: '2026-11-18T21:59:59.000+0000' }, startOfLocalDay, endOfLocalDay)).toBe(
      true,
    );
  });

  it('drops the orders the server adds by rounding the bounds out to whole days of its time zone', () => {
    expect(isActivatedWithin({ dateActivated: '2026-11-17T21:59:59.000+0000' }, startOfLocalDay, endOfLocalDay)).toBe(
      false,
    );
    expect(isActivatedWithin({ dateActivated: '2026-11-18T22:00:00.000+0000' }, startOfLocalDay, endOfLocalDay)).toBe(
      false,
    );
  });

  it('keeps every order without a period', () => {
    expect(isActivatedWithin({ dateActivated: '2026-11-10T08:00:00.000+0000' }, null, null)).toBe(true);
  });
});

describe('usePatientOrdersInPeriod', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('sends the period URL-encoded and returns only the orders activated within it, newest first', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          { uuid: 'after-local-midnight', dateActivated: '2026-11-17T22:30:00.000+0000' },
          { uuid: 'previous-local-day', dateActivated: '2026-11-17T21:00:00.000+0000' },
          { uuid: 'local-midday', dateActivated: '2026-11-18T10:00:00.000+0000' },
        ],
      },
    } as never);

    const { result } = renderHook(() =>
      usePatientOrdersInPeriod('patient-uuid', 'order-type-uuid', startOfLocalDay, endOfLocalDay),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    const url = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(url).toContain('/order?patient=patient-uuid&');
    expect(url).toContain('activatedOnOrAfterDate=2026-11-18T00%3A00%3A00.000%2B0200');
    expect(url).toContain('activatedOnOrBeforeDate=2026-11-18T23%3A59%3A59.999%2B0200');
    expect(url).toContain('excludeCanceledAndExpired=true');
    expect(url).toContain('&orderTypes=order-type-uuid');
    expect(result.current.data.map((order) => order.uuid)).toEqual(['local-midday', 'after-local-midnight']);
  });

  it('asks for the active orders without a period', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as never);

    renderHook(() => usePatientOrdersInPeriod('patient-uuid', null, null, null));

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    const url = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(url).toContain('status=ACTIVE');
    expect(url).not.toContain('activatedOnOrAfterDate');
    expect(url).not.toContain('orderTypes');
  });
});
