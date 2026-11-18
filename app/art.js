// Drawn by hand as SVG, in one line style: a 1.6 weight round-capped line in the ink colour, with the
// signal colour used for the one thing to notice. No picture here comes from anywhere else.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (box, inner, cls = '', label = '') => `<svg class="${cls}" viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"'}>${inner}</svg>`;

/* ---------- category icons (24 x 24) ---------- */
const I = {
  water: '<path d="M12 3c3.5 4.2 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 8.5 7.2 12 3z"/><path d="M9.3 14.2a2.8 2.8 0 0 0 2.2 2.6"/>',
  food: '<path d="M7 6.5c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5v11c0 1.4-2.2 2.5-5 2.5s-5-1.1-5-2.5z"/><path d="M7 6.5C7 7.9 9.2 9 12 9s5-1.1 5-2.5M7 12.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5"/>',
  sanitation: '<path d="M5 9h14l-1.4 10.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M5.5 9a6.5 5 0 0 1 13 0"/><path d="M4 9h16"/>',
  power: '<rect x="3" y="8.5" width="16" height="7" rx="1.2"/><path d="M21 11v2"/><path d="M11.8 9.8 9.6 12.3h3l-2.2 2.5"/>',
  light: '<path d="M9.5 17.5h5M10.5 20.5h3"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v1h5v-1c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>',
  heat: '<path d="M10 13.6V5a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0z"/><path d="M12 9.5v6.3"/><circle cx="12" cy="17" r="1.2"/>',
  air: '<path d="M3 9h10.5A2.5 2.5 0 1 0 11 6.5"/><path d="M3 13h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/>',
  firstaid: '<rect x="3" y="8" width="18" height="11.5" rx="1.5"/><path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8"/><path d="M12 11v5.5M9.3 13.75h5.4"/>',
  building: '<path d="M6 21V4h9v17M15 9h4v12M3 21h18"/><path d="M9 7.5h3M9 11h3M9 14.5h3M10 21v-3h1.5v3"/>',
  shelter: '<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
  plan: '<path d="M8.5 5H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2"/><rect x="9" y="3.5" width="6" height="3" rx=".8"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  money: '<rect x="3" y="7" width="18" height="10" rx="1.2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.2 9.8v.01M17.8 14.2v.01"/>',
  documents: '<path d="M3 7.2A1.2 1.2 0 0 1 4.2 6h4.6l2 2.2h9A1.2 1.2 0 0 1 21 9.4v8.4a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 17.8z"/>',
  comms: '<rect x="3" y="9" width="18" height="11" rx="1.4"/><path d="M7 9 17.5 4"/><circle cx="8" cy="14.5" r="2.2"/><path d="M13.5 13h4.5M13.5 16h4.5"/>',
  family: '<circle cx="8" cy="8" r="3"/><path d="M2.5 20c0-3.3 2.5-5.6 5.5-5.6s5.5 2.3 5.5 5.6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.4 15c3.3-.7 6.1 1.5 6.1 5"/>',
  child: '<circle cx="12" cy="7" r="3"/><path d="M7 20v-3.5a5 5 0 0 1 10 0V20"/><path d="M10 20v-2.5M14 20v-2.5"/>',
  infant: '<path d="M10 3h4v3l1.5 2v11a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 19V8L10 6z"/><path d="M8.5 12h7M8.5 16h3"/>',
  pet: '<path d="M12 20c-3 0-5-1.4-5-3.4 0-2.2 2.4-4.6 5-4.6s5 2.4 5 4.6c0 2-2 3.4-5 3.4z"/><ellipse cx="6.3" cy="11" rx="1.5" ry="2"/><ellipse cx="17.7" cy="11" rx="1.5" ry="2"/><ellipse cx="9.6" cy="6.6" rx="1.4" ry="2"/><ellipse cx="14.4" cy="6.6" rx="1.4" ry="2"/>',
  neighbours: '<path d="M4 21V5h6v16M14 21V5h6v16M3 21h18"/><path d="M8 13v.01M18 13v.01"/>',
  alerts: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  prepare: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13.5 13.5 8.4 15.6l2.1-5.1z"/>',
  bag: '<path d="M7 9a5 5 0 0 1 10 0v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19z"/><path d="M9.5 5.4V4.5a2.5 2.5 0 0 1 5 0v.9"/><rect x="9.5" y="13.5" width="5" height="3.8" rx=".7"/><path d="M7 12H5.6v5H7M17 12h1.4v5H17"/>',
  car: '<path d="M4 16v-3l2-5h12l2 5v3"/><path d="M3 16h18v2.2H3z"/><circle cx="7.5" cy="18.4" r="1.6"/><circle cx="16.5" cy="18.4" r="1.6"/><path d="M6.2 12.5h11.6"/>',
  legal: '<path d="M12 4v16M7.5 20h9M5 7h14"/><path d="M5 7l-2.4 6a2.5 2.5 0 0 0 4.8 0z"/><path d="M19 7l-2.4 6a2.5 2.5 0 0 0 4.8 0z"/>',
  medical: '<g transform="rotate(-38 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>',
  tonight: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  tool: '<path d="M14.5 5.5a3.8 3.8 0 0 0-4.9 4.9L4 16l2 2 5.6-5.6a3.8 3.8 0 0 0 4.9-4.9l-2.4 2.4-2-2z"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'
};
export const MODULE_ICON = { bg: 'bag', u4: 'water', u3: 'food', u5: 'sanitation', pl: 'power', hc: 'heat', ar: 'air', u7: 'firstaid', hr: 'building', u6: 'shelter', u2: 'plan', md: 'documents', cm: 'comms', fn: 'family', nb: 'neighbours', u8: 'alerts', u1: 'prepare', legal: 'legal', money: 'money', medical: 'medical' };
export const icon = (name, cls = 'icon') => svg('0 0 24 24', I[name] || I.box, cls);
// A product item's category icon: by what the thing is, falling back to its module.
export function itemIcon(item) {
  const id = item.id;
  const by = [[/^car-/, 'car'], [/^pet-/, 'pet'], [/^(baby|infant|diaper)/, 'infant'], [/^child-/, 'child'], [/first-aid|tourniquet/, 'firstaid'], [/headlamp|flashlight|lantern|night-light|keychain-light/, 'light'],
    [/^water-|bottle/, 'water'], [/toilet|waste|trash|wipes|sanitizer|disinfect|laundry|handwash|menstrual|gloves-disposable/, 'sanitation'], [/power|solar|batter|usb|inverter/, 'power'], [/radio/, 'comms'],
    [/alarm|extinguisher/, 'alerts'], [/respirator|purifier|fan-filter|sheeting/, 'air'], [/sleeping|blanket|window-insulation|thermometer|battery-fan|bivvy|shell|socks/, 'heat'], [/food|cooler|kettle|can-opener|storage-bins/, 'food'],
    [/document|usb-drive/, 'documents'], [/^bag-|pouch/, 'bag'], [/tool|whistle|compass|eye-protection|work-gloves|stair-chair/, 'tool']];
  for (const [re, k] of by) if (re.test(id)) return k;
  return MODULE_ICON[item.moduleCode] || 'box';
}

/* ---------- the two bags ---------- */
const backpack = '<path class="surf-f" d="M22 46a38 38 0 0 1 76 0v70a12 12 0 0 1-12 12H34a12 12 0 0 1-12-12z"/><path d="M42 14V11a18 18 0 0 1 36 0v3"/><path d="M22 66h76"/><rect class="tint-f" x="38" y="78" width="44" height="32" rx="5"/><path d="M38 88h44"/><path d="M22 60H13v36h9M98 60h9v36h-9"/><path d="M60 22v20"/>';
const door = '<path d="M112 128V8h46v120M104 128h62"/><circle class="acc-f" cx="121" cy="72" r="2.6" stroke="none"/>';
export function grabBag({ grab, addons = [] }) {
  return `<figure class="art"><div class="layers">
    <div class="l big">${svg('0 0 170 132', backpack + door, '', 'A backpack standing by a door')}<b>${esc(grab)} lb</b><span>The grab bag.<br>Packed, by the door, one for each adult and teenager.</span></div>
  </div>${addons.length ? `<ul class="addons" aria-label="Add-ons on top">${addons.map(a => `<li>${icon(a.icon)}${esc(a.name)}</li>`).join('')}</ul>` : ''}
  <figcaption>The weight is for the listed picks, contents only; yours will differ. The add-ons go on top when they apply to you.</figcaption></figure>`;
}

// Where things go in the grab bag: heavy against the back, things you need fast on top.
export function packingOrder() {
  const inner = `<path class="surf-f" d="M40 70a70 70 0 0 1 140 0v170a22 22 0 0 1-22 22H62a22 22 0 0 1-22-22z"/>
    <path d="M80 26v-6a30 30 0 0 1 60 0v6"/><path d="M40 196h140M40 120h140" stroke-dasharray="3 6"/>
    <path d="M180 132h30a8 8 0 0 1 8 8v64a8 8 0 0 1-8 8h-30"/><path d="M40 110H22v70h18"/>
    <path class="tint-f" d="M150 122h28v72h-28z" stroke-dasharray="3 5"/>
    <g stroke="none"><circle class="acc-f" cx="110" cy="230" r="15"/><circle class="acc-f" cx="96" cy="158" r="15"/><circle class="acc-f" cx="110" cy="82" r="15"/><circle class="acc-f" cx="199" cy="172" r="15"/></g>
    <g stroke="none" text-anchor="middle" style="font-weight:700;font-size:18px"><text x="110" y="236" style="fill:var(--signal-ink)">1</text><text x="96" y="164" style="fill:var(--signal-ink)">2</text><text x="110" y="88" style="fill:var(--signal-ink)">3</text><text x="199" y="178" style="fill:var(--signal-ink)">4</text></g>`;
  return `<figure class="art" style="max-width:15rem">${svg('0 0 240 280', inner, '', 'A backpack seen from the side, divided into four numbered zones')}
    <ol class="legend"><li>Bottom: soft, light things you need last.</li><li>Middle, against your back: the heavy things.</li><li>Top: things you may need fast.</li><li>Outside pockets: small things you reach for while walking.</li></ol></figure>`;
}

/* ---------- water: one jug is one gallon ---------- */
const jug = '<path d="M6.5 6V3.5h5V6l3 3.2V20a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20V9.2z"/><path d="M3.5 13h11"/>';
export function waterAmounts({ rows, per }) {
  const grid = n => { const step = n > 84 ? 5 : 1, k = Math.ceil(n / step); return `<div class="grid" role="img" aria-label="${n} gallons">${Array.from({ length: k }, () => svg('0 0 18 24', jug)).join('')}</div>${step > 1 ? '<small>Each jug here is 5 gallons.</small>' : ''}`; };
  return `<figure class="art"><div class="jugs">${rows.map(r => `<div class="rowj"><div><b>${r.gallons} gallons</b><br><span class="small">${esc(r.label)}</span></div><div>${grid(r.gallons)}</div></div>`).join('')}</div>
    <figcaption>${esc(per)} One jug is one US gallon, about 8.3 lb.</figcaption></figure>`;
}

/* ---------- where things live in an apartment ---------- */
export function apartmentMap(legend) {
  const m = (x, y, n) => `<circle class="acc-f" cx="${x}" cy="${y}" r="15" stroke="none"/><text x="${x}" y="${y + 6}" text-anchor="middle" stroke="none" style="font-weight:700;font-size:17px;fill:var(--signal-ink)">${n}</text>`;
  const inner = `<rect class="surf-f" x="10" y="10" width="620" height="380" rx="3" stroke-width="2.4"/>
    <path d="M10 150h150M210 150h110M320 10v140M320 150v70M320 270v120M470 230h160M470 230v160M470 290h0" stroke-width="2.4"/>
    <path d="M160 150v-60M160 40V10" stroke-width="2.4"/>
    <path d="M60 10v0" /><path class="acc-s" d="M70 10h56" stroke-width="5"/><path d="M70 10a56 56 0 0 0 56 56" stroke-dasharray="3 6"/>
    <rect class="tint-f" x="170" y="20" width="140" height="34" rx="3"/><path d="M196 20v34M222 20v34"/><circle cx="270" cy="37" r="9"/>
    <rect class="tint-f" x="24" y="76" width="120" height="60" rx="3"/><path d="M36 76v60"/>
    <rect class="tint-f" x="350" y="30" width="150" height="100" rx="4"/><rect x="360" y="40" width="54" height="34" rx="4"/><rect x="424" y="40" width="54" height="34" rx="4"/>
    <rect class="tint-f" x="40" y="300" width="170" height="64" rx="8"/><path d="M40 322h170M96 322v42M154 322v42"/><rect x="70" y="210" width="96" height="56" rx="3"/>
    <rect class="tint-f" x="490" y="250" width="56" height="120" rx="20"/><circle cx="596" cy="270" r="13"/><rect x="578" y="330" width="38" height="46" rx="8"/>
    <rect x="560" y="26" width="56" height="80" rx="2"/><path d="M574 40h28M574 54h28M574 68h28"/>
    <g>${m(98, 40, 1)}${m(84, 106, 2)}${m(526, 82, 3)}${m(126, 334, 4)}${m(596, 304, 5)}${m(588, 130, 6)}</g>
    <g stroke="none" style="font-size:13px"><text x="182" y="76" style="fill:var(--muted)">Kitchen</text><text x="350" y="150" style="fill:var(--muted)">Bedroom</text><text x="230" y="250" style="fill:var(--muted)">Living room</text><text x="486" y="246" style="fill:var(--muted)">Bathroom</text><text x="24" y="170" style="fill:var(--muted)">Closet</text><text x="60" y="30" style="fill:var(--muted)"></text></g>`;
  return `<figure class="art">${svg('0 0 640 400', inner, '', 'Floor plan of a small apartment with six numbered places where emergency things are kept')}
    <ol class="legend">${legend.map(l => `<li><span>${l}</span></li>`).join('')}</ol></figure>`;
}

/* ---------- tonight: half an hour, ten things ---------- */
export function minutesRing(parts, total) {
  const R = 78, C = 2 * Math.PI * R, gap = 5; let off = 0;
  const arcs = parts.map((p, i) => { const len = Math.max(2, (p.minutes / total) * C - gap); const a = `<circle cx="100" cy="100" r="${R}" stroke-width="14" stroke-linecap="butt" class="${p.done ? '' : 'acc-s'}" style="${p.done ? 'opacity:.28' : ''}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 100 100)"/>`; off += (p.minutes / total) * C; return a; }).join('');
  const left = parts.filter(p => !p.done).reduce((s, p) => s + p.minutes, 0);
  const inner = `${arcs}<g stroke="none" text-anchor="middle"><text class="num" x="100" y="104" style="font-size:44px">${left}</text><text x="100" y="128" style="font-size:14px;fill:var(--muted)">minutes left</text></g>`;
  return `<figure class="art" style="max-width:13rem">${svg('0 0 200 200', inner, '', `${parts.length} things, ${total} minutes in all, ${left} minutes left`)}<figcaption>${parts.length} things, ${total} minutes in all. Each arc is one of them.</figcaption></figure>`;
}

/* ---------- the two-bucket toilet ---------- */
export function twinBuckets() {
  const b = (x, label, lid) => `<path class="surf-f" d="M${x} 70h110l-9 118a10 10 0 0 1-10 9H${x + 29}a10 10 0 0 1-10-9z"/><path d="M${x + 4} 70a51 34 0 0 1 102 0"/>${lid ? `<ellipse class="tint-f" cx="${x + 55}" cy="66" rx="60" ry="9"/>` : `<ellipse class="tint-f" cx="${x + 55}" cy="66" rx="60" ry="12"/><ellipse class="surf-f" cx="${x + 55}" cy="66" rx="34" ry="6"/>`}<rect class="tint-f" x="${x + 24}" y="112" width="62" height="34" rx="3"/><text x="${x + 55}" y="136" text-anchor="middle" stroke="none" style="font-weight:700;font-size:20px;letter-spacing:.06em">${label}</text>`;
  return `<figure class="art" style="max-width:24rem">${svg('0 0 320 220', b(30, 'PEE', true) + b(180, 'POO', false), '', 'Two labeled buckets: PEE with a tight lid, POO with a seat')}
    <figcaption>Two buckets, labeled. Pee has a tight lid. Poo has the seat and a loose cover so air can dry it; a handful of dry cover material goes in after each use.</figcaption></figure>`;
}

/* ---------- the order of a level ---------- */
export function route(stops) {
  return `<ol class="route">${stops.map(s => `<li>${s.html}</li>`).join('')}</ol>`;
}
