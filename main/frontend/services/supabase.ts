/** Mocking Firebase for local development **/
export const app = {};
export const auth = {
  currentUser: { 
    uid: 'local-user', 
    displayName: 'Local User',
    getIdToken: async () => 'local-token'
  },
  onAuthStateChanged: (cb: any) => {
    cb({ 
      uid: 'local-user', 
      displayName: 'Local User',
      getIdToken: async () => 'local-token'
    });
    return () => {};
  }
};
export const db = {};
