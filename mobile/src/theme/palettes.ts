import type { PaletteColor, PaletteName } from './types';

/**
 * Habit palettes — the colors a user picks PER habit.
 *
 * Habit data stores the `key` (e.g. "olive"), not the hex. Switching the
 * active palette automatically recolors all habits.
 *
 * Adding a new palette:
 *   1. Add an entry below with the same 12 keys when possible (so user
 *      color choices carry over across palettes).
 *   2. Extend PaletteName in types.ts.
 *
 * Order in the array = order in the picker UI.
 */
export const PALETTES: Record<PaletteName, PaletteColor[]> = {

	// ── Earthy (default) — warm and grounded ───────────────────────────────
	earthy: [
		{ key: 'olive',      hex: '#7C7A3F', label: 'Olive' },
		{ key: 'mustard',    hex: '#C39526', label: 'Mustard' },
		{ key: 'wheat',      hex: '#D4B26A', label: 'Wheat' },
		{ key: 'terracotta', hex: '#BC6A45', label: 'Terracotta' },
		{ key: 'rust',       hex: '#9C5A3C', label: 'Rust' },
		{ key: 'clay',       hex: '#BC7A6C', label: 'Clay rose' },
		{ key: 'sage',       hex: '#7E9A74', label: 'Sage' },
		{ key: 'moss',       hex: '#5E7251', label: 'Moss' },
		{ key: 'teal',       hex: '#4F8A80', label: 'Teal' },
		{ key: 'dusk',       hex: '#6E83A3', label: 'Dusty blue' },
		{ key: 'slate',      hex: '#54627A', label: 'Slate' },
		{ key: 'plum',       hex: '#8B7298', label: 'Plum' },
	],
};

export const listPaletteNames = (): PaletteName[] =>
	Object.keys(PALETTES) as PaletteName[];

/** Resolve a palette's array to a { key -> hex } map. */
export const paletteMap = (name: PaletteName): Record<string, string> =>
	Object.fromEntries(PALETTES[name].map((c) => [c.key, c.hex]));
