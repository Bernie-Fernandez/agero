export interface HRWItem {
  id: string;
  label: string;
  systemActions: string;
}

export interface PsychItem {
  id: string;
  label: string;
}

export const HRW_CLASSIFICATIONS: HRWItem[] = [
  {
    id: "fall_2m",
    label: "Person falling more than 2 metres",
    systemActions:
      "Safe work procedure for working at heights; scaffold or EWP; fall arrest harness; exclusion zone below.",
  },
  {
    id: "asbestos",
    label: "Likely presence of asbestos",
    systemActions:
      "Asbestos Management Plan required; licensed asbestos assessor/removalist; air monitoring; disposal records.",
  },
  {
    id: "shaft_trench",
    label: "Work near a shaft or trench deeper than 1.5 m",
    systemActions:
      "Excavation permit; engineered shoring or batter; daily inspection register; exclusion zone.",
  },
  {
    id: "chem_lines",
    label: "Work on or near chemical, fuel or refrigerant lines",
    systemActions:
      "Isolation and lock-out/tag-out certificate; SDS/MSDS on site; spill kit; trained operator.",
  },
  {
    id: "tilt_up",
    label: "Tilt-up or precast concrete",
    systemActions:
      "Engineer-certified erection drawings; temporary propping plan; exclusion zone; crane induction.",
  },
  {
    id: "extreme_temp",
    label: "Work in areas with artificial extremes of temperature",
    systemActions:
      "Heat or cold stress management plan; acclimatisation schedule; buddy system; first aid on site.",
  },
  {
    id: "telco_tower",
    label: "Work on telecommunications towers",
    systemActions:
      "Working at heights plan; specialist licensed contractor; RF exclusion zone; rescue plan.",
  },
  {
    id: "load_bearing",
    label: "Temporary load-bearing support for structural alterations",
    systemActions:
      "Structural engineer certification; shoring design drawings; monitoring plan; daily sign-off.",
  },
  {
    id: "explosives",
    label: "Use of explosives",
    systemActions:
      "Blasting permit; licensed shotfirer; site exclusion and notification; police/regulatory authority notification.",
  },
  {
    id: "electrical",
    label: "Work on or near electrical installations",
    systemActions:
      "Electrical isolation permit (EIP); licensed electrician; test-and-tag current; RCD protection.",
  },
  {
    id: "traffic",
    label: "Work adjacent to a road, railway or traffic corridor",
    systemActions:
      "Traffic Management Plan (TMP); VicRoads permit if required; accredited traffic controllers; physical barriers.",
  },
  {
    id: "water",
    label: "Work on or near water or other liquid with risk of drowning",
    systemActions:
      "Life rings and throw bags at water's edge; spotter/observer; lifejackets; rescue procedure.",
  },
  {
    id: "demolition",
    label: "Demolition of a load-bearing structure",
    systemActions:
      "Demolition plan; structural engineer sign-off; progressive demolition sequence; dust suppression.",
  },
  {
    id: "confined_space",
    label: "Work in or near a confined space",
    systemActions:
      "Confined space permit; atmospheric testing (O₂, CO, LEL); standby person; rescue plan; entrant training.",
  },
  {
    id: "gas_mains",
    label: "Work on or near pressurised gas mains",
    systemActions:
      "Dial Before You Dig; gas isolation; trained gas-detection operator; emergency response procedure.",
  },
  {
    id: "flammable_atm",
    label: "Work in an area with contaminated or flammable atmosphere",
    systemActions:
      "Continuous atmospheric monitoring; ventilation system; hot-work permit; ignition source elimination.",
  },
  {
    id: "mobile_plant",
    label: "Work in an area with movement of powered mobile plant",
    systemActions:
      "Traffic Management Plan; dedicated spotter; physical separation of pedestrians; Plant Register entry; operator licence check.",
  },
];

export const PSYCH_HAZARDS: PsychItem[] = [
  { id: "bullying", label: "Bullying (repeated unreasonable behaviour)" },
  { id: "sexual_harassment", label: "Sexual harassment" },
  { id: "aggression", label: "Aggression or violence" },
  { id: "traumatic_content", label: "Exposure to traumatic content or events" },
  {
    id: "high_job_demands",
    label: "High job demands (schedule pressure, overtime, fatigue risk)",
  },
];
