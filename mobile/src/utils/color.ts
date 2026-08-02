/**
 * Lightweight color helpers. RN has no CSS `color-mix()` so we roll our own.
 *
 * Limitation: works only with 6-digit hex colors (`#RRGGBB`). The surface
 * tokens that use rgba (lines, empty fills) are never an input to mixColors
 * in our use cases — we only mix habit colors (always hex) into surface
 * colors that are also hex (paper, card).
 */

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
	];
}

function clamp(n: number): number {
	return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(n: number): string {
	return clamp(n).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Linear RGB mix. `amountA` is the fraction of color `a` (0..1) in the result.
 * Not perceptually-uniform like oklab, but visually close for our tints.
 */
export function mixColors(a: string, b: string, amountA: number): string {
	const [r1, g1, b1] = hexToRgb(a);
	const [r2, g2, b2] = hexToRgb(b);
	return rgbToHex(
		r1 * amountA + r2 * (1 - amountA),
		g1 * amountA + g2 * (1 - amountA),
		b1 * amountA + b2 * (1 - amountA),
	);
}
