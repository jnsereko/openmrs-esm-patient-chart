import { type Options } from 'react-barcode';
import {
  PatientAddress,
  PatientAge,
  PatientContact,
  type PatientDetailProps,
  PatientDob,
  PatientGender,
  PatientIdentifier,
  PatientName,
  StickerBarcode,
  StickerLogo,
} from './patient-detail.component';
import { useOpenmrsSWR } from '@openmrs/esm-framework';
import { config } from 'rxjs';
import {
  Style,
  type PageSize,
  FontStore,
  PDFVersion,
  Orientation,
  SourceObject,
  HyphenationCallback,
  SVGPresentationAttributes,
  Bookmark,
  PageLayout,
  PageMode,
} from '@react-pdf/types';

export const defaultBarcodeParams: Options = {
  width: 3,
  format: 'CODE39',
  background: '#ffffff',
  displayValue: true,
  renderer: 'img',
  font: 'IBM Plex Sans',
  textAlign: 'center',
  textPosition: 'bottom',
  fontSize: 16,
};

export type AllowedPatientFields =
  | 'barcode'
  | 'logo'
  | 'address'
  | 'age'
  | 'contact'
  | 'dob'
  | 'gender'
  | 'identifier'
  | 'name';

export function getPatientField(stickerField: StickerFieldConfig): React.FC<PatientDetailProps> {
  switch (stickerField.field) {
    case 'barcode':
      return StickerBarcode;
    case 'logo':
      return StickerLogo;
    case 'name':
      return PatientName;
    case 'age':
      return PatientAge;
    case 'dob':
      return PatientDob;
    case 'gender':
      return PatientGender;
    case 'identifier':
      return PatientIdentifier;
    case 'contact':
      return PatientContact;
    case 'address':
      return PatientAddress;
    default:
      console.error(`Invalid patient field: ${stickerField.field}`);
      return null;
  }
}

export interface PrintPatientStickerConfig {
  height?: string;
  width?: string;
  numberOfStickers?: number;
  numberOfColumnsPerPage?: number;
  numberOfRowsPerPage?: number;
  fields: Array<StickerFieldConfig | StickerFieldGroupConfig>;
  identifiersToDisplay: Array<string>;
  pageSize?: PageSize;
}

export interface StickerFieldConfig {
  field: AllowedPatientFields;
  fieldSeparator?: boolean;
  label?: string;
  logoURL?: string;
  fieldStyles?: Record<string, string | number>;
}

export interface StickerFieldGroupConfig {
  groupedFields: StickerFieldConfig[];
}

export function usePrintPatientStickerConfig(configURL: string) {
  const { data, isLoading, isValidating, error } = useOpenmrsSWR<PrintPatientStickerConfig, Error>(configURL || null);

  const defaultConfig: PrintPatientStickerConfig = {
    height: 'auto',
    width: 'auto',
    numberOfStickers: 10,
    numberOfColumnsPerPage: 1,
    numberOfRowsPerPage: 1,
    fields: [
      { field: 'barcode' },
      { field: 'logo', logoURL: '' },
      { field: 'name', label: 'Name' },
      { field: 'identifier', label: 'Patient ID' },
      {
        groupedFields: [
          { field: 'dob', label: 'Date of birth' },
          { field: 'gender', label: 'Gender' },
        ],
      },
    ],
    identifiersToDisplay: [],
    pageSize: ['50mm', '70mm'],
  };

  return {
    printPatientSticker: configURL ? (data ? data.data : null) : defaultConfig,
    isError: error,
    isLoading,
    isValidating,
  };
}
