import { translateFrom } from '@openmrs/esm-framework';
import { type OrderUrgency } from '@openmrs/esm-patient-common-lib';

/**
 * The order priorities, with labels translated when called, i.e. at render time. Common-lib's
 * `priorityOptions` translates them when the module is first evaluated, before translations load,
 * so they stay English. This lives in the tests app, not common-lib: common-lib is a shared
 * module-federation dependency, and at runtime this app can get another patient-chart app's older
 * copy, which has no `getPriorityOptions` (UVL-EMR#529, b32).
 *
 * See the Urgency enum in https://github.com/openmrs/openmrs-core/blob/492dcd35b85d48730bd19da48f6db146cc882c22/api/src/main/java/org/openmrs/Order.java
 */
export function getPriorityOptions(): Array<{ value: OrderUrgency; label: string }> {
  const moduleName = '@openmrs/esm-patient-chart-app';
  return [
    { value: 'ROUTINE', label: translateFrom(moduleName, 'Routine') },
    { value: 'STAT', label: translateFrom(moduleName, 'Stat') },
    { value: 'ON_SCHEDULED_DATE', label: translateFrom(moduleName, 'On scheduled date') },
  ];
}
