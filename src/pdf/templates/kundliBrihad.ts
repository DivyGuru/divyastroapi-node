/**
 * Brihad Kundli (comprehensive premium kundli) report → HTML.
 *
 * Ported verbatim (design + i18n) from the server-side Go template at
 * `internal/pdf/brihad_kundli.go`. Consumes the JSON exactly as returned by
 * `GET /v1/reports/kundli/brihad` and emits a self-contained HTML document
 * ready to convert to PDF.
 *
 * This is the flagship report. The Go template renders 10 sections (each
 * guarded so absent data collapses to nothing):
 *   Cover, Birth Chart Summary (ascendant + planet table), Planetary Analysis,
 *   House Analysis, Yogas, Vimshottari Dasha, Remedies, Divisional Charts,
 *   Doshas, Predictions by Life Area, Classical Citations.
 */

import {
  esc,
  resolveBranding,
  coverBrandingHtml,
  layoutDocument,
  makeLabeler,
  type Branding,
  type RawBranding,
} from "../shared.js";

// ---------------------------------------------------------------------------
// Data shapes — JSON keys exactly as emitted by the Go struct.
//   Go field WITHOUT `json:` tag → PascalCase field name.
//   Go field WITH `json:"x"`     → "x".
// ---------------------------------------------------------------------------

/** A sign + degree pair (ascendant and every natal planet). snake_case keys. */
export interface BrihadPlacement {
  sign?: string;
  dms_within?: string;
  nakshatra?: string;
  pada?: number;
  nak_lord?: string;
}

/** One natal planet row. */
export interface BrihadPlanet {
  name?: string;
  placement?: BrihadPlacement;
  house_num?: number;
  retro?: boolean;
}

/** Cover metadata. */
export interface BrihadSubject {
  Name?: string;
  BirthDate?: string;
  BirthTime?: string;
  BirthPlace?: string;
  Lat?: number;
  Lon?: number;
}

/** One house's narrative + meta (PascalCase — no json tags in Go). */
export interface BrihadHouseSection {
  HouseNum?: number;
  LordEN?: string;
  LordHI?: string;
  LordSign?: string;
  Body?: string;
}

/** One detected yoga (PascalCase). */
export interface BrihadYoga {
  NameEN?: string;
  NameHI?: string;
  Effect?: string;
  Source?: string;
}

/** One Vimshottari Mahadasha period (PascalCase). */
export interface BrihadDashaPeriod {
  Lord?: string;
  LordHI?: string;
  StartDate?: string;
  EndDate?: string;
  DurationY?: number;
  Body?: string;
}

/** One inline remedy (PascalCase). */
export interface BrihadRemedy {
  Title?: string;
  Description?: string;
  Category?: string;
}

/** One planet's placement in a divisional chart (snake_case via json tags). */
export interface BrihadDivisionalPlanet {
  name?: string;
  sign?: string;
  house?: number;
}

/** One varga chart's render data (snake_case via json tags). */
export interface BrihadDivisional {
  varga?: string;
  name?: string;
  subtitle?: string;
  lagna_sign?: string;
  planets?: BrihadDivisionalPlanet[];
}

/** One dosha's render data (PascalCase). */
export interface BrihadDoshaEntry {
  NameEN?: string;
  NameHI?: string;
  Severity?: string;
  Body?: string;
  Source?: string;
}

/** The composite dosha block (PascalCase). Each subfield nil → absent. */
export interface BrihadDoshas {
  Mangal?: BrihadDoshaEntry | null;
  KaalSarp?: BrihadDoshaEntry | null;
  Pitra?: BrihadDoshaEntry | null;
}

/** One life-area forecast (PascalCase). */
export interface BrihadPrediction {
  Area?: string;
  Body?: string;
}

/** One classical-text reference (PascalCase). */
export interface BrihadCitation {
  Topic?: string;
  Source?: string;
  Note?: string;
}

/** The full Brihad Kundli report payload. */
export interface KundliBrihadData {
  Locale?: string;
  Branding?: RawBranding;
  Subject?: BrihadSubject;
  Ascendant?: BrihadPlacement;
  Planets?: BrihadPlanet[];
  Houses?: BrihadHouseSection[];
  Yogas?: BrihadYoga[];
  CurrentDasha?: BrihadDashaPeriod | null;
  UpcomingDashas?: BrihadDashaPeriod[];
  Remedies?: BrihadRemedy[];
  DivisionalCharts?: BrihadDivisional[];
  Doshas?: BrihadDoshas | null;
  Predictions?: BrihadPrediction[];
  Citations?: BrihadCitation[];
  GeneratedAt?: string;
}

// ---------------------------------------------------------------------------
// i18n — ported verbatim from brihadLabels (en/hi/mr).
// ---------------------------------------------------------------------------

const LABELS: Record<string, Record<string, string>> = {
  en: {
    title_brihad: "Brihad Kundli",
    subtitle_brihad: "A comprehensive Vedic astrology analysis",
    born: "Born",
    at: "at",
    in: "in",
    generated: "Generated on",
    section_chart: "Birth Chart Summary",
    section_planets_analysis: "Planetary Analysis",
    section_houses: "House Analysis",
    section_yogas: "Yogas Detected in the Chart",
    section_dashas: "Vimshottari Dasha — Life Periods",
    section_remedies: "Recommended Remedies",
    ascendant: "Ascendant",
    nakshatra: "Nakshatra",
    pada: "Pada",
    planet: "Planet",
    sign: "Sign",
    degree: "Degree",
    house: "House",
    lord: "Lord",
    current_dasha: "Current Mahadasha",
    upcoming_dashas: "Upcoming Mahadashas",
    years: "years",
    yogas_none: "No major yogas were detected for this chart configuration.",
    dashas_none: "Dasha computation is unavailable for this chart.",
    remedies_none: "No specific remedies needed at this time.",
    house_no_content: "Detailed interpretation for this house is being prepared.",
    source: "Source",
    // Phase 2 labels
    section_divisionals: "Divisional Charts",
    section_doshas: "Doshas Detected",
    section_predictions: "Predictions by Life Area",
    section_citations: "Classical Sources & Citations",
    divisional_lagna: "Lagna",
    dosha_mangal: "Mangal Dosha",
    dosha_kaalsarp: "Kaal Sarp Dosha",
    dosha_pitra: "Pitra Dosha",
    dosha_severity_present: "Present",
    dosha_severity_cancelled: "Cancelled",
    dosha_severity_mild: "Mild",
    doshas_none_detected: "No major doshas were detected for this chart configuration.",
    area_career: "Career & Profession",
    area_marriage: "Marriage & Relationships",
    area_wealth: "Wealth & Finance",
    area_health: "Health & Vitality",
    area_education: "Education & Learning",
    area_family: "Family & Home",
    predictions_none: "Personalized predictions are being prepared for this chart.",
    citations_none: "No classical citations are available for this chart yet.",
    citations_intro:
      "Each interpretation in this report is backed by a classical Vedic text. Below is the list of sources cited:",
  },
  hi: {
    title_brihad: "बृहत् कुंडली",
    subtitle_brihad: "विस्तृत वैदिक ज्योतिष विश्लेषण",
    born: "जन्म",
    at: "समय",
    in: "में",
    generated: "तैयार",
    section_chart: "जन्म कुंडली सारांश",
    section_planets_analysis: "ग्रह विश्लेषण",
    section_houses: "भाव विश्लेषण",
    section_yogas: "कुंडली में योग",
    section_dashas: "विंशोत्तरी दशा — जीवन काल",
    section_remedies: "अनुशंसित उपाय",
    ascendant: "लग्न",
    nakshatra: "नक्षत्र",
    pada: "पाद",
    planet: "ग्रह",
    sign: "राशि",
    degree: "अंश",
    house: "भाव",
    lord: "स्वामी",
    current_dasha: "वर्तमान महादशा",
    upcoming_dashas: "आगामी महादशाएँ",
    years: "वर्ष",
    yogas_none: "इस कुंडली में कोई प्रमुख योग नहीं पाया गया।",
    dashas_none: "इस कुंडली के लिए दशा गणना उपलब्ध नहीं है।",
    remedies_none: "वर्तमान में कोई विशेष उपाय आवश्यक नहीं।",
    house_no_content: "इस भाव की विस्तृत व्याख्या तैयार की जा रही है।",
    source: "स्रोत",
    // Phase 2 labels
    section_divisionals: "वर्ग कुंडलियाँ",
    section_doshas: "दोष विश्लेषण",
    section_predictions: "जीवन-क्षेत्र के अनुसार भविष्यवाणी",
    section_citations: "शास्त्रीय स्रोत एवं सन्दर्भ",
    divisional_lagna: "लग्न",
    dosha_mangal: "मंगल दोष",
    dosha_kaalsarp: "काल सर्प दोष",
    dosha_pitra: "पितृ दोष",
    dosha_severity_present: "उपस्थित",
    dosha_severity_cancelled: "निवारित",
    dosha_severity_mild: "अल्प",
    doshas_none_detected: "इस कुंडली में कोई प्रमुख दोष नहीं पाया गया।",
    area_career: "करियर एवं व्यवसाय",
    area_marriage: "विवाह एवं सम्बन्ध",
    area_wealth: "धन एवं अर्थ",
    area_health: "स्वास्थ्य एवं ओज",
    area_education: "शिक्षा एवं अधिगम",
    area_family: "परिवार एवं गृह",
    predictions_none: "इस कुंडली के लिए वैयक्तिक भविष्यवाणियाँ तैयार की जा रही हैं।",
    citations_none: "इस कुंडली के लिए अभी कोई शास्त्रीय सन्दर्भ उपलब्ध नहीं है।",
    citations_intro:
      "इस रिपोर्ट की प्रत्येक व्याख्या किसी न किसी शास्त्रीय ग्रन्थ पर आधारित है। नीचे उद्धृत स्रोतों की सूची दी गयी है:",
  },
  mr: {
    title_brihad: "बृहद् कुंडली",
    subtitle_brihad: "विस्तृत वैदिक ज्योतिष विश्लेषण",
    born: "जन्म",
    at: "वेळ",
    in: "मध्ये",
    generated: "तयार",
    section_chart: "जन्म कुंडली सारांश",
    section_planets_analysis: "ग्रह विश्लेषण",
    section_houses: "स्थान विश्लेषण",
    section_yogas: "कुंडलीतील योग",
    section_dashas: "विंशोत्तरी दशा — जीवन काल",
    section_remedies: "शिफारस केलेले उपाय",
    ascendant: "लग्न",
    nakshatra: "नक्षत्र",
    pada: "चरण",
    planet: "ग्रह",
    sign: "राशी",
    degree: "अंश",
    house: "स्थान",
    lord: "अधिपती",
    current_dasha: "वर्तमान महादशा",
    upcoming_dashas: "आगामी महादशा",
    years: "वर्षे",
    yogas_none: "या कुंडलीत कोणतेही प्रमुख योग आढळले नाहीत.",
    dashas_none: "या कुंडलीसाठी दशा गणना उपलब्ध नाही.",
    remedies_none: "सध्या कोणतेही विशेष उपाय आवश्यक नाहीत.",
    house_no_content: "या स्थानाची विस्तृत व्याख्या तयार केली जात आहे.",
    source: "स्रोत",
    // Phase 2 labels
    section_divisionals: "वर्ग कुंडल्या",
    section_doshas: "दोष विश्लेषण",
    section_predictions: "जीवन-क्षेत्रानुसार भाकीत",
    section_citations: "शास्त्रीय स्रोत आणि संदर्भ",
    divisional_lagna: "लग्न",
    dosha_mangal: "मंगल दोष",
    dosha_kaalsarp: "काल सर्प दोष",
    dosha_pitra: "पितृ दोष",
    dosha_severity_present: "उपस्थित",
    dosha_severity_cancelled: "निवारित",
    dosha_severity_mild: "अल्प",
    doshas_none_detected: "या कुंडलीत कोणताही प्रमुख दोष आढळला नाही.",
    area_career: "करिअर आणि व्यवसाय",
    area_marriage: "विवाह आणि नाती",
    area_wealth: "धन आणि अर्थ",
    area_health: "आरोग्य आणि तेज",
    area_education: "शिक्षण आणि अध्ययन",
    area_family: "कुटुंब आणि घर",
    predictions_none: "या कुंडलीसाठी वैयक्तिक भाकिते तयार केली जात आहेत.",
    citations_none: "या कुंडलीसाठी सध्या कोणतेही शास्त्रीय संदर्भ उपलब्ध नाहीत.",
    citations_intro:
      "या अहवालातील प्रत्येक व्याख्या एखाद्या शास्त्रीय ग्रंथावर आधारित आहे. खाली उद्धृत स्रोतांची यादी दिली आहे:",
  },
};

/** House number 1..12 → primary significations (ported from houseTopics). */
const HOUSE_TOPICS: Record<string, Record<number, string>> = {
  en: {
    1: "Self, Lagna, Personality",
    2: "Wealth, Family, Speech",
    3: "Siblings, Courage, Communication",
    4: "Mother, Home, Comforts",
    5: "Children, Education, Creativity",
    6: "Enemies, Health, Service",
    7: "Marriage, Partnership, Business",
    8: "Longevity, Hidden, Transformation",
    9: "Father, Fortune, Dharma",
    10: "Career, Status, Action",
    11: "Gains, Friends, Aspirations",
    12: "Loss, Liberation, Foreign",
  },
  hi: {
    1: "आत्म, लग्न, व्यक्तित्व",
    2: "धन, कुटुम्ब, वाणी",
    3: "सहोदर, साहस, संचार",
    4: "माता, गृह, सुख",
    5: "सन्तान, शिक्षा, सृजन",
    6: "शत्रु, स्वास्थ्य, सेवा",
    7: "विवाह, साझेदारी, व्यवसाय",
    8: "आयु, गुप्त, परिवर्तन",
    9: "पिता, भाग्य, धर्म",
    10: "कर्म, पद, कार्य",
    11: "लाभ, मित्र, आकांक्षा",
    12: "व्यय, मोक्ष, विदेश",
  },
  mr: {
    1: "स्व, लग्न, व्यक्तिमत्त्व",
    2: "धन, कुटुंब, वाणी",
    3: "भावंडे, धैर्य, संवाद",
    4: "माता, घर, सुख",
    5: "संतान, शिक्षण, सर्जनशीलता",
    6: "शत्रू, आरोग्य, सेवा",
    7: "विवाह, भागीदारी, व्यवसाय",
    8: "आयुष्य, गुप्त, परिवर्तन",
    9: "पिता, भाग्य, धर्म",
    10: "कर्म, पद, कार्य",
    11: "लाभ, मित्र, आकांक्षा",
    12: "व्यय, मोक्ष, परदेश",
  },
};

/** Remedy category → localized label (ported from remedyCategoryLabels). */
const REMEDY_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: { mantra: "Mantra", donation: "Donation", fast: "Fast", gemstone: "Gemstone", yantra: "Yantra" },
  hi: { mantra: "मंत्र", donation: "दान", fast: "व्रत", gemstone: "रत्न", yantra: "यंत्र" },
  mr: { mantra: "मंत्र", donation: "दान", fast: "उपवास", gemstone: "रत्न", yantra: "यंत्र" },
};

/** Per-planet generic summary (ported from planetSummaries). */
const PLANET_SUMMARIES: Record<string, Record<string, string>> = {
  en: {
    Sun: "Soul, vitality, authority, father — represents the core self and life force.",
    Moon: "Mind, emotion, mother, the public — governs mental wellbeing and intuition.",
    Mars: "Energy, courage, action, siblings — drives initiative and physical strength.",
    Mercury: "Intellect, speech, learning, communication — shapes analytical capacity.",
    Jupiter: "Wisdom, fortune, dharma, teachers — expansive, benevolent, growth-bringing.",
    Venus: "Love, beauty, comforts, partnership — governs aesthetics and relationships.",
    Saturn: "Discipline, longevity, karma, hardship — slow, structured, enduring lessons.",
    Rahu: "Worldly desire, foreign, ambition — amplifies and obscures simultaneously.",
    Ketu: "Detachment, spirituality, past karma — dissolves attachment, brings insight.",
  },
  hi: {
    Sun: "आत्मा, ओज, अधिकार, पिता — आत्म और प्राण-शक्ति का प्रतिनिधित्व।",
    Moon: "मन, भाव, माता, जनता — मानसिक कल्याण एवं अंतर्ज्ञान का अधिपति।",
    Mars: "ऊर्जा, साहस, कर्म, सहोदर — पहल एवं शारीरिक बल को संचालित करता है।",
    Mercury: "बुद्धि, वाणी, अधिगम, संचार — विश्लेषणात्मक क्षमता को आकार देता है।",
    Jupiter: "ज्ञान, भाग्य, धर्म, गुरु — विस्तार, परोपकार, समृद्धि का स्रोत।",
    Venus: "प्रेम, सौन्दर्य, सुख, साझेदारी — सौंदर्यबोध एवं सम्बन्धों का अधिपति।",
    Saturn: "अनुशासन, आयु, कर्म, कठिनाई — धीमे, संरचित, स्थायी पाठ।",
    Rahu: "सांसारिक इच्छा, विदेश, महत्वाकांक्षा — साथ-साथ बढ़ाता एवं छिपाता है।",
    Ketu: "वैराग्य, अध्यात्म, पूर्व कर्म — आसक्ति को विसर्जित करता है, अंतर्दृष्टि देता है।",
  },
  mr: {
    Sun: "आत्मा, तेज, अधिकार, पिता — आत्म आणि प्राणशक्तीचे प्रतिनिधित्व.",
    Moon: "मन, भावना, माता, जनता — मानसिक स्वास्थ्य आणि अंतर्ज्ञानाचा अधिपती.",
    Mars: "ऊर्जा, धैर्य, कर्म, भावंडे — पुढाकार आणि शारीरिक बळ चालवतो.",
    Mercury: "बुद्धी, वाणी, शिक्षण, संवाद — विश्लेषणात्मक क्षमता घडवतो.",
    Jupiter: "ज्ञान, भाग्य, धर्म, गुरू — विस्तार, परोपकार, समृद्धीचा स्त्रोत.",
    Venus: "प्रेम, सौंदर्य, सुख, भागीदारी — सौंदर्यबोध आणि नात्यांचा अधिपती.",
    Saturn: "शिस्त, आयुष्य, कर्म, कष्ट — हळू, संरचित, स्थायी धडे.",
    Rahu: "सांसारिक इच्छा, परदेश, महत्त्वाकांक्षा — एकाच वेळी वाढवतो आणि लपवतो.",
    Ketu: "वैराग्य, अध्यात्म, पूर्व कर्म — आसक्ती विरघळवतो, अंतर्दृष्टी देतो.",
  },
};

// ---------------------------------------------------------------------------
// Locale-aware helpers (mirror the Go template FuncMap).
// ---------------------------------------------------------------------------

function pickLocale(loc: string | undefined): string {
  return loc && LABELS[loc] ? loc : "en";
}

function houseTopic(loc: string, n: number): string {
  return HOUSE_TOPICS[loc]?.[n] ?? HOUSE_TOPICS.en?.[n] ?? "";
}

function categoryLabel(loc: string, cat: string | undefined): string {
  const c = cat ?? "";
  return (REMEDY_CATEGORY_LABELS[loc] && REMEDY_CATEGORY_LABELS[loc][c]) ?? c;
}

function planetSummary(loc: string, name: string | undefined): string {
  const n = name ?? "";
  return PLANET_SUMMARIES[loc]?.[n] ?? PLANET_SUMMARIES.en?.[n] ?? "";
}

/** Lord label: prefer LordHI for hi/mr, else LordEN. */
function houseLordLabel(loc: string, h: BrihadHouseSection): string {
  if ((loc === "hi" || loc === "mr") && h.LordHI) return h.LordHI;
  return h.LordEN ?? "";
}

function yogaNameLabel(loc: string, y: BrihadYoga): string {
  if ((loc === "hi" || loc === "mr") && y.NameHI) return y.NameHI;
  return y.NameEN ?? "";
}

function dashaLordLabel(loc: string, d: BrihadDashaPeriod): string {
  if ((loc === "hi" || loc === "mr") && d.LordHI) return d.LordHI;
  return d.Lord ?? "";
}

/** severityLabel: look up "dosha_severity_<severity>", fall back to raw. */
function severityLabel(label: (k: string) => string, severity: string | undefined): string {
  const s = severity ?? "";
  const key = "dosha_severity_" + s;
  const found = label(key);
  return found || s;
}

/** areaLabel: look up "area_<area>", fall back to raw. */
function areaLabel(label: (k: string) => string, area: string | undefined): string {
  const a = area ?? "";
  const key = "area_" + a;
  const found = label(key);
  return found || a;
}

function anyDoshaPresent(d: BrihadDoshas | null | undefined): boolean {
  if (!d) return false;
  return !!d.Mangal || !!d.KaalSarp || !!d.Pitra;
}

// ---------------------------------------------------------------------------
// Renderer.
// ---------------------------------------------------------------------------

/** Brihad-specific CSS — appended after BASE_CSS. Mirrors the Go <style>. */
const EXTRA_CSS = `
.cover h1 { font-size: 32pt; font-weight: 700; letter-spacing: 1pt; }
.cover .subtitle { color: var(--brand-secondary); font-size: 14pt; margin-bottom: 14mm; font-style: italic; }
.cover .subject { font-size: 18pt; font-weight: 600; }
.section { page-break-before: always; margin-top: 4mm; }
.section.first { page-break-before: auto; }
.planet-block, .house-block {
  margin: 4mm 0; padding: 4mm 5mm; background: #fafafa;
  border-left: 3px solid var(--brand-primary); page-break-inside: avoid;
}
.planet-block .meta, .house-block .meta {
  color: var(--brand-secondary); font-size: 10pt; margin-bottom: 2mm;
}
.yoga-block {
  margin: 3mm 0; padding: 4mm 5mm; background: #fff7ed;
  border-left: 3px solid #ea580c; page-break-inside: avoid;
}
.yoga-block .name { font-size: 13pt; font-weight: 700; color: #ea580c; margin-bottom: 1mm; }
.yoga-block .source { color: var(--brand-secondary); font-size: 9pt; font-style: italic; margin-top: 2mm; }
.dasha-block {
  margin: 4mm 0; padding: 5mm; background: #f0fdf4;
  border-left: 4px solid #16a34a; page-break-inside: avoid;
}
.dasha-block.upcoming { background: #fafafa; border-left-color: var(--brand-secondary); }
.dasha-block .header-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; }
.dasha-block .lord { font-size: 14pt; font-weight: 700; color: var(--brand-primary); }
.dasha-block .dates { color: var(--brand-secondary); font-size: 10pt; }
.remedy-block {
  margin: 3mm 0; padding: 3mm 5mm; background: #fafafa;
  border-left: 3px solid var(--brand-secondary);
}
.remedy-block .title { font-weight: 600; margin-bottom: 1mm; }
.remedy-block .category {
  display: inline-block; padding: 1mm 3mm; background: var(--brand-secondary);
  color: #fff; font-size: 9pt; border-radius: 1mm; margin-left: 3mm; vertical-align: middle;
}
.empty-list { margin: 3mm 0; color: var(--brand-secondary); font-style: italic; }
.divisional-block { margin: 6mm 0; page-break-inside: avoid; }
.divisional-block .vsubtitle { color: var(--brand-secondary); font-style: italic; font-size: 10pt; margin: 0 0 2mm; }
.divisional-block .lagna-line { font-size: 10pt; margin-bottom: 2mm; }
.dosha-block {
  margin: 4mm 0; padding: 4mm 5mm; border-left: 4px solid #b91c1c;
  background: #fef2f2; page-break-inside: avoid;
}
.dosha-block.cancelled { border-left-color: #16a34a; background: #f0fdf4; }
.dosha-block.mild { border-left-color: #ca8a04; background: #fefce8; }
.dosha-block .header-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; }
.dosha-block .name { font-size: 13pt; font-weight: 700; color: var(--brand-primary); }
.dosha-block .severity {
  display: inline-block; padding: 1mm 3mm; font-size: 9pt; font-weight: 600;
  border-radius: 1mm; color: #fff; background: #b91c1c;
}
.dosha-block.cancelled .severity { background: #16a34a; }
.dosha-block.mild .severity { background: #ca8a04; }
.dosha-block .source { color: var(--brand-secondary); font-size: 9pt; font-style: italic; margin-top: 2mm; }
.prediction-block {
  margin: 4mm 0; padding: 4mm 5mm; background: #f5f3ff;
  border-left: 3px solid #7c3aed; page-break-inside: avoid;
}
.prediction-block h3 { margin: 0 0 2mm; color: #5b21b6; }
.citation-row { display: flex; gap: 4mm; padding: 2mm 0; border-bottom: 1px dotted #d4d4d4; font-size: 10pt; }
.citation-row .topic { width: 38%; font-weight: 600; }
.citation-row .source { width: 30%; font-style: italic; color: var(--brand-secondary); }
.citation-row .note { flex: 1; color: var(--brand-secondary); }
`;

/**
 * Render the Brihad Kundli report as a self-contained HTML document.
 *
 * @param data     The JSON returned by `GET /v1/reports/kundli/brihad`.
 * @param branding Optional caller branding overrides (merged over `data.Branding`).
 */
/**
 * Format an ISO-8601 timestamp into the `YYYY-MM-DD HH:MM UTC` shape the Go
 * template produces via `GeneratedAt.Format("2006-01-02 15:04 MST")`. Falls
 * back to the raw string if it isn't parseable.
 */
function formatGenerated(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())} UTC`;
}

export function renderKundliBrihadHtml(data: KundliBrihadData, branding?: Branding): string {
  const b = resolveBranding(data.Branding, branding);
  const loc = pickLocale(data.Locale);
  const label = makeLabeler(LABELS, loc);

  const subject = data.Subject ?? {};
  const asc = data.Ascendant ?? {};
  const planets = Array.isArray(data.Planets) ? data.Planets : [];
  const houses = Array.isArray(data.Houses) ? data.Houses : [];
  const yogas = Array.isArray(data.Yogas) ? data.Yogas : [];
  const upcoming = Array.isArray(data.UpcomingDashas) ? data.UpcomingDashas : [];
  const remedies = Array.isArray(data.Remedies) ? data.Remedies : [];
  const divisionals = Array.isArray(data.DivisionalCharts) ? data.DivisionalCharts : [];
  const predictions = Array.isArray(data.Predictions) ? data.Predictions : [];
  const citations = Array.isArray(data.Citations) ? data.Citations : [];

  const parts: string[] = [];

  // --- Cover ------------------------------------------------------------
  parts.push(`<section class="cover">
${coverBrandingHtml(b)}
<h1>${esc(label("title_brihad"))}</h1>
<div class="subtitle">${esc(label("subtitle_brihad"))}</div>
<div class="subject">${esc(subject.Name)}</div>
<div class="meta">
${esc(label("born"))} ${esc(subject.BirthDate)} ${esc(label("at"))} ${esc(subject.BirthTime)}<br>
${esc(subject.BirthPlace)}
</div>
<div class="generated">
${esc(label("generated"))} ${esc(formatGenerated(data.GeneratedAt))}
</div>
</section>`);

  // --- Section 1: Birth Chart Summary (ascendant + planet table) --------
  {
    const ascNak = esc(asc.nakshatra);
    const rows = planets
      .map((p) => {
        const pl = p.placement ?? {};
        const retro = p.retro ? " (R)" : "";
        return `<tr>
<td>${esc(p.name)}${retro}</td>
<td>${esc(pl.sign)}</td>
<td>${esc(pl.dms_within)}</td>
<td>${esc(p.house_num)}</td>
<td>${esc(pl.nakshatra)} (${esc(pl.pada)})</td>
</tr>`;
      })
      .join("\n");

    parts.push(`<section class="section first">
<h2>${esc(label("section_chart"))}</h2>
<p>
<strong>${esc(label("ascendant"))}:</strong>
${esc(asc.sign)} (${esc(asc.dms_within)}) —
${esc(label("nakshatra"))}: ${ascNak},
${esc(label("pada"))} ${esc(asc.pada)}
</p>
<table>
<thead>
<tr>
<th>${esc(label("planet"))}</th>
<th>${esc(label("sign"))}</th>
<th>${esc(label("degree"))}</th>
<th>${esc(label("house"))}</th>
<th>${esc(label("nakshatra"))}</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</section>`);
  }

  // --- Section 2: Planetary Analysis ------------------------------------
  {
    const blocks = planets
      .map((p) => {
        const pl = p.placement ?? {};
        return `<div class="planet-block">
<h3>${esc(p.name)}</h3>
<div class="meta">
${esc(pl.sign)} (${esc(pl.dms_within)}) —
${esc(label("house"))} ${esc(p.house_num)} —
${esc(label("nakshatra"))}: ${esc(pl.nakshatra)}
</div>
<p>${esc(planetSummary(loc, p.name))}</p>
</div>`;
      })
      .join("\n");

    parts.push(`<section class="section">
<h2>${esc(label("section_planets_analysis"))}</h2>
${blocks}
</section>`);
  }

  // --- Section 3: House Analysis ----------------------------------------
  {
    const blocks = houses
      .map((h) => {
        const num = h.HouseNum ?? 0;
        const lordSign = h.LordSign
          ? ` (${esc(label("in"))} ${esc(h.LordSign)})`
          : "";
        const body = h.Body
          ? `<p>${esc(h.Body)}</p>`
          : `<p class="empty-list">${esc(label("house_no_content"))}</p>`;
        return `<div class="house-block">
<h3>${esc(label("house"))} ${esc(num)} — ${esc(houseTopic(loc, num))}</h3>
<div class="meta">
${esc(label("lord"))}: ${esc(houseLordLabel(loc, h))}${lordSign}
</div>
${body}
</div>`;
      })
      .join("\n");

    parts.push(`<section class="section">
<h2>${esc(label("section_houses"))}</h2>
${blocks}
</section>`);
  }

  // --- Section 4: Yogas -------------------------------------------------
  {
    let inner: string;
    if (yogas.length) {
      inner = yogas
        .map((y) => {
          const src = y.Source
            ? `<div class="source">${esc(label("source"))}: ${esc(y.Source)}</div>`
            : "";
          return `<div class="yoga-block">
<div class="name">${esc(yogaNameLabel(loc, y))}</div>
<p>${esc(y.Effect)}</p>
${src}
</div>`;
        })
        .join("\n");
    } else {
      inner = `<p class="empty-list">${esc(label("yogas_none"))}</p>`;
    }

    parts.push(`<section class="section">
<h2>${esc(label("section_yogas"))}</h2>
${inner}
</section>`);
  }

  // --- Section 5: Dashas ------------------------------------------------
  {
    const cur = data.CurrentDasha;
    let inner = "";
    if (cur) {
      inner += `<h3>${esc(label("current_dasha"))}</h3>
<div class="dasha-block">
<div class="header-row">
<span class="lord">${esc(dashaLordLabel(loc, cur))}</span>
<span class="dates">${esc(cur.StartDate)} → ${esc(cur.EndDate)} (${esc(cur.DurationY)} ${esc(label("years"))})</span>
</div>
<p>${esc(cur.Body)}</p>
</div>`;
    }
    if (upcoming.length) {
      const blocks = upcoming
        .map(
          (d) => `<div class="dasha-block upcoming">
<div class="header-row">
<span class="lord">${esc(dashaLordLabel(loc, d))}</span>
<span class="dates">${esc(d.StartDate)} → ${esc(d.EndDate)} (${esc(d.DurationY)} ${esc(label("years"))})</span>
</div>
<p>${esc(d.Body)}</p>
</div>`,
        )
        .join("\n");
      inner += `\n<h3>${esc(label("upcoming_dashas"))}</h3>\n${blocks}`;
    }
    if (!cur) {
      inner += `\n<p class="empty-list">${esc(label("dashas_none"))}</p>`;
    }

    parts.push(`<section class="section">
<h2>${esc(label("section_dashas"))}</h2>
${inner}
</section>`);
  }

  // --- Section 6: Remedies ----------------------------------------------
  {
    let inner: string;
    if (remedies.length) {
      inner = remedies
        .map(
          (r) => `<div class="remedy-block">
<span class="title">${esc(r.Title)}</span>
<span class="category">${esc(categoryLabel(loc, r.Category))}</span>
<p>${esc(r.Description)}</p>
</div>`,
        )
        .join("\n");
    } else {
      inner = `<p class="empty-list">${esc(label("remedies_none"))}</p>`;
    }

    parts.push(`<section class="section">
<h2>${esc(label("section_remedies"))}</h2>
${inner}
</section>`);
  }

  // --- Section 7 (Phase 2): Divisional Charts ---------------------------
  if (divisionals.length) {
    const blocks = divisionals
      .map((d) => {
        const dplanets = Array.isArray(d.planets) ? d.planets : [];
        const rows = dplanets
          .map(
            (p) => `<tr>
<td>${esc(p.name)}</td>
<td>${esc(p.sign)}</td>
<td>${esc(p.house)}</td>
</tr>`,
          )
          .join("\n");
        return `<div class="divisional-block">
<h3>${esc(d.varga)} — ${esc(d.name)}</h3>
<p class="vsubtitle">${esc(d.subtitle)}</p>
<div class="lagna-line">
<strong>${esc(label("divisional_lagna"))}:</strong>
${esc(d.lagna_sign)}
</div>
<table>
<thead>
<tr>
<th>${esc(label("planet"))}</th>
<th>${esc(label("sign"))}</th>
<th>${esc(label("house"))}</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
      })
      .join("\n");

    parts.push(`<section class="section">
<h2>${esc(label("section_divisionals"))}</h2>
${blocks}
</section>`);
  }

  // --- Section 8 (Phase 2): Doshas --------------------------------------
  if (data.Doshas) {
    const d = data.Doshas;
    let inner: string;
    if (anyDoshaPresent(d)) {
      const block = (entry: BrihadDoshaEntry | null | undefined, nameKey: string): string => {
        if (!entry) return "";
        const sev = entry.Severity ?? "";
        const src = entry.Source
          ? `<div class="source">${esc(label("source"))}: ${esc(entry.Source)}</div>`
          : "";
        return `<div class="dosha-block ${esc(sev)}">
<div class="header-row">
<span class="name">${esc(label(nameKey))}</span>
<span class="severity">${esc(severityLabel(label, sev))}</span>
</div>
<p>${esc(entry.Body)}</p>
${src}
</div>`;
      };
      inner =
        block(d.Mangal, "dosha_mangal") +
        block(d.KaalSarp, "dosha_kaalsarp") +
        block(d.Pitra, "dosha_pitra");
    } else {
      inner = `<p class="empty-list">${esc(label("doshas_none_detected"))}</p>`;
    }

    parts.push(`<section class="section">
<h2>${esc(label("section_doshas"))}</h2>
${inner}
</section>`);
  }

  // --- Section 9 (Phase 2): Predictions by Life Area --------------------
  if (predictions.length) {
    const blocks = predictions
      .map(
        (p) => `<div class="prediction-block">
<h3>${esc(areaLabel(label, p.Area))}</h3>
<p>${esc(p.Body)}</p>
</div>`,
      )
      .join("\n");

    parts.push(`<section class="section">
<h2>${esc(label("section_predictions"))}</h2>
${blocks}
</section>`);
  }

  // --- Section 10 (Phase 2): Classical Citations ------------------------
  if (citations.length) {
    const rows = citations
      .map((c) => {
        const note = c.Note ? `<span class="note">${esc(c.Note)}</span>` : "";
        return `<div class="citation-row">
<span class="topic">${esc(c.Topic)}</span>
<span class="source">${esc(c.Source)}</span>
${note}
</div>`;
      })
      .join("\n");

    parts.push(`<section class="section">
<h2>${esc(label("section_citations"))}</h2>
<p>${esc(label("citations_intro"))}</p>
${rows}
</section>`);
  }

  return layoutDocument({
    lang: loc,
    title: `${label("title_brihad")} — ${subject.Name ?? ""}`,
    branding: b,
    bodyHtml: parts.join("\n\n"),
    extraCss: EXTRA_CSS,
  });
}
