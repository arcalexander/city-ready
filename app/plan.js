// The plan's logic, with no page code in it, so the site, the two downloads and the check scripts all
// count the same way.
//
// A "unit" is one tick box. Things about people, bags, documents, money and medical are ticked once per
// household (home 0). Things that depend on the building are ticked once per home (home 1, home 2).
import * as H from './household.js';
import { TIERS, D as DATA, SECTION_OF_LEVEL } from './data.js';

export const emptyData = () => ({ household: null, done: {}, done2: {}, owned: {}, owned2: {}, picks: {}, files: {} });
export const doneMap = (data, n) => (n === 2 ? data.done2 : data.done);
export const ownedMap = (data, n) => (n === 2 ? data.owned2 : data.owned);
// A job is done if its own box is ticked, or the box of any action that points at it was ticked before
// the two became one. Old ticks are never lost.
export const doneDate = (data, id, n) => {
  const own = doneMap(data, n)[id]; if (own) return own;
  for (const p of DATA.pointersTo[id] || []) { const d = doneMap(data, n)[p] || (data.done && data.done[p]) || ''; if (d) return d; }
  // An action split off from another on SPLIT_DAY: a tick made on the original before the split covered
  // both halves, so it still counts for the new half. A later tick on the original does not.
  const a = DATA.actionById[id];
  if (a && a.split_from) { const d = doneMap(data, n)[a.split_from] || (data.done && data.done[a.split_from]) || ''; if (d && d <= SPLIT_DAY) return d; }
  return '';
};
export const SPLIT_DAY = '2026-11-16';
export const ownedLevel = (data, id, n) => { const o = ownedMap(data, n)[id]; return (o && o.level) || 0; };
export const unitLabel = (h, n) => (n === 0 ? '' : H.homeLabel(h, n));

/* ---------- actions and checklist items ---------- */
export function checkVisible(D, c, h) {
  if (!H.matchesAnyHome(c.only, h)) return false;
  const st = H.chosenStates(h);
  if (c.states && c.states.length) return c.states.some(s => st.includes(s));
  if (c.varies_by_state) { const r = D.replacers[c.id] || {}; return st.length === 0 || st.some(s => !r[s]); }
  return true;
}
// For a general item that differs by state: the chosen states that have no item of their own.
export function statesToCheck(D, c, h) {
  if (!c.varies_by_state) return [];
  const r = D.replacers[c.id] || {};
  return H.chosenStates(h).filter(s => !r[s]);
}
export function actionUnits(D, a, h) {
  if (a.kind === 'check') return checkVisible(D, a, h) ? [0] : [];
  if (a.scope === 'home') return H.homeList(h).filter(n => H.matches(a.only, H.hhFor(h, n)));
  return H.matchesAnyHome(a.only, h) ? [0] : [];
}
export const actionVisible = (D, a, h) => actionUnits(D, a, h).length > 0;
export const unitsDone = (data, a, units) => units.filter(n => doneDate(data, a.id, n)).length;
// A pointer is an action whose job another action does (`same_as`). It shows as one quiet line, has no
// tick box and is left out of every count. If its target does not apply to this household, it is an
// ordinary action again.
export function pointerTarget(D, a, h) {
  if (!a.same_as) return null;
  const t = D.actionById[a.same_as];
  return t && !t.same_as && (!h || actionUnits(D, t, h).length) ? t : null;
}
// The IDs that point at an action, split into Oregon toolkit lines and the site's own.
export function pointersOf(D, a) {
  const ids = D.pointersTo[a.id] || [];
  return { toolkit: ids.filter(id => /^U\d-/.test(id)), own: ids.filter(id => !/^U\d-/.test(id)) };
}
export const levelOf = (a, h) => H.levelFor(a, h);

/* ---------- sections ---------- */
// Every action and product belongs to exactly one section. Household and Car members say so (`part`);
// everything else goes by its old level number. A pointer sits where its target sits, so a household job
// never shows again, even as a pointer line, in a later section.
export function partOf(D, a, h) {
  if (!a || a.kind === 'check') return null;
  const t = pointerTarget(D, a, h) || a;
  if (t.part) return t.part;
  if (inAccess(D, t)) return ACCESS_SECTION;          // the block for disability and medical devices is printed once
  if (t.more) return 'w2';                            // "More from Oregon's toolkit" sits at the end of Two weeks at home
  return SECTION_OF_LEVEL[h ? H.levelFor(t, h) : t.level];
}
// The actions for a disability, a mobility limit or a powered medical device. The setup never asks, so the
// block is shown to everyone, once, closed; its boxes are counted only once it is opened or one is ticked.
export const ACCESS_SECTION = 'h72';
export const inAccess = (D, a) => !!(D.access && (D.access.ids || []).includes(a.id));
export const accessCounted = (D, h, data, open) => !!open || (D.access ? D.access.ids : []).some(id => { const a = D.actionById[id]; return a && !a.same_as && actionUnits(D, a, h).some(n => doneDate(data, id, n)); });
// "More from Oregon's toolkit": lines that are not preparedness for a city household. A title and one
// line each, no tick box, not counted in the boxes, hours or cost. Nothing is deleted.
export const moreList = (D, h) => D.actions.filter(a => a.more && (!h || actionUnits(D, a, h).length));
export const itemPart = it => it.part || SECTION_OF_LEVEL[it.level];
export const sectionVisible = (sec, h) => !sec.only || H.matchesAnyHome(sec.only, h);
export const sectionsFor = (D, h) => D.sections.filter(s => sectionVisible(s, h));
export const sectionOfAction = (D, a, h) => D.sectionByKey[partOf(D, a, h)] || null;
export const sectionOfItem = (D, it) => D.sectionByKey[itemPart(it)] || null;
// The number of days a quantity in this section is worked out for: the section's own level, or, in
// Household and Car, the product's.
export const depthFor = (sec, it) => (sec.level == null ? it.level : sec.level);

/* ---------- products ---------- */
// Which pick to price and size an item by: "My pick" if it names a tier, else the chosen tier, else any tier.
export function pickFor(item, tier, data) {
  const mine = data && data.picks && data.picks[item.id];
  if (mine && mine.tier && item.tiers[mine.tier]) return { pick: item.tiers[mine.tier], tier: mine.tier, mine: true };
  if (item.tiers[tier]) return { pick: item.tiers[tier], tier };
  for (const t of ['standard', 'budget', 'cadillac']) if (item.tiers[t]) return { pick: item.tiers[t], tier: t };
  return { pick: null, tier };
}
export const myPickText = (item, data) => {
  const m = data && data.picks && data.picks[item.id]; if (!m) return '';
  if (m.tier && item.tiers[m.tier]) return `${item.tiers[m.tier].brand} ${item.tiers[m.tier].model}`;
  return m.text || '';
};
export function need(item, level, hh, tier, data) {
  if (level < item.level || !H.matches(item.only, hh)) return 0;
  return H.qtyFor(item, pickFor(item, tier, data).pick, level, hh, item.override);
}
// The homes an item is bought for: each home for building items, once for everything else.
export function itemHomes(item, h) {
  if (item.scope === 'home') return H.homeList(h).filter(n => H.matches(item.only, H.hhFor(h, n)));
  const n = H.homeList(h).find(x => H.matches(item.only, H.hhFor(h, x)));
  return n ? [0] : [];
}
export const hhOfUnit = (item, h, n) => (n === 0 ? H.hhFor(h, H.homeList(h).find(x => H.matches(item.only, H.hhFor(h, x))) || 1) : H.hhFor(h, n));
// What a section asks you to buy. Household and Car list their own products. Bag, 72 hours and Two weeks
// are a chain: a product is new in its own section, and a later one may ask for more of it.
export function sectionItems(D, sec, h, tier, data) {
  const fresh = [], more = [], covered = [], optional = [];
  if (!sec || sec.calendar || sec.level === 0 || !sectionVisible(sec, h)) return { fresh, more, covered, optional };
  const L = sec.level;
  for (const it of D.items) {
    const part = itemPart(it), chain = !it.part;
    if (L == null ? part !== sec.key : !chain) continue;
    for (const n of itemHomes(it, h)) {
      const hh = hhOfUnit(it, h, n), d = depthFor(sec, it), qty = need(it, d, hh, tier, data); if (!qty) continue;
      const prev = L != null && it.level <= L - 1 ? need(it, L - 1, hh, tier, data) : 0;
      const e = { it, n, qty, prev, L: d };
      if (it.optional) { if (L == null || it.level === L) optional.push(e); continue; }
      if (L == null || it.level === L) fresh.push(e);
      else if (it.level < L) (qty > prev ? more : covered).push(e);
    }
  }
  return { fresh, more, covered, optional };
}
// The medicine cabinet: lines for the age bands in this household, each with a package count.
export function cabinetLines(D, h) {
  if (!D.cabinet) return [];
  const count = k => (k === 'adult' ? h.adults : ((h.ages || {})[k] || 0));
  const out = [];
  for (const g of D.cabinet.groups) for (const line of g.lines || []) {
    const bands = line.for && line.for.length ? line.for : ['adult'];
    const people = bands.reduce((s, k) => s + count(k), 0); if (!people) continue;
    if (line.only_diapers && !(h.diapers > 0)) continue;
    const q = line.qty || {}, qty = Math.max(1, Math.ceil((q.n || 1) * (q.per === 'person' ? people : 1)));
    out.push({ line, group: g, qty, people });
  }
  return out;
}
export const cabinetHas = (data, id) => !!(data.owned && data.owned[id]);
export function sectionProgress(D, key, h, data, tier, opts = {}) {
  const sec = D.sectionByKey[key] || { key, order: [] };
  const show = sectionVisible(sec, h);
  const all = show && !sec.calendar ? D.actions.filter(a => partOf(D, a, h) === key).map(a => ({ a, units: actionUnits(D, a, h) })).filter(x => x.units.length) : [];
  const counted = key !== ACCESS_SECTION || accessCounted(D, h, data, opts.accessOpen);
  const own = all.filter(x => !x.a.more && !pointerTarget(D, x.a, h));
  const acts = own.filter(x => counted || !inAccess(D, x.a));
  const accessActs = own.filter(x => inAccess(D, x.a));                    // listed in the block whether counted or not
  const pointers = all.filter(x => !x.a.more && pointerTarget(D, x.a, h)).map(x => ({ ...x, target: pointerTarget(D, x.a, h) }));
  const { fresh, more, covered, optional } = sectionItems(D, sec, h, tier, data);
  const items = [...fresh, ...more];
  const cabinet = key === 'household' ? cabinetLines(D, h) : [];
  const total = acts.reduce((s, x) => s + x.units.length, 0) + items.length + cabinet.length;
  const done = acts.reduce((s, x) => s + unitsDone(data, x.a, x.units), 0) + items.filter(e => ownedLevel(data, e.it.id, e.n) >= e.L).length + cabinet.filter(c => cabinetHas(data, c.line.id)).length;
  return { sec, acts, accessActs, accessCounted: counted, toolkitMore: key === 'w2' && show ? moreList(D, h) : [], pointers, items, fresh, more, covered, optional, cabinet, done, total, pct: total ? Math.round(100 * done / total) : 0 };
}
// A section's rows in reading order. First any "lead" groups named in sections.json (Household and Car are
// made only of these), then the modules in the section's order, then the block for disability and medical
// devices. A row is { a, units } and, for a pointer, { target }. `rows` may be passed in when the caller
// builds its own list (the unfiltered plan).
//
// Each group carries `subs`: its sub-groups, each printed once, in the order the module's own file lists
// them, holding only actions with a box; and `pointers`: the module's "same job as" lines, gathered at
// its end. A section may be split into named parts (the Bag: the bag itself, where you would go, papers
// and phones); then a module may have a group in more than one part.
export function sectionGroups(D, key, h, prog, rows) {
  const lv = D.sectionByKey[key] || {};
  const list = (rows || [...new Set([...prog.acts, ...(prog.accessActs || []), ...prog.pointers])]).slice().sort((x, y) => x.a.idx - y.a.idx);
  const byId = new Map(list.map(x => [x.a.id, x]));
  const finish = g => {
    const subs = [], seen = new Map();
    for (const x of g.rows) { if (x.target) continue; const k = g.lead ? '' : (x.a.section || ''); if (!seen.has(k)) { seen.set(k, { name: k, rows: [] }); subs.push(seen.get(k)); } seen.get(k).rows.push(x); }
    if (!g.lead) { const order = subOrder(D, g.module); subs.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)); }
    return { ...g, subs, pointers: g.rows.filter(x => x.target) };
  };
  const lead = (lv.lead || []).map((g, i) => ({ code: 'lead' + i, name: g.name, intro: g.intro || '', lead: true, items: g.items || [], cabinet: !!g.cabinet, bag: g.bag || '', rows: (g.ids || []).map(id => byId.get(id)).filter(Boolean) })).filter(g => g.rows.length || g.cabinet);
  const taken = new Set(lead.flatMap(g => g.rows.map(x => x.a.id)));
  // A pointer whose target is named in a lead group is listed with that group.
  for (const g of lead) for (const x of list) if (x.target && !taken.has(x.a.id) && g.rows.some(r => r.a.id === x.target.id)) { g.rows.push(x); taken.add(x.a.id); }
  const acc = key === ACCESS_SECTION && D.access && (D.access.ids || []).length ? { code: 'access', name: D.access.name, intro: D.access.intro || '', icon: D.access.icon, lead: true, access: true, counted: prog ? prog.accessCounted !== false : true,
    rows: list.filter(x => !taken.has(x.a.id) && (inAccess(D, x.a) || (x.target && inAccess(D, x.target)))) } : null;
  if (acc) for (const x of acc.rows) taken.add(x.a.id);
  // Which products a group lists: a lead group names its own; a module group takes the rest of its module.
  const named = new Set(lead.flatMap(g => g.items));
  const groups = lead.map(g => ({ ...g, icon: ((lv.lead || []).find(x => x.name === g.name) || {}).icon, has: it => g.items.includes(it.id) }));
  const parts = lv.parts && lv.parts.length ? lv.parts : [null];
  const rest = parts.find(p => p && p.rest) || parts[parts.length - 1];
  const partOfRow = x => { if (!parts[0]) return null; const byIds = parts.find(p => (p.ids || []).includes(x.a.id)); if (byIds) return byIds; return parts.find(p => (p.modules || []).includes(x.a.module)) || rest; };
  const itemOwner = code => (parts[0] ? (parts.find(p => (p.modules || []).includes(code) || (p.item_modules || []).includes(code)) || rest) : null);
  // A "same job as" line is listed with the action that does the job, so a module's list of them sits
  // under the boxes they repeat.
  const home = x => (x.target ? { a: x.target } : x);
  parts.forEach((p, pi) => {
    for (const code of moduleOrder(D, key)) {
      const m = D.modules.find(x => x.code === code) || { name: code, intro: '' };
      const own = itemOwner(code) === p;
      groups.push({ code: p ? `${code}-${pi}` : code, module: code, part: p ? p.name : '', partIntro: p ? p.intro || '' : '', name: m.name, intro: m.intro || '', lead: false,
        rows: list.filter(x => !taken.has(x.a.id) && home(x).a.module === code && partOfRow(home(x)) === p), has: it => own && it.moduleCode === code && !named.has(it.id) });
    }
  });
  if (acc && acc.rows.length) groups.push({ ...acc, has: () => false });
  return groups.map(finish);
}
// The order of a module's sub-groups: as its file first names them, over every action it holds.
const SUB_ORDER = new Map();
export function subOrder(D, code) {
  if (!SUB_ORDER.has(code)) SUB_ORDER.set(code, [...new Set(D.actions.filter(a => a.module === code).map(a => a.section || ''))]);
  return SUB_ORDER.get(code);
}
// Time and cost for a level, pointers and optional actions left out. Time is the sum of each action's
// own estimate; cost is a range, because each action carries a band and not a price.
const COST_BAND = { free: [0, 0], low: [1, 25], mid: [25, 100], high: [100, null] };
export function levelTotals(acts) {
  let minutes = 0, lo = 0, hi = 0, open = 0;
  for (const { a, units } of acts) {
    if (a.optional) continue;
    minutes += (+a.minutes || 0) * 1;
    const b = COST_BAND[a.cost] || COST_BAND.free;
    lo += b[0] * units.length; if (b[1] == null) open += units.length; else hi += b[1] * units.length;
  }
  return { minutes, lo, hi, open };
}
export function moduleOrder(D, key) {
  const lv = D.sectionByKey[key] || {};
  return [...(lv.order || []), ...D.modules.map(m => m.code)].filter((c, i, arr) => arr.indexOf(c) === i);
}

/* ---------- Legal, Money, Medical ---------- */
// Rows of one section, in order. A row is either an existing action (shown here as one line; it keeps its
// place in the levels and has one tick) or a checklist item that lives only in the section.
export function planRows(D, sec, h) {
  const out = [];
  for (const g of sec.groups) {
    const rows = [];
    for (const r of sec.items.filter(x => x.group === g)) {
      const a = r.ref ? D.actionById[r.ref] : r;
      if (!a) continue;
      const units = actionUnits(D, a, h); if (!units.length) continue;
      rows.push({ a, units, done: r.done || a.done || '', isRef: !!r.ref, check: statesToCheck(D, a, h) });
    }
    if (rows.length) out.push({ group: g, rows });
  }
  return out;
}
export function planProgress(D, sec, h, data) {
  const groups = planRows(D, sec, h); let total = 0, done = 0;
  for (const g of groups) for (const r of g.rows) { total += r.units.length; done += unitsDone(data, r.a, r.units); }
  return { groups, total, done, pct: total ? Math.round(100 * done / total) : 0 };
}

/* ---------- other testers' lines, in the fixed order ---------- */
// Wirecutter, then Consumer Reports (link only), then the other testers by name.
export function opinionLines(D, item) {
  const rank = o => (/^wirecutter$/i.test(o.outlet) ? 0 : /^consumer reports$/i.test(o.outlet) ? 1 : 2);
  return (D.opinions[item.id] || []).filter(o => o && o.outlet && (o.product || o.link_only) && /^https:\/\//.test(o.url || ''))
    .slice().sort((a, b) => rank(a) - rank(b) || a.outlet.toLowerCase().localeCompare(b.outlet.toLowerCase()));
}
export const TIER_ORDER = TIERS;

/* ---------- bag lists ---------- */
export function bagTable(D, b, tier, data, h) {
  let oz = 0, unknown = 0;
  const pretty = id => { const t = String(id || '').replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  const zones = b.zones.map(z => ({ name: z.name, why: z.why || '', rows: z.items.filter(x => !h || !x.only || H.matchesAnyHome(x.only, h)).map(x => {
    const it = x.item && D.itemById[x.item];
    const pk = it ? ((x.tier && it.tiers[x.tier]) || pickFor(it, tier, data).pick) : null;
    const w = x.use_est && x.est_oz != null ? +x.est_oz : (pk && pk.weight_oz != null ? +pk.weight_oz : (x.est_oz != null ? +x.est_oz : null));
    const qty = x.qty || 1;
    if (w == null) unknown++; else oz += w * qty;
    return { it, label: it ? (x.label || it.name) : (x.text || x.label || pretty(x.item)), pick: pk ? `${pk.brand} ${pk.model}` : '', note: x.note || '', qty,
      oz: w == null ? null : Math.round(w * qty * 10) / 10, est: x.est_oz != null && (x.use_est || !(pk && pk.weight_oz != null)) };
  }) }));
  return { zones, oz, lb: (oz / 16).toFixed(1), unknown };
}

// The grab bag (`main`) and its add-ons. The car kit is a list of its own, shown in the Car section.
export function bagLayers(D, h, tier, data, all) {
  return bagsFor(D, h, all).filter(b => b.id !== 'car').map(b => ({ b, t: bagTable(D, b, tier, data, all ? null : h) }));
}
export function carKit(D, h, tier, data, all) {
  const b = D.bags.find(x => x.id === 'car'); if (!b || !(all || H.matchesAnyHome(b.only, h))) return null;
  return { b, t: bagTable(D, b, tier, data, all ? null : h) };
}
export const bagsFor = (D, h, all) => D.bags.filter(b => all || (H.matchesAnyHome(b.only, h) && (!b.band || (h.ages && h.ages[b.band] > 0))));


/* ---------- the side door: "Holy shit, the sky is falling" ---------- */
// One evening and one store run. It is not a section and is counted nowhere: each line points at the
// actions that own its job, and its tick box is theirs. `hhSet` false means a cold visitor, who sees every
// line with its condition in words; with a setup, a line that does not apply is hidden.
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function skyPage(D, h, hhSet, data) {
  const sky = D.sky; if (!sky) return null;
  const live = id => { const a = D.actionById[id]; return a && !a.same_as && !a.more ? a : null; };
  const shown = list => (list || []).map(live).filter(a => a && (!hhSet || actionVisible(D, a, h)));
  const row = l => {
    const owners = (l.ids || []).map(live).filter(Boolean), acts = shown(l.ids), also = shown(l.also);
    const applies = !hhSet || ((!l.only || H.matchesAnyHome(l.only, h)) && (!owners.length || acts.length > 0));
    // The boxes a tick here stands for: every unit of every owning action that applies to this household.
    const units = acts.map(a => ({ a, units: actionUnits(D, a, h) })).filter(u => u.units.length);
    const total = units.reduce((n, u) => n + u.units.length, 0);
    const done = data ? units.reduce((n, u) => n + unitsDone(data, u.a, u.units), 0) : 0;
    let text = hhSet ? (l.set || l.text) : (l.cold || l.text);
    if (hhSet && l.set && l.water) {
      const people = H.people(h), packs = Math.max(1, Math.ceil(people * l.water.gallons_per_person / l.water.pack_gallons - 1e-9));
      const words = `${COUNT_WORDS[packs] || packs} ${l.water.pack}${packs === 1 ? '' : 's'}`;
      text = l.set.replace('{packs}', words).replace('{people}', String(people));
    }
    // A store line links one pick for each product: the Standard pick, or the only one there is.
    const buys = (l.buy || []).map(id => D.itemById[id]).filter(Boolean).map(it => {
      const pick = it.tiers && (it.tiers.standard || it.tiers.budget || it.tiers.cadillac);
      return pick ? { it, pick } : null;
    }).filter(Boolean);
    return { l, text, acts, also, applies, units, box: total > 0, done: total > 0 && done === total, buys };
  };
  const parts = sky.parts.map(p => ({ ...p, rows: p.lines.map(row).filter(r => r.applies) }));
  const dont = (sky.dont ? sky.dont.lines : []).map(l => {
    const from = l.from ? live(l.from) : null, also = l.also_from ? live(l.also_from) : null;
    return { l, from, also, cites: l.cites || (from ? from.cites || [] : []) };
  });
  return { sky, parts, rows: parts.flatMap(p => p.rows), dont };
}
// Tick or untick a line: it sets or clears the box of every action the line stands for. Nothing is stored
// for the line itself.
export function skyTick(D, h, hhSet, data, lineId, on, date) {
  const pg = skyPage(D, h, hhSet, data), r = pg && pg.rows.find(x => x.l.id === lineId);
  if (!r || !r.box) return false;
  for (const u of r.units) for (const n of u.units) {
    const map = doneMap(data, n);
    if (on) { if (!doneDate(data, u.a.id, n)) map[u.a.id] = date; } else delete map[u.a.id];
  }
  return true;
}
