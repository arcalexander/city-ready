// The two downloads. Both are plain Markdown, written so a person, or an assistant with no access to
// the site, can read them on their own.
//   planMarkdown   – "Download the whole plan": the plan as written. Nobody's ticks, picks or purchases.
//   exportMarkdown – "Export": one signed-in person's ticks, dates, picks and purchases.
import { TIERS, PRICE_TIERS, TIER_NAME, medName, medBrand } from './data.js';
import * as H from './household.js';
import * as P from './plan.js';

const COST = { free: 'Free', low: 'Under $25', mid: '$25 to $100', high: 'Over $100' };
const TIME = { minutes: '15 minutes or less', hour: 'Up to an hour', afternoon: 'A few hours', ongoing: 'Ongoing' };
const EFFORT = { easy: 'Easy', some: 'Some effort', most: 'Most effort' };
const one = s => String(s == null ? '' : s).replace(/\s*\n\s*/g, ' ').trim();
const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const monthYear = ym => { const d = new Date(ym + '-15T12:00:00'); return isNaN(d) ? ym : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const poss = n => n + (/s$/i.test(n) ? '\u2019' : '\u2019s');
const yn = b => (b ? 'yes' : 'no');
const longDate = iso => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? String(iso) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
// Where a line names another action by its ID, the title is printed beside it. A folded ID is shown as
// the action that now does its job.
const ID_RE = /\b((?:U[1-8]|X[1-8]|PL|HC|AR|BG|HR|NB|MD|CM|FN|LG|MN|ME)-\d{2,3})\b(?!, \u201c)/g;
export function withTitles(D, t, selfId) {
  return String(t == null ? '' : t).replace(ID_RE, (m, id) => {
    let a = D.actionById[id] || D.checkById[id]; if (!a) return m;
    if (a.same_as && D.actionById[a.same_as]) a = D.actionById[a.same_as];
    if (a.id === selfId) return m;
    return `${a.id}, \u201c${a.title}\u201d`;
  });
}
const secNameOf = (D, a, h) => { const s = P.sectionOfAction(D, a, h); return s ? s.name : ''; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const bandWords = k => (k === 'adult' ? 'adults' : k === 'u1' ? 'under 1' : H.BANDS[k]);
const modName = (D, c) => (D.modules.find(m => m.code === c) || { name: c }).name;
export const fileDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function setupLines(h, hhSet) {
  if (!hhSet) return ['- No household setup has been filled in.'];
  const home = n => { const x = H.hhFor(h, n); return `${H.HH_FIELDS.home[x.home]}, floor ${x.floor}, outdoor space: ${H.HH_FIELDS.outdoor[x.outdoor].toLowerCase()}, climate: ${H.HH_FIELDS.climate[x.climate].toLowerCase()}, state: ${x.state ? H.STATES[x.state] : 'not chosen'}, hazards: ${x.hazards == null ? 'not answered' : (x.hazards.length ? x.hazards.map(k => H.HAZARDS[k].toLowerCase()).join(', ') : 'none of the six')}`; };
  const kids = H.BAND_KEYS.filter(k => h.ages[k]).map(k => `${h.ages[k]} aged ${k === 'u1' ? 'under 1' : H.BANDS[k]}`).join(', ');
  const out = [`- Adults: ${h.adults}`, `- Children by age band: ${kids || 'none'}${h.askAges ? ' (ages not yet given; counted as 6 to 9)' : ''}`,
    `- Children in diapers: ${h.diapers}`, `- Babies fed formula: ${h.formula}${h.formula ? ` (${h.feeds} feeds a day each)` : ''}`, `- Children who cannot walk a mile: ${h.carried}`,
    `- Pets: ${h.pets}`, `- Car: ${yn(h.car)}`,
    `- Days to be ready for at home: ${h.targetDays}`, `- Second home: ${yn(h.second)}`, `- First home: ${home(1)}`];
  if (h.second) out.push(`- Second home: ${home(2)}`);
  return out;
}
const applies = only => H.appliesText(only);
const cites = (D, ids) => (ids || []).map(id => D.sources[id]).filter(Boolean).map(s => `${s.publisher}: ${s.title || s.url} (${s.url})`);
const unitTag = (h, n) => (n === 0 ? '' : ` \u2014 ${H.homeLabel(h, n)}`);

/* ---------- pieces shared by both files ---------- */
function actionDetail(D, a, h, full) {
  const out = [];
  const wt = s => one(withTitles(D, s, a.id));
  out.push(`  - Why: ${wt(a.why)}`);
  out.push(`  - How: ${wt(a.how)}`);
  if (a.done) out.push(`  - Done when: ${wt(a.done)}`);
  if (a.list === 'first-aid-kit') out.push('  - The list:', '', ...kitLines(D, '    '));
  const tags = [a.cost && COST[a.cost], a.time && (a.time === 'minutes' && +a.minutes > 0 ? `${+a.minutes} minute${+a.minutes === 1 ? '' : 's'}` : TIME[a.time]), a.effort && EFFORT[a.effort], a.optional && 'Optional'].filter(Boolean);
  if (tags.length) out.push(`  - Cost, time, effort: ${tags.join(' · ')}`);
  if (a.calc) { const c = H.calcLine(a.calc, full ? a.level : H.levelFor(a, h), h); if (c) out.push(`  - ${c}`); }
  if (a.apartment) out.push(`  - In an apartment: ${wt(a.apartment)}`);
  if (a.region) out.push(`  - ${a.region.label}-specific. Elsewhere: ${one(a.region.general)}`);
  if (full && a.only) out.push(`  - Applies to: ${applies(a.only)}`);
  if ((a.products || []).length) out.push(`  - What to buy: ${a.products.map(id => D.itemById[id] ? `${D.itemById[id].name} (${id}${D.itemById[id].alternative ? ', alternative' : D.itemById[id].optional ? ', optional extra' : ''})` : id).join('; ')}`);
  const ws = a.worksheet && D.worksheets.find(w => w.id === a.worksheet);
  if (ws) out.push(`  - Worksheet: ${ws.title}`);
  const c = cites(D, a.cites);
  if (c.length) out.push(`  - Official sources: ${c.join('; ')}`);
  const also = P.pointersOf(D, a);
  if (also.toolkit.length) out.push(`  - Also in Oregon\u2019s toolkit: ${also.toolkit.join(', ')}`);
  if (also.own.length) out.push(`  - Also listed as: ${also.own.join(', ')}`);
  return out;
}
// The rule behind a quantity, in words. Where two weeks uses a different rule, both are given.
function ruleLine(it, pick, hh) {
  const a = H.ruleText(it, pick, it.level, hh, it.override), b = it.part ? a : H.ruleText(it, pick, 3, hh, it.override);
  return `Rule: ${a}${b && b !== a ? `. At two weeks: ${b}` : ''}.`;
}
// The note at the very top of the plan, above First steps, with its sources.
const TWO_STATES = 'If your homes are in two states, both states\u2019 items are shown. Each state has its own forms and rules. Which state\u2019s form a person signs depends on where that person lives, not on where the homes are; each state\u2019s own page, linked on the item, says who it is for.';
function topNoteLines(D, sec) {
  const n = (sec || {}).note_top; if (!n || !(n.sentences || []).length) return [];
  const ids = [...new Set(n.sentences.flatMap(x => x.cites || []))];
  return [`> **${one(n.by)}** ${n.sentences.map(x => one(x.text)).join(' ')}`, '', `Sources for the note: ${cites(D, ids).join('; ')}`, ''];
}
// One medicine cabinet line: what it is, the label's age limit, the dose rule and the package count.
function cabinetLine(D, c, boxText) {
  const l = c.line, q = l.qty || {}, brand = medBrand(l);
  const out = [`${boxText}**${l.id}** ${one(medName(l))}${l.purpose ? `, ${one(l.purpose)}` : ''}${brand ? ` (${one(brand)})` : ''}: ${c.qty} × ${q.unit || 'pack'}`];
  if (l.pack) out.push(`  - Buy: ${one(l.pack)}.`);
  if (l.alternatives) out.push(`  - ${one(l.alternatives)}`);
  out.push(`  - For: ${(l.for || ['adult']).map(bandWords).join(', ')}.${l.label_age ? ' ' + one(l.label_age) : ''}`);
  if (l.dose) out.push(`  - ${one(l.dose)}`);
  if (l.note) out.push(`  - ${one(withTitles(D, l.note))}`);
  if (q.rule) out.push(`  - How many: ${one(q.rule)}`);
  const c2 = cites(D, l.cites); if (c2.length) out.push(`  - Official sources: ${c2.join('; ')}`);
  return out;
}
// The home first-aid kit as a build list: lines to check against the box, with no tick boxes of their own.
function kitLines(D, indent = '') {
  const k = D.kit; if (!k) return [];
  const cab = id => (D.cabinet ? D.cabinet.groups.flatMap(g => g.lines).find(x => x.id === id) : null);
  const name = l => { const c = l.cabinet && cab(l.cabinet); return c && l.size === 'as the cabinet line' ? medName(c) : l.item; };
  const label = l => `${name(l)}${l.size && l.size !== 'as the cabinet line' ? ' (' + l.size + ')' : ''}`;
  const all = k.groups.flatMap(g => g.lines), byId = Object.fromEntries(all.map(l => [l.id, l])), hs = k.head_start;
  const out = [`${indent}${one(k.intro)} The box: ${one(k.box)}`, ''];
  for (const g of k.groups) {
    out.push(`${indent}**${g.name}**${g.intro ? ' ' + one(g.intro) : ''}`, '');
    for (const l of g.lines) {
      const c = l.cabinet && cab(l.cabinet);
      out.push(`${indent}* ${l.count} ${l.unit || ''}: ${one(name(l))}${l.size && l.size !== 'as the cabinet line' ? ', ' + one(l.size) : ''}${c ? ` (cabinet line ${c.id}${c.brand_example ? ': ' + one(c.brand_example) : ''})` : ''}${l.from === 'site' ? ' [this site’s line]' : ''}${l.count_from || l.note ? '.' : ''}${l.count_from ? ` ${one(l.count_from)}` : ''}${l.note ? ` ${one(withTitles(D, l.note))}` : ''}`);
    }
    out.push('');
  }
  out.push(`${indent}Lines marked "this site’s line" are this site’s own additions. The rest come from Oregon’s list of 23 items and the American Red Cross list for a family of four; where the two differ, the larger count is used.`, '');
  if (k.after_class) out.push(`${indent}${one(withTitles(D, k.after_class))}`, '');
  if (hs) {
    const full = new Set(hs.covers || []), part = new Set((hs.partly || []).map(p => p.id));
    out.push(`${indent}**A head start, if you want one.** ${one(hs.intro)} ${hs.name}${hs.price_usd != null ? `, ${money(hs.price_usd)}, seen ${longDate(hs.seen)}` : ''}: ${hs.url}`, '',
      `${indent}* It covers: ${(hs.covers || []).map(id => byId[id]).filter(Boolean).map(label).join('; ')}.`,
      ...((hs.partly || []).length ? [`${indent}* It covers part of these, so you still top them up: ${hs.partly.map(p => one(p.text)).join('; ')}.`] : []),
      `${indent}* You still add: ${all.filter(l => !full.has(l.id) && !part.has(l.id)).map(label).join('; ')}.`, '');
  }
  return out;
}
function cabinetHead(D, hh, full) {
  const cab = D.cabinet; if (!cab) return [];
  const here = k => full || (k === 'adult' ? hh.adults : (hh.ages[k] || 0)) > 0;
  const out = ['#### The family medicine cabinet', '', one(cab.intro || ''), '', ...(cab.store_brand ? [one(cab.store_brand.text), ''] : []), '**No doses are given here.** Doses go by weight, from the label or the child\u2019s doctor. Nothing in this list has been read by a pharmacist or a pediatrician.', ''];
  for (const r of cab.rules || []) out.push(`**${one(r.title)}.** ${one(r.text)}`, '');
  const hz = (cab.hazards || []).filter(z => !z.applies || !z.applies.length || z.applies.some(here));
  if (hz.length) out.push('Read these before you give anything:', '', ...hz.map(z => `* **${one(z.title)}.** ${one(z.text)}`), '');
  return out;
}
// Keep it up: the calendar. No boxes; each line names the action that owns the job.
function keepLines(D, hh, full) {
  const k = D.keep; if (!k) return [];
  const act = e => D.actionById[e.action] || D.checkById[e.action];
  const ok = e => { if (e.page) return e.page === 'library' && !!D.library; const a = act(e); return a && (full || P.actionVisible(D, a, hh)); };
  const line = e => `* ${one(e.text)} (${e.page ? 'The Library' : `${act(e).id}, ${one(act(e).title)}`})${e.every ? ` [${one(e.every)}]` : ''}`;
  const list = k.entries.filter(ok), out = [];
  const block = (title, rows) => { if (rows.length) out.push(`### ${title}`, '', ...rows.map(line), ''); };
  block('Every month', list.filter(e => e.when === 'monthly'));
  MONTHS.forEach((m, i) => block(m, list.filter(e => Array.isArray(e.months) && e.months.includes(i + 1))));
  block('On its own date', list.filter(e => e.when === 'dated'));
  return out;
}
// Things and cost for a section; no total of hours (D-114). This file holds no ticks, so every thing is left.
function totalsLine(acts) {
  const t = P.levelTotals(acts), n = acts.filter(x => !x.a.optional).length;
  return `**Things and cost for this section.** ${n} thing${n === 1 ? '' : 's'} to do \u00b7 ${!t.hi && !t.open ? 'free' : `about ${money(t.lo)} to ${money(t.hi + t.open * 100)}${t.open ? ' or more' : ''}, depending on what you already own`}. Repeats of the same job are counted once.`;
}
// A blank worksheet as plain text a person can print and fill in by hand.
function worksheetLines(w) {
  const out = [`### ${w.title}`, '', one(w.intro), ''];
  const blank = '______________________________';
  for (const b of w.blocks || []) {
    if (b.heading) out.push(`**${one(b.heading)}**`, '');
    if (b.note) out.push(one(b.note), '');
    if (b.type === 'fields') out.push(...b.fields.map(f => `* ${one(f)}: ${blank}`), '');
    if (b.type === 'table') out.push(`| ${b.columns.map(one).join(' | ')} |`, `| ${b.columns.map(() => '---').join(' | ')} |`, ...Array.from({ length: b.rows || 6 }, () => `| ${b.columns.map(() => ' ').join(' | ')} |`), '');
    if (b.type === 'cards') out.push(`${b.title ? `${one(b.title)} (make ${b.copies || 2} copies)` : ''}`, '', ...b.fields.map(f => `* ${one(f)}: ${blank}`), '');
    if (b.type === 'checklist') out.push(...b.items.map(i => `* \u2610 ${one(i)}`), '');
    if (b.type === 'text') out.push(...(b.lines || []).map(l => `* ${one(l)}`), '');
  }
  return out;
}
// The picks of a product: only the tiers that hold one. An empty tier prints nothing; the item's
// `tier_note` says, once, why there are fewer than three.
function pickLines(D, it) {
  const out = [], filled = TIERS.filter(t => it.tiers[t]);
  for (const t of filled) {
    const p = it.tiers[t];
    const src = (p.sources || []).filter(s => s.verified !== false && /^https?:/.test(s.url || ''));
    out.push(`  - ${filled.length > 1 ? TIER_NAME[t] : 'Pick'}: ${p.brand} ${p.model}${p.model_number ? ` (model ${p.model_number})` : ''}${p.price_usd != null ? `, ${money(p.price_usd)}${p.unit_price ? ` (${one(p.unit_price)})` : ''}` : ''}.${src.length < 2 ? ' This pick rests on one source.' : ''}`);
    if (p.size) out.push(`    - Size: ${one(p.size)}`);
    out.push(`    - Why this one: ${one(p.why)}`);
    out.push(`    - Main weakness: ${one(p.weakness)}`);
    for (const f of (p.flags || []).filter(Boolean)) out.push(`    - Warning: ${one(f)}`);
    const links = (p.links || []).filter(l => /^https?:/.test(l.url || ''));
    if (links.length) out.push(`    - Where to buy: ${links.map(l => `${l.label} ${l.url}${l.verified === false ? ' (link not confirmed)' : ''}`).join('; ')}`);
    if (src.length) out.push(`    - Sources: ${src.map(s => `${s.name} ${s.url}`).join('; ')}`);
  }
  if (PRICE_TIERS.filter(t => it.tiers[t]).length < PRICE_TIERS.length && it.tier_note) out.push(`  - ${one(it.tier_note)}`);
  else if (!filled.length) out.push(`  - No pick. ${one((it.empty_reason && it.empty_reason.standard) || '')}`);
  if (filled.some(t => it.tiers[t].price_usd != null)) out.push(`  - Prices seen ${longDate(it.prices_seen || it.checked)}.`);
  return out;
}
function testerLines(D, it) {
  return P.opinionLines(D, it).map(o => o.link_only ? `  - ${o.outlet} ratings (membership required): ${o.url}`
    : `  - ${poss(o.outlet)} pick${o.product2 ? 's' : ''}: ${o.product}${o.product2 ? ` and ${o.product2}` : ''}, checked ${monthYear(o.checked)}: ${o.url}${o.same_as && it.tiers[o.same_as] ? ` (our ${TIER_NAME[o.same_as]} pick is also ${o.product2 ? 'one of ' : ''}${poss(o.outlet)} pick${o.product2 ? 's' : ''})` : ''}`);
}
function itemDetail(D, it, qtyLine) {
  const out = [`  - Why you need it: ${one(it.need)}`];
  if (qtyLine) out.push(`  - ${qtyLine}`);
  for (const f of (it.item_flags || []).filter(Boolean)) out.push(`  - Note: ${one(f)}`);
  if (it.how_to_choose) out.push(`  - How to choose: ${one(it.how_to_choose)}`);
  if (it.qty && it.qty.note) out.push(`  - How many: ${one(it.qty.note)}`);
  if (it.already_own) out.push(`  - If you already own something similar: ${one(it.already_own)}`);
  if (it.list === 'first-aid-kit') out.push('  - The list is printed in full under the action U7-07; it is the specification for this product.');
  out.push(...pickLines(D, it));
  out.push('  - My pick: (yours to choose; not held in this file)');
  out.push(...testerLines(D, it));
  for (const n of it.safety_notes || []) out.push(`  - Safety: ${one(n.text)} Source: ${n.source_name}, ${n.url}`);
  return out;
}
// One bag list in packing order.
function bagLines({ b, t }, tier) {
  const out = [], nw = t.unknown ? ` (${t.unknown} not weighed)` : '';
  out.push(`${b.id === 'car' ? '####' : '###'} ${b.name}`, '', one(b.purpose), '', `Listed weight at the ${TIER_NAME[tier]} tier: ${t.lb} lb${nw}.`, '', `Target weight: ${one(b.target)}. Listed in packing order: the first group goes in first.`, '');
  for (const n of b.notes || []) out.push(one(n), '');
  t.zones.forEach((z, i) => {
    out.push(`${b.id === 'car' ? '**' : '#### '}${i + 1}. ${z.name}${z.why ? ` (${one(z.why)})` : ''}${b.id === 'car' ? '**' : ''}`, '');
    for (const r of z.rows) out.push(`- [ ] ${r.qty} \u00d7 ${one(r.label)}${r.pick ? `: ${r.pick}` : ''}${r.oz != null ? `, ${r.oz} oz${r.est ? ' est.' : ''}` : ''}${r.note ? `. ${one(r.note)}` : ''}`);
    out.push('');
  });
  return out;
}
const count = lines => lines.filter(l => /^- \[[ x]\] /.test(l)).length;
const ticked = lines => lines.filter(l => /^- \[x\] /.test(l)).length;

/* ---------- Download the whole plan ---------- */
// The side door, once, as its short list. Stars, not boxes: each line names the action that owns its box.
function skyLines(D, h, hhSet) {
  const pg = P.skyPage(D, h, hhSet, null); if (!pg) return [];
  const sky = pg.sky, name = a => `${a.id}, “${one(a.title)}”`;
  const out = [`## ${sky.title}`, '', one(sky.open), '', 'One evening and one store run, sized for three days at home. This list has no boxes of its own: each line names the action that owns it, and that action’s box is in its section above.', ''];
  for (const p of pg.parts) {
    out.push(`### ${p.title}`, '', ...(p.sub ? [one(p.sub), ''] : []));
    for (const r of p.rows) {
      const acts = [...r.acts, ...r.also];
      const buys = r.buys.map(b => `${one(b.pick.brand)} ${one(b.pick.model)}${b.pick.price_usd != null ? `, about ${money(b.pick.price_usd)}` : ', no price seen'} (${b.it.id})`);
      out.push(`* ${one(r.text)}${acts.length ? ` (${acts.map(name).join('; ')})` : ''}${buys.length ? ` One to buy: ${buys.join('; ')}.` : ''}${(r.l.cites || []).length ? ` Sources: ${cites(D, r.l.cites).join('; ')}` : ''}`);
    }
    out.push('');
  }
  out.push(`### ${sky.dont.title}`, '');
  for (const d of pg.dont) out.push(`* ${one(d.l.text)}${d.l.reason ? ' ' + one(d.l.reason) : ''}${d.l.own ? ' This site’s advice.' : ''}${d.from ? ` (The rule and its sources: ${[d.from, d.also].filter(Boolean).map(name).join('; ')})` : (d.l.cites || []).length ? ` Source: ${cites(D, d.l.cites).join('; ')}` : ''}`);
  out.push('', `### ${sky.close.title}`, '', `${one(sky.close.text)} ${one(sky.close.link)}`, '');
  return out;
}
export function planMarkdown(D, h, hhSet, tier = 'standard', date = fileDate()) {
  const full = !hhSet;                         // no setup: the full unfiltered plan
  const hh = full ? H.normalise(null) : h;
  const none = P.emptyData();
  const L = [], counts = [];
  // The file opens on its title, the date and the note. How to read it is at the end.
  L.push('# Household plan', '', `Downloaded ${longDate(date)} from City Ready.`, '');
  const seenItems = new Set(), notes = D.notes || {};
  const access = { lines: [], n: 0 };
  if (!full) L.push('## Household setup used', '', ...setupLines(h, true), '');
  for (const S of (full ? D.sections : P.sectionsFor(D, hh))) {
    const sec = [], key = S.key, lv = S.level;
    sec.push(`## ${S.name}`, '', one(S.intro || ''), '', ...topNoteLines(D, S));
    if (S.calendar) { sec.push(one((D.keep && D.keep.note) || ''), '', ...keepLines(D, hh, full)); L.push(...sec); continue; }
    if (S.only && full) sec.push(`Applies to: ${applies(S.only)}.`, '');
    if (S.waypoint) sec.push(`**${S.waypoint.title}** ${one(S.waypoint.text)} Sources: ${cites(D, S.waypoint.cites).join('; ')}`, '');
    const prog = P.sectionProgress(D, key, hh, none, tier);
    // With no setup the file lists every action in its own section; a pointer is still a pointer.
    const rows = full ? D.actions.filter(a => !a.more && P.partOf(D, a, null) === key).map(a => ({ a, units: [0], target: P.pointerTarget(D, a, null) })) : null;
    const counted = full ? rows.filter(x => !x.target && !P.inAccess(D, x.a)) : prog.acts;
    const items = full ? D.items.filter(it => P.itemPart(it) === key).map(it => ({ it, n: 0, qty: P.need(it, it.level, hh, tier, none), prev: 0, L: it.level })) : prog.items;
    const optional = full ? [] : prog.optional;
    const cabinet = key !== 'household' ? [] : (full ? (D.cabinet ? D.cabinet.groups.flatMap(g => (g.lines || []).map(line => ({ line, group: g, qty: (line.qty || {}).n || 1 }))) : []) : prog.cabinet);
    if (key === 'first' && notes.before0) sec.push(one(notes.before0), '');
    sec.push(totalsLine(counted), '');
    let partNow = '';
    for (const g of P.sectionGroups(D, key, hh, prog, rows)) {
      const inG = e => g.has(e.it);
      const mi = items.filter(e => inG(e) && !(full && e.it.optional)), mo = full ? items.filter(e => inG(e) && e.it.optional) : optional.filter(inG);
      const mc = g.cabinet ? cabinet : [];
      if (!g.rows.length && !mi.length && !mo.length && !mc.length) continue;
      // The block for a disability, a mobility limit or a powered medical device is built here and printed
      // once, under its own heading, after this section. Its boxes are not in the section's count.
      const out = g.access ? access.lines : sec;
      const H3 = g.part ? '####' : '###';
      if (g.part && g.part !== partNow) { partNow = g.part; sec.push(`### ${g.part}`, '', ...(g.partIntro ? [one(g.partIntro), ''] : [])); }
      if (!g.access) { out.push(`${H3} ${g.name}`, ''); if (g.lead && g.intro) out.push(one(g.intro), ''); }
      // Each sub-group once, holding only actions with a box.
      for (const s of g.subs) {
        if (s.name) out.push(g.part ? `**${s.name}**` : `#### ${s.name}`, '');
        for (const { a, units } of s.rows) {
          for (const n of units) out.push(`- [ ] **${a.id}** ${one(a.title)}${full ? '' : unitTag(hh, n)}`);
          out.push(...actionDetail(D, a, hh, full), '');
        }
      }
      // The module's "same job as" lines, gathered in one short list.
      if (g.pointers.length) out.push('The same job as an action with a box, listed once:', '', ...g.pointers.map(({ a, target }) => `* **${a.id}** ${one(a.title)}: same job as ${target.id}, “${one(target.title)}”.`), '');
      if (mi.length || mo.length) sec.push(`${g.part ? '**' : '#### '}What to buy: ${g.name}${g.part ? '**' : ''}`, '');
      for (const e of [...mi, ...mo]) {
        const it = e.it, pk = P.pickFor(it, tier, none).pick, unit = (pk || {}).unit_label || 'unit', opt = it.optional;
        const head = `**${it.id}** ${it.name}${full ? '' : unitTag(hh, e.n)}`;
        if (full) {
          const q = (it.part ? [it.level] : [1, 2, 3].filter(x => x >= it.level)).map(x => `${it.part ? S.name : D.sectionByKey[['', 'bag', 'h72', 'w2'][x]].name}: ${P.need(it, x, hh, tier, none)}`).join(' · ');
          const who = it.only ? ' Applies to: ' + applies(it.only) + '.' : '';
          // An optional extra has no baseline quantity and no tick box: it is not part of the count.
          if (opt) { sec.push(`* ${it.alternative ? 'Alternative' : 'Optional extra'}, not counted: ${head}.${who}`); sec.push(...itemDetail(D, it, it.alternative ? ruleLine(it, pk, hh) : ''), ''); seenItems.add(it.id); continue; }
          sec.push(`- [ ] ${head}`);
          const none0 = (it.part ? [it.level] : [1, 2, 3].filter(x => x >= it.level)).every(x => !P.need(it, x, hh, tier, none));
          sec.push(...itemDetail(D, it, `${none0 ? 'None for two adults' : `Quantity for two adults, in ${unit}: ${q}`}. ${ruleLine(it, pk, hh)}${who}`), '');
          seenItems.add(it.id); continue;
        }
        const mine = ((it.override && ((it.override.at && it.override.at[e.L]) || it.override.qty)) || it.qty || {}).basis === 'count_yourself';
        const q = `${mine ? 'Count your own' : `Need ${e.qty} \u00d7 ${unit}`} in this section${e.prev ? ` (${D.sectionByKey[['first', 'bag', 'h72', 'w2'][e.L - 1]].name} asked for ${e.prev})` : ''}. Rule: ${H.ruleText(it, pk, e.L, P.hhOfUnit(it, hh, e.n), it.override)}.`;
        if (opt) { sec.push(`* ${it.alternative ? 'Alternative' : 'Optional extra'}, not counted: ${head}.`); if (!seenItems.has(it.id)) { sec.push(...itemDetail(D, it, it.alternative ? ruleLine(it, pk, hh) : ''), ''); seenItems.add(it.id); } continue; }
        sec.push(`- [ ] ${head}`);
        if (seenItems.has(it.id)) sec.push(`  - ${q} The picks are listed where this item first appears, under ${(P.sectionOfItem(D, it) || { name: '' }).name}.`, '');
        else { sec.push(...itemDetail(D, it, q), ''); seenItems.add(it.id); }
      }
      if (mc.length) {
        sec.push(...cabinetHead(D, hh, full));
        let cg = null;
        for (const c of mc) { if (c.group !== cg) { cg = c.group; sec.push(`**${one(cg.name)}**`, ''); } sec.push(...cabinetLine(D, c, '- [ ] '), ''); }
      }
      if (g.bag === 'car') { const kit = P.carKit(D, hh, tier, none, full); if (kit) sec.push(...bagLines(kit, tier)); }
    }
    if (!full && prog.covered.length) sec.push(`Already covered by earlier sections, nothing more to buy: ${[...new Set(prog.covered.map(e => e.it.name))].join('; ')}.`, '');
    if (key === 'first' && notes.after0) sec.push(one(notes.after0), '');
    // Lines that are not preparedness for a city household: a title and one line each, no tick box.
    const moreActs = key === 'w2' ? P.moreList(D, full ? null : hh) : [];
    if (moreActs.length) sec.push('### More from Oregon’s toolkit', '', one(D.moreIntro || ''), '', ...moreActs.map(a => `* **${one(a.title)}** ${one(a.why)} (${a.id})`), '');
    counts.push([S.name, count(sec)]);
    L.push(...sec);
    if (key === P.ACCESS_SECTION && access.lines.length) {
      const head = [`## ${D.access.name}`, '', one(D.access.intro || ''), ''];
      access.n = count(access.lines);
      counts.push([`${D.access.name} (open only if it applies)`, access.n]);
      L.push(...head, ...access.lines);
    }
  }
  // The bag list: the grab bag and its add-ons. The car kit is printed in the Car section.
  const bags = [];
  bags.push('## Bag list', '', one(D.bagsIntro || ''), '', `**How it works.** ${one(D.bagsHow || '')}`, '');
  let addonHead = false;
  for (const x of P.bagLayers(D, hh, tier, none, full)) {
    if (!x.b.main && !addonHead) { bags.push('### Add-ons on top', '', 'Each of these is its own list, added to the grab bag when it applies.', ''); addonHead = true; }
    bags.push(...bagLines(x, tier));
  }
  counts.push(['Bag list', count(bags)]);
  L.push(...bags);
  // Legal, Money, Medical
  for (const s of D.plan) {
    const sec = [`## ${s.name}`, ''];
    if (s.disclaimer) sec.push(`**${one(s.disclaimer)}**`, '');
    if (s.intro) sec.push(one(s.intro), '');
    if (s.by_state && (full || H.chosenStates(hh).length > 1)) sec.push(TWO_STATES, '');
    const groups = full ? s.groups.map(g => ({ group: g, rows: s.items.filter(x => x.group === g).map(r => { const a = r.ref ? D.actionById[r.ref] : r; return a ? { a, units: [0], done: r.done || '', isRef: !!r.ref, check: [] } : null; }).filter(Boolean) })).filter(g => g.rows.length) : P.planRows(D, s, hh);
    for (const g of groups) {
      sec.push(`### ${g.group}`, '');
      for (const r of g.rows) {
        const a = r.a, st = a.states && a.states.length ? ` [${a.states.map(x => H.STATES[x] || x).join(', ')} only]` : '';
        for (const n of r.units) sec.push(`- [ ] **${a.id}** ${one(a.title)}${st}${full ? '' : unitTag(hh, n)}`);
        if (r.done) sec.push(`  - Done when: ${one(r.done).replace(/^Done when\s*/i, '')}`);
        if (r.isRef) sec.push(`  - The reason and full how-to are under ${secNameOf(D, a, full ? null : hh)}, ${modName(D, a.module)}.`);
        if (a.form) sec.push(`  - ${a.form.label}: ${a.form.url}`);
        if (a.varies_by_state) sec.push(full || !H.chosenStates(hh).length ? '  - This differs by state. Check your own state\u2019s official form.' : (r.check.length ? `  - This differs by state. Check the official form for ${r.check.map(x => H.STATES[x]).join(' and ')}.` : ''));
        const ws = a.worksheet && D.worksheets.find(w => w.id === a.worksheet);
        if (ws && !r.isRef) sec.push(`  - Worksheet: ${ws.title}`);
        if (!r.isRef) { const c = cites(D, a.cites); if (c.length) sec.push(`  - Official sources: ${c.join('; ')}`); }
        if (full && a.only) sec.push(`  - Applies to: ${applies(a.only)}`);
      }
      sec.push('');
    }
    const clean = sec.filter(x => x !== '' || true);
    counts.push([s.name, count(clean)]);
    L.push(...clean.filter((x, i) => !(x === '' && clean[i - 1] === '')));
  }
  L.push(...skyLines(D, hh, !full));
  L.push(...libraryLines(D));
  L.push('## Appendix: blank worksheets', '', 'Blank forms for the things this plan asks you to write down, printed here in full so they can be filled in by hand with no connection. The site never holds what you write' + (D.noSignIn ? '.' : ': signed in, each also opens as a file in your own Google Drive.'), '');
  for (const w of D.worksheets) L.push(...worksheetLines(w));
  L.push('## How to read this file', '',
    `This file is the plan as written. It holds nobody's ticks, picks or purchases; those are in the other file, the Export (\`household-plan-export_${date}.md\`).`, '',
    full ? 'No household setup was filled in, so this is the full, unfiltered plan: every action and every product, including those meant only for some homes or households (each says who it applies to). Quantities are worked out for two adults in one home.'
      : 'This plan is filtered to the household setup printed at the top. Actions and products that do not apply to those answers are left out.', '',
    `Product quantities and prices use the ${TIER_NAME[tier]} pick where one exists. Order of the lines under each product: Cadillac, Standard, Budget, Compact (the best small one, where there is one), My pick, Wirecutter, Consumer Reports, then other testers.`, '',
    'Things that depend on the building (water, heat, power, alarms, storage, exits) have one tick box per home. Everything about people, bags, documents, money and medical has one tick box per household.', '',
    ...(notes.quantities ? [one(notes.quantities), ''] : []),
    'A line that starts with a star and says "same job as" is a repeat of another action. It has no box and is counted once, where the box is.', '');
  L.push('## Counts in this file', '', '| Section | Tick boxes |', '| --- | ---: |', ...counts.map(([n, c]) => `| ${n} | ${c} |`), '');
  return { text: L.join('\n').replace(/\n{3,}/g, '\n\n'), counts: Object.fromEntries(counts) };
}

// The Library as a reading list: titles, publishers and the publishers' own links. No files.
function libraryLines(D) {
  const L = D.library; if (!L) return [];
  const row = d => `- ${one(d.title)}. ${one(d.publisher)}, ${d.year}. ${d.original_url}`;
  const out = ['## The Library', '', one(L.intro), '', `Checked ${longDate(L.checked)}. ${one(L.how)} These are the publishers\u2019 own links.`, '', '### Print these first', ''];
  out.push(...L.documents.filter(d => d.print_first).map(row), '');
  for (const s of D.sections) {
    const list = L.documents.filter(d => !d.print_first && (d.sections || [])[0] === s.key);
    if (list.length) out.push(`### ${s.name}`, '', ...list.map(row), '');
  }
  if ((L.books || []).length) out.push('### Books worth owning', '', one(L.books_intro), '', ...L.books.map(b => `- ${one(b.title)}, ${one(b.author)} (${one(b.publisher)}, ${b.year}). ${b.buy_url}`), '');
  return out;
}

/* ---------- Export ---------- */
export function exportMarkdown(D, h, hhSet, data, tier = 'standard', date = fileDate()) {
  const L = [], counts = [];
  const box = d => (d ? '- [x] ' : '- [ ] ');
  L.push('# Household plan export', '', `Exported ${date} from City Ready.`, '',
    `**This file is one household's progress:** what is ticked and when, each "My pick", and what has been bought. The plan itself, with every reason and how-to, is in the other file, the whole plan (\`household-plan_${date}.md\`).`, '',
    '`[x]` means ticked, `[ ]` means not yet. Dates are the day the box was ticked. Item text is written in full so this file can be read without the site.', '',
    '## Household setup', '', ...setupLines(h, hhSet), '');
  if (!hhSet) L.push('Without a setup the site assumes two adults in a high-rise with no outdoor space, and this file uses the same assumption.', '');
  L.push(`Quantities use the ${TIER_NAME[tier]} pick, or "My pick" where it names one of the listed picks.`, '');
  const pickNote = it => { const m = (data.picks || {})[it.id]; if (!m) return 'My pick: none chosen'; if (m.tier && it.tiers[m.tier]) return `My pick: ${it.tiers[m.tier].brand} ${it.tiers[m.tier].model} (the ${TIER_NAME[m.tier]} pick)`; return m.text ? `My pick: ${one(m.text)} (own choice)` : 'My pick: none chosen'; };
  for (const S of P.sectionsFor(D, h)) {
    if (S.calendar) continue;
    const key = S.key, sec = [`## ${S.name}`, ''];
    const prog = P.sectionProgress(D, key, h, data, tier);
    for (const g of P.sectionGroups(D, key, h, prog)) {
      const inG = e => g.has(e.it);
      const mi = prog.items.filter(inG), mo = prog.optional.filter(inG), mc = g.cabinet ? prog.cabinet : [];
      if (!g.rows.length && !mi.length && !mo.length && !mc.length) continue;
      // The block for disability and medical devices is counted only once one of its boxes is ticked.
      if (g.access && !g.counted) { sec.push(`### ${g.name}`, '', `Not opened: ${g.rows.filter(x => !x.target).length} actions, left out of the counts.`, ''); continue; }
      sec.push(`### ${g.part ? g.part + ': ' : ''}${g.name}`, '');
      for (const s of g.subs) for (const { a, units } of s.rows) {
        for (const n of units) { const d = P.doneDate(data, a.id, n); sec.push(`${box(d)}**${a.id}** ${one(a.title)}${unitTag(h, n)}${d ? ` (done ${d})` : ''}`); }
        // The site's way round: the line sits on the action that stands in, and names what it replaces.
        const stands = (D.swapsTo[a.id] || []).map(id => D.actionById[id]).filter(x => x && !P.actionVisible(D, x, h));
        if (stands.length) sec.push(`  - Stands in for ${stands.map(x => `${x.id} (${one(x.title)})`).join('; ')}, which ${stands.length > 1 ? 'do' : 'does'} not fit your home.`);
      }
      for (const { a, target } of g.pointers) { const td = P.actionUnits(D, target, h).every(n => P.doneDate(data, target.id, n)); sec.push(`* **${a.id}** ${one(a.title)}: same job as ${target.id}, ${td ? 'done' : 'not yet done'}.`); }
      if (mi.length || mo.length) sec.push('', `Products for ${g.name}:`, '');
      for (const e of mi) {
        const it = e.it, o = P.ownedMap(data, e.n)[it.id], have = P.ownedLevel(data, it.id, e.n) >= e.L, unit = (P.pickFor(it, tier, data).pick || {}).unit_label || 'unit';
        sec.push(`${box(have)}**${it.id}** ${it.name}${unitTag(h, e.n)}: ${((it.override && ((it.override.at && it.override.at[e.L]) || it.override.qty)) || it.qty || {}).basis === 'count_yourself' ? 'count your own' : `need ${e.qty} \u00d7 ${unit}`}. Bought: ${have ? `yes${o && o.date ? ` (${o.date})` : ''}` : (o && o.level ? `an earlier section's amount only${o.date ? ` (${o.date})` : ''}` : 'no')}. ${pickNote(it)}.`);
      }
      for (const e of mo) { const it = e.it, o = P.ownedMap(data, e.n)[it.id]; sec.push(`* ${it.alternative ? 'Alternative' : 'Optional extra'}, not counted: **${it.id}** ${it.name}${unitTag(h, e.n)}. Bought: ${o && o.level >= e.L ? `yes${o.date ? ` (${o.date})` : ''}` : 'no'}. ${pickNote(it)}.`); }
      if (mc.length) { sec.push('', 'The family medicine cabinet:', ''); for (const c of mc) { const o = (data.owned || {})[c.line.id]; sec.push(`${box(o)}**${c.line.id}** ${one(c.line.name)}: ${c.qty} \u00d7 ${(c.line.qty || {}).unit || 'pack'}. In the cabinet: ${o ? `yes${o.date ? ` (${o.date})` : ''}` : 'no'}.`); } }
      sec.push('');
    }
    if (prog.covered.length) sec.push(`Already covered by earlier sections: ${[...new Set(prog.covered.map(e => e.it.name))].join('; ')}.`, '');
    counts.push([S.name, ticked(sec), count(sec)]);
    L.push(...sec);
  }
  for (const s of D.plan) {
    const sec = [`## ${s.name}`, ''];
    if (s.disclaimer) sec.push(`**${one(s.disclaimer)}**`, '');
    for (const g of P.planRows(D, s, h)) {
      sec.push(`### ${g.group}`, '');
      for (const r of g.rows) for (const n of r.units) { const d = P.doneDate(data, r.a.id, n); sec.push(`${box(d)}**${r.a.id}** ${one(r.a.title)}${r.a.states && r.a.states.length ? ` [${r.a.states.join(', ')}]` : ''}${unitTag(h, n)}${d ? ` (done ${d})` : ''}${r.isRef ? ` (also listed under ${secNameOf(D, r.a, h)})` : ''}`); }
      sec.push('');
    }
    counts.push([s.name, ticked(sec), count(sec)]);
    L.push(...sec);
  }
  const files = Object.keys(data.files || {});
  if (!D.noSignIn || files.length) L.push('## Worksheets opened in Google Drive', '', files.length ? files.map(id => `- ${(D.worksheets.find(w => w.id === id) || { title: id }).title}: ${data.files[id]}`).join('\n') : 'None yet.', '',
    'The site holds only these links. It never reads what is inside the files.', '');
  L.push('## Counts', '', '| Section | Ticked | Of |', '| --- | ---: | ---: |', ...counts.map(([n, d, t]) => `| ${n} | ${d} | ${t} |`), '',
    'Items that appear both in a section and in Legal, Money or Medical are one item with one tick; they are counted in each place they are listed, as on the site.', '');
  return { text: L.join('\n').replace(/\n{3,}/g, '\n\n'), counts: Object.fromEntries(counts.map(([n, d, t]) => [n, { done: d, total: t }])) };
}
