import type { ChartData, VedicChart, VedicGraha, BirthProfile } from '../types'

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

// ─── Tropical Longitudes (accurate ~0.5-2 degrees) ────────────────────────────
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

// Rahu = Mean North Node (retrograde)
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
// [exaltation rashi index, debilitation rashi index]
const GRAHA_DIGNITY: Record<string, [number, number]> = {
  Surya:   [0, 6],   // Mesha exalted, Tula debilitated
  Chandra: [1, 7],   // Vrishabha exalted, Vrishchika debilitated
  Mangal:  [9, 3],   // Makara exalted, Karka debilitated
  Budh:    [5, 11],  // Kanya exalted, Meena debilitated
  Guru:    [3, 9],   // Karka exalted, Makara debilitated
  Shukra:  [11, 5],  // Meena exalted, Kanya debilitated
  Shani:   [6, 0],   // Tula exalted, Mesha debilitated
  Rahu:    [2, 8],   // Mithuna exalted, Dhanu debilitated
  Ketu:    [8, 2],   // Dhanu exalted, Mithuna debilitated
}

function checkDignity(grahaName: string, rashiIdx: number): { isExalted: boolean; isDebilitated: boolean } {
  const dignity = GRAHA_DIGNITY[grahaName]
  if (!dignity) return { isExalted: false, isDebilitated: false }
  return {
    isExalted: rashiIdx === dignity[0],
    isDebilitated: rashiIdx === dignity[1],
  }
}

// ─── Basic Yoga Detection ─────────────────────────────────────────────────────
function detectYogas(grahas: VedicGraha[], lagnaIdx: number): string[] {
  const yogas: string[] = []

  const sun = grahas.find(g => g.name === 'Surya')
  const moon = grahas.find(g => g.name === 'Chandra')
  const mars = grahas.find(g => g.name === 'Mangal')
  const mercury = grahas.find(g => g.name === 'Budh')
  const jupiter = grahas.find(g => g.name === 'Guru')
  const venus = grahas.find(g => g.name === 'Shukra')
  const saturn = grahas.find(g => g.name === 'Shani')
  const rahu = grahas.find(g => g.name === 'Rahu')
  const ketu = grahas.find(g => g.name === 'Ketu')

  // Gajakesari Yoga: Jupiter in kendra (1,4,7,10) from Moon
  if (jupiter && moon) {
    const diff = Math.abs(jupiter.house - moon.house)
    const kendraFromMoon = [0, 3, 6, 9]
    const adjustedDiff = diff > 6 ? 12 - diff : diff
    if (kendraFromMoon.includes(adjustedDiff)) {
      yogas.push('Gajakesari Yoga (Guru in kendra from Chandra — prosperity, intelligence, good name)')
    }
  }

  // Budhaditya Yoga: Sun + Mercury in same house
  if (sun && mercury && sun.house === mercury.house) {
    yogas.push('Budhaditya Yoga (Surya + Budh conjunction — sharp intellect, communication gifts)')
  }

  // Chandra-Mangal Yoga: Moon + Mars together
  if (moon && mars && moon.house === mars.house) {
    yogas.push('Chandra-Mangal Yoga (Chandra + Mangal — financial drive, emotional intensity)')
  }

  // Neecha Bhanga Raja Yoga: debilitated planet cancelled by lord
  grahas.forEach(g => {
    if (g.isDebilitated) {
      yogas.push(`Neecha Bhanga possibility for ${g.name} — debilitation may be cancelled, creating strength through struggle`)
    }
  })

  // Panch Mahapurusha Yoga: Mars/Mercury/Jupiter/Venus/Saturn in own sign or exalted in kendra
  const kendras = [1, 4, 7, 10]
  const panch: VedicGraha[] = [mars, mercury, jupiter, venus, saturn].filter(Boolean) as VedicGraha[]
  panch.forEach(g => {
    if (kendras.includes(g.house) && (g.isExalted)) {
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

  // Kemadruma Yoga: Moon has no planets in 2nd or 12th house from it
  if (moon) {
    const secondFromMoon = ((moon.house + 1 - 1) % 12) + 1
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

// ─── Daily Score (Vedic-based) ────────────────────────────────────────────────
export function getDailyScore(chartData: ChartData): number {
  const today = new Date()
  const jdToday = julianDay(today.getFullYear(), today.getMonth() + 1, today.getDate(), 12)
  const knownNewMoon = julianDay(2025, 1, 29, 12)
  const lunarCycle = 29.53
  const moonAge = ((jdToday - knownNewMoon) % lunarCycle + lunarCycle) % lunarCycle
  const moonScore = moonAge < 14.5
    ? (moonAge / 14.5) * 25
    : ((lunarCycle - moonAge) / (lunarCycle - 14.5)) * 25

  const lagnaIdx = RASHIS.indexOf(chartData.vedic.lagna)
  const moonRashiIdx = RASHIS.indexOf(chartData.vedic.moonRashi)
  const base = 50 + ((lagnaIdx + moonRashiIdx) % 8)
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const harmonic = Math.sin((dayOfYear + lagnaIdx * 30) * 0.0436) * 15

  return Math.max(22, Math.min(94, Math.round(base + moonScore + harmonic)))
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

  // Tropical longitudes
  const sunTrop = sunLongitude(jd)
  const moonTrop = moonLongitude(jd)
  const marsTrop = marsLongitude(jd)
  const mercTrop = mercuryLongitude(jd)
  const jupTrop = jupiterLongitude(jd)
  const venTrop = venusLongitude(jd)
  const satTrop = saturnLongitude(jd)
  const rahuTrop = rahuLongitude(jd)
  const ketuTrop = norm(rahuTrop + 180)

  const ascTrop = birthProfile.birth_time_known
    ? ascendant(jd, birthProfile.birth_lat, birthProfile.birth_lng)
    : sunTrop

  // Sidereal (Vedic) conversions
  const sid = (lon: number) => sidereal(lon, year)

  const sunSid = sid(sunTrop)
  const moonSid = sid(moonTrop)
  const marsSid = sid(marsTrop)
  const mercSid = sid(mercTrop)
  const jupSid = sid(jupTrop)
  const venSid = sid(venTrop)
  const satSid = sid(satTrop)
  const rahuSid = sid(rahuTrop)
  const ketuSid = sid(ketuTrop)
  const ascSid = sid(ascTrop)

  // Lagna (1st house starts here)
  const lagnaIdx = Math.floor(ascSid / 30) % 12

  // Determine house for a planet (equal house from lagna)
  function getHouse(siderealLon: number): number {
    const distFromLagna = norm(siderealLon - ascSid)
    return Math.floor(distFromLagna / 30) % 12 + 1
  }

  // Houses array: houses[0] = 1st house rashi, houses[1] = 2nd house rashi, etc.
  const houses = Array.from({ length: 12 }, (_, i) => RASHIS[(lagnaIdx + i) % 12])

  // Nakshatra for Moon
  const moonNak = getNakshatra(moonSid)
  const dashaData = getMahadasha(moonNak.lord, year)

  // Build Grahas
  const rawGrahas = [
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

  const grahas: VedicGraha[] = rawGrahas.map(({ name, sid: grahaLon }) => {
    const rashiIdx = Math.floor(grahaLon / 30) % 12
    const nak = getNakshatra(grahaLon)
    const dignity = checkDignity(name, rashiIdx)
    // Simple retrograde: Mars/Mercury/Jupiter/Venus/Saturn can be retrograde
    // We'll approximate: if planet's daily motion is < 0 (simplified check)
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

  return { vedic, birthProfile, calculatedAt: new Date().toISOString() }
  }
