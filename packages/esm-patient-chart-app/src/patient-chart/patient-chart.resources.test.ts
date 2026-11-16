import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { launchWorkspaceGroup2, openmrsFetch, usePatient, useVisit, type Visit } from '@openmrs/esm-framework';
import {
  invalidateVisits,
  setPatientChartWorkspaceGroupVisitUuid,
  usePatientChartStore,
} from '@openmrs/esm-patient-common-lib';
import { mockFhirPatient } from '__mocks__';
import {
  openVisitContextRefreshIntervalMs,
  usePatientChartPatientAndVisit,
  visitContextRefreshInterval,
} from './patient-chart.resources';

// TODO: remove once openmrs-esm-core ships launchWorkspaceGroup2 in the framework mock
vi.mock('@openmrs/esm-framework', async () => {
  const actual = (await vi.importActual('@openmrs/esm-framework')) as object;
  return { ...actual, launchWorkspaceGroup2: vi.fn() };
});

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  invalidateVisits: vi.fn(),
  setPatientChartWorkspaceGroupVisitUuid: vi.fn(),
  usePatientChartStore: vi.fn(),
}));

const mockLaunchWorkspaceGroup = vi.mocked(launchWorkspaceGroup2);
const mockUsePatient = vi.mocked(usePatient);
const mockUseVisit = vi.mocked(useVisit);
const mockUsePatientChartStore = vi.mocked(usePatientChartStore);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const mutateVisitContext = vi.fn();
const setPatient = vi.fn();
const setVisitContext = vi.fn();
const setWorkspaceGroupVisitUuid = vi.mocked(setPatientChartWorkspaceGroupVisitUuid);

// The group props the workspace group was launched with are recorded alongside its visit uuid
const groupPropsFor = (visit: Visit) =>
  expect.objectContaining({ visitContext: expect.objectContaining({ uuid: visit.uuid }) });

const visitA = { uuid: 'visit-a', patient: { uuid: mockFhirPatient.id } } as Visit;
const visitB = { uuid: 'visit-b', patient: { uuid: mockFhirPatient.id } } as Visit;
const patientB = { ...mockFhirPatient, id: 'patient-b' };

function mockNoActiveVisitForPatientSwitch() {
  mockUsePatient.mockImplementation((patientUuid) => ({
    isLoading: false,
    patient: patientUuid === patientB.id ? patientB : mockFhirPatient,
    patientUuid,
    error: null,
  }));
  mockUseVisit.mockImplementation(() => ({
    activeVisit: null,
    mutate: mutateVisitContext,
    isValidating: false,
    error: null,
    currentVisit: null,
    currentVisitIsRetrospective: false,
    isLoading: false,
  }));
  mockUsePatientChartStore.mockImplementation((patientUuid) => ({
    patientUuid,
    patient: patientUuid === patientB.id ? patientB : mockFhirPatient,
    visitContext: null,
    mutateVisitContext: null,
    setPatient,
    setVisitContext,
  }));
}

describe('usePatientChartPatientAndVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspaceGroup.mockResolvedValue(true);
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: mockFhirPatient,
      patientUuid: mockFhirPatient.id,
      error: null,
    });
    mockUsePatientChartStore.mockReturnValue({
      patientUuid: mockFhirPatient.id,
      patient: mockFhirPatient,
      visitContext: null,
      mutateVisitContext: null,
      setPatient,
      setVisitContext,
    });
  });

  it('relaunches the patient-chart workspace group when the visit context changes', async () => {
    let activeVisit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patient: mockFhirPatient,
        patientUuid: mockFhirPatient.id,
        visitContext: visitA,
        mutateVisitContext,
      }),
    );

    activeVisit = visitB;
    rerender();

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patient: mockFhirPatient,
        patientUuid: mockFhirPatient.id,
        visitContext: visitB,
        mutateVisitContext,
      }),
    );
  });

  it('records the visit the workspace group was relaunched with', async () => {
    let activeVisit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() =>
      expect(setWorkspaceGroupVisitUuid).toHaveBeenLastCalledWith(visitA.uuid, groupPropsFor(visitA)),
    );
    expect(mockLaunchWorkspaceGroup.mock.invocationCallOrder[0]).toBeLessThan(
      setWorkspaceGroupVisitUuid.mock.invocationCallOrder.at(-1),
    );

    activeVisit = visitB;
    rerender();

    await waitFor(() =>
      expect(setWorkspaceGroupVisitUuid).toHaveBeenLastCalledWith(visitB.uuid, groupPropsFor(visitB)),
    );
  });

  it('does not record a new visit when the workspace group relaunch is declined', async () => {
    let activeVisit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));
    await waitFor(() =>
      expect(setWorkspaceGroupVisitUuid).toHaveBeenLastCalledWith(visitA.uuid, groupPropsFor(visitA)),
    );

    mockLaunchWorkspaceGroup.mockResolvedValueOnce(false);
    activeVisit = visitB;
    rerender();

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(setWorkspaceGroupVisitUuid).toHaveBeenCalledTimes(2));
    expect(setWorkspaceGroupVisitUuid).toHaveBeenLastCalledWith(visitA.uuid, groupPropsFor(visitA));
  });

  it('does not relaunch when the same visit UUID is returned with new object references', async () => {
    let activeVisit: Visit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));

    // Same UUID, new object reference — mimics SWR revalidation
    activeVisit = { ...visitA, stopDatetime: '2026-05-26T00:00:00.000Z' } as Visit;
    rerender();

    // Wait for the effect to fire before asserting the launch count didn't increase
    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);
  });

  it('relaunches when the patient changes and neither patient has an active visit', async () => {
    mockNoActiveVisitForPatientSwitch();

    const { rerender } = renderHook(({ patientUuid }) => usePatientChartPatientAndVisit(patientUuid), {
      initialProps: { patientUuid: mockFhirPatient.id },
    });

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: mockFhirPatient.id, visitContext: null }),
    );

    rerender({ patientUuid: patientB.id });

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: patientB.id, visitContext: null }),
    );
  });

  it('launches the latest patient after a previous launch resolves', async () => {
    let patientUuid = mockFhirPatient.id;
    let resolveFirstLaunch!: (value: boolean) => void;
    const firstLaunch = new Promise<boolean>((resolve) => {
      resolveFirstLaunch = resolve;
    });

    mockLaunchWorkspaceGroup.mockReturnValueOnce(firstLaunch).mockResolvedValue(true);
    mockNoActiveVisitForPatientSwitch();

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(patientUuid));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: mockFhirPatient.id, visitContext: null }),
    );

    patientUuid = patientB.id;
    rerender();

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);

    resolveFirstLaunch(true);

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: patientB.id, visitContext: null }),
    );
  });

  it('launches the latest visit context after a previous launch resolves', async () => {
    let activeVisit = visitA;
    let resolveFirstLaunch!: (value: boolean) => void;
    const firstLaunch = new Promise<boolean>((resolve) => {
      resolveFirstLaunch = resolve;
    });

    mockLaunchWorkspaceGroup.mockReturnValueOnce(firstLaunch).mockResolvedValue(true);
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ visitContext: visitA }),
    );

    activeVisit = visitB;
    rerender();

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);

    resolveFirstLaunch(true);

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ visitContext: visitB }),
    );
  });
});

describe('visitContextRefreshInterval', () => {
  it('polls an open visit and stops once the visit has ended', () => {
    expect(visitContextRefreshInterval({ data: { ...visitA, stopDatetime: null } })).toBe(
      openVisitContextRefreshIntervalMs,
    );
    expect(visitContextRefreshInterval({ data: { ...visitA, stopDatetime: '2026-11-15T23:59:59.000+0200' } })).toBe(0);
    // not fetched yet: SWR schedules the next fetch from this value only
    expect(visitContextRefreshInterval(undefined)).toBe(openVisitContextRefreshIntervalMs);
  });
});

describe('usePatientChartPatientAndVisit when the visit in context is ended elsewhere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspaceGroup.mockResolvedValue(true);
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: mockFhirPatient,
      patientUuid: mockFhirPatient.id,
      error: null,
    });
    mockUseVisit.mockReturnValue({
      activeVisit: null,
      mutate: vi.fn(),
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    });
  });

  it('fetches the visit again and puts the ended visit in context, without relaunching the workspace group', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const openVisit = { ...visitA, startDatetime: '2026-11-15T08:00:00.000+0200', stopDatetime: null };
      const endedVisit = { ...openVisit, stopDatetime: '2026-11-15T23:59:59.000+0200' };
      mockUsePatientChartStore.mockReturnValue({
        patientUuid: mockFhirPatient.id,
        patient: mockFhirPatient,
        visitContext: openVisit,
        mutateVisitContext: null,
        setPatient,
        setVisitContext,
      });
      let serverVisit: Visit = openVisit;
      mockOpenmrsFetch.mockImplementation(async () => ({ data: serverVisit }) as any);

      renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

      await waitFor(() =>
        expect(setVisitContext).toHaveBeenCalledWith(
          expect.objectContaining({ stopDatetime: null }),
          expect.anything(),
        ),
      );
      expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);
      expect(invalidateVisits).not.toHaveBeenCalled();

      // the visit is ended elsewhere (another tab, another user, the nightly visit closing)
      serverVisit = endedVisit;
      await vi.advanceTimersByTimeAsync(openVisitContextRefreshIntervalMs + 1000);

      await waitFor(() =>
        expect(setVisitContext).toHaveBeenLastCalledWith(
          expect.objectContaining({ uuid: visitA.uuid, stopDatetime: endedVisit.stopDatetime }),
          expect.anything(),
        ),
      );
      // same visit: the open workspaces (forms, order basket) are not closed
      expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);
      // and the patient's active visit is looked up again (patient banner, visit lists)
      expect(invalidateVisits).toHaveBeenCalledWith(expect.any(Function), mockFhirPatient.id);
    } finally {
      vi.useRealTimers();
    }
  });
});
