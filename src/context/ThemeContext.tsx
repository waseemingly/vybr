// src/context/ThemeContext.tsx

import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useMemo, // Added useMemo for optimization
    ReactNode // Added type for children
} from 'react';
import { Appearance, useColorScheme, ColorSchemeName, StyleSheet } from 'react-native'; // Use built-in hook
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define possible theme values
export type Theme = 'light' | 'dark';
export type ThemeSetting = Theme | 'system'; // User can select 'system' default

// Define the shape of the context value
interface ThemeContextProps {
    theme: Theme; // The currently *active* theme ('light' or 'dark')
    themeSetting: ThemeSetting; // The user's *preference* ('light', 'dark', or 'system')
    isSystemTheme: boolean; // Is the current theme derived from the system setting?
    setThemeSetting: (setting: ThemeSetting) => Promise<void>; // Function to change the preference
}

// Create the context with default values
const ThemeContext = createContext<ThemeContextProps>({
    theme: 'light', // Default active theme
    themeSetting: 'system', // Default preference
    isSystemTheme: true,
    setThemeSetting: async () => {}, // Default empty function
});

// Define props for the provider component
interface ThemeProviderProps {
    children: ReactNode;
}

// Key for storing preference in AsyncStorage
const THEME_PREFERENCE_KEY = '@theme_preference_v1';

// The Provider Component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // Get the current system theme using the hook (more reliable)
    const systemTheme = useColorScheme() ?? 'light';

    // State to store the user's saved preference ('light', 'dark', or 'system')
    const [themeSetting, setThemeSettingState] = useState<ThemeSetting>('system');
    // State to store the actual theme being applied ('light' or 'dark')
    const [activeTheme, setActiveTheme] = useState<Theme>(systemTheme);

    // Load saved theme preference from storage on initial mount
    useEffect(() => {
        const loadPreference = async () => {
            try {
                const savedSetting = await AsyncStorage.getItem(THEME_PREFERENCE_KEY) as ThemeSetting | null;
                if (savedSetting && ['light', 'dark', 'system'].includes(savedSetting)) {
                    setThemeSettingState(savedSetting);
                    // Set initial active theme based on loaded setting and current system theme
                    setActiveTheme(savedSetting === 'system' ? systemTheme : savedSetting);
                } else {
                    // No saved setting or invalid value, default to system
                    setThemeSettingState('system');
                    setActiveTheme(systemTheme);
                }
            } catch (e) {
                console.error("Failed to load theme preference.", e);
                // Fallback if loading fails
                setThemeSettingState('system');
                setActiveTheme(systemTheme);
            }
        };
        loadPreference();
        // Run only once on mount
    }, [systemTheme]); // Rerun if system theme changes *before* preference is loaded


    // Effect to update the *active* theme when the *setting* or *system theme* changes
     useEffect(() => {
         if (themeSetting === 'system') {
             setActiveTheme(systemTheme);
         } else {
             setActiveTheme(themeSetting);
         }
     }, [themeSetting, systemTheme]);


    // Function to update the theme setting (preference) and save it
    const handleSetThemeSetting = async (newSetting: ThemeSetting) => {
        try {
            if (!['light', 'dark', 'system'].includes(newSetting)) {
                console.warn(`Invalid theme setting provided: ${newSetting}. Defaulting to 'system'.`);
                newSetting = 'system';
            }
            await AsyncStorage.setItem(THEME_PREFERENCE_KEY, newSetting);
            setThemeSettingState(newSetting); // Update the preference state
            // The useEffect above will handle updating the activeTheme
            console.log(`Theme preference saved: ${newSetting}`);
        } catch (e) {
            console.error("Failed to save theme preference.", e);
        }
    };

    // Memoize the context value to prevent unnecessary re-renders of consumers
    const contextValue = useMemo(() => ({
        theme: activeTheme,
        themeSetting: themeSetting,
        isSystemTheme: themeSetting === 'system',
        setThemeSetting: handleSetThemeSetting,
    }), [activeTheme, themeSetting, handleSetThemeSetting]); // Recalculate if these change

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook to easily consume the context
export const useTheme = (): ThemeContextProps => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Add theme-aware styles
export const getThemeStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme === 'dark' ? '#1F2937' : '#F9FAFB',
    },
    text: {
        color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
    },
    card: {
        backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB',
    },
    border: {
        borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB',
    },
    input: {
        backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
        color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
        borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB',
    },
    button: {
        backgroundColor: theme === 'dark' ? '#4B5563' : '#E5E7EB',
    },
    header: {
        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
    },
    tabBar: {
        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
        borderTopColor: theme === 'dark' ? '#4B5563' : '#E5E7EB',
    },
});