import { config } from '../config.js';
import { createStore, deviceHousehold } from './store.js';
import { D, loadAll, TIERS, PRICE_TIERS, TIER_NAME, COMPACT_IS, SECTION_OF_LEVEL, medName, medBrand } from './data.js';
import * as H from './household.js';
import * as P from './plan.js';
import * as X from './exporter.js';
import * as Art from './art.js';
import * as Photos from './photos.js';
import { createWorksheetFile, isDriveLink } from './drive.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = s => esc(s).replace(/\n/g, '<br>');
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? esc(u) : '';
const today = () => X.fileDate();
const fmtDate = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); };
const longDate = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }); };
const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const ext = (url, label) => { const u = safeUrl(url); return u ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label); };
const poss = n => n + (/s$/i.test(n) ? '’' : '’s');
const monthYear = ym => { const d = new Date(ym + '-15T12:00:00'); return isNaN(d) ? esc(ym) : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const num = n => Number(n).toLocaleString('en-US');

// accessOpen: the block for disability and medical devices was opened in this visit. It is not saved:
// the site stores nothing that says whether it applies to anyone.
const S = { store: null, user: null, data: P.emptyData(), hh: H.normalise(null), hhSet: false, tier: 'standard', hideDone: false, open: new Set(), msg: '', prompt: false, accessOpen: false };

const COST = { free: 'Free', low: 'Under $25', mid: '$25 to $100', high: 'Over $100' };
const TIME = { minutes: '15 min or less', hour: 'Up to an hour', afternoon: 'A few hours', ongoing: 'Ongoing' };
const EFFORT = { easy: 'Easy', some: 'Some effort', most: 'Most effort' };
const SCEN = { outage: 'Power outage', heat: 'Extreme heat', cold: 'Extreme cold', smoke: 'Smoke and bad air', evacuation: 'Evacuation', shelter: 'Shelter in place', earthquake: 'Earthquake' };
const LOOKS = { civic: 'Civic', paper: 'Paper', slate: 'Slate', night: 'Night' };

// Which opening picture goes where. A slot with no licensed photograph falls back to a drawn icon.
const MODULE_SLOT = { u4: 'water', u3: 'food', u5: 'sanitation', pl: 'power', hc: 'heat', ar: 'air', u7: 'first-aid', hr: 'highrise', cm: 'communication', md: 'documents', fn: 'children', nb: 'neighbours' };
const SECTION_SLOT = { 'pl:Light': 'light', 'fn:Pets': 'pets', 'u2:Pets': 'pets' };
const BAG_SLOT = { grab: 'bag-grab', car: 'car', child: 'children', 'child-3-5': 'children', pet: 'pets' };
const BAG_ICON = { grab: 'bag', car: 'car', child: 'child', 'child-3-5': 'child', 'child-6-9': 'child', 'child-10-13': 'child', infant: 'infant', pet: 'pet' };

/* ---------- state ---------- */
function refreshHousehold() {
  const h = S.user ? S.data.household : deviceHousehold.get();
  S.hhSet = !!h; S.hh = H.normalise(h);
}
async function persist() {
  if (!S.user) return;
  try { await S.store.save(S.data); } catch (e) { S.msg = 'Could not save. Check your connection and try again.'; console.error(e); }
}
const unitsOf = a => P.actionUnits(D, a, S.hh);
const lvl = a => (a.kind === 'check' ? a.level : H.levelFor(a, S.hh));
const ptrTarget = a => (a.kind === 'check' ? null : P.pointerTarget(D, a, S.hh));
const visible = a => unitsOf(a).length > 0;
const allDone = (a, units = unitsOf(a)) => units.length > 0 && P.unitsDone(S.data, a, units) === units.length;
const modByCode = c => D.modules.find(m => m.code === c) || { code: c, name: c };
const signInLabel = () => (S.store.kind === 'local' ? 'Test sign-in' : 'Sign in with Google');

// The words for a site with no sign-in (config.signIn false): everything is kept in the visitor's browser.
const quiet = () => !!(S.store && S.store.quiet);
// With no sign-in everyone "has a user", so the cover gives way to "Where you are" only once there is
// a setup or a tick to show.
const started = () => !!S.user && (!quiet() || S.hhSet || ['done', 'done2', 'owned', 'owned2', 'picks'].some(k => Object.keys((S.data || {})[k] || {}).length > 0));
const DATA_PAGE = 'Your saved data';
const PQ = {
  sheets: () => `<h2>Worksheets</h2>
  <p>A worksheet is a blank form. Print it and fill it in by hand. There is no upload box, and nowhere on this site to type what goes on one.</p>
  <h2>No sign-in</h2>
  <p>This site has no accounts and nothing to sign in to. It does not know who you are, and it asks for no name and no email address.</p>`,
  kept: () => `<h2>Where it is kept</h2><p>In this browser’s storage, on this device, and nowhere else. It is not sent to this site or to anyone. So it does not follow you to another device or another browser, and clearing this browser’s data for this site removes it. There are no advertising or analytics trackers and no affiliate links. The fonts and pictures are stored with the site: nothing is loaded from a font service or a picture library, and there is no outside script.${config.servedBy ? ` The site’s files are served by ${esc(config.servedBy)}; like any web host, it can see the internet address a request for a page comes from.` : ''}</p>
  <h2>Deleting what is saved</h2><p>Go to <a href="#/account">${DATA_PAGE}</a> and choose “Delete everything saved here”. This removes your setup, ticks, picks and photos from this browser. It cannot be undone.</p>`
};
const twoHomes = () => S.hh.second;
const pickFor = (item, tier = S.tier) => P.pickFor(item, tier, S.data);
const confirmedSources = p => (p.sources || []).filter(x => x.verified !== false && /^https?:/.test(x.url || '')).length;
const provisional = p => !!p && confirmedSources(p) < 2;
// Sections: the ones this household sees (Car only with a car), and each one's progress.
const SECS = () => P.sectionsFor(D, S.hh);
const secProgress = key => P.sectionProgress(D, key, S.hh, S.data, S.tier, { accessOpen: S.accessOpen });
const secOf = a => (a.kind === 'check' ? null : P.sectionOfAction(D, a, S.hh));
const secName = a => (secOf(a) || {}).name || '';
const secNo = sec => SECS().indexOf(sec) + 1;   // numbered as this household sees them: Car is skipped without a car
const secHref = sec => `#/section/${sec.key}`;
const chainSec = L => D.sectionByKey[SECTION_OF_LEVEL[L]] || { name: '' };
const secPic = (sec, o = {}) => pic(sec.pic, { fallback: sec.icon || 'shelter', ...o });
const planProgress = sec => P.planProgress(D, sec, S.hh, S.data);
const homeTag = n => (n === 0 ? '' : ` <span class="tag">${esc(H.homeLabel(S.hh, n))}</span>`);
const meter = pct => `<span class="meter" role="img" aria-label="${pct}% done"><i style="width:${pct}%"></i></span>`;
// Old names kept so every page still builds: the two green notices are gone.
const signInBanner = () => '';
const hhBanner = () => hhLine();

/* ---------- looks ---------- */
const currentLook = () => (LOOKS[document.documentElement.dataset.look] ? document.documentElement.dataset.look : 'civic');
function setLook(k) {
  if (!LOOKS[k]) return;
  document.documentElement.dataset.look = k;
  try { localStorage.setItem('cityready.look', k); } catch (e) { /* the look still changes for this visit */ }
}

/* ---------- pictures ---------- */
function pic(slot, { ratio = 'r32', sizes = '(min-width: 900px) 50vw, 100vw', eager = false, fallback = '', cls = '' } = {}) {
  const p = slot && D.pictures[slot];
  if (!p) return fallback ? `<figure class="pic ${ratio} drawn ${cls}">${Art.icon(fallback, '')}</figure>` : '';
  return `<figure class="pic ${ratio} ${cls}"><img src="${esc(p.file)}-800.webp" srcset="${esc(p.file)}-800.webp 800w, ${esc(p.file)}-1600.webp 1600w" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${p.position ? ` style="object-position:${esc(p.position)}"` : ''}></figure>`;
}

/* ---------- chrome ---------- */
function renderChrome(route) {
  const lv = SECS().map(sec => {
    const cur = route[0] === 'section' && route[1] === sec.key;
    return `<a href="${secHref(sec)}" ${cur ? 'aria-current="page"' : ''}><span class="n">${secNo(sec)}</span><b>${esc(sec.short || sec.name)}</b>${sec.calendar ? '' : meter(secProgress(sec.key).pct)}</a>`;
  }).join('');
  const pl = D.plan.map(s => {
    const p = planProgress(s), cur = route[0] === 'plan' && route[1] === s.section;
    return `<a href="#/plan/${s.section}" ${cur ? 'aria-current="page"' : ''}><b>${esc(s.name)}</b>${meter(p.pct)}</a>`;
  }).join('');
  const lib = D.library ? `<span class="sep" aria-hidden="true"></span><a href="#/library" ${route[0] === 'library' ? 'aria-current="page"' : ''}><b>The Library</b></a>` : '';
  $('#primaryNav').innerHTML = lv + (pl ? '<span class="sep" aria-hidden="true"></span>' + pl : '') + lib;
  $('#more').innerHTML = `<div class="in">${[['#/', 'Home'], ['#/sky', D.sky ? D.sky.short : 'Sky is falling'], ['#/start', 'Start here: 20 actions'], ['#/scenario/outage', 'By scenario'], ['#/bags', 'Bag list'], ['#/medicine', 'Medicine cabinet'], ['#/shopping/all', 'Shopping list'], ['#/library', 'The Library'],
    ...D.plan.map(s => ['#/plan/' + s.section, s.name]),
    ['#/worksheets', 'Worksheets'], ['#/modules', 'All modules'], ['#/setup', 'Household setup'], ['#/privacy', 'Privacy'], ['#/about', 'How we choose, and sources'], ['#/credits', 'Picture credits'], ['#/account', 'Account']]
    .map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('')}</div>`;
  const acctLink = $('.foot a[href="#/account"]'); if (acctLink) acctLink.textContent = quiet() ? DATA_PAGE : 'Account';
  $('#acct').innerHTML = quiet() ? '' : S.user ? `<span class="who" title="${esc(S.user.name)}">${esc(S.user.name)}</span><button data-cmd="signout">Sign out</button>` : `<button data-cmd="signin">${signInLabel()}</button>`;
  // On every page: Export (signed in only) and Download the whole plan (anyone).
  $('#tools').innerHTML = `<h2>Take it with you</h2><div class="chips">${S.user ? '<button data-cmd="export">Export</button>' : ''}<button data-cmd="plan-download">Download the whole plan</button></div>
    <p>Download the plan to read or hand to an assistant; export yours to show where you are.${S.user ? '' : ' Export appears once you sign in.'}</p>`;
  $('#looks').innerHTML = `<h2 id="lookLabel">Look</h2><div class="looks" role="group" aria-labelledby="lookLabel">${Object.entries(LOOKS).map(([k, v]) => `<button data-cmd="look" data-pick="${k}" aria-pressed="${currentLook() === k}">${v}</button>`).join('')}</div>`;
  const pr = $('#prompt');
  pr.hidden = !S.prompt;
  pr.innerHTML = S.prompt ? `<h2 id="promptTitle">Sign in to save your ticks</h2><p>Everything here can be read without signing in. Sign in and the site remembers what you have done.</p>
    <div class="acts"><button class="btn signal" data-cmd="signin">${signInLabel()}</button><button class="btn sec" data-cmd="prompt-close">Not now</button></div>` : '';
}

/* ---------- pieces ---------- */
function citeList(ids) {
  const rows = (ids || []).map(id => {
    const s = D.sources[id];
    if (!s) return `<li>Source pending check (${esc(id)})</li>`;
    return `<li>${esc(s.publisher)}: ${ext(s.url, s.title || s.url)}${s.ok === false ? ' <span class="unver">(link could not be verified)</span>' : ''}</li>`;
  });
  if (!rows.length) return '';
  return `<h4 class="lbl">Official sources</h4><ul class="cites">${rows.join('')}</ul>`;
}
// Cost, time and effort as one quiet line.
function labels(a, showLevel) {
  const p = [];
  if (showLevel && secName(a)) p.push(esc(secName(a)));
  if (a.time) p.push(a.time === 'minutes' && +a.minutes > 0 ? `${+a.minutes} min` : (TIME[a.time] || esc(a.time)));
  if (a.cost) p.push(COST[a.cost] || esc(a.cost));
  if (a.effort) p.push(EFFORT[a.effort] || esc(a.effort));
  if (a.optional) p.push('Optional');
  // The region label is dropped where the action shows for another reason (a child under 5, say) in a home without that hazard.
  if (a.region && !(/earthquake/i.test(a.region.label) && H.homeList(S.hh).every(n => { const z = H.hhFor(S.hh, n).hazards; return Array.isArray(z) && !z.includes('earthquake'); }))) p.push(esc(a.region.label) + '-specific');
  if (twoHomes() && a.scope === 'home') p.push('Each home');
  return p.length ? `<div class="labels">${p.map(x => `<span>${x}</span>`).join('')}</div>` : '';
}
// Where a line names another action by its ID, the title is printed beside it. A folded ID is shown as
// the action that now does its job.
const ID_RE = /\b((?:U[1-8]|X[1-8]|PL|HC|AR|BG|HR|NB|MD|CM|FN|LG|MN|ME)-\d{2,3})\b(?!, \u201c)/g;
function withTitles(t, selfId) {
  return String(t || '').replace(ID_RE, (m, id) => {
    let a = D.actionById[id] || D.checkById[id]; if (!a) return m;
    if (a.same_as && D.actionById[a.same_as]) a = D.actionById[a.same_as];
    if (a.id === selfId) return m;
    return `${a.id}, \u201c${a.title}\u201d`;
  });
}
// The how-to as numbered steps: one sentence, one step. The words are not changed.
function sentences(t) {
  const out = [];
  for (const para of String(t || '').split(/\n+/)) {
    let cur = '';
    for (const piece of para.trim().split(/(?<=[.!?])\s+/)) {
      cur = cur ? cur + ' ' + piece : piece;
      const open = (cur.match(/\(/g) || []).length > (cur.match(/\)/g) || []).length;
      if (open || /\b(e\.g|i\.e|etc|vs|approx|No|U\.S|a\.m|p\.m)\.$/.test(cur)) continue;
      out.push(cur); cur = '';
    }
    if (cur) out.push(cur);
  }
  const merged = [];
  for (const s of out) { if (merged.length && /^[a-z(]/.test(s)) merged[merged.length - 1] += ' ' + s; else merged.push(s); }
  return merged;
}
function steps(t) {
  const s = sentences(t);
  return s.length < 2 ? `<p>${text(t)}</p>` : `<ol class="steps">${s.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ol>`;
}
// One tick box per unit. With one unit it sits beside the title; with two homes each box is labelled.
function tickBox(a, n, labelled) {
  const d = P.doneDate(S.data, a.id, n);
  const box = `<input class="tick" type="checkbox" data-action="${esc(a.id)}" data-home="${n}" ${d ? 'checked' : ''} aria-label="Mark done${n ? ' for the ' + esc(H.homeLabel(S.hh, n).toLowerCase()) : ''}: ${esc(a.title)}">`;
  return labelled ? `<label class="hometick">${box}<span>${esc(H.homeLabel(S.hh, n))}${d ? ` <span class="doneon">· ${fmtDate(d)}</span>` : ''}</span></label>` : box;
}
const doneLine = (a, units) => units.map(n => { const d = P.doneDate(S.data, a.id, n); return d ? ` · Done${n ? ' at the ' + esc(H.homeLabel(S.hh, n).toLowerCase()) : ''} ${fmtDate(d)}` : ''; }).join('');
const worksheetLink = ws => `<a href="#/worksheet/${esc(ws.id)}">${esc(ws.title)}</a>`;
// An action opened: the reason in a larger first sentence, the steps numbered, then what to buy.
function articleBody(a, units, multi) {
  const calc = a.calc ? H.calcLine(a.calc, lvl(a), S.hh) : '';
  const also = P.pointersOf(D, a), who = H.appliesText(a.only);
  const prods = (a.products || []).map(id => D.itemById[id]).filter(Boolean);
  const ws = a.worksheet && D.worksheets.find(w => w.id === a.worksheet);
  const stands = (D.swapsTo[a.id] || []).map(id => D.actionById[id]).filter(x => x && !visible(x));
  const anyApartment = H.homeList(S.hh).some(n => H.hhFor(S.hh, n).home !== 'house');
  const plan = a.see_plan && D.plan.find(s => s.section === a.see_plan);
  const wt = s => withTitles(s, a.id);
  return `<p class="why">${text(wt(a.why))}</p>
    <h4 class="lbl">How</h4>${steps(wt(a.how))}
    ${a.done ? `<h4 class="lbl">Done when</h4><p class="donewhen">${text(wt(a.done))}</p>` : ''}
    ${a.list === 'first-aid-kit' ? kitBody() : ''}
    ${calc ? `<div class="aside">${esc(calc)}${S.hhSet ? '' : ' <a href="#/setup">Set your household</a> to make this exact.'}</div>` : ''}
    ${a.apartment && anyApartment ? `<h4 class="lbl">In an apartment</h4><p>${text(wt(a.apartment))}</p>` : ''}
    ${a.region ? `<h4 class="lbl">${esc(a.region.label)}-specific. Elsewhere</h4><p>${text(a.region.general)}</p>` : ''}
    ${prods.length ? `<h4 class="lbl">What to buy</h4><ul class="buy">${prods.map(p => `<li><span class="thumb" data-photo="${esc(p.id)}" data-alt="Your photo of ${esc(p.name)}">${Art.icon(Art.itemIcon(p), '')}</span><a href="#/item/${esc(p.id)}">${esc(p.name)}</a>${p.alternative ? ' <span class="tag">Alternative</span>' : p.optional ? ' <span class="tag">Optional extra</span>' : ''}</li>`).join('')}</ul>` : ''}
    ${ws ? `<h4 class="lbl">Worksheet</h4><p>${worksheetLink(ws)}. ${quiet() ? 'A blank form to print and fill in by hand.' : 'A blank form: it opens in your own Google Drive when you are signed in, or prints.'}</p>` : ''}
    ${plan ? `<h4 class="lbl">Line by line</h4><p>The <a href="#/plan/${esc(a.see_plan)}">${esc(plan.name)} checklist</a> breaks this into its separate papers, with your state’s own forms.</p>` : ''}
    ${stands.length ? `<h4 class="lbl">Shown in place of</h4><p>${stands.map(x => `${esc(x.id)} “${esc(x.title)}”, which does not fit your home`).join('; ')}.</p>` : ''}
    ${who ? `<h4 class="lbl">Applies to</h4><p>${esc(who.charAt(0).toUpperCase() + who.slice(1))}.</p>` : ''}
    ${citeList(a.cites)}
    ${also.toolkit.length ? `<p class="meta">Also in Oregon’s toolkit: ${also.toolkit.map(esc).join(', ')}.</p>` : ''}${also.own.length ? `<p class="meta">Also listed as: ${also.own.map(esc).join(', ')}.</p>` : ''}
    <p class="meta">${esc(a.id)}${a.toolkit_page ? ` · Oregon toolkit page ${esc(a.toolkit_page)}` : (/^U\d/.test(a.id) ? ' · from the Oregon toolkit' : ' · added for city homes')}${multi ? '' : doneLine(a, units)} · <a href="#/action/${esc(a.id)}">Open as a page</a></p>`;
}
// One action in a list: a light row. The title opens it in place.
function actionCard(a, opts = {}) {
  if (a.kind === 'check') return checkRow({ a, units: unitsOf(a), done: a.done, isRef: false, check: P.statesToCheck(D, a, S.hh) });
  const units = unitsOf(a), multi = units.length > 1 || (twoHomes() && units[0] > 0);
  // A pointer: one quiet line, no tick box of its own. Its job is the target's.
  const tgt = ptrTarget(a);
  if (tgt) { const td = allDone(tgt); return `<div class="row pointer${td ? ' done' : ''}" id="a-${esc(a.id)}"><span class="tickgap" aria-hidden="true"></span><div class="small"><span class="title">${esc(a.title)}</span> Same job as <a href="#/action/${esc(tgt.id)}">${esc(tgt.id)}, ${esc(tgt.title)}</a>${td ? ' · Done' : ''}. <span class="pid">${esc(a.id)}</span></div></div>`; }
  const done = !a.more && allDone(a, units), open = opts.open || S.open.has(a.id);
  return `<div class="row action${done ? ' done' : ''}" id="a-${esc(a.id)}">
    ${a.more || multi || !units.length ? '<span class="tickgap" aria-hidden="true"></span>' : tickBox(a, units[0], false)}
    <div><button class="t" data-toggle="${esc(a.id)}" aria-expanded="${open}" aria-controls="b-${esc(a.id)}">${esc(a.title)}</button>
      ${labels(a, opts.showLevel)}
      ${a.more ? '<div class="labels"><span>More from Oregon\u2019s toolkit: no tick box, not counted</span></div>' : multi ? `<div class="hometicks">${units.map(n => tickBox(a, n, true)).join('')}</div>` : ''}
      <div class="article body" id="b-${esc(a.id)}" ${open ? '' : 'hidden'}>${articleBody(a, units, multi)}</div></div></div>`;
}
// A Legal, Money or Medical line: a tick box, one line, and at most one sentence saying what done means.
function checkRow(r) {
  const a = r.a, multi = r.units.length > 1 || (twoHomes() && r.units[0] > 0), done = allDone(a, r.units);
  const sec = D.plan.find(s => s.section === (a.plan || '')) || {};
  const ws = a.worksheet && D.worksheets.find(w => w.id === a.worksheet);
  const st = H.chosenStates(S.hh), bits = [];
  if (a.form) bits.push(ext(a.form.url, a.form.label));
  if (a.varies_by_state) {
    const help = r.help || sec.state_help;
    if (!st.length) bits.push(`Differs by state. <a href="#/setup">Choose your state</a> to see its form${help ? `, or look up your state: ${ext(help.url, help.label)}` : ''}`);
    else if (r.check.length) bits.push(`Differs by state. Check the official form for ${esc(r.check.map(x => H.STATES[x]).join(' and '))}${help ? `: ${ext(help.url, help.label)}` : ''}`);
  }
  if (r.isRef) bits.push(`<a href="#/action/${esc(a.id)}">Why and how</a>${secName(a) ? ` (${esc(secName(a))})` : ''}`);
  if (ws) bits.push(`Worksheet: ${worksheetLink(ws)}`);
  if (!r.isRef) for (const id of a.cites || []) { const s = D.sources[id]; if (s) bits.push(`Source: ${ext(s.url, s.publisher)}`); }
  bits.push(esc(a.id) + (multi ? '' : doneLine(a, r.units)));
  return `<div class="row check${done ? ' done' : ''}" id="a-${esc(a.id)}">
    ${multi ? '<span class="tickgap" aria-hidden="true"></span>' : tickBox(a, r.units[0], false)}
    <div><span class="title">${esc(a.title)}</span>${(a.states || []).map(x => `<span class="tag">${esc(H.STATES[x] || x)}</span>`).join('')}
      ${r.done ? `<div class="donemeans">${esc(r.done)}</div>` : ''}
      ${multi ? `<div class="hometicks">${r.units.map(n => tickBox(a, n, true)).join('')}</div>` : ''}
      <div class="labels">${bits.map(b => `<span>${b}</span>`).join('')}</div></div></div>`;
}
// The household setup, as one quiet line with a link.
function peopleWords(h) {
  const n = (k, one, many) => (k ? `${k} ${k > 1 ? many : one}` : '');
  const kids = H.BAND_KEYS.filter(k => h.ages[k]).map(k => `${h.ages[k]} aged ${k === 'u1' ? 'under 1' : H.BANDS[k]}`);
  const total = h.children + h.infants;
  const ppl = [n(h.adults, 'adult', 'adults'), total ? `${n(total, 'child', 'children')}${h.askAges ? '' : ` (${kids.join(', ')})`}` : '', n(h.pets, 'pet', 'pets')].filter(Boolean);
  return ppl.length > 1 ? ppl.slice(0, -1).join(', ') + ' and ' + ppl[ppl.length - 1] : ppl[0];
}
function hhLine() {
  const h = S.hh, kind = { house: 'a house', lowrise: 'a low-rise apartment', highrise: 'a high-rise' };
  const where = h.second ? `two homes (${kind[h.home]}${h.state ? ', ' + h.state : ''}; ${kind[h.home2]}${h.state2 ? ', ' + h.state2 : ''})` : `${kind[h.home]}${h.state ? ' in ' + H.STATES[h.state] : ''}`;
  const ask = S.hhSet && h.askAges ? ' The setup now asks for each child’s age band: <a href="#/setup">add them once</a>.' : '';
  const haz = S.hhSet && H.homeList(h).some(n => H.hhFor(h, n).hazards == null) ? ' <a href="#/setup">Say which hazards apply</a> to hide the rest.' : '';
  return `<p class="hhline noprint">${S.hhSet ? 'Set for' : 'Showing the plan for'} ${esc(peopleWords(h))} in ${esc(where)}. <a href="#/setup">${S.hhSet ? 'Change' : 'Make it yours'}</a>${ask}${haz}</p>`;
}
function tierChips() {
  return `<div class="chips noprint" role="group" aria-label="Which pick">${TIERS.map(t => `<button data-cmd="tier" data-tier="${t}" aria-pressed="${S.tier === t}">${TIER_NAME[t]}</button>`).join('')}</div>`;
}
function pickLabel(it) {
  const mine = (S.data.picks || {})[it.id], { pick, tier } = pickFor(it);
  if (mine && mine.text && !(mine.tier && it.tiers[mine.tier])) return `My pick: ${esc(mine.text)}`;
  if (!pick) return esc(it.tier_note || 'No pick: see its page');
  const many = TIERS.filter(t => it.tiers[t]).length > 1;
  return `${mine && mine.tier ? 'My pick' : many ? TIER_NAME[tier] + ' pick' : 'Pick'}: ${esc(pick.brand)} ${esc(pick.model)}${pick.price_usd != null ? `, about ${money(pick.price_usd)} each` : ''}`;
}
const thumb = it => `<span class="thumb" data-photo="${esc(it.id)}" data-alt="Your photo of ${esc(it.name)}">${Art.icon(Art.itemIcon(it), '')}</span>`;
// One "what to buy" line: e is { it, n (home), qty, prev, L }. L is the amount a tick here stands for.
function itemRow(e) {
  const it = e.it, { pick } = pickFor(it), L = e.L, prevL = L - 1;
  const own = P.ownedLevel(S.data, it.id, e.n), have = own >= L, rec = P.ownedMap(S.data, e.n)[it.id];
  let carry = '';
  if (e.prev > 0) carry = own >= prevL && !have ? `<div class="small">You already have ${e.prev} from ${esc(chainSec(prevL).name)}. Add ${Math.max(0, e.qty - e.prev)} more.</div>` : `<div class="small">${esc(chainSec(prevL).name)} asked for ${e.prev}. This section needs ${e.qty} in total.</div>`;
  const unit = pick ? (pick.unit_label || 'unit') : 'unit';
  const rule = it.override && (it.override.at || it.override.qty) ? (it.override.at && it.override.at[L]) || it.override.qty : it.qty;
  const own1 = rule && rule.basis === 'count_yourself';
  return `<div class="itemrow">
    <input class="tick own" type="checkbox" data-item="${esc(it.id)}" data-level="${L}" data-home="${e.n}" ${have ? 'checked' : ''} aria-label="Bought${e.n ? ' for the ' + esc(H.homeLabel(S.hh, e.n).toLowerCase()) : ''}: ${esc(it.name)}">
    ${thumb(it)}
    <div><a href="#/item/${esc(it.id)}"><b>${esc(it.name)}</b></a>${homeTag(e.n)}
      <div class="small">${pickLabel(it)}</div>${carry}
      <div class="small rule">${esc(H.ruleText(it, pick, L, P.hhOfUnit(it, S.hh, e.n), it.override))}</div>
      ${have ? `<div class="doneon">Bought${rec && rec.date ? ', ' + fmtDate(rec.date) : ''}</div>` : ''}</div>
    <div class="qty">${own1 ? 'Count your own' : `${e.qty} × ${esc(unit)}`}</div></div>`;
}
// An alternative: a product that can be bought in place of others in the same group. No tick box.
function altRow(e) {
  const it = e.it, { pick } = pickFor(it);
  return `<div class="itemrow alt"><span class="tickgap" aria-hidden="true"></span>${thumb(it)}
    <div><a href="#/item/${esc(it.id)}"><b>${esc(it.name)}</b></a> <span class="tag">Alternative</span>
      <div class="small">${pickLabel(it)}</div>
      <div class="small rule">${esc(H.ruleText(it, pick, e.L, P.hhOfUnit(it, S.hh, e.n), it.override))}</div></div>
    <div class="qty">Count your own</div></div>`;
}
// The rows of a buy box. A group that names its products lists them in that order, so an alternative sits
// beside the products it can stand in for.
function buyRows(g, its, alts) {
  const rows = [...its.map(e => ({ e, alt: false })), ...alts.map(e => ({ e, alt: true }))];
  const at = x => { const i = (g.items || []).indexOf(x.e.it.id); return i < 0 ? 999 : i; };
  if (g.lead) rows.sort((x, y) => at(x) - at(y) || x.e.n - y.e.n);
  return rows.map(x => (x.alt ? altRow(x.e) : itemRow(x.e))).join('');
}
// When a level was finished: the latest date among its ticks.
function levelDoneDate(p) {
  let d = '';
  for (const x of p.acts) for (const n of x.units) { const v = P.doneDate(S.data, x.a.id, n); if (v > d) d = v; }
  for (const e of p.items) { const r = P.ownedMap(S.data, e.n)[e.it.id]; if (r && r.date > d) d = r.date; }
  for (const c of p.cabinet || []) { const r = (S.data.owned || {})[c.line.id]; if (r && r.date > d) d = r.date; }
  return d;
}
const levelComplete = p => p.total > 0 && p.done === p.total;
// What is left in a section, and what it costs: "12 things left · about $150 to $400".
// Things are the section's tick boxes still unticked (the same count as "N of M done"); the cost is the
// range of the actions not yet done, from each action's band (free, under $25, $25 to $100, over $100).
// No section shows a total of hours: each action keeps its own minutes on its card (D-114).
function leftLine(p) {
  const n = Math.max(0, p.total - p.done);
  if (!n) return 'Nothing left';
  const t = P.levelTotals(p.acts.filter(x => !allDone(x.a, x.units)));
  const cost = !t.hi && !t.open ? 'free' : `about ${money(t.lo)} to ${money(t.hi + t.open * 100)}${t.open ? ' or more' : ''}`;
  return `${n} thing${n === 1 ? '' : 's'} left \u00b7 ${cost}`;
}
// The next three unticked actions, in the order the site lists them.
function nextThree() {
  const out = [];
  for (const sec of SECS()) {
    if (sec.calendar) continue;
    const p = secProgress(sec.key);
    for (const g of P.sectionGroups(D, sec.key, S.hh, p)) for (const x of g.rows) {
      if (x.target || x.a.optional || allDone(x.a, x.units)) continue;
      out.push(x.a); if (out.length === 3) return out;
    }
  }
  return out;
}
// The note at the very top of the plan, above First steps. Each sentence carries its own sources.
// A signed note that opens one section (the Narcan note, on Bag). It prints there and nowhere else.
function topNote(sec) {
  const n = (sec || {}).note_top; if (!n || !(n.sentences || []).length) return '';
  const ids = [...new Set(n.sentences.flatMap(x => x.cites || []))].filter(id => D.sources[id]);
  return `<aside class="aside topnote" aria-label="${esc(n.by)}"><p><b>${esc(n.by)}</b> ${n.sentences.map(x => esc(x.text)).join(' ')}</p>
    ${ids.length ? `<p class="small">Sources: ${ids.map(id => ext(D.sources[id].url, D.sources[id].publisher + ', ' + (D.sources[id].title || ''))).join('; ')}.${n.action && D.actionById[n.action] ? ` The action is <a href="#/action/${esc(n.action)}">${esc(D.actionById[n.action].title)}</a>.` : ''}</p>` : ''}</aside>`;
}

/* ---------- views ---------- */
const V = {};
const FULL = '<!--full-->';   // a view that lays out its own full-width sections

V.home = () => {
  const lv = SECS().map(sec => ({ sec, p: sec.calendar ? null : secProgress(sec.key) }));
  const levelCards = lv.map(({ sec, p }) => {
    const done = p && levelComplete(p);
    return `<a class="card${done ? ' done' : ''}" href="${secHref(sec)}">${secPic(sec, { ratio: 'r32', sizes: '(min-width: 1040px) 25vw, (min-width: 640px) 50vw, 100vw' })}
      <div class="body"><p class="kicker">${secNo(sec)}</p><h2>${esc(sec.name)}</h2><p>${esc(sec.summary)}</p>
      ${p ? `<div class="cfoot"><span>${esc(leftLine(p))}</span></div>
      <div class="cfoot"><span>${done ? `<b>Done ${fmtDate(levelDoneDate(p))}</b>` : `<span class="count">${p.done} of ${p.total}</span> done`}</span></div>${meter(p.pct)}` : '<div class="cfoot"><span>A calendar. Nothing to tick here.</span></div>'}</div></a>`;
  }).join('');
  const planCards = D.plan.map(s => { const p = planProgress(s); return `<a class="card" href="#/plan/${s.section}">${pic(s.section, { ratio: 'r52', sizes: '(min-width: 640px) 33vw, 30vw', fallback: Art.MODULE_ICON[s.section] })}
    <div class="body"><h3>${esc(s.name)}</h3><p class="small">${esc(s.summary || '')}</p><div class="cfoot"><span><span class="count">${p.done} of ${p.total}</span> done</span></div>${meter(p.pct)}</div></a>`; }).join('');
  let top;
  if (started()) {
    const next = nextThree();
    const tot = lv.filter(x => x.p).reduce((a, x) => ({ done: a.done + x.p.done, total: a.total + x.p.total }), { done: 0, total: 0 });
    const papers = D.plan.map(planProgress).reduce((a, p) => ({ done: a.done + p.done, total: a.total + p.total }), { done: 0, total: 0 });
    const pct = tot.total ? Math.round(100 * tot.done / tot.total) : 0;
    top = `<section class="next3" aria-labelledby="next3h"><div class="wrap">
      <p class="kicker">Where you are</p>
      <h1 id="next3h">${next.length ? `Your next ${next.length === 3 ? 'three' : next.length === 2 ? 'two' : ''} thing${next.length > 1 ? 's' : ''}`.replace('  ', ' ') : 'Everything in the sections is done'}</h1>
      <p class="tally"><span class="count">${num(tot.done)} of ${num(tot.total)}</span> done in the sections${papers.total ? `, <span class="count">${num(papers.done)} of ${num(papers.total)}</span> in Legal, Money and Medical` : ''}.</p>
      ${meter(pct)}
      ${next.length ? `<ol>${next.map((a, i) => `<li><span class="big" aria-hidden="true">${i + 1}</span><div>
        <a class="what" href="#/action/${esc(a.id)}">${esc(a.title)}</a>
        <div class="where">${esc(secName(a))}, ${esc(modByCode(a.module).name)} · ${a.time === 'minutes' && +a.minutes > 0 ? `${+a.minutes} min` : (TIME[a.time] || '')} · ${COST[a.cost] || ''}</div>
        ${i === 0 ? `<p class="go"><a class="btn signal" href="#/action/${esc(a.id)}">Do this one now</a></p>` : ''}</div></li>`).join('')}</ol>` : `<p><a class="btn" href="#/plan/${D.plan[0] ? D.plan[0].section : 'legal'}">Go on to your papers</a></p>`}
    </div></section>`;
  } else {
    top = `<section class="cover">${pic('cover', { ratio: '', sizes: '100vw', eager: true, fallback: 'building' })}
      <div class="label"><p class="kicker">A household plan for city homes</p><h1>${esc(config.siteName)}</h1>
      <p class="lead">Make a home safe on an ordinary day, then get it ready for a power cut, a dry tap or a fast exit, one small step at a time, and put your papers in order along the way.</p>
      <p><a class="btn signal" href="#/section/first">Start with the first steps</a></p></div></section>`;
  }
  // The side door: for someone who arrived frightened and wants tonight's list, not the plan.
  const door = D.sky ? `<section class="band skyband"><div class="wrap"><a class="skydoor" href="#/sky"><span class="kicker">In a hurry tonight?</span><b>${esc(D.sky.title)}</b><span>${esc(D.sky.door)}</span></a></div></section>` : '';
  return `${FULL}${top}${door}
  <section class="band"><div class="wrap"><p class="kicker">Make your home safe, then prepare it</p><h2>${['', 'One section', 'Two sections', 'Three sections', 'Four sections', 'Five sections', 'Six sections', 'Seven sections'][lv.length] || 'The sections'}, in order</h2>
    <div class="cards levels">${levelCards}</div></div></section>
  ${planCards ? `<section class="band"><div class="wrap"><p class="kicker">Put your papers in order</p><h2>Legal, Money, Medical</h2><p class="read">Plain checklists. A tick and a date are all this site keeps; the details stay with you.</p>
    <div class="cards small">${planCards}</div></div></section>` : ''}
  <section class="band"><div class="wrap"><p class="kicker">Other ways in</p>
    <ul class="ways"><li><a href="#/sky">Sky is falling</a></li><li><a href="#/start">Start here: 20 actions</a></li><li><a href="#/scenario/outage">By scenario</a></li><li><a href="#/bags">Bag list</a></li><li><a href="#/medicine">Medicine cabinet</a></li><li><a href="#/shopping/all">Shopping list</a></li><li><a href="#/library">The Library</a></li><li><a href="#/worksheets">Worksheets</a></li><li><a href="#/modules">All modules</a></li></ul>
    ${hhLine()}
    <p class="small read">The structure and many of the actions come from Oregon's Be 2 Weeks Ready toolkit, rewritten for apartments and extended where the toolkit assumes a house with a yard. See <a href="#/about">How we choose, and sources</a>.</p></div></section>`;
};

// The drawing that goes with each section.
function levelArt(sec, p) {
  if (sec.key === 'first') return Art.minutesRing(p.acts.map(x => ({ minutes: +x.a.minutes || 1, done: allDone(x.a, x.units) })), p.acts.reduce((s, x) => s + (+x.a.minutes || 1), 0));
  if (sec.key === 'bag') return bagArt() + `<p class="small"><a href="#/bags">See the bag list, item by item</a></p>`;
  if (sec.key === 'h72') {
    const rows = [];
    for (const n of H.homeList(S.hh)) { const hh = H.hhFor(S.hh, n), tag = twoHomes() ? `${H.homeLabel(S.hh, n)}: ` : '';
      rows.push({ gallons: H.waterGallons(2, hh), label: `${tag}72 hours at home, ${H.daysFor(2, hh)} days` }, { gallons: H.waterGallons(3, hh), label: `${tag}Two weeks at home, ${H.daysFor(3, hh)} days` }); }
    const ppl = H.people(S.hh);
    return `<h3>How much water</h3>` + Art.waterAmounts({ rows, per: `For ${ppl} ${ppl > 1 ? 'people' : 'person'}${S.hh.pets ? ` and ${S.hh.pets} pet${S.hh.pets > 1 ? 's' : ''}` : ''}: one gallon per person per day${S.hh.pets ? ', half a gallon per pet' : ''}.` });
  }
  if (sec.key !== 'w2') return '';
  const link = (id, t) => (D.actionById[id] && visible(D.actionById[id]) ? `<a href="#/action/${id}">${t}</a>` : t);
  return `<h3>Where things live in an apartment</h3>` + Art.apartmentMap([
    `By the door: ${link('BG-14', 'the grab bag')}, with ${link('BG-21', 'your marked paper map')} folded into it.`,
    `A hall closet shelf an adult can reach without a stool: ${link('U7-07', 'the first-aid kit')}.`,
    `Under or beside each bed: ${link('U6-22', 'closed shoes and a flashlight')}.`,
    `Under beds and sofas and on the closet floor: ${link('X3-06', 'stored food and water in low, flat bins')}.`,
    `The most private room with a door and a floor you can wipe: ${link('U5-25', 'the two-bucket toilet')}.`,
    `The breaker panel and the stop valves under each sink: ${link('U2-97', 'know where they are')}.`]);
}
function bagArt() {
  const layers = P.bagLayers(D, S.hh, S.tier, S.data, false), g = layers.find(x => x.b.main);
  if (!g) return '';
  return Art.grabBag({ grab: g.t.lb, addons: layers.filter(x => !x.b.main).map(x => ({ name: x.b.name, icon: BAG_ICON[x.b.id] || 'bag' })) });
}
function doneMoment(sec, p) {
  if (!levelComplete(p)) return '';
  const list = SECS().filter(s => !s.calendar), next = list[list.indexOf(sec) + 1];
  return `<section class="donemoment" aria-label="${esc(sec.name)} done"><div class="wrap"><p class="kicker">${secNo(sec)}</p><h2>${esc(sec.name)} is done.</h2>
    <p>Finished ${longDate(levelDoneDate(p))}. Every box in this section is ticked for your household${twoHomes() ? ' and both homes' : ''}.</p>
    ${next ? `<p><a class="btn signal" href="${secHref(next)}">Go on to ${esc(next.name)}</a></p>` : `<p><a class="btn signal" href="#/plan/${D.plan[0] ? D.plan[0].section : 'legal'}">Go on to your papers</a></p>`}</div></section>`;
}
const twoSentences = t => sentences(t || '').slice(0, 2).join(' ');

/* ---------- medicine cabinet ---------- */
const bandWords = k => (k === 'adult' ? 'adults' : k === 'u1' ? 'under 1' : H.BANDS[k]);
function cabinetRow(c) {
  const l = c.line, rec = (S.data.owned || {})[l.id], have = !!rec, q = l.qty || {}, brand = medBrand(l);
  return `<div class="itemrow med" id="${esc(l.id)}">
    <input class="tick own" type="checkbox" data-item="${esc(l.id)}" data-level="1" data-home="0" ${have ? 'checked' : ''} aria-label="In the cabinet: ${esc(medName(l))}">
    <div><b>${esc(medName(l))}</b>${l.purpose ? `, ${esc(l.purpose)}` : ''}${brand ? ` <span class="small">(${esc(brand)})</span>` : ''}
      ${l.pack ? `<div class="small">Buy: ${esc(l.pack)}.</div>` : ''}
      ${l.alternatives ? `<div class="small">${esc(l.alternatives)}</div>` : ''}
      ${l.label_age ? `<div class="small">${esc(l.label_age)}</div>` : ''}
      ${l.dose ? `<div class="small"><b>${esc(l.dose)}</b></div>` : ''}
      ${l.note ? `<div class="small">${esc(withTitles(l.note))}</div>` : ''}
      <div class="small rule">For: ${esc((l.for || ['adult']).map(bandWords).join(', '))}. ${esc(q.rule || '')}</div>
      ${(l.cites || []).filter(id => D.sources[id]).length ? `<div class="small">Source: ${l.cites.filter(id => D.sources[id]).map(id => ext(D.sources[id].url, D.sources[id].publisher)).join(', ')}</div>` : ''}
      ${have ? `<div class="doneon">In the cabinet${rec.date ? ', ' + fmtDate(rec.date) : ''}</div>` : ''}</div>
    <div class="qty">${c.qty} × ${esc(q.unit || 'pack')}</div></div>`;
}
// The home first-aid kit, as lines a reader can check against the box. No tick boxes: the action has one.
const cabLine = id => (D.cabinet ? D.cabinet.groups.flatMap(g => g.lines).find(x => x.id === id) : null);
const kitLineName = l => { const c = l.cabinet && cabLine(l.cabinet); return c && l.size === 'as the cabinet line' ? medName(c) : l.item; };
function kitLine(l) {
  const c = l.cabinet && cabLine(l.cabinet);
  const size = l.size && l.size !== 'as the cabinet line' ? `, ${esc(l.size)}` : '';
  return `<li><b>${l.count} ${esc(l.unit || '')}</b>: ${esc(kitLineName(l))}${size}${c ? ` <a class="small" href="#/medicine">(the cabinet’s line${c.brand_example ? ': ' + esc(c.brand_example) : ''})</a>` : ''}${l.from === 'site' ? ' <span class="tag">This site’s line</span>' : ''}${l.count_from || l.note ? '.' : ''}${l.count_from ? ` <span class="small">${esc(l.count_from)}</span>` : ''}${l.note ? ` <span class="small">${esc(withTitles(l.note))}</span>` : ''}</li>`;
}
function kitBody() {
  const k = D.kit; if (!k) return '';
  const all = k.groups.flatMap(g => g.lines), byId = Object.fromEntries(all.map(l => [l.id, l])), hs = k.head_start;
  const label = l => `${kitLineName(l)}${l.size && l.size !== 'as the cabinet line' ? ' (' + l.size + ')' : ''}`;
  const full = hs ? new Set(hs.covers || []) : new Set(), part = hs ? new Set((hs.partly || []).map(p => p.id)) : new Set();
  return `<div class="kitlist"><p>${esc(k.intro)}</p><p><b>The box.</b> ${esc(k.box)}</p>
    ${k.groups.map(g => `<h4 class="lbl">${esc(g.name)}</h4>${g.intro ? `<p class="small">${esc(g.intro)}</p>` : ''}<ul class="kit">${g.lines.map(kitLine).join('')}</ul>`).join('')}
    <p class="small">Lines marked “This site’s line” are this site’s own additions. The rest come from Oregon’s list of 23 items and the American Red Cross list for a family of four; where the two differ, the larger count is used.</p>
    ${k.after_class ? `<p class="small">${esc(withTitles(k.after_class))}</p>` : ''}
    ${hs ? `<h4 class="lbl">A head start, if you want one</h4><p>${esc(hs.intro)} ${ext(hs.url, hs.name)}${hs.price_usd != null ? `, ${money(hs.price_usd)}, seen ${longDate(hs.seen)}` : ''}.</p>
      <p class="small"><b>It covers:</b> ${esc((hs.covers || []).map(id => byId[id]).filter(Boolean).map(label).join('; '))}.</p>
      ${(hs.partly || []).length ? `<p class="small"><b>It covers part of these, so you still top them up:</b> ${hs.partly.map(p => esc(p.text)).join('; ')}.</p>` : ''}
      <p class="small"><b>You still add:</b> ${esc(all.filter(l => !full.has(l.id) && !part.has(l.id)).map(label).join('; '))}.</p>` : ''}</div>`;
}
function cabinetBody() {
  const cab = D.cabinet; if (!cab) return '<p>The medicine cabinet list is not loaded yet.</p>';
  const lines = P.cabinetLines(D, S.hh);
  const here = k => (k === 'adult' ? S.hh.adults : (S.hh.ages[k] || 0)) > 0;
  const hazards = (cab.hazards || []).filter(z => !z.applies || !z.applies.length || z.applies.some(here));
  const groups = cab.groups.map(g => { const rows = lines.filter(c => c.group === g); return rows.length ? `<h3>${esc(g.name)}</h3>${rows.map(cabinetRow).join('')}` : ''; }).join('');
  return `<div class="aside signal"><p><b>No doses are given here.</b> Doses go by weight, from the label or the child’s doctor. Nothing on this page has been read by a pharmacist or a pediatrician.</p></div>
    ${cab.store_brand ? `<p>${esc(cab.store_brand.text)}${(cab.store_brand.cites || []).filter(id => D.sources[id]).length ? ` <span class="small">Source: ${cab.store_brand.cites.filter(id => D.sources[id]).map(id => ext(D.sources[id].url, D.sources[id].publisher)).join(', ')}.</span>` : ''}</p>` : ''}
    ${(cab.rules || []).map(r => `<p><b>${esc(r.title)}.</b> ${esc(r.text)}${(r.cites || []).filter(id => D.sources[id]).length ? ` <span class="small">Source: ${r.cites.filter(id => D.sources[id]).map(id => ext(D.sources[id].url, D.sources[id].publisher)).join(', ')}.</span>` : ''}</p>`).join('')}
    ${hazards.length ? `<h3>Read these before you give anything</h3><ul>${hazards.map(z => `<li><b>${esc(z.title)}.</b> ${esc(z.text)}${(z.cites || []).filter(id => D.sources[id]).length ? ` <span class="small">Source: ${z.cites.filter(id => D.sources[id]).map(id => ext(D.sources[id].url, D.sources[id].publisher)).join(', ')}.</span>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="buybox">${groups || '<p class="small">No lines apply to this household setup.</p>'}</div>`;
}
V.medicine = () => {
  const cab = D.cabinet, lines = P.cabinetLines(D, S.hh), got = lines.filter(c => P.cabinetHas(S.data, c.line.id)).length;
  const h = D.sectionByKey.household;
  return `<p class="kicker">${h ? `<a href="${secHref(h)}">${esc(h.name)}</a>` : ''}</p><h1>The family medicine cabinet</h1>
    <p class="lead">${esc((cab && cab.intro) || '')}</p>${hhLine()}
    <p class="small"><span class="count">${got} of ${lines.length}</span> lines in the cabinet. The list is filtered to the ages in your household setup. Checked ${cab && cab.checked ? fmtDate(cab.checked) : 'n/a'}.</p>
    <div class="chips noprint"><button data-cmd="print">Print this list</button></div>
    ${cabinetBody()}`;
};

/* ---------- keep it up: a calendar, no tick boxes ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function keepBody() {
  const k = D.keep; if (!k) return '<p>The calendar is not loaded yet.</p>';
  // A line points at the action that owns the job, or (`page`) at a page of the site, such as the library.
  const PAGES = { library: ['#/library', 'The Library'] };
  const ok = e => { if (e.page) return !!PAGES[e.page] && (e.page !== 'library' || !!D.library); const a = D.actionById[e.action] || D.checkById[e.action]; return a && visible(a); };
  const line = e => { const a = D.actionById[e.action] || D.checkById[e.action]; const to = e.page ? `<a href="${PAGES[e.page][0]}">${PAGES[e.page][1]}</a>` : `<a href="#/action/${esc(a.id)}">${esc(a.id)}, ${esc(a.title)}</a>`; return `<li>${esc(e.text)} ${to}${e.every ? ` <span class="small">(${esc(e.every)})</span>` : ''}</li>`; };
  const list = k.entries.filter(ok);
  const block = (title, rows, intro) => (rows.length ? `<section class="group"><div class="group-head"><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}</div><ul class="keep">${rows.map(line).join('')}</ul></section>` : '');
  const now = new Date().getMonth();
  return `${block('Every month', list.filter(e => e.when === 'monthly'), k.monthly_intro)}
    ${Array.from({ length: 12 }, (_, i) => (i + now) % 12).map(m => block(MONTHS[m], list.filter(e => Array.isArray(e.months) && e.months.includes(m + 1)))).join('')}
    ${block('On its own date', list.filter(e => e.when === 'dated'), k.dated_intro)}`;
}

V.level = n => V.section(SECTION_OF_LEVEL[Math.max(0, Math.min(3, parseInt(n, 10) || 0))]);   // old links still land
V.section = (key) => {
  const sec = D.sectionByKey[key] || D.sections[0];
  if (!P.sectionVisible(sec, S.hh)) return `<h1>${esc(sec.name)}</h1><p>This section is for households with a car. Your setup says you have none. <a href="#/setup">Change the setup</a> if that is wrong.</p>`;
  if (sec.calendar) {
    return `${FULL}<header class="opener"><div class="in"><div class="text"><p class="kicker">${secNo(sec)}</p><h1>${esc(sec.name)}</h1><p class="lead">${esc(sec.intro)}</p>
      <p class="small">${esc((D.keep && D.keep.note) || '')}</p></div>${secPic(sec, { ratio: '', eager: true })}</div></header>
      <div class="layout left"><div class="col">${hhLine()}<div class="chips noprint"><button data-cmd="print">Print the calendar</button></div>${keepBody()}${fromLibrary(sec.key)}
      <p class="aside noprint">That is the end of the plan. <a href="#/library">The Library</a> keeps the official guides behind it, from FEMA, the CDC, the Red Cross and the states, to download or print.</p></div></div>`;
  }
  const L = sec.level;
  const p = secProgress(sec.key);
  let groups = '', jump = '', stops = [];
  const notes = D.notes || {};
  const has = e => P.ownedLevel(S.data, e.it.id, e.n) >= e.L;
  let partNow = '';
  for (const g of P.sectionGroups(D, sec.key, S.hh, p)) {
    const code = g.code, mod = g.module || code;
    const all = g.rows.filter(x => !x.target);
    const its = p.items.filter(e => g.has(e.it));
    const opts = p.optional.filter(e => g.has(e.it) && !e.it.alternative);
    const alts = p.optional.filter(e => g.has(e.it) && e.it.alternative && e.n <= 1);
    const cab = g.cabinet ? p.cabinet : [];
    if (!g.rows.length && !its.length && !opts.length && !alts.length && !cab.length) continue;
    const counted = !g.access || g.counted;
    const doneN = all.reduce((s, x) => s + P.unitsDone(S.data, x.a, x.units), 0) + its.filter(has).length + cab.filter(c => P.cabinetHas(S.data, c.line.id)).length;
    const totalN = all.reduce((s, x) => s + x.units.length, 0) + its.length + cab.length;
    const tally = counted ? `${doneN} of ${totalN}` : 'not counted';
    const shown = x => !S.hideDone || !allDone(x.a, x.units);
    const photo = g.lead ? '' : pic(MODULE_SLOT[mod], { ratio: '', sizes: '(min-width: 1040px) 15rem, 100vw' });
    const kit = g.bag === 'car' ? P.carKit(D, S.hh, S.tier, S.data, false) : null;
    if (g.part && g.part !== partNow) { partNow = g.part; const pid = 'part-' + partNow.toLowerCase().replace(/[^a-z]+/g, '-'); groups += `<div class="parthead" id="${pid}"><h2>${esc(g.part)}</h2>${g.partIntro ? `<p>${esc(g.partIntro)}</p>` : ''}</div>`; jump += `<li class="jpart"><a href="#${pid}" data-jump="${pid}"><b>${esc(g.part)}</b></a></li>`; }
    jump += `<li><a href="#m-${code}" data-jump="m-${code}">${esc(g.name)}</a><span class="count">${tally}</span></li>`;
    stops.push({ html: `<a href="#m-${code}" data-jump="m-${code}">${esc(g.name)}</a><small class="count">${tally}</small>` });
    // Each sub-group once, holding only actions with a box; the "same job as" lines are gathered at the end.
    const subsHtml = g.subs.map(s => { const list = s.rows.filter(shown); return list.length ? `${s.name ? `<h3>${esc(s.name)}</h3>` : ''}${pic(SECTION_SLOT[mod + ':' + s.name], { ratio: 'r52', sizes: '(min-width: 1040px) 43rem, 100vw' })}${mod === 'u5' && s.name === 'Twin-bucket toilet' ? Art.twinBuckets() : ''}<div class="rows">${list.map(x => actionCard(x.a)).join('')}</div>` : ''; }).join('');
    const ptrs = g.pointers.length ? `<details class="ptrs"><summary>${g.pointers.length} line${g.pointers.length > 1 ? 's' : ''} from Oregon\u2019s toolkit and this site that ${g.pointers.length > 1 ? 'are' : 'is'} the same job as an action above or elsewhere</summary><div class="rows">${g.pointers.map(x => actionCard(x.a)).join('')}</div></details>` : '';
    const body = `${subsHtml}
      ${its.length || alts.length ? `<div class="buybox"><h3>What to buy</h3>${notes.quantities ? `<p class="small">${esc(notes.quantities)}</p>` : ''}${buyRows(g, its, alts)}</div>` : ''}
      ${cab.length ? `<div class="buybox"><h3>The family medicine cabinet</h3><p class="small">${cab.filter(c => P.cabinetHas(S.data, c.line.id)).length} of ${cab.length} lines in the cabinet, for the ages in your setup. <a href="#/medicine">Open it as a page</a>.</p>${cabinetBody()}</div>` : ''}
      ${kit ? `<div class="read"><h3>The car kit, item by item</h3>${bagCard(kit)}</div>` : ''}
      ${opts.length ? `<p class="small">Optional extras, not counted in your progress or the shopping total: ${[...new Set(opts.map(e => e.it))].map(it => `<a href="#/item/${esc(it.id)}">${esc(it.name)}</a>`).join(', ')}.</p>` : ''}
      ${ptrs}`;
    const head = `<h2 id="h-${code}"><span class="mark">${Art.icon(g.lead ? (g.icon || 'alerts') : (Art.MODULE_ICON[mod] || 'box'), '')}</span>${esc(g.name)} <small class="count">${tally}</small></h2>
        <p>${esc(g.lead ? g.intro : twoSentences(g.intro))}</p>`;
    // The block for a disability, a mobility limit or a powered medical device: printed once, closed, and
    // left out of the counts and the cost until it is opened or one of its boxes is ticked.
    groups += g.access
      ? `<section class="group accessblock" id="m-${code}" aria-labelledby="h-${code}"><div class="group-head"><div>${head}</div></div>
          <details data-access ${counted ? 'open' : ''}><summary>${counted ? 'These are counted in this section.' : `Open this if it applies to someone at home: ${all.length} action${all.length === 1 ? '' : 's'}, left out of the counts and the cost until you do.`}</summary>${body}</details></section>`
      : `<section class="group" id="m-${code}" aria-labelledby="h-${code}">
      <div class="group-head${photo ? ' haspic' : ''}"><div>${head}</div>${photo}</div>${body}</section>`;
  }
  // Lines that are not preparedness for a city household: a title and one line each, no tick box.
  if (p.toolkitMore.length) groups += `<section class="group" id="m-more" aria-labelledby="h-more"><div class="group-head"><div><h2 id="h-more"><span class="mark">${Art.icon('plan', '')}</span>More from Oregon\u2019s toolkit</h2>
      <p>${esc(D.moreIntro || '')}</p></div></div><ul class="morelist">${p.toolkitMore.map(a => `<li><a href="#/action/${esc(a.id)}"><b>${esc(a.title)}</b></a> ${esc(a.why)} <span class="pid">${esc(a.id)}</span></li>`).join('')}</ul></section>`;
  if (sec.key === 'first' && notes.after0) groups += `<p class="aside">${esc(notes.after0)}</p>`;
  const waypoint = sec.waypoint ? `<div class="aside signal"><p><b>${esc(sec.waypoint.title)}</b></p><p>${text(sec.waypoint.text)}</p>${citeList(sec.waypoint.cites).replace(/<(\/?)h4/g, '<$1h2')}</div>` : '';
  const cov = [...new Set(p.covered.map(e => e.it))];
  const carry = cov.length ? `<details class="group"><summary><b>Already covered by earlier sections</b> (${cov.length} things, nothing more to buy)</summary><p class="read">${cov.map(it => `<a href="#/item/${esc(it.id)}">${esc(it.name)}</a>`).join(', ')}.</p></details>` : '';
  const left = `${leftLine(p)}${p.total > p.done && L !== 0 ? ', depending on what you already own' : ''}.`;
  const buyLeft = p.items.filter(e => !has(e)).length;
  const tools = `<div class="chips"><button data-cmd="print">Print this checklist</button><button data-cmd="hidedone" aria-pressed="${S.hideDone}">Hide done</button></div>
      <p class="small">${sec.key === 'bag' ? '<a href="#/bags">Bag list</a> · ' : ''}${sec.key === 'household' ? '<a href="#/medicine">Medicine cabinet</a> · ' : ''}<a href="#/worksheets">Worksheets</a></p>`;
  const buys = L !== 0;
  const buyBlock = buys ? `<h2>What to buy</h2><p>${p.items.length ? `${buyLeft} of ${p.items.length} still to buy.` : 'Nothing to buy in this section.'} <a href="#/shopping/${sec.key}">Shopping list</a></p><p class="small noprint">Prices use this tier, or your own pick where you set one:</p>${tierChips()}` : '';
  const rail = `<aside class="rail" aria-label="Your progress in this section"><div class="sticky">
    <div class="block"><h2>${esc(sec.name)}</h2><div class="big count" id="progressBig">${p.done} of ${p.total}</div><p class="small" id="progressLine">${p.done} of ${p.total} done in this section.</p>${meter(p.pct)}<p class="small">${left}</p></div>
    <div class="block">${hhLine()}${twoHomes() ? '<p class="small">Two homes: anything that depends on the building has a tick box for each home.</p>' : ''}</div>
    <div class="block jump"><h2>In this section</h2><ul>${jump}</ul></div>
    <details class="block jumpd"><summary>Jump to a part of this section</summary><ul>${jump}</ul></details>
    ${buys ? `<div class="block late">${buyBlock}</div>` : ''}
    <div class="block late noprint">${tools}</div>
  </div></aside>`;
  const all = SECS().length;
  return `${FULL}<header class="opener"><div class="in"><div class="text"><p class="kicker">Section ${secNo(sec)} of ${all}</p><h1>${esc(sec.name)}</h1><p class="lead">${esc(sec.intro)}</p>
    <p class="small">${p.acts.length} actions apply to your household. ${esc(leftLine(p))}.</p>
    ${sec.key === 'first' && notes.before0 ? `<p class="aside">${esc(notes.before0)}</p>` : ''}</div>
    ${secPic(sec, { ratio: '', eager: true })}</div></header>
  ${doneMoment(sec, p)}
  <div class="layout">${rail}<div class="col">
    ${topNote(sec)}
    ${waypoint}
    <section class="glance" aria-label="This section at a glance"><p class="kicker">The order of this section</p>${Art.route(stops)}${levelArt(sec, p)}</section>
    ${groups || '<p>No actions loaded for this section yet.</p>'}
    ${carry}
    ${fromLibrary(sec.key)}
    <div class="lateblocks rail">${buys ? `<div class="block">${buyBlock}</div>` : ''}<div class="block noprint">${tools}</div></div></div></div>`;
};

V.plan = (code) => {
  const sec = D.plan.find(s => s.section === code); if (!sec) return V.home();
  const p = planProgress(sec), st = H.chosenStates(S.hh);
  const two = sec.by_state && st.length > 1 ? `<div class="aside"><p><b>Your homes are in two states, so both states’ items are shown.</b> Each state has its own forms and rules, and the adults in your household may live, own property or need care in either one. Which state’s form each person signs depends on where that person lives; each state’s own page, linked on the item, says who it is for.</p></div>` : '';
  const none = sec.by_state && !st.length ? `<p class="small noprint">Some of these differ by state. <a href="#/setup">Choose your state</a> to see your state’s own forms. Illinois and Michigan are built in full; other states see the general item with a pointer to that state’s form.</p>` : '';
  let jump = '';
  const groups = p.groups.map((g, i) => {
    const rows = S.hideDone ? g.rows.filter(r => !allDone(r.a, r.units)) : g.rows;
    const d = g.rows.reduce((s, r) => s + P.unitsDone(S.data, r.a, r.units), 0), t = g.rows.reduce((s, r) => s + r.units.length, 0);
    jump += `<li><a href="#g-${i}" data-jump="g-${i}">${esc(g.group)}</a><span class="count">${d} of ${t}</span></li>`;
    return `<section class="group" id="g-${i}"><div class="group-head"><h2>${esc(g.group)} <small class="count">${d} of ${t}</small></h2></div><div class="rows">${rows.map(checkRow).join('') || '<p class="small">All done here.</p>'}</div></section>`;
  }).join('');
  const rail = `<aside class="rail" aria-label="Your progress in ${esc(sec.name)}"><div class="sticky">
    <div class="block"><h2>${esc(sec.name)}</h2><div class="big count">${p.done} of ${p.total}</div><p class="small" id="progressLine">${p.done} of ${p.total} done in ${esc(sec.name)}.</p>${meter(p.pct)}</div>
    <div class="block">${hhLine()}</div>
    <div class="block jump"><h2>In this list</h2><ul>${jump}</ul></div>
    <details class="block jumpd"><summary>Jump to a part of this list</summary><ul>${jump}</ul></details>
    <div class="block"><p class="small">This site keeps a tick and a date for each line and nothing else: no names, numbers, documents or details. Where something has to be written down, the line links to a blank worksheet ${quiet() ? 'to print and fill in by hand' : 'that opens in your own Google Drive'}.</p></div>
    <div class="block noprint"><div class="chips"><button data-cmd="print">Print this checklist</button><button data-cmd="hidedone" aria-pressed="${S.hideDone}">Hide done</button></div><p class="small"><a href="#/worksheets">Worksheets</a></p></div>
  </div></aside>`;
  return `${FULL}<header class="opener"><div class="in"><div class="text"><p class="kicker">Your papers</p><h1>${esc(sec.name)}</h1>
    ${sec.disclaimer ? `<p><b>${esc(sec.disclaimer)}</b></p>` : ''}<p class="lead">${esc(sec.intro || '')}</p></div>
    ${pic(sec.section, { ratio: '', eager: true, fallback: Art.MODULE_ICON[sec.section] })}</div></header>
  <div class="layout">${rail}<div class="col">${two}${none}${groups || '<p>Nothing loaded for this section yet.</p>'}
    ${D.library && sec === D.plan[D.plan.length - 1] ? `<p class="aside noprint">That is the last of your papers. <a href="#/library">The Library</a> keeps the official guides behind the plan, to download or print.</p>` : ''}</div></div>`;
};

V.item = (id) => {
  const it = D.itemById[id];
  if (!it) return `<h1>Not found</h1><p>No product item called “${esc(id)}”. <a href="#/">Home</a></p>`;
  const homes = P.itemHomes(it, S.hh), isec = P.sectionOfItem(D, it) || D.sections[0];
  // A product in Bag, 72 hours or Two weeks may be asked for again, in a larger amount, later in that chain.
  const depths = it.part ? [it.level] : [1, 2, 3].filter(L => L >= it.level);
  const mine = (S.data.picks || {})[it.id] || null, mineText = P.myPickText(it, S.data);
  // Cadillac, Standard, Budget side by side: the same facts in the same place in each column.
  const filled = TIERS.filter(t => it.tiers[t]);
  const tiers = filled.map(t => {
    const p = it.tiers[t];
    const links = (p.links || []).filter(l => safeUrl(l.url));
    const srcOk = confirmedSources(p);
    const qtys = it.optional ? '' : depths.map(L => { const n = homes.length ? H.qtyFor(it, p, L, P.hhOfUnit(it, S.hh, homes[0]), it.override) : 0; return n ? (depths.length > 1 ? `${chainSec(L).name}: ${n}` : `${n}`) : ''; }).filter(Boolean).join(' · ');
    return `<div class="tiercol${mine && mine.tier === t ? ' mine' : ''}"><div class="tname">${filled.length > 1 ? TIER_NAME[t] : 'The pick'}${mine && mine.tier === t ? ' · my pick' : ''}</div>${t === 'compact' && filled.length > 1 ? `<p class="small tsub">${COMPACT_IS}</p>` : ''}
      <h3>${esc(p.brand)} ${esc(p.model)}</h3>
      ${p.price_usd != null ? `<div class="price">${money(p.price_usd)}${p.unit_price ? ` <span class="small unitprice">(${esc(p.unit_price)})</span>` : ''}</div>` : ''}
      ${provisional(p) ? '<p class="small">This pick rests on one source.</p>' : ''}
      <dl>
        ${qtys ? `<dt>For your household${homes.length > 1 ? ', per home' : ''}</dt><dd>${esc(qtys)} × ${esc(p.unit_label || 'unit')}<br><span class="small rule">${esc(H.ruleText(it, p, it.level, P.hhOfUnit(it, S.hh, homes[0]), it.override))}</span></dd>` : (it.alternative ? `<dt>For your household</dt><dd>${esc(H.ruleText(it, p, it.level, P.hhOfUnit(it, S.hh, homes[0] || 0), it.override))}. Not in the totals.</dd>` : it.optional ? '<dt>For your household</dt><dd>An optional extra: no baseline quantity, and not in the totals.</dd>' : '')}
        <dt>Why this one</dt><dd>${esc(p.why)}</dd>
        <dt>Main weakness</dt><dd>${esc(p.weakness)}</dd>
        ${(p.flags || []).filter(Boolean).length ? `<dt>Warning</dt>${p.flags.filter(Boolean).map(f => `<dd>${esc(f)}</dd>`).join('')}` : ''}
        ${p.size || p.model_number ? `<dt>Size and model</dt><dd>${esc(p.size || '')}${p.model_number ? `${p.size ? ' · ' : ''}Model ${esc(p.model_number)}` : ''}</dd>` : ''}
        ${links.length ? `<dt>Where to buy</dt><dd><ul>${links.map(l => `<li>${ext(l.url, l.label)}${l.verified === false ? ' <span class="unver">(link not confirmed)</span>' : ''}${l.note ? ` <span class="small">${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>${p.link_note ? `<span class="small">${esc(p.link_note)}</span>` : ''}</dd>` : ''}
      </dl>
      <details><summary>Sources (${srcOk} checked)</summary><ul class="cites">${(p.sources || []).map(s => `<li>${esc(s.name)}: ${ext(s.url, s.title || s.url)}${s.verified === false ? ' <span class="unver">(could not be opened)</span>' : ''}${s.supports ? `<br><span class="small">${esc(s.supports)}</span>` : ''}</li>`).join('')}</ul></details></div>`;
  }).join('');
  const myPick = `<div id="mypick"><h3>My pick</h3>
    <p>${mineText ? `<strong>${esc(mineText)}</strong>${mine && mine.tier ? ` (the ${TIER_NAME[mine.tier]} pick)` : ' (your own choice)'}` : 'None chosen yet.'}</p>
    ${S.user ? `<div class="chips noprint" role="group" aria-label="Choose a listed pick">${TIERS.filter(t => it.tiers[t]).map(t => `<button data-cmd="mypick" data-item="${esc(it.id)}" data-tier="${t}" aria-pressed="${!!(mine && mine.tier === t)}">${TIER_NAME[t]}</button>`).join('')}${mine ? `<button data-cmd="mypick-clear" data-item="${esc(it.id)}">Clear</button>` : ''}</div>
    <form id="pickForm" class="noprint" data-item="${esc(it.id)}"><label for="f-pick" class="small" style="font-weight:400">Or type the product you chose (product name only, up to 80 characters; no personal details)</label>
      <div class="inline"><input id="f-pick" name="text" type="text" maxlength="80" autocomplete="off" value="${mine && mine.text ? esc(mine.text) : ''}"><button class="btn sec" type="submit">Save</button></div></form>` : '<p class="small noprint"><button class="linkbtn" data-cmd="signin">Sign in</button> to save your pick.</p>'}</div>`;
  const boughtRows = homes.map(n => {
    const hh = P.hhOfUnit(it, S.hh, n);
    return depths.map(L => {
      const q = P.need(it, L, hh, S.tier, S.data), prev = L > it.level ? P.need(it, L - 1, hh, S.tier, S.data) : 0;
      if (!q || (L > it.level && q <= prev)) return '';
      const own = P.ownedLevel(S.data, it.id, n), rec = P.ownedMap(S.data, n)[it.id], have = own >= L;
      return `<label class="hometick"><input class="tick own" type="checkbox" data-item="${esc(it.id)}" data-level="${L}" data-home="${n}" ${have ? 'checked' : ''}><span>${n ? esc(H.homeLabel(S.hh, n)) + ', ' : ''}${esc(it.part ? isec.name : chainSec(L).name)}${it.optional ? '' : `: ${q} × ${esc((pickFor(it).pick || {}).unit_label || 'unit')}`}${have && rec && rec.date ? ` <span class="doneon">· Bought ${fmtDate(rec.date)}</span>` : ''}</span></label>`;
    }).join('');
  }).join('');
  const bought = `<div id="bought"><h3>Bought</h3>${boughtRows ? `<div class="hometicks col">${boughtRows}</div><p class="small">Tick when you have bought it or already own something good enough. The date is saved with the tick.</p>` : '<p class="small">This item does not apply to your household setup.</p>'}</div>`;
  // What outside testers currently pick: Wirecutter, then Consumer Reports (a link only), then the others.
  const ops = P.opinionLines(D, it);
  const others = ops.length ? `<div class="strip" style="grid-template-columns:1fr"><div><h3>Other opinions</h3><ul class="testers">${ops.map(o => o.link_only
    ? `<li><span class="who">${esc(o.outlet)}</span><span>${ext(o.url, `${o.outlet} ratings (membership required)`)}</span></li>`
    : `<li><span class="who">${esc(o.outlet)}</span><span>${ext(o.url, o.product2 ? `${poss(o.outlet)} picks: ${o.product} and ${o.product2}` : `${poss(o.outlet)} pick: ${o.product}`)}, checked ${monthYear(o.checked)}${o.same_as && it.tiers[o.same_as] ? `. Our ${TIER_NAME[o.same_as]} pick is also ${o.product2 ? 'one of ' : ''}${esc(poss(o.outlet))} pick${o.product2 ? 's' : ''}.` : ''}</span></li>`).join('')}</ul></div></div>` : '';
  const acts = D.actions.filter(a => (a.products || []).includes(it.id));
  const slot = `<div class="photoslot"><div class="frame" data-photo="${esc(it.id)}" data-alt="Your photo of ${esc(it.name)}">${Art.icon(Art.itemIcon(it), '')}</div>
    <div class="acts noprint">${S.user ? `<button class="linkbtn" data-cmd="photo-add" data-item="${esc(it.id)}">Add my own photo</button><button class="linkbtn" data-cmd="photo-remove" data-item="${esc(it.id)}">Remove it</button><input type="file" accept="image/*" data-photo-input="${esc(it.id)}" hidden>` : '<span class="small">Signed in, you can put your own photo of the one you bought here.</span>'}</div>
    <p class="small noprint">Your photo stays on this device. This site shows no product pictures of its own.</p></div>`;
  return `${FULL}<div class="pagehead"><p class="kicker"><a href="${secHref(isec)}">${esc(isec.name)}</a> · ${esc(modByCode(it.moduleCode).name)}${it.alternative ? ' · an alternative' : it.optional ? ' · optional extra' : ''}${twoHomes() && it.scope === 'home' ? ' · bought for each home' : ''}</p>
    <div class="itemhead"><div><h1>${esc(it.name)}</h1><p class="lead">${esc(it.need)}</p>
      </div>${slot}</div></div>
  <div class="layout left"><div class="col">
    <div class="read">${(it.item_flags || []).filter(Boolean).map(f => `<div class="aside signal">${esc(f)}</div>`).join('')}
    ${it.how_to_choose ? `<div class="kv"><b>How to choose</b>${text(it.how_to_choose)}</div>` : ''}
    ${it.qty && it.qty.note ? `<div class="kv"><b>How many</b>${esc(it.qty.note)}</div>` : ''}
    <div class="kv"><b>If you already own something similar</b>${text(it.already_own)}</div></div>
    ${it.list === 'first-aid-kit' ? `<h2>The list</h2><div class="read">${kitBody()}</div>` : ''}
    <h2>${filled.length === 1 ? 'The pick' : filled.length ? 'The picks' : 'The pick: build it'}</h2>
    ${PRICE_TIERS.filter(t => it.tiers[t]).length < PRICE_TIERS.length && (it.tier_note || !filled.length) ? `<p class="read">${esc(it.tier_note || (it.empty_reason && it.empty_reason.standard) || 'No pick.')}</p>` : ''}
    ${filled.some(t => it.tiers[t].price_usd != null) ? `<p class="small">Prices seen ${longDate(it.prices_seen || it.checked)}. Prices change; treat them as a guide.</p>` : ''}
    <div class="compare"><div class="tiers n${filled.length}">${tiers}</div><div class="strip">${myPick}${bought}</div>${others}</div>
    ${(it.safety_notes || []).length ? `<div class="read"><h2>Safety notes</h2><ul>${it.safety_notes.map(n => `<li>${esc(n.text)} <span class="small">Source: ${esc(n.source_name)}, ${ext(n.url, n.source_title || n.url)}${n.verified === false ? ' <span class="unver">(link could not be opened)</span>' : ''}</span></li>`).join('')}</ul></div>` : ''}
    ${acts.filter(visible).length ? `<h2>Actions that use this</h2><div class="rows read">${acts.filter(visible).map(a => actionCard(a, { showLevel: true })).join('')}</div>` : ''}</div></div>`;
};

// One bag list as a table: the grab bag, an add-on, or the car kit.
function bagCard({ b, t }) {
  const body = t.zones.map((z, zi) => `<tr><th colspan="3">${zi + 1}. ${esc(z.name)}${z.why ? ` <span class="small" style="font-family:var(--sans);font-weight:400">${esc(z.why)}</span>` : ''}</th></tr>` + z.rows.map(r =>
    `<tr><td>${r.it ? `<a href="#/item/${esc(r.it.id)}">${esc(r.label)}</a>${r.pick ? `<br><span class="small">${esc(r.pick)}</span>` : ''}` : esc(r.label)}${r.note ? `<br><span class="small">${esc(r.note)}</span>` : ''}</td><td class="num">${r.qty}</td><td class="num">${r.oz != null ? r.oz + ' oz' + (r.est ? ' est.' : '') : 'n/a'}</td></tr>`).join('')).join('');
  const nw = t.unknown ? ` (${t.unknown} item${t.unknown > 1 ? 's' : ''} not weighed)` : '';
  const photo = pic(BAG_SLOT[b.id], { ratio: '', sizes: '(min-width: 1040px) 15rem, 100vw' });
  return `<section class="group" id="bag-${esc(b.id)}"><div class="group-head${photo ? ' haspic' : ''}"><div><h2><span class="mark">${Art.icon(BAG_ICON[b.id] || 'bag', '')}</span>${esc(b.name)}</h2><p>${esc(b.purpose)}</p>
    ${b.main ? `<p class="layerweight"><b>As listed: ${t.lb} lb</b>${nw}</p>` : ''}</div>${photo}</div>
    <div class="read"><p><b>Target weight:</b> ${esc(b.target)}.</p>${(b.notes || []).map(n => `<p class="small">${esc(n)}</p>`).join('')}
    ${b.main ? `<h3>Packing order</h3>${Art.packingOrder()}` : '<p class="small">Listed in packing order: the first group goes in first (bottom of the bag) unless it says otherwise.</p>'}</div>
    <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Weight</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td colspan="2">Listed weight, ${TIER_NAME[S.tier]} tier${nw}</td><td class="num">${t.lb} lb</td></tr></tfoot></table></section>`;
}
V.bags = () => {
  const layers = P.bagLayers(D, S.hh, S.tier, S.data, false), bag = D.sectionByKey.bag || { name: 'Bag', key: 'bag' };
  const main = layers.filter(x => x.b.main), addons = layers.filter(x => !x.b.main);
  const car = D.sectionByKey.car && P.sectionVisible(D.sectionByKey.car, S.hh);
  return `${FULL}<header class="opener"><div class="in"><div class="text"><p class="kicker"><a href="${secHref(bag)}">${esc(bag.name)}</a></p><h1>The grab bag, item by item</h1><p class="lead">${esc(sentences(D.bagsHow).slice(0, 2).join(' '))}</p><p>${esc(sentences(D.bagsHow).slice(2).join(' '))}</p><p class="small">${esc(D.bagsIntro)}</p></div>
    ${pic('level1', { ratio: '', eager: true, fallback: 'bag' })}</div></header>
  <div class="layout left"><div class="col">
    ${bagArt()}${hhLine()}${tierChips()}
    <div class="chips noprint"><button data-cmd="print">Print the lists</button><a href="${secHref(bag)}">Bag actions</a><a href="#/shopping/bag">Bag shopping list</a></div>
    ${main.map(bagCard).join('') || '<p>The bag list is not loaded yet.</p>'}
    ${addons.length ? `<h2>Add-ons on top</h2><p class="small">Each of these is its own list, added to the grab bag when it applies to you.</p>${addons.map(bagCard).join('')}` : ''}
    ${car ? `<p class="small">The car kit has its own list, in the <a href="#/section/car">Car</a> section.</p>` : ''}</div></div>`;
};

V.action = (id) => {
  const a = D.actionById[id] || D.checkById[id]; if (!a) return `<h1>Not found</h1><p><a href="#/">Home</a></p>`;
  if (a.kind === 'check') { const sec = D.plan.find(s => s.section === a.plan) || { name: '' }; return `<p class="kicker"><a href="#/plan/${esc(a.plan)}">${esc(sec.name)}</a></p>${visible(a) ? '' : '<div class="aside">This item is hidden for your household setup or your state.</div>'}<div class="rows">${actionCard(a)}</div>`; }
  const units = unitsOf(a), multi = units.length > 1 || (twoHomes() && units[0] > 0);
  return `${FULL}<article><div class="pagehead"><p class="kicker">${secOf(a) ? `<a href="${secHref(secOf(a))}">${esc(secName(a))}</a> · ` : ''}<a href="#/module/${a.module}">${esc(modByCode(a.module).name)}</a>${a.section ? ' · ' + esc(a.section) : ''}</p>
    <h1 class="read">${esc(a.title)}</h1>${labels(a)}
    ${visible(a) ? '' : '<div class="aside">This action is hidden for your household setup.</div>'}
    ${a.more ? '<div class="aside">This line is kept from Oregon\u2019s toolkit. It is not preparedness a city household needs, so it has no tick box and is not counted.</div>' : ptrTarget(a) ? `<div class="aside">This is the same job as <a href="#/action/${esc(ptrTarget(a).id)}">${esc(ptrTarget(a).id)}, ${esc(ptrTarget(a).title)}</a>. It is ticked there, once, and counted once.</div>` : units.length ? (multi ? `<div class="hometicks">${units.map(n => tickBox(a, n, true)).join('')}</div>` : `<label class="tickline hometick">${tickBox(a, units[0], false)}<span>${allDone(a, units) ? 'Done' + doneLine(a, units).replace(' · Done', '') : 'Mark this done'}</span></label>`) : ''}</div>
    <div class="layout left"><div class="col"><div class="article">${a.module === 'u5' && a.section === 'Twin-bucket toilet' ? Art.twinBuckets() : ''}${articleBody(a, units, true).replace(/ · <a href="#\/action\/[^"]+">Open as a page<\/a>/, '').replace(/<(\/?)h4/g, '<$1h2')}</div>
    ${secOf(a) ? `<p class="small"><a href="${secHref(secOf(a))}" data-back="1">Back to ${esc(secName(a))}</a></p>` : ''}</div></div></article>`;
};

V.credits = () => {
  const rows = Object.values(D.pictures);
  return `<h1>Picture credits</h1>
  <p class="lead">Every photograph on this site, where it is used, who made it and the license it is used under.</p>
  <p>Each one was taken from a source whose license plainly allows free reuse on a website, and the license was read on the picture’s own page on the date shown. The files are stored with the site; nothing is loaded from the source.</p>
  ${rows.length ? `<ul class="credits" style="list-style:none;padding:0">${rows.map(p => `<li><img class="th" src="${esc(p.file)}-800.webp" alt="" loading="lazy" decoding="async" width="${p.width}" height="${p.height}">
    <b>${esc(p.title || p.slot)}</b><br>${esc(p.alt)}<br><span class="small">Used: ${esc((p.used || []).join('; '))}.<br>${p.author ? `By ${esc(p.author)}. ` : ''}License: ${p.licence_url ? ext(p.licence_url, p.licence) : esc(p.licence)}. Source: ${ext(p.source_page, p.library || 'source page')}. Taken down ${fmtDate(p.taken)}.${p.changes ? ' ' + esc(p.changes) : ''}</span><div style="clear:both"></div></li>`).join('')}</ul>` : '<p>No photographs are in use yet.</p>'}
  <h2>Drawings and icons</h2><p>All drawings, diagrams and icons were drawn for this site. They are not taken from anywhere.</p>
  <h2>Product pictures</h2><p>This site shows no pictures from manufacturers, shops or review sites. A product page shows a drawn icon, or your own photo if you add one; your photo stays on your device.</p>
  <h2>Typefaces</h2><p>Headings are set in Fraunces and text in Source Sans 3. Both are open-license typefaces under the SIL Open Font License 1.1, and the font files are stored with the site (see the <code>fonts</code> folder for each licence).</p>`;
};

// The shopping list. "all" is everything in every section this household sees. A section's own list is
// what that section asks for; for Bag, 72 hours and Two weeks it includes anything from the earlier ones
// in that chain that is not yet ticked as bought.
V.shopping = (key) => {
  const tabs = SECS().filter(s => !s.calendar && s.level !== 0);
  const sec = tabs.find(s => s.key === key) || null;
  // Which products, at which amount: [item, depth].
  const wanted = it => {
    const mine = P.sectionOfItem(D, it); if (!mine || !P.sectionVisible(mine, S.hh)) return 0;
    if (it.part) return !sec || sec.key === mine.key ? it.level : 0;
    if (!sec) return 3;
    return sec.level != null ? sec.level : 0;
  };
  let total = 0, skipped = 0, own = 0, rows = '', haveRows = '', optRows = '';
  const byMod = new Map();
  for (const it of D.items) { const L = wanted(it); if (!L) continue; for (const n of P.itemHomes(it, S.hh)) {
    const hh = P.hhOfUnit(it, S.hh, n), q = P.need(it, L, hh, S.tier, S.data); if (!q) continue;
    if (it.optional) { if (n <= 1) { const p = pickFor(it).pick; optRows += `<li><a href="#/item/${esc(it.id)}">${esc(it.name)}</a>${p ? `: ${esc(p.brand)} ${esc(p.model)}${p.price_usd != null ? `, about ${money(p.price_usd)}` : ''}` : ''}</li>`; } continue; }
    const k = it.part ? 'part:' + it.part : it.moduleCode; if (!byMod.has(k)) byMod.set(k, []); byMod.get(k).push({ it, n, hh, q, L });
  } }
  const heads = [...D.sections.filter(s => s.level == null && !s.calendar).map(s => ({ code: 'part:' + s.key, name: s.name })), ...D.modules];
  for (const m of heads) {
    const list = byMod.get(m.code); if (!list) continue;
    rows += `<tr><th colspan="4">${esc(m.name)}</th></tr>`;
    for (const { it, n, hh, q, L } of list) {
      const mine = (S.data.picks || {})[it.id], ownText = mine && mine.text && !mine.tier ? mine.text : '';
      // Compact is optional: an item without a Compact pick is priced by its Standard pick.
      const sel = pickFor(it), p = mine && mine.tier ? sel.pick : (it.tiers[S.tier] || (S.tier === 'compact' ? sel.pick : null)), ol = P.ownedLevel(S.data, it.id, n);
      const had = ol >= it.level ? P.need(it, Math.min(ol, L), hh, S.tier, S.data) : 0;
      const buy = Math.max(0, q - had), name = `<a href="#/item/${esc(it.id)}">${esc(it.name)}</a>${homeTag(n)}`;
      if (!buy) { haveRows += `<li>${esc(it.name)}${n ? ' (' + esc(H.homeLabel(S.hh, n).toLowerCase()) + ')' : ''} (${q})</li>`; continue; }
      if (ownText) { own++; rows += `<tr><td>${name}<br><span class="small">My pick: ${esc(ownText)}${had ? ` · you have ${had}` : ''}</span></td><td class="num">${buy}</td><td class="num">n/a</td><td class="num">n/a</td></tr>`; continue; }
      if (!p) { skipped++; rows += `<tr><td>${name}<br><span class="small">${esc(it.tier_note || 'No pick: see its page')}</span></td><td class="num">${buy}</td><td class="num">n/a</td><td class="num">n/a</td></tr>`; continue; }
      const line = p.price_usd != null ? buy * p.price_usd : null; if (line != null) total += line;
      rows += `<tr><td>${name}<br><span class="small">${mine && mine.tier ? 'My pick: ' : ''}${esc(p.brand)} ${esc(p.model)}${had ? ` · you have ${had}` : ''}</span></td><td class="num">${buy}</td><td class="num">${p.price_usd != null ? money(p.price_usd) : 'n/a'}</td><td class="num">${line != null ? money(line) : 'n/a'}</td></tr>`;
    }
  }
  const cl = sec ? sec.level : 3;
  const comm = cl == null ? [] : D.commodities.filter(c => c.level <= cl && H.matchesAnyHome(c.only, S.hh));
  const cab = !sec || sec.key === 'household' ? P.cabinetLines(D, S.hh).filter(c => !P.cabinetHas(S.data, c.line.id)) : [];
  return `<h1>Shopping list</h1>${hhBanner()}
  <p>${sec ? `Everything to buy to complete <b>${esc(sec.name)}</b> for your household${twoHomes() ? ' and both homes' : ''}${sec.level > 1 ? ', including anything from the Bag or 72 hours at home that you have not ticked as bought' : ''}.` : `Everything to buy for every section, for your household${twoHomes() ? ' and both homes' : ''}.`}</p>
  <div class="chips noprint" role="group" aria-label="Section"><a href="#/shopping/all" aria-current="${!sec}">Everything</a>${tabs.map(x => `<a href="#/shopping/${x.key}" aria-current="${x === sec}">${esc(x.short || x.name)}</a>`).join('')}</div>
  ${tierChips()}
  ${D.notes && D.notes.quantities ? `<p class="aside">${esc(D.notes.quantities)}</p>` : ''}
  <div class="chips noprint"><button data-cmd="print">Print this list</button></div>
  <p class="printonly"><b>${TIER_NAME[S.tier]} tier.</b></p>
  ${rows ? `<table><thead><tr><th>Item and ${TIER_NAME[S.tier]} pick</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td colspan="3">Running total, ${TIER_NAME[S.tier]} tier</td><td class="num">${money(Math.round(total * 100) / 100)}</td></tr></tfoot></table>` : '<p>Nothing left to buy here.</p>'}
  ${skipped ? `<p class="small">${skipped} item${skipped > 1 ? 's have' : ' has'} no pick at this tier and ${skipped > 1 ? 'are' : 'is'} not in the total.</p>` : ''}
  ${own ? `<p class="small">${own} item${own > 1 ? 's use' : ' uses'} a pick you typed yourself, so the site has no price for ${own > 1 ? 'them' : 'it'}; ${own > 1 ? 'they are' : 'it is'} not in the total.</p>` : ''}
  <p class="small">${S.tier === 'compact' ? 'Compact is the best small one. Few items have one; the rest are priced by their Standard pick. ' : ''}Where you chose one of the listed picks as “My pick”, that pick and its price are used instead of the tier above. Prices are those seen on the "last checked" date on each item page, before tax and shipping.</p>
  ${optRows ? `<h2>Optional extras (not in the total)</h2><ul>${optRows}</ul>` : ''}
  ${haveRows ? `<h2>Already ticked as bought</h2><ul>${haveRows}</ul>` : ''}
  ${cab.length ? `<h2>Medicine cabinet (not in the total)</h2><p class="small">Medicines and tools from the <a href="#/medicine">family medicine cabinet</a>, for the ages in your setup. A store brand with the same drug, strength and form on its Drug Facts panel is the same medicine.</p><ul>${cab.map(c => `<li><b>${esc(medName(c.line))}</b>${medBrand(c.line) ? ` (${esc(medBrand(c.line))})` : ''}: ${c.qty} × ${esc((c.line.qty || {}).unit || 'pack')}${c.line.pack ? `; ${esc(c.line.pack)}` : ''}</li>`).join('')}</ul>` : ''}
  ${comm.length ? `<h2>Everyday items (any brand)</h2><p class="small">Brand makes no difference for these, so there are no tiers and they are not in the total.</p><ul>${comm.map(c => `<li><b>${esc(c.name)}</b>: ${esc(c.spec)}</li>`).join('')}</ul>` : ''}`;
};

V.scenario = (s) => {
  const key = SCEN[s] ? s : 'outage';
  const acts = D.actions.filter(a => visible(a) && (a.scenarios || []).includes(key));
  const general = D.actions.filter(a => visible(a) && (a.scenarios || []).includes('all')).length;
  return `<h1>By scenario</h1><p>The same actions as the sections, filtered to one kind of emergency.</p>
  <div class="chips" role="group" aria-label="Scenario">${Object.entries(SCEN).map(([k, v]) => `<a href="#/scenario/${k}" aria-current="${k === key}">${v}</a>`).join('')}</div>
  ${hhBanner()}<h2>${SCEN[key]}: ${acts.length} specific actions</h2><p class="small">Another ${general} general actions help in every scenario; find them in the sections.</p>
  ${SECS().map(sec => { const l = acts.filter(a => secOf(a) === sec); return l.length ? `<h3>${esc(sec.name)}</h3>${l.map(a => actionCard(a)).join('')}` : ''; }).join('')}`;
};

V.start = () => {
  const rows = D.start.map((s, i) => {
    const acts = s.ids.map(id => D.actionById[id]).filter(Boolean);
    return `<h3>${i + 1}. ${esc(s.title)}</h3>${acts.length ? acts.map(a => actionCard(a, { showLevel: true })).join('') : '<p class="small">Action not loaded yet.</p>'}`;
  }).join('');
  return `<h1>Start here: the 20 highest-value actions</h1><p class="lead">If you only do twenty things, do these, in this order. They are chosen for the most protection per hour and per dollar in an apartment.</p>${hhBanner()}${signInBanner()}${rows}`;
};

/* ---------- the side door ---------- */
V.sky = () => {
  const pg = P.skyPage(D, S.hh, S.hhSet, S.data); if (!pg) return V.home();
  const sky = pg.sky;
  const src = ids => { const l = (ids || []).filter(id => D.sources[id]); return l.length ? ` <span class="small noprint">Source${l.length > 1 ? 's' : ''}: ${l.map(id => ext(D.sources[id].url, D.sources[id].publisher)).join(', ')}.</span>` : ''; };
  const actLink = a => `<a href="#/action/${esc(a.id)}" title="${esc(a.title)}" aria-label="${esc(a.id)}, ${esc(a.title)}">${esc(a.id)}</a>`;
  const buy = b => `<a href="#/item/${esc(b.it.id)}">${esc(b.pick.brand)} ${esc(b.pick.model)}</a>${b.pick.price_usd != null ? `, about ${money(b.pick.price_usd)}` : ', no price seen'}`;
  const row = r => `<li class="skyline${r.done ? ' done' : ''}">${r.box ? `<input class="tick" type="checkbox" data-sky="${esc(r.l.id)}" ${r.done ? 'checked' : ''} aria-label="Mark done: ${esc(r.text)}">` : `<span class="nobox${r.l.ids && r.l.ids.length ? ' paper' : ''}" aria-hidden="true"></span>`}
    <div><span class="say">${esc(r.text)}</span>${src(r.l.cites)}
    ${r.acts.length || r.also.length ? `<span class="small how noprint">How: ${[...r.acts, ...r.also].map(actLink).join(', ')}</span>` : ''}
    ${r.buys.length ? `<span class="small buyline">One to buy: ${r.buys.map(buy).join('; ')}.</span>` : ''}</div></li>`;
  const no = d => `<li><b>${esc(d.l.text)}</b>${d.l.reason ? ` ${esc(d.l.reason)}` : ''}${d.l.own ? ' <span class="small">This site’s advice.</span>' : ''}${d.from ? ` <span class="small noprint">The rule and its sources: ${[d.from, d.also].filter(Boolean).map(actLink).join(', ')}.</span>` : src(d.l.cites)}</li>`;
  const sec = D.sectionByKey[sky.close.section];
  return `<div class="skypage"><p class="kicker">One evening, one store run</p><h1>${esc(sky.title)}</h1>
  <p class="lead">${esc(sky.open)}</p>
  ${S.hhSet ? hhLine() : '<p class="small noprint">Every line is shown. <a href="#/setup">Set up your household</a> and the lines that do not apply to you are hidden.</p>'}
  ${pg.parts.map(p => `<h2>${esc(p.title)}</h2>${p.sub ? `<p class="small">${esc(p.sub)}</p>` : ''}<ul class="sky">${p.rows.map(row).join('')}</ul>${p.id === 'store' ? '<p class="small">Each price is the one last seen for that pick; its page gives the date. There is no total: food, formula, diapers, pet food and gas have no pick to price.</p>' : ''}`).join('')}
  <h2>${esc(sky.dont.title)}</h2><ul class="sky dont">${pg.dont.map(no).join('')}</ul>
  ${D.library ? `<div class="aside signal noprint"><p><b>Print these first.</b> ${esc(D.library.sky_line || '')} <a href="#/library">The short shelf, with one zip</a>.</p></div>` : ''}
  <h2>${esc(sky.close.title)}</h2><p class="lead">${esc(sky.close.text)} ${sec ? `<a href="${secHref(sec)}">${esc(sky.close.link)}</a>` : esc(sky.close.link)}</p>
  <p class="noprint"><button class="btn sec" data-cmd="print">Print this page</button></p></div>`;
};

/* ---------- the library: official PDFs, a reference shelf ---------- */
const LIB_STATES = { IL: 'Illinois', MI: 'Michigan' };
const STATE_NAMES = { IL: 'Illinois', MI: 'Michigan', OR: 'Oregon', WA: 'Washington', CA: 'California', UT: 'Utah', NY: 'New York' };
const libDocs = () => (D.library ? D.library.documents : []);
const libFor = key => libDocs().filter(d => (d.sections || []).includes(key));
const mb = n => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}\u00a0MB` : `${Math.max(1, Math.round(n / 1e3))}\u00a0KB`);
// A document shows for a state filter if it is national or from that state; "other" is every state but Illinois and Michigan.
const libShows = (d, f) => !f || !(d.states || []).length || (f === 'other' ? d.states.some(s => !LIB_STATES[s]) : d.states.includes(f));
function libCard(d, { lead = false } = {}) {
  const st = (d.states || []).map(s => STATE_NAMES[s] || s);
  const facts = [d.publisher, d.year, `${d.pages}\u00a0page${d.pages === 1 ? '' : 's'}`, mb(d.file_size)].filter(Boolean).map(esc).join(' · ');
  const own = d.mirror ? `<a class="btn signal" href="${esc(d.mirror)}" download>Download PDF</a>` : '';
  return `<article class="libcard${lead ? ' lead' : ''}" id="lib-${esc(d.id)}">
    <p class="spine"><span>${esc(d.short_publisher || d.publisher)}</span>${st.length ? `<span>${esc(st.join(', '))}</span>` : ''}</p>
    <h3>${esc(d.title)}</h3>
    <p class="facts">${facts}${d.stale ? ' <span class="tag">Older edition</span>' : ''}</p>
    <p class="why">${esc(d.why)}</p>
    <p class="acts">${own}<a class="btn${d.mirror ? ' sec' : ''}" href="${safeUrl(d.original_url) || '#'}" target="_blank" rel="noopener noreferrer">From the publisher</a></p>
    <p class="checked">${d.mirror ? 'Our copy is the publisher’s file, unchanged. ' : 'Linked only: this site keeps copies of US government works and nothing else. '}Checked ${fmtDate(d.checked.date)}.</p>
  </article>`;
}
V.library = (f) => {
  const L = D.library; if (!L) return `<h1>The Library</h1><p>The library is not loaded yet.</p>`;
  const filter = ['IL', 'MI', 'other'].includes(f) ? f : '';
  const docs = L.documents, first = docs.filter(d => d.print_first), mirrored = docs.filter(d => d.mirror);
  const inZip = first.filter(d => d.mirror), notZip = first.filter(d => !d.mirror);
  const chip = (k, t) => `<a href="#/library${k ? '/' + k : ''}" aria-current="${filter === k}">${t}</a>`;
  const shelves = SECS().map(sec => {
    const list = docs.filter(d => (d.sections || [])[0] === sec.key && libShows(d, filter));
    return list.length ? `<section class="shelf" id="shelf-${sec.key}" aria-labelledby="sh-${sec.key}"><h2 id="sh-${sec.key}">${esc(sec.name)} <small class="count">${list.length}</small></h2>
      <p class="small">${esc((L.shelf_intro || {})[sec.key] || '')}</p><div class="libgrid">${list.map(d => libCard(d)).join('')}</div></section>` : '';
  }).join('');
  const books = (L.books || []).length ? `<section class="books" aria-labelledby="h-books"><h2 id="h-books">Books worth owning</h2><p class="small">${esc(L.books_intro || '')}</p>
    <ul>${L.books.map(b => `<li><b>${esc(b.title)}</b>, ${esc(b.author)} (${esc(b.publisher)}, ${esc(b.year)}). ${esc(b.why)} ${ext(b.buy_url, b.buy_label || 'Where to buy it')}</li>`).join('')}</ul></section>` : '';
  return `${FULL}<header class="opener libopen"><div class="in"><div class="text"><p class="kicker">Reference shelf</p><h1>The Library</h1>
    <p class="lead">${esc(L.intro)}</p>
    <p class="small">${docs.length} documents. ${mirrored.length} can be downloaded from this site, unchanged; the other ${docs.length - mirrored.length} open at the publisher. Every file was opened and checked on ${longDate(L.checked)}.</p></div></div></header>
  <section class="band printfirst" id="print-first" aria-labelledby="h-first"><div class="wrap">
    <p class="kicker">Before the power goes out</p><h2 id="h-first">Print these first</h2>
    <p class="read">${esc(L.print_first_intro)}</p>
    ${L.zip ? `<p><a class="btn signal" href="${esc(L.zip.file)}" download>Download ${inZip.length === first.length ? 'all' : 'these'} ${inZip.length} as one zip (${mb(L.zip.size)})</a></p>
    ${notZip.length ? `<p class="small">The zip holds the ${inZip.length} we may copy. ${notZip.length === 1 ? 'One more opens' : `${notZip.length} more open`} at the publisher: ${notZip.map(d => esc(d.title)).join('; ')}.</p>` : ''}` : ''}
    <div class="libgrid first">${first.map(d => libCard(d, { lead: true })).join('')}</div></div></section>
  <div class="wrap libshelves">
    <div class="libfilter noprint"><p class="small">Show state guides for</p><div class="chips" role="group" aria-label="State">${chip('', 'All')}${chip('IL', 'Illinois')}${chip('MI', 'Michigan')}${chip('other', 'Other states')}</div></div>
    ${shelves}
    ${books}
    <p class="small">${esc(L.how)}</p>
  </div>`;
};
// The small row at the end of each section page.
function fromLibrary(key) {
  const list = libFor(key); if (!list.length) return '';
  return `<aside class="fromlib noprint" aria-labelledby="fl-${key}"><h2 id="fl-${key}">From the library</h2><ul>${list.map(d => `<li><a href="#/library">${esc(d.title)}</a> <span class="small">${esc(d.short_publisher || d.publisher)}, ${esc(d.year)}${d.mirror ? ` · <a href="${esc(d.mirror)}" download>PDF</a>` : ''}</span></li>`).join('')}</ul></aside>`;
}

const modCount = acts => { let d = 0, t = 0; for (const a of acts) { if (ptrTarget(a) || a.more) continue; const u = unitsOf(a); t += u.length; d += P.unitsDone(S.data, a, u); } return `${d} of ${t}`; };
V.modules = () => `<h1>All modules</h1><p>A module's actions are spread over the sections; this page gathers them by subject.</p>
  ${D.modules.map(m => { const acts = D.actions.filter(a => a.module === m.code && visible(a)); return `<a class="boxed" href="#/module/${m.code}" style="display:block;text-decoration:none;color:inherit;margin:.5rem 0"><b>${esc(m.name)}</b>${twoHomes() ? ` <span class="pill home">${m.scope === 'home' ? 'Each home' : 'Household'}</span>` : ''}<br><span class="small">${modCount(acts)} done</span></a>`; }).join('')}`;

V.module = (code) => {
  const m = D.modules.find(x => x.code === code); if (!m) return V.modules();
  const acts = D.actions.filter(a => a.module === code && visible(a));
  const hidden = D.actions.filter(a => a.module === code && !visible(a));
  const its = D.items.filter(it => it.moduleCode === code && P.itemHomes(it, S.hh).length);
  return `<h1>${esc(m.name)}</h1><p class="lead">${esc(m.intro || '')}</p>${m.credit ? `<p class="small">${esc(m.credit)}. ${ext('https://www.oregon.gov/oem/hazardsprep/pages/2-weeks-ready.aspx', 'Oregon Department of Emergency Management')}.</p>` : ''}${hhBanner()}
  ${SECS().map(sec => { const l = acts.filter(a => secOf(a) === sec); return l.length ? `<h2>${esc(sec.name)}</h2>${l.map(a => actionCard(a)).join('')}` : ''; }).join('')}
  ${its.length ? `<h2>What to buy in this module</h2><ul>${its.map(it => `<li><a href="#/item/${esc(it.id)}">${esc(it.name)}</a> <span class="small">${esc((P.sectionOfItem(D, it) || { name: '' }).name)}</span></li>`).join('')}</ul>` : ''}
  ${hidden.length ? `<details><summary>${hidden.length} action${hidden.length > 1 ? 's' : ''} hidden for your household</summary><p class="small">These do not apply to the household you described. <a href="#/setup">Change your household setup</a> to see them.</p><ul>${hidden.map(a => `<li>${esc(a.id)} ${esc(a.title)}</li>`).join('')}</ul></details>` : ''}`;
};


/* ---------- worksheets ---------- */
function worksheetHtml(w) {
  const line = f => `<div class="field"></div><div class="flabel">${esc(f)}</div>`;
  let inner = '';
  for (const b of w.blocks) {
    if (b.heading) inner += `<h3>${esc(b.heading)}</h3>`;
    if (b.note) inner += `<p class="small">${esc(b.note)}</p>`;
    if (b.type === 'fields') inner += b.fields.map(line).join('');
    if (b.type === 'table') inner += `<table><thead><tr>${b.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: b.rows || 6 }, () => `<tr>${b.columns.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody></table>`;
    if (b.type === 'cards') inner += `<div class="walletcards">${Array.from({ length: b.copies || 2 }, () => `<div class="walletcard"><b>${esc(b.title || '')}</b>${b.fields.map(line).join('')}</div>`).join('')}</div>`;
    if (b.type === 'checklist') inner += `<table><tbody>${b.items.map(i => `<tr><td style="width:2rem"></td><td>${esc(i)}</td></tr>`).join('')}</tbody></table>`;
    if (b.type === 'text') inner += `<ul class="fixed">${(b.lines || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  return `<section class="ws" id="ws-${esc(w.id)}"><h2>${esc(w.title)}</h2><p>${esc(w.intro)}</p>${inner}<p class="small">Keep this page somewhere safe. It is not saved by the website.</p></section>`;
}
// Google Drive is the only place a filled-in worksheet can live. Signed out, or before Drive is switched
// on, the printable blank is all there is.
function driveBox(w) {
  const link = (S.data.files || {})[w.id];
  if (quiet()) return '<div class="note noprint">Print the blank below and fill it in by hand.</div>';
  if (!S.user) return `<div class="note noprint">Sign in to open this as a file in your own Google Drive. Without signing in, print the blank below and fill it in by hand.</div>`;
  if (isDriveLink(link)) return `<div class="have noprint"><b>Your copy is in your Google Drive</b>, in the folder “Household Plan”. <a class="btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open my copy in Google Drive</a><p class="small">This site keeps the link and nothing else. It cannot read what you write in the file. <button class="linkbtn" data-cmd="drive-forget" data-ws="${esc(w.id)}">Forget this link</button> (the file stays in your Drive).</p></div>`;
  if (!S.store.driveReady) return `<div class="note noprint">Google Drive is not switched on for this site yet${S.store.kind === 'local' ? ' (it needs Sign in with Google; this is the local test sign-in)' : ''}. Until it is, print the blank below and fill it in by hand.</div>`;
  return `<div class="note noprint"><button class="btn" data-cmd="drive" data-ws="${esc(w.id)}">Open in my Google Drive</button><p class="small">The first click creates a blank copy in a folder called “Household Plan” in your own Drive, and Google will ask you to allow this site to create and open its own files there. It cannot see anything else in your Drive. Later clicks reopen the same file.</p></div>`;
}
V.worksheets = () => `<h1>Worksheets</h1>
  <div class="note"><b>Where what you write is kept.</b> ${esc(quiet() ? D.worksheetsWhyPaper : D.worksheetsWhy)}</div>
  <div class="chips noprint"><button data-cmd="print">Print all blank worksheets</button></div>
  <ul class="noprint">${D.worksheets.map(w => `<li><a href="#/worksheet/${esc(w.id)}">${esc(w.title)}</a>${w.level != null ? ` <span class="pill">${esc(chainSec(w.level).name)}</span>` : ''}${w.plan ? ` <span class="pill">${esc((D.plan.find(s => s.section === w.plan) || { name: w.plan }).name)}</span>` : ''}${isDriveLink((S.data.files || {})[w.id]) ? ' <span class="doneon">in your Drive</span>' : ''}</li>`).join('')}</ul>
  <div class="printonly">${D.worksheets.map(worksheetHtml).join('')}</div>`;
V.worksheet = (id) => { const w = D.worksheets.find(x => x.id === id); if (!w) return V.worksheets(); return `<p class="small noprint"><a href="#/worksheets">All worksheets</a></p>${driveBox(w)}<div class="chips noprint"><button data-cmd="print">Print the blank</button></div>${worksheetHtml(w)}`; };

/* ---------- setup, privacy, account ---------- */
V.setup = () => {
  const h = S.hh, num = (k, label, min = 0, max = 99, val = h[k]) => `<div><label for="f-${k}">${label}</label><input id="f-${k}" name="${k}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${val}"></div>`;
  const sel = (k, label, f = k) => `<label for="f-${k}">${label}</label><select id="f-${k}" name="${k}">${Object.entries(H.HH_FIELDS[f]).map(([v, t]) => `<option value="${v}" ${String(h[k]) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const state = (k, label) => `<label for="f-${k}">${label}</label><select id="f-${k}" name="${k}"><option value="">Not chosen</option>${Object.entries(H.STATES).map(([v, t]) => `<option value="${v}" ${h[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  // Hazards are asked for each home. A hidden "answered" field tells an untouched question from "none".
  const hazards = (k, where) => `<fieldset class="inner"><legend>Hazards ${where}</legend>
      <p class="small">Tick any that happen where this home is. Actions for the ones you leave unticked are hidden. ${h[k] == null ? 'You have not answered this yet, so every hazard’s actions are shown.' : ''}</p>
      ${H.HAZARD_KEYS.map(z => `<label class="hometick"><input class="tick" type="checkbox" name="${k}" value="${z}" ${(h[k] || []).includes(z) ? 'checked' : ''}><span>${esc(H.HAZARDS[z])}</span></label>`).join('')}
      <label class="hometick"><input class="tick" type="checkbox" name="${k}_none" value="1" ${Array.isArray(h[k]) && !h[k].length ? 'checked' : ''}><span>None of these</span></label></fieldset>`;
  const kidsNow = h.children + h.infants;
  return `<h1>Household setup</h1><p>A few short answers. The site uses them to hide what does not apply to you, to work out quantities, and to show the right state’s forms. No names, no address, no dates of birth, and nothing about anyone’s health.</p>
  ${S.user ? '' : '<div class="note">You are not signed in, so these answers stay in this browser only. Sign in to keep them with your progress.</div>'}
  ${h.askAges ? `<div class="note" role="status">You told this site earlier that you have ${h.children} ${h.children > 1 ? 'children' : 'child'}. It now asks for an age band for each child, because bags, carriers, formula and diapers depend on age. Please put each child in a band below and save. Until then they are counted as 6 to 9.</div>` : ''}
  <form id="setupForm" class="boxed">
    <div class="row2">${num('adults', 'Adults (18 and over)', 1)}${num('pets', 'Pets')}</div>
    <fieldset><legend>Children, by age band</legend>
      <p class="small">How many children in each band. A teenager of 14 to 17 counts as an adult for bags, food, water and respirators.</p>
      <div class="row3">${H.BAND_KEYS.map(k => num('age_' + k, H.BANDS[k], 0, 20, h.askAges && k === 'a6_9' ? 0 : h.ages[k])).join('')}</div>
      <p class="small">Then three counts, out of all your children:</p>
      <div class="row3">${num('diapers', 'In diapers', 0, 20)}${num('formula', 'Babies fed formula', 0, 20)}${num('carried', 'Cannot walk a mile', 0, 20)}</div>
      ${num('feeds', 'Formula feeds in a normal day, for each formula-fed baby (the site assumes 8 if you leave it)', 1, 16)}
      <label for="f-formulaForm">Is the baby\u2019s own formula sold ready-to-feed?</label><select id="f-formulaForm" name="formulaForm"><option value="" ${h.formulaForm ? '' : 'selected'}>Not sure, or no baby on formula</option>${Object.entries(H.FORMULA_FORMS).map(([v, t2]) => `<option value="${v}" ${h.formulaForm === v ? 'selected' : ''}>${t2}</option>`).join('')}</select>
      <p class="small">Some formulas are sold only as powder. The bag list and the quantities follow this answer; the site never suggests changing a baby\u2019s formula.</p>
    </fieldset>
    <label for="f-car">Do you have a car?</label><select id="f-car" name="car"><option value="no" ${h.car ? '' : 'selected'}>No car</option><option value="yes" ${h.car ? 'selected' : ''}>Yes, we have a car</option></select>
    ${sel('targetDays', 'How many days do you want to be ready for at home?')}
    <p class="small">Choosing 3 days makes 72 hours at home your finish line and shows Two weeks at home as optional. Official guidance now aims for two weeks.</p>
    <fieldset><legend>Your home</legend>
      ${sel('home', 'Home type')}
      ${num('floor', 'Which floor do you live on? (0 for ground)')}
      ${sel('outdoor', 'Outdoor space')}
      ${sel('climate', 'Climate where you live')}
      ${state('state', 'State')}
      ${hazards('hazards', 'where this home is')}
    </fieldset>
    <label for="f-second">Do you have a second home?</label><select id="f-second" name="second"><option value="no" ${h.second ? '' : 'selected'}>No</option><option value="yes" ${h.second ? 'selected' : ''}>Yes</option></select>
    <fieldset id="home2set" ${h.second ? '' : 'hidden'}><legend>Your second home</legend>
      ${sel('home2', 'Home type', 'home')}
      ${num('floor2', 'Which floor? (0 for ground)')}
      ${sel('outdoor2', 'Outdoor space', 'outdoor')}
      ${sel('climate2', 'Climate there', 'climate')}
      ${state('state2', 'State')}
      ${hazards('hazards2', 'where the second home is')}
      <p class="small">Anything that depends on the building (water, heat, power, alarms, storage, exits) is then tracked once for each home. Everything about people, bags, documents, money and medical is tracked once. Turning this off later hides the second home’s ticks; it does not delete them.</p>
    </fieldset>
    <p class="small">The state decides which Legal and Medical forms you see. Illinois and Michigan are built in full; for any other state you see the general item and a pointer to that state’s own form. If your homes are in two states, both states’ items are shown.</p>
    <p class="small">The setup does not ask about age over 65, disability, medical devices or renting. Actions for those are shown to everyone, under one heading, so nothing about anyone’s health is stored.</p>
    <p><button class="btn" type="submit">Save household</button></p>
  </form>
  <h2>What the site does with these</h2><ul>${D.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
};

V.privacy = () => `<h1>Privacy, in plain words</h1>
  <h2>${quiet() ? 'What this site keeps, in your own browser' : 'What this site saves about you'}</h2>
  <ul><li><b>Your household setup:</b> numbers and choices only: how many adults and pets; how many children in each age band (under 1, 1 to 2, 3 to 5, 6 to 9, 10 to 13, 14 to 17), and how many of them are in diapers, fed formula, or cannot walk a mile; formula feeds in a day and whether the formula is sold ready-to-feed or only as powder; car or no car; target days; and for each home its type, floor, outdoor space, climate, state and which of six hazards happen there. An age band is not a date of birth, and the site asks for no names.</li>
  <li><b>What the setup does not ask:</b> anyone’s age over 65, disability, medical devices, medicines, or whether you rent. Actions for those are shown to everyone, so the site never has to store them.</li>
  <li><b>Which lines you have ticked as done, and the date.</b> For Legal, Money and Medical that tick and date are all that is kept.</li>
  <li><b>Which products you have ticked as bought, the amount the tick stands for (the bag, 72 hours or two weeks), and the date.</b> The lines of the family medicine cabinet are kept the same way: a tick and a date for a generic medicine or tool, never a dose, a name or who it is for.</li>
  <li><b>“My pick” for a product:</b> either which of the three listed picks you chose, or up to 80 characters you type yourself. This is the one place you can type, and it is for a product name only.</li>
  ${quiet() ? '' : '<li><b>A link to each worksheet file you opened in your own Google Drive.</b> Only the link.</li>'}</ul>
  <p>Two things are kept in this browser only and are not part of that record: the <b>look</b> you choose in the footer, and any <b>photo of your own</b> that you add to a product page. A photo never leaves the device you added it on, so it will not appear on your other devices.</p>
  <p>That is all. You can see the complete record on the <a href="#/account">${quiet() ? DATA_PAGE : 'Account'}</a> page.</p>
  <h2>What this site never holds</h2>
  <p>Your contacts, account numbers, policy numbers, medical details, the names of your doctors, your documents, your address, or anything you write on a worksheet. A site that kept a list of your emergency contacts, medicines and bank details would itself be a risk to you if it were ever breached. ${quiet() ? 'Those details belong on paper, in your own hands.' : 'Those details live only in your own Google Drive files, or on paper.'}</p>
  ${quiet() ? PQ.sheets() : `<h2>Worksheets and Google Drive</h2>
  <p>A worksheet is a blank form. Signed in, you can open it as a file in your own Google Drive: the first click creates a blank copy in a folder called “Household Plan”, and later clicks reopen it. For that, Google asks you to grant this site one permission, the narrowest Drive permission there is (called <code>drive.file</code>): the site may create files and open the files it created. It cannot see, list or open anything else in your Drive. The site saves the link to each file and never reads what is inside. Google Drive is the only place a filled-in worksheet can be kept; there is no upload box and no other storage. Not signed in, you can print the blank and fill it in by hand.</p>
  <h2>Signing in</h2>
  ${S.store.kind === 'local' ? '<p><b>Right now the site is in local test mode.</b> The "Test sign-in" button creates a pretend user in this browser. Nothing leaves this device, and Google Drive is not available.</p>' : ''}
  <p>Sign in with Google is used to know that you are you, so your progress can follow you between devices. At sign-in the site asks Google only for your basic identity (name, email address, profile picture). It asks for <b>no</b> access to Gmail, Calendar or Contacts, ever. Drive is asked for separately, only when you first open a worksheet in Drive, and only as described above. Your name is shown in the corner of the page. Your email address is held by the sign-in service as part of your account and is not copied into the progress record, used for mail, or shared.</p>
`}
  <h2>Export and download</h2><p>“Export” makes a file on your own device with your setup, ticks, dates, picks and purchases. “Download the whole plan” makes a file with the plan and nobody’s progress. Both are created in your browser; nothing is sent anywhere.</p>
  ${quiet() ? PQ.kept() : `<h2>Without signing in</h2><p>You can read everything. If you fill in the household setup while signed out, it is kept in this browser only, so the quantities are right for you. Progress is not saved until you sign in.</p>
  <h2>Where it is kept</h2><p>${S.store.kind === 'local' ? 'In local test mode: in this browser’s storage on this device.' : 'In Google Firebase (Cloud Firestore), in one small record per user that only that signed-in user can read or change.'} There are no advertising or analytics trackers and no affiliate links. The fonts and pictures are stored with the site: nothing is loaded from a font service or a picture library. The only outside script is the sign-in service itself.</p>
  <h2>Deleting your account and data</h2><p>Go to <a href="#/account">Account</a> and choose “Delete my account and data”. This removes your progress record and your sign-in account at once. It cannot be undone. Files in your Google Drive are yours and are not touched; delete them in Drive if you want them gone.</p>
`}
  <h2>Links to shops and manufacturers</h2><p>Product pages link to manufacturers and retailers. Those sites have their own privacy practices. The links carry no affiliate or tracking tags.</p>`;

V.account = () => {
  const stored = S.user ? JSON.stringify(S.data, null, 2) : '';
  if (quiet()) return `<h1>${DATA_PAGE}</h1>${S.msg ? `<div class="warn" role="status">${esc(S.msg)}</div>` : ''}
    <p>This site has no accounts. What you set up and tick is kept in this browser, on this device, and nowhere else.</p>
    <h2>Everything saved here</h2><p class="small">This is the complete record. “Export” at the foot of every page gives you the same progress in a readable file.</p><pre class="boxed" style="overflow:auto;font-size:.8rem">${esc(stored)}</pre>
    <h2>Delete everything saved here</h2><p>This removes the record above, and any photos you added, from this browser. It cannot be undone.</p>
    ${S.confirmDelete ? `<div class="warn" role="alertdialog" aria-label="Confirm deletion"><p><b>Delete everything?</b> Your household setup, every tick and every pick will be removed from this browser. This cannot be undone.</p><p><button class="btn danger" data-cmd="delete-yes">Yes, delete everything</button> <button class="btn sec" data-cmd="delete-no">Cancel</button></p></div>` : `<p><button class="btn danger" data-cmd="delete">Delete everything saved here</button></p>`}`;
  return `<h1>Account</h1>${S.msg ? `<div class="warn" role="status">${esc(S.msg)}</div>` : ''}
  ${S.user ? `<p>Signed in as <b>${esc(S.user.name)}</b>${S.store.kind === 'local' ? ' (local test user; data stays in this browser)' : ''}.</p>
    <p><button class="btn sec" data-cmd="signout">Sign out</button></p>
    <h2>Everything saved about you</h2><p class="small">This is the complete record. Nothing else is stored. “Export” at the foot of every page gives you the same progress in a readable file.</p><pre class="boxed" style="overflow:auto;font-size:.8rem">${esc(stored)}</pre>
    <h2>Delete my account and data</h2><p>This removes the record above and your sign-in account. It cannot be undone. Worksheet files in your own Google Drive are not touched.</p>
    ${S.confirmDelete ? `<div class="warn" role="alertdialog" aria-label="Confirm deletion"><p><b>Delete everything?</b> Your household setup, every tick, every pick and your sign-in account will be removed. This cannot be undone.</p><p><button class="btn danger" data-cmd="delete-yes">Yes, delete everything</button> <button class="btn sec" data-cmd="delete-no">Cancel</button></p></div>` : `<p><button class="btn danger" data-cmd="delete">Delete my account and data</button></p>`}`
    : `<p>You are not signed in. You can read everything; sign in to save progress.</p><p><button class="btn" data-cmd="signin">${signInLabel()}</button></p>
    ${S.store.kind === 'local' ? '<p class="small">The site is in local test mode. Sign in with Google is built and waiting to be switched on.</p>' : '<p class="small">Sign-in asks for your identity only. Google Drive is asked for separately, and only if you open a worksheet there.</p>'}`}`;
};

V.about = () => {
  const src = Object.values(D.sources);
  return `<h1>How we choose, and sources</h1>
  <h2>Where the plan comes from</h2>
  <p>The spine is ${ext('https://www.oregon.gov/oem/hazardsprep/pages/2-weeks-ready.aspx', 'Be 2 Weeks Ready')}, a toolkit published by the Oregon Department of Emergency Management in 2024. Its eight units and all 389 of its actions are kept here, with their original numbers (U1-01 to U8-13), rewritten in new words. Actions tied to Oregon or to earthquake country are labelled and shown with a general equivalent.</p>
  <p>The toolkit was written mostly for houses. Actions whose IDs start with X or with two letters (PL, HC, AR, BG, HR, NB, MD, CM, FN) were added for apartments and high-rises, drawing on official guides from FEMA, the CDC, the EPA, the NFPA, the Red Cross, the American Academy of Pediatrics, PreparedBC, Tokyo, Singapore and others.</p>
  <p>The Legal, Money and Medical checklists (IDs starting LG, MN and ME) are drawn only from official sources: federal agencies, state attorneys general, state courts and legislatures, state health departments and state bars. They are checklists of what to get done, not legal, financial or medical advice. Illinois and Michigan have their own state items; other states see the general item.</p>
  <h2 id="how-we-choose">How we choose</h2>
  <ul><li>Every pick was researched on the web on the "last checked" date shown on its page. Nothing is recommended from memory.</li>
  <li>Every pick needs at least two independent sources: an established test publication, the manufacturer's specification, or a recognized listing (NSF/ANSI, NIOSH, UL or ETL, EPA).</li>
  <li>Links were opened to confirm they reach the right product. Where a link could not be confirmed, the page says so.</li>
  <li>No affiliate tags. Nobody paid to be listed.</li><li>We name other testers\u2019 picks so readers can compare; we are not affiliated with any of them, and their names belong to their owners.</li><li>No product is ruled out before it is compared: not for its size, the batteries it takes, its price, its brand, or whether it was in stock that day. Each pick states its cost, size, weight and batteries, and the weighing is yours.</li><li>Standard is the best for most households. Budget is the cheapest that genuinely works. Cadillac is the best there is, where more money buys real capability. Compact, where an item has one, is the best small one, for a small home, a bag or many flights of stairs.</li><li>A pick that is sold out stays, with a warning and the product to buy in its place.</li><li>Where no trustworthy product exists at a tier, the tier is left empty with the reason.</li></ul>
  <h2>Product data files</h2><ul>${D.productFiles.map(f => `<li>${esc(f.path)}: ${f.count} items, last checked ${fmtDate(f.checked)}</li>`).join('')}</ul>
  ${D.missing.length ? `<div class="warn"><b>Data not loaded:</b> ${D.missing.map(esc).join(', ')}</div>` : ''}
  <h2>Assumptions behind the quantities</h2><ul>${D.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
  <h2>Official sources cited (${src.length}), last checked ${D.sourcesChecked ? fmtDate(D.sourcesChecked) : 'n/a'}</h2>
  <ul class="cites">${src.map(s => `<li>${esc(s.publisher)}: ${ext(s.url, s.title || s.url)}${s.ok === false ? ' <span class="unver">(could not be verified)</span>' : ''}</li>`).join('')}</ul>
  <h2>Pictures</h2><p>Opening photographs come only from sources whose license plainly allows free reuse; each is listed with its author and license on the <a href="#/credits">Picture credits</a> page. Drawings and icons were drawn for this site. No product picture comes from a manufacturer, shop or review site.</p>
  <h2>Limits</h2><p>This is general information for the public, not medical, legal or engineering advice for your situation. In an emergency, follow the instructions of your local authorities and your building.</p>`;
};

/* ---------- router ---------- */
function parse() { const h = location.hash.replace(/^#\/?/, ''); return h ? h.split('/').map(decodeURIComponent) : ['home']; }
function render(keepScroll) {
  const r = parse();
  const view = V[r[0]] || V.home;
  const y = window.scrollY;
  renderChrome(r);
  let html;
  try { html = view(r[1], r[2]); } catch (e) { console.error(e); html = `<h1>Something went wrong</h1><p>${esc(e.message)}</p>`; }
  const status = S.msg && r[0] !== 'account' ? `<div class="status" role="status">${esc(S.msg)}</div>` : '';
  // A view either lays out its own full-width sections, or is set in one reading column.
  $('#main').innerHTML = html.startsWith(FULL) ? status + html : `<div class="wrap page">${status}${html}</div>`;
  S.msg = '';
  if (keepScroll) window.scrollTo(0, y); else { window.scrollTo(0, 0); }
  const h1 = $('#main h1') ? $('#main h1').textContent.trim() : '';
  document.title = (h1 && h1 !== config.siteName ? h1 + ' · ' : '') + config.siteName;
  Photos.hydrate(S.user && S.user.uid, $('#main'));
}
function download(name, body) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// The sign-in prompt appears only when someone who is not signed in tries to tick something.
function askToSignIn(from) {
  S.prompt = true; S.promptFrom = from || null; renderChrome(parse());
  const b = $('#prompt button'); if (b) b.focus();
}
function closePrompt() {
  if (!S.prompt) return;
  S.prompt = false; renderChrome(parse());
  const back = S.promptFrom && document.querySelector(S.promptFrom); if (back) back.focus();
}

/* ---------- events ---------- */
async function onChange(e) {
  const t = e.target;
  if (t.id === 'f-second') { const f = $('#home2set'); if (f) f.toggleAttribute('hidden', t.value !== 'yes'); return; }
  if (t.matches('input[type=file][data-photo-input]')) {
    const f = t.files && t.files[0]; if (!f || !S.user) return;
    try { await Photos.setPhoto(S.user.uid, t.dataset.photoInput, f); S.msg = 'Your photo is saved on this device.'; }
    catch (err) { console.error(err); S.msg = 'That file could not be used as a photo.'; }
    render(true); return;
  }
  if (t.matches('input.tick[data-sky]')) {
    // A line on the side door has no box of its own: its tick sets or clears the boxes of the actions it points at.
    if (!S.user) { t.checked = !t.checked; askToSignIn(`input.tick[data-sky="${t.dataset.sky}"]`); return; }
    P.skyTick(D, S.hh, S.hhSet, S.data, t.dataset.sky, t.checked, today());
    await persist(); render(true); return;
  }
  if (t.matches('input.tick[data-action]')) {
    if (!S.user) { t.checked = !t.checked; askToSignIn(`input.tick[data-action="${t.dataset.action}"][data-home="${t.dataset.home}"]`); return; }
    const id = t.dataset.action, map = P.doneMap(S.data, +t.dataset.home || 0);
    if (t.checked) map[id] = today(); else delete map[id];
    await persist(); render(true);
  } else if (t.matches('input.own[data-item]')) {
    if (!S.user) { t.checked = !t.checked; askToSignIn(`input.own[data-item="${t.dataset.item}"][data-level="${t.dataset.level}"][data-home="${t.dataset.home}"]`); return; }
    const id = t.dataset.item, L = +t.dataset.level, it = D.itemById[id], map = P.ownedMap(S.data, +t.dataset.home || 0);
    if (t.checked) map[id] = { level: L, date: today() };
    else if (it && L - 1 >= it.level) map[id] = { level: L - 1, date: (map[id] && map[id].date) || today() };
    else delete map[id];
    await persist(); render(true);
  }
}
async function onClick(e) {
  const j = e.target.closest('[data-jump]');
  if (j) { const el = document.getElementById(j.dataset.jump); if (el) { e.preventDefault(); el.scrollIntoView({ block: 'start' }); const h = el.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } } return; }
  const acc = e.target.closest('details[data-access] > summary');
  if (acc && !S.accessOpen) { S.accessOpen = true; setTimeout(() => render(true), 0); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) { const id = tg.dataset.toggle, body = tg.closest('.action').querySelector('.body'); const open = body.hasAttribute('hidden'); body.toggleAttribute('hidden', !open); tg.setAttribute('aria-expanded', open); open ? S.open.add(id) : S.open.delete(id); if (open) Photos.hydrate(S.user && S.user.uid, body); return; }
  const c = e.target.closest('[data-cmd]'); if (!c) return;
  const cmd = c.dataset.cmd; S.msg = '';
  if (cmd === 'signin') { S.prompt = false; try { await S.store.signIn(); } catch (err) { console.error(err); S.msg = 'Sign-in did not complete. Please try again.'; render(true); } }
  else if (cmd === 'signout') { await S.store.signOut(); }
  else if (cmd === 'prompt-close') { closePrompt(); }
  else if (cmd === 'look') { setLook(c.dataset.pick); renderChrome(parse()); const b = document.querySelector(`[data-cmd=look][data-pick="${c.dataset.pick}"]`); if (b) b.focus(); }
  else if (cmd === 'print') { window.print(); }
  else if (cmd === 'tier') { S.tier = c.dataset.tier; render(true); }
  else if (cmd === 'hidedone') { S.hideDone = !S.hideDone; render(true); }
  else if (cmd === 'export') { if (!S.user) return; download(`household-plan-export_${today()}.md`, X.exportMarkdown(D, S.hh, S.hhSet, S.data, S.tier).text); }
  else if (cmd === 'plan-download') { download(`household-plan_${today()}.md`, X.planMarkdown(D, S.hh, S.hhSet, S.tier).text); }
  else if (cmd === 'mypick') { if (!S.user) return; S.data.picks[c.dataset.item] = { tier: c.dataset.tier }; await persist(); render(true); }
  else if (cmd === 'mypick-clear') { if (!S.user) return; delete S.data.picks[c.dataset.item]; await persist(); render(true); }
  else if (cmd === 'photo-add') { const inp = document.querySelector(`input[data-photo-input="${c.dataset.item}"]`); if (inp) inp.click(); }
  else if (cmd === 'photo-remove') { if (!S.user) return; try { await Photos.removePhoto(S.user.uid, c.dataset.item); S.msg = 'Your photo was removed from this device.'; } catch (err) { console.error(err); } render(true); }
  else if (cmd === 'drive') {
    const w = D.worksheets.find(x => x.id === c.dataset.ws); if (!w || !S.user || !S.store.driveReady) return;
    c.disabled = true; c.textContent = 'Creating your copy…';
    try { const link = await createWorksheetFile(await S.store.driveToken(), w); S.data.files[w.id] = link; await persist(); S.msg = 'Your copy is ready in your Google Drive. Use the button below to open it.'; }
    catch (err) { console.error(err); S.msg = 'Google Drive did not create the file. Nothing was saved. Please try again.'; }
    render(true);
  }
  else if (cmd === 'drive-forget') { if (!S.user) return; delete S.data.files[c.dataset.ws]; await persist(); render(true); }
  else if (cmd === 'delete') { S.confirmDelete = true; render(true); }
  else if (cmd === 'delete-no') { S.confirmDelete = false; render(true); }
  else if (cmd === 'delete-yes') {
    S.confirmDelete = false;
    const uid = S.user && S.user.uid;
    try { if (uid) { try { await Photos.clearPhotos(uid); } catch (err) { console.error(err); } } await S.store.deleteAccount(); deviceHousehold.clear(); S.msg = quiet() ? 'Everything saved in this browser has been deleted, with any photos you added.' : 'Your account and data have been deleted, with any photos you stored on this device.'; }
    catch (err) { console.error(err); S.msg = 'Could not delete the account. Sign in again and retry.'; }
    render();
  }
}
async function onSubmit(e) {
  if (e.target.id === 'pickForm') {
    e.preventDefault(); if (!S.user) return;
    const id = e.target.dataset.item, v = String(new FormData(e.target).get('text') || '').trim().slice(0, 80);
    if (v) S.data.picks[id] = { text: v }; else delete S.data.picks[id];
    await persist(); render(true); return;
  }
  if (e.target.id !== 'setupForm') return;
  e.preventDefault();
  const f = new FormData(e.target), h = {};
  for (const k of ['adults', 'pets', 'floor', 'home', 'outdoor', 'climate', 'targetDays', 'state', 'home2', 'floor2', 'outdoor2', 'climate2', 'state2', 'diapers', 'formula', 'formulaForm', 'carried', 'feeds']) h[k] = f.get(k);
  h.car = f.get('car') === 'yes'; h.second = f.get('second') === 'yes';
  h.ages = {}; for (const k of H.BAND_KEYS) h.ages[k] = f.get('age_' + k);
  // Hazards: a ticked list, "None of these", or untouched (still unanswered, so nothing is hidden).
  for (const k of ['hazards', 'hazards2']) { const v = f.getAll(k); h[k] = v.length ? v : (f.get(k + '_none') ? [] : null); }
  const clean = H.normalise(h); delete clean.askAges;
  if (S.user) { S.data.household = clean; await persist(); } else deviceHousehold.set(clean);
  refreshHousehold(); S.msg = 'Household saved.';
  if (location.hash === '#/') render(); else location.hash = '#/';
}

async function onAuth(user) {
  S.user = user; S.prompt = false;
  if (user) {
    try { S.data = { ...P.emptyData(), ...((await S.store.load()) || {}) }; } catch (e) { console.error(e); S.data = P.emptyData(); S.msg = 'Could not load your saved progress.'; }
    const dev = deviceHousehold.get();
    if (!S.data.household && dev) { S.data.household = H.normalise(dev); await persist(); }
  } else S.data = P.emptyData();
  refreshHousehold();
  if (D.modules.length) render(true);
}

async function boot() {
  try {
    S.store = await createStore();
    D.noSignIn = !!S.store.quiet;
    await loadAll();
  } catch (e) { console.error(e); $('#main').innerHTML = `<div class="wrap page"><h1>The site could not start</h1><p>${esc(e.message)}</p></div>`; return; }
  refreshHousehold();
  document.addEventListener('change', onChange);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePrompt(); });
  $('#main').addEventListener('submit', onSubmit);
  $('#menuBtn').addEventListener('click', () => { const m = $('#more'); const open = m.hasAttribute('hidden'); m.toggleAttribute('hidden', !open); $('#menuBtn').setAttribute('aria-expanded', open); });
  $('#more').addEventListener('click', () => { $('#more').setAttribute('hidden', ''); $('#menuBtn').setAttribute('aria-expanded', 'false'); });
  window.addEventListener('hashchange', () => { S.prompt = false; render(); });
  // Read-only hook so the check scripts can compare the two downloads with what is on screen.
  window.cityready = { exportMarkdown: () => X.exportMarkdown(D, S.hh, S.hhSet, S.data, S.tier), planMarkdown: () => X.planMarkdown(D, S.hh, S.hhSet, S.tier), totals: () => ({ actions: D.actions.length, items: D.items.length, checks: Object.keys(D.checkById).length, pictures: Object.keys(D.pictures).length }) };
  S.store.onAuth(onAuth);
  render();
}
boot();
