import dayjs from 'dayjs';
import useSWR from 'swr';
import {
  interpolateUrl,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import type { FormEntryConfigSchema, FormSexRestriction, FormVisitTypeRestriction } from '../config-schema';
import type { ListResponse, Form, EncounterWithFormRef, CompletedFormInfo } from '../types';
import {
  customEncounterRepresentation,
  customFormRepresentation,
  formEncounterUrl,
  formEncounterUrlPoc,
} from '../constants';

function useCustomFormsUrl(patientUuid: string, visitUuid: string) {
  const { customFormsUrl, showHtmlFormEntryForms } = useConfig<FormEntryConfigSchema>();
  const hasCustomFormsUrl = Boolean(customFormsUrl);

  const baseUrl = hasCustomFormsUrl ? customFormsUrl : showHtmlFormEntryForms ? formEncounterUrl : formEncounterUrlPoc;

  const url = interpolateUrl(baseUrl, {
    patientUuid: patientUuid,
    visitUuid: visitUuid,
    representation: customFormRepresentation,
  });

  return {
    url,
    hasCustomFormsUrl,
  };
}

export function useFormEncounters(patientUuid: string = '', visitUuid: string = '') {
  const { url, hasCustomFormsUrl } = useCustomFormsUrl(patientUuid, visitUuid);

  return useSWR([url], async () => {
    const res = await openmrsFetch<ListResponse<Form>>(url);
    // show published forms and hide component forms
    return hasCustomFormsUrl
      ? res?.data.results
      : res.data?.results?.filter((form) => form.published && !/component/i.test(form.name)) ?? [];
  });
}

export function useEncountersWithFormRef(
  patientUuid: string,
  startDate: Date = dayjs(new Date()).startOf('day').subtract(500, 'day').toDate(),
  endDate: Date = dayjs(new Date()).endOf('day').toDate(),
) {
  const url = patientUuid
    ? `${restBaseUrl}/encounter?v=${customEncounterRepresentation}&patient=${patientUuid}&fromdate=${startDate.toISOString()}&todate=${endDate.toISOString()}`
    : null;
  return useSWR(url, openmrsFetch<ListResponse<EncounterWithFormRef>>);
}

// December 31, 1969; hopefully we don't have encounters before that
const MINIMUM_DATE = new Date(0);

/**
 * Returns whether a form may be offered on a visit of the given visit type, according to the
 * `formVisitTypeRestrictions` config. A form that is not listed there is always allowed, and so is every
 * form when there is no visit type (no active visit).
 */
export function isFormAllowedForVisitType(
  form: Pick<Form, 'uuid' | 'name'>,
  visitTypeUuid: string | undefined,
  restrictions: Array<FormVisitTypeRestriction> = [],
) {
  if (!visitTypeUuid) {
    return true;
  }

  const restrictionsForForm = restrictions.filter(
    (restriction) => restriction.form === form?.uuid || restriction.form === form?.name,
  );

  if (restrictionsForForm.length === 0) {
    return true;
  }

  return restrictionsForForm.some((restriction) => restriction.visitTypes?.includes(visitTypeUuid));
}

/**
 * Returns whether a form may be offered for a patient of the given sex (the FHIR `gender` of the patient),
 * according to the `formSexRestrictions` config. A form that is not listed there is always allowed, and so is
 * every form when the sex of the patient is neither male nor female (other, unknown or not recorded).
 */
export function isFormAllowedForPatientSex(
  form: Pick<Form, 'uuid' | 'name'>,
  patientSex: string | undefined,
  restrictions: Array<FormSexRestriction> = [],
) {
  if (patientSex !== 'male' && patientSex !== 'female') {
    return true;
  }

  const restrictionsForForm = restrictions.filter(
    (restriction) => restriction.form === form?.uuid || restriction.form === form?.name,
  );

  if (restrictionsForForm.length === 0) {
    return true;
  }

  return restrictionsForForm.some((restriction) => restriction.sexes?.includes(patientSex));
}

export function useForms(
  patientUuid: string,
  visitUuid?: string,
  startDate?: Date,
  endDate?: Date,
  orderBy: 'name' | 'most-recent' = 'name',
  visitTypeUuid?: string,
  patientSex?: string,
) {
  const { formVisitTypeRestrictions, formSexRestrictions } = useConfig<FormEntryConfigSchema>();
  const allFormsRes = useFormEncounters(patientUuid, visitUuid);
  const encountersRes = useEncountersWithFormRef(patientUuid, startDate, endDate);
  const pastEncounters = encountersRes.data?.data?.results ?? [];
  const data = allFormsRes.data ? mapToFormCompletedInfo(allFormsRes.data, pastEncounters) : undefined;
  const session = useSession();

  const mutateForms = () => {
    allFormsRes.mutate();
    encountersRes.mutate();
  };
  let formsToDisplay = data;

  if (session?.user) {
    formsToDisplay = formsToDisplay?.filter((formInfo) =>
      userHasAccess(formInfo?.form?.encounterType?.editPrivilege?.display, session.user),
    );
  }

  if (formVisitTypeRestrictions?.length) {
    formsToDisplay = formsToDisplay?.filter((formInfo) =>
      isFormAllowedForVisitType(formInfo.form, visitTypeUuid, formVisitTypeRestrictions),
    );
  }

  if (formSexRestrictions?.length) {
    formsToDisplay = formsToDisplay?.filter((formInfo) =>
      isFormAllowedForPatientSex(formInfo.form, patientSex, formSexRestrictions),
    );
  }

  if (orderBy === 'name') {
    formsToDisplay?.sort((formInfo1, formInfo2) =>
      (formInfo1.form.display ?? formInfo1.form.name).localeCompare(formInfo2.form.display ?? formInfo2.form.name),
    );
  } else {
    formsToDisplay?.sort(
      (formInfo1, formInfo2) =>
        (formInfo1.lastCompletedDate ?? MINIMUM_DATE).getDate() -
        (formInfo2.lastCompletedDate ?? MINIMUM_DATE).getDate(),
    );
  }

  return {
    data: formsToDisplay,
    error: allFormsRes.error,
    isValidating: allFormsRes.isValidating || encountersRes.isValidating,
    mutateForms,
  };
}

function mapToFormCompletedInfo(
  allForms: Array<Form>,
  encounters: Array<EncounterWithFormRef>,
): Array<CompletedFormInfo> {
  return allForms.map((form) => {
    const associatedEncounters = encounters.filter((encounter) => encounter.form?.uuid === form?.uuid);
    const lastCompletedDate =
      associatedEncounters.length > 0
        ? new Date(Math.max(...associatedEncounters.map((e) => new Date(e.encounterDatetime).getTime())))
        : undefined;

    return {
      form,
      associatedEncounters,
      lastCompletedDate,
    };
  });
}
