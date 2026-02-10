import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { safeLocalStorage } from "@/utils/safeStorage";

const ORGANIZER_MODE_KEY = '@vybr_organizer_mode';

interface OrganizerModeContextType {
  isOrganizerMode: boolean;
  isOrganizerModeLoaded: boolean; // New: track if mode has been loaded from storage
  toggleOrganizerMode: () => void;
  setIsOrganizerMode: (value: boolean) => void;
}

const OrganizerModeContext = createContext<
  OrganizerModeContextType | undefined
>(undefined);

interface OrganizerModeProviderProps {
  children: ReactNode;
}

export const OrganizerModeProvider = ({
  children,
}: OrganizerModeProviderProps) => {
  const [isOrganizerMode, setIsOrganizerModeState] = useState(false);
  const [isOrganizerModeLoaded, setIsOrganizerModeLoaded] = useState(false);

  // Load organizer mode from storage on mount
  useEffect(() => {
    const loadOrganizerMode = async () => {
      try {
        let storedMode: string | null = null;
        
        if (Platform.OS === 'web') {
          storedMode = safeLocalStorage.getItem(ORGANIZER_MODE_KEY);
        } else {
          storedMode = await AsyncStorage.getItem(ORGANIZER_MODE_KEY);
        }
        
        if (storedMode !== null) {
          const parsedMode = storedMode === 'true';
          console.log('[OrganizerModeProvider] Loaded organizer mode from storage:', parsedMode);
          setIsOrganizerModeState(parsedMode);
        }
      } catch (error) {
        console.error('[OrganizerModeProvider] Error loading organizer mode:', error);
      } finally {
        setIsOrganizerModeLoaded(true);
      }
    };
    
    loadOrganizerMode();
  }, []);

  // Persist organizer mode to storage whenever it changes
  const setIsOrganizerMode = useCallback((value: boolean) => {
    setIsOrganizerModeState(value);
    
    // Persist to storage
    try {
      if (Platform.OS === 'web') {
        safeLocalStorage.setItem(ORGANIZER_MODE_KEY, String(value));
        console.log('[OrganizerModeProvider] Saved organizer mode to localStorage:', value);
      } else {
        AsyncStorage.setItem(ORGANIZER_MODE_KEY, String(value)).then(() => {
          console.log('[OrganizerModeProvider] Saved organizer mode to AsyncStorage:', value);
        });
      }
    } catch (error) {
      console.error('[OrganizerModeProvider] Error saving organizer mode:', error);
    }
  }, []);

  const toggleOrganizerMode = useCallback(() => {
    setIsOrganizerMode(!isOrganizerMode);
  }, [isOrganizerMode, setIsOrganizerMode]);

  return (
    <OrganizerModeContext.Provider
      value={{ isOrganizerMode, isOrganizerModeLoaded, toggleOrganizerMode, setIsOrganizerMode }}
    >
      {children}
    </OrganizerModeContext.Provider>
  );
};

export const useOrganizerMode = (): OrganizerModeContextType => {
  const context = useContext(OrganizerModeContext);
  if (context === undefined) {
    throw new Error(
      "useOrganizerMode must be used within an OrganizerModeProvider"
    );
  }
  return context;
};
