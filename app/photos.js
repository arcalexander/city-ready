// A person's own photo of a thing they bought. Kept on this device only (the browser's IndexedDB):
// it is never sent to the site, never put in the saved record, and never copied to another device.
// The photo is shrunk before it is stored so a phone picture takes little room.
const DB = 'cityready-photos', STORE = 'photos', MAX = 1200;
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => { const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(q && q.result); t.onerror = () => reject(t.error); });
}
const key = (uid, itemId) => `${uid}:${itemId}`;
const urls = new Map();   // object URLs for photos already read this visit

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.85));
}
export async function setPhoto(uid, itemId, file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Not a picture');
  const blob = await shrink(file);
  await tx('readwrite', s => s.put(blob, key(uid, itemId)));
  const k = key(uid, itemId); if (urls.has(k)) URL.revokeObjectURL(urls.get(k)); urls.delete(k);
}
export async function removePhoto(uid, itemId) {
  await tx('readwrite', s => s.delete(key(uid, itemId)));
  const k = key(uid, itemId); if (urls.has(k)) URL.revokeObjectURL(urls.get(k)); urls.delete(k);
}
export async function photoUrl(uid, itemId) {
  const k = key(uid, itemId);
  if (urls.has(k)) return urls.get(k);
  const blob = await tx('readonly', s => s.get(k));
  if (!blob) return '';
  const u = URL.createObjectURL(blob); urls.set(k, u); return u;
}
// Removes every photo this person stored on this device (used when the account is deleted).
export async function clearPhotos(uid) {
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE), r = s.openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) return; if (String(c.key).startsWith(uid + ':')) c.delete(); c.continue(); };
    t.oncomplete = resolve; t.onerror = () => reject(t.error);
  });
  for (const [k, u] of urls) if (k.startsWith(uid + ':')) { URL.revokeObjectURL(u); urls.delete(k); }
}
// Fills every element marked data-photo="<itemId>" with the person's photo, if there is one.
export async function hydrate(uid, root = document) {
  if (!uid || !('indexedDB' in window)) return;
  for (const el of root.querySelectorAll('[data-photo]')) {
    try {
      const u = await photoUrl(uid, el.dataset.photo);
      if (u) { el.innerHTML = `<img src="${u}" alt="${(el.dataset.alt || 'Your photo').replace(/"/g, '&quot;')}">`; el.classList.add('has'); const p = el.closest('.photoslot'); if (p) p.classList.add('has'); }
    } catch (e) { /* a private window may refuse storage: the drawn icon stays */ }
  }
}
