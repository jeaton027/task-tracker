import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Icon } from '../ui/Icon';
import { useTheme } from '../../theme';

/**
 * The log/progress button at the right of each habit row.
 *
 * Two states, no progress mid-states:
 *   - Not complete: grey outline, optionally split into N equal segments
 *     positioned at clock-face angles (12, 6 for N=2; 12, 4, 8 for N=3, etc).
 *     N comes from the habit's target — capped at 10. Continuous habits
 *     (min, steps) collapse to N=1 (a single unbroken outline).
 *   - Complete: solid filled square in the habit color with a check icon.
 *
 * Progress between 0 and complete shows in the text alongside, not on the
 * button itself.
 */
interface StatusButtonProps {
	color:  string;       // habit color (used only on the complete fill)
	done:   number;
	target: number;
	unit:   string;
	mode?:  'DO' | 'AVOID';
	auto?:  boolean;      // device-tracked habits show a refresh glyph
	size?:  number;
	onPress?: () => void;
}

export function StatusButton({
	color, done, target, unit, mode = 'DO', auto, size = 40, onPress,
}: StatusButtonProps) {
	const { colors } = useTheme();
	const isAvoid = mode === 'AVOID';

	// DO: complete when done >= target
	// AVOID: "failed" when done > target (exceeded the limit)
	const complete = isAvoid ? false : done >= target;
	const exceeded = isAvoid && done > target;

	// Discrete = countable slots (e.g. "2 times"). Continuous (min, steps)
	// always renders as a single unbroken outline.
	const isCountable = unit === 'times' || unit === 'time';
	const N = isCountable ? Math.min(Math.max(target, 1), 10) : 1;

	const sw = 6;
	const R = 13;

	// AVOID: segments represent remaining allowance — start full, deplete.
	// DO: segments represent progress toward target — start empty, fill.
	let filled: number;
	if (isAvoid) {
		const remaining = Math.max(target - done, 0);
		filled = N < target
			? Math.min(Math.round((remaining / target) * N), N)
			: Math.min(remaining, N);
	} else {
		filled = N < target
			? Math.min(Math.round((done / target) * N), N)
			: Math.min(done, N);
	}

	return (
		<Pressable onPress={onPress} style={[styles.btn, { width: size, height: size }]}>
			<Svg width={size} height={size} viewBox="0 0 100 100">
				{complete ? (
					<Rect
						x={4} y={4}
						width={92} height={92}
						rx={R + 1}
						fill={color}
					/>
				) : exceeded ? (
					<Rect
						x={4} y={4}
						width={92} height={92}
						rx={R + 1}
						fill={colors.muted}
					/>
				) : (
					<>
						{/* Background: full segmented border in muted color */}
						<Rect
							x={6} y={6}
							width={88} height={88}
							rx={R}
							fill="none"
							stroke={colors.muted}
							strokeWidth={sw}
							strokeLinecap="butt"

							{...segmentPattern(N)}
						/>
						{/* Foreground: filled segments in habit color */}
						{filled > 0 && (
							<Rect
								x={6} y={6}
								width={88} height={88}
								rx={R}
								fill="none"
								stroke={color}
								strokeWidth={sw}
								strokeLinecap="butt"

								{...filledSegmentPattern(N, filled)}
							/>
						)}
					</>
				)}
			</Svg>
			<View style={StyleSheet.absoluteFill} pointerEvents="none">
				<View style={styles.iconCenter}>
					<Icon
						name={complete ? 'check' : exceeded ? 'close' : auto ? 'refresh' : 'plus'}
						size={complete || exceeded ? 22 : 18}
						color={complete ? colors.card : exceeded ? colors.card : colors.ink}
						strokeWidth={2.2}
					/>
				</View>
			</View>
		</Pressable>
	);
}

/**
 * Stroke-dash patterns with gaps at clock-face positions.
 *
 * react-native-svg ignores `pathLength`, so we compute everything in
 * real perimeter units. Gaps are placed at true clock positions (12, 6
 * for N=2; 12, 4, 8 for N=3; etc.) by mapping clock angles to actual
 * perimeter positions on the rounded rectangle — straight edges and
 * corner arcs have different length-per-angle ratios, so uniform
 * perimeter spacing ≠ uniform angular spacing.
 */
const RECT_W = 88;
const CORNER_R = 13;
const STRAIGHT = RECT_W - 2 * CORNER_R;      // 62
const ARC_LEN  = (Math.PI * CORNER_R) / 2;   // quarter-circle ≈ 20.42
const PERIMETER = 4 * STRAIGHT + 4 * ARC_LEN; // ≈ 329.68
const GAP_PX = PERIMETER * 0.03;              // visible gap width ≈ 9.9

// Angle (degrees, 0=up/12-o'clock, clockwise) where each straight edge
// meets its corner arc, measured from the rect center.
const CORNER_ANGLE = Math.atan2(STRAIGHT / 2, RECT_W / 2) * (180 / Math.PI); // ≈ 35.1°

/**
 * Convert a clock-face angle (0°=12 o'clock, clockwise) to a perimeter
 * position (0 = SVG rect path start = left end of top edge).
 */
function angleToPerimeter(deg: number): number {
	let a = ((deg % 360) + 360) % 360;
	const ca = CORNER_ANGLE;

	// Perimeter segments: [angleStart, angleEnd, perimStart, perimEnd]
	// Top straight wraps 0°, so handle specially.
	const segs: [number, number, number, number][] = [
		[0,       ca,       STRAIGHT / 2,                  STRAIGHT],
		[ca,      90 - ca,  STRAIGHT,                      STRAIGHT + ARC_LEN],
		[90 - ca, 90 + ca,  STRAIGHT + ARC_LEN,            2 * STRAIGHT + ARC_LEN],
		[90 + ca, 180 - ca, 2 * STRAIGHT + ARC_LEN,        2 * STRAIGHT + 2 * ARC_LEN],
		[180 - ca, 180 + ca, 2 * STRAIGHT + 2 * ARC_LEN,   3 * STRAIGHT + 2 * ARC_LEN],
		[180 + ca, 270 - ca, 3 * STRAIGHT + 2 * ARC_LEN,   3 * STRAIGHT + 3 * ARC_LEN],
		[270 - ca, 270 + ca, 3 * STRAIGHT + 3 * ARC_LEN,   4 * STRAIGHT + 3 * ARC_LEN],
		[270 + ca, 360 - ca, 4 * STRAIGHT + 3 * ARC_LEN,   PERIMETER],
	];

	// Top-left quadrant before 0°: map 360-ca..360 → perim 0..STRAIGHT/2
	if (a >= 360 - ca) {
		const t = (a - (360 - ca)) / (ca);  // ca degrees of arc, then partial straight
		// This piece is the TL arc (last segment) bleeding into the top straight.
		// Actually: 360-ca to 360 is the TL arc's second half? No — let me re-derive.
		// The TL arc spans 270+ca to 360-ca. After that (360-ca to 360) is the
		// start of the top straight edge (going from left end to center = STRAIGHT/2).
		const t2 = (a - (360 - ca)) / ca;
		return t2 * (STRAIGHT / 2);
	}

	for (const [sa, ea, sp, ep] of segs) {
		if (a >= sa && a <= ea) {
			const t = (a - sa) / (ea - sa);
			return sp + t * (ep - sp);
		}
	}
	return 0;
}

/**
 * Compute gap center positions on the perimeter for N equally-spaced
 * clock-face breaks, starting at 12 o'clock.
 */
function gapPositions(N: number): number[] {
	const positions: number[] = [];
	for (let i = 0; i < N; i++) {
		const deg = (i * 360) / N;   // 0°, 180° for N=2; 0°, 120°, 240° for N=3, etc.
		positions.push(angleToPerimeter(deg));
	}
	return positions;
}

/**
 * Build the muted-background stroke-dasharray by walking from perimeter
 * position 0 (SVG rect path start = left end of top edge). No offset
 * needed — gaps land at the correct absolute positions automatically.
 */
function segmentPattern(N: number): {
	strokeDasharray?: string;
} {
	if (N <= 1) return {};

	const gaps = gapPositions(N);
	const halfGap = GAP_PX / 2;
	const dashes: number[] = [];
	let pos = 0;

	for (const gc of gaps) {
		dashes.push(gc - halfGap - pos);   // visible segment
		dashes.push(GAP_PX);               // gap
		pos = gc + halfGap;
	}
	// Final visible segment (wraps from last gap back to start)
	dashes.push(PERIMETER - pos);
	dashes.push(0);                        // zero gap keeps array even-length

	return { strokeDasharray: dashes.join(' ') };
}

/**
 * Dash pattern that draws only the first `filled` clock-wise segments
 * in the habit color. Uses the same gap positions as segmentPattern.
 *
 * Walking from perimeter 0 the visible pieces map to logical segments:
 *   piece 0  (before gap[0])           → logical seg N-1
 *   piece j  (between gap[j-1]..gap[j])→ logical seg j-1
 *   piece N  (after gap[N-1])          → logical seg N-1
 *
 * Pieces whose logical index < filled are drawn; others are transparent.
 */
function filledSegmentPattern(N: number, filled: number): {
	strokeDasharray: string;
} {
	if (N <= 1) {
		return { strokeDasharray: `${PERIMETER} 0` };
	}

	const gaps = gapPositions(N);
	const halfGap = GAP_PX / 2;

	// Build piece list: { length, isFilled, gapAfter }
	const pieces: { len: number; on: boolean; gap: number }[] = [];
	let pos = 0;

	// Piece 0: 0 → gap[0]−hg, logical segment N−1
	pieces.push({ len: gaps[0] - halfGap, on: N - 1 < filled, gap: GAP_PX });
	pos = gaps[0] + halfGap;

	// Pieces 1…N-1: between consecutive gaps, logical segment j-1
	for (let j = 1; j < N; j++) {
		pieces.push({ len: gaps[j] - halfGap - pos, on: j - 1 < filled, gap: GAP_PX });
		pos = gaps[j] + halfGap;
	}

	// Piece N: gap[N-1]+hg → PERIMETER, logical segment N−1
	pieces.push({ len: PERIMETER - pos, on: N - 1 < filled, gap: 0 });

	// Convert to dasharray: filled pieces become visible dashes,
	// unfilled pieces are merged into adjacent invisible gaps.
	const dashes: number[] = [];
	let invisAcc = 0;

	for (const p of pieces) {
		if (p.on) {
			// Flush accumulated invisible length
			if (invisAcc > 0) {
				if (dashes.length === 0) {
					dashes.push(0, invisAcc);      // zero-length dash + gap
				} else {
					dashes[dashes.length - 1] += invisAcc;  // extend last gap
				}
			}
			invisAcc = 0;
			dashes.push(p.len, p.gap);
		} else {
			invisAcc += p.len + p.gap;
		}
	}

	if (dashes.length === 0) {
		return { strokeDasharray: `0 ${PERIMETER * 2}` };
	}

	// Add remaining invisible + oversized safety gap to prevent repeat
	dashes[dashes.length - 1] += invisAcc + PERIMETER * 2;

	// Ensure even length (SVG doubles odd-length arrays)
	if (dashes.length % 2 !== 0) dashes.push(0);

	return { strokeDasharray: dashes.join(' ') };
}

const styles = StyleSheet.create({
	btn: {
		position:       'relative',
		alignItems:     'center',
		justifyContent: 'center',
	},
	iconCenter: {
		flex:           1,
		alignItems:     'center',
		justifyContent: 'center',
	},
});
