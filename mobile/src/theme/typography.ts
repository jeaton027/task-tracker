/**
 * Typography tokens — named font families for each weight.
 *
 * RN doesn't honour fontWeight when using custom fonts. Each weight is its
 * own font family, loaded via @expo-google-fonts/* in App.tsx.
 *
 * Two families:
 *   body    = Hanken Grotesk  (long-form text, labels)
 *   display = Familjen Grotesk (headings, numbers, UI chrome)
 */

export const FONTS = {
	body: {
		regular:  'HankenGrotesk_400Regular',
		medium:   'HankenGrotesk_500Medium',
		semibold: 'HankenGrotesk_600SemiBold',
		bold:     'HankenGrotesk_700Bold',
	},
	display: {
		regular:  'FamiljenGrotesk_400Regular',
		medium:   'FamiljenGrotesk_500Medium',
		semibold: 'FamiljenGrotesk_600SemiBold',
		bold:     'FamiljenGrotesk_700Bold',
	},
} as const;

export const RADII = {
	default: 4,
	pill:    999,
} as const;
