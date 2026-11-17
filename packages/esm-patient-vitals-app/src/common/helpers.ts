import dayjs from 'dayjs';
import { getLocale, type OpenmrsResource } from '@openmrs/esm-framework';

import { type ConceptMetadata } from '../common';
import type {
  FHIRInterpretation,
  ObsReferenceRanges,
  ObservationInterpretation,
  PatientVitalsAndBiometrics,
} from './types';
import { type VitalsBiometricsFormData } from '../vitals-biometrics-form/schema';
import { type VitalsAndBiometricsFieldValuesMap } from './data.resource';
import { type BiometricsConfigObject } from '../config-schema';

/**
 * A measured value as the session's language writes it: « 36,4 » in French, "36.4" in English. The fields
 * take a dot or a comma (UVL-EMR #719); what is shown follows the session language (UVL-EMR #723). Only the
 * decimal mark changes: the digits are those JavaScript writes, without grouping. A value that is not a number
 * ("--") is returned as it is, and an empty one as undefined so that `??` can supply a placeholder.
 */
export function formatDecimal(value: number | string | null | undefined, locale?: string): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (text === '' || !Number.isFinite(Number(text))) {
    return value as string;
  }
  return text.replace('.', getDecimalSeparator(locale ?? getLocale()));
}

function getDecimalSeparator(locale: string | undefined) {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
  } catch {
    // A language tag Intl does not take
    return '.';
  }
}

export function calculateBodyMassIndex(weight: number, height: number) {
  if (weight > 0 && height > 0) {
    return Number((weight / (height / 100) ** 2).toFixed(1));
  }
  return null;
}

/** The vitals and biometrics shown on their own, each with the interpretation recorded alongside it. */
const singleVitalsKeys = ['pulse', 'temperature', 'spo2', 'respiratoryRate', 'height', 'weight', 'muac'] as const;

/**
 * The latest value of each vital and biometric, whichever encounter recorded it (UVL-EMR #761). `vitals` holds one
 * entry per encounter, newest first, as `useVitalsAndBiometrics` returns them; a form that records only a temperature
 * must not hide the blood pressure, pulse or weight taken a few minutes earlier in another encounter.
 *
 * Each value keeps the interpretation of the encounter that recorded it. Systolic and diastolic are taken together
 * from the latest encounter that has a blood pressure. BMI is that of the encounter with the latest weight, or else
 * is calculated from the latest weight and height. `date` is that of the most recent encounter.
 */
export function getLatestVitalsAndBiometrics(
  vitals: Array<PatientVitalsAndBiometrics> | undefined,
): PatientVitalsAndBiometrics | undefined {
  if (!vitals?.length) {
    return undefined;
  }

  const time = (entry: PatientVitalsAndBiometrics) => {
    const value = new Date(entry.date).getTime();
    return Number.isNaN(value) ? -Infinity : value;
  };
  // Array.prototype.sort is stable, so entries with the same date keep the order they came in
  const newestFirst = [...vitals].sort((a, b) => time(b) - time(a));
  const latestWith = (has: (entry: PatientVitalsAndBiometrics) => boolean) => newestFirst.find(has);

  const latest: PatientVitalsAndBiometrics = {
    id: newestFirst[0].id,
    date: newestFirst[0].date,
    note: newestFirst[0].note,
  };

  for (const key of singleVitalsKeys) {
    const source = latestWith((entry) => entry[key] != null);
    if (source) {
      latest[key] = source[key];
      latest[`${key}RenderInterpretation`] = source[`${key}RenderInterpretation`];
    }
  }

  const bloodPressure = latestWith((entry) => entry.systolic != null || entry.diastolic != null);
  if (bloodPressure) {
    latest.systolic = bloodPressure.systolic;
    latest.diastolic = bloodPressure.diastolic;
    latest.systolicRenderInterpretation = bloodPressure.systolicRenderInterpretation;
    latest.diastolicRenderInterpretation = bloodPressure.diastolicRenderInterpretation;
    latest.bloodPressureRenderInterpretation = bloodPressure.bloodPressureRenderInterpretation;
  }

  const weighed = latestWith((entry) => entry.weight != null);
  if (weighed?.bmi != null) {
    latest.bmi = weighed.bmi;
    latest.bmiRenderInterpretation = weighed.bmiRenderInterpretation;
  } else if (weighed) {
    latest.bmi = calculateBodyMassIndex(Number(latest.weight), Number(latest.height));
  } else {
    const withBmi = latestWith((entry) => entry.bmi != null);
    latest.bmi = withBmi?.bmi ?? null;
    latest.bmiRenderInterpretation = withBmi?.bmiRenderInterpretation;
  }

  return latest;
}

export function assessValue(value: number | undefined, range?: ObsReferenceRanges): ObservationInterpretation {
  if (range && value != null) {
    if (range.hiCritical != null && value >= range.hiCritical) {
      return 'critically_high';
    }

    if (range.hiNormal != null && value > range.hiNormal) {
      return 'high';
    }

    if (range.lowCritical != null && value <= range.lowCritical) {
      return 'critically_low';
    }

    if (range.lowNormal != null && value < range.lowNormal) {
      return 'low';
    }
  }

  return 'normal';
}

export function mapFhirInterpretationToObservationInterpretation(
  interpretation: FHIRInterpretation,
): ObservationInterpretation {
  const normalized = interpretation?.trim();
  switch (normalized) {
    case 'Critically Low':
      return 'critically_low';
    case 'Critically High':
      return 'critically_high';
    case 'High':
      return 'high';
    case 'Low':
      return 'low';
    case 'Normal':
      return 'normal';
    default:
      return 'normal';
  }
}

export function interpretBloodPressure(
  systolic: number | undefined,
  diastolic: number | undefined,
  concepts: { systolicBloodPressureUuid?: string; diastolicBloodPressureUuid?: string } | undefined,
  conceptMetadata: Array<ConceptMetadata> | undefined,
  systolicInterpretation?: ObservationInterpretation,
  diastolicInterpretation?: ObservationInterpretation,
): ObservationInterpretation {
  if (!conceptMetadata) {
    return 'normal';
  }

  // Use interpretation from FHIR Observation when available (preferred).
  // Fallback to calculation for backward compatibility: existing observations may not have
  // interpretation set if they were created before interpretation was added, or if reference
  // ranges weren't available at creation time.
  const systolicAssessment =
    systolicInterpretation ??
    (concepts?.systolicBloodPressureUuid
      ? assessValue(systolic, getReferenceRangesForConcept(concepts.systolicBloodPressureUuid, conceptMetadata))
      : 'normal');

  const diastolicAssessment =
    diastolicInterpretation ??
    (concepts?.diastolicBloodPressureUuid
      ? assessValue(diastolic, getReferenceRangesForConcept(concepts.diastolicBloodPressureUuid, conceptMetadata))
      : 'normal');

  if (systolicAssessment === 'critically_high' || diastolicAssessment === 'critically_high') {
    return 'critically_high';
  }

  if (systolicAssessment === 'critically_low' || diastolicAssessment === 'critically_low') {
    return 'critically_low';
  }

  if (systolicAssessment === 'high' || diastolicAssessment === 'high') {
    return 'high';
  }

  if (systolicAssessment === 'low' || diastolicAssessment === 'low') {
    return 'low';
  }

  return 'normal';
}

export function generatePlaceholder(value: string) {
  switch (value) {
    case 'BMI':
      return '';

    case 'Temperature':
    case 'Weight':
      return '--.-';

    case 'Height':
    case 'diastolic':
    case 'systolic':
    case 'Pulse':
      return '---';

    default:
      return '--';
  }
}

export function getReferenceRangesForConcept(
  conceptUuid: string | undefined | null,
  conceptMetadata: Array<ConceptMetadata> | undefined,
): ConceptMetadata | undefined {
  if (!conceptUuid || !conceptMetadata?.length) {
    return undefined;
  }

  return conceptMetadata?.find((metadata) => metadata.uuid === conceptUuid);
}

export function prepareObsForSubmission(
  formData: VitalsBiometricsFormData,
  dirtyFields: Record<string, boolean>,
  formContext: 'creating' | 'editing',
  initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap,
  fieldToConceptMap: Record<string, string>,
): {
  toBeVoided: Array<OpenmrsResource>;
  newObs: Array<OpenmrsResource>;
} {
  return Object.entries(formData).reduce(
    (obsForSubmission, [field, newValue]) => {
      if (!fieldToConceptMap[`${field}Uuid`]) {
        console.error(`Missing concept mapping for field: ${field}`);
        return obsForSubmission;
      }
      if (formContext === 'editing' && initialFieldValuesMap.has(field) && dirtyFields[field]) {
        // void old obs
        const { obs } = initialFieldValuesMap.get(field);
        obsForSubmission.toBeVoided.push({
          uuid: obs.uuid,
          voided: true,
        });

        if (newValue != null && newValue !== '') {
          obsForSubmission.newObs.push({
            concept: fieldToConceptMap[`${field}Uuid`],
            value: newValue,
          });
        }
      } else if (dirtyFields[field] && newValue != null && newValue !== '') {
        // create new obs
        obsForSubmission.newObs.push({
          concept: fieldToConceptMap[`${field}Uuid`],
          value: newValue,
        });
      }

      return obsForSubmission;
    },
    {
      toBeVoided: [],
      newObs: [],
    },
  );
}

/**
 * Uses the patient's birthDate to calculate their age in years.
 * Returns null if birthDate is missing or invalid.
 */
export const getPatientAge = (patient: fhir.Patient): number | null => {
  if (!patient.birthDate) {
    return null;
  }

  const birthDate = dayjs(patient.birthDate);
  return birthDate.isValid() ? dayjs().diff(birthDate, 'years') : null;
};

/**
 * Determines whether BMI should be shown for the given patient,
 * based on the biometrics configuration and patient's age.
 */
export const shouldShowBmi = (patient: fhir.Patient, biometricsConfig: BiometricsConfigObject): boolean => {
  const minAge = biometricsConfig.bmiMinimumAge ?? 0;

  // If the minimum age is 0 or less, we always show BMI (No restriction)
  if (minAge <= 0) {
    return true;
  }

  const patientAge = getPatientAge(patient);

  // Fallback: If birthDate is missing/invalid, show BMI to be safe
  if (patientAge === null) {
    return true;
  }

  return patientAge >= minAge;
};
