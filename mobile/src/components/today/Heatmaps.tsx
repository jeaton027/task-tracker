import { StyleSheet, Text, View } from 'react-native';

import { mixColors } from '../../utils/color';
import { FONTS, useTheme } from '../../theme';
import { WEEK_LABELS_SHORT } from '../../utils/dates';
import type { SurfaceTheme } from '../../theme';
import type { HeatmapCell } from '../../api/adapter';

// Su..Sa weekday labels for the small day-label rows under the heatmaps.
const WEEK = WEEK_LABELS_SHORT;

/**
 * Heatmap cell colors — continuous level from 0..1.
 *
 *   -1        future cell (dashed border, no fill)
 *    0        empty / no progress — light grey
 *    0..1     partial → full — habit color mixed proportionally
 */
function cellColor(level: number, color: string, surfaces: SurfaceTheme): string {
	if (level === -1) return surfaces.empty;
	if (level <= 0)   return surfaces.chip;
	return mixColors(color, surfaces.card, level);
}

function cellBorder(level: number, surfaces: SurfaceTheme):
	{ borderWidth: number; borderStyle: 'solid' | 'dashed'; borderColor: string } | null {
	if (level === -1) return { borderWidth: 1, borderStyle: 'dashed', borderColor: surfaces.emptyLine };
	return null;
}

const TODAY_BORDER = { borderWidth: 1.5, borderStyle: 'solid' as const };

// ── Week (7 cells in a row, starting from WEEK_START_DAY, today outlined) ──
export function WeekMap({ color, cells, todayIndex }: { color: string; cells: HeatmapCell[]; todayIndex?: number }) {
	const { colors } = useTheme();
	return (
		<View style={styles.weekRow}>
			{WEEK.map((wl, i) => {
				const lv = cells[i]?.level ?? 0;
				const border = cellBorder(lv, colors);
				const isToday = todayIndex != null && i === todayIndex;
				return (
					<View key={i} style={styles.weekCol}>
						<View
							style={[
								styles.weekCell,
								{ backgroundColor: cellColor(lv, color, colors) },
								border,
								isToday ? { ...TODAY_BORDER, borderColor: colors.ink } : null,
							]}
						/>
						<Text style={[styles.weekLabel, { color: colors.ink }]}>{wl}</Text>
					</View>
				);
			})}
		</View>
	);
}

// ── Month ───────────────────────────────────────────────────────────────
/**
 * Grid auto-sizes to fit MONTH_OFFSET + the data length.
 *   - June 2026 (30 days, starts Monday)  -> 5 rows
 *   - 31 days starting Friday             -> 6 rows (handled automatically)
 *
 * Layout uses row-of-flex-cells instead of percentage widths — RN is
 * inconsistent with sub-pixel percentage parsing, which was causing some
 * cells to drop off in the previous version.
 */
export function MonthMap({
	color, cells, monthOffset = 0, todayIndex,
}: {
	color: string;
	cells: HeatmapCell[];
	monthOffset?: number;
	todayIndex?: number;
}) {
	const { colors } = useTheme();
	const totalCells = monthOffset + cells.length;
	const rows = Math.ceil(totalCells / 7);

	return (
		<View>
			<View style={styles.monthHeaderRow}>
				{WEEK.map((w, i) => (
					<Text key={i} style={[styles.monthHeaderLabel, { color: colors.ink }]}>
						{w}
					</Text>
				))}
			</View>

			{Array.from({ length: rows }).map((_, row) => (
				<View key={row} style={styles.monthDayRow}>
					{Array.from({ length: 7 }).map((_, col) => {
						const i = row * 7 + col;
						const d = i - monthOffset;
						const inMonth = d >= 0 && d < cells.length;

						if (!inMonth) {
							return <View key={col} style={styles.monthCellSlot} />;
						}

						const lv = cells[d].level;
						const isToday = todayIndex != null && d === todayIndex;

						return (
							<View key={col} style={styles.monthCellSlot}>
								<View
									style={[
										styles.monthCell,
										{ backgroundColor: cellColor(lv, color, colors) },
										cellBorder(lv, colors),
										isToday ? { ...TODAY_BORDER, borderColor: colors.ink } : null,
									]}
								/>
							</View>
						);
					})}
				</View>
			))}
		</View>
	);
}

// ── Year (7 rows × N cols, GitHub-style heatmap) ───────────────────────
export function YearMap({
	color, cells, todayIndex, yearStartOffset = 0,
}: {
	color: string;
	cells: HeatmapCell[];
	todayIndex?: number;
	/** Empty rows to prepend so Jan 1 lands in the correct weekday row. */
	yearStartOffset?: number;
}) {
	const { colors } = useTheme();
	const totalSlots = yearStartOffset + cells.length;
	const numCols = Math.ceil(totalSlots / 7);

	const columns = Array.from({ length: numCols }, (_, col) =>
		Array.from({ length: 7 }, (_, row) => {
			const slot = col * 7 + row;
			const dataIdx = slot - yearStartOffset;
			if (dataIdx < 0 || dataIdx >= cells.length) return null;
			return { cell: cells[dataIdx], dataIdx };
		}),
	);

	return (
		<View style={styles.yearRow}>
			{columns.map((column, col) => (
				<View key={col} style={styles.yearCol}>
					{column.map((entry, row) => {
						if (!entry) return <View key={row} style={styles.yearCell} />;
						const { cell, dataIdx } = entry;
						const isToday = todayIndex != null && dataIdx === todayIndex;
						return (
							<View
								key={row}
								style={[
									styles.yearCell,
									{ backgroundColor: cellColor(cell.level, color, colors) },
									cellBorder(cell.level, colors),
									isToday ? { ...TODAY_BORDER, borderColor: colors.ink } : null,
								]}
							/>
						);
					})}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	// Week
	weekRow:  { flexDirection: 'row', gap: 5 },
	weekCol:  { flex: 1, alignItems: 'stretch' },
	weekCell: { height: 16, borderRadius: 4 },
	weekLabel: {
		marginTop:  4,
		textAlign:  'center',
		fontFamily: FONTS.body.regular,
		fontSize:   10,
	},

	// Month
	monthHeaderRow: {
		flexDirection: 'row',
		marginBottom:  4,
	},
	monthHeaderLabel: {
		flex:       1,
		textAlign:  'center',
		fontFamily: FONTS.body.regular,
		fontSize:   9,
	},
	monthDayRow: {
		flexDirection: 'row',
		gap:           4,
		marginBottom:  4,
	},
	monthCellSlot: {
		// flex:1 + gap on the row gives each cell exactly (rowWidth - 24) / 7
		// no matter the container width. Avoids percent-string parsing flakiness.
		flex:    1,
	},
	monthCell: {
		height:       9,
		borderRadius: 3,
	},

	// Year
	yearRow: { flexDirection: 'row', gap: 2 },
	yearCol: { flex: 1, gap: 2 },
	yearCell: {
		aspectRatio:  1,
		borderRadius: 2,
	},
});
