/**
 * Sprint 14 Seed — Reference Library, Rate Library, Build-Up, Scope Templates
 * Run from repo root: node seed-sprint14.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

// Load database URL from packages/db/.env (has correct connection string)
dotenv.config({ path: "packages/db/.env" });

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ORG_ID = "a1000000-0000-0000-0000-000000000001";
const SEED_USER_ID = "b2000000-0000-0000-0000-000000000001";

// ─── Reference Library Items ─────────────────────────────────────────────────

const ITEMS = [
  // Demolition (DE) — #FF0000
  { ageroRef: "DE.DEMO.PART", displayName: "Demolish partition wall", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "DE.DEMO.CEIL", displayName: "Demolish ceiling", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "DE.DEMO.FLOOR", displayName: "Demolish floor finish", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "DE.DEMO.DOOR", displayName: "Remove door and frame", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "DE.DEMO.JNRY", displayName: "Demolish joinery", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "DE.DEMO.STRIP", displayName: "Strip out — general", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "DE.DEMO.MISC", displayName: "Demolish miscellaneous item", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "DE.DEMO.ASBS", displayName: "Asbestos removal — allow", tradeSectionCode: "DE", tradeGroupColour: "#FF0000", unit: "LS", bluebeamToolType: "polygon" },
  // Partitions (PA) — #4472C4
  { ageroRef: "PA.PART.64FH", displayName: "Partition 64mm stud full height", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.64UC", displayName: "Partition 64mm stud under ceiling", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.92FH", displayName: "Partition 92mm stud full height", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.92UC", displayName: "Partition 92mm stud under ceiling", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.150FH", displayName: "Partition 150mm stud full height", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.ACU", displayName: "Acoustic partition — enhanced spec", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.DBL", displayName: "Double-layer plasterboard partition", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.FRRD", displayName: "Fire-rated partition — 1hr", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.PART.FR2R", displayName: "Fire-rated partition — 2hr", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.CEIL.RAFT", displayName: "Suspended plasterboard ceiling", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PA.CEIL.TILE", displayName: "Suspended tile ceiling — grid", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PA.CEIL.EXP", displayName: "Exposed ceiling — make good", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PA.CEIL.BOX", displayName: "Bulkhead / ceiling box", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PA.DOOR.HCR", displayName: "Door — hollow core with frame", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PA.DOOR.SCR", displayName: "Door — solid core with frame", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PA.DOOR.GLS", displayName: "Door — glazed with aluminium frame", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PA.DOOR.SLD", displayName: "Sliding door with track", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PA.DOOR.DBL", displayName: "Double door with frame", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PA.GLZG.INT", displayName: "Internal glazing partition", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PA.GLZG.SFLT", displayName: "Sidelight glazing", tradeSectionCode: "PA", tradeGroupColour: "#4472C4", unit: "m2", bluebeamToolType: "polygon" },
  // Flooring (FL) — #70AD47
  { ageroRef: "FL.CPT.TIL", displayName: "Carpet tile", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.CPT.BRD", displayName: "Broadloom carpet", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.VNL.LVT", displayName: "LVT vinyl plank", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.VNL.SHT", displayName: "Sheet vinyl", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.TIL.PRC", displayName: "Porcelain tile — floor", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.TIL.CEL", displayName: "Ceramic tile — floor", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.POL.CON", displayName: "Polished concrete", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.EPX.FLR", displayName: "Epoxy floor coating", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.RBR.FLR", displayName: "Rubber flooring", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FL.TRN.STR", displayName: "Floor transition strip", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "FL.SKT.ALU", displayName: "Aluminium skirting", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "FL.SKT.TBR", displayName: "Timber skirting", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "FL.SKT.VNL", displayName: "Vinyl skirting", tradeSectionCode: "FL", tradeGroupColour: "#70AD47", unit: "LM", bluebeamToolType: "polyline" },
  // Electrical & Data (ED) — #FFC000
  { ageroRef: "ED.GPO.SGL", displayName: "GPO — single", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.GPO.DBL", displayName: "GPO — double", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.GPO.FLR", displayName: "Floor box — power + data", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.DATA.SGL", displayName: "Data point — single", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.DATA.DBL", displayName: "Data point — double", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.LGT.DWN", displayName: "Downlight", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.LGT.PND", displayName: "Pendant light", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.LGT.LIN", displayName: "Linear LED — suspended", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "ED.LGT.STR", displayName: "LED strip light", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "ED.LGT.EMG", displayName: "Emergency light", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.LGT.EXT", displayName: "Exit sign", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.LGT.TRK", displayName: "Track lighting", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "ED.SW.SGL", displayName: "Light switch — single", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.SW.DBL", displayName: "Light switch — double", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.TV.PNT", displayName: "TV point and bracket", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ED.COND.TRK", displayName: "Conduit / cable tray", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "ED.SBD.DBD", displayName: "Switchboard — new or upgrade allow", tradeSectionCode: "ED", tradeGroupColour: "#FFC000", unit: "LS", bluebeamToolType: "count" },
  // Painting (PT) — #ED7D31
  { ageroRef: "PT.PNT.WLL", displayName: "Paint walls — 2 coat", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.PNT.W3C", displayName: "Paint walls — 3 coat", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.PNT.CEL", displayName: "Paint ceiling", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.PNT.FET", displayName: "Feature wall paint", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.PNT.TRM", displayName: "Paint trim and doors", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PT.WLF.ACP", displayName: "Wall finish — ACP panel", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.WLF.TIL", displayName: "Wall tile", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.WLF.MIR", displayName: "Mirror", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PT.WLF.WBD", displayName: "Whiteboard / glass writing surface", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.WLF.PBD", displayName: "Pinboard / tackboard", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.WLF.CHR", displayName: "Chair rail / wall protection", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "PT.WLF.ACU", displayName: "Acoustic wall panel", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "PT.WLF.VNR", displayName: "Timber veneer wall panel", tradeSectionCode: "PT", tradeGroupColour: "#ED7D31", unit: "m2", bluebeamToolType: "polygon" },
  // Mechanical (ME) — #7030A0
  { ageroRef: "ME.MECH.DFF", displayName: "Supply air diffuser", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ME.MECH.RTN", displayName: "Return air grille", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ME.MECH.SLT", displayName: "Linear slot diffuser", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "ME.MECH.FCU", displayName: "Fan coil unit", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ME.MECH.SPL", displayName: "Split system — supply and install", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ME.MECH.DUC", displayName: "Ductwork modification — allow", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "ME.MECH.EXH", displayName: "Exhaust fan", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "ME.MECH.EXG", displayName: "Exhaust grille", tradeSectionCode: "ME", tradeGroupColour: "#7030A0", unit: "EA", bluebeamToolType: "count" },
  // Hydraulic (PH) — #FFFFFF
  { ageroRef: "PH.HYD.SIN", displayName: "Sink — supply and install", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.BSN", displayName: "Basin — supply and install", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.BTT", displayName: "Bottle trap", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.MXR", displayName: "Mixer tap", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.DRN", displayName: "Floor drain", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.HWS", displayName: "Hot water service — allow", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "LS", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.PIP", displayName: "Hydraulic pipework modification — allow", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "PH.HYD.BIL", displayName: "Billi tap — boiling and chilled", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "PH.HYD.DWR", displayName: "Dishwasher — supply and install", tradeSectionCode: "PH", tradeGroupColour: "#FFFFFF", unit: "EA", bluebeamToolType: "count" },
  // Fire Services (FI) — #FF6600
  { ageroRef: "FI.FIRE.SPR", displayName: "Sprinkler head — new or relocated", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.SMK", displayName: "Smoke detector", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.HTD", displayName: "Heat detector", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.HRN", displayName: "Alarm sounder / strobe", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.FHR", displayName: "Fire hose reel — allow", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.FEX", displayName: "Fire extinguisher — allow", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FI.FIRE.MOD", displayName: "Fire services modification — allow", tradeSectionCode: "FI", tradeGroupColour: "#FF6600", unit: "LS", bluebeamToolType: "polygon" },
  // Joinery (JO) — #5C3317
  { ageroRef: "JO.JNRY.BCH", displayName: "Bench — laminate finish", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.OHD", displayName: "Overhead cabinets", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.BSU", displayName: "Base units with doors", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.DRW", displayName: "Drawers — per unit", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "JO.JNRY.SLV", displayName: "Open shelving", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.RCP", displayName: "Reception counter", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.BQT", displayName: "Banquette seating", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "JO.JNRY.LCK", displayName: "Lockers — per door", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "JO.JNRY.KIT", displayName: "Kitchen joinery — allow", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "JO.JNRY.WRB", displayName: "Wardrobe / storage unit", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "JO.JNRY.LBR", displayName: "Library shelving unit", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "JO.JNRY.CST", displayName: "Custom joinery item — allow", tradeSectionCode: "JO", tradeGroupColour: "#5C3317", unit: "EA", bluebeamToolType: "count" },
  // Furniture & Fittings (FU/FF) — #333333
  { ageroRef: "FU.FURN.DSK", displayName: "Desk — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.FURN.CHR", displayName: "Chair — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.FURN.TBL", displayName: "Table — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.FURN.STG", displayName: "Storage unit — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.FURN.SOF", displayName: "Sofa / lounge — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.FURN.PNT", displayName: "Planter — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.WKST.MOD", displayName: "Workstation — modular", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FU.WKST.SIT", displayName: "Sit-stand desk", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "FF.FTNG.BLD", displayName: "Blinds — supply and install", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FF.FTNG.CRT", displayName: "Curtains / drapes", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "FF.FTNG.ART", displayName: "Artwork / feature item — allow", tradeSectionCode: "FU", tradeGroupColour: "#333333", unit: "EA", bluebeamToolType: "count" },
  // Signage & Wall Finishes (SI/WF) — #000000
  { ageroRef: "SI.SIGN.DOR", displayName: "Door sign — braille", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "SI.SIGN.WAY", displayName: "Wayfinding signage", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "SI.SIGN.BRD", displayName: "Branded signage — allow", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "LS", bluebeamToolType: "count" },
  { ageroRef: "SI.SIGN.FLM", displayName: "Privacy film / frosting", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "WF.WALL.VNL", displayName: "Feature wall — timber veneer", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "WF.WALL.STN", displayName: "Feature wall — stone cladding", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "WF.WALL.BRK", displayName: "Feature wall — brick slip", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "WF.WALL.GRP", displayName: "Feature wall — graphic / mural", tradeSectionCode: "SI", tradeGroupColour: "#000000", unit: "m2", bluebeamToolType: "polygon" },
  // Preliminaries (CP/IH/JC) — #92D050
  { ageroRef: "CP.PREL.MGT", displayName: "Project management — allow", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "CP.PREL.SPV", displayName: "Site supervision", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "WKS", bluebeamToolType: "polygon" },
  { ageroRef: "CP.PREL.OHD", displayName: "Overhead and margin — allow", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.EST", displayName: "Site establishment", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.PRO", displayName: "Floor protection", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.HRD", displayName: "Hoarding — temporary", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LM", bluebeamToolType: "polyline" },
  { ageroRef: "IH.SITE.PWR", displayName: "Temporary power", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.SCF", displayName: "Scaffold / access equipment", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "WKS", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.SKP", displayName: "Skip bin", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "EA", bluebeamToolType: "count" },
  { ageroRef: "IH.SITE.CLN", displayName: "Final clean", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "m2", bluebeamToolType: "polygon" },
  { ageroRef: "IH.SITE.LFT", displayName: "Lift / lobby protection", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "JC.MISC.CNT", displayName: "Contingency — allow", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "JC.MISC.BCA", displayName: "BCA / permits — allow", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
  { ageroRef: "JC.MISC.STR", displayName: "Structural engineer — allow", tradeSectionCode: "CP", tradeGroupColour: "#92D050", unit: "LS", bluebeamToolType: "polygon" },
];

// ─── Standard rates (Melbourne metro, Q1 2026) ────────────────────────────────
const STANDARD_RATES = {
  "DE.DEMO.PART": 35, "DE.DEMO.CEIL": 28, "DE.DEMO.FLOOR": 22, "DE.DEMO.DOOR": 180,
  "DE.DEMO.JNRY": 45, "DE.DEMO.STRIP": 18, "DE.DEMO.MISC": 250, "DE.DEMO.ASBS": 8500,
  "PA.PART.64FH": 185, "PA.PART.64UC": 160, "PA.PART.92FH": 210, "PA.PART.92UC": 185,
  "PA.PART.150FH": 240, "PA.PART.ACU": 280, "PA.PART.DBL": 260, "PA.PART.FRRD": 320,
  "PA.PART.FR2R": 420, "PA.CEIL.RAFT": 95, "PA.CEIL.TILE": 72, "PA.CEIL.EXP": 38,
  "PA.CEIL.BOX": 145, "PA.DOOR.HCR": 850, "PA.DOOR.SCR": 1200, "PA.DOOR.GLS": 2400,
  "PA.DOOR.SLD": 1800, "PA.DOOR.DBL": 2100, "PA.GLZG.INT": 380, "PA.GLZG.SFLT": 320,
  "FL.CPT.TIL": 65, "FL.CPT.BRD": 55, "FL.VNL.LVT": 85, "FL.VNL.SHT": 72,
  "FL.TIL.PRC": 110, "FL.TIL.CEL": 85, "FL.POL.CON": 95, "FL.EPX.FLR": 75,
  "FL.RBR.FLR": 120, "FL.TRN.STR": 28, "FL.SKT.ALU": 42, "FL.SKT.TBR": 35,
  "FL.SKT.VNL": 22,
  "ED.GPO.SGL": 185, "ED.GPO.DBL": 220, "ED.GPO.FLR": 480, "ED.DATA.SGL": 220,
  "ED.DATA.DBL": 280, "ED.LGT.DWN": 185, "ED.LGT.PND": 320, "ED.LGT.LIN": 280,
  "ED.LGT.STR": 85, "ED.LGT.EMG": 220, "ED.LGT.EXT": 280, "ED.LGT.TRK": 195,
  "ED.SW.SGL": 145, "ED.SW.DBL": 195, "ED.TV.PNT": 380, "ED.COND.TRK": 45,
  "ED.SBD.DBD": 4500,
  "PT.PNT.WLL": 18, "PT.PNT.W3C": 24, "PT.PNT.CEL": 16, "PT.PNT.FET": 28,
  "PT.PNT.TRM": 22, "PT.WLF.ACP": 180, "PT.WLF.TIL": 95, "PT.WLF.MIR": 380,
  "PT.WLF.WBD": 520, "PT.WLF.PBD": 180, "PT.WLF.CHR": 65, "PT.WLF.ACU": 220,
  "PT.WLF.VNR": 280,
  "ME.MECH.DFF": 280, "ME.MECH.RTN": 240, "ME.MECH.SLT": 320, "ME.MECH.FCU": 2800,
  "ME.MECH.SPL": 2200, "ME.MECH.DUC": 3500, "ME.MECH.EXH": 380, "ME.MECH.EXG": 180,
  "PH.HYD.SIN": 680, "PH.HYD.BSN": 580, "PH.HYD.BTT": 180, "PH.HYD.MXR": 380,
  "PH.HYD.DRN": 280, "PH.HYD.HWS": 2200, "PH.HYD.PIP": 2800, "PH.HYD.BIL": 3200,
  "PH.HYD.DWR": 1200,
  "FI.FIRE.SPR": 320, "FI.FIRE.SMK": 280, "FI.FIRE.HTD": 280, "FI.FIRE.HRN": 320,
  "FI.FIRE.FHR": 1800, "FI.FIRE.FEX": 180, "FI.FIRE.MOD": 3500,
  "JO.JNRY.BCH": 680, "JO.JNRY.OHD": 520, "JO.JNRY.BSU": 580, "JO.JNRY.DRW": 280,
  "JO.JNRY.SLV": 320, "JO.JNRY.RCP": 1200, "JO.JNRY.BQT": 1800, "JO.JNRY.LCK": 380,
  "JO.JNRY.KIT": 18000, "JO.JNRY.WRB": 2800, "JO.JNRY.LBR": 3200, "JO.JNRY.CST": 4500,
  "FU.FURN.DSK": 1200, "FU.FURN.CHR": 480, "FU.FURN.TBL": 1800, "FU.FURN.STG": 1400,
  "FU.FURN.SOF": 3200, "FU.FURN.PNT": 280, "FU.WKST.MOD": 2800, "FU.WKST.SIT": 1800,
  "FF.FTNG.BLD": 180, "FF.FTNG.CRT": 220, "FF.FTNG.ART": 1200,
  "SI.SIGN.DOR": 280, "SI.SIGN.WAY": 480, "SI.SIGN.BRD": 3500, "SI.SIGN.FLM": 95,
  "WF.WALL.VNL": 380, "WF.WALL.STN": 520, "WF.WALL.BRK": 280, "WF.WALL.GRP": 320,
  "CP.PREL.MGT": 12000, "CP.PREL.SPV": 2800, "CP.PREL.OHD": 8000,
  "IH.SITE.EST": 3500, "IH.SITE.PRO": 22, "IH.SITE.HRD": 180, "IH.SITE.PWR": 2800,
  "IH.SITE.SCF": 3200, "IH.SITE.SKP": 480, "IH.SITE.CLN": 12, "IH.SITE.LFT": 1800,
  "JC.MISC.CNT": 5000, "JC.MISC.BCA": 3500, "JC.MISC.STR": 4500,
};

// Build-up data for key items
const BUILDUP_ITEMS = {
  "PA.PART.64FH": [
    { buildUpType: "labour", description: "Partitioner — frame and track", unit: "hr", quantityPerBaseUnit: 0.35, unitRate: 95 },
    { buildUpType: "labour", description: "Plasterboard fixing", unit: "hr", quantityPerBaseUnit: 0.40, unitRate: 85 },
    { buildUpType: "material", description: "64mm steel stud and track", unit: "LM", quantityPerBaseUnit: 1.05, unitRate: 18 },
    { buildUpType: "material", description: "13mm plasterboard (both faces)", unit: "m2", quantityPerBaseUnit: 2.1, unitRate: 12 },
    { buildUpType: "material", description: "Screws, tape, compound", unit: "LS", quantityPerBaseUnit: 1, unitRate: 8 },
  ],
  "FL.CPT.TIL": [
    { buildUpType: "labour", description: "Flooring installer", unit: "hr", quantityPerBaseUnit: 0.15, unitRate: 85 },
    { buildUpType: "material", description: "Carpet tile (supply)", unit: "m2", quantityPerBaseUnit: 1.05, unitRate: 38 },
    { buildUpType: "material", description: "Adhesive and accessories", unit: "m2", quantityPerBaseUnit: 1, unitRate: 4 },
  ],
  "FL.VNL.LVT": [
    { buildUpType: "labour", description: "Flooring installer", unit: "hr", quantityPerBaseUnit: 0.18, unitRate: 85 },
    { buildUpType: "material", description: "LVT planks (supply)", unit: "m2", quantityPerBaseUnit: 1.07, unitRate: 42 },
    { buildUpType: "material", description: "Underlay and accessories", unit: "m2", quantityPerBaseUnit: 1, unitRate: 6 },
  ],
  "PA.CEIL.RAFT": [
    { buildUpType: "labour", description: "Ceiling fixer", unit: "hr", quantityPerBaseUnit: 0.45, unitRate: 90 },
    { buildUpType: "material", description: "Suspension system — rods and angles", unit: "m2", quantityPerBaseUnit: 1, unitRate: 18 },
    { buildUpType: "material", description: "13mm plasterboard", unit: "m2", quantityPerBaseUnit: 1.05, unitRate: 12 },
    { buildUpType: "material", description: "Cornices and stopping", unit: "m2", quantityPerBaseUnit: 1, unitRate: 6 },
  ],
  "PT.PNT.WLL": [
    { buildUpType: "labour", description: "Painter — 2 coat", unit: "hr", quantityPerBaseUnit: 0.10, unitRate: 75 },
    { buildUpType: "material", description: "Primer + topcoat paint", unit: "m2", quantityPerBaseUnit: 1, unitRate: 4 },
  ],
};

// ─── Default scope text per trade section ─────────────────────────────────────
function defaultScope(item) {
  const trade = item.tradeSectionCode;
  const name = item.displayName;
  if (trade === "DE") return `Supply all labour, plant and equipment to ${name.toLowerCase()} as shown on drawings. Remove all debris from site.`;
  if (trade === "PA") return `Supply and install ${name.toLowerCase()} as shown on drawings. All work to comply with relevant Australian Standards.`;
  if (trade === "FL") return `Supply and install ${name.toLowerCase()} as indicated on drawings and finishes schedule. Include all necessary preparation, adhesives, and accessories.`;
  if (trade === "ED") return `Supply and install ${name.toLowerCase()} as shown on electrical drawings. All work to AS/NZS 3000 Wiring Rules.`;
  if (trade === "PT") return `Supply and install ${name.toLowerCase()} as shown on drawings. Include preparation, priming, and finishing coats.`;
  if (trade === "ME") return `Supply and install ${name.toLowerCase()} as shown on mechanical drawings. Coordinate with existing services.`;
  if (trade === "PH") return `Supply and install ${name.toLowerCase()} as shown on hydraulic drawings. Include all connections and testing.`;
  if (trade === "FI") return `Supply and install ${name.toLowerCase()} as shown on fire services drawings. All work to BCA and relevant fire standards.`;
  if (trade === "JO") return `Supply and install ${name.toLowerCase()} as shown on drawings and joinery schedule. Include all hardware, fixings, and finishing.`;
  if (trade === "FU") return `Supply and install ${name.toLowerCase()} as shown on furniture plan. Coordinate delivery and installation with site program.`;
  if (trade === "SI") return `Supply and install ${name.toLowerCase()} as shown on drawings. Coordinate with brand guidelines where applicable.`;
  if (trade === "CP") return `Allow for ${name.toLowerCase()} for the duration of the works as agreed with the Principal.`;
  return `Supply and install ${name.toLowerCase()} as shown on drawings and specifications.`;
}

async function main() {
  const client = await pool.connect();

  try {
    // Check if already seeded
    const check = await client.query(
      `SELECT COUNT(*) FROM projects.reference_library_items WHERE organisation_id = $1`,
      [ORG_ID]
    );
    const existing = parseInt(check.rows[0].count);
    if (existing > 0) {
      console.log(`Skip: ${existing} reference library items already exist for this org.`);
    } else {
      console.log("Seeding Reference Library items...");
      let itemCount = 0;
      for (let i = 0; i < ITEMS.length; i++) {
        const item = ITEMS[i];
        const scope = defaultScope(item);
        await client.query(
          `INSERT INTO projects.reference_library_items
           (id, organisation_id, agero_ref, display_name, trade_section_code, trade_group_colour, unit, bluebeam_tool_type, default_scope_text, is_active, sort_order, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, $9, now(), now())`,
          [ORG_ID, item.ageroRef, item.displayName, item.tradeSectionCode, item.tradeGroupColour, item.unit, item.bluebeamToolType, scope, i]
        );
        itemCount++;
      }
      console.log(`Inserted ${itemCount} reference library items.`);
    }

    // Seed rates
    const rateCheck = await client.query(
      `SELECT COUNT(*) FROM projects.reference_library_rates
       WHERE organisation_id = $1`,
      [ORG_ID]
    );
    if (parseInt(rateCheck.rows[0].count) > 0) {
      console.log("Skip: rates already seeded.");
    } else {
      console.log("Seeding standard rates...");
      const items = await client.query(
        `SELECT id, agero_ref FROM projects.reference_library_items WHERE organisation_id = $1`,
        [ORG_ID]
      );
      let rateCount = 0;
      for (const row of items.rows) {
        const rate = STANDARD_RATES[row.agero_ref] ?? 100;
        await client.query(
          `INSERT INTO projects.reference_library_rates
           (id, reference_item_id, organisation_id, rate_type, unit_cost, effective_from, updated_by_id, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'standard', $3, now(), $4, now())`,
          [row.id, ORG_ID, rate, SEED_USER_ID]
        );
        rateCount++;
      }
      console.log(`Inserted ${rateCount} standard rates.`);
    }

    // Seed build-ups
    const buCheck = await client.query(
      `SELECT COUNT(*) FROM projects.reference_library_build_ups`,
    );
    if (parseInt(buCheck.rows[0].count) > 0) {
      console.log("Skip: build-ups already seeded.");
    } else {
      console.log("Seeding build-ups...");
      let buCount = 0;
      for (const [ageroRef, rows] of Object.entries(BUILDUP_ITEMS)) {
        const itemRow = await client.query(
          `SELECT id FROM projects.reference_library_items WHERE organisation_id = $1 AND agero_ref = $2`,
          [ORG_ID, ageroRef]
        );
        if (!itemRow.rows[0]) continue;
        const itemId = itemRow.rows[0].id;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const calc = parseFloat(r.quantityPerBaseUnit) * parseFloat(r.unitRate);
          await client.query(
            `INSERT INTO projects.reference_library_build_ups
             (id, reference_item_id, build_up_type, description, unit, quantity_per_base_unit, unit_rate, calculated_cost, sort_order)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
            [itemId, r.buildUpType, r.description, r.unit, r.quantityPerBaseUnit, r.unitRate, calc.toFixed(4), i]
          );
          buCount++;
        }
      }
      console.log(`Inserted ${buCount} build-up rows.`);
    }

    // Seed scope templates
    const stCheck = await client.query(
      `SELECT COUNT(*) FROM projects.scope_templates WHERE organisation_id = $1`,
      [ORG_ID]
    );
    if (parseInt(stCheck.rows[0].count) > 0) {
      console.log("Skip: scope templates already seeded.");
    } else {
      console.log("Seeding scope templates...");
      const items = await client.query(
        `SELECT id, agero_ref, trade_section_code, default_scope_text FROM projects.reference_library_items WHERE organisation_id = $1`,
        [ORG_ID]
      );
      let stCount = 0;
      for (const row of items.rows) {
        await client.query(
          `INSERT INTO projects.scope_templates
           (id, organisation_id, reference_item_id, trade_section_code, scope_text, is_active, version, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 1, now())`,
          [ORG_ID, row.id, row.trade_section_code, row.default_scope_text || `Supply and install ${row.agero_ref} as specified.`]
        );
        stCount++;
      }
      console.log(`Inserted ${stCount} scope templates.`);
    }

    console.log("Sprint 14 seed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
