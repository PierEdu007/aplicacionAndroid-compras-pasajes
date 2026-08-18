import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Rol } from '../types/database';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  user: any | null;
  role: Rol | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isVendedor: boolean;
  isContador: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  isAdmin: false,
  isVendedor: false,
  isContador: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveRole = async (currentUser: any) => {
    if (!currentUser) {
      setRole(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('rol')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (data && data.rol) {
        setRole(data.rol as Rol);
      } else {
        // Fallback email heuristic
        const email = currentUser.email?.toLowerCase() || '';
        if (email.includes('admin') || email.includes('tunky')) {
          setRole('ADMIN');
        } else if (email.includes('contador')) {
          setRole('CONTADOR');
        } else {
          setRole('VENDEDOR');
        }
      }
    } catch (_e) {
      setRole('ADMIN');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) resolveRole(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) resolveRole(u);
      else setRole(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setUser(data.user);
      await resolveRole(data.user);
      await SecureStore.setItemAsync('last_login_email', email.trim());
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de autenticación' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setLoading(false);
  };

  const isAdmin = role === 'ADMIN';
  const isVendedor = role === 'VENDEDOR' || role === 'ADMIN';
  const isContador = role === 'CONTADOR' || role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        login,
        logout,
        isAdmin,
        isVendedor,
        isContador,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
