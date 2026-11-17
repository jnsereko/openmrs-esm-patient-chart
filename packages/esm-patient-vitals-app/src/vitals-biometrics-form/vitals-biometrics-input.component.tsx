import React, { Fragment, useEffect, useId, useState } from 'react';
import classNames from 'classnames';
import { type Control, Controller } from 'react-hook-form';
import { FormLabel, TextArea, TextInput } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { useLayoutType, ResponsiveWrapper } from '@openmrs/esm-framework';
import { generatePlaceholder } from '../common';
import { formatDecimal } from '../common/helpers';
import { type VitalsBiometricsFormData } from './schema';
import styles from './vitals-biometrics-input.scss';

type fieldId =
  | 'computedBodyMassIndex'
  | 'diastolicBloodPressure'
  | 'generalPatientNote'
  | 'height'
  | 'midUpperArmCircumference'
  | 'oxygenSaturation'
  | 'pulse'
  | 'respiratoryRate'
  | 'systolicBloodPressure'
  | 'temperature'
  | 'weight';

type AbnormalValue = 'critically_low' | 'critically_high' | 'high' | 'low';
type FieldTypes = 'number' | 'textarea';
type NormalRange = { lowNormal?: number | null; hiNormal?: number | null };

function formatNormalRange(range?: NormalRange | null) {
  if (range?.lowNormal != null && range?.hiNormal != null) {
    return `${formatDecimal(range.lowNormal)}–${formatDecimal(range.hiNormal)}`;
  }
  if (range?.lowNormal != null) {
    return `≥ ${formatDecimal(range.lowNormal)}`;
  }
  if (range?.hiNormal != null) {
    return `≤ ${formatDecimal(range.hiNormal)}`;
  }
  return null;
}

/** What a number field accepts as it is typed: digits with at most one decimal point, a dot or a comma. */
const decimalTextPattern = /^\d*([.,]\d*)?$/;

/**
 * The number a field's text means, a comma read as the decimal point; undefined when it holds no digit.
 * A French-locale browser empties an `<input type="number">` on a typed dot, so these fields are text
 * inputs and read "36.4" and "36,4" alike (UVL-EMR #719).
 */
export function parseDecimalText(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  if (!/\d/.test(normalized)) {
    return undefined;
  }
  const number = Number(normalized);
  return isNaN(number) ? undefined : number;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const number = Number(value);
  return isNaN(number) ? undefined : number;
}

interface DecimalTextInputProps {
  className?: string;
  id: string;
  inputRef: React.Ref<HTMLInputElement>;
  /** The absolute limits, kept on the input as data; the form checks them. */
  max?: number;
  min?: number;
  name: string;
  onBlur: () => void;
  onChange: (value: number | undefined) => void;
  onFocus: () => void;
  placeholder: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
  value: unknown;
}

/**
 * A number field typed as text: keeps what is typed ("36," on the way to "36,4") and reports the number. A value
 * the form sets is written with the session's decimal mark, « 36,4 » in French (UVL-EMR #723).
 */
function DecimalTextInput({ inputRef, onChange, value, ...inputProps }: DecimalTextInputProps) {
  const [text, setText] = useState(() => formatDecimal(toNumber(value)) ?? '');

  // The form set another value (an encounter being edited, the computed BMI): show it, unless the text
  // already means it.
  useEffect(() => {
    setText((current) => {
      const number = toNumber(value);
      return parseDecimalText(current) === number ? current : formatDecimal(number) ?? '';
    });
  }, [value]);

  return (
    <TextInput
      {...inputProps}
      autoComplete="off"
      inputMode="decimal"
      labelText=""
      onChange={(event) => {
        const nextText = event.target.value;
        if (!decimalTextPattern.test(nextText.trim())) {
          return;
        }
        setText(nextText);
        onChange(parseDecimalText(nextText));
      }}
      ref={inputRef}
      title={inputProps.name}
      value={text}
    />
  );
}

interface VitalsAndBiometricsInputProps {
  control: Control<VitalsBiometricsFormData>;
  /** A value has decimals but its concept takes whole numbers only; shown at once, and saving is refused. */
  decimalNotAllowed?: boolean;
  fieldStyles?: React.CSSProperties;
  fieldWidth?: string;
  fieldProperties: Array<{
    className?: string;
    id: fieldId;
    invalid?: boolean;
    max?: number | null;
    min?: number | null;
    name: string;
    separator?: string;
    type?: FieldTypes;
  }>;
  interpretation?: string;
  isValueWithinReferenceRange?: boolean;
  label: string;
  muacColorCode?: string;
  /** The normal range of each field, in the order of `fieldProperties`; shown under the input. */
  normalRanges?: Array<NormalRange | null | undefined>;
  placeholder?: string;
  readOnly?: boolean;
  showErrorMessage?: boolean;
  unitSymbol?: string;
  useMuacColors?: boolean;
}

const VitalsAndBiometricsInput: React.FC<VitalsAndBiometricsInputProps> = ({
  control,
  decimalNotAllowed = false,
  fieldProperties,
  fieldStyles,
  fieldWidth,
  interpretation,
  isValueWithinReferenceRange = true,
  label,
  muacColorCode,
  normalRanges,
  placeholder,
  readOnly,
  showErrorMessage,
  unitSymbol,
  useMuacColors,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const [isFocused, setIsFocused] = useState(false);

  const abnormalValues: Array<AbnormalValue> = ['critically_low', 'critically_high', 'high', 'low'];
  const hasAbnormalValue = !isFocused && interpretation && abnormalValues.includes(interpretation as AbnormalValue);

  function handleFocusChange(isFocused: boolean) {
    setIsFocused(isFocused);
  }

  const formattedNormalRanges = (normalRanges ?? []).map(formatNormalRange);
  const normalRange = formattedNormalRanges.some(Boolean)
    ? formattedNormalRanges.map((range) => range ?? '–').join(' / ')
    : null;

  const isInvalidInput = !isValueWithinReferenceRange;
  const showInvalidInputError = Boolean(showErrorMessage && isInvalidInput) || decimalNotAllowed;
  const errorMessageClass = showInvalidInputError ? styles.invalidInput : '';

  const containerClasses = classNames(styles.container, {
    [styles.inputInTabletView]: isTablet,
    [styles.inputWithAbnormalValue]: hasAbnormalValue,
  });

  const inputClasses = classNames(styles.inputContainer, {
    [styles['critical-value']]: hasAbnormalValue,
    [styles.focused]: isFocused,
    [styles.readonly]: readOnly,
    [muacColorCode]: useMuacColors,
    [errorMessageClass]: true,
  });

  return (
    <>
      <div className={containerClasses} style={{ width: fieldWidth }}>
        <section className={styles.labelContainer}>
          <span className={styles.label} id={`${fieldId}-label`}>
            {label}
          </span>

          {Boolean(hasAbnormalValue) ? (
            <span className={styles[interpretation.replace('_', '-')]} title={t('abnormalValue', 'Abnormal value')} />
          ) : null}

          {showInvalidInputError ? (
            <span className={styles.invalidInputIcon}>
              <Warning />
            </span>
          ) : null}
        </section>
        <section className={inputClasses} style={{ ...fieldStyles }}>
          <div
            className={classNames({
              [styles.centered]: !isTablet || unitSymbol === 'mmHg',
            })}
          >
            {fieldProperties.map((fieldProperty) => {
              if (fieldProperty.type === 'number') {
                const numberInputClasses = classNames(styles.numberInput, fieldProperty.className);

                return (
                  <Fragment key={fieldProperty.id}>
                    <ResponsiveWrapper>
                      <Controller
                        name={fieldProperty.id}
                        control={control}
                        render={({ field: { onChange, ref, value } }) => {
                          return (
                            <DecimalTextInput
                              className={numberInputClasses}
                              id={`${fieldId}-${fieldProperty.id}`}
                              inputRef={ref}
                              max={fieldProperty.max ?? undefined}
                              min={fieldProperty.min ?? undefined}
                              name={fieldProperty.name}
                              onBlur={() => handleFocusChange(false)}
                              onChange={onChange}
                              onFocus={() => handleFocusChange(true)}
                              placeholder={generatePlaceholder(fieldProperty.name)}
                              readOnly={readOnly}
                              style={{ ...fieldStyles }}
                              value={value}
                            />
                          );
                        }}
                      />
                    </ResponsiveWrapper>
                    {fieldProperty?.separator}
                  </Fragment>
                );
              }

              if (fieldProperty.type === 'textarea') {
                return (
                  <ResponsiveWrapper key={fieldProperty.id}>
                    <Controller
                      name={fieldProperty.id}
                      control={control}
                      render={({ field: { onChange, ref, value } }) => (
                        <TextArea
                          className={styles.textarea}
                          id={`${fieldId}-${fieldProperty.id}`}
                          labelText={''}
                          aria-labelledby={`${fieldId}-label`}
                          maxCount={100}
                          name={fieldProperty.name}
                          onBlur={() => handleFocusChange(false)}
                          onChange={onChange}
                          onFocus={() => handleFocusChange(true)}
                          placeholder={placeholder}
                          ref={ref}
                          rows={2}
                          style={{ ...fieldStyles }}
                          title={fieldProperty.name}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </ResponsiveWrapper>
                );
              }
            })}
          </div>
          {Boolean(unitSymbol) && <p className={styles.unitName}>{unitSymbol}</p>}
        </section>
        {normalRange ? (
          <p className={styles.normalRange}>
            {t('normalRangeHint', 'Normal: {{range}}', {
              range: normalRange,
              // The range is built from numbers here; escaping would turn its " / " into "&#x2F;" (UVL-EMR #564)
              interpolation: { escapeValue: false },
            })}
          </p>
        ) : null}
      </div>

      {decimalNotAllowed ? (
        <FormLabel className={styles.invalidInputError}>
          {t('wholeNumberRequired', 'Enter a whole number, without decimals')}
        </FormLabel>
      ) : (
        showInvalidInputError && (
          <FormLabel className={styles.invalidInputError}>
            {t('validationInputError', `Value must be between {{min}} and {{max}}`, {
              min: formatDecimal(fieldProperties[0].min),
              max: formatDecimal(fieldProperties[0].max),
            })}
          </FormLabel>
        )
      )}
    </>
  );
};

export default VitalsAndBiometricsInput;
