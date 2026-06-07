export interface HRWItem {
  id: string;
  question: string;
  systemActions: string;
}

export interface PsychItem {
  id: string;
  label: string;
  question: string;
  controlPrompt: string;
}

export const HRW_CLASSIFICATIONS: HRWItem[] = [
  {
    id: "fall_2m",
    question:
      "Does any work on this project involve people working at a height where a fall of more than 2 metres is possible? This includes scaffold, elevated work platforms, mezzanines, roof access, or work adjacent to open edges or voids.",
    systemActions:
      "Safe work procedure for working at heights; scaffold or EWP; fall arrest harness; exclusion zone below.",
  },
  {
    id: "asbestos",
    question:
      "Is there any known or suspected asbestos, lead paint, or other hazardous material in the existing building fabric that workers may disturb during demolition, cutting, drilling, or removal work?",
    systemActions:
      "Asbestos Management Plan required; licensed asbestos assessor/removalist; air monitoring; disposal records.",
  },
  {
    id: "shaft_trench",
    question:
      "Does this project involve any shaft, trench, pit, or floor penetration deeper than 1.5 metres where a person could fall in or be struck by a collapse?",
    systemActions:
      "Excavation permit; engineered shoring or batter; daily inspection register; exclusion zone.",
  },
  {
    id: "chem_lines",
    question:
      "Does this project involve work near or on any pressurised gas lines, hydraulic lines, fuel lines, or refrigerant pipework — including disconnection, relocation, or work in close proximity?",
    systemActions:
      "Isolation and lock-out/tag-out certificate; SDS/MSDS on site; spill kit; trained operator; gas isolation; Dial Before You Dig.",
  },
  {
    id: "tilt_up",
    question:
      "Does this project involve tilt-up panels, precast concrete elements, or any structural concrete work including slabs, beams, or columns?",
    systemActions:
      "Engineer-certified erection drawings; temporary propping plan; exclusion zone; crane induction.",
  },
  {
    id: "load_bearing",
    question:
      "Does this project involve any temporary propping, shoring, or load-bearing support structures — for example, removing a wall, altering a beam or column, or supporting a floor during alterations?",
    systemActions:
      "Structural engineer certification; shoring design drawings; monitoring plan; daily sign-off.",
  },
  {
    id: "demolition",
    question:
      "Does this project involve demolishing any load-bearing wall, column, beam, slab, or other structural element?",
    systemActions:
      "Demolition plan; structural engineer sign-off; progressive demolition sequence; dust suppression.",
  },
  {
    id: "confined_space",
    question:
      "Does this project require workers to enter any confined space — including ceiling voids, risers, plant rooms, pits, tanks, or any enclosed space where there is a risk of limited oxygen, toxic atmosphere, or engulfment?",
    systemActions:
      "Confined space permit; atmospheric testing (O₂, CO, LEL); standby person; rescue plan; entrant training.",
  },
  {
    id: "traffic",
    question:
      "Is any part of this project site establishment, delivery access, or works located adjacent to a public road, laneway, loading dock shared with traffic, or any area where vehicles or pedestrians could be affected?",
    systemActions:
      "Traffic Management Plan (TMP); VicRoads permit if required; accredited traffic controllers; physical barriers.",
  },
  {
    id: "electrical",
    question:
      "Does this project involve any high-voltage electrical work, or any work near live electrical services that cannot be isolated before work commences?",
    systemActions:
      "Electrical isolation permit (EIP); licensed electrician; test-and-tag current; RCD protection.",
  },
  {
    id: "telco_tower",
    question:
      "Does this project involve work on telecommunications towers, risers, or major cable runs?",
    systemActions:
      "Working at heights plan; specialist licensed contractor; RF exclusion zone; rescue plan.",
  },
  {
    id: "extreme_temp",
    question:
      "Does any part of this project involve work in areas of artificial extreme heat or cold — for example, in cold rooms, boiler rooms, or spaces with no ventilation during summer?",
    systemActions:
      "Heat or cold stress management plan; acclimatisation schedule; buddy system; first aid on site.",
  },
  {
    id: "explosives",
    question:
      "Does this project involve the use of explosives for any purpose including rock breaking or demolition?",
    systemActions:
      "Blasting permit; licensed shotfirer; site exclusion and notification; police/regulatory authority notification.",
  },
  {
    id: "water",
    question:
      "Is there any risk of a worker falling into water at this site — for example, near a basement that could flood, a water feature, or a site adjacent to a waterway?",
    systemActions:
      "Life rings and throw bags at water's edge; spotter/observer; lifejackets; rescue procedure.",
  },
  {
    id: "flammable_atm",
    question:
      "Is there any known or suspected contamination, gas, or flammable atmosphere in any part of this building or site — for example, from previous industrial use, underground storage tanks, or ongoing chemical processes nearby?",
    systemActions:
      "Continuous atmospheric monitoring; ventilation system; hot-work permit; ignition source elimination.",
  },
  {
    id: "mobile_plant",
    question:
      "Does this project involve forklifts, scissor lifts, boom lifts, telehandlers, concrete pumps, cranes, or any other powered mobile plant operating in areas where workers are also present on foot?",
    systemActions:
      "Traffic Management Plan; dedicated spotter; physical separation of pedestrians; Plant Register entry; operator licence check.",
  },
  {
    id: "crystalline_silica",
    question:
      "Does this project involve cutting, grinding, drilling, or polishing any engineered stone, natural stone, concrete, masonry, or ceramic products — including benchtops, tiles, bricks, or render? (Victorian requirement — introduced 2024 for crystalline silica dust exposure.)",
    systemActions:
      "Engineered stone prohibition (from 1 July 2024); wet cutting only for other stone/concrete; P2 respirator; silica dust exposure monitoring; health surveillance for at-risk workers.",
  },
];

export const PSYCH_HAZARDS: PsychItem[] = [
  {
    id: "programme_pressure",
    label: "Programme pressure and fatigue",
    question:
      "Is this project running under a compressed programme, tight client deadline, or significant penalty clause that is likely to result in extended hours, weekend work, or pressure on workers to rush their work?",
    controlPrompt:
      "What measures will be put in place to manage fatigue and schedule pressure? (e.g. realistic programme agreed with client, overtime limits, mandatory rest periods, early warning escalation to Director if programme slips)",
  },
  {
    id: "bullying",
    label: "Bullying, harassment, or aggression risk",
    question:
      "Are there any known personality conflicts between key trades on this project, between Agero staff and the client team, or between subcontractors and the building management team that could create a hostile or aggressive site environment?",
    controlPrompt:
      "What measures will be put in place? (e.g. clear site behavioural expectations in induction, defined escalation pathway, specific persons identified to report concerns to)",
  },
  {
    id: "sexual_harassment",
    label: "Sexual harassment risk",
    question:
      "Does this project have a mixed-gender workforce, client-facing requirements, or other circumstances that make sexual harassment a heightened risk compared to a standard project?",
    controlPrompt:
      "What specific measures will be in place beyond standard policy? (e.g. briefing at first toolbox meeting, anonymous reporting pathway, site manager briefed on response protocol)",
  },
  {
    id: "traumatic_content",
    label: "Exposure to traumatic events or distressing content",
    question:
      "Does this project involve demolition of a building with historical significance or trauma association, work in a healthcare or mental health setting, removal of materials that could be distressing, or any other circumstance where workers may be exposed to psychologically distressing content?",
    controlPrompt:
      "What support will be available to workers? (e.g. EAP details provided at induction, opt-out provisions for specific tasks, debrief process)",
  },
  {
    id: "isolated_work",
    label: "Isolated or remote work conditions",
    question:
      "Will any workers on this project regularly work alone, in isolated areas of the building, or on night or out-of-hours shifts where they have limited contact with other workers or supervision?",
    controlPrompt:
      "What measures are in place? (e.g. check-in schedule, buddy system, lone worker SMS check-in, supervisor site visits)",
  },
  {
    id: "role_clarity",
    label: "Role clarity and supervision",
    question:
      "Is the scope of work, chain of command, or responsibility boundaries between trades likely to be unclear or contested on this project — for example, where multiple subcontractors are working in the same space with overlapping scopes?",
    controlPrompt:
      "How will role clarity be established and maintained? (e.g. trade interface meeting before mobilisation, clear scope demarcation in subcontracts, weekly coordination meeting)",
  },
  {
    id: "client_aggression",
    label: "Client or building management aggression",
    question:
      "Has Agero had previous difficult experiences with this client, building manager, or body corporate — or is there any known reason to expect aggressive, unreasonable, or pressuring behaviour from the client side of this project?",
    controlPrompt:
      "What is the agreed protocol for managing this? (e.g. all client communications via PM only, escalation pathway to Director, documentation of all client interactions)",
  },
];
