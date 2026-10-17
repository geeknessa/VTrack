import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserSettings, fetchApi, getTabSessionToken, setTabSessionToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshAuth: () => Promise<void>;
  fetchSettings: () => Promise<void>; // alias for refreshAuth — used in Dashboard
  openNewTabSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = async () => {
    const tabToken = getTabSessionToken();
    if (!tabToken) {
      setUser(null);
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchApi<{ user: User; settings: UserSettings; token?: string }>('/api/auth/me');
      setUser(data.user);
      setSettings(data.settings);
      if (data.token) {
        setTabSessionToken(data.token);
      }
    } catch {
      setTabSessionToken(null);
      setUser(null);
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const data = await fetchApi<{ user: User; settings: UserSettings; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    if (data.token) {
      setTabSessionToken(data.token);
    }
    setUser(data.user);
    setSettings(data.settings);
  };

  const register = async (email: string, pass: string, name?: string) => {
    const data = await fetchApi<{ user: User; settings: UserSettings; token?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass, name }),
    });
    if (data.token) {
      setTabSessionToken(data.token);
    }
    setUser(data.user);
    setSettings(data.settings);
  };

  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setTabSessionToken(null);
      setUser(null);
      setSettings(null);
    }
  };

  const openNewTabSession = () => {
    window.open('/login?isolated=true', '_blank');
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const data = await fetchApi<{ settings: UserSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(newSettings),
    });
    setSettings(data.settings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        login,
        register,
        logout,
        updateSettings,
        refreshAuth,
        fetchSettings: refreshAuth,
        openNewTabSession,
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
