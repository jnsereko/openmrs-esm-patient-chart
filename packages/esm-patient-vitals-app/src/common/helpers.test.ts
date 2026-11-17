import {
  assessValue,
  formatDecimal,
  getLatestVitalsAndBiometrics,
  interpretBloodPressure,
  prepareObsForSubmission,
} from './helpers';
import { vi, describe, it, expect } from 'vitest';
import type { ObsReferenceRanges, PatientVitalsAndBiometrics } from './types';
import type { VitalsAndBiometricsFieldValuesMap } from './data.resource';

const temperatureRange: ObsReferenceRanges = {
  hiAbsolute: 43,
  hiCritical: 40,
  hiNormal: 37.5,
  lowNormal: 36.5,
  lowCritical: 35,
  lowAbsolute: 25,
};

describe('formatDecimal', () => {
  it('writes the decimal mark of the session language', () => {
    expect(formatDecimal(36.4, 'fr')).toBe('36,4');
    expect(formatDecimal(36.4, 'en')).toBe('36.4');
    expect(formatDecimal(23.8, 'fr-BI')).toBe('23,8');
  });

  it('keeps the digits as they are, without rounding or grouping', () => {
    expect(formatDecimal(37, 'fr')).toBe('37');
    expect(formatDecimal(1250.75, 'fr')).toBe('1250,75');
    expect(formatDecimal(0.125, 'fr')).toBe('0,125');
    expect(formatDecimal('37.7', 'fr')).toBe('37,7');
    expect(formatDecimal('26.0', 'fr')).toBe('26,0');
  });

  it('leaves placeholders alone and returns undefined for no value', () => {
    expect(formatDecimal('--', 'fr')).toBe('--');
    expect(formatDecimal(null, 'fr')).toBeUndefined();
    expect(formatDecimal(undefined, 'fr')).toBeUndefined();
    expect(formatDecimal('', 'fr')).toBeUndefined();
  });

  it('falls back to a dot for a language tag Intl does not take', () => {
    expect(formatDecimal(36.4, 'not a locale')).toBe('36.4');
  });

  it("uses the session's locale by default", () => {
    expect(formatDecimal(36.4)).toBe('36.4');
  });
});

describe('assessValue', () => {
  it('returns "normal" when no range is provided', () => {
    expect(assessValue(37, undefined)).toBe('normal');
  });

  it('returns "normal" when value is undefined', () => {
    expect(assessValue(undefined, temperatureRange)).toBe('normal');
  });

  it('returns "normal" for a value within normal range', () => {
    expect(assessValue(37, temperatureRange)).toBe('normal');
  });

  it('returns "high" for a value above hiNormal but below hiCritical', () => {
    expect(assessValue(38, temperatureRange)).toBe('high');
  });

  it('returns "critically_high" for a value at or above hiCritical', () => {
    expect(assessValue(40, temperatureRange)).toBe('critically_high');
    expect(assessValue(42, temperatureRange)).toBe('critically_high');
  });

  it('returns "low" for a value below lowNormal but above lowCritical', () => {
    expect(assessValue(36, temperatureRange)).toBe('low');
  });

  it('returns "critically_low" for a value at or below lowCritical', () => {
    expect(assessValue(35, temperatureRange)).toBe('critically_low');
    expect(assessValue(30, temperatureRange)).toBe('critically_low');
  });

  it('correctly evaluates a value of 0 against reference ranges', () => {
    expect(assessValue(0, temperatureRange)).toBe('critically_low');
  });
});

describe('interpretBloodPressure', () => {
  const concepts = {
    systolicBloodPressureUuid: 'systolic-uuid',
    diastolicBloodPressureUuid: 'diastolic-uuid',
  };

  const systolicRange: ObsReferenceRanges = {
    hiAbsolute: 250,
    hiCritical: 180,
    hiNormal: 140,
    lowNormal: 90,
    lowCritical: 70,
    lowAbsolute: 0,
  };

  const diastolicRange: ObsReferenceRanges = {
    hiAbsolute: 150,
    hiCritical: 120,
    hiNormal: 90,
    lowNormal: 60,
    lowCritical: 40,
    lowAbsolute: 0,
  };

  const conceptMetadata = [
    { uuid: 'systolic-uuid', ...systolicRange, display: 'Systolic', units: 'mmHg' },
    { uuid: 'diastolic-uuid', ...diastolicRange, display: 'Diastolic', units: 'mmHg' },
  ];

  it('returns "normal" when both values are within range', () => {
    expect(interpretBloodPressure(120, 80, concepts, conceptMetadata)).toBe('normal');
  });

  it('returns "high" when systolic is above hiNormal', () => {
    expect(interpretBloodPressure(150, 80, concepts, conceptMetadata)).toBe('high');
  });

  it('returns "critically_high" when diastolic is at or above hiCritical', () => {
    expect(interpretBloodPressure(120, 120, concepts, conceptMetadata)).toBe('critically_high');
  });

  it('prefers FHIR interpretation over calculated values when provided', () => {
    expect(interpretBloodPressure(120, 80, concepts, conceptMetadata, 'high', 'normal')).toBe('high');
  });

  it('returns "normal" when conceptMetadata is undefined', () => {
    expect(interpretBloodPressure(200, 130, concepts, undefined)).toBe('normal');
  });
});

describe('prepareObsForSubmission', () => {
  const fieldToConceptMap = {
    temperatureUuid: 'temp-concept-uuid',
    pulseUuid: 'pulse-concept-uuid',
    generalPatientNoteUuid: 'note-concept-uuid',
  };

  const emptyFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map();

  it('creates an obs when value is 0', () => {
    const formData = { temperature: 0 };
    const dirtyFields = { temperature: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([{ concept: 'temp-concept-uuid', value: 0 }]);
  });

  it('does not create an obs when value is undefined', () => {
    const formData = { temperature: undefined };
    const dirtyFields = { temperature: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('does not create an obs when value is an empty string', () => {
    const formData = { generalPatientNote: '' } as any;
    const dirtyFields = { generalPatientNote: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('does not create an obs when field is not dirty', () => {
    const formData = { temperature: 37 };
    const dirtyFields = {};

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('voids old obs and creates replacement when editing to 0', () => {
    const formData = { temperature: 0 };
    const dirtyFields = { temperature: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['temperature', { value: 37, obs: { uuid: 'old-obs-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-obs-uuid', voided: true }]);
    expect(result.newObs).toEqual([{ concept: 'temp-concept-uuid', value: 0 }]);
  });

  it('voids old obs without replacement when editing to undefined (clearing a field)', () => {
    const formData = { temperature: undefined };
    const dirtyFields = { temperature: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['temperature', { value: 37, obs: { uuid: 'old-obs-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-obs-uuid', voided: true }]);
    expect(result.newObs).toEqual([]);
  });

  it('voids old obs without replacement when editing to empty string', () => {
    const formData = { generalPatientNote: '' } as any;
    const dirtyFields = { generalPatientNote: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['generalPatientNote', { value: 'old note', obs: { uuid: 'old-note-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-note-uuid', voided: true }]);
    expect(result.newObs).toEqual([]);
  });
});

describe('getLatestVitalsAndBiometrics (UVL-EMR #761)', () => {
  const temperatureOnly: PatientVitalsAndBiometrics = {
    id: 'surveillance',
    date: '2026-11-17T21:45:00.000Z',
    temperature: 38.2,
    temperatureRenderInterpretation: 'high',
  };
  const fullVitals: PatientVitalsAndBiometrics = {
    id: 'vitals',
    date: '2026-11-17T21:42:00.000Z',
    systolic: 150,
    diastolic: 95,
    systolicRenderInterpretation: 'high',
    diastolicRenderInterpretation: 'high',
    bloodPressureRenderInterpretation: 'high',
    pulse: 88,
    pulseRenderInterpretation: 'normal',
    temperature: 36.8,
    weight: 70,
    height: 175,
    bmi: 22.9,
  };

  it('returns undefined when nothing has been recorded', () => {
    expect(getLatestVitalsAndBiometrics(undefined)).toBeUndefined();
    expect(getLatestVitalsAndBiometrics([])).toBeUndefined();
  });

  it('takes each value from the latest encounter that recorded it', () => {
    const latest = getLatestVitalsAndBiometrics([temperatureOnly, fullVitals]);

    expect(latest.id).toBe('surveillance');
    expect(latest.date).toBe('2026-11-17T21:45:00.000Z');
    expect(latest.temperature).toBe(38.2);
    expect(latest.temperatureRenderInterpretation).toBe('high');
    expect(latest.systolic).toBe(150);
    expect(latest.diastolic).toBe(95);
    expect(latest.bloodPressureRenderInterpretation).toBe('high');
    expect(latest.pulse).toBe(88);
    expect(latest.pulseRenderInterpretation).toBe('normal');
    expect(latest.weight).toBe(70);
    expect(latest.height).toBe(175);
    expect(latest.bmi).toBe(22.9);
    expect(latest.spo2).toBeUndefined();
  });

  it('does not depend on the order of the entries', () => {
    expect(getLatestVitalsAndBiometrics([fullVitals, temperatureOnly])).toEqual(
      getLatestVitalsAndBiometrics([temperatureOnly, fullVitals]),
    );
  });

  it('keeps systolic and diastolic from the same encounter', () => {
    const latest = getLatestVitalsAndBiometrics([
      { id: 'new', date: '2026-11-17T22:00:00.000Z', systolic: 120 },
      fullVitals,
    ]);

    expect(latest.systolic).toBe(120);
    expect(latest.diastolic).toBeUndefined();
  });

  it('calculates BMI from the latest weight and height when they were recorded apart', () => {
    const latest = getLatestVitalsAndBiometrics([
      { id: 'weight', date: '2026-11-17T22:00:00.000Z', weight: 80, bmi: null },
      fullVitals,
    ]);

    expect(latest.weight).toBe(80);
    expect(latest.height).toBe(175);
    expect(latest.bmi).toBe(26.1);
  });
});
