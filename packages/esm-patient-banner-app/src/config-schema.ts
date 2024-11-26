import { Type } from '@openmrs/esm-framework';
import _default from 'react-hook-form/dist/logic/appendErrors';

export const configSchema = {
  contactAttributeTypes: {
    _type: Type.Array,
    _description: 'The UUIDs of person attribute types that store contact information',
    _default: [
      // Telephone number
      '14d4f066-15f5-102d-96e4-000c29c2a5d7',
    ],
    _elements: {
      _type: Type.UUID,
    },
  },
  printPatientSticker: {
    _type: Type.String,
    _description: 'URL for the configuration properties for patient identifier stickers',
    _default: '',
  },
  useRelationshipNameLink: {
    _type: Type.Boolean,
    _description: "Whether to use the relationship name as a link to the associated person's patient chart.",
    _default: false,
  },
};

export type AllowedPatientFields = 'address' | 'age' | 'contact' | 'dob' | 'gender' | 'identifier' | 'name';

export interface ConfigObject {
  contactAttributeTypes: Array<string>;
  printPatientStickerConfig: string;
  // printPatientSticker: {
  //   header: {
  //     showBarcode: boolean;
  //     showLogo: boolean;
  //     logo: string;
  //   };
  //   printStickerFields: {
  //     fields: Array<AllowedPatientFields>;
  //     fieldSeparator: boolean;
  //     fieldsTableGroups: Array<Array<AllowedPatientFields>>;
  //     fieldsContainerStyleOverrides: Record<string, string | number>;
  //   };
  //   pageSize: string;
  //   printMultipleStickers: {
  //     numberOfStickers: number;
  //     stickerColumnsPerPage: number;
  //     stickerRowsPerPage: number;
  //   };
  //   stickerSize: {
  //     height: string;
  //     width: string;
  //   };
  //   identifiersToDisplay: Array<string>;
  // };
  useRelationshipNameLink: boolean;
}
