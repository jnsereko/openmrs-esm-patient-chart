import React, { forwardRef, useEffect, useState, type ComponentProps } from 'react';
import { TextInput } from '@carbon/react';

/** What a number field accepts as it is typed: digits with at most one decimal point, a dot or a comma. */
const decimalTextPattern = /^\d*([.,]\d*)?$/;
/** The same, after an optional leading minus. */
const signedDecimalTextPattern = /^-?\d*([.,]\d*)?$/;

/**
 * The number a field's text means, a comma read as the decimal point; undefined when it holds no digit.
 * A French-locale browser empties an `<input type="number">` on a typed dot, so these fields are text
 * inputs and read "4.5" and "4,5" alike (UVL-EMR #719, #727).
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

function textOf(value: unknown) {
  const number = toNumber(value);
  return number === undefined ? '' : String(number);
}

type DecimalTextInputProps = Omit<ComponentProps<typeof TextInput>, 'onChange' | 'value' | 'type'> & {
  /** Also accept a leading minus. */
  allowNegative?: boolean;
  onChange: (value: number | undefined) => void;
  value: unknown;
};

/** A number field typed as text: keeps what is typed ("4," on the way to "4,5") and reports the number. */
export const DecimalTextInput = forwardRef<HTMLInputElement, DecimalTextInputProps>(function DecimalTextInput(
  { allowNegative = false, onChange, value, ...inputProps },
  ref,
) {
  const [text, setText] = useState(() => textOf(value));
  const pattern = allowNegative ? signedDecimalTextPattern : decimalTextPattern;

  // The form set another value (an order being edited, a calculated quantity): show it, unless the
  // text already means it.
  useEffect(() => {
    setText((current) => (parseDecimalText(current) === toNumber(value) ? current : textOf(value)));
  }, [value]);

  return (
    <TextInput
      autoComplete="off"
      {...inputProps}
      inputMode="decimal"
      onChange={(event) => {
        const nextText = event.target.value;
        if (!pattern.test(nextText.trim())) {
          return;
        }
        setText(nextText);
        onChange(parseDecimalText(nextText));
      }}
      ref={ref}
      type="text"
      value={text}
    />
  );
});
