import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Profile } from '../types.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, securityCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  quickSwitchUser: (preset: 'userA' | 'userB') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sr_token'));
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    const existingToken = localStorage.getItem('sr_token');
    if (!existingToken) {
      // Auto sign-in to User A (Alex Mercer) on first visit so user immediately enters the live assistant!
      try {
        const res = await api.login('alex@sr.ai', 'password123');
        localStorage.setItem('sr_token', res.token);
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile);
      } catch (err) {
        console.error('Initial auto-login failed:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      setProfile(res.profile);
    } catch {
      localStorage.removeItem('sr_token');
      setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, pass);
      localStorage.setItem('sr_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setProfile(res.profile);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, name: string, securityCode = '18') => {
    setLoading(true);
    try {
      const res = await api.register(email, pass, name, securityCode);
      localStorage.setItem('sr_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setProfile(res.profile);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
      localStorage.removeItem('sr_token');
      setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const quickSwitchUser = async (preset: 'userA' | 'userB') => {
    if (preset === 'userA') {
      await login('alex@sr.ai', 'password123');
    } else {
      await login('sarah@sr.ai', 'password123');
    }
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      setProfile(res.profile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        login,
        register,
        logout,
        quickSwitchUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
