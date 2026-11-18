// Site configuration. This is the only file to edit to switch on Sign in with Google.
//
// backend: "local"    = no accounts; progress is kept in this browser only. Nothing leaves the device.
// backend: "firebase" = Sign in with Google; progress is kept in Cloud Firestore under the signed-in user.
//
// To switch on Google sign-in, follow MORNING.md, paste the values Firebase shows you into `firebase`
// below, and change backend to "firebase".
export const config = {
  backend: "local",
  // signIn: false = no sign-in button. Each visitor's setup and ticks are kept in their own browser, with
  // nothing to click. true brings back the "Test sign-in" button, to test the signed-out view.
  // Only read with backend "local"; with "firebase", Sign in with Google always shows.
  signIn: false,
  // Who serves the files, named on the Privacy page when there is no sign-in. "" leaves the sentence out.
  servedBy: "GitHub Pages",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: ""
  },
  // Worksheets open as files in the signed-in person's own Google Drive. Leave this false until the
  // Google Drive API has been switched on for the project (the clicks are in MORNING.md). It only
  // works with backend "firebase"; with "local" there is no Google account to hold the files.
  drive: false,
  firebaseSdkVersion: "10.14.1",
  siteName: "City Ready"
};
