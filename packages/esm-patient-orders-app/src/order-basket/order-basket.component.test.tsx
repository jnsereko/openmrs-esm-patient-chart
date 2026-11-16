import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type LayoutType, useSession, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { useOrderBasket, useMutatePatientOrders, postOrdersOnNewEncounter } from '@openmrs/esm-patient-common-lib';
import { mockSessionDataResponse } from '__mocks__';
import { getVisitDates, useOrderEncounterForSystemWithVisitDisabled, useProviders } from '../api/api';
import OrderBasket from './order-basket.component';

const mockUseSession = vi.mocked(useSession);
const mockUseConfig = vi.mocked(useConfig);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseOrderBasket = vi.mocked(useOrderBasket);
const mockUseMutatePatientOrders = vi.mocked(useMutatePatientOrders);
const mockUseOrderEncounterForSystemWithVisitDisabled = vi.mocked(useOrderEncounterForSystemWithVisitDisabled);
const mockUseProviders = vi.mocked(useProviders);
const mockGetVisitDates = vi.mocked(getVisitDates);
const mockPostOrdersOnNewEncounter = vi.mocked(postOrdersOnNewEncounter);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...((await vi.importActual('@openmrs/esm-patient-common-lib')) as object),
  useOrderBasket: vi.fn(),
  useMutatePatientOrders: vi.fn(),
  postOrdersOnNewEncounter: vi.fn(),
}));

vi.mock('../api/api', () => ({
  getVisitDates: vi.fn(),
  useOrderEncounterForSystemWithVisitDisabled: vi.fn(),
  useProviders: vi.fn(),
}));

const mockPatientUuid = 'patient-uuid-123';
const mockPatient = {
  id: mockPatientUuid,
  resourceType: 'Patient',
} as fhir.Patient;

const mockVisitContext = {
  uuid: 'visit-uuid-123',
  visitType: { display: 'Facility Visit' },
} as any;

const mockCloseWorkspace = vi.fn(() => Promise.resolve(true));

const mockOrderBasketExtensionProps = {
  patient: mockPatient,
  launchDrugOrderForm: vi.fn(),
  launchLabOrderForm: vi.fn(),
  launchGeneralOrderForm: vi.fn(),
};

const defaultMockConfig = {
  orderTypes: [],
  orderEncounterType: 'order-encounter-type',
  ordererProviderRoles: [],
  orderLocationTagName: null,
};

describe('OrderBasket', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseLayoutType.mockReturnValue('desktop' as LayoutType);
    mockUseConfig.mockReturnValue(defaultMockConfig);
    mockUseOrderBasket.mockReturnValue({
      orders: [],
      clearOrders: vi.fn(),
      setOrders: vi.fn(),
    } as any);
    mockUseMutatePatientOrders.mockReturnValue({
      mutate: vi.fn(),
    } as any);
    mockUseOrderEncounterForSystemWithVisitDisabled.mockReturnValue({
      visitRequired: false,
      isLoading: false,
      encounterUuid: null,
      error: null,
      mutate: vi.fn(),
    } as any);
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      error: null,
    } as any);
  });

  it('should render without crashing when currentProvider is null', () => {
    mockUseSession.mockReturnValue({ ...mockSessionDataResponse.data, currentProvider: null } as any);

    render(
      <OrderBasket
        patientUuid={mockPatientUuid}
        patient={mockPatient}
        visitContext={mockVisitContext}
        closeWorkspace={mockCloseWorkspace}
        orderBasketExtensionProps={mockOrderBasketExtensionProps}
      />,
    );

    expect(screen.getByText('Order Basket')).toBeInTheDocument();
  });

  it('should render normally when currentProvider exists', () => {
    mockUseSession.mockReturnValue(mockSessionDataResponse.data as any);

    render(
      <OrderBasket
        patientUuid={mockPatientUuid}
        patient={mockPatient}
        visitContext={mockVisitContext}
        closeWorkspace={mockCloseWorkspace}
        orderBasketExtensionProps={mockOrderBasketExtensionProps}
      />,
    );

    expect(screen.getByText('Order Basket')).toBeInTheDocument();
  });

  describe('when the visit was ended while the basket was open', () => {
    const openVisit = {
      ...mockVisitContext,
      startDatetime: '2026-11-15T08:00:00.000+0200',
      stopDatetime: null,
    };
    const stopDatetime = '2026-11-15T23:59:59.000+0200';

    beforeEach(() => {
      mockUseSession.mockReturnValue(mockSessionDataResponse.data as any);
      mockUseOrderBasket.mockReturnValue({
        orders: [{ display: 'Paracetamol', action: 'NEW', isOrderIncomplete: false }],
        clearOrders: vi.fn(),
        setOrders: vi.fn(),
      } as any);
      mockUseOrderEncounterForSystemWithVisitDisabled.mockReturnValue({
        visitRequired: true,
        isLoading: false,
        encounterUuid: null,
        error: null,
        mutate: vi.fn(),
      } as any);
      mockPostOrdersOnNewEncounter.mockResolvedValue({ uuid: 'encounter-uuid', orders: [] } as any);
    });

    function renderBasket() {
      render(
        <OrderBasket
          patientUuid={mockPatientUuid}
          patient={mockPatient}
          visitContext={openVisit}
          closeWorkspace={mockCloseWorkspace}
          orderBasketExtensionProps={mockOrderBasketExtensionProps}
        />,
      );
    }

    it('says the visit has ended and keeps the basket, then saves the orders in that visit when signed again', async () => {
      const user = userEvent.setup();
      mockGetVisitDates.mockResolvedValue({
        uuid: openVisit.uuid,
        startDatetime: openVisit.startDatetime,
        stopDatetime,
      });
      renderBasket();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(await screen.findByText('This visit has ended')).toBeInTheDocument();
      expect(mockPostOrdersOnNewEncounter).not.toHaveBeenCalled();
      expect(mockCloseWorkspace).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(mockPostOrdersOnNewEncounter).toHaveBeenCalledTimes(1);
      // the ended visit is passed on, so the encounter is dated inside it
      expect(mockPostOrdersOnNewEncounter.mock.calls[0][2]).toEqual(
        expect.objectContaining({ uuid: openVisit.uuid, stopDatetime }),
      );
      expect(mockCloseWorkspace).toHaveBeenCalled();
    });

    it('signs in one step while the visit is still open', async () => {
      const user = userEvent.setup();
      mockGetVisitDates.mockResolvedValue({
        uuid: openVisit.uuid,
        startDatetime: openVisit.startDatetime,
        stopDatetime: null,
      });
      renderBasket();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(mockPostOrdersOnNewEncounter).toHaveBeenCalledTimes(1);
      expect(mockPostOrdersOnNewEncounter.mock.calls[0][2]).toBe(openVisit);
      expect(screen.queryByText('This visit has ended')).not.toBeInTheDocument();
    });
  });
});
