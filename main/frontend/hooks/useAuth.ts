import { useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { BASE_URL } from '../services/api';
import { firebaseAuth } from '../services/firebase';

export interface UserProfile {
  id: string;
  firebase_uid: string;
  display_name: string | null;
  avatar_url: string | null;
  reputation_score: number;
  reports_count: number;
  role: 'user' | 'business' | 'admin';
  restaurant_name: string | null;
  restaurant_place_id: string | null;
  restaurant_lat: number | null;
  restaurant_lng: number | null;
  restaurant_cuisines: string[] | null;
  restaurant_photo_url: string | null;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: { access_token: string } | null;
  loading: boolean;
  isAnonymous: boolean;
  idToken: string | null;
}

interface AuthActions {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

// ── Backend helpers ─────────────────────────────────────────────────────────

/**
 * The local backend (mock auth) treats the Bearer token value directly as the
 * firebase_uid. So we pass user.uid — which matches profiles.firebase_uid in
 * the DB — instead of the full JWT.
 */
function buildBearer(uid: string): string {
  return uid;
}

async function syncProfileWithBackend(
  uid: string,
  displayName?: string | null,
): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buildBearer(uid)}`,
      },
      body: JSON.stringify({
        display_name: displayName ?? 'Usuario',
        avatar_url: null,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

// ── Global store (shared across hook instances) ──────────────────────────────

let authStore: AuthState = {
  user: null,
  profile: null,
  session: null,
  loading: true,
  isAnonymous: true,
  idToken: null,
};

const listeners = new Set<(state: AuthState) => void>();

function emitAuthState(next: AuthState) {
  authStore = next;
  listeners.forEach((l) => l(authStore));
}

// ── Firebase Auth listener (singleton) ───────────────────────────────────────

let unsubscribeFirebase: (() => void) | null = null;

function bootstrapFirebaseAuth() {
  if (unsubscribeFirebase) return;
  if (!firebaseAuth) {
    // Firebase not configured — stay anonymous
    emitAuthState({ ...authStore, loading: false });
    return;
  }

  unsubscribeFirebase = onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) {
      emitAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        isAnonymous: true,
        idToken: null,
      });
      return;
    }

    const profile = await syncProfileWithBackend(user.uid, user.displayName);
    emitAuthState({
      user,
      profile,
      session: { access_token: buildBearer(user.uid) },
      loading: false,
      isAnonymous: false,
      idToken: buildBearer(user.uid),
    });
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>(authStore);

  useEffect(() => {
    listeners.add(setState);
    bootstrapFirebaseAuth();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase Auth no está configurado');
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    // onAuthStateChanged fires automatically and updates the store
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!firebaseAuth) throw new Error('Firebase Auth no está configurado');
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (displayName) await updateProfile(user, { displayName });
      // onAuthStateChanged fires automatically
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    throw new Error('Google login no disponible aún');
  }, []);

  const signOut = useCallback(async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
    // onAuthStateChanged fires with null → store resets automatically
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!authStore.user) return null;
    return buildBearer(authStore.user.uid);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!authStore.user) return;
    const profile = await syncProfileWithBackend(authStore.user.uid, authStore.user.displayName);
    emitAuthState({ ...authStore, profile });
  }, []);

  return { ...state, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, getToken, refreshProfile };
}
