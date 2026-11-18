import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getLocale } from '@openmrs/esm-framework';
import { DecimalTextInput } from './decimal-text-input.component';

describe('DecimalTextInput', () => {
  it("shows a value the form set with the session language's decimal mark (UVL-EMR #767)", () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    render(<DecimalTextInput id="dose" labelText="Dose" onChange={vi.fn()} value={2.5} />);

    expect(screen.getByRole('textbox', { name: 'Dose' })).toHaveValue('2,5');
  });

  it('keeps what is typed, a dot or a comma, and reports the number', async () => {
    vi.mocked(getLocale).mockReturnValue('fr');
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<DecimalTextInput id="dose" labelText="Dose" onChange={onChange} value={undefined} />);
    const input = screen.getByRole('textbox', { name: 'Dose' });

    await user.type(input, '3.75');
    expect(onChange).toHaveBeenLastCalledWith(3.75);
    rerender(<DecimalTextInput id="dose" labelText="Dose" onChange={onChange} value={3.75} />);
    expect(input).toHaveValue('3.75');
  });
});
