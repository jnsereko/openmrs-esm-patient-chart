import { type TFunction } from 'i18next';

interface RefusalFieldError {
  code?: string;
  message?: string;
}

interface RefusalError {
  responseBody?: {
    error?: {
      message?: string;
      code?: string;
      translatedMessage?: string;
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

// What OpenMRS answers when it refuses with no reason of its own; it says nothing the prescriber can act on
const GENERIC_SUBMISSION_MESSAGE = 'Invalid Submission';
// A message key is a dotted identifier without spaces, e.g. Order.cannot.have.more.than.one
const RAW_KEY_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;

function withoutBrackets(text: string | undefined): string {
  return (text ?? '')
    .trim()
    .replace(/^\[(.*)\]$/, '$1')
    .trim();
}

/**
 * The reason of a refusal that carries no field or global errors (an HTTP 500 for example): a French text for the
 * known message keys, the server's own sentence when it sent one, otherwise a generic sentence with the raw key
 * after it for support. Never the bare key (UVL-EMR #872).
 */
function translateServerError(error: RefusalError['responseBody']['error'], t: TFunction): string | undefined {
  const message = withoutBrackets(error?.message);
  const code = withoutBrackets(error?.code);
  const key = [message, code].find((candidate) => RAW_KEY_PATTERN.test(candidate));
  if (key === 'Order.cannot.have.more.than.one') {
    return t(
      'orderAlreadyActiveErrorMessage',
      'This patient already has an active order for this medicine. Stop or revise the existing order.',
    );
  }
  if (key) {
    const sentence = error?.translatedMessage?.trim();
    if (sentence && !RAW_KEY_PATTERN.test(withoutBrackets(sentence))) {
      return sentence;
    }
    return `${t('serverRefusedOrderErrorMessage', 'The server refused the order.')} [${key}]`;
  }
  return message && message !== GENERIC_SUBMISSION_MESSAGE ? message : undefined;
}

/**
 * The reasons an encounter save was refused with, one text per field or global error, each in the session
 * language when its code is known and as the server worded it otherwise. Without field or global errors, the
 * reason of the server's own error (see translateServerError). Empty when the answer carries none.
 */
export function getOrderRefusalReasons(error: RefusalError | undefined, t: TFunction): Array<string> {
  const { fieldErrors, globalErrors } = error?.responseBody?.error ?? {};
  const reasons = [...Object.values(fieldErrors ?? {}).flat(), ...(Array.isArray(globalErrors) ? globalErrors : [])]
    .map((entry) => translateRefusalCode(entry?.code, entry?.message, t))
    .filter((reason): reason is string => Boolean(reason));
  if (!reasons.length && error?.responseBody?.error) {
    const reason = translateServerError(error.responseBody.error, t);
    return reason ? [reason] : [];
  }
  return Array.from(new Set(reasons));
}
