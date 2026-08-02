/**
 * useTheme — hook for accessing the active theme inside components.
 *
 * Throws if used outside <ThemeProvider> (caught early in development).
 */
import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
	const value = useContext(ThemeContext);
	if (!value) {
		throw new Error(
			'useTheme must be used inside <ThemeProvider>. Wrap your root <App /> with it.',
		);
	}
	return value;
}
