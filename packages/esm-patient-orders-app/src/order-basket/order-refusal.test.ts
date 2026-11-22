import { describe, expect, it } from 'vitest';
import { getOrderRefusalReasons } from './order-refusal';

const french: Record<string, string> = {
  durationUnitRequiredErrorMessage: "Choisissez l'unité de durée",
};
const t = ((key: string, fallback: string) => french[key] ?? fallback) as any;

describe('getOrderRefusalReasons', () => {
  it('writes a known code in the session language', () => {
    const error = {
      responseBody: {
        error: {
          message: 'Invalid Submission',
          fieldErrors: {
            durationUnits: [
              {
                code: 'DrugOrder.error.durationUnitsRequiredWithDuration',
                message: 'Durations units is required when duration is specified',
              },
            ],
          },
        },
      },
    };
    expect(getOrderRefusalReasons(error, t)).toEqual(["Choisissez l'unité de durée"]);
  });

  it('keeps the quantity unit text of the server language when no translation exists', () => {
    const error = {
      responseBody: {
        error: {
          fieldErrors: {
            quantityUnits: [{ code: 'DrugOrder.error.quantityUnitsRequiredWithQuantity', message: 'x' }],
          },
        },
      },
    };
    expect(getOrderRefusalReasons(error, t)).toEqual(['Quantity unit is required']);
  });

  it("shows the server's message for a code it does not know, once, with the global errors", () => {
    const error = {
      responseBody: {
        error: {
          fieldErrors: {
            a: [{ code: 'Other.error', message: 'Something else' }],
            b: [{ code: 'Other.error', message: 'Something else' }],
          },
          globalErrors: [{ code: 'Global.error', message: 'Global reason' }],
        },
      },
    };
    expect(getOrderRefusalReasons(error, t)).toEqual(['Something else', 'Global reason']);
  });

  it('is empty when the answer has no field errors or is not an HTTP error', () => {
    expect(getOrderRefusalReasons({ responseBody: { error: { message: 'Invalid Submission' } } }, t)).toEqual([]);
    expect(getOrderRefusalReasons(new Error('Network') as any, t)).toEqual([]);
    expect(getOrderRefusalReasons(undefined, t)).toEqual([]);
  });
});
