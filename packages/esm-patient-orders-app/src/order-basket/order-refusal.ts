import { type TFunction } from 'i18next';

interface RefusalFieldError {
  code?: string;
  message?: string;
}

interface RefusalError {
  responseBody?: {
    error?: {
      message?: string;
      fieldErrors?: Record<string, Array<RefusalFieldError>>;
      globalErrors?: Array<RefusalFieldError>;
    };
  };
}

/**
 * The server's error codes that have a French text, by code. OpenMRS answers 400 « Invalid Submission »
 * with the reason only in `fieldErrors` (UVL-EMR #869).
 */
function translateRefusalCode(code: string | undefined, message: string | undefined, t: TFunction): string | undefined {
  switch (code) {
    case 'DrugOrder.error.durationUnitsRequiredWithDuration':
      return t('durationUnitRequiredErrorMessage', 'Duration unit is required');
    case 'DrugOrder.error.quantityUnitsRequiredWithQuantity':
      return t('quantityUnitRequiredErrorMessage', 'Quantity unit is required');
    default:
      return message;
  }
}

/**
 * The reasons an encounter save was refused with, one text per field or global error, each in the session
 * language when its code is known and as the server worded it otherwise. Empty when the answer carries none.
 */
export function getOrderRefusalReasons(error: RefusalError | undefined, t: TFunction): Array<string> {
  const { fieldErrors, globalErrors } = error?.responseBody?.error ?? {};
  const reasons = [...Object.values(fieldErrors ?? {}).flat(), ...(Array.isArray(globalErrors) ? globalErrors : [])]
    .map((entry) => translateRefusalCode(entry?.code, entry?.message, t))
    .filter((reason): reason is string => Boolean(reason));
  return Array.from(new Set(reasons));
}
