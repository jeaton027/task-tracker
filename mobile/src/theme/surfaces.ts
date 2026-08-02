import type { SurfaceName, SurfaceTheme } from './types';

/**
 * Surface themes — the *look* of the app.
 *
 * Adding a new theme:
 *   1. Add an entry below with every field from SurfaceTheme.
 *   2. Extend SurfaceName in types.ts with the new key.
 *   3. Update listSurfaceNames() to include it (or just add to the union).
 */
export const SURFACES: Record<SurfaceName, SurfaceTheme> = {

	// ── Light (default) — warm, earthy, calm ───────────────────────────────
	light: {
		paper:      '#F6F4EE',
		card:       '#FFFFFF',
		chip:       '#EEEBE3',
		ink:        '#272420',
		muted:      '#988F81',
		line:       'rgba(0,0,0,0.08)',
		empty:      'rgba(0,0,0,0.04)',
		emptyLine:  'rgba(0,0,0,0.05)',
		future:     'rgba(0,0,0,0.022)',
		accent:     '#BC6A45',
		pageBgFrom: '#EFEBE1',
		pageBgTo:   '#E4DFD3',
	},

	// ── Dark — same earthy family, warm darks (not cold gray-black) ──────
	dark: {
		paper:      '#1C1A16',
		card:       '#26231E',
		chip:       '#2F2B25',
		ink:        '#F0EDE3',
		muted:      '#8B8270',
		line:       'rgba(255,255,255,0.10)',
		empty:      'rgba(255,255,255,0.04)',
		emptyLine:  'rgba(255,255,255,0.06)',
		future:     'rgba(255,255,255,0.022)',
		accent:     '#D78564',
		pageBgFrom: '#15130F',
		pageBgTo:   '#0F0D0A',
	},
};

export const listSurfaceNames = (): SurfaceName[] =>
	Object.keys(SURFACES) as SurfaceName[];
