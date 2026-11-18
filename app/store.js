// Storage and sign-in. Two interchangeable back ends, chosen in config.js:
//   "local"    – a test sign-in. Data stays in this browser (localStorage). Used until Google sign-in is switched on.
//   "firebase" – Sign in with Google and one small Firestore document per user.
//
// What is saved per user, and nothing else:
//   household: answers to the household setup (numbers and choices only)
//   done:      { id: "YYYY-MM-DD" }   ticks for the household, and for the first home
//   done2:     { id: "YYYY-MM-DD" }   ticks for the second home (building-dependent actions only)
//   owned:     { productItemId: { level: 1|2|3, date } }   "Bought", household and first home
//   owned2:    the same for the second home
//   picks:     { productItemId: { tier } or { text } }     "My pick": a listed tier, or up to 80 characters
//   files:     { worksheetId: "https://docs.google.com/..." }  links to the person's own Drive files
import { config } from '../config.js';
import { DRIVE_SCOPE, isDriveLink } from './drive.js';

const empty = () => ({ household: null, done: {}, done2: {}, owned: {}, owned2: {}, picks: {}, files: {} });
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
function clean(d) {
  d = d || {};
  const picks = {};
  for (const [k, v] of Object.entries(obj(d.picks))) {
    if (v && ['cadillac', 'standard', 'budget'].includes(v.tier)) picks[k] = { tier: v.tier };
    else if (v && typeof v.text === 'string' && v.text.trim()) picks[k] = { text: v.text.trim().slice(0, 80) };
  }
  const files = {};
  for (const [k, v] of Object.entries(obj(d.files))) if (isDriveLink(v)) files[k] = v;
  return { household: d.household || null, done: obj(d.done), done2: obj(d.done2), owned: obj(d.owned), owned2: obj(d.owned2), picks, files };
}

class LocalStore {
  constructor() { this.kind = 'local'; this.cbs = []; this.user = null; }
  async init() { try { this.user = JSON.parse(localStorage.getItem('cityready.local.user')); } catch { this.user = null; } }
  onAuth(cb) { this.cbs.push(cb); cb(this.user); }
  emit() { this.cbs.forEach(cb => cb(this.user)); }
  async signIn() { this.user = { uid: 'local-test-user', name: 'Test user' }; localStorage.setItem('cityready.local.user', JSON.stringify(this.user)); this.emit(); }
  async signOut() { this.user = null; localStorage.removeItem('cityready.local.user'); this.emit(); }
  key() { return 'cityready.local.data.' + this.user.uid; }
  async load() { if (!this.user) return null; try { return clean(JSON.parse(localStorage.getItem(this.key()))); } catch { return empty(); } }
  async save(data) { if (!this.user) throw new Error('Not signed in'); localStorage.setItem(this.key(), JSON.stringify(clean(data))); }
  async deleteAccount() { if (!this.user) return; localStorage.removeItem(this.key()); localStorage.removeItem('cityready.local.user'); this.user = null; this.emit(); }
  // The local test sign-in has no Google account behind it, so there is no Drive to open.
  get driveReady() { return false; }
  async driveToken() { throw new Error('Google Drive needs Sign in with Google'); }
}

class FirebaseStore {
  constructor() { this.kind = 'firebase'; this.cbs = []; this.user = null; }
  async init() {
    const base = `https://www.gstatic.com/firebasejs/${config.firebaseSdkVersion}/`;
    const [appM, authM, fsM] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
    this.A = authM; this.F = fsM;
    this.app = appM.initializeApp(config.firebase);
    this.auth = authM.getAuth(this.app);
    this.db = fsM.getFirestore(this.app);
    await new Promise(resolve => {
      let first = true;
      authM.onAuthStateChanged(this.auth, u => {
        // Only the display name is read, to greet the user. Email and photo are never read or copied by this site.
        this.user = u ? { uid: u.uid, name: u.displayName || 'Signed in' } : null;
        if (first) { first = false; resolve(); }
        this.emit();
      });
    });
  }
  onAuth(cb) { this.cbs.push(cb); cb(this.user); }
  emit() { this.cbs.forEach(cb => cb(this.user)); }
  provider() {
    // Sign-in itself asks for identity only (name, email address, profile picture): no Gmail, no contacts,
    // no calendar. Drive is asked for separately, later, and only as drive.file (see driveToken).
    const p = new this.A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  async signIn() {
    try { await this.A.signInWithPopup(this.auth, this.provider()); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) await this.A.signInWithRedirect(this.auth, this.provider());
      else if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
      else throw e;
    }
  }
  async signOut() { await this.A.signOut(this.auth); }
  ref() { return this.F.doc(this.db, 'users', this.user.uid); }
  async load() { if (!this.user) return null; const s = await this.F.getDoc(this.ref()); return s.exists() ? clean(s.data()) : empty(); }
  async save(data) { if (!this.user) throw new Error('Not signed in'); await this.F.setDoc(this.ref(), { ...clean(data), updated: this.F.serverTimestamp() }); }
  // Google Drive, asked for only when the person first opens a worksheet in Drive, and only the
  // drive.file permission: the site can create files and open the files it created, nothing else.
  // The token is kept in memory for this visit and never saved.
  get driveReady() { return !!config.drive; }
  async driveToken() {
    if (this.tok && this.tok.until > Date.now()) return this.tok.value;
    const p = this.provider(); p.addScope(DRIVE_SCOPE);
    const res = await this.A.reauthenticateWithPopup(this.auth.currentUser, p);
    const cred = this.A.GoogleAuthProvider.credentialFromResult(res);
    if (!cred || !cred.accessToken) throw new Error('Google did not grant Drive access');
    this.tok = { value: cred.accessToken, until: Date.now() + 45 * 60 * 1000 };
    return this.tok.value;
  }
  async deleteAccount() {
    if (!this.user) return;
    await this.F.deleteDoc(this.ref());
    const u = this.auth.currentUser;
    try { await this.A.deleteUser(u); }
    catch (e) {
      if (e && e.code === 'auth/requires-recent-login') { await this.A.reauthenticateWithPopup(u, this.provider()); await this.A.deleteUser(u); }
      else throw e;
    }
  }
}

export async function createStore() {
  const s = config.backend === 'firebase' ? new FirebaseStore() : new LocalStore();
  await s.init();
  return s;
}

// The household setup for a visitor who is not signed in is kept on this device only, so the site can
// hide what does not apply and work out quantities. It is never sent anywhere.
const DEVICE_HH = 'cityready.device.household';
export const deviceHousehold = {
  get() { try { return JSON.parse(localStorage.getItem(DEVICE_HH)); } catch { return null; } },
  set(h) { try { localStorage.setItem(DEVICE_HH, JSON.stringify(h)); } catch {} },
  clear() { try { localStorage.removeItem(DEVICE_HH); } catch {} }
};
