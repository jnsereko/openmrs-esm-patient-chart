import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import { type TFunction } from 'i18next';
import { type Order, useDrugOrderByUuid } from '@openmrs/esm-patient-common-lib';
import { formatDecimal } from '../utils/format-decimal';

interface DrugOrderSummaryProps {
  order: Order;
}

/**
 * A drug order's line in the orders table, written in the session language: « Paracetamol Sirop 120mg/5ml
 * — 2,5 millilitre — orale — deux fois par jour — pour 3 jours ». The table printed the server's `display`,
 * « (NEW) Paracetamol Sirop 120mg/5ml: 2.5 Millilitre Orale … », with the order action in English and the
 * dose with a dot (UVL-EMR #752). The fields come from the same request as the expanded row
 * (`useDrugOrderByUuid`), unless the order already carries them. The server's text is never shown: it
 * flashed for a few seconds after « Signer et fermer » and on each reload (UVL-EMR #765). Until the fields
 * arrive a one-line placeholder is shown; if they cannot be read, the line is written from what the
 * order has (its drug or concept and action).
 */
export function DrugOrderSummary({ order }: DrugOrderSummaryProps) {
  const { t } = useTranslation();
  const hasDrugFields = hasDosingFields(order);
  const { data: drugOrder, error } = useDrugOrderByUuid(hasDrugFields ? null : order.uuid);

  if (hasDrugFields) {
    return <>{drugOrderSummaryText(order, t)}</>;
  }
  if (drugOrder) {
    return <>{drugOrderSummaryText(drugOrder, t)}</>;
  }
  if (error) {
    return <>{drugOrderSummaryText(order, t)}</>;
  }
  return <SkeletonText data-testid="drug-order-summary-skeleton" width="100%" />;
}

/** Whether the order object was read with its drug and dosing fields (the orders list leaves them out). */
function hasDosingFields(order: Order) {
  return order.drug != null && order.dose !== undefined;
}

export function drugOrderSummaryText(order: Order, t: TFunction) {
  const action = actionLabel(order.action, t);
  const drug = order.drug?.display ?? order.concept?.display ?? '';
  const parts = [
    order.dose != null
      ? [formatDecimal(order.dose), order.doseUnits?.display?.toLowerCase()].filter(Boolean).join(' ')
      : null,
    order.route?.display?.toLowerCase(),
    order.frequency?.display?.toLowerCase(),
    order.duration != null
      ? t('medicationDurationAndUnit', 'for {{duration}} {{durationUnit}}', {
          duration: formatDecimal(order.duration),
          durationUnit: order.durationUnits?.display?.toLowerCase() ?? '',
          interpolation: { escapeValue: false },
        }).trim()
      : null,
  ].filter(Boolean);
  const text = [drug, ...parts].join(' — ');
  return action ? `(${action}) ${text}` : text;
}

/** The order action, left out for a new order: that is every order the table lists by default. */
function actionLabel(action: string | undefined, t: TFunction) {
  switch (action) {
    case 'REVISE':
      return t('orderActionRevise', 'Modify');
    case 'RENEW':
      return t('orderActionRenew', 'Renew');
    case 'DISCONTINUE':
      return t('orderActionDiscontinue', 'Discontinue');
    default:
      return null;
  }
}
