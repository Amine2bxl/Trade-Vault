import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function mapUser(u: SupabaseUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.name as string) ||
    (meta.full_name as string) ||
    (u.email ? u.email.split('@')[0] : '') ||
    'Trader';
  return { id: u.id, email: u.email ?? '', name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? mapUser(data.session.user) : null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!email || !password) return 'Please fill in all fields';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<string | null> => {
      if (!name || !email || !password) return 'Please fill in all fields';
      if (password.length < 6) return 'Password must be at least 6 characters';
      if (!email.includes('@')) return 'Please enter a valid email';
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name },
        },
      });
      if (error) return error.message;
      return null;
    },
    [],
  );

  const loginWithGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) return error.message ?? 'Google sign-in failed';
    return null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    if (!email) return 'Please enter your email';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return error.message;
    return null;
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    if (!newPassword || newPassword.length < 6) return 'Password must be at least 6 characters';
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    return null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, signup, loginWithGoogle, requestPasswordReset, updatePassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
