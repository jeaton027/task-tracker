/**
 * Widget color tokens — mirrors src/theme/surfaces.ts (default surface).
 * Kept as plain hex literals because widget rendering happens headless,
 * outside the ThemeProvider, and the primitive props want hex strings.
 */
export type WidgetTheme = 'light' | 'dark';

export interface WidgetColors {
	paper: `#${string}`;
	card: `#${string}`;
	chip: `#${string}`;
	ink: `#${string}`;
	muted: `#${string}`;
	line: `rgba(${number}, ${number}, ${number}, ${number})`;
}

export const WIDGET_COLORS: Record<WidgetTheme, WidgetColors> = {
	light: {
		paper: '#F6F4EE',
		card: '#FFFFFF',
		chip: '#EEEBE3',
		ink: '#272420',
		muted: '#988F81',
		line: 'rgba(0, 0, 0, 0.08)',
	},
	dark: {
		paper: '#1C1A16',
		card: '#26231E',
		chip: '#2F2B25',
		ink: '#F0EDE3',
		muted: '#8B8270',
		line: 'rgba(255, 255, 255, 0.10)',
	},
};
