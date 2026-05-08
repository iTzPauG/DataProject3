import { useEffect, useState, useCallback } from 'react';
import { BASE_URL } from '../services/api';
import { storage } from '../utils/storage';

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
  user: any | null;
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

const AUTH_SESSION_KEY = 'local_auth_session_v1';

const DEV_CREDENTIALS: Record<string, { password: string; uid: string; displayName: string; cuisines?: string[] }> = {
  'usuario.prueba@gado.local': {
    password: 'Usuario123!',
    uid: 'test-user-1',
    displayName: 'Usuario Prueba',
  },
  'restaurante1@gado.local': {
    password: 'Restaurante123!',
    uid: 'test-business-1',
    displayName: 'La Pepica',
    cuisines: ['paella', 'mediterranean', 'seafood'],
  },
  'restaurante2@gado.local': {
    password: 'Restaurante123!',
    uid: 'test-business-2',
    displayName: 'Riff Restaurante',
    cuisines: ['creative', 'mediterranean', 'seasonal'],
  },
  'restaurante3@gado.local': {
    password: 'Restaurante123!',
    uid: 'test-business-3',
    displayName: 'Bar Pilar',
    cuisines: ['tapas', 'spanish', 'bar'],
  },
};

async function syncProfileWithBackend(idToken: string, displayName?: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        display_name: displayName || 'Local User',
        avatar_url: null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type LocalSession = {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
};

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
  listeners.forEach((listener) => listener(authStore));
}

function setAuthState(patch: Partial<AuthState>) {
  emitAuthState({ ...authStore, ...patch });
}

let bootstrapped = false;

async function bootstrapAuthStore() {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    const raw = await storage.getItem(AUTH_SESSION_KEY);
    if (!raw) {
      setAuthState({ loading: false, isAnonymous: true, user: null, idToken: null, session: null, profile: null });
      return;
    }

    const session = JSON.parse(raw) as LocalSession;
    const profile = await syncProfileWithBackend(session.idToken, session.displayName);

    emitAuthState({
      user: {
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
      },
      profile,
      session: { access_token: session.idToken },
      loading: false,
      isAnonymous: false,
      idToken: session.idToken,
    });
  } catch {
    emitAuthState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      isAnonymous: true,
      idToken: null,
    });
  }
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>(authStore);

  useEffect(() => {
    listeners.add(setState);
    void bootstrapAuthStore();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = DEV_CREDENTIALS[normalizedEmail];
    if (!account || account.password !== password) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const idToken = `local-token:${account.uid}`;
    const session = {
      uid: account.uid,
      email: normalizedEmail,
      displayName: account.displayName,
      idToken,
    };
    await storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    const profile = await syncProfileWithBackend(idToken, account.displayName);

    emitAuthState({
      user: {
        uid: account.uid,
        email: normalizedEmail,
        displayName: account.displayName,
      },
      profile,
      session: { access_token: idToken },
      loading: false,
      isAnonymous: false,
      idToken,
    });
  }, []);

  const signUpWithEmail = useCallback(async (_email: string, _password: string, _displayName?: string) => {
    throw new Error('Registro desactivado en modo local de pruebas');
  }, []);

  const signInWithGoogle = useCallback(async () => {
    throw new Error('Google login no disponible en modo local de pruebas');
  }, []);

  const signOut = useCallback(async () => {
    await storage.removeItem(AUTH_SESSION_KEY);
    emitAuthState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      isAnonymous: true,
      idToken: null,
    });
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => state.idToken, [state.idToken]);

  const refreshProfile = useCallback(async () => {
    if (!authStore.idToken) return;
    const profile = await syncProfileWithBackend(authStore.idToken, authStore.user?.displayName);
    setAuthState({ profile });
  }, []);

  return { ...state, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, getToken, refreshProfile };
}
