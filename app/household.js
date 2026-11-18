// Household setup, applicability rules and quantity maths. All assumptions are stated in data/sections.json
// ("assumptions") and shown on the site.
export const DEFAULT_HH = { adults: 2, children: 0, infants: 0, pets: 0, home: 'highrise', floor: 8, outdoor: 'none', car: false, climate: 'mixed', targetDays: 14,
  state: '', second: false, home2: 'house', floor2: 0, outdoor2: 'yard', climate2: 'mixed', state2: '',
  ages: null, diapers: 0, formula: 0, formulaForm: '', carried: 0, feeds: 8, hazards: null, hazards2: null };

// Children are counted by age band. The site asks for a band, never a birth date.
export const BANDS = { u1: 'Under 1', a1_2: '1 to 2', a3_5: '3 to 5', a6_9: '6 to 9', a10_13: '10 to 13', a14_17: '14 to 17' };
export const BAND_KEYS = Object.keys(BANDS);
// Hazards are asked for each home. Until the question is answered (null) nothing is hidden.
export const HAZARDS = { earthquake: 'Earthquakes', tornado: 'Tornadoes', hurricane: 'Hurricanes or coastal flooding', flood: 'River or flash flooding', smoke: 'Wildfire smoke', nuclear: 'A nuclear power plant within 10 miles' };
export const HAZARD_KEYS = Object.keys(HAZARDS);
// A formula-fed baby's own formula comes ready to feed, or only as powder. Until the question is answered
// both paths are shown. The site never suggests changing a baby's formula.
export const FORMULA_FORMS = { rtf: 'Yes, it is sold ready-to-feed', powder: 'No, only as powder' };
export const DEFAULT_FEEDS = 8;          // feeds a day for a formula-fed baby: an assumption the setup lets you change

export const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

export const HH_FIELDS = {
  home: { house: 'House', lowrise: 'Low-rise apartment (up to about 6 floors)', highrise: 'High-rise (about 7 floors or more)' },
  outdoor: { yard: 'Yard or garden', balcony: 'Balcony or patio only', none: 'None' },
  climate: { cold: 'Long freezing winters', mixed: 'Hot summers and freezing winters', hot: 'Hot most of the year', mild: 'Mild' },
  targetDays: { 3: '3 days', 14: '14 days', 30: '30 days' }
};

export function normalise(h) {
  const o = { ...DEFAULT_HH, ...(h || {}) };
  for (const k of ['adults', 'children', 'infants', 'pets', 'floor']) o[k] = Math.max(0, Math.min(99, parseInt(o[k], 10) || 0));
  if (o.adults < 1) o.adults = 1;
  if (!HH_FIELDS.home[o.home]) o.home = DEFAULT_HH.home;
  if (!HH_FIELDS.outdoor[o.outdoor]) o.outdoor = DEFAULT_HH.outdoor;
  if (!HH_FIELDS.climate[o.climate]) o.climate = DEFAULT_HH.climate;
  o.targetDays = [3, 14, 30].includes(+o.targetDays) ? +o.targetDays : 14;
  o.car = !!o.car;
  // Second home. Its answers are kept even while "second" is off, so switching it back on loses nothing.
  o.second = o.second === true || o.second === 'yes';
  o.floor2 = Math.max(0, Math.min(99, parseInt(o.floor2, 10) || 0));
  if (!HH_FIELDS.home[o.home2]) o.home2 = DEFAULT_HH.home2;
  if (!HH_FIELDS.outdoor[o.outdoor2]) o.outdoor2 = DEFAULT_HH.outdoor2;
  if (!HH_FIELDS.climate[o.climate2]) o.climate2 = DEFAULT_HH.climate2;
  o.state = STATES[o.state] ? o.state : '';
  o.state2 = STATES[o.state2] ? o.state2 : '';
  // Children by age band. A setup saved before the bands existed had only "children" and "infants":
  // its infants become "under 1", and its children are asked for their ages once (askAges). Until then
  // they are counted as 6 to 9, the middle band, so nothing about them is lost.
  const hadAges = o.ages && typeof o.ages === 'object';
  const ages = {};
  for (const k of BAND_KEYS) ages[k] = hadAges ? Math.max(0, Math.min(20, parseInt(o.ages[k], 10) || 0)) : 0;
  if (!hadAges) { ages.u1 = o.infants; ages.a6_9 = o.children; }
  o.askAges = !hadAges && o.children > 0;
  o.ages = ages;
  // The old two counts are kept in step, so an older copy of the site still reads a newer setup sensibly.
  o.infants = ages.u1;
  o.children = BAND_KEYS.reduce((s, k) => s + ages[k], 0) - ages.u1;
  const kids = o.children + o.infants;
  const under6 = ages.u1 + ages.a1_2 + ages.a3_5;
  const cap = (v, max, dflt) => Math.max(0, Math.min(max, v == null || v === '' || isNaN(parseInt(v, 10)) ? dflt : parseInt(v, 10)));
  // Old setups never said who is in diapers, on formula or carried: a baby is assumed to be all three.
  o.diapers = cap(hadAges ? o.diapers : ages.u1, kids, 0);
  o.formula = cap(hadAges ? o.formula : ages.u1, ages.u1 + ages.a1_2, 0);
  o.carried = cap(hadAges ? o.carried : ages.u1, under6 + ages.a6_9, 0);
  o.feeds = Math.max(1, Math.min(16, parseInt(o.feeds, 10) || DEFAULT_FEEDS));
  // How the baby's own formula is sold: ready-to-feed, powder only, or not answered yet ('').
  o.formulaForm = FORMULA_FORMS[o.formulaForm] && o.formula > 0 ? o.formulaForm : '';
  const haz = v => (Array.isArray(v) ? [...new Set(v.filter(k => HAZARDS[k]))] : null);
  o.hazards = haz(o.hazards); o.hazards2 = haz(o.hazards2);
  return o;
}

// One or two homes. Each home is the household seen from that building: same people, its own
// building answers (type, floor, outdoor space, climate, state).
export const homeList = h => (h.second ? [1, 2] : [1]);
export const hhFor = (h, n) => (n === 2 ? { ...h, home: h.home2, floor: h.floor2, outdoor: h.outdoor2, climate: h.climate2, state: h.state2, hazards: h.hazards2 } : h);
export const homeLabel = (h, n) => (n === 2 ? 'Second home' : 'First home') + (hhFor(h, n).state ? ` (${hhFor(h, n).state})` : '');
export const chosenStates = h => [...new Set(homeList(h).map(n => hhFor(h, n).state).filter(Boolean))];
export const matchesAnyHome = (only, h) => homeList(h).some(n => matches(only, hhFor(h, n)));

export const people = h => h.adults + h.children + h.infants;
const band = (h, k) => (h.ages && h.ages[k]) || 0;
export const teens = h => band(h, 'a14_17');
// A 14-to-17-year-old counts as an adult for bags, food, water and respirators.
export const adultSized = h => h.adults + teens(h);
// Children who get a child's bag of their own: aged 3 to 13. Under 3 an adult carries everything.
export const bagChildren = h => band(h, 'a3_5') + band(h, 'a6_9') + band(h, 'a10_13');
// People who use the toilet: everyone except children in diapers.
export const toiletUsers = h => Math.max(0, people(h) - (h.diapers || 0));

// What a household "has", for the `only.has` rules. A list in a rule means any of them.
export function hasTags(h) {
  const kids = h.children + h.infants;
  return { child: kids > 0, baby: band(h, 'u1') > 0, under5: band(h, 'u1') + band(h, 'a1_2') + band(h, 'a3_5') > 0,
    school_age: band(h, 'a6_9') + band(h, 'a10_13') > 0, teen: teens(h) > 0,
    carried: (h.carried || 0) > 0, diapers: (h.diapers || 0) > 0, formula: (h.formula || 0) > 0,
    formula_rtf: (h.formula || 0) > 0 && h.formulaForm !== 'powder', formula_powder: (h.formula || 0) > 0 && h.formulaForm !== 'rtf',
    pets: h.pets > 0, car: !!h.car, no_car: !h.car, one_adult: h.adults === 1,
    age3_5: band(h, 'a3_5') > 0, age6_9: band(h, 'a6_9') > 0, age10_13: band(h, 'a10_13') > 0, bag_child: bagChildren(h) > 0,
    // the two old tags, kept so a stray one still means something
    children: kids > 0, infants: band(h, 'u1') > 0 };
}
export const HAS_TAGS = ['child', 'baby', 'under5', 'school_age', 'teen', 'carried', 'diapers', 'formula', 'formula_rtf', 'formula_powder', 'pets', 'car', 'no_car', 'one_adult', 'bag_child', 'age3_5', 'age6_9', 'age10_13'];

// Does a rule ("only") match this household, seen from one home? Keys are ANDed; a list is "any of".
// `or` holds alternative rules: the action shows if the main rule or any alternative matches.
export function matches(only, h) {
  if (!only) return true;
  if (matchesMain(only, h)) return true;
  return Array.isArray(only.or) && only.or.some(alt => matchesMain(alt, h));
}
function matchesMain(only, h) {
  if (only.home && !only.home.includes(h.home)) return false;
  if (only.outdoor && !only.outdoor.includes(h.outdoor)) return false;
  if (only.climate && !only.climate.includes(h.climate)) return false;
  // A state rule (Oregon's own alert system, say) shows only for a home in that state.
  if (only.state && !only.state.includes(h.state)) return false;
  // A hazard rule hides nothing until the hazards question has been answered for this home.
  if (only.hazard && only.hazard.length && Array.isArray(h.hazards) && !only.hazard.some(k => h.hazards.includes(k))) return false;
  if (only.has && only.has.length) {
    const have = hasTags(h);
    if (!only.has.some(k => have[k])) return false;
  }
  return true;
}
// The level an action sits at for this household: its own, unless a `level_if` rule moves it.
export function levelFor(a, h) {
  for (const r of a.level_if || []) if (homeList(h).some(n => matchesMain(r, hhFor(h, n)))) return r.level;
  return a.level;
}

// Days each level number plans for. 1 is the 72-hour bag; 2 is 72 hours at home;
// 3 is two weeks, or 30 days if the household chose 30.
export function daysFor(level, h) {
  if (level <= 2) return 3;
  return h.targetDays >= 14 ? h.targetDays : 14;
}

export const PET_GAL_PER_DAY = 0.5;      // assumption, see DECISIONS.md D-09
export const TOILET_USES_PER_DAY = 5;    // Koto City emergency toilet guide
export const DIAPERS_PER_DAY = 8;        // assumption; newborns use more

export function waterGallons(level, h) {
  if (level === 1) return 0;
  return Math.ceil((people(h) * 1 + h.pets * PET_GAL_PER_DAY) * daysFor(level, h));
}

// Powdered formula needs sealed bottled water for every feed: 1 quart a day for each formula-fed baby
// is this site's assumption. Counted unless the setup says the formula comes ready to feed.
export const formulaWaterQuarts = (level, h) => (h.formula && h.formulaForm === 'powder' ? h.formula * daysFor(level < 2 ? 2 : level, h) : 0);
export const N95_PER_PERSON = 6;         // this site's assumption: 2 a day for 3 smoky days

const daysOf = (level, h, rule) => (rule && rule.days != null ? rule.days : Math.max(0, daysFor(level, h) - ((rule && rule.less_days) || 0)));
// Who a basis counts. Each entry: the number, and the same thing in words for the line printed beside it.
const WHO = {
  per_person: h => [people(h), 'person', 'people'],
  per_adult: h => [adultSized(h), 'adult or teenager aged 14 or over', 'adults and teenagers aged 14 or over'],
  per_child: h => [bagChildren(h), 'child aged 3 to 13', 'children aged 3 to 13'],
  per_infant: h => [band(h, 'u1'), 'baby under 1', 'babies under 1'],
  per_carried: h => [h.carried || 0, 'child who is carried', 'children who are carried'],
  per_diapered: h => [h.diapers || 0, 'child in diapers', 'children in diapers'],
  per_pet: h => [h.pets, 'pet', 'pets'],
  per_wearer: h => [adultSized(h), 'adult or teenager aged 14 or over', 'adults and teenagers aged 14 or over'],
  per_sleeper: h => [people(h) - band(h, 'u1'), 'person aged 1 or over', 'people aged 1 or over'],
  per_eater: h => [people(h) - band(h, 'u1') - band(h, 'a1_2') - band(h, 'a3_5'), 'person aged 6 or over', 'people aged 6 or over'],
  per_seat: h => [people(h), 'person who rides in the car', 'people who ride in the car']
};
export function basisValue(basis, level, h, rule) {
  // A rule may fix the number of days ("days") or leave out days covered another way ("less_days").
  const d = daysOf(level, h, rule);
  if (WHO[basis]) return Math.max((rule && rule.min) || 0, WHO[basis](h)[0]);
  switch (basis) {
    case 'fixed': case 'each_who': case 'count_yourself': return 1;
    case 'per_person_day': return people(h) * d;
    case 'per_user_day': return toiletUsers(h) * d;
    case 'water_gallons': return level === 1 && !(rule && rule.days) ? 0 : Math.ceil((people(h) + h.pets * PET_GAL_PER_DAY) * d);
    case 'toilet_bags': return toiletUsers(h) * TOILET_USES_PER_DAY * d;
    // Ready-to-feed bottles are counted only where the baby's own formula is sold that way.
    case 'formula_feeds': return h.formulaForm === 'powder' ? 0 : (h.formula || 0) * (h.feeds || DEFAULT_FEEDS) * d;
    case 'n95': return adultSized(h) * N95_PER_PERSON;
    default: return 1;
  }
}
const PLURAL = { person: 'people', baby: 'babies', child: 'children', 'formula-fed baby': 'formula-fed babies' };
const pl = (n, word) => `${fmtInt(n)} ${n === 1 ? word : (PLURAL[word] || word + 's')}`;
// The rule behind a worked-out quantity, in words, for the line printed beside the number.
export function ruleText(item, pick, level, h, override) {
  const rule = (override && override.at && override.at[level]) || (override && override.qty) || item.qty || { basis: 'fixed', factor: 1 };
  if (rule.rule) return rule.rule;                                   // a rule written out by hand in the data
  const f = rule.factor == null ? 1 : rule.factor, d = daysOf(level, h, rule), basis = rule.basis;
  const unit = rule.unit != null ? rule.unit : (pick && +pick.unit_size > 0 ? +pick.unit_size : 1);
  const packs = n => (unit > 1 && n > 0 ? `, sold in packs of ${fmtInt(unit)}, so ${pl(Math.max(1, Math.ceil(n / unit)), 'pack')}` : '');
  // A rule with its own number of days covers only those days, even in a plan for two weeks.
  const firstDays = rule.days != null && rule.days < daysFor(level, h) ? ` (the first ${rule.days} days only)` : '';
  const fx = f === 1 ? '' : f < 1 ? ` (1 for every ${fmtInt(Math.round(1 / f))})` : ` \u00d7 ${f}`;
  if (WHO[basis]) {
    const [n, one, many] = WHO[basis](h);
    const lead = f === 1 ? `1 for each ${one}` : f < 1 ? `1 for every ${fmtInt(Math.round(1 / f))} ${many}` : `${f} for each ${one}`;
    if (!n) return `${lead}${rule.min ? `, and never fewer than ${rule.min} for the household` : ': none in this household'}`;
    return `${lead}: ${fmtInt(n)} in your household${f > 1 ? `, so ${fmtInt(n * f)}` : ''}${rule.min ? ` (never fewer than ${rule.min})` : ''}${packs(n * f)}`;
  }
  switch (basis) {
    case 'fixed': return f === 1 ? '1 for the household' : `${fmtInt(f)} for the household`;
    case 'each_who': return rule.note || '1 for each person who needs it; the site does not ask who';
    case 'count_yourself': return rule.note || 'Count what your own devices take; the price shown is for one pack';
    case 'per_person_day': return `${f === 1 ? '1' : f} per person per day \u00d7 ${pl(people(h), 'person')} \u00d7 ${d} days${packs(people(h) * d * f)}`;
    case 'per_user_day': return `${f === 1 ? '1' : f} per person who uses the toilet per day \u00d7 ${fmtInt(toiletUsers(h))} \u00d7 ${d} days${packs(toiletUsers(h) * d * f)}`;
    case 'water_gallons': return `1 gallon per person per day${h.pets ? ' plus half a gallon per pet (an assumption)' : ''} \u00d7 ${d} days${firstDays} = ${fmtInt(basisValue(basis, level, h, rule))} gallons${fx}`;
    case 'toilet_bags': return `${TOILET_USES_PER_DAY} uses per person per day \u00d7 ${fmtInt(toiletUsers(h))} who use the toilet \u00d7 ${d} days${firstDays} = ${fmtInt(basisValue(basis, level, h, rule))}${packs(basisValue(basis, level, h, rule) * f)}`;
    case 'formula_feeds': if (!basisValue(basis, level, h, rule)) return h.formulaForm === 'powder' && h.formula ? 'None: this baby\u2019s formula is sold only as powder, so pack the powder and sealed bottled water (FN-01)' : 'One bottle for each feed: feeds a day \u00d7 days \u00d7 formula-fed babies. None in this household';
      return `${fmtInt(h.feeds || DEFAULT_FEEDS)} feeds a day (an assumption: change it in the setup) \u00d7 ${d} days \u00d7 ${pl(h.formula || 0, 'formula-fed baby')} = ${fmtInt(basisValue(basis, level, h, rule))} bottles, one for each feed${packs(basisValue(basis, level, h, rule) * f)}`;
    case 'n95': return `${N95_PER_PERSON} for each adult or teenager aged 14 or over (this site's assumption: 2 a day for 3 smoky days) \u00d7 ${fmtInt(adultSized(h))}${packs(basisValue(basis, level, h, rule) * f)}`;
    default: return '';
  }
}

// How many units of a pick the household needs at a level.
export function qtyFor(item, pick, level, h, override) {
  const rule = (override && override.at && override.at[level]) || (override && override.qty) || item.qty || { basis: 'fixed', factor: 1 };
  const base = basisValue(rule.basis, level, h, rule) * (rule.factor == null ? 1 : rule.factor);
  if (base <= 0) return 0;
  const unit = rule.unit != null ? rule.unit : (pick && +pick.unit_size > 0 ? +pick.unit_size : 1);
  return Math.max(1, Math.ceil(base / unit));
}

export function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }

// Household quantity lines for actions that carry a `calc` key.
export function calcLine(calc, level, h) {
  const d = daysFor(level, h), p = people(h);
  const L = level < 2 ? 2 : level;
  switch (calc) {
    case 'water': {
      const g = waterGallons(L, h), fw = formulaWaterQuarts(L, h);
      return `For your household: ${fmtInt(g)} US gallons for ${daysFor(L, h)} days. That is 1 gallon per person per day${h.pets ? ' plus half a gallon per pet (this site\u2019s assumption, sized for a dog; a cat needs much less, so ask your vet)' : ''}, and it weighs about ${fmtInt(g * 8.34)} lb.${fw ? ` Powdered formula adds sealed bottled water for every feed: about ${fmtInt(fw)} quarts for ${daysFor(L, h)} days (1 quart a day for each formula-fed baby: this site\u2019s assumption; mix by the formula\u2019s label).` : ''}`;
    }
    // The extra water for hot weather, not the base stock: up to one more gallon per person per day.
    case 'water_extra': {
      const days = 3, extra = p * days, base = waterGallons(2, h);
      return `For your household: up to ${fmtInt(extra)} more US gallons for a ${days}-day heat wave, on top of your normal ${fmtInt(base)}. That is 1 extra gallon per person per day (${p} ${p === 1 ? 'person' : 'people'} \u00d7 ${days} days), ${fmtInt(base + extra)} gallons in all.`;
    }
    case 'food': { const e = p - band(h, 'u1'); return `For your household: ${e * d} person-days of food for ${d} days, which is about ${e * d * 3} meals (${e} ${e === 1 ? 'person' : 'people'} aged 1 or over \u00d7 ${d} days \u00d7 3 meals).${band(h, 'u1') ? ' A baby under 1 is not counted in meals: count feeds (FN-01) and, once on solids, the jars or pouches the baby eats (U3-08).' : ''}`; }
    case 'toilet_bags': {
      const u = toiletUsers(h), dia = h.diapers ? ` Children in diapers are counted for diapers, not toilet bags.` : '';
      if (level >= 3) return `For your household at ${d} days: one-use toilet bags for the first 3 days only (${fmtInt(u * TOILET_USES_PER_DAY * 3)}: ${u} who use the toilet \u00d7 ${TOILET_USES_PER_DAY} uses a day \u00d7 3 days), then the bucket, with about ${fmtInt(u * Math.max(0, d - 3))} heavy liner bags and absorbent for the remaining ${Math.max(0, d - 3)} days (1 liner per person per day).${dia}`;
      return `For your household: about ${fmtInt(u * TOILET_USES_PER_DAY * 3)} one-use toilet bags for 3 days (${u} who use the toilet \u00d7 ${TOILET_USES_PER_DAY} uses a day \u00d7 3 days, one bag per use).${dia}`;
    }
    // No figure by headcount: spare cells follow the devices you own.
    case 'batteries': return 'For your household: count the cells in every light and radio you own and keep twice that number spare. Example: two headlamps that take three AAA cells each hold six cells, so keep twelve AAA spare; count the radio and any flashlight the same way. A device that recharges needs a way to charge it, not spare cells.';
    case 'cash': return 'For your household: add up three days of food and local transport for everyone, plus one night\u2019s lodging, at your own city\u2019s prices, and write the sum on the bank and bills list. If that is out of reach, start with $200 in $1, $5, $10 and $20 bills and add to it. The rule is this site\u2019s own; official guides give no single figure.';
    case 'power': {
      const phones = adultSized(h), wh = phones * 15 + 25;
      return `For your household, as a starting figure: ${phones} ${phones === 1 ? 'phone' : 'phones'} at about 15 watt-hours for one full charge a day, plus one 5-watt lantern for 5 hours (25 watt-hours), is about ${fmtInt(wh)} watt-hours a day, or ${fmtInt(wh * d)} for ${d} days. A power station delivers about 85% of its printed capacity, so that needs about ${fmtInt(Math.ceil(wh * d / 0.85))} watt-hours printed on the label. These are estimates: measure what your own devices use where you can, add everything else from your power audit, and check the station\u2019s output watts as well as its capacity.`;
    }
    case 'medication_days': return `For your household: aim for ${Math.max(7, d)} days of each regular medicine on hand, if your prescriber and pharmacist agree.`;
    case 'diapers': return h.diapers ? `For your household: about ${fmtInt(h.diapers * DIAPERS_PER_DAY * d)} diapers for ${d} days (${DIAPERS_PER_DAY} a day \u00d7 ${h.diapers} in diapers \u00d7 ${d} days). Eight a day is this site\u2019s assumption; newborns use more.` : '';
    case 'formula': {
      if (!h.formula) return '';
      const n = fmtInt(h.formula * h.feeds * d), sum = `${h.feeds} feeds a day \u00d7 ${d} days \u00d7 ${h.formula} formula-fed ${h.formula === 1 ? 'baby' : 'babies'}`;
      const src = `${h.feeds} feeds a day is ${h.feeds === DEFAULT_FEEDS ? 'this site\u2019s assumption' : 'the figure you gave'}; change it in the household setup.`;
      const rtf = `${n} ready-to-feed bottles for ${d} days, one for each feed (${sum})`;
      const pow = `the baby\u2019s own powder for ${n} feeds (${sum}), with sealed bottled water for every feed, about ${fmtInt(h.formula * d)} quarts (1 quart a day for each baby: this site\u2019s assumption; mix by the formula\u2019s label)`;
      if (h.formulaForm === 'rtf') return `For your household: ${rtf}. ${src}`;
      if (h.formulaForm === 'powder') return `For your household: ${pow}. ${src}`;
      return `For your household, if the baby\u2019s own formula is sold ready-to-feed: ${rtf}. If it is sold only as powder: ${pow}. ${src} Say which in the household setup.`;
    }
    case 'n95': return `For your household: ${fmtInt(adultSized(h) * N95_PER_PERSON)} respirators, ${N95_PER_PERSON} for each adult or teenager aged 14 or over (this site\u2019s assumption: 2 a day for 3 smoky days). None is counted for a younger child.`;
    case 'pet_food': return h.pets ? `For your household: ${d} days of each pet\u2019s normal food, and about ${fmtInt(Math.ceil(h.pets * PET_GAL_PER_DAY * d))} gallons of water for pets (half a gallon per pet per day: this site\u2019s assumption, sized for a dog; a cat needs much less, so ask your vet).` : '';
    default: return '';
  }
}

// Who an action or product is for, in words: the "Applies to" line on the site and in both downloads.
const HAS_WORDS = { child: 'households with a child under 18', baby: 'households with a baby under 1', under5: 'households with a child aged 5 or under',
  school_age: 'households with a child aged 6 to 13', bag_child: 'households with a child aged 3 to 13', age3_5: 'households with a child aged 3 to 5', age6_9: 'households with a child aged 6 to 9', age10_13: 'households with a child aged 10 to 13', teen: 'households with a teenager aged 14 to 17', carried: 'households with a child who cannot walk a mile',
  diapers: 'households with a child in diapers', formula: 'households with a formula-fed baby', formula_rtf: 'households whose baby\u2019s formula is sold ready-to-feed', formula_powder: 'households whose baby\u2019s formula is sold only as powder', pets: 'households with pets', car: 'households with a car',
  no_car: 'households with no car', one_adult: 'households with one adult', children: 'households with children', infants: 'households with infants' };
const HAZ_WORDS = { earthquake: 'earthquakes', tornado: 'tornadoes', hurricane: 'hurricanes or coastal flooding', flood: 'river or flash flooding', smoke: 'wildfire smoke', nuclear: 'a nuclear power plant within 10 miles' };
export function appliesText(only) {
  if (!only) return '';
  const one = o => {
    const p = [];
    if (o.home) p.push('home type: ' + o.home.map(v => HH_FIELDS.home[v] || v).join(' or '));
    if (o.outdoor) p.push('outdoor space: ' + o.outdoor.map(v => HH_FIELDS.outdoor[v] || v).join(' or '));
    if (o.has) p.push(o.has.map(v => HAS_WORDS[v] || v).join(', or '));
    if (o.state) p.push('homes in ' + o.state.map(v => STATES[v] || v).join(' or '));
    if (o.climate) p.push('climate: ' + o.climate.map(v => HH_FIELDS.climate[v] || v).join(' or '));
    if (o.hazard) p.push('homes where there are ' + o.hazard.map(v => HAZ_WORDS[v] || v).join(' or ').replace(/^homes where there are a /, ''));
    return p.join('; ');
  };
  const main = one(only).replace('homes where there are a nuclear', 'homes with a nuclear');
  const alts = (only.or || []).map(one).filter(Boolean);
  return [main, ...alts].filter(Boolean).join('. Also: ');
}
