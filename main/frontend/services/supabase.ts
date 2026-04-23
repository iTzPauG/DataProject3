/** Mocking Firebase for local development **/
export const app = {};
export const auth = {
  currentUser: { uid: 'local-user', displayName: 'Local User' },
  onAuthStateChanged: (cb: any) => {
    cb({ uid: 'local-user', displayName: 'Local User' });
    return () => {};
  }
};
export const db = {};
