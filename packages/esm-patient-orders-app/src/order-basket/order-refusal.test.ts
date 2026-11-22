import { describe, expect, it } from 'vitest';
import { getOrderRefusalReasons } from './order-refusal';

const french: Record<string, string> = {
  durationUnitRequiredErrorMessage: "Choisissez l'unité de durée",
  orderAlreadyActiveErrorMessage:
    'Ce patient a déjà une prescription active pour ce médicament. Arrêtez ou modifiez la prescription existante.',
  serverRefusedOrderErrorMessage: 'Le serveur a refusé la prescription.',
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

  it('writes the known « second active order » key in French, with or without brackets', () => {
    const expected =
      'Ce patient a déjà une prescription active pour ce médicament. Arrêtez ou modifiez la prescription existante.';
    expect(
      getOrderRefusalReasons({ responseBody: { error: { message: '[Order.cannot.have.more.than.one]' } } }, t),
    ).toEqual([expected]);
    expect(
      getOrderRefusalReasons(
        {
          responseBody: {
            error: {
              message: 'Order.cannot.have.more.than.one',
              translatedMessage: 'Cannot have more than one active order for the same orderable',
            },
          },
        },
        t,
      ),
    ).toEqual([expected]);
  });

  it('shows a generic sentence and the key for support when the key is unknown', () => {
    expect(getOrderRefusalReasons({ responseBody: { error: { message: '[Some.unknown.key]' } } }, t)).toEqual([
      'Le serveur a refusé la prescription. [Some.unknown.key]',
    ]);
  });

  it("shows the server's readable sentence when the message is a key and a sentence came with it", () => {
    const error = {
      responseBody: { error: { message: '[Some.unknown.key]', translatedMessage: 'Something readable' } },
    };
    expect(getOrderRefusalReasons(error, t)).toEqual(['Something readable']);
  });

  it('shows a message that is already a sentence as it is', () => {
    expect(
      getOrderRefusalReasons({ responseBody: { error: { message: 'The patient has no active visit' } } }, t),
    ).toEqual(['The patient has no active visit']);
  });

  it('keeps the field errors over the message of the answer', () => {
    const error = {
      responseBody: {
        error: {
          message: '[Some.unknown.key]',
          fieldErrors: { a: [{ code: 'Other.error', message: 'Something else' }] },
        },
      },
    };
    expect(getOrderRefusalReasons(error, t)).toEqual(['Something else']);
  });
});
