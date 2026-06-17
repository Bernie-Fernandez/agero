export interface TrafficReviewItem {
  id: string;
  question: string;
}

// Traffic Management Review Checklist — aligned to AS 1742.3-2009
// (Manual of uniform traffic control devices — Traffic control for works on roads).
export const TRAFFIC_REVIEW_ITEMS: TrafficReviewItem[] = [
  { id: "tmp", question: "Has a Traffic Management Plan (TMP) been prepared for the works?" },
  { id: "controllers", question: "Are accredited traffic controllers provided where required?" },
  { id: "pedestrian", question: "Are pedestrian routes separated and protected from vehicle movements?" },
  { id: "signage", question: "Is temporary signage compliant with AS 1742.3-2009?" },
  { id: "barriers", question: "Are temporary barriers / delineation devices in place?" },
  { id: "permit", question: "Has a road occupation permit been obtained from VicRoads / council where required?" },
  { id: "deliveries", question: "Are delivery and loading zones controlled with a dedicated spotter?" },
  { id: "lighting", question: "Is lighting adequate for any night or low-visibility works?" },
  { id: "notification", question: "Have adjacent businesses, residents and the public been notified?" },
  { id: "review", question: "Is the TMP reviewed and updated when site conditions change?" },
];

export const AS_REFERENCE = "AS 1742.3-2009";
