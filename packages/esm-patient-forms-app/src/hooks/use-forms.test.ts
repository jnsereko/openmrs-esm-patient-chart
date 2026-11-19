import React from 'react';
import { SWRConfig } from 'swr';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, useSession } from '@openmrs/esm-framework';
import {
  configSchema,
  type FormEntryConfigSchema,
  type FormSexRestriction,
  type FormVisitTypeRestriction,
} from '../config-schema';
import { isFormAllowedForPatientSex, isFormAllowedForVisitType, useForms } from './use-forms';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig<FormEntryConfigSchema>);
const mockUseSession = vi.mocked(useSession);

const outpatientVisitTypeUuid = '7b0f5697-27e3-40c4-8bae-f4049abfb4ed';
const inpatientVisitTypeUuid = 'a73e2ac6-263b-47fc-99fc-e0f2c09fc914';

const outpatientForm = {
  uuid: '11111111-1111-1111-1111-111111111111',
  name: 'Outpatient Consultation',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
};
const inpatientForm = {
  uuid: '22222222-2222-2222-2222-222222222222',
  name: 'Inpatient Admission',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
};
const vitalsForm = {
  uuid: '33333333-3333-3333-3333-333333333333',
  name: 'Vitals',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
};

const restrictions: Array<FormVisitTypeRestriction> = [
  { form: outpatientForm.uuid, visitTypes: [outpatientVisitTypeUuid] },
  { form: inpatientForm.name, visitTypes: [inpatientVisitTypeUuid] },
];

describe('isFormAllowedForVisitType', () => {
  it('allows every form when no restrictions are configured', () => {
    expect(isFormAllowedForVisitType(outpatientForm, inpatientVisitTypeUuid, [])).toBe(true);
    expect(isFormAllowedForVisitType(outpatientForm, inpatientVisitTypeUuid, undefined)).toBe(true);
  });

  it('allows every form when there is no visit type (no active visit)', () => {
    expect(isFormAllowedForVisitType(outpatientForm, undefined, restrictions)).toBe(true);
    expect(isFormAllowedForVisitType(inpatientForm, undefined, restrictions)).toBe(true);
  });

  it('allows a form that is not listed on any visit type', () => {
    expect(isFormAllowedForVisitType(vitalsForm, outpatientVisitTypeUuid, restrictions)).toBe(true);
    expect(isFormAllowedForVisitType(vitalsForm, inpatientVisitTypeUuid, restrictions)).toBe(true);
  });

  it('matches restricted forms by UUID', () => {
    expect(isFormAllowedForVisitType(outpatientForm, outpatientVisitTypeUuid, restrictions)).toBe(true);
    expect(isFormAllowedForVisitType(outpatientForm, inpatientVisitTypeUuid, restrictions)).toBe(false);
  });

  it('matches restricted forms by name', () => {
    expect(isFormAllowedForVisitType(inpatientForm, inpatientVisitTypeUuid, restrictions)).toBe(true);
    expect(isFormAllowedForVisitType(inpatientForm, outpatientVisitTypeUuid, restrictions)).toBe(false);
  });

  it('combines the visit types of all entries for the same form', () => {
    const splitRestrictions: Array<FormVisitTypeRestriction> = [
      { form: outpatientForm.uuid, visitTypes: [outpatientVisitTypeUuid] },
      { form: outpatientForm.name, visitTypes: [inpatientVisitTypeUuid] },
    ];

    expect(isFormAllowedForVisitType(outpatientForm, inpatientVisitTypeUuid, splitRestrictions)).toBe(true);
  });
});

const antenatalForm = {
  uuid: '44444444-4444-4444-4444-444444444444',
  name: 'Antenatal Consultation',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
};
const deliveryForm = {
  uuid: '55555555-5555-5555-5555-555555555555',
  name: 'Delivery Registration',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
};

const sexRestrictions: Array<FormSexRestriction> = [
  { form: antenatalForm.uuid, sexes: ['female'] },
  { form: deliveryForm.name, sexes: ['female'] },
];

describe('isFormAllowedForPatientSex', () => {
  it('allows every form when no restrictions are configured', () => {
    expect(isFormAllowedForPatientSex(antenatalForm, 'male', [])).toBe(true);
    expect(isFormAllowedForPatientSex(antenatalForm, 'male', undefined)).toBe(true);
  });

  it('allows a form that is not listed for every patient', () => {
    expect(isFormAllowedForPatientSex(vitalsForm, 'male', sexRestrictions)).toBe(true);
    expect(isFormAllowedForPatientSex(vitalsForm, 'female', sexRestrictions)).toBe(true);
  });

  it('matches restricted forms by UUID', () => {
    expect(isFormAllowedForPatientSex(antenatalForm, 'female', sexRestrictions)).toBe(true);
    expect(isFormAllowedForPatientSex(antenatalForm, 'male', sexRestrictions)).toBe(false);
  });

  it('matches restricted forms by name', () => {
    expect(isFormAllowedForPatientSex(deliveryForm, 'female', sexRestrictions)).toBe(true);
    expect(isFormAllowedForPatientSex(deliveryForm, 'male', sexRestrictions)).toBe(false);
  });

  it('allows every form when the sex of the patient is other, unknown or not recorded', () => {
    expect(isFormAllowedForPatientSex(antenatalForm, 'other', sexRestrictions)).toBe(true);
    expect(isFormAllowedForPatientSex(antenatalForm, 'unknown', sexRestrictions)).toBe(true);
    expect(isFormAllowedForPatientSex(antenatalForm, undefined, sexRestrictions)).toBe(true);
  });

  it('combines the sexes of all entries for the same form', () => {
    const splitRestrictions: Array<FormSexRestriction> = [
      { form: antenatalForm.uuid, sexes: ['female'] },
      { form: antenatalForm.name, sexes: ['male'] },
    ];

    expect(isFormAllowedForPatientSex(antenatalForm, 'male', splitRestrictions)).toBe(true);
  });
});

describe('useForms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ authenticated: true, sessionId: 'session-id' } as ReturnType<typeof useSession>);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      htmlFormEntryForms: [],
      formVisitTypeRestrictions: restrictions,
    } as FormEntryConfigSchema);
    mockOpenmrsFetch.mockImplementation((url: string) => {
      if (url.includes('/form?')) {
        return Promise.resolve({ data: { results: [outpatientForm, inpatientForm, vitalsForm] } }) as never;
      }
      return Promise.resolve({ data: { results: [] } }) as never;
    });
  });

  it('offers only the forms allowed on the active visit type', async () => {
    const { result } = renderHook(() =>
      useForms('patient-uuid', 'visit-uuid', undefined, undefined, 'name', inpatientVisitTypeUuid),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data.map((formInfo) => formInfo.form.name)).toEqual(['Inpatient Admission', 'Vitals']);
  });

  it('offers every form when there is no active visit', async () => {
    const { result } = renderHook(() => useForms('patient-uuid', undefined, undefined, undefined, 'name'));

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data.map((formInfo) => formInfo.form.name)).toEqual([
      'Inpatient Admission',
      'Outpatient Consultation',
      'Vitals',
    ]);
  });

  describe('with forms restricted by the sex of the patient', () => {
    // the list of forms is cached by SWR under a key that is the same for every patient
    const freshSwrCache = ({ children }: { children: React.ReactNode }) =>
      React.createElement(SWRConfig, { value: { dedupingInterval: 0, provider: () => new Map() } }, children);

    beforeEach(() => {
      mockUseConfig.mockReturnValue({
        ...getDefaultsFromConfigSchema(configSchema),
        htmlFormEntryForms: [],
        formVisitTypeRestrictions: restrictions,
        formSexRestrictions: sexRestrictions,
      } as FormEntryConfigSchema);
      mockOpenmrsFetch.mockImplementation((url: string) => {
        if (url.includes('/form?')) {
          return Promise.resolve({
            data: { results: [outpatientForm, inpatientForm, vitalsForm, antenatalForm, deliveryForm] },
          }) as never;
        }
        return Promise.resolve({ data: { results: [] } }) as never;
      });
    });

    it('does not offer female-only forms for a male patient', async () => {
      const { result } = renderHook(
        () => useForms('patient-uuid', undefined, undefined, undefined, 'name', undefined, 'male'),
        { wrapper: freshSwrCache },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data.map((formInfo) => formInfo.form.name)).toEqual([
        'Inpatient Admission',
        'Outpatient Consultation',
        'Vitals',
      ]);
    });

    it('offers female-only forms for a female patient', async () => {
      const { result } = renderHook(
        () => useForms('patient-uuid', undefined, undefined, undefined, 'name', undefined, 'female'),
        { wrapper: freshSwrCache },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data.map((formInfo) => formInfo.form.name)).toEqual([
        'Antenatal Consultation',
        'Delivery Registration',
        'Inpatient Admission',
        'Outpatient Consultation',
        'Vitals',
      ]);
    });

    it('offers every form when the sex of the patient is not known', async () => {
      const { result } = renderHook(
        () => useForms('patient-uuid', undefined, undefined, undefined, 'name', undefined, 'unknown'),
        { wrapper: freshSwrCache },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data).toHaveLength(5);
    });

    it('applies the visit type restriction together with the sex restriction', async () => {
      const { result } = renderHook(
        () => useForms('patient-uuid', 'visit-uuid', undefined, undefined, 'name', inpatientVisitTypeUuid, 'male'),
        { wrapper: freshSwrCache },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data.map((formInfo) => formInfo.form.name)).toEqual(['Inpatient Admission', 'Vitals']);
    });
  });
});
