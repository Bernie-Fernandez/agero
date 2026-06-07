export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  regulatory?: string;
}

export interface ChecklistCategory {
  id: string;
  label: string;
  items: ChecklistItem[];
}

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    id: "sanitary",
    label: "Sanitary & Welfare Facilities",
    items: [
      { id: "san_01", label: "Portable toilets installed and in working order", category: "sanitary" },
      { id: "san_02", label: "Toilet ratio meets minimum 1 per 15 workers (WorkSafe VIC)", category: "sanitary", regulatory: "WorkSafe VIC" },
      { id: "san_03", label: "Separate male/female facilities provided (where >10 workers of each gender)", category: "sanitary" },
      { id: "san_04", label: "Handwashing station with soap and running water / sanitiser available", category: "sanitary" },
      { id: "san_05", label: "Waste receptacles provided in welfare areas and emptied daily", category: "sanitary" },
      { id: "san_06", label: "Welfare area maintained in a clean and hygienic condition", category: "sanitary" },
    ],
  },
  {
    id: "dining",
    label: "Dining & Drinking Facilities",
    items: [
      { id: "din_01", label: "Dedicated lunch/break shelter established and protected from weather", category: "dining" },
      { id: "din_02", label: "Seating and table provided sufficient for all workers on site", category: "dining" },
      { id: "din_03", label: "Clean drinking water available (min. 1 L/worker/hour in hot conditions)", category: "dining", regulatory: "VIC OHS Regs 2017" },
    ],
  },
  {
    id: "site_office",
    label: "Site Manager Office",
    items: [
      { id: "off_01", label: "Site manager workstation set up and accessible during all work hours", category: "site_office" },
      { id: "off_02", label: "Communication device (phone or radio) available and charged", category: "site_office" },
      { id: "off_03", label: "Emergency contact list (WorkSafe, ESTA 000, building mgmt) posted at workstation", category: "site_office" },
      { id: "off_04", label: "Site plans, OHS documents, and permits accessible from workstation", category: "site_office" },
      { id: "off_05", label: "Site manager present or named deputy nominated when work is in progress", category: "site_office" },
    ],
  },
  {
    id: "first_aid",
    label: "First Aid",
    items: [
      { id: "fa_01", label: "First aid kit stocked per AS 2675 and accessible within 2 minutes travel from any work area", category: "first_aid", regulatory: "VIC OHS Regs 2017 r.5.1.3" },
      { id: "fa_02", label: "Qualified first aider name, location, and contact number displayed at first aid station", category: "first_aid" },
      { id: "fa_03", label: "First aid and incident register in place and available", category: "first_aid" },
      { id: "fa_04", label: "Route to nearest hospital and emergency services directions posted", category: "first_aid" },
      { id: "fa_05", label: "Eye wash station installed in areas where chemicals or dust are present", category: "first_aid" },
      { id: "fa_06", label: "Defibrillator (AED) present on site or within 2 minutes access if >25 workers", category: "first_aid" },
    ],
  },
  {
    id: "signin",
    label: "Sign-in & Induction Desk",
    items: [
      { id: "si_01", label: "Worker sign-in / sign-out register or QR code system is operational", category: "signin" },
      { id: "si_02", label: "Visitor register separate from worker sign-in and available", category: "signin" },
      { id: "si_03", label: "Site induction records accessible and current at sign-in desk", category: "signin" },
      { id: "si_04", label: "Current subcontractor list and their contact details available at sign-in", category: "signin" },
      { id: "si_05", label: "PCBU and emergency contact list displayed at sign-in desk", category: "signin" },
    ],
  },
  {
    id: "white_folder",
    label: "White Folder & Documentation",
    items: [
      { id: "wf_01", label: "OHS White Folder assembled with all site-specific content", category: "white_folder" },
      { id: "wf_02", label: "Emergency evacuation plan and fire warden list current in white folder", category: "white_folder" },
      { id: "wf_03", label: "Principal Contractor WHS Management Plan current, signed, and filed", category: "white_folder", regulatory: "VIC OHS Act 2004 s.26" },
      { id: "wf_04", label: "SWMS for all current trades on site reviewed, approved, and on file", category: "white_folder", regulatory: "VIC OHS Regs 2017 r.5.1.13" },
      { id: "wf_05", label: "Current subcontractor insurance certificates filed and within expiry", category: "white_folder" },
      { id: "wf_06", label: "Incident/near-miss reporting forms available and location communicated to workers", category: "white_folder" },
    ],
  },
  {
    id: "perimeter",
    label: "Site Perimeter & Entrance",
    items: [
      { id: "per_01", label: "Temporary hoarding/boarding installed to full site boundary", category: "perimeter", regulatory: "Building Regulations 2018" },
      { id: "per_02", label: "Hoarding structurally sound, minimum 1.8 m high, and weather-resistant", category: "perimeter" },
      { id: "per_03", label: "Site entrance clearly defined with controlled access only (no public entry)", category: "perimeter" },
      { id: "per_04", label: "Pedestrian/vehicle separation enforced at site entrance", category: "perimeter" },
      { id: "per_05", label: "Adequate lighting at entrance and all access routes during work hours", category: "perimeter" },
      { id: "per_06", label: "Entrance door/gate lockable and locked when site is unattended", category: "perimeter" },
    ],
  },
  {
    id: "building",
    label: "Building Services & Elevator Protection",
    items: [
      { id: "bld_01", label: "Building lobby floor protection (Masonite or hardboard) installed from entrance to site", category: "building" },
      { id: "bld_02", label: "Building lobby wall protection (foam/cardboard) installed on all adjacent surfaces", category: "building" },
      { id: "bld_03", label: "Lift usage schedule confirmed and documented with building management", category: "building" },
      { id: "bld_04", label: "Lift interior protection (floor pads, wall pads, threshold ramps) fitted", category: "building" },
      { id: "bld_05", label: "Goods/service lift designated exclusively for site materials (no passenger lifts)", category: "building" },
    ],
  },
  {
    id: "housekeeping",
    label: "Work Area Housekeeping & Egress",
    items: [
      { id: "hk_01", label: "All emergency exits clearly marked with illuminated/glow-in-dark signage", category: "housekeeping", regulatory: "AS 2293" },
      { id: "hk_02", label: "All egress routes and emergency exits completely unobstructed", category: "housekeeping" },
      { id: "hk_03", label: "Emergency assembly point nominated, signed, and communicated to all workers", category: "housekeeping" },
      { id: "hk_04", label: "Designated waste/debris zone established with skip bin or containment", category: "housekeeping" },
    ],
  },
  {
    id: "signage_floor",
    label: "Signage & Floor Protection",
    items: [
      { id: "sf_01", label: "PPE-mandatory safety signage installed at all site entrances", category: "signage_floor", regulatory: "VIC OHS Regs 2017 r.1.5.16" },
      { id: "sf_02", label: "Site-specific hazard signage installed (wet floor, overhead work, no-entry zones)", category: "signage_floor" },
      { id: "sf_03", label: "Noise/dust/hours-of-work signage installed and visible from common areas", category: "signage_floor" },
      { id: "sf_04", label: "No-smoking signage displayed at all entrances", category: "signage_floor" },
      { id: "sf_05", label: "Floor protection film or Masonite laid in all work areas and corridors", category: "signage_floor" },
      { id: "sf_06", label: "Floor protection edges taped and secured to prevent trip hazards", category: "signage_floor" },
    ],
  },
];

export const ALL_ITEMS: ChecklistItem[] = CHECKLIST_CATEGORIES.flatMap((c) => c.items);

// Phase 1 planning hints — one per category, shown in the planning form
export const PHASE_1_DESCRIPTIONS: Record<string, string> = {
  sanitary:
    "Portable toilets, handwashing stations, welfare area. Consider number of workers and WorkSafe VIC ratio requirements (1:15).",
  dining:
    "Lunch shelter, seating, drinking water supply. Must be weatherproof and separated from the work area.",
  site_office:
    "Site manager workstation, communication devices, emergency contacts, OHS documents. Must be accessible at all times during work.",
  first_aid:
    "First aid kit (AS 2675), qualified first aider details, eye wash, incident register, directions to nearest hospital.",
  signin:
    "Worker QR sign-in point, visitor register, induction records, subcontractor contact list. Central entry point.",
  white_folder:
    "OHS White Folder with WHS Management Plan, SWMS, insurance certificates, evacuation plan, incident forms.",
  perimeter:
    "Temporary hoarding/boarding (min 1.8 m), controlled entry gate, pedestrian/vehicle separation, site signage.",
  building:
    "Floor and wall protection in lobby and lift, goods lift booking and protection, lift interior pads.",
  housekeeping:
    "Emergency exits and egress routes clear, assembly point nominated, waste/debris containment zone.",
  signage_floor:
    "PPE-mandatory signage at entrances, hazard signage, floor protection film/Masonite in work areas and corridors.",
};
