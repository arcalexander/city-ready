// Worksheets in the signed-in person's own Google Drive.
//
// What this does, and all it does:
//   1. finds or creates one folder called "Household Plan" in the person's Drive,
//   2. creates a blank Google Doc for a worksheet in that folder,
//   3. hands back the link, which is the only thing the site saves.
// It uses the narrowest Drive permission, drive.file, which lets the site see and open only the files it
// created itself. It never reads what is inside a file: there is no call here that downloads content.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FOLDER_NAME = 'Household Plan';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The blank worksheet as simple HTML, which Drive turns into an editable Google Doc.
export function worksheetDocHtml(w) {
  const cell = 'border:1px solid #888;padding:6px;vertical-align:top';
  const fields = fs => `<table style="border-collapse:collapse;width:100%">${fs.map(f => `<tr><td style="${cell};width:40%"><b>${escH(f)}</b></td><td style="${cell}">&nbsp;</td></tr>`).join('')}</table>`;
  let body = `<h1>${escH(w.title)}</h1><p>${escH(w.intro || '')}</p>`;
  for (const b of w.blocks || []) {
    if (b.heading) body += `<h2>${escH(b.heading)}</h2>`;
    if (b.note) body += `<p><i>${escH(b.note)}</i></p>`;
    if (b.type === 'fields') body += fields(b.fields);
    if (b.type === 'table') body += `<table style="border-collapse:collapse;width:100%"><tr>${b.columns.map(c => `<th style="${cell};background:#eee">${escH(c)}</th>`).join('')}</tr>${Array.from({ length: b.rows || 6 }, () => `<tr>${b.columns.map(() => `<td style="${cell}">&nbsp;</td>`).join('')}</tr>`).join('')}</table>`;
    if (b.type === 'cards') body += Array.from({ length: b.copies || 2 }, () => `<h3>${escH(b.title || '')}</h3>${fields(b.fields)}`).join('');
    if (b.type === 'checklist') body += `<table style="border-collapse:collapse;width:100%">${b.items.map(i => `<tr><td style="${cell};width:6%">&#9744;</td><td style="${cell}">${escH(i)}</td></tr>`).join('')}</table>`;
    if (b.type === 'text') body += `<ul>${(b.lines || []).map(l => `<li>${escH(l)}</li>`).join('')}</ul>`;
  }
  body += '<p><i>This file is yours and lives only in your Google Drive. The website that created it keeps the link to it and nothing else, and cannot read what you write here.</i></p>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escH(w.title)}</title></head><body>${body}</body></html>`;
}

async function call(fetchFn, token, url, init = {}) {
  const r = await fetchFn(url, { ...init, headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) } });
  if (!r.ok) { const e = new Error('Google Drive answered ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

export async function findOrCreateFolder(token, fetchFn = fetch) {
  const q = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await call(fetchFn, token, `${API}?q=${q}&fields=files(id)&spaces=drive&pageSize=1`);
  if (found.files && found.files.length) return found.files[0].id;
  const made = await call(fetchFn, token, `${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }) });
  return made.id;
}

// Creates the worksheet as a Google Doc and returns its link. Asks Drive for the id and link only.
export async function createWorksheetFile(token, w, fetchFn = fetch) {
  const folder = await findOrCreateFolder(token, fetchFn);
  const boundary = 'cityready' + Math.random().toString(36).slice(2);
  const meta = { name: w.title, mimeType: 'application/vnd.google-apps.document', parents: [folder] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${worksheetDocHtml(w)}\r\n--${boundary}--`;
  const made = await call(fetchFn, token, `${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return made.webViewLink || `https://docs.google.com/document/d/${made.id}/edit`;
}

// Only links to the person's own Google files are ever saved or opened.
export const isDriveLink = u => typeof u === 'string' && /^https:\/\/(docs|drive)\.google\.com\//.test(u);
