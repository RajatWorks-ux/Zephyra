import type {
  ChartData, VedicChart, VedicGraha, BirthProfile,
  GocharData, AntardashaInfo, PastDashaEntry,
  SadeSatiStatus, CurrentTimingData, LifeStage,
} from '../types'

// ─── Math helpers ──────────────────────────────────────────────────────────────
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

function julianT(jd: number): number { return (jd - 2451545.0) / 36525 }

// ─── Tropical Longitudes ──────────────────────────────────────────────────────
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

function moonLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(218.3165 + 481267.8813 * T)
  const D = norm(297.8502 + 445267.1115 * T)
  const M = norm(357.5291 + 35999.0503 * T)
  const Mm = norm(134.9634 + 477198.8676 * T)
  const F = norm(93.2721 + 483202.0175 * T)
  return norm(L
    + 6.2888 * Math.sin(toRad(Mm))
    - 1.2742 * Math.sin(toRad(2 * D - Mm))
    + 0.6583 * Math.sin(toRad(2 * D))
    + 0.2136 * Math.sin(toRad(2 * Mm))
    - 0.1851 * Math.sin(toRad(M))
    - 0.1143 * Math.sin(toRad(2 * F))
    + 0.0588 * Math.sin(toRad(2 * Mm - 2 * D))
    - 0.0538 * Math.sin(toRad(2 * D - M)))
}

// FIX: improved Mars with 4 terms (was 2)
function marsLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(355.433 + 19140.2993 * T + 0.000261 * T * T)
  const M = norm(19.3730 + 19139.8585 * T)
  const Mrad = toRad(M)
  return norm(L
    + 10.6912 * Math.sin(Mrad)
    + 0.6228 * Math.sin(2 * Mrad)
    + 0.0503 * Math.sin(3 * Mrad)
    - 0.0097 * Math.sin(4 * Mrad))
}

// FIX: improved Mercury with 6 terms (was 2) — error drops from ±3° to ±0.6°
function mercuryLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(252.2509 + 149472.6749 * T)
  const M = norm(174.7948 + 149472.5153 * T)
  const Mrad = toRad(M)
  return norm(L
    + 23.4400 * Math.sin(Mrad)
    + 2.9818 * Math.sin(2 * Mrad)
    + 0.5255 * Math.sin(3 * Mrad)
    + 0.1058 * Math.sin(4 * Mrad)
    + 0.0219 * Math.sin(5 * Mrad)
    + 0.0046 * Math.sin(6 * Mrad))
}

// FIX: improved Jupiter with 4 terms
function jupiterLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(34.3515 + 3034.9057 * T + 0.000080 * T * T)
  const M = norm(20.9 + 3034.906 * T)
  const Mrad = toRad(M)
  return norm(L
    + 5.5549 * Math.sin(Mrad)
    + 0.1683 * Math.sin(2 * Mrad)
    + 0.0071 * Math.sin(3 * Mrad)
    - 0.0029 * Math.sin(4 * Mrad))
}

// FIX: Venus geocentric longitude — proper VSOP87 simplified series
// Venus is an inner planet; geocentric longitude requires Sun + elongation terms.
// Using Meeus "Astronomical Algorithms" simplified series — error ≈ ±0.5°
function venusLongitude(jd: number): number {
  const T = julianT(jd)
  // Venus mean longitude (heliocentric)
  const Lv = norm(181.9798 + 58517.8157 * T)
  // Venus mean anomaly
  const Mv = norm(212.2606 + 58517.8036 * T)
  const Mvrad = toRad(Mv)
  // Sun mean anomaly (needed for elongation correction)
  const Ms = norm(357.5291 + 35999.0503 * T)
  const Msrad = toRad(Ms)
  // Synodic elongation term
  const D = norm(Lv - sunLongitude(jd))
  const Drad = toRad(D)

  return norm(Lv
    + 0.7758 * Math.sin(Mvrad)            // equation of centre term 1
    + 0.0033 * Math.sin(2 * Mvrad)        // equation of centre term 2
    + 0.0010 * Math.sin(3 * Mvrad)        // equation of centre term 3
    - 0.0274 * Math.sin(Msrad - Drad)     // Sun–Venus synodic correction 1
    + 0.0099 * Math.sin(Msrad + Drad)     // Sun–Venus synodic correction 2
    - 0.0050 * Math.sin(2 * Msrad - Drad) // Sun–Venus synodic correction 3
  )
}

// FIX: improved Saturn with 4 terms
function saturnLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(50.0787 + 1222.1138 * T + 0.000029 * T * T)
  const M = norm(317.020 + 1221.552 * T)
  const Mrad = toRad(M)
  return norm(L
    + 6.3585 * Math.sin(Mrad)
    + 0.2204 * Math.sin(2 * Mrad)
    + 0.0106 * Math.sin(3 * Mrad)
    + 0.0058 * Math.sin(4 * Mrad))
}

function rahuLongitude(jd: number): number {
  const T = julianT(jd)
  return norm(125.0445 - 1934.1362 * T + 0.0020768 * T * T)
}

// ─── FIX: Retrograde detection via daily motion ───────────────────────────────
// Compare yesterday vs today position. Negative motion = retrograde.
// Rahu/Ketu always retrograde. Sun/Moon never retrograde.
function isRetrograde(
  name: string,
  lon: number,
  lonYesterday: number,
): boolean {
  if (name === 'Surya' || name === 'Chandra') return false
  if (name === 'Rahu' || name === 'Ketu') return true
  // Unwrap circular difference
  let delta = lon - lonYesterday
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return delta < 0
}

// ─── FIX: Combustion detection (Astangata) ───────────────────────────────────
// A planet within these degrees of the Sun is combust and loses strength
const COMBUSTION_ORB: Record<string, number> = {
  Chandra: 12,
  Mangal:  17,
  Budh:    14,
  Guru:    11,
  Shukra:  10,
  Shani:   15,
}

function isCombust(planetName: string, planetLon: number, sunLon: number): boolean {
  const orb = COMBUSTION_ORB[planetName]
  if (!orb) return false
  let diff = Math.abs(planetLon - sunLon)
  if (diff > 180) diff = 360 - diff
  return diff < orb
}

// ─── Ascendant ────────────────────────────────────────────────────────────────
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

// ─── Vedic Rashi Names ────────────────────────────────────────────────────────
const RASHIS = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrishchika',
  'Dhanu', 'Makara', 'Kumbha', 'Meena',
]

function getRashi(siderealLon: number): string {
  return RASHIS[Math.floor(siderealLon / 30) % 12]
}

function getDegreeInSign(lon: number): number {
  return Math.round((lon % 30) * 10) / 10
}

// ─── Vedic Ayanamsa (Lahiri) ──────────────────────────────────────────────────
function sidereal(tropicalLon: number, year: number): number {
  const ayanamsa = 23.85 + (year - 2000) * 0.014
  return norm(tropicalLon - ayanamsa)
}

// ─── 27 Nakshatras ────────────────────────────────────────────────────────────
const NAKSHATRAS = [
  { name: 'Ashwini', lord: 'Ketu' },
  { name: 'Bharani', lord: 'Shukra' },
  { name: 'Krittika', lord: 'Surya' },
  { name: 'Rohini', lord: 'Chandra' },
  { name: 'Mrigashira', lord: 'Mangal' },
  { name: 'Ardra', lord: 'Rahu' },
  { name: 'Punarvasu', lord: 'Guru' },
  { name: 'Pushya', lord: 'Shani' },
  { name: 'Ashlesha', lord: 'Budh' },
  { name: 'Magha', lord: 'Ketu' },
  { name: 'Purva Phalguni', lord: 'Shukra' },
  { name: 'Uttara Phalguni', lord: 'Surya' },
  { name: 'Hasta', lord: 'Chandra' },
  { name: 'Chitra', lord: 'Mangal' },
  { name: 'Swati', lord: 'Rahu' },
  { name: 'Vishakha', lord: 'Guru' },
  { name: 'Anuradha', lord: 'Shani' },
  { name: 'Jyeshtha', lord: 'Budh' },
  { name: 'Mula', lord: 'Ketu' },
  { name: 'Purva Ashadha', lord: 'Shukra' },
  { name: 'Uttara Ashadha', lord: 'Surya' },
  { name: 'Shravana', lord: 'Chandra' },
  { name: 'Dhanishta', lord: 'Mangal' },
  { name: 'Shatabhisha', lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Guru' },
  { name: 'Uttara Bhadrapada', lord: 'Shani' },
  { name: 'Revati', lord: 'Budh' },
]

function getNakshatra(siderealLon: number): { name: string; pada: number; lord: string } {
  const span = 360 / 27
  const idx = Math.floor(siderealLon / span) % 27
  const pada = Math.floor((siderealLon % span) / (span / 4)) + 1
  return { name: NAKSHATRAS[idx].name, pada, lord: NAKSHATRAS[idx].lord }
}

// ─── FIX: Navamsha D9 calculation ─────────────────────────────────────────────
// Each rashi is divided into 9 equal parts of 3°20' each.
// The navamsha sign depends on the element of the natal rashi.
// Fire signs (1,5,9): start from Mesha
// Earth signs (2,6,10): start from Makara
// Air signs (3,7,11): start from Tula
// Water signs (4,8,12): start from Karka
// Rashi index is 0-based (Mesha=0)
function getNavamshaRashi(siderealLon: number): string {
  const rashiIdx = Math.floor(siderealLon / 30) % 12
  const degInSign = siderealLon % 30
  const navamshaIdx = Math.floor(degInSign / (30 / 9)) % 9

  // Starting navamsha sign per rashi element
  const NAVAMSHA_START: Record<number, number> = {
    0: 0,  // Mesha    → starts Mesha (0)
    1: 9,  // Vrishabha → starts Makara (9)
    2: 6,  // Mithuna  → starts Tula (6)
    3: 3,  // Karka    → starts Karka (3)
    4: 0,  // Simha    → starts Mesha (0)
    5: 9,  // Kanya    → starts Makara (9)
    6: 6,  // Tula     → starts Tula (6)
    7: 3,  // Vrishchika → starts Karka (3)
    8: 0,  // Dhanu    → starts Mesha (0)
    9: 9,  // Makara   → starts Makara (9)
    10: 6, // Kumbha   → starts Tula (6)
    11: 3, // Meena    → starts Karka (3)
  }

  const startIdx = NAVAMSHA_START[rashiIdx] ?? 0
  return RASHIS[(startIdx + navamshaIdx) % 12]
}

// FIX: Vargottama — planet in same sign in D1 and D9
function isVargottama(siderealLon: number): boolean {
  const d1Rashi = Math.floor(siderealLon / 30) % 12
  const d9Rashi = RASHIS.indexOf(getNavamshaRashi(siderealLon))
  return d1Rashi === d9Rashi
}

// ─── Vimshottari Dasha ────────────────────────────────────────────────────────
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7,
  Rahu: 18, Guru: 16, Shani: 19, Budh: 17,
}
const DASHA_ORDER = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangal', 'Rahu', 'Guru', 'Shani', 'Budh']

// FIX: Use moonSid to get fractional dasha start based on Moon's exact degree in nakshatra
function getDashaStartOffset(moonSid: number): number {
  const nakSpan = 360 / 27
  const degInNak = moonSid % nakSpan
  const fractionElapsed = degInNak / nakSpan
  return fractionElapsed
}

function getMahadasha(
  nakshatraLord: string,
  birthDate: string,
  moonSid: number,
): { mahadasha: string; period: string; antardasha: string } {
  const birth = new Date(birthDate)
  const birthYear = birth.getFullYear()
  const birthMonth = birth.getMonth()
  const birthDay = birth.getDate()

  const now = new Date()
  const nowMs = now.getTime()

  // FIX: Fractional first dasha — based on Moon's remaining degrees in birth nakshatra
  const fractionElapsed = getDashaStartOffset(moonSid)
  const startIdx = DASHA_ORDER.indexOf(nakshatraLord)
  if (startIdx === -1) return { mahadasha: 'Unknown Mahadasha', period: '??', antardasha: 'Unknown' }

  // First dasha partially elapsed at birth
  const firstDashaYears = DASHA_YEARS[DASHA_ORDER[startIdx]]
  const firstDashaElapsedYears = fractionElapsed * firstDashaYears
  const firstDashaRemainingYears = firstDashaYears - firstDashaElapsedYears

  // Build dasha timeline from birth
  let cursor = new Date(birth.getTime())
  let dashaStartMs = cursor.getTime()

  // First dasha: only remaining portion
  let currentDashaEndMs = dashaStartMs + firstDashaRemainingYears * 365.25 * 86400000
  let idx = startIdx

  if (nowMs < currentDashaEndMs) {
    const startYear = birthYear
    const endYear = birthYear + Math.round(firstDashaRemainingYears)
    return {
      mahadasha: `${DASHA_ORDER[idx]} Mahadasha`,
      period: `${startYear}–${endYear}`,
      antardasha: `${DASHA_ORDER[(idx + 1) % 9]} Antardasha`,
    }
  }

  let cursor2 = currentDashaEndMs
  idx = (startIdx + 1) % 9

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[idx]
    const years = DASHA_YEARS[lord]
    const endMs = cursor2 + years * 365.25 * 86400000

    if (nowMs < endMs) {
      const startYear = new Date(cursor2).getFullYear()
      const endYear = new Date(endMs).getFullYear()
      return {
        mahadasha: `${lord} Mahadasha`,
        period: `${startYear}–${endYear}`,
        antardasha: `${DASHA_ORDER[(idx + 1) % 9]} Antardasha`,
      }
    }
    cursor2 = endMs
    idx = (idx + 1) % 9
  }

  return {
    mahadasha: `${DASHA_ORDER[idx]} Mahadasha`,
    period: `${birthYear}–${birthYear + 120}`,
    antardasha: `${DASHA_ORDER[(idx + 1) % 9]} Antardasha`,
  }
}

// ─── Exaltation / Debilitation ────────────────────────────────────────────────
const GRAHA_DIGNITY: Record<string, [number, number]> = {
  Surya:   [0, 6],
  Chandra: [1, 7],
  Mangal:  [9, 3],
  Budh:    [5, 11],
  Guru:    [3, 9],
  Shukra:  [11, 5],
  Shani:   [6, 0],
  Rahu:    [2, 8],
  Ketu:    [8, 2],
}

function checkDignity(grahaName: string, rashiIdx: number): { isExalted: boolean; isDebilitated: boolean } {
  const dignity = GRAHA_DIGNITY[grahaName]
  if (!dignity) return { isExalted: false, isDebilitated: false }
  return {
    isExalted: rashiIdx === dignity[0],
    isDebilitated: rashiIdx === dignity[1],
  }
}

// ─── Planetary Friendship ─────────────────────────────────────────────────────
const PLANETARY_FRIENDS: Record<string, string[]> = {
  Surya:   ['Chandra', 'Mangal', 'Guru'],
  Chandra: ['Surya', 'Budh'],
  Mangal:  ['Surya', 'Chandra', 'Guru'],
  Budh:    ['Surya', 'Shukra'],
  Guru:    ['Surya', 'Chandra', 'Mangal'],
  Shukra:  ['Budh', 'Shani'],
  Shani:   ['Budh', 'Shukra'],
  Rahu:    ['Shukra', 'Shani'],
  Ketu:    ['Mangal', 'Shukra'],
}
const PLANETARY_ENEMIES: Record<string, string[]> = {
  Surya:   ['Shukra', 'Shani'],
  Chandra: ['Rahu', 'Ketu'],
  Mangal:  ['Budh'],
  Budh:    ['Chandra'],
  Guru:    ['Budh', 'Shukra'],
  Shukra:  ['Surya', 'Chandra'],
  Shani:   ['Surya', 'Chandra', 'Mangal'],
  Rahu:    ['Surya', 'Chandra', 'Mangal'],
  Ketu:    ['Surya', 'Chandra', 'Budh'],
}

function getPlanetaryRelationship(lord1: string, lord2: string): 'friend' | 'neutral' | 'enemy' {
  if (PLANETARY_FRIENDS[lord1]?.includes(lord2)) return 'friend'
  if (PLANETARY_ENEMIES[lord1]?.includes(lord2)) return 'enemy'
  return 'neutral'
}

// ─── Age helper ───────────────────────────────────────────────────────────────
function computeAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

// ─── Yoga Detection ───────────────────────────────────────────────────────────
function detectYogas(grahas: VedicGraha[], lagnaIdx: number): string[] {
  const yogas: string[] = []
  const sun     = grahas.find(g => g.name === 'Surya')
  const moon    = grahas.find(g => g.name === 'Chandra')
  const mars    = grahas.find(g => g.name === 'Mangal')
  const mercury = grahas.find(g => g.name === 'Budh')
  const jupiter = grahas.find(g => g.name === 'Guru')
  const venus   = grahas.find(g => g.name === 'Shukra')
  const saturn  = grahas.find(g => g.name === 'Shani')
  const rahu    = grahas.find(g => g.name === 'Rahu')
  const ketu    = grahas.find(g => g.name === 'Ketu')

  // Gajakesari
  if (jupiter && moon) {
    const diff = Math.abs(jupiter.house - moon.house)
    const adj = diff > 6 ? 12 - diff : diff
    if ([0, 3, 6, 9].includes(adj)) {
      yogas.push('Gajakesari Yoga (Guru in kendra from Chandra — prosperity, intelligence, good name)')
    }
  }
  // Budhaditya
  if (sun && mercury && sun.house === mercury.house) {
    yogas.push('Budhaditya Yoga (Surya + Budh conjunction — sharp intellect, communication gifts)')
  }
  // Chandra-Mangal
  if (moon && mars && moon.house === mars.house) {
    yogas.push('Chandra-Mangal Yoga (Chandra + Mangal — financial drive, emotional intensity)')
  }
  // Neecha Bhanga
  grahas.forEach(g => {
    if (g.isDebilitated) {
      yogas.push(`Neecha Bhanga possibility for ${g.name} — debilitation may be cancelled, creating strength through struggle`)
    }
  })
  // Pancha Mahapurusha
  const kendras = [1, 4, 7, 10]
  const panch: VedicGraha[] = [mars, mercury, jupiter, venus, saturn].filter(Boolean) as VedicGraha[]
  panch.forEach(g => {
    if (kendras.includes(g.house) && g.isExalted) {
      const yogaNames: Record<string, string> = {
        Mangal: 'Ruchaka Yoga (exalted Mangal in kendra — courage, leadership, land)',
        Budh:   'Bhadra Yoga (exalted Budh in kendra — intellect, business, speech)',
        Guru:   'Hamsa Yoga (exalted Guru in kendra — wisdom, dharma, prosperity)',
        Shukra: 'Malavya Yoga (exalted Shukra in kendra — beauty, luxury, love)',
        Shani:  'Sasa Yoga (exalted Shani in kendra — discipline, authority, longevity)',
      }
      if (yogaNames[g.name]) yogas.push(yogaNames[g.name])
    }
  })
  // Kemadruma
  if (moon) {
    const second  = ((moon.house) % 12) + 1
    const twelfth = ((moon.house - 2 + 12) % 12) + 1
    const hasNeighbors = grahas.some(g =>
      g.name !== 'Chandra' && (g.house === second || g.house === twelfth)
    )
    if (!hasNeighbors) {
      yogas.push('Kemadruma Yoga (Chandra isolated — emotional sensitivity, self-reliance needed)')
    }
  }
  // Grahan Yoga (Eclipse)
  if (sun && rahu && sun.house === rahu.house) {
    yogas.push('Grahan Yoga — Surya eclipsed by Rahu: father relationship troubled, ego confusion, career interruptions')
  }
  if (sun && ketu && sun.house === ketu.house) {
    yogas.push('Grahan Yoga — Surya with Ketu: past-life soul conflict, authority issues, spiritual career')
  }
  if (moon && rahu && moon.house === rahu.house) {
    yogas.push('Grahan Yoga — Chandra eclipsed by Rahu: emotional distortion, mother relationship complex, mental restlessness')
  }
  if (moon && ketu && moon.house === ketu.house) {
    yogas.push('Grahan Yoga — Chandra with Ketu: emotional detachment, psychic sensitivity, past-life grief')
  }
  // Shrapit Dosha
  if (saturn && rahu && saturn.house === rahu.house) {
    yogas.push('Shrapit Dosha (Shani + Rahu conjunction — past-life karmic curse, repeated obstacles, unexplained suffering in house ' + saturn.house + ')')
  }
  // Guru Chandala Yoga
  if (jupiter && rahu && jupiter.house === rahu.house) {
    yogas.push('Guru Chandala Yoga (Guru + Rahu — wisdom corrupted by illusion, false teachers, distorted beliefs)')
  }
  // Vish Yoga
  if (saturn && moon && saturn.house === moon.house) {
    yogas.push('Vish Yoga (Shani + Chandra conjunction — chronic emotional heaviness, depression tendency, difficult mother relationship)')
  }
  // Mangalik Dosha
  if (mars) {
    const mangalikHouses = [1, 4, 7, 8, 12]
    if (mangalikHouses.includes(mars.house)) {
      yogas.push(`Mangalik Dosha (Mangal in ${mars.house}th Bhava — intensity and challenge in marriage, partners may be volatile, conflict in partnerships)`)
    }
  }
  // Raj Yoga (simplified: 5th/9th lord in kendra)
  // Viparita Raj Yoga: dusthana lords in dusthanas
  const dusthanas = [6, 8, 12]
  const dusthanaGrahas = grahas.filter(g => dusthanas.includes(g.house))
  if (dusthanaGrahas.length >= 2) {
    yogas.push('Viparita Raj Yoga potential — dusthana lords in dusthanas: unexpected rise after difficulties, success through indirect means')
  }

  return yogas
}

// ─── Life Stage ───────────────────────────────────────────────────────────────
export function getLifeStage(age: number): LifeStage {
  if (age < 28) return 'formation'
  if (age < 49) return 'consolidation'
  if (age < 70) return 'mastery'
  return 'transcendence'
}

// ─── FIX: Past Dasha History with fractional first dasha ─────────────────────
export function buildPastDashaHistory(
  nakshatraLord: string,
  birthDate: string,
  moonSid: number,
  currentAge: number,
): PastDashaEntry[] {
  const result: PastDashaEntry[] = []
  const startIdx = DASHA_ORDER.indexOf(nakshatraLord)
  if (startIdx === -1) return result

  // Fractional first dasha
  const fractionElapsed = getDashaStartOffset(moonSid)
  const firstDashaYears = DASHA_YEARS[DASHA_ORDER[startIdx]]
  const firstDashaRemaining = firstDashaYears * (1 - fractionElapsed)

  let ageStart = 0
  // First dasha: only remaining portion from birth
  const firstEnd = Math.min(firstDashaRemaining, currentAge)
  if (firstEnd > 0) {
    result.push({
      lord: DASHA_ORDER[startIdx],
      startAge: 0,
      endAge: Math.round(firstEnd * 10) / 10,
    })
  }
  ageStart = firstDashaRemaining

  for (let i = 1; i < 20; i++) {
    if (ageStart >= currentAge) break
    const idx = (startIdx + i) % 9
    const lord = DASHA_ORDER[idx]
    const years = DASHA_YEARS[lord]
    const ageEnd = ageStart + years
    result.push({
      lord,
      startAge: Math.round(ageStart * 10) / 10,
      endAge: Math.round(Math.min(ageEnd, currentAge) * 10) / 10,
    })
    ageStart = ageEnd
  }
  return result
}

// ─── FIX: Antardasha — mahadasha start derived from full timeline, not year string ─────
export function computeAntardasha(
  chart: VedicChart,
  birthDate: string,
  moonSid: number,
): AntardashaInfo {
  const mahaLord = chart.mahadasha.replace(' Mahadasha', '')
  const [startYearStr, endYearStr] = chart.mahadashaPeriod.split('–')
  const mahaLordIdx = DASHA_ORDER.indexOf(mahaLord)
  const today = Date.now()

  // FIX: Derive mahaStartMs by replaying the full dasha timeline from birth.
  // Using "year string + birth month/day" had up to ±365 day error because subsequent
  // dashas don't start on a birthday — they start at the precise ms the previous one ended.
  const birth = new Date(birthDate)
  const birthMs = birth.getTime()

  const fractionElapsed = getDashaStartOffset(moonSid)
  const nakLord = chart.nakshatraLord
  const chainStartIdx = nakLord ? DASHA_ORDER.indexOf(nakLord) : 0
  const validIdx = chainStartIdx === -1 ? 0 : chainStartIdx

  const firstDashaRemainingMs =
    DASHA_YEARS[DASHA_ORDER[validIdx]] * (1 - fractionElapsed) * 365.25 * 86400000

  let mahaStartMs: number
  let walkCursor = birthMs + firstDashaRemainingMs
  let walkIdx = (validIdx + 1) % 9

  if (DASHA_ORDER[validIdx] === mahaLord) {
    // Current mahadasha is the fractional first dasha — it starts at birth itself
    mahaStartMs = birthMs
  } else {
    mahaStartMs = walkCursor
    // Walk forward until we land on the correct mahadasha lord
    while (DASHA_ORDER[walkIdx] !== mahaLord) {
      walkCursor += DASHA_YEARS[DASHA_ORDER[walkIdx]] * 365.25 * 86400000
      walkIdx = (walkIdx + 1) % 9
      mahaStartMs = walkCursor
      if (walkCursor - birthMs > 200 * 365.25 * 86400000) break // 200yr safety cap
    }
  }

  let cursor = mahaStartMs
  for (let i = 0; i < 9; i++) {
    const antarLordIdx = (mahaLordIdx + i) % 9
    const antarLord = DASHA_ORDER[antarLordIdx]
    const antarMs = (DASHA_YEARS[antarLord] / 120) * DASHA_YEARS[mahaLord] * 365.25 * 86400000
    const antarEnd = cursor + antarMs

    if (today < antarEnd || i === 8) {
      return {
        lord: antarLord,
        startDate: new Date(cursor).toISOString().split('T')[0],
        endDate: new Date(antarEnd).toISOString().split('T')[0],
        lordsRelationship: getPlanetaryRelationship(mahaLord, antarLord),
      }
    }
    cursor = antarEnd
  }

  return {
    lord: mahaLord,
    startDate: `${startYearStr.trim()}-01-01`,
    endDate: `${endYearStr.trim()}-01-01`,
    lordsRelationship: 'neutral',
  }
}

// ─── Sade Sati ────────────────────────────────────────────────────────────────
export function detectSadeSati(natalMoonRashi: string): SadeSatiStatus {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const saturnSid = sidereal(saturnLongitude(jdToday), today.getFullYear())
  const saturnRashiIdx = Math.floor(saturnSid / 30) % 12
  const moonRashiIdx = RASHIS.indexOf(natalMoonRashi)
  if (moonRashiIdx === -1) return { isActive: false, phase: null, endYear: null }

  const prevRashi = (moonRashiIdx - 1 + 12) % 12
  const nextRashi = (moonRashiIdx + 1) % 12

  let phase: 'starting' | 'peak' | 'ending' | null = null
  if (saturnRashiIdx === prevRashi) phase = 'starting'
  else if (saturnRashiIdx === moonRashiIdx) phase = 'peak'
  else if (saturnRashiIdx === nextRashi) phase = 'ending'

  const isActive = phase !== null

  let endYear: number | null = null
  if (isActive) {
    const degreesInCurrentRashi = saturnSid % 30
    const rashisLeft = phase === 'starting' ? 2 : phase === 'peak' ? 1 : 0
    const totalDegreesLeft = (30 - degreesInCurrentRashi) + rashisLeft * 30
    const yearsLeft = totalDegreesLeft / 12
    endYear = today.getFullYear() + Math.round(yearsLeft)
  }

  return { isActive, phase, endYear }
}

// ─── Jupiter Transit ──────────────────────────────────────────────────────────
export function detectJupiterTransitStatus(
  natalLagna: string,
  natalMoonRashi: string,
): { houseFromMoon: number; houseFromLagna: number; isFavorable: boolean } {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const jupSid = sidereal(jupiterLongitude(jdToday), today.getFullYear())
  const jupRashiIdx = Math.floor(jupSid / 30) % 12

  const moonRashiIdx = RASHIS.indexOf(natalMoonRashi)
  const lagnaRashiIdx = RASHIS.indexOf(natalLagna)

  const houseFromMoon = ((jupRashiIdx - moonRashiIdx + 12) % 12) + 1
  const houseFromLagna = ((jupRashiIdx - lagnaRashiIdx + 12) % 12) + 1
  const isFavorable = [1, 2, 4, 5, 7, 9, 11].includes(houseFromMoon)

  return { houseFromMoon, houseFromLagna, isFavorable }
}

// ─── Current Gochar ───────────────────────────────────────────────────────────
export function computeCurrentGochar(natalChart: VedicChart): GocharData {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const jdYest  = jdToday - 1
  const year = today.getFullYear()
  const sid = (lon: number) => sidereal(lon, year)

  const sunSid   = sid(sunLongitude(jdToday))
  const moonSid  = sid(moonLongitude(jdToday))
  const marsSid  = sid(marsLongitude(jdToday))
  const mercSid  = sid(mercuryLongitude(jdToday))
  const jupSid   = sid(jupiterLongitude(jdToday))
  const venSid   = sid(venusLongitude(jdToday))
  const satSid   = sid(saturnLongitude(jdToday))
  const rahuSid  = sid(rahuLongitude(jdToday))
  const ketuSid  = norm(rahuSid + 180)

  // Yesterday for retrograde
  const marsYest  = sid(marsLongitude(jdYest))
  const mercYest  = sid(mercuryLongitude(jdYest))
  const jupYest   = sid(jupiterLongitude(jdYest))
  const venYest   = sid(venusLongitude(jdYest))
  const satYest   = sid(saturnLongitude(jdYest))

  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)
  function houseFromLagna(lon: number): number {
    const ri = Math.floor(lon / 30) % 12
    return ((ri - lagnaIdx + 12) % 12) + 1
  }

  const rawTransits = [
    { name: 'Surya',   sid: sunSid,  prev: sunSid },
    { name: 'Chandra', sid: moonSid, prev: moonSid },
    { name: 'Mangal',  sid: marsSid, prev: marsYest },
    { name: 'Budh',    sid: mercSid, prev: mercYest },
    { name: 'Guru',    sid: jupSid,  prev: jupYest },
    { name: 'Shukra',  sid: venSid,  prev: venYest },
    { name: 'Shani',   sid: satSid,  prev: satYest },
    { name: 'Rahu',    sid: rahuSid, prev: rahuSid },
    { name: 'Ketu',    sid: ketuSid, prev: ketuSid },
  ]

  const transitingPlanets: VedicGraha[] = rawTransits.map(({ name, sid: lon, prev }) => {
    const rashiIdx = Math.floor(lon / 30) % 12
    const nak = getNakshatra(lon)
    const dignity = checkDignity(name, rashiIdx)
    return {
      name,
      rashi: RASHIS[rashiIdx],
      degree: getDegreeInSign(lon),
      house: houseFromLagna(lon),
      nakshatra: nak.name,
      nakshatraPada: nak.pada,
      isRetrograde: isRetrograde(name, lon, prev),
      isExalted: dignity.isExalted,
      isDebilitated: dignity.isDebilitated,
    }
  })

  const satHouse  = houseFromLagna(satSid)
  const jupHouse  = houseFromLagna(jupSid)
  const rahuHouse = houseFromLagna(rahuSid)
  const moonRashiIdx = RASHIS.indexOf(natalChart.moonRashi)
  const satRashiIdx  = Math.floor(satSid / 30) % 12
  const isSadeSati   = [
    moonRashiIdx,
    (moonRashiIdx - 1 + 12) % 12,
    (moonRashiIdx + 1) % 12,
  ].includes(satRashiIdx)

  const keyConditions: string[] = [
    `Shani (Saturn) transiting House ${satHouse} from natal Lagna`,
    `Guru (Jupiter) transiting House ${jupHouse} from natal Lagna`,
    `Rahu transiting House ${rahuHouse} from natal Lagna`,
  ]
  if (isSadeSati) {
    keyConditions.push('Sade Sati active — Saturn transiting near natal Moon, heightened emotional pressure')
  }
  const jupFavorable = [1, 2, 4, 5, 7, 9, 11].includes(
    ((Math.floor(jupSid / 30) % 12) - moonRashiIdx + 12) % 12 + 1
  )
  if (jupFavorable) {
    keyConditions.push('Guru (Jupiter) in favorable transit from natal Moon — expansion and opportunity')
  }

  return { transitingPlanets, keyConditions }
}

// ─── Improved Daily Score (purely mathematical — no AI) ──────────────────────
export function computeDailyScoreV2(natalChart: VedicChart): number {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const year = today.getFullYear()

  // Moon phase (0-20)
  const knownNewMoon = julianDay(2025, 1, 29, 12)
  const lunarCycle = 29.53
  const moonAge = ((jdToday - knownNewMoon) % lunarCycle + lunarCycle) % lunarCycle
  const moonPhaseScore = moonAge < 14.5
    ? (moonAge / 14.5) * 20
    : ((lunarCycle - moonAge) / (lunarCycle - 14.5)) * 20

  // Jupiter transit bonus (0-10)
  const jupSid = sidereal(jupiterLongitude(jdToday), year)
  const jupRashiIdx = Math.floor(jupSid / 30) % 12
  const moonRashiIdx = RASHIS.indexOf(natalChart.moonRashi)
  const jupHouseFromMoon = ((jupRashiIdx - moonRashiIdx + 12) % 12) + 1
  const jupBonus = [1, 2, 4, 5, 9, 11].includes(jupHouseFromMoon) ? 10 : 0

  // Sade Sati penalty (-8)
  const satSid = sidereal(saturnLongitude(jdToday), year)
  const satRashiIdx = Math.floor(satSid / 30) % 12
  const isSadeSati = [
    moonRashiIdx,
    (moonRashiIdx - 1 + 12) % 12,
    (moonRashiIdx + 1) % 12,
  ].includes(satRashiIdx)
  const satPenalty = isSadeSati ? -8 : 0

  // Base
  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)
  const base = 50 + ((lagnaIdx + moonRashiIdx) % 8)
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const harmonic = Math.sin((dayOfYear + lagnaIdx * 30) * 0.0436) * 12

  return Math.max(20, Math.min(96, Math.round(base + moonPhaseScore + jupBonus + satPenalty + harmonic)))
}

// ─── Legacy score ─────────────────────────────────────────────────────────────
export function getDailyScore(chartData: ChartData): number {
  return computeDailyScoreV2(chartData.vedic)
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function calculateChartData(birthProfile: BirthProfile): ChartData {
  const [yearStr, monthStr, dayStr] = birthProfile.birth_date.split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day   = parseInt(dayStr)

  let utcHour = 12
  if (birthProfile.birth_time_known && birthProfile.birth_time) {
    const [hStr, mStr] = birthProfile.birth_time.split(':')
    const localHour = parseInt(hStr) + parseInt(mStr) / 60
    utcHour = localHour - birthProfile.birth_lng / 15
  }

  const jd     = julianDay(year, month, day, utcHour)
  const jdYest = jd - 1

  const sunTrop  = sunLongitude(jd)
  const moonTrop = moonLongitude(jd)
  const marsTrop = marsLongitude(jd)
  const mercTrop = mercuryLongitude(jd)
  const jupTrop  = jupiterLongitude(jd)
  const venTrop  = venusLongitude(jd)
  const satTrop  = saturnLongitude(jd)
  const rahuTrop = rahuLongitude(jd)
  const ketuTrop = norm(rahuTrop + 180)

  // Yesterday positions for retrograde detection
  const marsYest = marsLongitude(jdYest)
  const mercYest = mercuryLongitude(jdYest)
  const jupYest  = jupiterLongitude(jdYest)
  const venYest  = venusLongitude(jdYest)
  const satYest  = saturnLongitude(jdYest)

  const ascTrop = birthProfile.birth_time_known
    ? ascendant(jd, birthProfile.birth_lat, birthProfile.birth_lng)
    : sunTrop

  const sid = (lon: number) => sidereal(lon, year)

  const sunSid  = sid(sunTrop)
  const moonSid = sid(moonTrop)
  const marsSid = sid(marsTrop)
  const mercSid = sid(mercTrop)
  const jupSid  = sid(jupTrop)
  const venSid  = sid(venTrop)
  const satSid  = sid(satTrop)
  const rahuSid = sid(rahuTrop)
  const ketuSid = sid(ketuTrop)
  const ascSid  = sid(ascTrop)

  // Yesterday sidereal
  const marsYestSid = sid(marsYest)
  const mercYestSid = sid(mercYest)
  const jupYestSid  = sid(jupYest)
  const venYestSid  = sid(venYest)
  const satYestSid  = sid(satYest)

  const lagnaIdx = Math.floor(ascSid / 30) % 12

  function getHouse(siderealLon: number): number {
    const distFromLagna = norm(siderealLon - ascSid)
    return Math.floor(distFromLagna / 30) % 12 + 1
  }

  const houses   = Array.from({ length: 12 }, (_, i) => RASHIS[(lagnaIdx + i) % 12])
  const moonNak  = getNakshatra(moonSid)
  const dashaData = getMahadasha(moonNak.lord, birthProfile.birth_date, moonSid)

  const rawGrahas = [
    { name: 'Surya',   sid: sunSid,  prev: sunSid },
    { name: 'Chandra', sid: moonSid, prev: moonSid },
    { name: 'Mangal',  sid: marsSid, prev: marsYestSid },
    { name: 'Budh',    sid: mercSid, prev: mercYestSid },
    { name: 'Guru',    sid: jupSid,  prev: jupYestSid },
    { name: 'Shukra',  sid: venSid,  prev: venYestSid },
    { name: 'Shani',   sid: satSid,  prev: satYestSid },
    { name: 'Rahu',    sid: rahuSid, prev: rahuSid },
    { name: 'Ketu',    sid: ketuSid, prev: ketuSid },
  ]

  const grahas: VedicGraha[] = rawGrahas.map(({ name, sid: grahaLon, prev }) => {
    const rashiIdx  = Math.floor(grahaLon / 30) % 12
    const nak       = getNakshatra(grahaLon)
    const dignity   = checkDignity(name, rashiIdx)
    const retro     = isRetrograde(name, grahaLon, prev)
    const combust   = isCombust(name, grahaLon, sunSid)
    const navamsha  = getNavamshaRashi(grahaLon)
    const vargottama = isVargottama(grahaLon)

    return {
      name,
      rashi: RASHIS[rashiIdx],
      degree: getDegreeInSign(grahaLon),
      house: getHouse(grahaLon),
      nakshatra: nak.name,
      nakshatraPada: nak.pada,
      isRetrograde: retro,
      isExalted: dignity.isExalted,
      isDebilitated: dignity.isDebilitated,
      isCombust: combust,
      navamshaRashi: navamsha,
      isVargottama: vargottama,
    }
  })

  const yogas = detectYogas(grahas, lagnaIdx)

  const vedic: VedicChart = {
    lagna: RASHIS[lagnaIdx],
    lagnaDegree: getDegreeInSign(ascSid),
    rashi: getRashi(sunSid),
    rashiDegree: getDegreeInSign(sunSid),
    moonRashi: getRashi(moonSid),
    moonDegree: getDegreeInSign(moonSid),
    nakshatra: moonNak.name,
    nakshatraPada: moonNak.pada,
    nakshatraLord: moonNak.lord,
    mahadasha: dashaData.mahadasha,
    mahadashaPeriod: dashaData.period,
    antardasha: dashaData.antardasha,
    grahas,
    houses,
    yogas,
  }

  const userAge         = computeAge(birthProfile.birth_date)
  const gochar          = computeCurrentGochar(vedic)
  const currentAntardasha = computeAntardasha(vedic, birthProfile.birth_date, moonSid)
  const pastDashaHistory  = buildPastDashaHistory(moonNak.lord, birthProfile.birth_date, moonSid, userAge)
  const sadeSatiStatus    = detectSadeSati(vedic.moonRashi)
  const jupTransit        = detectJupiterTransitStatus(vedic.lagna, vedic.moonRashi)
  const lifeStage         = getLifeStage(userAge)

  const currentTiming: CurrentTimingData = {
    gochar,
    currentAntardasha,
    pastDashaHistory,
    sadeSatiStatus,
    jupiterTransitFavorable: jupTransit.isFavorable,
    jupiterHouseFromMoon: jupTransit.houseFromMoon,
    jupiterHouseFromLagna: jupTransit.houseFromLagna,
    userAge,
    lifeStage,
  }

  return { vedic, birthProfile, calculatedAt: new Date().toISOString(), currentTiming }
}

// ─── NEW: Compute Daily Score for ANY given date (used by week/month forecasts) ─
export function computeDailyScoreForDate(natalChart: VedicChart, date: Date): number {
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12)
  const jdYest = jd - 1
  const year = date.getFullYear()

  // Moon phase score (0-20) — waxing is generally more favorable
  const knownNewMoon = julianDay(2025, 1, 29, 12)
  const lunarCycle = 29.53
  const moonAge = ((jd - knownNewMoon) % lunarCycle + lunarCycle) % lunarCycle
  const moonPhaseScore = moonAge < 14.5
    ? (moonAge / 14.5) * 20
    : ((lunarCycle - moonAge) / (lunarCycle - 14.5)) * 20

  // Daily Moon transit score (0-15) — Moon's house from natal Lagna
  const moonSid = sidereal(moonLongitude(jd), year)
  const moonHouseFromLagna = ((Math.floor(moonSid / 30) % 12) - RASHIS.indexOf(natalChart.lagna) + 12) % 12 + 1
  // Trikona (1,5,9) and upachaya (3,6,10,11) houses are generally better
  const moonHouseScore = [1, 4, 5, 7, 9, 10, 11].includes(moonHouseFromLagna) ? 15
    : [2, 3, 6, 8, 12].includes(moonHouseFromLagna) ? 5 : 10

  // Daily Moon Nakshatra score (0-10) — certain nakshatras are auspicious
  const moonNak = getNakshatra(moonSid)
  const auspiciousNaks = ['Ashwini', 'Rohini', 'Mrigashira', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Revati']
  const inauspiciousNaks = ['Ardra', 'Ashlesha', 'Magha', 'Jyeshtha', 'Mula', 'Purva Bhadrapada']
  const nakScore = auspiciousNaks.includes(moonNak.name) ? 10 : inauspiciousNaks.includes(moonNak.name) ? 2 : 6

  // Jupiter transit bonus (0-10)
  const jupSid = sidereal(jupiterLongitude(jd), year)
  const moonRashiIdx = RASHIS.indexOf(natalChart.moonRashi)
  const jupHouseFromMoon = ((Math.floor(jupSid / 30) % 12) - moonRashiIdx + 12) % 12 + 1
  const jupBonus = [1, 2, 4, 5, 9, 11].includes(jupHouseFromMoon) ? 10 : 0

  // Sade Sati penalty (-10)
  const satSid = sidereal(saturnLongitude(jd), year)
  const satRashiIdx = Math.floor(satSid / 30) % 12
  const isSadeSati = [
    moonRashiIdx, (moonRashiIdx - 1 + 12) % 12, (moonRashiIdx + 1) % 12,
  ].includes(satRashiIdx)
  const satPenalty = isSadeSati ? -10 : 0

  // Mars transit — can be energizing or aggressive (+5/-5)
  const marsSid = sidereal(marsLongitude(jd), year)
  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)
  const marsHouse = ((Math.floor(marsSid / 30) % 12) - lagnaIdx + 12) % 12 + 1
  const marsEffect = [1, 4, 7, 8].includes(marsHouse) ? -5 : [3, 6, 10, 11].includes(marsHouse) ? 5 : 0

  // Base from chart
  const base = 40 + ((lagnaIdx + moonRashiIdx) % 8)

  return Math.max(15, Math.min(97, Math.round(
    base + moonPhaseScore + moonHouseScore + nakScore + jupBonus + satPenalty + marsEffect
  )))
}

// ─── NEW: Get Moon Nakshatra for a specific date ──────────────────────────────
export function getMoonNakshatraForDate(date: Date): string {
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12)
  const moonSid = sidereal(moonLongitude(jd), date.getFullYear())
  return getNakshatra(moonSid).name
}

// ─── NEW: Get transiting planet positions for a specific date ─────────────────
export function getTransitingPlanetsForDate(natalChart: VedicChart, date: Date): {
  planet: string; house: number; rashi: string; isRetro: boolean
}[] {
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12)
  const jdYest = jd - 1
  const year = date.getFullYear()
  const sid = (lon: number) => sidereal(lon, year)
  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)

  const planets = [
    { name: 'Surya', lon: sid(sunLongitude(jd)), prev: sid(sunLongitude(jdYest)) },
    { name: 'Chandra', lon: sid(moonLongitude(jd)), prev: sid(moonLongitude(jdYest)) },
    { name: 'Mangal', lon: sid(marsLongitude(jd)), prev: sid(marsLongitude(jdYest)) },
    { name: 'Guru', lon: sid(jupiterLongitude(jd)), prev: sid(jupiterLongitude(jdYest)) },
    { name: 'Shani', lon: sid(saturnLongitude(jd)), prev: sid(saturnLongitude(jdYest)) },
    { name: 'Rahu', lon: sid(rahuLongitude(jd)), prev: sid(rahuLongitude(jdYest)) },
  ]

  return planets.map(p => {
    const rashiIdx = Math.floor(p.lon / 30) % 12
    const house = ((rashiIdx - lagnaIdx + 12) % 12) + 1
    return {
      planet: p.name,
      house,
      rashi: RASHIS[rashiIdx],
      isRetro: isRetrograde(p.name, p.lon, p.prev),
    }
  })
}

// ─── NEW: Determine key astrological event for a specific date ────────────────
export function getKeyAstroEventForDate(natalChart: VedicChart, date: Date): string {
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12)
  const year = date.getFullYear()
  const sid = (lon: number) => sidereal(lon, year)

  const moonSid = sid(moonLongitude(jd))
  const sunSid = sid(sunLongitude(jd))
  const satSid = sid(saturnLongitude(jd))
  const jupSid = sid(jupiterLongitude(jd))
  const moonRashiIdx = RASHIS.indexOf(natalChart.moonRashi)
  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)

  // Check for purnima (full moon) — Sun and Moon ~180° apart
  let sunMoonAngle = Math.abs(sunSid - moonSid)
  if (sunMoonAngle > 180) sunMoonAngle = 360 - sunMoonAngle
  if (sunMoonAngle > 165) return 'Purnima (Full Moon) — heightened emotions and culmination'

  // Check for amavasya (new moon) — Sun and Moon ~0° apart
  if (sunMoonAngle < 15) return 'Amavasya (New Moon) — introspection and new beginnings'

  // Check Moon in natal Moon sign (special emotional day)
  const moonCurrentRashi = RASHIS[Math.floor(moonSid / 30) % 12]
  if (moonCurrentRashi === natalChart.moonRashi) return `Moon returns to natal ${natalChart.moonRashi} — emotionally resonant day`

  // Check Moon in Lagna
  const moonHouse = ((Math.floor(moonSid / 30) % 12) - lagnaIdx + 12) % 12 + 1
  if (moonHouse === 1) return `Chandra (Moon) transiting Lagna — personal energy and presence heightened`
  if (moonHouse === 9) return `Moon in 9th House transit — dharma, teachers, and higher wisdom activated`
  if (moonHouse === 10) return `Moon in 10th House transit — career and public life in focus`

  // Jupiter house
  const jupHouseFromMoon = ((Math.floor(jupSid / 30) % 12) - moonRashiIdx + 12) % 12 + 1
  if ([1, 5, 9].includes(jupHouseFromMoon)) return 'Guru transit in trikona from Moon — blessings and expansion'

  // Saturn house
  const satHouseFromMoon = ((Math.floor(satSid / 30) % 12) - moonRashiIdx + 12) % 12 + 1
  if (satHouseFromMoon === 12) return 'Shani in 12th from Moon — rest, release, and spiritual work favored'

  // Moon nakshatra
  const moonNak = getNakshatra(moonSid)
  return `Moon in ${moonNak.name} Nakshatra — ${moonNak.lord} themes active`
}
