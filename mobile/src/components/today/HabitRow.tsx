import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Icon } from '../ui/Icon';
import { StatusButton } from './StatusButton';
import { WeekMap, MonthMap, YearMap } from './Heatmaps';
import { FONTS, RADII, useTheme } from '../../theme';
import { mixColors } from '../../utils/color';
import { formatNumber, isoDate, isoMonth, monthFirstDayOffset } from '../../utils/dates';
import { calendar } from '../../api/endpoints';
import { toMonthHeatmap } from '../../api/adapter';
import type { HabitView, WeekHeatmapData, YearHeatmapData } from '../../api/adapter';
import type { TodayView } from './ViewToggle';

const STATUS_BUTTON_SIZE = 40;

interface HabitRowProps {
	habit:        HabitView;
	view:         TodayView;
	viewingDate?: Date;
	weekHeatmap?: WeekHeatmapData;
	yearHeatmap?: YearHeatmapData;
	onPress?:     () => void;
	onLog?:       () => void;
	onLongPress?: () => void;
}

export function HabitRow({ habit: h, view, viewingDate, weekHeatmap, yearHeatmap, onPress, onLog, onLongPress }: HabitRowProps) {
	const { colors, paletteMap } = useTheme();
	const color = paletteMap[h.colorKey] ?? colors.muted;
	const isAvoid = h.mode === 'AVOID';
	const complete = isAvoid ? false : h.done >= h.target;
	const exceeded = isAvoid && h.done > h.target;
	const showWeeklyDots = view === 'Today' && h.perWeek != null;

	const cardBg = exceeded
		? mixColors(colors.muted, colors.card, 0.1)
		: complete
			? mixColors(color, colors.card, 0.07)
			: colors.card;

	// Month view: per-habit fetch
	const monthStr = viewingDate ? isoMonth(viewingDate) : undefined;
	const monthQ = useQuery({
		queryKey: ['calendar', 'monthly', h.id, monthStr],
		queryFn:  () => calendar.monthly(h.id, monthStr!),
		enabled:  view === 'Month' && !!monthStr,
		staleTime: 1000 * 30,
	});

	const todayStr = isoDate(new Date());

	const heatmap = (() => {
		if (view === 'Week' && weekHeatmap) {
			return <WeekMap color={color} cells={weekHeatmap.cells} todayIndex={weekHeatmap.todayIndex} />;
		}
		if (view === 'Month' && monthQ.data) {
			const month = toMonthHeatmap(monthQ.data.days, h.target, h.frequency, todayStr);
			const offset = viewingDate
				? monthFirstDayOffset(viewingDate.getFullYear(), viewingDate.getMonth())
				: 0;
			return <MonthMap color={color} cells={month.cells} monthOffset={offset} todayIndex={month.todayIndex} />;
		}
		if (view === 'Year' && yearHeatmap) {
			return <YearMap color={color} cells={yearHeatmap.cells} todayIndex={yearHeatmap.todayIndex} yearStartOffset={yearHeatmap.yearStartOffset} />;
		}
		return null;
	})();

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			delayLongPress={400}
			style={[
				styles.card,
				{
					backgroundColor: cardBg,
					borderColor:     colors.line,
					paddingTop:      9,
					paddingBottom:   9,
				},
			]}
		>
			<View style={styles.row}>
				<ColorDot color={color} />
				<Text
					style={[
						styles.name,
						{
							color: exceeded ? colors.muted : colors.ink,
							textDecorationLine: complete ? 'line-through' : 'none',
						},
					]}
					numberOfLines={1}
				>
					{h.name}
				</Text>

				<StreakChip n={h.streak} color={color} />

				<View style={styles.spacer} />

				<Metric habit={h} color={color} />

				{showWeeklyDots && h.perWeek != null && (
					<WeeklyDots
						n={h.perWeek}
						done={h.weekDone ?? 0}
						color={color}
						height={STATUS_BUTTON_SIZE}
					/>
				)}

				<StatusButton
					color={color}
					done={h.done}
					target={h.target}
					unit={h.unit}
					mode={h.mode}
					auto={h.auto}
					size={STATUS_BUTTON_SIZE}
					onPress={onLog}
				/>
			</View>

			{heatmap && (
				<View style={styles.heatmapContainer}>
					{heatmap}
				</View>
			)}
		</Pressable>
	);
}

// ── Sub-components ──────────────────────────────────────────────────────

function ColorDot({ color, size = 13 }: { color: string; size?: number }) {
	return (
		<View
			style={{
				width: size, height: size,
				borderRadius: 4,
				backgroundColor: color,
			}}
		/>
	);
}

function StreakChip({ n, color }: { n: number; color: string }) {
	const { colors } = useTheme();
	const on = n > 0;
	return (
		<View style={[styles.streakChip, { backgroundColor: colors.chip }]}>
			<Text style={{ fontFamily: FONTS.display.regular, fontSize: 12, color: colors.ink }}>
				{n}
			</Text>
			<Icon
				name="flame"
				size={13}
				color={on ? color : colors.ink}
				fill={on ? color : 'none'}
				strokeWidth={1.6}
			/>
		</View>
	);
}

/**
 * Vertical stack of progress dots (for "Nx per week" habits).
 * Container height matches the StatusButton.
 */
function WeeklyDots({
	n, done, color, height,
}: {
	n: number; done: number; color: string; height: number;
}) {
	const { colors } = useTheme();
	const dotHeight = 12 - ((n - 2) / (6 - 2)) * (12 - 3);
	return (
		<View style={[styles.weeklyDots, { height }]}>
			{Array.from({ length: n }).map((_, i) => {
				const filled = i < done;
				return (
					<View
						key={i}
						style={{
							width: 6, height: dotHeight, borderRadius: 2,
							backgroundColor: filled ? color : colors.empty,
							borderWidth: filled ? 0 : 1,
							borderColor: filled ? 'transparent' : colors.line,
						}}
					/>
				);
			})}
		</View>
	);
}

function Metric({ habit: h, color }: { habit: HabitView; color: string }) {
	const { colors } = useTheme();
	const isAvoid = h.mode === 'AVOID';
	const complete = isAvoid ? false : h.done >= h.target;
	const exceeded = isAvoid && h.done > h.target;
	return (
		<Text style={[styles.metric, { color: colors.ink }]} numberOfLines={1}>
			<Text style={{ color: exceeded ? colors.muted : complete ? color : colors.ink }}>
				{formatNumber(h.done)}
			</Text>
			{` / ${formatNumber(h.target)}`}
			{h.unit ? ` ${h.unit}` : ''}
		</Text>
	);
}

const styles = StyleSheet.create({
	card: {
		paddingHorizontal: 13,
		borderWidth:       1,
		borderRadius:      RADII.default,
	},
	row: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           9,
		height:        STATUS_BUTTON_SIZE,
	},
	name: {
		fontFamily:    FONTS.display.regular,
		fontSize:      15,
		letterSpacing: -0.2,
	},
	spacer: {
		flex:     1,
		minWidth: 8,
	},
	streakChip: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           3,
		paddingVertical:   4,
		paddingHorizontal: 7,
		borderRadius:  RADII.default,
	},
	weeklyDots: {
		width:           1,
		flexDirection:   'column-reverse',
		justifyContent:  'space-between',
		alignItems:      'center',
	},
	metric: {
		fontFamily: FONTS.body.regular,
		fontSize:   15,
		textAlign:  'right',
	},
	heatmapContainer: {
		marginTop: 6,
	},
});
