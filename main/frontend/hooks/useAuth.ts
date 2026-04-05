import { useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from '../services/supabase';
import { BASE_URL } from '../services/api';

export interface UserProfile {
  id: string;
  firebase_uid: string;
  display_name: string | null;
  avatar_url: string | null;
  reputation_score: number;
  reports_count: number;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
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

async function syncProfileWithBackend(user: User): Promise<UserProfile | null> {
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BASE_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        display_name: user.displayName ?? null,
        avatar_url: user.photoURL ?? null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAnonymous: true,
    idToken: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const [idToken, profile] = await Promise.all([
          user.getIdToken(),
          syncProfileWithBackend(user),
        ]);
        setState({ user, profile, loading: false, isAnonymous: false, idToken });
      } else {
        setState({ user: null, profile: null, loading: false, isAnonymous: true, idToken: null });
      }
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    return state.user ? state.user.getIdToken() : null;
  }, [state.user]);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const profile = await syncProfileWithBackend(state.user);
    setState(prev => ({ ...prev, profile }));
  }, [state.user]);

  return { ...state, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, getToken, refreshProfile };
}
