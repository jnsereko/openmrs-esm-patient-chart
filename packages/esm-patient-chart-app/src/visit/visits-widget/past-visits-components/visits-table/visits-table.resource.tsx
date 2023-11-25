import { FetchResponse, OpenmrsResource, openmrsFetch } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';

export function deleteEncounter(encounterUuid: string, abortController: AbortController) {
  return openmrsFetch(`/ws/rest/v1/encounter/${encounterUuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

export function useEncounterTypesToExclude(encounterUuids: Array<string>) {
  if (!encounterUuids || encounterUuids.length === 0) {
    return { isLoading: false, excludedEncounterTypes: [], error: null };
  }
  const getUrl = useCallback(
    (index) => {
      if (encounterUuids && index < encounterUuids.length) {
        return `/ws/rest/v1/encountertype/${encounterUuids[index]}?v=full`;
      }
      return null;
    },
    [encounterUuids],
  );
  const { data, error, isLoading } = useSWRInfinite<FetchResponse<OpenmrsResource>>(
    (index) => {
      if (encounterUuids && index < encounterUuids.length) {
        return `/ws/rest/v1/encountertype/${encounterUuids[index]}?v=full`;
      }
      return null;
    },
    openmrsFetch,
    {
      initialSize: encounterUuids?.length ?? 1,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const results = useMemo(() => {
    const excludedEncounterTypes: Array<OpenmrsResource> = data ? [].concat(data?.map((resp) => resp.data)) : null;
    return {
      excludedEncounterTypes: excludedEncounterTypes
        ? excludedEncounterTypes.filter((encounterType) => encounterType.display)
        : null,
      isLoading: encounterUuids?.length === 0 ? false : isLoading,
      error: error,
    };
  }, [data, encounterUuids, isLoading]);

  return results;
}
