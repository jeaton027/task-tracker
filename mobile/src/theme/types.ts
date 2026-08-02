/**
 * Type shapes for the theme system.
 *
 * Two orthogonal concepts:
 *   - SurfaceTheme: the *look* (light, dark, future high-contrast/sepia).
 *     Sets the colors of backgrounds, text, borders.
 *   - Palette: the colors a *user picks per habit*. Independent of surface.
 *
 * Habit data stores a palette KEY (e.g. "olive"), not a hex. Switching
 * palettes recolors every habit automatically.
 */

/** Semantic color tokens — keep names meaning-based ("paper"), not visual ("white"). */
export interface SurfaceTheme {
	// surfaces
	paper: string;       // primary background
	card: string;        // raised surface (rows, buttons)
	chip: string;        // pill / icon button background
	// text
	ink: string;         // primary text
	muted: string;       // secondary text
	// borders & subtle states
	line: string;        // dividers, card outlines
	empty: string;       // empty calendar cell fill
	emptyLine: string;   // empty calendar cell border
	future: string;      // future calendar cells (faint)
	// accent — used sparingly
	accent: string;
	// page chrome (around the app frame)
	pageBgFrom: string;
	pageBgTo: string;
}

export interface PaletteColor {
	key: string;
	hex: string;
	label: string;
}

export type SurfaceName = 'light' | 'dark';
export type PaletteName = 'earthy';
