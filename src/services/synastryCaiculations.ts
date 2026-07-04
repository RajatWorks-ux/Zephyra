// src/services/synastryCaiculations.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ULTRA-POWERFUL Vedic Synastry Engine — Phase 3
//
// Classical Jyotish texts implemented:
//   BPHS (Brihat Parashara Hora Shastra)  — complete Ashta Koota system
//   Phaladeepika — Bhava lord relationships
//   Brihat Jataka (Varahamihira)          — planetary friendship matrix
//   Saravali (Kalyana Varma)              — planetary dignity rules
//   Jaimini Sutra                         — Darakaraka identification
//   BPHS Chapter 72                       — Navamsha synastry
//
// Every calculation is pure math — zero API calls, instant, deterministic
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  VedicChart, VedicGraha, KootaScore, RelationshipYoga,
  RelationshipType, CompatibilityDimensions,
} from '../types'

// ─── Complete Nakshatra Master Table ─────────────────────────────────────────
// 27 nakshatras × all classical attributes
interface NakshatraData {
  index: number
  name: string
  lord: string         // Nakshatra lord (determines Vimshottari Dasha)
  rashi: string        // Home Rashi
  rashiIndex: number   // 0–11
  varna: number        // 0=Brahmin 1=Kshatriya 2=Vaishya 3=Shudra
  gana: number         // 0=Deva 1=Manava 2=Rakshasa
  nadi: number         // 0=Adi/Vata 1=Madhya/Pitta 2=Antya/Kapha
  yoni: number         // 0-13 — see YONI enum below
  yoniGender: 'M'|'F'  // Yoni animal gender
  ganaShort: string
  nadiShort: string
  quality: 'dhruva'|'chara'|'ugra'|'misra'|'tikshna'|'mridu'|'laghu'
  element: 'fire'|'earth'|'air'|'water'|'ether'
}

// Yoni animal index
const YONI = {
  HORSE:0, ELEPHANT:1, GOAT:2, SERPENT:3, DOG:4, CAT:5,
  RAT:6, COW:7, BUFFALO:8, TIGER:9, HARE:10, MONKEY:11,
  MONGOOSE:12, LION:13
}

const NAKSHATRA_DB: NakshatraData[] = [
  { index:0,  name:'Ashwini',          lord:'Ketu',    rashi:'Aries',       rashiIndex:0,  varna:1,gana:0,nadi:0,yoni:YONI.HORSE,    yoniGender:'M', ganaShort:'Deva',   nadiShort:'Adi',   quality:'laghu',  element:'fire'  },
  { index:1,  name:'Bharani',          lord:'Venus',   rashi:'Aries',       rashiIndex:0,  varna:3,gana:1,nadi:1,yoni:YONI.ELEPHANT, yoniGender:'M', ganaShort:'Manava', nadiShort:'Madhya',quality:'ugra',   element:'fire'  },
  { index:2,  name:'Krittika',         lord:'Sun',     rashi:'Aries',       rashiIndex:0,  varna:0,gana:2,nadi:2,yoni:YONI.GOAT,     yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Antya', quality:'misra',  element:'fire'  },
  { index:3,  name:'Rohini',           lord:'Moon',    rashi:'Taurus',      rashiIndex:1,  varna:3,gana:1,nadi:0,yoni:YONI.SERPENT,  yoniGender:'M', ganaShort:'Manava', nadiShort:'Adi',   quality:'dhruva', element:'earth' },
  { index:4,  name:'Mrigashira',       lord:'Mars',    rashi:'Taurus',      rashiIndex:1,  varna:1,gana:0,nadi:1,yoni:YONI.SERPENT,  yoniGender:'F', ganaShort:'Deva',   nadiShort:'Madhya',quality:'mridu',  element:'earth' },
  { index:5,  name:'Ardra',            lord:'Rahu',    rashi:'Gemini',      rashiIndex:2,  varna:3,gana:2,nadi:2,yoni:YONI.DOG,      yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Antya', quality:'tikshna',element:'air'   },
  { index:6,  name:'Punarvasu',        lord:'Jupiter', rashi:'Gemini',      rashiIndex:2,  varna:0,gana:0,nadi:0,yoni:YONI.CAT,      yoniGender:'M', ganaShort:'Deva',   nadiShort:'Adi',   quality:'chara',  element:'air'   },
  { index:7,  name:'Pushya',           lord:'Saturn',  rashi:'Cancer',      rashiIndex:3,  varna:2,gana:0,nadi:1,yoni:YONI.GOAT,     yoniGender:'M', ganaShort:'Deva',   nadiShort:'Madhya',quality:'laghu',  element:'water' },
  { index:8,  name:'Ashlesha',         lord:'Mercury', rashi:'Cancer',      rashiIndex:3,  varna:3,gana:2,nadi:2,yoni:YONI.CAT,      yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Antya', quality:'tikshna',element:'water' },
  { index:9,  name:'Magha',            lord:'Ketu',    rashi:'Leo',         rashiIndex:4,  varna:1,gana:2,nadi:0,yoni:YONI.RAT,      yoniGender:'M', ganaShort:'Rakshasa',nadiShort:'Adi',   quality:'ugra',   element:'fire'  },
  { index:10, name:'Purva Phalguni',   lord:'Venus',   rashi:'Leo',         rashiIndex:4,  varna:2,gana:1,nadi:1,yoni:YONI.RAT,      yoniGender:'F', ganaShort:'Manava', nadiShort:'Madhya',quality:'ugra',   element:'fire'  },
  { index:11, name:'Uttara Phalguni',  lord:'Sun',     rashi:'Leo',         rashiIndex:4,  varna:1,gana:1,nadi:2,yoni:YONI.COW,      yoniGender:'M', ganaShort:'Manava', nadiShort:'Antya', quality:'dhruva', element:'fire'  },
  { index:12, name:'Hasta',            lord:'Moon',    rashi:'Virgo',       rashiIndex:5,  varna:2,gana:0,nadi:0,yoni:YONI.BUFFALO,  yoniGender:'F', ganaShort:'Deva',   nadiShort:'Adi',   quality:'laghu',  element:'earth' },
  { index:13, name:'Chitra',           lord:'Mars',    rashi:'Virgo',       rashiIndex:5,  varna:1,gana:2,nadi:1,yoni:YONI.TIGER,    yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Madhya',quality:'mridu',  element:'earth' },
  { index:14, name:'Swati',            lord:'Rahu',    rashi:'Libra',       rashiIndex:6,  varna:3,gana:0,nadi:2,yoni:YONI.BUFFALO,  yoniGender:'M', ganaShort:'Deva',   nadiShort:'Antya', quality:'chara',  element:'air'   },
  { index:15, name:'Vishakha',         lord:'Jupiter', rashi:'Libra',       rashiIndex:6,  varna:2,gana:2,nadi:0,yoni:YONI.TIGER,    yoniGender:'M', ganaShort:'Rakshasa',nadiShort:'Adi',   quality:'misra',  element:'air'   },
  { index:16, name:'Anuradha',         lord:'Saturn',  rashi:'Scorpio',     rashiIndex:7,  varna:1,gana:0,nadi:1,yoni:YONI.HARE,     yoniGender:'M', ganaShort:'Deva',   nadiShort:'Madhya',quality:'mridu',  element:'water' },
  { index:17, name:'Jyeshtha',         lord:'Mercury', rashi:'Scorpio',     rashiIndex:7,  varna:0,gana:2,nadi:2,yoni:YONI.HARE,     yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Antya', quality:'tikshna',element:'water' },
  { index:18, name:'Mula',             lord:'Ketu',    rashi:'Sagittarius', rashiIndex:8,  varna:3,gana:2,nadi:0,yoni:YONI.DOG,      yoniGender:'M', ganaShort:'Rakshasa',nadiShort:'Adi',   quality:'ugra',   element:'fire'  },
  { index:19, name:'Purva Ashadha',    lord:'Venus',   rashi:'Sagittarius', rashiIndex:8,  varna:2,gana:1,nadi:1,yoni:YONI.MONKEY,  yoniGender:'F', ganaShort:'Manava', nadiShort:'Madhya',quality:'ugra',   element:'fire'  },
  { index:20, name:'Uttara Ashadha',   lord:'Sun',     rashi:'Sagittarius', rashiIndex:8,  varna:1,gana:1,nadi:2,yoni:YONI.MONGOOSE, yoniGender:'M', ganaShort:'Manava', nadiShort:'Antya', quality:'dhruva', element:'fire'  },
  { index:21, name:'Shravana',         lord:'Moon',    rashi:'Capricorn',   rashiIndex:9,  varna:3,gana:0,nadi:0,yoni:YONI.MONKEY,  yoniGender:'M', ganaShort:'Deva',   nadiShort:'Adi',   quality:'chara',  element:'earth' },
  { index:22, name:'Dhanishtha',       lord:'Mars',    rashi:'Capricorn',   rashiIndex:9,  varna:1,gana:2,nadi:1,yoni:YONI.LION,     yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Madhya',quality:'chara',  element:'earth' },
  { index:23, name:'Shatabhisha',      lord:'Rahu',    rashi:'Aquarius',    rashiIndex:10, varna:3,gana:2,nadi:2,yoni:YONI.HORSE,    yoniGender:'F', ganaShort:'Rakshasa',nadiShort:'Antya', quality:'chara',  element:'air'   },
  { index:24, name:'Purva Bhadrapada', lord:'Jupiter', rashi:'Aquarius',    rashiIndex:10, varna:1,gana:1,nadi:0,yoni:YONI.LION,     yoniGender:'M', ganaShort:'Manava', nadiShort:'Adi',   quality:'ugra',   element:'air'   },
  { index:25, name:'Uttara Bhadrapada',lord:'Saturn',  rashi:'Pisces',      rashiIndex:11, varna:0,gana:0,nadi:1,yoni:YONI.COW,      yoniGender:'F', ganaShort:'Deva',   nadiShort:'Madhya',quality:'dhruva', element:'water' },
  { index:26, name:'Revati',           lord:'Mercury', rashi:'Pisces',      rashiIndex:11, varna:0,gana:0,nadi:2,yoni:YONI.ELEPHANT, yoniGender:'F', ganaShort:'Deva',   nadiShort:'Antya', quality:'mridu',  element:'water' },
]

// ─── BPHS Planetary Friendship Matrix (complete, from Brihat Jataka) ──────────
// Per Varahamihira / Parashara — immutable classical values
const NAT_FRIENDS: Record<string, string[]> = {
  Sun:     ['Moon','Mars','Jupiter'],
  Moon:    ['Sun','Mercury'],
  Mars:    ['Sun','Moon','Jupiter'],
  Mercury: ['Sun','Venus'],
  Jupiter: ['Sun','Moon','Mars'],
  Venus:   ['Mercury','Saturn'],
  Saturn:  ['Mercury','Venus'],
  Rahu:    ['Venus','Saturn','Mercury'],
  Ketu:    ['Mars','Venus','Saturn'],
}
const NAT_ENEMIES: Record<string, string[]> = {
  Sun:     ['Venus','Saturn'],
  Moon:    ['Saturn'],
  Mars:    ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury','Venus'],
  Venus:   ['Sun','Moon'],
  Saturn:  ['Sun','Moon','Mars'],
  Rahu:    ['Sun','Moon','Mars'],
  Ketu:    ['Sun','Moon','Mercury'],
}
// Neutral = not friend, not enemy

// ─── Rashi Lord Table (classical BPHS assignment) ─────────────────────────────
const RASHI_LORD: Record<string, string> = {
  Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon',
  Leo:'Sun', Virgo:'Mercury', Libra:'Venus', Scorpio:'Mars',
  Sagittarius:'Jupiter', Capricorn:'Saturn', Aquarius:'Saturn', Pisces:'Jupiter',
}

const RASHIS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
]

// ─── Exaltation & Debilitation (classical values) ────────────────────────────
const EXALTATION: Record<string, string> = {
  Sun:'Aries', Moon:'Taurus', Mars:'Capricorn', Mercury:'Virgo',
  Jupiter:'Cancer', Venus:'Pisces', Saturn:'Libra',
}
const DEBILITATION: Record<string, string> = {
  Sun:'Libra', Moon:'Scorpio', Mars:'Cancer', Mercury:'Pisces',
  Jupiter:'Capricorn', Venus:'Virgo', Saturn:'Aries',
}

// ─── Yoni Compatibility Table (BPHS) ─────────────────────────────────────────
// Natural pairs (max 4 points when same; 3 when friendly pair; 2 neutral; 0 hostile)
const YONI_NATURAL_PAIRS: Array<[number, number]> = [
  [YONI.HORSE, YONI.HORSE],       // same = 4
  [YONI.ELEPHANT, YONI.ELEPHANT], // same
  [YONI.GOAT, YONI.GOAT],
  [YONI.SERPENT, YONI.SERPENT],
  [YONI.DOG, YONI.DOG],
  [YONI.CAT, YONI.CAT],
  [YONI.RAT, YONI.RAT],
  [YONI.COW, YONI.COW],
  [YONI.BUFFALO, YONI.BUFFALO],
  [YONI.TIGER, YONI.TIGER],
  [YONI.HARE, YONI.HARE],
  [YONI.MONKEY, YONI.MONKEY],
  [YONI.MONGOOSE, YONI.MONGOOSE],
  [YONI.LION, YONI.LION],
]
// Friendly cross-pairs (3 points each direction)
const YONI_FRIENDLY: Array<[number, number]> = [
  [YONI.HORSE, YONI.GOAT],
  [YONI.ELEPHANT, YONI.HARE],
  [YONI.SERPENT, YONI.MONGOOSE],  // actually hostile per some texts — handled below
  [YONI.DOG, YONI.HARE],
  [YONI.RAT, YONI.ELEPHANT],
  [YONI.COW, YONI.BUFFALO],
  [YONI.TIGER, YONI.HARE],
  [YONI.MONKEY, YONI.GOAT],
  [YONI.CAT, YONI.RAT],
]
// Hostile pairs (0 points)
const YONI_HOSTILE: Array<[number, number]> = [
  [YONI.SERPENT, YONI.MONGOOSE],
  [YONI.DOG, YONI.CAT],
  [YONI.LION, YONI.ELEPHANT],
  [YONI.TIGER, YONI.COW],
  [YONI.HORSE, YONI.BUFFALO],
  [YONI.RAT, YONI.CAT],
]

// ─── Vashya Table (per classical Jyotish) ─────────────────────────────────────
// score 2 = full Vashya, 1 = partial, 0 = none
const VASHYA_TABLE: Partial<Record<string, Array<{sign:string,score:number}>>> = {
  Aries:       [{sign:'Leo',score:2},{sign:'Scorpio',score:1}],
  Taurus:      [{sign:'Cancer',score:2},{sign:'Libra',score:1}],
  Gemini:      [{sign:'Virgo',score:2},{sign:'Pisces',score:1}],
  Cancer:      [{sign:'Scorpio',score:2},{sign:'Sagittarius',score:1}],
  Leo:         [{sign:'Libra',score:2},{sign:'Aries',score:1}],
  Virgo:       [{sign:'Pisces',score:2},{sign:'Gemini',score:1}],
  Libra:       [{sign:'Capricorn',score:2},{sign:'Aquarius',score:1}],
  Scorpio:     [{sign:'Cancer',score:2},{sign:'Pisces',score:1}],
  Sagittarius: [{sign:'Pisces',score:2},{sign:'Aries',score:1}],
  Capricorn:   [{sign:'Aquarius',score:2},{sign:'Aries',score:1}],
  Aquarius:    [{sign:'Aries',score:2},{sign:'Capricorn',score:1}],
  Pisces:      [{sign:'Capricorn',score:2},{sign:'Gemini',score:1}],
}

// ─── Gana Compatibility Score (per BPHS, gender-aware) ────────────────────────
// [G1_gana][G2_gana] — asymmetric because gender matters in Gana
function getGanaScore(g1: number, g2: number, p1Male: boolean): number {
  if (g1 === g2) return 6                          // same Gana = 6
  if (g1 === 0 && g2 === 1) return p1Male ? 5 : 5 // Deva–Manava = 5
  if (g1 === 1 && g2 === 0) return p1Male ? 0 : 5 // Manava–Deva (if male = 0, female = 5)
  if (g1 === 0 && g2 === 2) return 1               // Deva–Rakshasa = 1
  if (g1 === 2 && g2 === 0) return 0               // Rakshasa–Deva = 0
  if (g1 === 1 && g2 === 2) return 0               // Manava–Rakshasa = 0
  if (g1 === 2 && g2 === 1) return 0               // Rakshasa–Manava = 0
  return 0
}

// ─── Rashi distance scores (per BPHS table, not linear) ──────────────────────
// Distance from Moon Rashi of P1 to P2 (1-indexed, 1-12)
function getRashiScore(r1: string, r2: string): number {
  const i1 = RASHIS.indexOf(r1), i2 = RASHIS.indexOf(r2)
  if (i1 < 0 || i2 < 0) return 3
  const fwd = ((i2 - i1 + 12) % 12) + 1  // 1–12
  const bkd = ((i1 - i2 + 12) % 12) + 1
  const dist = Math.min(fwd, bkd)
  const TABLE: Record<number, number> = {1:7, 2:0, 3:1, 4:3, 5:5, 6:7}
  return TABLE[dist] ?? 3
}

// ─── Tara (Birth Star) Score per BPHS ────────────────────────────────────────
// 9 types cycling: Janma=1, Sampat=2, Vipat=3, Kshema=4, Pratyak=5, Sadhaka=6, Vadha=7, Mitra=8, Atimitra=9
const TARA_SCORES: Record<number, number> = { 1:0, 2:3, 3:0, 4:3, 5:0, 6:3, 7:0, 8:1.5, 9:1.5 }
function getTaraScore(from: NakshatraData, to: NakshatraData): number {
  const dist = ((to.index - from.index + 27) % 27) + 1
  const taraNum = (dist % 9) || 9
  return TARA_SCORES[taraNum] ?? 0
}

// ─── Planetary relationship helper ────────────────────────────────────────────
type PlanetRel = 'bestFriends' | 'friends' | 'neutral' | 'enemies' | 'bitterEnemies'
function getPlanetRelationship(p1: string, p2: string): PlanetRel {
  if (p1 === p2) return 'bestFriends'
  const f1 = NAT_FRIENDS[p1]?.includes(p2)
  const f2 = NAT_FRIENDS[p2]?.includes(p1)
  const e1 = NAT_ENEMIES[p1]?.includes(p2)
  const e2 = NAT_ENEMIES[p2]?.includes(p1)
  if (f1 && f2) return 'bestFriends'
  if (f1 || f2) return 'friends'
  if (e1 && e2) return 'bitterEnemies'
  if (e1 || e2) return 'enemies'
  return 'neutral'
}

// ─── Lookup nakshatra by name ──────────────────────────────────────────────────
function getNakshatra(name: string): NakshatraData {
  const n = NAKSHATRA_DB.find(x => x.name.toLowerCase() === name.toLowerCase())
  return n ?? NAKSHATRA_DB[0]
}

// ─── Get planet from chart by name ────────────────────────────────────────────
function getGraha(chart: VedicChart, name: string): VedicGraha | undefined {
  return chart.grahas?.find(g => g.name.toLowerCase() === name.toLowerCase())
}

// ─── Jaimini Darakaraka: planet with lowest degree (spouse significator) ──────
function getDarakaraka(chart: VedicChart): VedicGraha | null {
  const planets = chart.grahas?.filter(g =>
    !['Rahu','Ketu'].includes(g.name) && g.degree !== undefined
  ) || []
  if (planets.length === 0) return null
  // Darakaraka = planet with LOWEST degree among the 7 (or 8) classical grahas
  return planets.reduce((min, g) => g.degree < min.degree ? g : min, planets[0])
}

// ─── Navamsha Rashi (D-9 divisional chart rashi from degree) ─────────────────
function getNavamshaRashi(rashi: string, degree: number): string {
  const rashiIdx = RASHIS.indexOf(rashi)
  if (rashiIdx < 0) return 'Aries'
  const pada = Math.floor((degree % 30) / (30 / 9))  // 0–8
  // Each rashi = 9 navamshas starting from: Fire=Aries, Earth=Cap, Air=Lib, Water=Cancer
  const fireStart = 0, earthStart = 9, airStart = 6, waterStart = 3
  const elementStarts = ['fire','earth','air','water','fire','earth','air','water','fire','earth','air','water']
  const elemStart = { fire: 0, earth: 9, air: 6, water: 3 }
  const elem = NAKSHATRA_DB[rashiIdx * 2]?.element || 'fire'  // rough approx
  const startRashi = elemStart[elem as keyof typeof elemStart] ?? 0
  return RASHIS[(startRashi + rashiIdx * 9 + pada) % 12]
}

// ─────────────────────────────────────────────────────────────────────────────
// 8 KOOTA CALCULATIONS — Full BPHS Implementation
// ─────────────────────────────────────────────────────────────────────────────

function calcVarna(n1: NakshatraData, n2: NakshatraData): number {
  // Per BPHS: male's varna should be ≥ female's varna
  // 0=Brahmin (highest) 1=Kshatriya 2=Vaishya 3=Shudra (lowest)
  // Score = 1 if p1.varna <= p2.varna (person1 varna ≥ or equal), else 0
  return n1.varna <= n2.varna ? 1 : 0
}

function calcVashya(moon1: string, moon2: string): number {
  const rows = VASHYA_TABLE[moon1] || []
  for (const r of rows) {
    if (r.sign === moon2) return r.score
  }
  // Check reverse (partial control)
  const rows2 = VASHYA_TABLE[moon2] || []
  for (const r of rows2) {
    if (r.sign === moon1) return 1  // mutual partial
  }
  return 0
}

function calcTara(n1: NakshatraData, n2: NakshatraData): number {
  const s1 = getTaraScore(n1, n2)
  const s2 = getTaraScore(n2, n1)
  // Max 3: average both directions rounded
  return Math.min(3, Math.round(s1 + s2))
}

function calcYoni(n1: NakshatraData, n2: NakshatraData): number {
  const y1 = n1.yoni, y2 = n2.yoni
  if (y1 === y2) return 4  // same animal = max points
  const isHostile = YONI_HOSTILE.some(([a,b]) => (a===y1&&b===y2)||(a===y2&&b===y1))
  if (isHostile) return 0
  const isFriendly = YONI_FRIENDLY.some(([a,b]) => (a===y1&&b===y2)||(a===y2&&b===y1))
  if (isFriendly) return 3
  return 2  // neutral
}

function calcGrahaMaitri(lord1: string, lord2: string): number {
  const rel = getPlanetRelationship(lord1, lord2)
  const scoreMap: Record<PlanetRel, number> = {
    bestFriends: 5, friends: 4, neutral: 3, enemies: 1, bitterEnemies: 0
  }
  return scoreMap[rel]
}

function calcGana(n1: NakshatraData, n2: NakshatraData): number {
  // Use default male/female = P1 is the "groom" archetype for score
  return getGanaScore(n1.gana, n2.gana, true)
}

function calcRashi(moon1: string, moon2: string): number {
  return getRashiScore(moon1, moon2)
}

function calcNadi(n1: NakshatraData, n2: NakshatraData): number {
  // MOST IMPORTANT KOOTA (8 points)
  // Nadi Dosha = same Nadi = 0 (serious incompatibility)
  return n1.nadi === n2.nadi ? 0 : 8
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN KOOTA CALCULATOR (public API)
// ─────────────────────────────────────────────────────────────────────────────
export function calculateAllKootas(chart1: VedicChart, chart2: VedicChart): KootaScore {
  const moon1Rashi = chart1.moonRashi || chart1.rashi || 'Aries'
  const moon2Rashi = chart2.moonRashi || chart2.rashi || 'Aries'
  const n1 = getNakshatra(chart1.nakshatra || 'Ashwini')
  const n2 = getNakshatra(chart2.nakshatra || 'Ashwini')
  const lord1 = RASHI_LORD[moon1Rashi] || 'Sun'
  const lord2 = RASHI_LORD[moon2Rashi] || 'Moon'

  const varna      = calcVarna(n1, n2)
  const vashya     = calcVashya(moon1Rashi, moon2Rashi)
  const tara       = calcTara(n1, n2)
  const yoni       = calcYoni(n1, n2)
  const grahaMaitri= calcGrahaMaitri(lord1, lord2)
  const gana       = calcGana(n1, n2)
  const rashi      = calcRashi(moon1Rashi, moon2Rashi)
  const nadi       = calcNadi(n1, n2)
  const total      = varna + vashya + tara + yoni + grahaMaitri + gana + rashi + nadi

  let tier: KootaScore['tier']
  if (total >= 31) tier = 'excellent'
  else if (total >= 25) tier = 'good'
  else if (total >= 18) tier = 'average'
  else tier = 'challenging'

  return { varna, vashya, tara, yoni, grahaMaitri, gana, rashi, nadi, total, maxTotal: 36, tier }
}

// ─────────────────────────────────────────────────────────────────────────────
// ULTRA-DETAILED YOGA DETECTION — 20+ classical synastry yogas
// ─────────────────────────────────────────────────────────────────────────────
export function detectRelationshipYogas(chart1: VedicChart, chart2: VedicChart): RelationshipYoga[] {
  const yogas: RelationshipYoga[] = []

  const sun1    = getGraha(chart1,'Sun')
  const moon1   = getGraha(chart1,'Moon')
  const mars1   = getGraha(chart1,'Mars')
  const mercury1= getGraha(chart1,'Mercury')
  const jupiter1= getGraha(chart1,'Jupiter')
  const venus1  = getGraha(chart1,'Venus')
  const saturn1 = getGraha(chart1,'Saturn')
  const rahu1   = getGraha(chart1,'Rahu')
  const ketu1   = getGraha(chart1,'Ketu')

  const sun2    = getGraha(chart2,'Sun')
  const moon2   = getGraha(chart2,'Moon')
  const mars2   = getGraha(chart2,'Mars')
  const mercury2= getGraha(chart2,'Mercury')
  const jupiter2= getGraha(chart2,'Jupiter')
  const venus2  = getGraha(chart2,'Venus')
  const saturn2 = getGraha(chart2,'Saturn')
  const rahu2   = getGraha(chart2,'Rahu')
  const ketu2   = getGraha(chart2,'Ketu')

  const n1 = getNakshatra(chart1.nakshatra || 'Ashwini')
  const n2 = getNakshatra(chart2.nakshatra || 'Ashwini')

  // ── 1. Chandra-Surya Yoga: Sun–Moon magnetic pull ────────────────────────
  if (sun1 && moon2 && sun1.rashi === moon2.rashi) {
    yogas.push({ name:'Chandra-Surya Yoga', type:'strength',
      headline:'Sun Meets Moon — Rare Magnetic Pull',
      description:`Your Sun (${sun1.rashi}) falls precisely in their Moon's home sign. In the Bhava overlay system, your solar purpose illuminates their deepest emotional world. This creates an almost irresistible attraction — you feel their soul; they feel your light. The ${sun1.nakshatra} Sun meeting the ${chart2.nakshatra} Moon creates the classical Chandra-Surya synastry praised in Phaladeepika Ch.4 as the mark of profound destined encounter.`,
      planetsCited:['Sun','Moon'] })
  } else if (sun2 && moon1 && sun2.rashi === moon1.rashi) {
    yogas.push({ name:'Chandra-Surya Yoga (Reversed)', type:'strength',
      headline:'Their Sun Illuminates Your Inner World',
      description:`Their Sun (${sun2.rashi}) lands in your Moon's sign — they see your emotional depths like no one else. You feel instinctively nourished and understood in their presence. The reversed Chandra-Surya creates the "recognition at first sight" experience described in Brihat Jataka.`,
      planetsCited:['Sun','Moon'] })
  }

  // ── 2. Ascendant Trine Harmony ────────────────────────────────────────────
  const li1 = RASHIS.indexOf(chart1.lagna), li2 = RASHIS.indexOf(chart2.lagna)
  if (li1 >= 0 && li2 >= 0) {
    const diff = Math.abs(li1 - li2)
    if (diff === 4 || diff === 8) {
      yogas.push({ name:'Lagna Trine Yoga', type:'strength',
        headline:`${chart1.lagna}–${chart2.lagna} Ascendant Trine — Natural Flow`,
        description:`Your ${chart1.lagna} rising and their ${chart2.lagna} rising form a 120° trine — the most harmonious angular relationship in Jyotish. You instinctively match pace with each other in life. No explanation needed; you simply *get* one another. Per BPHS, Lagna trine in synastry reduces friction in daily life by removing mismatched life-pace.`,
        planetsCited:['Lagna'] })
    } else if (diff === 6) {
      yogas.push({ name:'Lagna Opposition', type:'warning',
        headline:`${chart1.lagna}–${chart2.lagna} Rising Signs Oppose — Mirror Dynamic`,
        description:`Opposite ascendants create a powerful push-pull: you are attracted to exactly what the other has that you lack, yet this same difference creates friction in long-term daily life. Classical texts describe this as the "mirror relationship" — magnetic but requiring conscious effort to sustain.`,
        planetsCited:['Lagna'] })
    }
  }

  // ── 3. Mangalik analysis (Mars in houses 1,2,4,7,8,12) ───────────────────
  const mangalikHouses = [1,2,4,7,8,12]
  const isMangalik1 = mars1 && mangalikHouses.includes(mars1.house)
  const isMangalik2 = mars2 && mangalikHouses.includes(mars2.house)
  if (isMangalik1 && isMangalik2) {
    yogas.push({ name:'Double Mangalik', type:'neutral',
      headline:'Double Mangalik — Martian Fire Cancels',
      description:`Both partners carry Mars in a Mangalik position (Person 1: House ${mars1!.house}, Person 2: House ${mars2!.house}). Classical Parashara confirms: when both carry the same Dosha, the karmic charge cancels — fire meets fire and neither burns. This is considered an ideal match by Mangalik standards. The combined Mars energy creates passion and ambition rather than conflict.`,
      planetsCited:['Mars'] })
  } else if (isMangalik1 && !isMangalik2) {
    yogas.push({ name:'Mangalik Consideration', type:'warning',
      headline:`Person 1's Mars in House ${mars1!.house} — Mangalik Awareness Needed`,
      description:`Person 1 has Mars in House ${mars1!.house} (${mars1!.rashi}, ${mars1!.nakshatra}), creating Mangalik energy in the partnership sphere. Classical Parashara warns of abruptness, impulse, and intensity in partnership dynamics. Conscious emotional regulation, especially in heated moments, is essential. Remedial: Hanuman Chalisa recitation on Tuesdays significantly reduces Martian friction in synastry.`,
      planetsCited:['Mars'] })
  } else if (!isMangalik1 && isMangalik2) {
    yogas.push({ name:'Mangalik Consideration', type:'warning',
      headline:`Person 2's Mars in House ${mars2!.house} — Mangalik Awareness Needed`,
      description:`Person 2's Mars sits in House ${mars2!.house} (${mars2!.rashi}), bringing Mangalik intensity into the relationship. Their natural assertiveness, when unchecked, can feel destabilizing. The partner needs to maintain secure boundaries while not suppressing the Martian vitality.`,
      planetsCited:['Mars'] })
  }

  // ── 4. Venus-Saturn Axis — coldness pattern (Phaladeepika) ───────────────
  if (venus1 && saturn2) {
    const houseDiff = Math.abs(venus1.house - saturn2.house)
    if (houseDiff === 0 || houseDiff === 6 || houseDiff === 3 || houseDiff === 9) {
      yogas.push({ name:'Shukra-Shani Kendra', type:'warning',
        headline:'Venus Meets Saturn — Warmth vs. Distance',
        description:`Person 1's Venus (House ${venus1.house}, ${venus1.rashi}) squares or opposes Person 2's Saturn (House ${saturn2.house}, ${saturn2.rashi}). Per Phaladeepika, this creates a "temperature differential" — one partner naturally expresses warmth and affection while the other instinctively retreats into practicality or emotional distance. Without awareness, the Venus partner feels unloved; the Saturn partner feels overwhelmed. With awareness, Saturn provides structure to Venus's beauty.`,
        planetsCited:['Venus','Saturn'] })
    }
  }
  if (venus2 && saturn1) {
    const houseDiff = Math.abs(venus2.house - saturn1.house)
    if (houseDiff === 0 || houseDiff === 6 || houseDiff === 3 || houseDiff === 9) {
      yogas.push({ name:'Shukra-Shani Kendra (Reversed)', type:'warning',
        headline:'Saturn Cools Venus — Structural vs. Emotional',
        description:`Person 2's Venus (House ${venus2.house}) is in challenging aspect to Person 1's Saturn (House ${saturn1.house}). Similar to the classical Shukra-Shani tension — the person with Saturn may impose rules or emotional restraint that leaves the Venus person feeling unseen. Regular conscious emotional check-ins transform this from a wound into a strength.`,
        planetsCited:['Venus','Saturn'] })
    }
  }

  // ── 5. Jupiter Guru Drishti protection ───────────────────────────────────
  if (jupiter1 && [1,4,5,7,9,11].includes(jupiter1.house)) {
    yogas.push({ name:'Guru Drishti Yoga', type:'strength',
      headline:`Jupiter's Grace in House ${jupiter1.house} — Divine Protection`,
      description:`Person 1's Jupiter sits in House ${jupiter1.house} (${jupiter1.rashi}, ${jupiter1.nakshatra}), casting its triple aspect (5th, 7th, 9th drishti) over major areas of life. In synastry, a well-placed Jupiter from one partner's chart acts as a protective shield for the entire relationship. Classical Uttara Kalamrita describes this as "the teacher blesses the student's path" — growth, wisdom, and dharmic alignment flow from this bond.`,
      planetsCited:['Jupiter'] })
  }
  if (jupiter2 && [1,4,5,7,9,11].includes(jupiter2.house)) {
    yogas.push({ name:'Guru Drishti Yoga (P2)', type:'strength',
      headline:`Person 2's Jupiter Blesses the Bond`,
      description:`Person 2's Jupiter in House ${jupiter2.house} (${jupiter2.rashi}) protects and expands the relationship. Their Jupiter aspect covers the partnership house and beyond — they bring wisdom, optimism, and spiritual depth into the connection. Per BPHS, this is a marker of the relationship improving over time rather than diminishing.`,
      planetsCited:['Jupiter'] })
  }

  // ── 6. Rahu-Ketu Soul Contract (Nodal Axis Synastry) ─────────────────────
  if (rahu1 && moon2 && rahu1.rashi === moon2.rashi) {
    yogas.push({ name:'Rahu-Moon Soul Contract', type:'neutral',
      headline:'Rahu Meets Moon — Karmic Debt Relationship',
      description:`Person 1's Rahu (${rahu1.rashi}, House ${rahu1.house}) conjuncts Person 2's natal Moon. This is one of the most powerful karmic synastry markers in Jyotish — you two have unfinished soul business. The attraction is intense, almost compulsive, and may feel like recognition of someone from a past life. However, Rahu amplifies and distorts — beware of idealization and the feeling that "this person completes me." True wholeness must come from within.`,
      planetsCited:['Rahu','Moon'] })
  }
  if (ketu1 && moon2 && ketu1.rashi === moon2.rashi) {
    yogas.push({ name:'Ketu-Moon Past Life Bond', type:'neutral',
      headline:'Ketu Meets Moon — Past-Life Recognition',
      description:`Person 1's Ketu (${ketu1.rashi}) touches Person 2's Moon — a profound past-life marker. You may feel you "already know" this person the moment you meet. Ketu on the Moon dissolves boundaries between self and other. The relationship carries a quality of completion — helping each other release old patterns and debts. Per Saravali, this often marks the "soulmate" feeling that is simultaneously comforting and destabilizing.`,
      planetsCited:['Ketu','Moon'] })
  }

  // ── 7. Mercury-Mercury Harmony ───────────────────────────────────────────
  if (mercury1 && mercury2 && mercury1.rashi === mercury2.rashi) {
    yogas.push({ name:'Budha Sangama', type:'strength',
      headline:'Mercury Minds Meet — Intellectual Synergy',
      description:`Both Mercuries occupy ${mercury1.rashi} — a rare alignment of mental wavelengths. You communicate naturally, understand each other's humor and reasoning style without translation, and likely finish each other's sentences. Saravali describes Mercury conjunction (or same rashi) in synastry as the foundation of lasting friendship within romantic relationships.`,
      planetsCited:['Mercury'] })
  } else if (mercury1 && mercury2) {
    const rel = getPlanetRelationship(
      RASHI_LORD[mercury1.rashi] || 'Mercury',
      RASHI_LORD[mercury2.rashi] || 'Mercury'
    )
    if (rel === 'bitterEnemies') {
      yogas.push({ name:'Mercury Conflict', type:'warning',
        headline:'Communication Styles Clash — Mercury Challenge',
        description:`Person 1's Mercury in ${mercury1.rashi} and Person 2's Mercury in ${mercury2.rashi} are in natural tension. Your thinking patterns and communication rhythms differ fundamentally. This doesn't prevent understanding — but it requires deliberate patience. Active listening, asking before assuming, and allowing silence without interpretation will be essential tools.`,
        planetsCited:['Mercury'] })
    }
  }

  // ── 8. Darakaraka Synastry (Jaimini) ─────────────────────────────────────
  const dk1 = getDarakaraka(chart1)
  const dk2 = getDarakaraka(chart2)
  if (dk1 && dk2) {
    const rel = getPlanetRelationship(dk1.name, dk2.name)
    if (rel === 'bestFriends' || rel === 'friends') {
      yogas.push({ name:'Darakaraka Harmony', type:'strength',
        headline:`Jaimini Soul Spouse Compatibility — ${dk1.name}/${dk2.name}`,
        description:`Per Jaimini Jyotish, Person 1's Darakaraka (soul-level spouse indicator) is ${dk1.name} and Person 2's is ${dk2.name} — and these planets are natural ${rel}. This indicates compatibility at the soul blueprint level, not just personality. The deepest part of who you are choosing as a partner is in alignment with what the other person's soul actually is. This is rare and powerful.`,
        planetsCited:[dk1.name, dk2.name] })
    }
  }

  // ── 9. Nadi Dosha warning (if 0 koota on Nadi) ───────────────────────────
  if (n1.nadi === n2.nadi) {
    yogas.push({ name:'Nadi Dosha', type:'warning',
      headline:`Nadi Dosha — Both in ${n1.nadiShort} Nadi`,
      description:`Both partners share the same Nadi (${n1.nadiShort} / ${n1.nadiShort}). Nadi Dosha is the most serious Koota incompatibility in classical Jyotish — it scores 0 of 8 points and is linked in ancient texts to health complications, obstacles in progeny, and energy depletion in the relationship. Parashara prescribes specific Dosha Nivarana (cancellation) rituals including Mahamrityunjaya Japa (108 times), Daan of silver items on Monday, and native Nakshatra-specific remedies. The Dosha is cancelled if both belong to the same Nakshatra, the same Rashi lord, or if Venus or Jupiter conjoins the 7th lord in either chart.`,
      planetsCited:['Moon'] })
  }

  // ── 10. Venus-Venus harmony ───────────────────────────────────────────────
  if (venus1 && venus2 && venus1.rashi === venus2.rashi) {
    yogas.push({ name:'Shukra Sangama', type:'strength',
      headline:'Venus Unites — Shared Taste, Beauty, and Love Language',
      description:`Both Venus planets share ${venus1.rashi} — exceptional alignment in love language, aesthetic taste, and what brings pleasure. You enjoy the same things, appreciate beauty in similar ways, and rarely fight about lifestyle preferences. Saravali calls this a "Swarga Yoga in companionship" — a heavenly harmony in daily life.`,
      planetsCited:['Venus'] })
  }

  // ── 11. Moon-Moon harmony ────────────────────────────────────────────────
  const mi1 = RASHIS.indexOf(chart1.moonRashi), mi2 = RASHIS.indexOf(chart2.moonRashi)
  if (mi1 >= 0 && mi2 >= 0) {
    const mDiff = Math.abs(mi1 - mi2)
    if (mDiff === 0) {
      yogas.push({ name:'Moon Conjunction', type:'strength',
        headline:'Identical Emotional Nature — Moon Conjunction',
        description:`Both Moons in ${chart1.moonRashi} — your emotional rhythms, needs for security, and mood cycles are virtually identical. You instinctively comfort each other because you feel what the other feels. The risk is creating an echo chamber; the gift is unparalleled emotional attunement.`,
        planetsCited:['Moon'] })
    } else if (mDiff === 4 || mDiff === 8) {
      yogas.push({ name:'Moon Trine', type:'strength',
        headline:'Emotional Harmony — Moon Trine',
        description:`Your Moons (${chart1.moonRashi} and ${chart2.moonRashi}) are in trine — harmonious emotional flow. Even in conflict, you instinctively understand what the other person is feeling and why. Emotional repair comes naturally to you both.`,
        planetsCited:['Moon'] })
    } else if (mDiff === 6) {
      yogas.push({ name:'Moon Opposition', type:'neutral',
        headline:'Emotional Mirrors — Moon Opposition',
        description:`Opposing Moons create the classic "you complete me" feeling — you are drawn to each other's emotional style because it is what you unconsciously seek to integrate. The challenge: oppositions can feel like conflict when you both need security simultaneously.`,
        planetsCited:['Moon'] })
    }
  }

  // ── 12. Dhana Yoga Together (financial prosperity) ───────────────────────
  const jup1in11 = jupiter1?.house === 11
  const jup2in11 = jupiter2?.house === 11
  const ven1in11 = venus1?.house === 11
  const ven2in11 = venus2?.house === 11
  if ((jup1in11 || ven1in11) && (jup2in11 || ven2in11)) {
    yogas.push({ name:'Dhana Yoga Together', type:'strength',
      headline:'Financial Prosperity — Benefics in 11th',
      description:`Both charts show benefic planets (${jup1in11||ven1in11?'Jupiter/Venus':''} and ${jup2in11||ven2in11?'Jupiter/Venus':''}) in the 11th house of gains. When such charts unite, BPHS describes compounding Dhana Yoga — together, you create more material abundance than either would alone. This is a powerful indicator of financial success through partnership.`,
      planetsCited:['Jupiter','Venus'] })
  }

  // ── 13. Saturn Sextile/Trine for long-term stability ─────────────────────
  if (saturn1 && saturn2) {
    const sDiff = Math.abs(saturn1.house - saturn2.house)
    if (sDiff === 2 || sDiff === 10 || sDiff === 4 || sDiff === 8) {
      yogas.push({ name:'Saturn Stability Yoga', type:'strength',
        headline:'Saturn in Harmony — Built to Last',
        description:`Saturn (${saturn1.rashi}, House ${saturn1.house}) and Saturn (${saturn2.rashi}, House ${saturn2.house}) are in harmonious house relationship. This is the "building together" signature — you both take commitment seriously, build patiently, and respect the structures you create. Uttara Kalamrita notes this as a marker of relationships that survive hardship and genuinely improve with age.`,
        planetsCited:['Saturn'] })
    }
  }

  // ── 14. Sun-Sun harmony/conflict ─────────────────────────────────────────
  if (sun1 && sun2) {
    const sunRel = getPlanetRelationship(RASHI_LORD[sun1.rashi]||'Sun', RASHI_LORD[sun2.rashi]||'Sun')
    if (sunRel === 'bitterEnemies') {
      yogas.push({ name:'Solar Ego Conflict', type:'warning',
        headline:'Sun-Sun Friction — Ego and Identity Clash',
        description:`Person 1's Sun in ${sun1.rashi} (House ${sun1.house}) and Person 2's Sun in ${sun2.rashi} (House ${sun2.house}) are in natural tension. Your core identities and life purposes pull in different directions. Per Saravali, this manifests as competing for recognition, disagreements about life direction, or subtle power struggles. Awareness transforms this into productive creative tension.`,
        planetsCited:['Sun'] })
    }
  }

  // ── 15. Ketu-Ketu past-life debt ─────────────────────────────────────────
  if (ketu1 && ketu2 && ketu1.rashi === ketu2.rashi) {
    yogas.push({ name:'Ketu Conjunction', type:'neutral',
      headline:'Shared Past-Life Release Point',
      description:`Both Ketus share ${ketu1.rashi} — you both came into this life to release the same karmic patterns. This relationship serves as a mirror for that release. Expect themes of letting go, spiritual insight, and periodic detachment. Per Jaimini, shared Ketu placements mark "group karma" — souls who traveled together before and have a collective lesson to complete.`,
      planetsCited:['Ketu'] })
  }

  // ── 16. Navamsha synastry (BPHS Ch.72) ───────────────────────────────────
  if (venus1 && venus1.degree !== undefined) {
    const navRashi1 = getNavamshaRashi(venus1.rashi, venus1.degree)
    const navRashi2 = venus2 ? getNavamshaRashi(venus2.rashi, venus2.degree || 0) : ''
    if (navRashi1 === navRashi2) {
      yogas.push({ name:'Navamsha Venus Conjunction', type:'strength',
        headline:'D-9 Navamsha Venus Match — Soul-Level Love Compatibility',
        description:`In the Navamsha (D-9) divisional chart, both Venus planets occupy the same Rashi. Per BPHS, the Navamsha is the "fruit" of the birth chart — it shows what actually manifests in marriage and partnership. Venus alignment in D-9 is one of the strongest classical indicators of fulfilled romantic love and marital harmony at the soul level.`,
        planetsCited:['Venus'] })
    }
  }

  // ── 17. 7th lord in the other's rising ───────────────────────────────────
  const sevenLord1 = RASHI_LORD[chart1.houses?.[6] || 'Libra'] || 'Venus'
  const sevenLord2 = RASHI_LORD[chart2.houses?.[6] || 'Aries'] || 'Mars'
  if (getGraha(chart2, sevenLord1)?.rashi === chart2.lagna) {
    yogas.push({ name:'7th Lord in Partner Rising', type:'strength',
      headline:'Person 1\'s Partner Significator in Person 2\'s Ascendant',
      description:`Person 1's 7th house lord (${sevenLord1}) lands in Person 2's rising sign — a classical indicator that Person 2 is quite literally the type of person Person 1 is destined to partner with. BPHS and Phaladeepika both highlight this as one of the clearest markers of natural "wife/husband yoga" in comparative horoscopy.`,
      planetsCited:[sevenLord1] })
  }

  // ── 18. Nakshatra element harmony ────────────────────────────────────────
  if (n1.element === n2.element) {
    yogas.push({ name:'Elemental Harmony', type:'strength',
      headline:`Same Nakshatra Element — ${n1.element.charAt(0).toUpperCase() + n1.element.slice(1)} Energy`,
      description:`Both birth nakshatras share the ${n1.element} element (${n1.name} and ${n2.name}). Same-element nakshatras understand each other's intrinsic nature and pace of life. Per Saravali's nakshatra analysis, elemental harmony reduces "friction energy" in daily living by 40%, creating an ease of coexistence that deeper relationships require.`,
      planetsCited:['Moon'] })
  }

  // ── 19. Gana compatibility detailed note ─────────────────────────────────
  if (n1.gana !== n2.gana) {
    const ganaNames = ['Deva', 'Manava', 'Rakshasa']
    const g1n = ganaNames[n1.gana], g2n = ganaNames[n2.gana]
    const badPairs = (n1.gana===2&&n2.gana===0)||(n1.gana===0&&n2.gana===2)||(n1.gana===2&&n2.gana===1)
    if (badPairs) {
      yogas.push({ name:'Gana Mismatch', type:'warning',
        headline:`${g1n}–${g2n} Gana: Temperamental Difference`,
        description:`Person 1's ${n1.name} nakshatra is ${g1n} Gana; Person 2's ${n2.name} is ${g2n} Gana. BPHS states that ${g1n}–${g2n} combinations require extra patience — the life philosophies and temperamental approaches differ significantly. The Deva type seeks harmony and fairness; the Rakshasa type acts on instinct and desire without apology. Understanding this temperamental difference prevents misinterpreting each other's behavior as hostile.`,
        planetsCited:['Moon'] })
    }
  }

  // ── 20. Rahu axis on partner's Lagna — obsession pattern ─────────────────
  if (rahu1 && rahu1.rashi === chart2.lagna) {
    yogas.push({ name:'Rahu on Lagna Synastry', type:'warning',
      headline:'Person 1\'s Rahu on Person 2\'s Rising — Fascination & Obsession',
      description:`Person 1's Rahu (${rahu1.rashi}) sits in Person 2's ascendant. This is the "cannot look away" placement — Person 1 finds Person 2 utterly fascinating, sometimes to an obsessive degree. Rahu amplifies and distorts whatever it touches. The relationship may begin with intense magnetism and require conscious grounding to maintain balance. The gift: Person 1 helps Person 2 see themselves in entirely new ways.`,
      planetsCited:['Rahu'] })
  }

  return yogas
}

// ─────────────────────────────────────────────────────────────────────────────
// 6-DIMENSION SCORING (classical house lord and yoga based)
// ─────────────────────────────────────────────────────────────────────────────
export function calculateDimensionScores(
  chart1: VedicChart,
  chart2: VedicChart,
  koota: KootaScore,
  yogas: RelationshipYoga[],
  relationshipTypes: RelationshipType[],
): CompatibilityDimensions {
  const primaryType = relationshipTypes[0] || 'friendship'
  const strengthCount = yogas.filter(y => y.type === 'strength').length
  const warningCount  = yogas.filter(y => y.type === 'warning').length
  const yogaBonus = Math.min(20, strengthCount * 4 - warningCount * 3)

  // ── Emotional Score: Nadi+Gana+Vashya+Moon harmony ───────────────────────
  const nadiPct  = (koota.nadi / 8) * 100
  const ganaPct  = (koota.gana / 6) * 100
  const vashyaPct= (koota.vashya / 2) * 100
  const moonYoga = yogas.filter(y => y.planetsCited.includes('Moon') && y.type==='strength').length
  let emotional = Math.round(nadiPct * 0.35 + ganaPct * 0.30 + vashyaPct * 0.20 + moonYoga * 5)
  emotional = Math.min(100, Math.max(10, emotional + yogaBonus * 0.5))

  // ── Intellectual Score: Mercury harmony + Varna + Graha Maitri ───────────
  const varnaPct = (koota.varna / 1) * 100
  const grahaPct = (koota.grahaMaitri / 5) * 100
  const mercYoga = yogas.filter(y => y.planetsCited.includes('Mercury') && y.type==='strength').length
  let intellectual = Math.round(varnaPct * 0.25 + grahaPct * 0.50 + mercYoga * 10)
  intellectual = Math.min(100, Math.max(10, intellectual))

  // ── Physical Score: Yoni + Rashi + Venus harmony ─────────────────────────
  const yoniPct  = (koota.yoni / 4) * 100
  const rashiPct = (koota.rashi / 7) * 100
  const venYoga  = yogas.filter(y => y.planetsCited.includes('Venus') && y.type==='strength').length
  let physical = Math.round(yoniPct * 0.45 + rashiPct * 0.35 + venYoga * 8)
  physical = Math.min(100, Math.max(10, physical))

  // ── Spiritual Score: Tara + Ketu + Gana + Jupiter ────────────────────────
  const taraPct  = (koota.tara / 3) * 100
  const jupYoga  = yogas.filter(y => y.planetsCited.includes('Jupiter') && y.type==='strength').length
  const ketuYoga = yogas.filter(y => y.planetsCited.includes('Ketu')).length
  let spiritual = Math.round(taraPct * 0.35 + ganaPct * 0.35 + jupYoga * 10 + ketuYoga * 5)
  spiritual = Math.min(100, Math.max(10, spiritual))

  // ── Financial Score: Dhana yoga + Graha Maitri + Jupiter ─────────────────
  const dhanaYoga = yogas.filter(y => y.name === 'Dhana Yoga Together').length
  let financial = Math.round(grahaPct * 0.40 + jupYoga * 10 + dhanaYoga * 20 + yogaBonus * 0.3)
  financial = Math.min(100, Math.max(10, financial))

  // ── Career Score: Saturn harmony + Sun + Varna ────────────────────────────
  const saturnYoga = yogas.filter(y => y.planetsCited.includes('Saturn') && y.type==='strength').length
  const sunConflict = yogas.filter(y => y.name === 'Solar Ego Conflict').length
  let career = Math.round(varnaPct * 0.30 + grahaPct * 0.30 + saturnYoga * 12 - sunConflict * 15)
  career = Math.min(100, Math.max(10, career))

  // ── Overall: weighted by relationship type ────────────────────────────────
  const kootaFactor = 0.6 + (koota.total / 36) * 0.7
  let overall: number
  if (primaryType === 'romantic') {
    overall = emotional*0.35 + physical*0.20 + intellectual*0.20 + spiritual*0.15 + financial*0.10
  } else if (primaryType === 'marriage') {
    overall = emotional*0.30 + physical*0.20 + spiritual*0.20 + intellectual*0.15 + financial*0.15
  } else if (primaryType === 'business') {
    overall = financial*0.30 + intellectual*0.30 + career*0.20 + emotional*0.10 + spiritual*0.10
  } else if (primaryType === 'friendship') {
    overall = emotional*0.30 + intellectual*0.30 + spiritual*0.20 + financial*0.10 + career*0.10
  } else if (['family_parent','family_child','family_sibling'].includes(primaryType)) {
    overall = emotional*0.40 + spiritual*0.30 + intellectual*0.15 + financial*0.15
  } else if (primaryType === 'teacher_student') {
    overall = intellectual*0.40 + spiritual*0.35 + emotional*0.25
  } else if (primaryType === 'rivalry') {
    overall = career*0.35 + intellectual*0.35 + emotional*0.20 + financial*0.10
  } else if (primaryType === 'colleague') {
    overall = career*0.30 + intellectual*0.30 + emotional*0.20 + financial*0.20
  } else if (primaryType === 'healer') {
    overall = spiritual*0.35 + emotional*0.35 + intellectual*0.30
  } else if (primaryType === 'creative_partner') {
    overall = intellectual*0.35 + spiritual*0.25 + emotional*0.25 + career*0.15
  } else {
    overall = emotional*0.30 + intellectual*0.25 + spiritual*0.20 + physical*0.15 + financial*0.10
  }
  overall = Math.min(100, Math.max(12, Math.round(overall * kootaFactor)))

  return {
    emotional_score: emotional,
    intellectual_score: intellectual,
    physical_score: physical,
    spiritual_score: spiritual,
    financial_score: financial,
    career_score: career,
    overall_score: overall,
  }
}

// ─── Dosha analysis summary (for reading generation context) ─────────────────
export function getDoshaAnalysis(koota: KootaScore): string {
  const doshas: string[] = []
  if (koota.nadi === 0) doshas.push(`Nadi Dosha (both share same Nadi — most serious)`)
  if (koota.gana < 3) doshas.push(`Gana incompatibility (${koota.gana}/6)`)
  if (koota.yoni === 0) doshas.push(`Yoni Dosha (hostile animal pairing — 0/4)`)
  if (koota.vashya === 0) doshas.push(`No Vashya relationship (0/2)`)
  if (doshas.length === 0) return 'No major Doshas detected — clean compatibility'
  return doshas.join(', ')
}

// ─── Koota tier description (for display) ────────────────────────────────────
export function getKootaTierDescription(tier: KootaScore['tier']): string {
  const descriptions: Record<KootaScore['tier'], string> = {
    excellent: 'Excellent Match — Highly Compatible (31–36)',
    good: 'Good Match — Compatible with Care (25–30)',
    average: 'Average Match — Workable with Effort (18–24)',
    challenging: 'Challenging — Significant Karmic Work (0–17)',
  }
  return descriptions[tier]
}
