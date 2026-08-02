/**
 * ThemeProvider — wraps the app, exposes the current surface theme + active
 * palette via React Context. Replaces the CSS-variable approach from the
 * web mockup (RN has no CSS vars).
 *
 * Usage:
 *   <ThemeProvider><App /></ThemeProvider>
 *
 *   // in any descendant:
 *   const { colors, paletteMap, setSurface } = useTheme();
 *   <View style={{ backgroundColor: colors.paper }} />
 */
import { createContext, useMemo, useState, type ReactNode } from 'react';

import { paletteMap as buildPaletteMap, PALETTES } from './palettes';
import { SURFACES } from './surfaces';
import type {
	PaletteColor,
	PaletteName,
	SurfaceName,
	SurfaceTheme,
} from './types';

export interface ThemeContextValue {
	// active selections
	surfaceName: SurfaceName;
	paletteName: PaletteName;
	// resolved values for convenience
	colors: SurfaceTheme;
	palette: PaletteColor[];
	paletteMap: Record<string, string>;
	// setters (persist later via AsyncStorage when we add settings)
	setSurface: (name: SurfaceName) => void;
	setPalette: (name: PaletteName) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
	children: ReactNode;
	initialSurface?: SurfaceName;
	initialPalette?: PaletteName;
}

export function ThemeProvider({
	children,
	initialSurface = 'light',
	initialPalette = 'earthy',
}: ThemeProviderProps) {
	const [surfaceName, setSurface] = useState<SurfaceName>(initialSurface);
	const [paletteName, setPalette] = useState<PaletteName>(initialPalette);

	// Memoize the derived map so consumers don't re-render unless inputs change.
	const value = useMemo<ThemeContextValue>(
		() => ({
			surfaceName,
			paletteName,
			colors:     SURFACES[surfaceName],
			palette:    PALETTES[paletteName],
			paletteMap: buildPaletteMap(paletteName),
			setSurface,
			setPalette,
		}),
		[surfaceName, paletteName],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}
