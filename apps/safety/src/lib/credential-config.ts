export type CredentialConfigData = {
  acceptableIdentityTypes: string[];
  expiryRequiredTypes: string[];
  expiryWarnDays: number;
  expiryUrgentDays: number;
};

export const DEFAULT_CREDENTIAL_CONFIG: CredentialConfigData = {
  acceptableIdentityTypes: ["driver_licence", "passport", "government_id"],
  expiryRequiredTypes: [
    "driver_licence",
    "passport",
    "hrwl_scaffold",
    "hrwl_crane",
    "hrwl_forklift",
    "hrwl_ewp",
    "hrwl_dogging",
    "hrwl_rigging",
    "hrwl_confined_space",
    "hrwl_explosive",
    "hrwl_other",
    "trade_licence",
    "trade_certificate",
    "first_aid",
    "asbestos_awareness",
    "training_certificate",
  ],
  expiryWarnDays: 30,
  expiryUrgentDays: 7,
};

// All credential types grouped for admin UI
export const CREDENTIAL_TYPE_GROUPS = [
  {
    group: "Identity Documents",
    types: [
      { value: "driver_licence", label: "Driver Licence" },
      { value: "passport", label: "Passport" },
      { value: "government_id", label: "Government ID" },
    ],
  },
  {
    group: "Work Credentials",
    types: [
      { value: "white_card", label: "White Card" },
      { value: "hrwl_scaffold", label: "HRWL — Scaffolding" },
      { value: "hrwl_crane", label: "HRWL — Crane" },
      { value: "hrwl_forklift", label: "HRWL — Forklift" },
      { value: "hrwl_ewp", label: "HRWL — EWP" },
      { value: "hrwl_dogging", label: "HRWL — Dogging" },
      { value: "hrwl_rigging", label: "HRWL — Rigging" },
      { value: "hrwl_confined_space", label: "HRWL — Confined Space" },
      { value: "hrwl_explosive", label: "HRWL — Explosive Powered Tools" },
      { value: "hrwl_other", label: "HRWL — Other" },
      { value: "trade_licence", label: "Trade Licence" },
      { value: "trade_certificate", label: "Trade Certificate" },
      { value: "first_aid", label: "First Aid Certificate" },
      { value: "asbestos_awareness", label: "Asbestos Awareness" },
    ],
  },
  {
    group: "Training Certificates",
    types: [
      { value: "training_certificate", label: "Training Certificate" },
      { value: "other", label: "Other Certificate" },
    ],
  },
] as const;

export const ALL_CREDENTIAL_TYPES: ReadonlyArray<{ value: string; label: string }> =
  CREDENTIAL_TYPE_GROUPS.flatMap(
    (g) => g.types as unknown as Array<{ value: string; label: string }>,
  );

export const IDENTITY_CREDENTIAL_TYPES: ReadonlyArray<{ value: string; label: string }> =
  CREDENTIAL_TYPE_GROUPS[0].types as unknown as Array<{ value: string; label: string }>;
