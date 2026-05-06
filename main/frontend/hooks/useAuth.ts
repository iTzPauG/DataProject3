import { useEffect, useState, useCallback } from 'react';
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
  user: any | null;
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

async function syncProfileWithBackend(): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-token`,
      },
      body: JSON.stringify({
        display_name: 'Local User',
        avatar_url: null,
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
    user: { uid: 'local-user', displayName: 'Local User' },
    profile: null,
    loading: true,
    isAnonymous: false,
    idToken: 'local-token',
  });

  useEffect(() => {
    async function init() {
      const profile = await syncProfileWithBackend();
      setState(prev => ({ ...prev, profile, loading: false }));
    }
    init();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {}, []);
  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {}, []);
  const signInWithGoogle = useCallback(async () => {}, []);
  const signOut = useCallback(async () => {}, []);
  const getToken = useCallback(async (): Promise<string | null> => 'local-token', []);

  const refreshProfile = useCallback(async () => {
    const profile = await syncProfileWithBackend();
    setState(prev => ({ ...prev, profile }));
  }, []);

  return { ...state, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, getToken, refreshProfile };
}
