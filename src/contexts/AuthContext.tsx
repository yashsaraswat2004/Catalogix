import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { config } from '@/lib/config';
import { CoupangApiCredentials, WingSettings } from '@/types/coupang';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserSettings {
  credentials: (CoupangApiCredentials & { validated: boolean; validatedAt?: string }) | null;
  wingSettings: WingSettings | null;
  onboardingCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  userSettings: UserSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loadSettings: () => Promise<UserSettings | null>;
  saveCredentials: (credentials: CoupangApiCredentials) => Promise<boolean>;
  saveWingSettings: (settings: WingSettings) => Promise<boolean>;
  markCredentialsValidated: (validated: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL from config
const API_URL = config.apiUrl;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include', // Include cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return { success: true, message: data.message || 'Login successful' };
      } else {
        return { 
          success: false, 
          message: data.error || data.details?.[0] || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: 'Network error. Please check your connection and try again.' 
      };
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return { success: true, message: data.message || 'Account created successfully' };
      } else {
        return { 
          success: false, 
          message: data.error || data.details?.[0] || 'Signup failed' 
        };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        message: 'Network error. Please check your connection and try again.' 
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setUserSettings(null);
    }
  };

  // Load user settings from backend
  const loadSettings = async (): Promise<UserSettings | null> => {
    try {
      const response = await fetch(`${API_URL}/auth/settings`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const settings = data.settings as UserSettings;
        setUserSettings(settings);
        return settings;
      }
      return null;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return null;
    }
  };

  // Save credentials to backend
  const saveCredentials = async (credentials: CoupangApiCredentials): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/settings/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      
      if (response.ok) {
        // Also update local settings
        setUserSettings(prev => prev ? {
          ...prev,
          credentials: { ...credentials, validated: false },
        } : null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  };

  // Save Wing settings to backend
  const saveWingSettings = async (settings: WingSettings): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/settings/wing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        setUserSettings(prev => prev ? {
          ...prev,
          wingSettings: settings,
        } : null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save wing settings:', error);
      return false;
    }
  };

  // Mark credentials as validated
  const markCredentialsValidated = async (validated: boolean): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/settings/credentials/validated`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ validated }),
      });
      
      if (response.ok) {
        setUserSettings(prev => prev && prev.credentials ? {
          ...prev,
          credentials: { ...prev.credentials, validated },
        } : prev);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update validation status:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userSettings,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      refreshUser,
      loadSettings,
      saveCredentials,
      saveWingSettings,
      markCredentialsValidated,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
