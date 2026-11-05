import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, useSession } from '@openmrs/esm-framework';
import { configSchema, type FormEntryConfigSchema, type FormVisitTypeRestriction } from '../config-schema';
import { isFormAllowedForVisitType, useForms } from './use-forms';

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
});
