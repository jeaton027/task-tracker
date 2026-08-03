import { useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useQueries } from '@tanstack/react-query';

import { useAllHabits, useWeeklyCalendar } from '../api/queries';
import { calendar } from '../api/endpoints';
import type {
	CalendarDay,
	HabitResponse,
	HabitSection,
	MonthlyCalendarResponse,
	WeeklyCalendarItem,
} from '../api/types';
import { FONTS, RADII, useTheme } from '../theme';
import {
	isoDate,
	isoMonth,
	monthFirstDayOffset,
	MONTH_NAMES,
	WEEK_LABELS_SHORT,
	WEEK_START_DAY,
} from '../utils/dates';

// ── Types ──────────────────────────────────────────────────────────────

type CalView = 'Week' | 'Month';

const SECTIONS: { key: HabitSection; label: string }[] = [
	{ key: 'MORNING',   label: 'Morning' },
	{ key: 'AFTERNOON', label: 'Day' },
	{ key: 'EVENING',   label: 'Evening' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function mondayOfWeek(d: Date): Date {
	const day = d.getDay();
	const offset = (day - WEEK_START_DAY + 7) % 7;
	const mon = new Date(d);
	mon.setDate(d.getDate() - offset);
	mon.setHours(0, 0, 0, 0);
	return mon;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

function daysInMonth(year: number, month0: number): number {
	return new Date(year, month0 + 1, 0).getDate();
}

function isDone(day: CalendarDay): boolean {
	return day.amount > 0 && day.status !== 'NOT_SCHEDULED' && day.status !== 'VACATION';
}

function isPending(day: CalendarDay): boolean {
	return day.status === 'PENDING' && day.amount === 0;
}

// ── Main ───────────────────────────────────────────────────────────────

export function CalendarScreen() {
	const { colors, paletteMap: hexMap } = useTheme();
	const [calView, setCalView] = useState<CalView>('Week');
	const [anchor, setAnchor] = useState(new Date());

	const todayStr = isoDate(new Date());

	// ── Week data ──────────────────────────────────────────────────────
	const weekStart = useMemo(() => mondayOfWeek(anchor), [anchor]);
	const weekDateStr = isoDate(weekStart);
	const weekDates = useMemo(
		() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i))),
		[weekStart],
	);
	const { data: weekData, isLoading: weekLoading } = useWeeklyCalendar(
		calView === 'Week' ? weekDateStr : undefined,
	);

	// ── Month data ─────────────────────────────────────────────────────
	const monthYear = anchor.getFullYear();
	const monthIdx = anchor.getMonth();
	const monthStr = isoMonth(anchor);

	const { data: allHabits } = useAllHabits();
	const sectionedHabits = useMemo(
		() => (allHabits ?? []).filter((h) => h.section != null && h.is_active),
		[allHabits],
	);

	const monthQueries = useQueries({
		queries: calView === 'Month'
			? sectionedHabits.map((h) => ({
				queryKey: ['calendar', 'monthly', h.id, monthStr] as const,
				queryFn: () => calendar.monthly(h.id, monthStr),
				staleTime: 1000 * 30,
			}))
			: [],
	});
	const monthLoading = calView === 'Month' && monthQueries.some((q) => q.isLoading);
	const monthResults: MonthlyCalendarResponse[] = monthQueries
		.filter((q) => q.data != null)
		.map((q) => q.data!);

	// ── Navigation ─────────────────────────────────────────────────────
	const onPrev = () => {
		setAnchor((prev) => {
			if (calView === 'Week') return addDays(prev, -7);
			return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
		});
	};
	const onNext = () => {
		setAnchor((prev) => {
			if (calView === 'Week') return addDays(prev, 7);
			return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
		});
	};
	const onToday = () => setAnchor(new Date());

	// ── Header label ───────────────────────────────────────────────────
	const headerLabel = useMemo(() => {
		if (calView === 'Week') {
			const end = addDays(weekStart, 6);
			const sm = MONTH_NAMES[weekStart.getMonth()];
			const em = MONTH_NAMES[end.getMonth()];
			if (sm === em) return `${sm} ${weekStart.getDate()}–${end.getDate()}`;
			return `${sm} ${weekStart.getDate()} – ${em} ${end.getDate()}`;
		}
		return `${MONTH_NAMES[monthIdx]} ${monthYear}`;
	}, [calView, weekStart, monthIdx, monthYear]);

	// ── Render ──────────────────────────────────────────────────────────
	return (
		<View style={[styles.root, { backgroundColor: colors.paper }]}>
			{/* View toggle */}
			<View style={[styles.toggleRow, { backgroundColor: colors.chip }]}>
				{(['Week', 'Month'] as CalView[]).map((v) => (
					<Pressable
						key={v}
						onPress={() => setCalView(v)}
						style={[
							styles.toggleBtn,
							calView === v && { backgroundColor: colors.card },
						]}
					>
						<Text
							style={[
								styles.toggleLabel,
								{ color: calView === v ? colors.ink : colors.muted },
							]}
						>
							{v}
						</Text>
					</Pressable>
				))}
			</View>

			{/* Period nav */}
			<View style={styles.navRow}>
				<Pressable onPress={onPrev} hitSlop={12}>
					<Text style={[styles.navArrow, { color: colors.ink }]}>‹</Text>
				</Pressable>
				<Pressable onPress={onToday}>
					<Text style={[styles.navLabel, { color: colors.ink }]}>{headerLabel}</Text>
				</Pressable>
				<Pressable onPress={onNext} hitSlop={12}>
					<Text style={[styles.navArrow, { color: colors.ink }]}>›</Text>
				</Pressable>
			</View>

			{(weekLoading || monthLoading) && (
				<View style={styles.center}>
					<ActivityIndicator color={colors.ink} />
				</View>
			)}

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{calView === 'Week' && weekData && (
					<WeekView
						items={weekData}
						weekDates={weekDates}
						todayStr={todayStr}
						hexMap={hexMap}
						colors={colors}
					/>
				)}
				{calView === 'Month' && !monthLoading && (
					<MonthView
						results={monthResults}
						year={monthYear}
						month0={monthIdx}
						todayStr={todayStr}
						hexMap={hexMap}
						colors={colors}
					/>
				)}
			</ScrollView>
		</View>
	);
}

// ── Week View ──────────────────────────────────────────────────────────

function WeekView({
	items,
	weekDates,
	todayStr,
	hexMap,
	colors,
}: {
	items: WeeklyCalendarItem[];
	weekDates: string[];
	todayStr: string;
	hexMap: Record<string, string>;
	colors: any;
}) {
	const grouped = useMemo(() => {
		const map: Record<string, WeeklyCalendarItem[]> = {};
		for (const s of SECTIONS) map[s.key] = [];
		for (const item of items) {
			const sec = item.habit.section;
			if (sec && map[sec]) map[sec].push(item);
		}
		return map;
	}, [items]);

	return (
		<View>
			{/* Day headers */}
			<View style={styles.weekHeaderRow}>
				<View style={styles.weekLabelCol} />
				{weekDates.map((d, i) => {
					const isToday = d === todayStr;
					const dayNum = Number(d.split('-')[2]);
					return (
						<View key={d} style={styles.weekDayCol}>
							<Text style={[styles.weekDayLabel, { color: colors.muted }]}>
								{WEEK_LABELS_SHORT[i]}
							</Text>
							<Text
								style={[
									styles.weekDayNum,
									{ color: isToday ? colors.accent : colors.ink },
									isToday && styles.weekDayNumToday,
								]}
							>
								{dayNum}
							</Text>
						</View>
					);
				})}
			</View>

			{SECTIONS.map(({ key, label }) => {
				const sectionItems = grouped[key];
				if (!sectionItems || sectionItems.length === 0) return null;
				return (
					<View key={key} style={styles.weekSection}>
						<Text style={[styles.sectionLabel, { color: colors.muted }]}>{label}</Text>
						{sectionItems.map((item) => {
							const hex = hexMap[item.habit.color_key ?? ''] ?? colors.accent;
							const backendOffset = (WEEK_START_DAY - 1 + 7) % 7;
							const reordered = Array.from({ length: 7 }, (_, i) => {
								const idx = (backendOffset + i) % 7;
								return item.days[idx];
							});
							return (
								<View key={item.habit.id} style={styles.weekHabitRow}>
									<Text
										style={[styles.weekHabitName, { color: colors.ink }]}
										numberOfLines={1}
									>
										{item.habit.name}
									</Text>
									{reordered.map((day, i) => {
										const done = isDone(day);
										const pending = isPending(day);
										return (
											<View key={i} style={styles.weekDayCol}>
												<View
													style={[
														styles.weekBar,
														done && { backgroundColor: hex },
														pending && {
															backgroundColor: 'transparent',
															borderWidth: 1.5,
															borderColor: hex,
														},
														!done && !pending && {
															backgroundColor: colors.empty,
														},
													]}
												/>
											</View>
										);
									})}
								</View>
							);
						})}
					</View>
				);
			})}
		</View>
	);
}

// ── Month View ─────────────────────────────────────────────────────────

function MonthView({
	results,
	year,
	month0,
	todayStr,
	hexMap,
	colors,
}: {
	results: MonthlyCalendarResponse[];
	year: number;
	month0: number;
	todayStr: string;
	hexMap: Record<string, string>;
	colors: any;
}) {
	const totalDays = daysInMonth(year, month0);
	const firstOffset = monthFirstDayOffset(year, month0);

	const dayMap = useMemo(() => {
		const map: Record<string, { hex: string; done: boolean }[]> = {};
		for (const r of results) {
			const hex = hexMap[r.habit.color_key ?? ''] ?? colors.accent;
			for (const day of r.days) {
				if (!map[day.date]) map[day.date] = [];
				const done = isDone(day);
				const pending = isPending(day);
				if (done || pending) {
					map[day.date].push({ hex, done });
				}
			}
		}
		return map;
	}, [results, hexMap, colors.accent]);

	const cells: (number | null)[] = [];
	for (let i = 0; i < firstOffset; i++) cells.push(null);
	for (let d = 1; d <= totalDays; d++) cells.push(d);
	while (cells.length % 7 !== 0) cells.push(null);

	const weeks: (number | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) {
		weeks.push(cells.slice(i, i + 7));
	}

	return (
		<View>
			{/* Day-of-week headers */}
			<View style={styles.monthHeaderRow}>
				{WEEK_LABELS_SHORT.map((lbl) => (
					<View key={lbl} style={styles.monthDayCol}>
						<Text style={[styles.monthDayLabel, { color: colors.muted }]}>{lbl}</Text>
					</View>
				))}
			</View>

			{weeks.map((week, wi) => (
				<View key={wi} style={styles.monthWeekRow}>
					{week.map((day, di) => {
						if (day == null) {
							return <View key={di} style={styles.monthDayCol} />;
						}
						const dateStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
						const isToday = dateStr === todayStr;
						const dots = dayMap[dateStr] ?? [];

						return (
							<View key={di} style={styles.monthDayCol}>
								<Text
									style={[
										styles.monthDayNum,
										{ color: isToday ? colors.accent : colors.ink },
										isToday && { fontFamily: FONTS.body.bold },
									]}
								>
									{day}
								</Text>
								<View style={styles.dotRow}>
									{dots.slice(0, 4).map((dot, doti) => (
										<View
											key={doti}
											style={[
												styles.dot,
												dot.done
													? { backgroundColor: dot.hex }
													: {
														backgroundColor: 'transparent',
														borderWidth: 1,
														borderColor: dot.hex,
													},
											]}
										/>
									))}
								</View>
							</View>
						);
					})}
				</View>
			))}
		</View>
	);
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},

	// Toggle
	toggleRow: {
		flexDirection: 'row',
		marginHorizontal: 16,
		marginTop: 12,
		borderRadius: RADII.default,
		padding: 2,
	},
	toggleBtn: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 6,
		borderRadius: RADII.default,
	},
	toggleLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},

	// Nav
	navRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	navArrow: {
		fontFamily: FONTS.display.medium,
		fontSize: 24,
		paddingHorizontal: 8,
	},
	navLabel: {
		fontFamily: FONTS.display.semibold,
		fontSize: 16,
	},

	center: {
		paddingVertical: 40,
		alignItems: 'center',
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 24,
	},

	// ── Week view ──────────────────────────────────────────────────────
	weekHeaderRow: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		marginBottom: 4,
	},
	weekLabelCol: {
		width: 100,
	},
	weekDayCol: {
		flex: 1,
		alignItems: 'center',
	},
	weekDayLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
	},
	weekDayNum: {
		fontFamily: FONTS.display.medium,
		fontSize: 13,
		marginTop: 2,
	},
	weekDayNumToday: {
		fontFamily: FONTS.display.bold,
	},

	weekSection: {
		marginTop: 16,
		paddingHorizontal: 16,
	},
	sectionLabel: {
		fontFamily: FONTS.body.semibold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 8,
	},
	weekHabitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
	},
	weekHabitName: {
		width: 100,
		fontFamily: FONTS.body.regular,
		fontSize: 13,
	},
	weekBar: {
		height: 14,
		borderRadius: 3,
		marginHorizontal: 2,
		width: '80%',
	},

	// ── Month view ─────────────────────────────────────────────────────
	monthHeaderRow: {
		flexDirection: 'row',
		paddingHorizontal: 8,
		marginBottom: 4,
	},
	monthDayCol: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 4,
	},
	monthDayLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
	},
	monthWeekRow: {
		flexDirection: 'row',
		paddingHorizontal: 8,
	},
	monthDayNum: {
		fontFamily: FONTS.display.regular,
		fontSize: 13,
		marginTop: 4,
	},
	dotRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		marginTop: 3,
		gap: 2,
		minHeight: 10,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
});
