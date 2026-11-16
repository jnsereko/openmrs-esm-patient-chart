import {
  type Encounter,
  getGlobalStore,
  openmrsFetch,
  parseDate,
  restBaseUrl,
  toOmrsIsoString,
  type Visit,
} from '@openmrs/esm-framework';
import type { EncounterPost, OrderBasketItem, OrderPost, PostDataPrepFunction } from '@openmrs/esm-patient-common-lib';

/**
 * The order basket's copy of `postOrdersOnNewEncounter` from `@openmrs/esm-patient-common-lib`,
 * which also records the orderer as the encounter's provider.
 *
 * It lives in this app on purpose. `@openmrs/esm-patient-common-lib` is a shared (singleton) module
 * across the patient-chart apps, so at runtime the order basket gets whichever app's copy loaded
 * first, not the one it was built with: a change made there does not reach it unless every
 * patient-chart app is rebuilt with it. The basket is read from the shared `order-basket` global
 * store, as the shared function does.
 */
interface OrderBasketStore {
  items: { [patientUuid: string]: { [grouping: string]: Array<OrderBasketItem> } };
  postDataPrepFunctions: { [grouping: string]: PostDataPrepFunction };
}

function getOrdersPayloadFromOrderBasket(patientUuid: string, ordererUuid: string): Array<OrderPost> {
  const { items, postDataPrepFunctions } = getGlobalStore<OrderBasketStore>('order-basket', {
    items: {},
    postDataPrepFunctions: {},
  }).getState();
  const patientItems = items[patientUuid];

  if (!patientItems) {
    return [];
  }

  const orders: Array<OrderPost> = [];
  Object.entries(patientItems).forEach(([grouping, groupOrders]) => {
    groupOrders.forEach((order) => {
      orders.push(postDataPrepFunctions[grouping](order, patientUuid, null, ordererUuid));
    });
  });

  return orders;
}

function assertValidDate(date: Date, rawValue: string): Date {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Cannot post orders: "${rawValue}" is not a valid date.`);
  }
  return date;
}

function earliestDateActivated(orders: ReadonlyArray<OrderPost>): Date | undefined {
  let earliest: Date | undefined;
  for (const order of orders) {
    if (!order.dateActivated) {
      continue;
    }
    const dateActivated = assertValidDate(new Date(order.dateActivated), order.dateActivated);
    if (!earliest || dateActivated < earliest) {
      earliest = dateActivated;
    }
  }
  return earliest;
}

export async function postOrdersOnNewEncounter(
  patientUuid: string,
  orderEncounterType: string,
  currentVisit: Visit | null,
  orderLocationUuid: string,
  ordererUuid: string,
  abortController?: AbortController,
  ordererEncounterRoleUuid?: string,
) {
  const orders = getOrdersPayloadFromOrderBasket(patientUuid, ordererUuid);

  // The backend enforces `dateActivated >= encounterDatetime`, so the encounter must sit at or
  // before the earliest explicitly-requested order activation. Orders without a `dateActivated`
  // are "start now": in a real-time (open) visit we leave encounterDatetime unset too, so the
  // server stamps the encounter and those orders at the same request-time clock.
  let encounterDatetime = earliestDateActivated(orders);

  // A stopped (retrospective) visit ended in the past, so the server's "now" would fall outside
  // the visit window. Pin the encounter to the visit start when nothing else set it.
  const isRetrospective = Boolean(currentVisit?.stopDatetime);
  if (!encounterDatetime && isRetrospective) {
    encounterDatetime = assertValidDate(parseDate(currentVisit.startDatetime), currentVisit.startDatetime);
  }

  // Clamp to the visit window so Encounter.datetimeShouldBeInVisitDatesRange holds at both ends.
  if (encounterDatetime && currentVisit?.startDatetime) {
    const visitStart = assertValidDate(parseDate(currentVisit.startDatetime), currentVisit.startDatetime);
    if (encounterDatetime < visitStart) {
      encounterDatetime = visitStart;
    }
  }
  if (encounterDatetime && currentVisit?.stopDatetime) {
    const visitStop = assertValidDate(parseDate(currentVisit.stopDatetime), currentVisit.stopDatetime);
    if (encounterDatetime > visitStop) {
      encounterDatetime = visitStop;
    }
  }

  if (encounterDatetime) {
    const encounterDateActivated = toOmrsIsoString(encounterDatetime);
    for (const order of orders) {
      if (order.dateActivated) {
        // Keep explicit start dates, but raise any that clamping pushed below the encounter.
        if (new Date(order.dateActivated) < encounterDatetime) {
          order.dateActivated = encounterDateActivated;
        }
      } else if (isRetrospective && !order.scheduledDate) {
        // "Start now" orders in a closed visit must be pinned to the encounter datetime; otherwise
        // the server would stamp them at real-time now, outside the visit window.
        order.dateActivated = encounterDateActivated;
      }
    }
  }

  const encounterPostData: EncounterPost & {
    encounterProviders?: Array<{ provider: string; encounterRole: string }>;
  } = {
    patient: patientUuid,
    location: orderLocationUuid,
    encounterType: orderEncounterType,
    // Only send encounterDatetime when we need a specific time; otherwise let the server default it
    // to now (EncounterResource.newDelegate() stamps the request-time server clock).
    ...(encounterDatetime ? { encounterDatetime } : {}),
    visit: currentVisit?.uuid,
    // The orderer is the encounter's provider, so the encounter does not read "No provider"
    ...(ordererUuid && ordererEncounterRoleUuid
      ? { encounterProviders: [{ provider: ordererUuid, encounterRole: ordererEncounterRoleUuid }] }
      : {}),
    obs: [],
    orders,
  };

  return openmrsFetch<Encounter>(`${restBaseUrl}/encounter`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: encounterPostData,
    signal: abortController?.signal,
  }).then((res) => res?.data);
}
