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

function marsLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(355.433 + 19140.2993 * T + 0.000261 * T * T)
  const M = norm(19.3730 + 19139.8585 * T)
  const Mrad = toRad(M)
  return norm(L + 10.691 * Math.sin(Mrad) + 0.623 * Math.sin(2 * Mrad))
}

function mercuryLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(252.2509 + 149472.6749 * T)
  const M = norm(174.7948 + 149472.5153 * T)
  const Mrad = toRad(M)
  return norm(L + 23.4400 * Math.sin(Mrad) + 2.9818 * Math.sin(2 * Mrad))
}

function jupiterLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(34.3515 + 3034.9057 * T + 0.000080 * T * T)
  const M = norm(20.9 + 3034.906 * T)
  const Mrad = toRad(M)
  return norm(L + 5.5549 * Math.sin(Mrad) + 0.1683 * Math.sin(2 * Mrad))
}

function venusLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(181.9798 + 58517.8157 * T)
  const M = norm(212.2606 + 58517.8036 * T)
  const Mrad = toRad(M)
  return norm(L + 0.7758 * Math.sin(Mrad) + 0.0033 * Math.sin(2 * Mrad))
}

function saturnLongitude(jd: number): number {
  const T = julianT(jd)
  const L = norm(50.0787 + 1222.1138 * T + 0.000029 * T * T)
  const M = norm(317.020 + 1221.552 * T)
  const Mrad = toRad(M)
  return norm(L + 6.3585 * Math.sin(Mrad) + 0.2204 * Math.sin(2 * Mrad))
}

function rahuLongitude(jd: number): number {
  const T = julianT(jd)
  return norm(125.0445 - 1934.1362 * T + 0.0020768 * T * T)
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

// ─── Vimshottari Dasha ────────────────────────────────────────────────────────
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7,
  Rahu: 18, Guru: 16, Shani: 19, Budh: 17,
}
const DASHA_ORDER = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangal', 'Rahu', 'Guru', 'Shani', 'Budh']

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
  const antardasha = DASHA_ORDER[(idx + 1) % 9]

  return {
    mahadasha: `${lord} Mahadasha`,
    period: `${startYear}–${endYear}`,
    antardasha: `${antardasha} Antardasha`,
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
  const sun = grahas.find(g => g.name === 'Surya')
  const moon = grahas.find(g => g.name === 'Chandra')
  const mars = grahas.find(g => g.name === 'Mangal')
  const mercury = grahas.find(g => g.name === 'Budh')
  const jupiter = grahas.find(g => g.name === 'Guru')
  const venus = grahas.find(g => g.name === 'Shukra')
  const saturn = grahas.find(g => g.name === 'Shani')

  if (jupiter && moon) {
    const diff = Math.abs(jupiter.house - moon.house)
    const adjustedDiff = diff > 6 ? 12 - diff : diff
    if ([0, 3, 6, 9].includes(adjustedDiff)) {
      yogas.push('Gajakesari Yoga (Guru in kendra from Chandra — prosperity, intelligence, good name)')
    }
  }
  if (sun && mercury && sun.house === mercury.house) {
    yogas.push('Budhaditya Yoga (Surya + Budh conjunction — sharp intellect, communication gifts)')
  }
  if (moon && mars && moon.house === mars.house) {
    yogas.push('Chandra-Mangal Yoga (Chandra + Mangal — financial drive, emotional intensity)')
  }
  grahas.forEach(g => {
    if (g.isDebilitated) {
      yogas.push(`Neecha Bhanga possibility for ${g.name} — debilitation may be cancelled, creating strength through struggle`)
    }
  })
  const kendras = [1, 4, 7, 10]
  const panch: VedicGraha[] = [mars, mercury, jupiter, venus, saturn].filter(Boolean) as VedicGraha[]
  panch.forEach(g => {
    if (kendras.includes(g.house) && g.isExalted) {
      const yogaNames: Record<string, string> = {
        Mangal: 'Ruchaka Yoga (exalted Mangal in kendra — courage, leadership, land)',
        Budh: 'Bhadra Yoga (exalted Budh in kendra — intellect, business, speech)',
        Guru: 'Hamsa Yoga (exalted Guru in kendra — wisdom, dharma, prosperity)',
        Shukra: 'Malavya Yoga (exalted Shukra in kendra — beauty, luxury, love)',
        Shani: 'Sasa Yoga (exalted Shani in kendra — discipline, authority, longevity)',
      }
      if (yogaNames[g.name]) yogas.push(yogaNames[g.name])
    }
  })
  if (moon) {
    const secondFromMoon = ((moon.house) % 12) + 1
    const twelfthFromMoon = ((moon.house - 2 + 12) % 12) + 1
    const hasNeighbors = grahas.some(g =>
      g.name !== 'Chandra' && (g.house === secondFromMoon || g.house === twelfthFromMoon)
    )
    if (!hasNeighbors) {
      yogas.push('Kemadruma Yoga (Chandra isolated — emotional sensitivity, self-reliance needed)')
    }
  }
  return yogas
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW TIMING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Life Stage ───────────────────────────────────────────────────────────────
export function getLifeStage(age: number): LifeStage {
  if (age < 28) return 'formation'
  if (age < 49) return 'consolidation'
  if (age < 70) return 'mastery'
  return 'transcendence'
}

// ─── Past Dasha History ───────────────────────────────────────────────────────
export function buildPastDashaHistory(
  nakshatraLord: string,
  birthYear: number,
  currentAge: number,
): PastDashaEntry[] {
  const result: PastDashaEntry[] = []
  const startIdx = DASHA_ORDER.indexOf(nakshatraLord)
  if (startIdx === -1) return result

  let ageStart = 0
  for (let i = 0; i < 20; i++) {
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

// ─── Antardasha ───────────────────────────────────────────────────────────────
export function computeAntardasha(chart: VedicChart, birthDate: string): AntardashaInfo {
  const mahaLord = chart.mahadasha.replace(' Mahadasha', '')
  const [startYearStr, endYearStr] = chart.mahadashaPeriod.split('–')
  const mahaStartMs = new Date(`${startYearStr.trim()}-01-01`).getTime()
  const mahaEndMs = new Date(`${endYearStr.trim()}-01-01`).getTime()
  const mahaLordIdx = DASHA_ORDER.indexOf(mahaLord)
  const today = Date.now()

  let cursor = mahaStartMs
  for (let i = 0; i < 9; i++) {
    const antarLordIdx = (mahaLordIdx + i) % 9
    const antarLord = DASHA_ORDER[antarLordIdx]
    // Antardasha duration = (antarLord years / 120) * mahaLord years * ms-per-year
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
    const yearsLeft = totalDegreesLeft / 12 // Saturn ~12°/year
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

  // Classical favorable houses from Moon: 1,2,4,5,7,9,11
  const isFavorable = [1, 2, 4, 5, 7, 9, 11].includes(houseFromMoon)

  return { houseFromMoon, houseFromLagna, isFavorable }
}

// ─── Current Gochar (Transit) Positions ───────────────────────────────────────
export function computeCurrentGochar(natalChart: VedicChart): GocharData {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const year = today.getFullYear()
  const sid = (lon: number) => sidereal(lon, year)

  const sunSid  = sid(sunLongitude(jdToday))
  const moonSid = sid(moonLongitude(jdToday))
  const marsSid = sid(marsLongitude(jdToday))
  const mercSid = sid(mercuryLongitude(jdToday))
  const jupSid  = sid(jupiterLongitude(jdToday))
  const venSid  = sid(venusLongitude(jdToday))
  const satSid  = sid(saturnLongitude(jdToday))
  const rahuSid = sid(rahuLongitude(jdToday))
  const ketuSid = norm(rahuSid + 180)

  const lagnaIdx = RASHIS.indexOf(natalChart.lagna)
  function houseFromLagna(lon: number): number {
    const ri = Math.floor(lon / 30) % 12
    return ((ri - lagnaIdx + 12) % 12) + 1
  }

  const rawTransits = [
    { name: 'Surya', sid: sunSid },
    { name: 'Chandra', sid: moonSid },
    { name: 'Mangal', sid: marsSid },
    { name: 'Budh', sid: mercSid },
    { name: 'Guru', sid: jupSid },
    { name: 'Shukra', sid: venSid },
    { name: 'Shani', sid: satSid },
    { name: 'Rahu', sid: rahuSid },
    { name: 'Ketu', sid: ketuSid },
  ]

  const transitingPlanets: VedicGraha[] = rawTransits.map(({ name, sid: lon }) => {
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
      isRetrograde: false,
      isExalted: dignity.isExalted,
      isDebilitated: dignity.isDebilitated,
    }
  })

  const satHouse = houseFromLagna(satSid)
  const jupHouse = houseFromLagna(jupSid)
  const rahuHouse = houseFromLagna(rahuSid)
  const moonRashiIdx = RASHIS.indexOf(natalChart.moonRashi)
  const satRashiIdx = Math.floor(satSid / 30) % 12
  const isSadeSati = [
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

// ─── Improved Daily Score ─────────────────────────────────────────────────────
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

// ─── Legacy score (kept for compatibility) ────────────────────────────────────
export function getDailyScore(chartData: ChartData): number {
  return computeDailyScoreV2(chartData.vedic)
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function calculateChartData(birthProfile: BirthProfile): ChartData {
  const [yearStr, monthStr, dayStr] = birthProfile.birth_date.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)

  let utcHour = 12
  if (birthProfile.birth_time_known && birthProfile.birth_time) {
    const [hStr, mStr] = birthProfile.birth_time.split(':')
    const localHour = parseInt(hStr) + parseInt(mStr) / 60
    utcHour = localHour - birthProfile.birth_lng / 15
  }

  const jd = julianDay(year, month, day, utcHour)

  const sunTrop  = sunLongitude(jd)
  const moonTrop = moonLongitude(jd)
  const marsTrop = marsLongitude(jd)
  const mercTrop = mercuryLongitude(jd)
  const jupTrop  = jupiterLongitude(jd)
  const venTrop  = venusLongitude(jd)
  const satTrop  = saturnLongitude(jd)
  const rahuTrop = rahuLongitude(jd)
  const ketuTrop = norm(rahuTrop + 180)

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

  const lagnaIdx = Math.floor(ascSid / 30) % 12

  function getHouse(siderealLon: number): number {
    const distFromLagna = norm(siderealLon - ascSid)
    return Math.floor(distFromLagna / 30) % 12 + 1
  }

  const houses = Array.from({ length: 12 }, (_, i) => RASHIS[(lagnaIdx + i) % 12])
  const moonNak = getNakshatra(moonSid)
  const dashaData = getMahadasha(moonNak.lord, year)

  const rawGrahas = [
    { name: 'Surya',   sid: sunSid },
    { name: 'Chandra', sid: moonSid },
    { name: 'Mangal',  sid: marsSid },
    { name: 'Budh',    sid: mercSid },
    { name: 'Guru',    sid: jupSid },
    { name: 'Shukra',  sid: venSid },
    { name: 'Shani',   sid: satSid },
    { name: 'Rahu',    sid: rahuSid },
    { name: 'Ketu',    sid: ketuSid },
  ]

  const grahas: VedicGraha[] = rawGrahas.map(({ name, sid: grahaLon }) => {
    const rashiIdx = Math.floor(grahaLon / 30) % 12
    const nak = getNakshatra(grahaLon)
    const dignity = checkDignity(name, rashiIdx)
    const isRetrograde = ['Budh', 'Shukra', 'Mangal', 'Guru', 'Shani', 'Rahu', 'Ketu'].includes(name)
      ? Math.sin(toRad(grahaLon - sunSid)) < -0.1
      : false
    return {
      name,
      rashi: RASHIS[rashiIdx],
      degree: getDegreeInSign(grahaLon),
      house: getHouse(grahaLon),
      nakshatra: nak.name,
      nakshatraPada: nak.pada,
      isRetrograde,
      isExalted: dignity.isExalted,
      isDebilitated: dignity.isDebilitated,
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

  // ── Timing data ──────────────────────────────────────────────────────────────
  const userAge = computeAge(birthProfile.birth_date)
  const gochar = computeCurrentGochar(vedic)
  const currentAntardasha = computeAntardasha(vedic, birthProfile.birth_date)
  const pastDashaHistory = buildPastDashaHistory(moonNak.lord, year, userAge)
  const sadeSatiStatus = detectSadeSati(vedic.moonRashi)
  const jupTransit = detectJupiterTransitStatus(vedic.lagna, vedic.moonRashi)
  const lifeStage = getLifeStage(userAge)

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
