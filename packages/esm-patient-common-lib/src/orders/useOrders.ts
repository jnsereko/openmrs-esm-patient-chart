import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, translateFrom } from '@openmrs/esm-framework';
import type { Order, PatientOrderFetchResponse, PriorityOption } from './types';

export type Status = 'ACTIVE' | 'any';
export const careSettingUuid = '6f0c9a92-6f24-11e3-af88-005056821db0';
const patientChartAppModuleName = '@openmrs/esm-patient-chart-app';

export const drugCustomRepresentation =
  'custom:(uuid,dosingType,orderNumber,accessionNumber,' +
  'patient:ref,action,careSetting:ref,previousOrder:ref,dateActivated,scheduledDate,dateStopped,autoExpireDate,' +
  'orderType:ref,encounter:(uuid,display,visit),orderer:(uuid,display,person:(display)),orderReason,orderReasonNonCoded,orderType,urgency,instructions,' +
  'commentToFulfiller,drug:(uuid,display,strength,dosageForm:(display,uuid),concept),dose,doseUnits:ref,' +
  'frequency:ref,asNeeded,asNeededCondition,quantity,quantityUnits:ref,numRefills,dosingInstructions,' +
  'duration,durationUnits:ref,route:ref,brandName,dispenseAsWritten)';

export const orderCustomRepresentation =
  'custom:(uuid,display,orderNumber,accessionNumber,patient,concept,action,careSetting,previousOrder,dateActivated,scheduledDate,dateStopped,autoExpireDate,encounter:(uuid,display,visit),orderer:ref,orderReason,orderReasonNonCoded,orderType,urgency,instructions,commentToFulfiller,fulfillerStatus)';

/**
 * UVL-EMR #760: the server rounds activatedOnOrAfterDate / activatedOnOrBeforeDate out to whole days in
 * its own time zone, so for datetime bounds its answer can hold orders from either side of them. Keep only
 * the orders activated within the bounds. Date-only bounds are left to the server, as before.
 */
export function isActivatedWithin(order: Pick<Order, 'dateActivated'>, startDate?: string, endDate?: string) {
  const start = parseDateTime(startDate);
  const end = parseDateTime(endDate);
  const activated = parseDateTime(order.dateActivated);
  if (start === null || end === null || activated === null) {
    return true;
  }
  return activated >= start && activated <= end;
}

function parseDateTime(value?: string) {
  if (!value?.includes('T')) {
    return null;
  }
  // OpenMRS writes offsets as "+0200", which not every Date parser takes; "+02:00" it does
  const time = new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).getTime();
  return Number.isNaN(time) ? null : time;
}

export function usePatientOrders(
  patientUuid: string,
  status?: Status,
  orderType?: string,
  startDate?: string,
  endDate?: string,
) {
  const { mutate } = useSWRConfig();
  const activeStatusParams = status === 'ACTIVE' ? '&excludeCanceledAndExpired=true' : '';
  // UVL-EMR #760: the bounds are datetimes with a UTC offset ("+0200"), so they are URL-encoded
  const baseOrdersUrl =
    startDate && endDate
      ? `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&v=${orderCustomRepresentation}&activatedOnOrAfterDate=${encodeURIComponent(startDate)}&activatedOnOrBeforeDate=${encodeURIComponent(endDate)}&excludeDiscontinueOrders=true${activeStatusParams}`
      : `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&v=${orderCustomRepresentation}&status=${status}&excludeDiscontinueOrders=true`;
  const ordersUrl = orderType ? `${baseOrdersUrl}&orderTypes=${orderType}` : baseOrdersUrl;

  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<PatientOrderFetchResponse>, Error>(
    patientUuid ? ordersUrl : null,
    openmrsFetch,
  );

  const mutateOrders = useCallback(
    () =>
      mutate(
        (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?patient=${patientUuid}`),
        undefined,
        { revalidate: true },
      ),
    [mutate, patientUuid],
  );

  const orders = useMemo(
    () =>
      data?.data?.results
        ? [...data.data.results]
            .filter((order) => isActivatedWithin(order, startDate, endDate))
            ?.sort((a, b) => new Date(b.dateActivated).getTime() - new Date(a.dateActivated).getTime())
        : null,
    [data, startDate, endDate],
  );

  return {
    data: orders,
    error,
    isLoading,
    isValidating,
    mutate: mutateOrders,
  };
}

export function getDrugOrderByUuid(orderUuid: string) {
  return openmrsFetch<Order>(`${restBaseUrl}/order/${orderUuid}?v=${drugCustomRepresentation}`);
}

export function useDrugOrderByUuid(orderUuid: string) {
  const { data, error, isLoading } = useSWR<FetchResponse<Order>, Error>(
    orderUuid ? `${restBaseUrl}/order/${orderUuid}?v=${drugCustomRepresentation}` : null,
    openmrsFetch,
  );

  return {
    data: data?.data ?? null,
    error,
    isLoading,
  };
}

// See the Urgency enum in https://github.com/openmrs/openmrs-core/blob/492dcd35b85d48730bd19da48f6db146cc882c22/api/src/main/java/org/openmrs/Order.java
export const priorityOptions: PriorityOption[] = [
  { value: 'ROUTINE', label: translateFrom(patientChartAppModuleName, 'Routine') },
  { value: 'STAT', label: translateFrom(patientChartAppModuleName, 'Stat') },
  { value: 'ON_SCHEDULED_DATE', label: translateFrom(patientChartAppModuleName, 'On scheduled date') },
];
