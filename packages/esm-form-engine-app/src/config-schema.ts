import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  hideUnansweredQuestionsInReadonlyForms: {
    _type: Type.Boolean,
    _description:
      'Controls whether empty fields are hidden in embedded readonly forms. When true, empty non-transient fields are hidden when forms are displayed in embedded-view mode (e.g., in the Visit dashboard Encounters widget).',
    _default: false,
  },
  sessionLocationEncounterTypes: {
    _type: Type.Array,
    _elements: { _type: Type.UUID },
    _description:
      "Encounter types (uuids) whose new encounters are filed at the user's session location. Every other new encounter is filed at its visit's location, or at the session location when the visit has none. A form's own encounter location field always wins, and an edited encounter keeps its location.",
    _default: [],
  },
  excludedProviderIdentifiers: {
    _type: Type.Array,
    _elements: { _type: Type.String },
    _description:
      "Identifiers of the providers that form provider fields never offer, such as service accounts and the admin user. An entry ending with '*' matches every identifier it starts (e.g. 'service-account-*').",
    _default: [],
  },
  phq9Concepts: {
    _type: Type.Object,
    _description: 'PHQ-9 concept UUIDs for score calculation',
    _default: {
      notAtAll: '160215AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Not at all
      severalDays: '167000AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Several days
      moreThanHalf: '167001AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // More than half
      nearlyEveryDay: '167002AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Nearly every day
    },
  },
};

export interface ConfigObject {
  hideUnansweredQuestionsInReadonlyForms: boolean;
  sessionLocationEncounterTypes: Array<string>;
  excludedProviderIdentifiers: Array<string>;
  phq9Concepts: {
    notAtAll: string;
    severalDays: string;
    moreThanHalf: string;
    nearlyEveryDay: string;
  };
}
