import { type TFunction } from 'i18next';

/**
 * The texts of a Carbon `Pagination` in the session language. Without them Carbon writes its own English,
 * « Items per page: … 1–1 of 1 items … of 1 page », under the French tables of the Visits tab (UVL-EMR #767).
 */
export function paginationLabels(t: TFunction) {
  return {
    backwardText: t('previousPage', 'Previous page'),
    forwardText: t('nextPage', 'Next page'),
    itemsPerPageText: t('itemsPerPage', 'Items per page') + ':',
    itemRangeText: (min: number, max: number, total: number) =>
      t('paginationItemRange', '{{min}}–{{max}} of {{count}} items', { min, max, count: total }),
    pageRangeText: (_current: number, total: number) => t('paginationPageText', 'of {{count}} pages', { count: total }),
  };
}
