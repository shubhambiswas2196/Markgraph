'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'amoled';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isValidTheme = (value: unknown): value is Theme => value === 'light' || value === 'amoled';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('light');
    const userOverrideRef = useRef(false);

    const applyTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    }, []);

    const persistTheme = useCallback(async (newTheme: Theme) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch {
            // Ignore storage errors (private mode, etc.)
        }

        try {
            await fetch('/api/settings/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme })
            });
        } catch {
            // Best-effort persistence; ignore network errors
        }
    }, []);

    const setTheme = useCallback((newTheme: Theme) => {
        userOverrideRef.current = true;
        applyTheme(newTheme);
        void persistTheme(newTheme);
    }, [applyTheme, persistTheme]);

    useEffect(() => {
        let initialTheme: Theme | null = null;

        const attrTheme = document.documentElement.getAttribute('data-theme');
        if (isValidTheme(attrTheme)) {
            initialTheme = attrTheme;
        }

        if (!initialTheme) {
            try {
                const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
                if (isValidTheme(storedTheme)) {
                    initialTheme = storedTheme;
                }
            } catch {
                // Ignore storage errors
            }
        }

        applyTheme(initialTheme ?? 'light');

        const fetchThemePreference = async () => {
            try {
                const res = await fetch('/api/settings/theme');
                if (!res.ok) return;
                const data = await res.json();
                const serverTheme = data?.theme;
                if (!isValidTheme(serverTheme)) return;

                if (!userOverrideRef.current && serverTheme !== initialTheme) {
                    applyTheme(serverTheme);
                }

                try {
                    localStorage.setItem(THEME_STORAGE_KEY, serverTheme);
                } catch {
                    // Ignore storage errors
                }
            } catch {
                // Ignore fetch errors
            }
        };

        void fetchThemePreference();
    }, [applyTheme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
