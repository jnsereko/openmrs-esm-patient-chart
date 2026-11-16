import { Type, validator, validators } from '@openmrs/esm-framework';

export const accentColors = ['purple', 'cyan', 'teal', 'magenta', 'orange', 'red', 'green', 'gray'] as const;
export type AccentColor = (typeof accentColors)[number];

export const configSchema = {
  orderEncounterType: {
    _type: Type.UUID,
    _description: 'The encounter type of the encounter encapsulating orders. Defaults to the "Order" encounter type.',
    _default: '39da3525-afe4-45ff-8977-c53b7b359158',
  },
  careSettingUuid: {
    _type: Type.UUID,
    _description: 'The UUID of the care setting for orders. Defaults to the "Outpatient" care setting.',
    _default: '6f0c9a92-6f24-11e3-af88-005056821db0',
  },
  showPrintButton: {
    _type: Type.Boolean,
    _description:
      'Determines whether or not to display a Print button in the Orders details table. If set to true, a Print button gets shown in both the orders table headers. When clicked, this button enables the user to print out the contents of the table',
    _default: false,
  },
  orderTypes: {
    _type: Type.Array,
    _elements: {
      _type: Type.Object,
      orderTypeUuid: {
        _type: Type.UUID,
        _description: 'The UUID of the order type listed in the order basket',
      },
      orderableConceptSets: {
        _type: Type.Array,
        _elements: {
          _type: Type.UUID,
        },
        _description:
          "UUIDs of concepts that represent orderable concepts. Either the `conceptClass` should be given, or the `orderableConcepts`. If the orderableConcepts are not given, then it'll search concepts by concept class.",
      },
      label: {
        _type: Type.String,
        _description:
          'The custom label to be shown for the order type. The label will be translated with the key as the label itself.',
      },
      icon: {
        _type: Type.String,
        _description: 'Icon to be shown for the order type. Icons are from the OpenMRS icon library.',
        _default: '',
      },
      accentColor: {
        _type: Type.String,
        _description: `Accent color applied to the order type's tile: icon backdrop, left border, and top border. Must be one of: ${accentColors.join(', ')}.`,
        _default: 'purple',
        _validators: [validators.oneOf(accentColors)],
      },
    },
    _description: 'List of various order types, each associated with the Java class name `org.openmrs.Order`.',
    _default: [],
  },
  showReferenceNumberField: {
    _type: Type.Boolean,
    _default: true,
    _description:
      'Whether to display the "Reference number" field in the Order form. This field maps to the accession_number property in the Order data model',
  },
  enableAddTestsDuringResultEntry: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Controls whether users can add extra tests while entering lab results in the test-results workspace.',
  },
  ordererProviderRoles: {
    _type: Type.Array,
    _description:
      'Array of provider roles uuids. If specified, the order basket shows the "Prescribing Clinician" dropdown listing all providers with one of the specified roles. (The dropdown is hidden if no providers match the role criteria.) This feature requires the providermanagement backend module. Note that, in any case, any user who can submit orders form may still do so with themselves as the prescriber.',
    _default: [],
  },
  ordererEncounterRole: {
    // a string rather than Type.UUID, so that it can be left empty
    _type: Type.String,
    _default: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
    _description:
      'The UUID of the encounter role given to the orderer on the encounter the order basket creates (defaults to the Clinician role). Leave empty to create the encounter without a provider.',
    _validators: [
      validator(
        (v: unknown) =>
          v === '' ||
          (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)),
        'Must be an encounter role UUID, or empty',
      ),
    ],
  },
  orderLocationTagName: {
    _type: Type.UUID,
    _description:
      'The name of the ordering location tag. If specified, the order baskets shows the order locations dropdown listing locations with the specified tag. The dropdown is hidden if this config value is not specified, and the order location defaults to the location of the visit, or the login location of the user when the visit has none.',
    _default: '',
  },
  enableDrugOrderFavorites: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Whether to enable the drug order favorites (pinned orders) feature',
  },
  maxPinnedDrugOrders: {
    _type: Type.Number,
    _default: 10,
    _description: 'Maximum number of pinned drug orders per user',
    _validators: [validators.inRange(1, 50)],
  },
};

export interface OrderTypeDefinition {
  label?: string;
  orderTypeUuid: string;
  orderableConceptSets: Array<string>;
  icon?: string;
  accentColor?: AccentColor;
}

export interface ConfigObject {
  orderEncounterType: string;
  careSettingUuid: string;
  showPrintButton: boolean;
  orderTypes: Array<OrderTypeDefinition>;
  showReferenceNumberField: boolean;
  enableAddTestsDuringResultEntry: boolean;
  ordererProviderRoles: Array<string>;
  ordererEncounterRole: string;
  orderLocationTagName: string;
  enableDrugOrderFavorites: boolean;
  maxPinnedDrugOrders: number;
}
