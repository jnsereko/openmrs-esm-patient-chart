import React from 'react';
import Barcode from 'react-barcode';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import {
  defaultBarcodeParams,
  getPatientField,
  type StickerFieldConfig,
  type StickerFieldGroupConfig,
  usePrintPatientStickerConfig,
} from './print-identifier-sticker.resource';
import { type AllowedPatientFields, type ConfigObject } from '../config-schema';
import styles from './print-identifier-sticker.scss';
import { Column, Grid } from '@carbon/react';

interface PrintComponentProps {
  patient: fhir.Patient;
}

const PrintComponent: React.FC<PrintComponentProps> = ({ patient }) => {
  const { printPatientStickerConfig } = useConfig<ConfigObject>();
  const { printPatientSticker, isError, isLoading } = usePrintPatientStickerConfig(printPatientStickerConfig);
  const fieldsTableGroups =
    printPatientSticker?.fields
      ?.filter((field) => 'groupedFields' in field)
      ?.flatMap((field) => (field as StickerFieldGroupConfig).groupedFields) || [];

  const individualFields: StickerFieldConfig[] =
    printPatientSticker?.fields?.filter((field): field is StickerFieldConfig => !('groupedFields' in field)) || [];

  return (
    <div className={styles.stickerContainer}>
      <div className={styles.fieldsContainer}>
        {individualFields.map((stickerField) => {
          const Component = getPatientField(stickerField);
          return (
            <div key={stickerField.field} className={styles.fieldRow}>
              <Component patient={patient} stickerField={stickerField} />
            </div>
          );
        })}
      </div>
      {fieldsTableGroups.length > 0 ? (
        <table className={styles.fieldsTable}>
          <tbody>
            <tr>
              {fieldsTableGroups.map((stickerField, index) => {
                const Component = getPatientField(stickerField);
                return (
                  <td key={stickerField.field} className={styles.fieldsTableCell}>
                    <Component patient={patient} stickerField={stickerField} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
};

export default PrintComponent;
