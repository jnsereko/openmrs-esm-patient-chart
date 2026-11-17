import React, { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { getLocale } from '@openmrs/esm-framework';
import { type VitalsBiometricsFormData } from './schema';
import VitalsAndBiometricsInput, { parseDecimalText } from './vitals-biometrics-input.component';

// A French-locale browser empties an <input type="number"> on a typed dot ("36.4" was saved as 4), and
// elsewhere "36,4" was saved as 364: the fields are text inputs that take a dot or a comma (UVL-EMR #719).

function TemperatureField({
  onValue,
  defaultValue,
  normalRange,
}: {
  onValue: (value: unknown) => void;
  defaultValue?: number;
  normalRange?: { lowNormal: number; hiNormal: number };
}) {
  const { control, watch } = useForm<VitalsBiometricsFormData>({
    defaultValues: { temperature: defaultValue },
  });
  const temperature = watch('temperature');

  useEffect(() => {
    onValue(temperature);
  }, [onValue, temperature]);

  return (
    <VitalsAndBiometricsInput
      control={control}
      fieldProperties={[{ id: 'temperature', name: 'Temperature', type: 'number' }]}
      label="Temperature"
      normalRanges={normalRange ? [normalRange] : undefined}
      unitSymbol="DEG C"
    />
  );
}

describe('VitalsAndBiometricsInput, decimals', () => {
  it.each([
    ['36.4', 36.4],
    ['36,4', 36.4],
    ['36.', 36],
    ['36,', 36],
  ])('keeps "%s" as typed and gives the form %s', async (typed, expected) => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<TemperatureField onValue={onValue} />);

    const input = screen.getByRole('textbox', { name: /temperature/i });
    expect(input).toHaveAttribute('inputmode', 'decimal');

    await user.type(input, typed);

    expect(input).toHaveValue(typed);
    expect(onValue).toHaveBeenLastCalledWith(expected);
  });

  it('gives the form no value when the field is emptied', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<TemperatureField onValue={onValue} />);

    const input = screen.getByRole('textbox', { name: /temperature/i });
    await user.type(input, '36,4');
    await user.clear(input);

    expect(input).toHaveValue('');
    expect(onValue).toHaveBeenLastCalledWith(undefined);
  });

  it('ignores letters, a second decimal point and a minus sign', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<TemperatureField onValue={onValue} />);

    const input = screen.getByRole('textbox', { name: /temperature/i });
    await user.type(input, '3a6,4.5-');

    expect(input).toHaveValue('36,45');
    expect(onValue).toHaveBeenLastCalledWith(36.45);
  });

  it('shows the stored value when an encounter is edited', () => {
    render(<TemperatureField onValue={vi.fn()} defaultValue={36.5} />);

    expect(screen.getByRole('textbox', { name: /temperature/i })).toHaveValue('36.5');
  });

  describe('in a French session (UVL-EMR #723)', () => {
    const mockGetLocale = vi.mocked(getLocale);

    afterEach(() => {
      mockGetLocale.mockReturnValue('en');
    });

    it('shows a stored value with a comma', () => {
      mockGetLocale.mockReturnValue('fr');
      render(<TemperatureField onValue={vi.fn()} defaultValue={36.5} />);

      expect(screen.getByRole('textbox', { name: /temperature/i })).toHaveValue('36,5');
    });

    it('shows the normal range with a comma', () => {
      mockGetLocale.mockReturnValue('fr');
      render(<TemperatureField onValue={vi.fn()} normalRange={{ lowNormal: 35, hiNormal: 37.7 }} />);

      expect(screen.getByText('Normal: 35–37,7')).toBeInTheDocument();
    });

    it('still reads a typed dot or comma as the decimal point', async () => {
      mockGetLocale.mockReturnValue('fr');
      const user = userEvent.setup();
      const onValue = vi.fn();
      render(<TemperatureField onValue={onValue} />);

      const input = screen.getByRole('textbox', { name: /temperature/i });
      await user.type(input, '36.4');

      expect(input).toHaveValue('36.4');
      expect(onValue).toHaveBeenLastCalledWith(36.4);
    });
  });
});

describe('parseDecimalText', () => {
  it.each([
    ['36.4', 36.4],
    ['36,4', 36.4],
    ['36.', 36],
    ['36,', 36],
    [',5', 0.5],
    [' 70,5 ', 70.5],
    ['', undefined],
    [',', undefined],
    ['.', undefined],
  ])('reads "%s" as %s', (text, expected) => {
    expect(parseDecimalText(text)).toBe(expected);
  });
});
