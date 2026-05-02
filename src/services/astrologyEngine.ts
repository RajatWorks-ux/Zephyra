import type { ChartData, WesternChart, VedicChart, ChineseChart, MayanChart, CelticChart, EgyptianChart, BirthProfile } from '../types'

// ─── Math helpers ─────────────────────────────────────────────────────────────
function toRad(deg: number): number { return (deg * Math.PI) / 180 }
function toDeg(rad: number): number { return (rad * 180) / Math.PI }
function norm(deg: number): number { return ((deg % 360) + 360) % 360 }

// ─── Julian Day ───────────────────────────────────────────────────────────────
function julianDay(year: number, month: number, day: number, utcHour: number = 12): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  return jdn - 0.5 + utcHour / 24
}

// T = Julian centuries from J2000.0
function julianT(jd: number): number { return (jd - 2451545.0) / 36525 }

// ─── Sun Longitude (accurate to ~1 degree) ────────────────────────────────────
function sunLongitude(jd: number): number {
  const T = julianT(jd)
  const L0 = norm(280.46646 + 36000.76983 * T + 0.0003032 * T * T)
  const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
  const Mrad = toRad(M)
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad)
  return norm(L0 + C)
}

// ─── Moon Longitude (accurate to ~2 degrees) ──────────────────────────────────
function moonLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(218.3165 + 481267.8813 * T)
  const D = norm(297.8502 + 445267.1115 * T)
  const M = norm(357.5291 + 35999.0503 * T)
  const Mm = norm(134.9634 + 477198.8676 * T)
  const F = norm(93.2721 + 483202.0175 * T)
  const lon = L
    + 6.2888 * Math.sin(toRad(Mm))
    - 1.2742 * Math.sin(toRad(2 * D - Mm))
    + 0.6583 * Math.sin(toRad(2 * D))
    + 0.2136 * Math.sin(toRad(2 * Mm))
    - 0.1851 * Math.sin(toRad(M))
    - 0.1143 * Math.sin(toRad(2 * F))
    + 0.0588 * Math.sin(toRad(2 * Mm - 2 * D))
    + 0.0572 * Math.sin(toRad(2 * Mm + 2 * D - M))
    - 0.0538 * Math.sin(toRad(2 * D - M))
  return norm(lon)
}

// ─── Ascendant (Rising Sign) ──────────────────────────────────────────────────
function ascendant(jd: number, lat: number, lng: number): number {
  const T = julianT(jd)
  const GMST = norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T)
  const LST = norm(GMST + lng)
  const RAMC = toRad(LST)
  const E = toRad(23.4393 - 0.0130042 * T)
  const latRad = toRad(lat)
  let asc = toDeg(Math.atan2(Math.cos(RAMC), -(Math.sin(RAMC) * Math.cos(E) + Math.tan(latRad) * Math.sin(E))))
  asc = norm(asc)
  const diff = Math.abs(asc - LST)
  if (diff > 90 && diff < 270) asc = norm(asc + 180)
  return asc
}

// ─── Sign from longitude ──────────────────────────────────────────────────────
const ZODIAC = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

function getSign(lon: number): string { return ZODIAC[Math.floor(lon / 30) % 12] }

function getDegreeInSign(lon: number): number { return Math.round((lon % 30) * 10) / 10 }

// ─── Vedic (Sidereal) — Lahiri Ayanamsa ──────────────────────────────────────
function sidereal(tropicalLon: number, year: number): number {
  const ayanamsa = 23.85 + (year - 2000) * 0.014
  return norm(tropicalLon - ayanamsa)
}

// ─── 27 Nakshatras ────────────────────────────────────────────────────────────
const NAKSHATRAS = [
  { name: 'Ashwini', lord: 'Ketu' },
  { name: 'Bharani', lord: 'Venus' },
  { name: 'Krittika', lord: 'Sun' },
  { name: 'Rohini', lord: 'Moon' },
  { name: 'Mrigashira', lord: 'Mars' },
  { name: 'Ardra', lord: 'Rahu' },
  { name: 'Punarvasu', lord: 'Jupiter' },
  { name: 'Pushya', lord: 'Saturn' },
  { name: 'Ashlesha', lord: 'Mercury' },
  { name: 'Magha', lord: 'Ketu' },
  { name: 'Purva Phalguni', lord: 'Venus' },
  { name: 'Uttara Phalguni', lord: 'Sun' },
  { name: 'Hasta', lord: 'Moon' },
  { name: 'Chitra', lord: 'Mars' },
  { name: 'Swati', lord: 'Rahu' },
  { name: 'Vishakha', lord: 'Jupiter' },
  { name: 'Anuradha', lord: 'Saturn' },
  { name: 'Jyeshtha', lord: 'Mercury' },
  { name: 'Mula', lord: 'Ketu' },
  { name: 'Purva Ashadha', lord: 'Venus' },
  { name: 'Uttara Ashadha', lord: 'Sun' },
  { name: 'Shravana', lord: 'Moon' },
  { name: 'Dhanishta', lord: 'Mars' },
  { name: 'Shatabhisha', lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Jupiter' },
  { name: 'Uttara Bhadrapada', lord: 'Saturn' },
  { name: 'Revati', lord: 'Mercury' },
]

function getNakshatra(siderealMoon: number): { name: string; pada: number; lord: string } {
  const span = 360 / 27
  const idx = Math.floor(siderealMoon / span) % 27
  const pada = Math.floor((siderealMoon % span) / (span / 4)) + 1
  return { name: NAKSHATRAS[idx].name, pada, lord: NAKSHATRAS[idx].lord }
}

// ─── Vimshottari Mahadasha ────────────────────────────────────────────────────
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
}
const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']

function getMahadasha(nakshatraLord: string, birthYear: number): { mahadasha: string; period: string; antardasha: string } {
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  let elapsed = 0
  let idx = DASHA_ORDER.indexOf(nakshatraLord)
  let dashaStartAge = 0

  while (true) {
    const years = DASHA_YEARS[DASHA_ORDER[idx]]
    if (elapsed + years > age) break
    elapsed += years
    dashaStartAge = elapsed
    idx = (idx + 1) % 9
  }

  const lord = DASHA_ORDER[idx]
  const startYear = birthYear + dashaStartAge
  const endYear = startYear + DASHA_YEARS[lord]

  // Sub-period (Antardasha) — simplified: same lord
  const antardasha = DASHA_ORDER[(idx + 1) % 9]

  return {
    mahadasha: `${lord} Mahadasha`,
    period: `${startYear}–${endYear}`,
    antardasha: `${antardasha} Antardasha`,
  }
}

// ─── Chinese BaZi Four Pillars ────────────────────────────────────────────────
const STEMS = [
  'Jia (Wood+)', 'Yi (Wood-)', 'Bing (Fire+)', 'Ding (Fire-)', 'Wu (Earth+)',
  'Ji (Earth-)', 'Geng (Metal+)', 'Xin (Metal-)', 'Ren (Water+)', 'Gui (Water-)',
]
const BRANCHES = [
  'Zi (Rat)', 'Chou (Ox)', 'Yin (Tiger)', 'Mao (Rabbit)', 'Chen (Dragon)',
  'Si (Snake)', 'Wu (Horse)', 'Wei (Goat)', 'Shen (Monkey)', 'You (Rooster)',
  'Xu (Dog)', 'Hai (Pig)',
]
const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig']
const STEM_ELEMENT = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water']
const STEM_POLARITY = ['Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin']

function getChinesePillars(year: number, month: number, day: number, hour: number, jd: number): ChineseChart {
  // Year pillar (Chinese year starts ~Feb 4)
  const adjYear = (month < 2 || (month === 2 && day < 4)) ? year - 1 : year
  const yStem = ((adjYear - 4) % 10 + 10) % 10
  const yBranch = ((adjYear - 4) % 12 + 12) % 12

  // Month pillar
  const solarMonth = (month - 1 + (day < 6 ? -1 : 0) + 12) % 12
  const mStem = ((adjYear % 5) * 2 + solarMonth) % 10
  const mBranch = (solarMonth + 2) % 12

  // Day pillar — reference Jan 1.5 2000 (JD 2451545) = Geng(6) Chen(4)
  const daysDiff = Math.floor(jd - 2451545)
  const dStem = ((6 + daysDiff) % 10 + 10) % 10
  const dBranch = ((4 + daysDiff) % 12 + 12) % 12

  // Hour pillar
  const hBranch = Math.floor(((hour + 1) % 24) / 2) % 12
  const hStem = (dStem % 5 * 2 + hBranch) % 10

  return {
    animal: ANIMALS[yBranch],
    yearStem: STEMS[yStem],
    yearBranch: BRANCHES[yBranch],
    element: STEM_ELEMENT[yStem],
    polarity: STEM_POLARITY[yStem],
    dayStem: STEMS[dStem],
    dayBranch: BRANCHES[dBranch],
    hourBranch: BRANCHES[hBranch],
    yearPillar: { stem: STEMS[yStem], branch: BRANCHES[yBranch], element: STEM_ELEMENT[yStem] },
    monthPillar: { stem: STEMS[mStem], branch: BRANCHES[mBranch], element: STEM_ELEMENT[mStem] },
    dayPillar: { stem: STEMS[dStem], branch: BRANCHES[dBranch], element: STEM_ELEMENT[dStem] },
    hourPillar: { stem: STEMS[hStem], branch: BRANCHES[hBranch], element: STEM_ELEMENT[hStem] },
  }
}

// ─── Mayan Tzolkin ────────────────────────────────────────────────────────────
const MAYAN_SIGNS = [
  'Imix (Dragon)', 'Ik (Wind)', 'Akbal (Night)', 'Kan (Seed)', 'Chicchan (Serpent)',
  'Cimi (Death)', 'Manik (Deer)', 'Lamat (Star)', 'Muluc (Moon)', 'Oc (Dog)',
  'Chuen (Monkey)', 'Eb (Road)', 'Ben (Reed)', 'Ix (Jaguar)', 'Men (Eagle)',
  'Cib (Wisdom)', 'Caban (Earth)', 'Etznab (Mirror)', 'Cauac (Storm)', 'Ahau (Sun)',
]
const TONE_WORDS = [
  '', 'Unity', 'Duality', 'Activation', 'Stability', 'Radiance',
  'Equality', 'Attunement', 'Harmony', 'Intention', 'Manifestation',
  'Liberation', 'Cooperation', 'Transcendence',
]

function getMayanTzolkin(jd: number): MayanChart {
  const GMT = 584283
  const kin = ((Math.floor(jd) - GMT) % 260 + 260) % 260
  const signIdx = kin % 20
  const tone = (kin % 13) + 1
  return {
    daySign: MAYAN_SIGNS[signIdx],
    tone,
    toneKeyword: TONE_WORDS[tone],
    galacticSignature: `Tone ${tone} · ${MAYAN_SIGNS[signIdx]}`,
  }
}

// ─── Celtic Tree Calendar ─────────────────────────────────────────────────────
interface CelticEntry { name: string; keyword: string; m1: number; d1: number; m2: number; d2: number }
const CELTIC: CelticEntry[] = [
  { name: 'Silver Fir', keyword: 'Clarity and vision', m1: 12, d1: 24, m2: 1, d2: 20 },
  { name: 'Rowan', keyword: 'Protection and quickening', m1: 1, d1: 21, m2: 2, d2: 17 },
  { name: 'Ash', keyword: 'Adaptability and connection', m1: 2, d1: 18, m2: 3, d2: 17 },
  { name: 'Alder', keyword: 'Foundation and courage', m1: 3, d1: 18, m2: 4, d2: 14 },
  { name: 'Willow', keyword: 'Healing and intuition', m1: 4, d1: 15, m2: 5, d2: 12 },
  { name: 'Hawthorn', keyword: 'Patience and transformation', m1: 5, d1: 13, m2: 6, d2: 9 },
  { name: 'Oak', keyword: 'Strength and endurance', m1: 6, d1: 10, m2: 7, d2: 7 },
  { name: 'Holly', keyword: 'Balance and power', m1: 7, d1: 8, m2: 8, d2: 4 },
  { name: 'Hazel', keyword: 'Wisdom and creativity', m1: 8, d1: 5, m2: 9, d2: 1 },
  { name: 'Vine', keyword: 'Harmony and prophecy', m1: 9, d1: 2, m2: 9, d2: 29 },
  { name: 'Ivy', keyword: 'Resilience and tenacity', m1: 9, d1: 30, m2: 10, d2: 27 },
  { name: 'Reed', keyword: 'Purpose and directness', m1: 10, d1: 28, m2: 11, d2: 24 },
  { name: 'Elder', keyword: 'Renewal and endings', m1: 11, d1: 25, m2: 12, d2: 23 },
]

function getCelticTree(month: number, day: number): CelticChart {
  for (const t of CELTIC) {
    // Handle Silver Fir spanning Dec-Jan
    if (t.name === 'Silver Fir') {
      if ((month === 12 && day >= 24) || (month === 1 && day <= 20)) {
        return { treeName: t.name, oghamSymbol: 'Ailm', treeMeaning: t.keyword }
      }
      continue
    }
    const inRange =
      (month > t.m1 || (month === t.m1 && day >= t.d1)) &&
      (month < t.m2 || (month === t.m2 && day <= t.d2))
    if (inRange) {
      return { treeName: t.name, oghamSymbol: t.name.substring(0, 3).toUpperCase(), treeMeaning: t.keyword }
    }
  }
  return { treeName: 'Elder', oghamSymbol: 'RUIS', treeMeaning: 'Renewal and endings' }
}

// ─── Egyptian Decans ──────────────────────────────────────────────────────────
const DECAN_GODS = [
  'Amon-Ra', 'Amun', 'Amun-Khepri',
  'Satis', 'Anat', 'Ament',
  'Ba', 'Khnum', 'Sothis',
  'Osiris', 'Apis', 'Hathor',
  'Horus', 'Thoth', 'Wadjet',
  'Neith', 'Nekhbet', 'Atum',
  'Ra', 'Tefnut', 'Geb',
  'Nut', 'Shu', 'Set',
  'Nephthys', 'Khepri', 'Anubis',
  'Maat', 'Ptah', 'Imhotep',
  'Nefertem', 'Sekhmet', 'Bast',
  'Sobek', 'Min', 'Montu',
]

function getEgyptianDecan(sunLon: number): EgyptianChart {
  const decanNum = Math.floor(sunLon / 10) % 36
  const signIdx = Math.floor(decanNum / 3)
  const decanInSign = (decanNum % 3) + 1
  const ordinals = ['First', 'Second', 'Third']
  return {
    decanName: `${ordinals[decanInSign - 1]} Decan of ${ZODIAC[signIdx]}`,
    decanGod: DECAN_GODS[decanNum],
    decanNumber: decanNum + 1,
    sunDecan: ZODIAC[signIdx],
  }
}

// ─── Daily Cosmic Score ───────────────────────────────────────────────────────
export function getDailyScore(chartData: ChartData): number {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)

  // Moon phase age (days since last new moon)
  const knownNewMoon = julianDay(2025, 1, 29, 12) // Jan 29 2025 new moon
  const lunarCycle = 29.53
  const moonAge = ((jdToday - knownNewMoon) % lunarCycle + lunarCycle) % lunarCycle
  const moonScore = moonAge < 14.5
    ? (moonAge / 14.5) * 25
    : ((lunarCycle - moonAge) / (lunarCycle - 14.5)) * 25

  // Harmonic based on birth sun sign + day of year
  const sunSignIdx = ZODIAC.indexOf(chartData.western.sunSign)
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const harmonic = Math.sin(toRad((dayOfYear + sunSignIdx * 30) * 2.5)) * 15

  // Base from birth chart
  const moonSignIdx = ZODIAC.indexOf(chartData.western.moonSign)
  const base = 52 + ((sunSignIdx + moonSignIdx) % 8)

  return Math.max(22, Math.min(94, Math.round(base + moonScore + harmonic)))
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export function calculateChartData(birthProfile: BirthProfile): ChartData {
  const [yearStr, monthStr, dayStr] = birthProfile.birth_date.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)

  let utcHour = 12
  if (birthProfile.birth_time_known && birthProfile.birth_time) {
    const [hStr, mStr] = birthProfile.birth_time.split(':')
    const localHour = parseInt(hStr) + parseInt(mStr) / 60
    // Approximate UTC from longitude (15° per hour)
    utcHour = localHour - birthProfile.birth_lng / 15
  }

  const jd = julianDay(year, month, day, utcHour)

  const sunLon = sunLongitude(jd)
  const moonLon = moonLongitude(jd)
  const ascLon = birthProfile.birth_time_known
    ? ascendant(jd, birthProfile.birth_lat, birthProfile.birth_lng)
    : sunLon // fallback if time unknown

  const siderealMoon = sidereal(moonLon, year)
  const nakshatraData = getNakshatra(siderealMoon)
  const dashaData = getMahadasha(nakshatraData.lord, year)

  const western: WesternChart = {
    sunSign: getSign(sunLon),
    sunDegree: getDegreeInSign(sunLon),
    moonSign: getSign(moonLon),
    moonDegree: getDegreeInSign(moonLon),
    ascendant: birthProfile.birth_time_known ? getSign(ascLon) : 'Unknown',
    ascendantDegree: getDegreeInSign(ascLon),
  }

  const vedic: VedicChart = {
    rashi: getSign(sidereal(sunLon, year)),
    moonRashi: getSign(siderealMoon),
    lagna: birthProfile.birth_time_known ? getSign(sidereal(ascLon, year)) : 'Unknown',
    nakshatra: nakshatraData.name,
    nakshatraPada: nakshatraData.pada,
    mahadasha: dashaData.mahadasha,
    mahadashaPeriod: dashaData.period,
    antardasha: dashaData.antardasha,
  }

  const chinese = getChinesePillars(year, month, day, Math.round(utcHour + birthProfile.birth_lng / 15), jd)
  const mayan = getMayanTzolkin(jd)
  const celtic = getCelticTree(month, day)
  const egyptian = getEgyptianDecan(sunLon)

  return { western, vedic, chinese, mayan, celtic, egyptian, birthProfile, calculatedAt: new Date().toISOString() }
  }
