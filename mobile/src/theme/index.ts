/**
 * Public surface of the theme module. Components import from here:
 *   import { useTheme, RADII } from '@/theme';
 *
 * The leading `@/` alias is configured in tsconfig.json.
 */
export { ThemeProvider, ThemeContext } from './ThemeProvider';
export { useTheme } from './useTheme';
export { SURFACES, listSurfaceNames } from './surfaces';
export { PALETTES, paletteMap, listPaletteNames } from './palettes';
export { FONTS, RADII } from './typography';
export type {
	SurfaceTheme,
	SurfaceName,
	PaletteColor,
	PaletteName,
} from './types';
