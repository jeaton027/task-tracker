import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useQueries } from '@tanstack/react-query';

import { useAllHabits, useCategories, useWeeklyCalendar } from '../api/queries';
import { calendar } from '../api/endpoints';
import type {
	CalendarDay,
	HabitResponse,
	HabitSection,
	MonthlyCalendarResponse,
	WeeklyCalendarItem,
} from '../api/types';
import { Icon } from '../components/ui/Icon';
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

const SECTIONS: { key: HabitSection | 'ANYTIME'; label: string }[] = [
	{ key: 'MORNING',   label: 'Morning' },
	{ key: 'AFTERNOON', label: 'Day' },
	{ key: 'EVENING',   label: 'Evening' },
	{ key: 'ANYTIME',   label: 'Anytime' },
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
	const [filterOpen, setFilterOpen] = useState(false);
	const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string> | null>(null);

	const todayStr = isoDate(new Date());

	// ── Data ────────────────────────────────────────────────────────────
	const { data: allHabits } = useAllHabits();
	const { data: categoriesData } = useCategories();

	const activeHabits = useMemo(
		() => (allHabits ?? []).filter((h) => h.is_active),
		[allHabits],
	);

	// Default: all habits selected
	const visibleIds = selectedHabitIds ?? new Set(activeHabits.map((h) => h.id));

	// ── Filter callbacks ───────────────────────────────────────────────
	const toggleHabit = useCallback((id: string) => {
		setSelectedHabitIds((prev) => {
			const base = prev ?? new Set(activeHabits.map((h) => h.id));
			const next = new Set(base);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, [activeHabits]);

	const toggleCategory = useCallback((categoryId: string) => {
		setSelectedHabitIds((prev) => {
			const base = prev ?? new Set(activeHabits.map((h) => h.id));
			const catHabitIds = activeHabits.filter((h) => h.category_id === categoryId).map((h) => h.id);
			const allSelected = catHabitIds.every((id) => base.has(id));
			const next = new Set(base);
			if (allSelected) {
				for (const id of catHabitIds) next.delete(id);
			} else {
				for (const id of catHabitIds) next.add(id);
			}
			return next;
		});
	}, [activeHabits]);

	const selectAll = useCallback(() => {
		setSelectedHabitIds(null);
	}, []);

	const selectNone = useCallback(() => {
		setSelectedHabitIds(new Set());
	}, []);

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

	const filteredWeekData = useMemo(
		() => weekData?.filter((item) => visibleIds.has(item.habit.id)),
		[weekData, visibleIds],
	);

	// ── Month data ─────────────────────────────────────────────────────
	const monthYear = anchor.getFullYear();
	const monthIdx = anchor.getMonth();
	const monthStr = isoMonth(anchor);

	const monthQueries = useQueries({
		queries: calView === 'Month'
			? activeHabits.map((h) => ({
				queryKey: ['calendar', 'monthly', h.id, monthStr] as const,
				queryFn: () => calendar.monthly(h.id, monthStr),
				staleTime: 1000 * 30,
			}))
			: [],
	});
	const monthLoading = calView === 'Month' && monthQueries.some((q) => q.isLoading);
	const monthResults: MonthlyCalendarResponse[] = monthQueries
		.filter((q) => q.data != null)
		.map((q) => q.data!)
		.filter((r) => visibleIds.has(r.habit.id));

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

	const filterActive = selectedHabitIds != null && selectedHabitIds.size !== activeHabits.length;

	// ── Render ──────────────────────────────────────────────────────────
	return (
		<View style={[styles.root, { backgroundColor: colors.paper }]}>
			{/* View toggle + filter button */}
			<View style={styles.topRow}>
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
				<Pressable
					style={[styles.filterBtn, { borderColor: filterActive ? colors.accent : colors.line }]}
					onPress={() => setFilterOpen(true)}
				>
					<Icon name="list" size={18} color={filterActive ? colors.accent : colors.ink} />
				</Pressable>
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
				{calView === 'Week' && filteredWeekData && (
					<WeekView
						items={filteredWeekData}
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

			<FilterModal
				visible={filterOpen}
				onClose={() => setFilterOpen(false)}
				habits={activeHabits}
				categories={categoriesData ?? []}
				selectedIds={visibleIds}
				onToggleHabit={toggleHabit}
				onToggleCategory={toggleCategory}
				onSelectAll={selectAll}
				onSelectNone={selectNone}
				hexMap={hexMap}
				colors={colors}
			/>
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
	const FREQ_SECTIONS: { key: string; label: string }[] = [
		{ key: 'DAILY',    label: 'Daily' },
		{ key: 'WEEKLY',   label: 'Weekly' },
		{ key: 'MONTHLY',  label: 'Monthly' },
		{ key: 'YEARLY',   label: 'Yearly' },
		{ key: 'INTERVAL', label: 'Interval' },
		{ key: 'AVOID',    label: 'Avoid' },
	];

	const grouped = useMemo(() => {
		const map: Record<string, WeeklyCalendarItem[]> = {};
		for (const s of FREQ_SECTIONS) map[s.key] = [];
		for (const item of items) {
			if (item.habit.mode === 'AVOID') {
				map['AVOID'].push(item);
			} else {
				const freq = item.habit.frequency;
				if (map[freq]) map[freq].push(item);
				else map['DAILY'].push(item);
			}
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

			{FREQ_SECTIONS.map(({ key, label }) => {
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

// ── Filter Modal ──────────────────────────────────────────────────────

function FilterModal({
	visible,
	onClose,
	habits,
	categories,
	selectedIds,
	onToggleHabit,
	onToggleCategory,
	onSelectAll,
	onSelectNone,
	hexMap,
	colors,
}: {
	visible: boolean;
	onClose: () => void;
	habits: HabitResponse[];
	categories: { id: string; name: string }[];
	selectedIds: Set<string>;
	onToggleHabit: (id: string) => void;
	onToggleCategory: (categoryId: string) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
	hexMap: Record<string, string>;
	colors: any;
}) {
	const categoryMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const c of categories) map.set(c.id, c.name);
		return map;
	}, [categories]);

	const habitsByCategory = useMemo(() => {
		const groups: { categoryId: string | null; categoryName: string; habits: HabitResponse[] }[] = [];
		const catGroups = new Map<string, HabitResponse[]>();
		const uncategorized: HabitResponse[] = [];

		for (const h of habits) {
			if (h.category_id) {
				const list = catGroups.get(h.category_id) ?? [];
				list.push(h);
				catGroups.set(h.category_id, list);
			} else {
				uncategorized.push(h);
			}
		}

		for (const c of categories) {
			const list = catGroups.get(c.id);
			if (list && list.length > 0) {
				groups.push({ categoryId: c.id, categoryName: c.name, habits: list });
			}
		}
		if (uncategorized.length > 0) {
			groups.push({ categoryId: null, categoryName: 'Uncategorized', habits: uncategorized });
		}

		return groups;
	}, [habits, categories]);

	const isCategorySelected = useCallback((categoryId: string) => {
		const catHabits = habits.filter((h) => h.category_id === categoryId);
		return catHabits.length > 0 && catHabits.every((h) => selectedIds.has(h.id));
	}, [habits, selectedIds]);

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" transparent>
			<Pressable style={fStyles.overlay} onPress={onClose}>
				<Pressable style={[fStyles.sheet, { backgroundColor: colors.paper }]}>
					<View style={fStyles.header}>
						<Text style={[fStyles.title, { color: colors.ink }]}>Filter Habits</Text>
						<Pressable onPress={onClose} hitSlop={8}>
							<Icon name="close" size={20} color={colors.ink} />
						</Pressable>
					</View>

					<View style={fStyles.quickActions}>
						<Pressable
							style={[fStyles.quickBtn, { borderColor: colors.line }]}
							onPress={onSelectAll}
						>
							<Text style={[fStyles.quickBtnText, { color: colors.ink }]}>All</Text>
						</Pressable>
						<Pressable
							style={[fStyles.quickBtn, { borderColor: colors.line }]}
							onPress={onSelectNone}
						>
							<Text style={[fStyles.quickBtnText, { color: colors.ink }]}>None</Text>
						</Pressable>
					</View>

					<ScrollView
						style={fStyles.list}
						showsVerticalScrollIndicator={false}
					>
						{habitsByCategory.map((group) => (
							<View key={group.categoryId ?? '_none'} style={fStyles.group}>
								{group.categoryId ? (
									<Pressable
										style={fStyles.categoryRow}
										onPress={() => onToggleCategory(group.categoryId!)}
									>
										<View style={[
											fStyles.checkbox,
											{ borderColor: colors.line },
											isCategorySelected(group.categoryId) && { backgroundColor: colors.accent, borderColor: colors.accent },
										]}>
											{isCategorySelected(group.categoryId) && (
												<Icon name="check" size={12} color={colors.paper} strokeWidth={3} />
											)}
										</View>
										<Text style={[fStyles.categoryName, { color: colors.ink }]}>
											{group.categoryName}
										</Text>
									</Pressable>
								) : (
									<Text style={[fStyles.categoryName, fStyles.categoryLabel, { color: colors.muted }]}>
										{group.categoryName}
									</Text>
								)}

								{group.habits.map((h) => {
									const selected = selectedIds.has(h.id);
									const hex = hexMap[h.color_key ?? ''] ?? colors.accent;
									return (
										<Pressable
											key={h.id}
											style={fStyles.habitRow}
											onPress={() => onToggleHabit(h.id)}
										>
											<View style={[
												fStyles.checkbox,
												{ borderColor: colors.line },
												selected && { backgroundColor: hex, borderColor: hex },
											]}>
												{selected && (
													<Icon name="check" size={12} color={colors.paper} strokeWidth={3} />
												)}
											</View>
											<View style={[fStyles.colorDot, { backgroundColor: hex }]} />
											<Text style={[fStyles.habitName, { color: colors.ink }]}>
												{h.name}
											</Text>
										</Pressable>
									);
								})}
							</View>
						))}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const fStyles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'flex-end',
	},
	sheet: {
		maxHeight: '75%',
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 16,
		paddingBottom: 32,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		marginBottom: 12,
	},
	title: {
		fontFamily: FONTS.display.semibold,
		fontSize: 18,
		letterSpacing: -0.3,
	},
	quickActions: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 20,
		marginBottom: 16,
	},
	quickBtn: {
		paddingVertical: 6,
		paddingHorizontal: 14,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	quickBtnText: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},
	list: {
		paddingHorizontal: 20,
	},
	group: {
		marginBottom: 16,
	},
	categoryRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 8,
	},
	categoryLabel: {
		paddingVertical: 8,
	},
	categoryName: {
		fontFamily: FONTS.body.semibold,
		fontSize: 14,
	},
	habitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 7,
		paddingLeft: 8,
	},
	habitName: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		flex: 1,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 4,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	colorDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
});

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},

	// Top row
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 16,
		marginTop: 12,
	},
	filterBtn: {
		width: 36,
		height: 36,
		borderRadius: RADII.default,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},

	// Toggle
	toggleRow: {
		flex: 1,
		flexDirection: 'row',
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
