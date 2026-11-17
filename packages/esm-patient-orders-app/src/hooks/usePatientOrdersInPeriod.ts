import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  careSettingUuid,
  type Order,
  orderCustomRepresentation,
  type PatientOrderFetchResponse,
  useMutatePatientOrders,
} from '@openmrs/esm-patient-common-lib';

/**
 * The Orders tab's copy of `usePatientOrders` from `@openmrs/esm-patient-common-lib`, for a period given
 * as two instants with their UTC offset, e.g. 2026-11-18T00:00:00.000+0200 (UVL-EMR #760).
 *
 * The period was sent as date-only strings, which OpenMRS reads as days of the server's time zone (UTC):
 * in Burundi (UTC+2) the orders placed between 00:00 and 02:00 local time fell outside « today ». The
 * bounds are now URL-encoded instants. OpenMRS still rounds activatedOnOrAfterDate down and
 * activatedOnOrBeforeDate up to whole days of its time zone, so its answer can hold orders from either
 * side of the period: only the orders activated within it are kept.
 *
 * It lives in this app on purpose. `@openmrs/esm-patient-common-lib` is a shared (singleton) module
 * across the patient-chart apps, so at runtime this app gets whichever app's copy loaded first, not the
 * one it was built with (see `../order-basket/post-order-encounter.ts`).
 */
export function usePatientOrdersInPeriod(
  patientUuid: string,
  orderType: string | null,
  startDate: string | null,
  endDate: string | null,
) {
  const { mutate } = useMutatePatientOrders(patientUuid);
  // Without a period, the active orders, as the shared hook does
  const baseOrdersUrl =
    startDate && endDate
      ? `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&v=${orderCustomRepresentation}&activatedOnOrAfterDate=${encodeURIComponent(startDate)}&activatedOnOrBeforeDate=${encodeURIComponent(endDate)}&excludeDiscontinueOrders=true&excludeCanceledAndExpired=true`
      : `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&v=${orderCustomRepresentation}&status=ACTIVE&excludeDiscontinueOrders=true`;
  const ordersUrl = orderType ? `${baseOrdersUrl}&orderTypes=${orderType}` : baseOrdersUrl;

  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<PatientOrderFetchResponse>, Error>(
    patientUuid ? ordersUrl : null,
    openmrsFetch,
  );

  const orders = useMemo(
    () =>
      data?.data?.results
        ? data.data.results
            .filter((order) => isActivatedWithin(order, startDate, endDate))
            .sort((a, b) => toTime(b.dateActivated) - toTime(a.dateActivated))
        : null,
    [data, startDate, endDate],
  );

  return {
    data: orders,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

/** Whether an order was activated within [startDate, endDate]; without a period, or an unreadable date, it is kept. */
export function isActivatedWithin(
  order: Pick<Order, 'dateActivated'>,
  startDate: string | null,
  endDate: string | null,
) {
  const activated = toTime(order.dateActivated);
  const start = toTime(startDate);
  const end = toTime(endDate);
  if ([activated, start, end].some(Number.isNaN)) {
    return true;
  }
  return activated >= start && activated <= end;
}

// OpenMRS writes offsets as "+0200", which not every Date parser takes; "+02:00" it does
function toTime(value: string | null | undefined) {
  return value ? new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).getTime() : NaN;
}
