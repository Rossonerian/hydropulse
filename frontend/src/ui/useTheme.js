/**
 * HydroPulse Theme Hook
 * Manages theme state ('night' | 'day') with localStorage persistence.
 * Provides token value helpers for dynamic theme access.
 */

import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'hp-theme';
const DEFAULT_THEME = 'night';

// Initialize theme immediately to prevent flash
let currentTheme = DEFAULT_THEME;
try {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'night' || stored === 'day') {
    currentTheme = stored;
  }
} catch (e) {
  // Silently fail if localStorage is unavailable
}

const subscribers = new Set();

function broadcastTheme(newTheme) {
  subscribers.forEach((cb) => {
    try {
      cb(newTheme);
    } catch (e) {
      // Ignore callback errors
    }
  });
}

// Apply theme to document immediately
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', currentTheme);
}

/**
 * Get the value of a CSS custom property (token) from the document.
 * @param {string} name - Token name (e.g., '--ground')
 * @returns {string} Token value
 */
export function getTokenValue(name) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * React hook for theme management.
 * @returns {{ theme: string, setTheme: function, toggleTheme: function }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(currentTheme);

  useEffect(() => {
    subscribers.add(setThemeState);
    return () => {
      subscribers.delete(setThemeState);
    };
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'night' && newTheme !== 'day') return;
    currentTheme = newTheme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (e) {
      // Silently fail if localStorage is unavailable
    }
    broadcastTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'night' ? 'day' : 'night');
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}

/**
 * React hook to get a token value that updates on theme change.
 * @param {string} name - Token name (e.g., '--ground')
 * @returns {string} Token value
 */
export function useThemeToken(name) {
  const { theme } = useTheme();
  const [value, setValue] = useState(() => getTokenValue(name));

  useEffect(() => {
    // Re-read token value when theme changes
    setValue(getTokenValue(name));
  }, [theme, name]);

  return value;
}
