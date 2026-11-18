// Loads every plain data file listed in data/index.json. A missing file is skipped and reported on the
// "How we choose, and sources" page, so content can be added or re-checked without touching code.
export const D = { modules: [], actions: [], actionById: {}, items: [], itemById: {}, sources: {}, sections: [], sectionByKey: {}, cabinet: null, keep: null, kit: null, retired: {}, bags: [], worksheets: [], commodities: [], start: [], opinions: {}, pictures: {}, plan: [], checkById: {}, replacers: {}, missing: [], productFiles: [], swapsTo: {}, pointersTo: {} };

async function fetchJson(path) {
  const r = await fetch('data/' + path, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  return await r.json();
}

// Research notes (status codes, "blocked automated access", raw field names and the like) belong in a
// `research_note` field, which nothing prints. As a second guard, any sentence that still reads like one
// is dropped from the fields a reader sees, here, before the site or either download prints them.
const NOTE = /\bHTTP \d{3}\b|\breturned (a )?(40\d|50\d)\b|blocked automated access|\bI could not\b|\bmy fetch\b|second pass|\bthis batch\b|\bprice_usd\b|\bmodel_number\b|\bunit_size\b|\bitem[_ ]flags\b|main session|Decide whether to list/i;
export function readerText(t) {
  if (typeof t !== 'string' || !NOTE.test(t)) return t;
  return t.split(/(?<=[.!?])\s+/).filter(x => !NOTE.test(x)).join(' ').trim();
}
function tidyItem(it) {
  for (const k of ['need', 'how_to_choose', 'already_own']) it[k] = readerText(it[k]);
  if (it.qty) it.qty.note = readerText(it.qty.note);
  it.item_flags = (it.item_flags || []).map(readerText).filter(Boolean);
  for (const n of it.safety_notes || []) n.text = readerText(n.text);
  for (const k of Object.keys(it.empty_reason || {})) it.empty_reason[k] = readerText(it.empty_reason[k]) || 'No pick.';
  for (const p of Object.values(it.tiers || {})) {
    if (!p) continue;
    for (const k of ['why', 'weakness', 'size', 'link_note', 'price_seen_at']) p[k] = readerText(p[k]);
    p.flags = (p.flags || []).map(readerText).filter(Boolean);
    for (const l of p.links || []) l.note = readerText(l.note);
    for (const x of p.sources || []) x.supports = readerText(x.supports);
  }
}

// "Loperamide HCl 2 mg caplets": what a cabinet line is called everywhere.
// "Loperamide HCl 2 mg caplets". Where the ingredient is more than one drug, or ends in a number, the
// strength goes in parentheses so the two cannot run together: "Polyethylene glycol 3350 (17 g) powder".
export const medName = l => {
  const paren = l.strength && (/ and |\d$/.test(l.ingredient || ''));
  return [l.ingredient, l.strength ? (paren ? `(${l.strength})` : l.strength) : '', l.form].filter(Boolean).join(' ') || l.name || l.id;
};
// The brand in parentheses. A store brand with the same Drug Facts panel is the same medicine.
export const medBrand = l => (l.brand_example ? (l.kind === 'tool' || l.kind === 'supply' ? l.brand_example : `${l.brand_example}, ${l.brand_tail || 'or a store brand with the same Drug Facts panel'}`) : '');
// `reader` lets the check scripts load the same files from disk without a browser.
export async function loadAll(reader = fetchJson) {
  const get = async path => { try { return await reader(path); } catch (e) { D.missing.push(path); return null; } };
  const idx = await get('index.json');
  if (!idx) throw new Error('data/index.json could not be loaded');
  const [levels, overlay, bags, worksheets, commodities, start, sources, opinions, pictures, cabinet, keep, kit, sky] = await Promise.all(
    ['sections.json', 'product-levels.json', 'bags.json', 'worksheets.json', 'commodities.json', 'start-here.json', 'sources.json', 'other-opinions.json', 'pictures.json', 'medicine-cabinet.json', 'keep-up.json', 'first-aid-kit.json', 'sky.json'].map(get));
  for (const p of (pictures ? pictures.pictures : [])) D.pictures[p.slot] = p;
  D.opinions = opinions ? opinions.items || {} : {};
  // The seven sections, in order. `level` is the old level number, kept only to place actions and products
  // that carry no `part` of their own and to work out quantities; it never reaches the reader.
  D.sections = levels ? levels.sections : [];
  for (const s of D.sections) D.sectionByKey[s.key] = s;
  D.retired = levels ? levels.retired || {} : {};
  D.cabinet = cabinet && cabinet.groups ? cabinet : null;
  D.keep = keep && keep.entries ? keep : null;
  // The home first-aid kit as a build list, printed inside the action and the product that name it (`list`).
  D.kit = kit && kit.groups ? kit : null;
  // The side door "Holy shit, the sky is falling": a short list of pointers, not a section.
  D.sky = sky && sky.parts ? sky : null;
  // A cabinet line is named by its drug: ingredient, strength and form, as the Drug Facts panel prints them.
  if (D.cabinet) for (const g of D.cabinet.groups) for (const l of g.lines || []) l.name = medName(l);
  D.assumptions = levels ? levels.assumptions || [] : [];
  D.notes = levels ? levels.notes || {} : {};
  D.access = levels ? levels.access || null : null;
  D.moreIntro = levels ? levels.more_intro || '' : '';
  D.bags = bags ? bags.bags : [];
  D.bagsIntro = bags ? bags.intro || '' : '';
  D.bagsHow = bags ? bags.how_it_works || '' : '';
  D.worksheets = worksheets ? worksheets.worksheets : [];
  D.worksheetsWhy = worksheets ? worksheets.why || '' : '';
  D.commodities = commodities ? commodities.items : [];
  D.start = start ? start.actions : [];
  D.sourcesChecked = sources ? sources.checked : '';
  for (const s of (sources ? sources.sources : [])) D.sources[s.id] = s;

  // Actions
  D.modules = idx.modules.map(m => ({ ...m, intro: '', credit: '' }));
  const modFiles = [];
  for (const m of D.modules) for (const f of m.files) modFiles.push([m, f]);
  const loaded = await Promise.all(modFiles.map(([m, f]) => get(f)));
  loaded.forEach((file, i) => {
    const m = modFiles[i][0];
    if (!file) return;
    if (file.intro && !m.intro) m.intro = file.intro;
    if (file.credit && !m.credit) m.credit = file.credit;
    for (const a of file.actions || []) {
      if (!a || !a.id || D.actionById[a.id]) continue;
      a.module = m.code;
      // Ticked once per home (building-dependent) or once per household. Set per module in index.json,
      // with exceptions by section, and an action may carry its own `scope`.
      a.scope = a.scope || (m.sections && m.sections[a.section]) || m.scope || 'household';
      a.level = [0, 1, 2, 3].includes(a.level) ? a.level : 3;
      a.idx = D.actions.length;
      // An earthquake-country action shows only for a home with that hazard (and for everyone until the
      // hazards question is answered). If the action is also moved up for some households (`level_if`),
      // those households see it whatever their hazards.
      if (a.region && /earthquake/i.test(a.region.label || '') && !(a.only && a.only.hazard)) {
        a.only = { ...(a.only || {}), hazard: ['earthquake'] };
        const alts = (a.level_if || []).filter(r => r.has).map(r => ({ has: r.has }));
        if (alts.length) a.only.or = alts;
      }
      D.actions.push(a); D.actionById[a.id] = a;
    }
  });
  // Pointers: an action whose job is done by another action (`same_as`). The target lists its pointers.
  for (const a of D.actions) if (a.same_as) { const t = D.actionById[a.same_as]; if (t && !t.same_as && t !== a) (D.pointersTo[t.id] = D.pointersTo[t.id] || []).push(a.id); else delete a.same_as; }
  // Which hidden actions does each action stand in for?
  for (const a of D.actions) if (a.swap && D.actionById[a.swap]) (D.swapsTo[a.swap] = D.swapsTo[a.swap] || []).push(a.id);

  // Products
  const ov = overlay ? overlay.items : {};
  const prodFiles = await Promise.all(idx.products.map(get));
  prodFiles.forEach((file, i) => {
    if (!file) return;
    D.productFiles.push({ path: idx.products[i], batch: file.batch, checked: file.checked, count: (file.items || []).length });
    for (const it of file.items || []) {
      if (!it || !it.id || D.itemById[it.id]) continue;
      const o = ov[it.id] || {};
      it.checked = file.checked;
      it.level = [1, 2, 3].includes(o.level) ? o.level : 3;
      it.moduleCode = o.module || 'u6';
      it.only = o.only || null;
      it.part = o.part || null;
      // An alternative can be bought in place of others in its group. Like an optional extra it has no tick
      // box and stays out of totals and progress, but it is shown beside them, with its rule.
      it.alternative = !!o.alternative;
      it.optional = !!o.optional || it.alternative;
      it.override = o;
      const mod = D.modules.find(m => m.code === it.moduleCode);
      it.scope = o.scope || (mod && mod.scope) || 'household';
      it.tiers = it.tiers || {};
      tidyItem(it);
      D.items.push(it); D.itemById[it.id] = it;
    }
  });
  // Legal, Money, Medical. Each file is an ordered list of rows: `ref` points at an existing action
  // (one record, one tick, shown in both places); anything else is a checklist item that lives only here.
  const planFiles = await Promise.all((idx.plan || []).map(get));
  planFiles.forEach(file => {
    if (!file) return;
    for (const c of file.items || []) {
      if (c.ref || !c.id || D.checkById[c.id] || D.actionById[c.id]) continue;
      c.kind = 'check'; c.plan = file.section; c.scope = 'household';
      D.checkById[c.id] = c;
      if (c.instead_of) for (const s of c.states || []) (D.replacers[c.instead_of] = D.replacers[c.instead_of] || {})[s] = c.id;
    }
    D.plan.push(file);
  });
  return D;
}

// Display order everywhere: Cadillac, Standard, Budget.
export const TIERS = ['cadillac', 'standard', 'budget'];
export const TIER_NAME = { budget: 'Budget', standard: 'Standard', cadillac: 'Cadillac' };
// The section an action or product belongs to when it carries no `part`: by its old level number.
export const SECTION_OF_LEVEL = ['first', 'bag', 'h72', 'w2'];
