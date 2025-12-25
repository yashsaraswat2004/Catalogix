import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type BackendMode = 'cloud' | 'local';

interface BackendModeContextType {
  mode: BackendMode;
  setMode: (mode: BackendMode) => void;
  isLocal: boolean;
  localUrl: string;
}

const BackendModeContext = createContext<BackendModeContextType | undefined>(undefined);

const LOCAL_FUNCTIONS_URL = 'http://localhost:54321/functions/v1';
const STORAGE_KEY = 'coupang_backend_mode';

export function BackendModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BackendMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'local' ? 'local' : 'cloud') as BackendMode;
  });

  const setMode = (newMode: BackendMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  return (
    <BackendModeContext.Provider value={{ 
      mode, 
      setMode, 
      isLocal: mode === 'local',
      localUrl: LOCAL_FUNCTIONS_URL 
    }}>
      {children}
    </BackendModeContext.Provider>
  );
}

export function useBackendMode() {
  const context = useContext(BackendModeContext);
  if (context === undefined) {
    throw new Error('useBackendMode must be used within a BackendModeProvider');
  }
  return context;
}
