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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { calendar } from '../api/endpoints';
import {
	useHabit,
	useHabitStats,
	useLogHabit,
	useUnlogHabit,
} from '../api/queries';
import { Icon } from '../components/ui/Icon';
import { mixColors } from '../utils/color';
import { FONTS, RADII, paletteMap, useTheme } from '../theme';
import {
	isoDate,
	isoMonth,
	MONTH_NAMES,
	WEEK_LABELS_SHORT,
	WEEK_START_DAY,
} from '../utils/dates';

interface HabitDetailScreenProps {
	visible: boolean;
	habitId: string | null;
	onClose: () => void;
}

type CalView = 'week' | 'month';

/** "2026-02-03" -> "Feb 3" */
function shortDate(iso: string): string {
	const [, m, d] = iso.split('-').map(Number);
	return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

/** "2026-02" -> "Feb 2026" */
function monthKeyLabel(key: string): string {
	const [y, m] = key.split('-').map(Number);
	return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

function streakRange(s: { start_date?: string | null; end_date?: string | null }): string | undefined {
	if (!s.start_date || !s.end_date) return undefined;
	if (s.start_date === s.end_date) return shortDate(s.start_date);
	return `${shortDate(s.start_date)} – ${shortDate(s.end_date)}`;
}

// ── Date helpers ───────────────────────────────────────────────────────

function weekStartFor(d: Date): Date {
	const offset = (d.getDay() - WEEK_START_DAY + 7) % 7;
	const ws = new Date(d);
	ws.setDate(ws.getDate() - offset);
	ws.setHours(0, 0, 0, 0);
	return ws;
}

function weekDates(anchor: Date): string[] {
	const ws = weekStartFor(anchor);
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(ws);
		d.setDate(ws.getDate() + i);
		return isoDate(d);
	});
}

function monthDates(year: number, month0: number): string[] {
	const days: string[] = [];
	const d = new Date(year, month0, 1);
	while (d.getMonth() === month0) {
		days.push(isoDate(d));
		d.setDate(d.getDate() + 1);
	}
	return days;
}

function monthGridOffset(year: number, month0: number): number {
	const jsDay = new Date(year, month0, 1).getDay();
	return (jsDay - WEEK_START_DAY + 7) % 7;
}

function formatSelectedLabel(iso: string, todayStr: string): string {
	if (iso === todayStr) return 'Today';
	const d = new Date(iso + 'T00:00:00');
	return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function periodDatesForDate(
	iso: string,
	frequency: string,
): [string, string] {
	const d = new Date(iso + 'T00:00:00');
	if (frequency === 'WEEKLY') {
		const monday = new Date(d);
		monday.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		return [isoDate(monday), isoDate(sunday)];
	}
	if (frequency === 'MONTHLY') {
		const first = new Date(d.getFullYear(), d.getMonth(), 1);
		const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
		return [isoDate(first), isoDate(last)];
	}
	if (frequency === 'YEARLY') {
		return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
	}
	return [iso, iso];
}

function sumPeriod(
	dayAmounts: Map<string, number>,
	periodStart: string,
	periodEnd: string,
): number {
	let total = 0;
	for (const [date, amount] of dayAmounts) {
		if (date >= periodStart && date <= periodEnd) total += amount;
	}
	return total;
}

function periodLabel(frequency: string): string {
	if (frequency === 'WEEKLY') return 'this week';
	if (frequency === 'MONTHLY') return 'this month';
	if (frequency === 'YEARLY') return 'this year';
	return '';
}

function weekRangeLabel(anchor: Date): string {
	const ws = weekStartFor(anchor);
	const we = new Date(ws);
	we.setDate(ws.getDate() + 6);
	const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	return `${fmt(ws)} – ${fmt(we)}`;
}

// ── Main component ─────────────────────────────────────────────────────

export function HabitDetailScreen({ visible, habitId, onClose }: HabitDetailScreenProps) {
	const { colors } = useTheme();
	const hexMap = useMemo(() => paletteMap('earthy'), []);

	const [calView, setCalView] = useState<CalView>('week');
	const [anchor, setAnchor] = useState(() => new Date());
	const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));

	const habitQ = useHabit(visible ? habitId : null);
	const statsQ = useHabitStats(visible ? habitId : null);

	const todayStr = useMemo(() => isoDate(new Date()), []);

	// We need the month that contains the anchor for data.
	// For week view, the week might span two months — fetch both if needed.
	const anchorMonthStr = useMemo(() => isoMonth(anchor), [anchor]);
	const monthQ = useQuery({
		queryKey: ['calendar', 'monthly', habitId, anchorMonthStr],
		queryFn: () => calendar.monthly(habitId!, anchorMonthStr),
		enabled: visible && habitId != null,
		staleTime: 1000 * 15,
	});

	// Fetch a second month when the anchor month alone can't cover:
	//   - the visible week in week view, and
	//   - the selected date's habit period — a Mon-Sun week can cross the
	//     month edge in month view too, and logs from the neighboring month
	//     still count toward that week's target.
	const weekDays = useMemo(() => weekDates(anchor), [anchor]);
	const habitFrequency = habitQ.data?.frequency;
	const spansMonth = useMemo(() => {
		const needed = new Set<string>();
		if (calView === 'week' && weekDays.length > 0) {
			needed.add(weekDays[0].slice(0, 7));
			needed.add(weekDays[6].slice(0, 7));
		}
		// YEARLY periods span the whole year — can't cover with one extra fetch
		if (habitFrequency && habitFrequency !== 'YEARLY') {
			const [ps, pe] = periodDatesForDate(selectedDate, habitFrequency);
			needed.add(ps.slice(0, 7));
			needed.add(pe.slice(0, 7));
		}
		needed.delete(anchorMonthStr);
		const [first] = needed;
		return first ?? null;
	}, [calView, weekDays, anchorMonthStr, habitFrequency, selectedDate]);

	const spanMonthQ = useQuery({
		queryKey: ['calendar', 'monthly', habitId, spansMonth],
		queryFn: () => calendar.monthly(habitId!, spansMonth!),
		enabled: visible && habitId != null && spansMonth != null,
		staleTime: 1000 * 15,
	});

	const logHabit = useLogHabit();
	const unlogHabit = useUnlogHabit();

	const habit = habitQ.data;
	const color = habit?.color_key ? hexMap[habit.color_key] ?? colors.muted : colors.muted;

	// Build amount map from all fetched month data
	const dayAmounts = useMemo<Map<string, number>>(() => {
		const map = new Map<string, number>();
		for (const q of [monthQ, spanMonthQ]) {
			if (!q.data) continue;
			for (const day of q.data.days) {
				map.set(day.date, day.amount);
			}
		}
		return map;
	}, [monthQ.data, spanMonthQ.data]);

	const handleAdd = useCallback((date: string) => {
		if (!habitId) return;
		logHabit.mutate({
			habitId,
			body: { log_date: date },
		});
	}, [habitId, logHabit]);

	const handleRemove = useCallback((date: string) => {
		if (!habitId) return;
		unlogHabit.mutate({
			habitId,
			date,
		});
	}, [habitId, unlogHabit]);

	// Navigation
	const goPrev = useCallback(() => {
		setAnchor((a) => {
			const next = new Date(a);
			if (calView === 'week') next.setDate(next.getDate() - 7);
			else next.setMonth(next.getMonth() - 1);
			return next;
		});
	}, [calView]);

	const goNext = useCallback(() => {
		setAnchor((a) => {
			const next = new Date(a);
			if (calView === 'week') next.setDate(next.getDate() + 7);
			else next.setMonth(next.getMonth() + 1);
			// Don't go past today
			const now = new Date();
			if (next > now) return a;
			return next;
		});
	}, [calView]);

	const goToday = useCallback(() => {
		const now = new Date();
		setAnchor(now);
		setSelectedDate(isoDate(now));
	}, []);

	const switchView = useCallback((v: CalView) => {
		setCalView(v);
	}, []);

	if (!visible) return null;

	const loading = habitQ.isLoading || !habit;
	const selectedAmount = dayAmounts.get(selectedDate) ?? 0;
	const target = habit?.target_per_period ?? 1;
	const daysPerWeek = habit?.days_per_week ?? null;
	const frequency = habit?.frequency ?? 'DAILY';
	const isDaily = frequency === 'DAILY';
	const [periodStart, periodEnd] = periodDatesForDate(selectedDate, frequency);
	const rawPeriodTotal = isDaily ? selectedAmount : sumPeriod(dayAmounts, periodStart, periodEnd);

	let periodTotal: number;
	let periodTarget: number;
	let periodComplete: boolean;
	if (daysPerWeek && daysPerWeek > 0) {
		let completedDays = 0;
		for (const [date, amount] of dayAmounts) {
			if (date >= periodStart && date <= periodEnd && amount >= target) {
				completedDays++;
			}
		}
		periodTotal = completedDays;
		periodTarget = daysPerWeek;
		periodComplete = completedDays >= daysPerWeek;
	} else {
		periodTotal = rawPeriodTotal;
		periodTarget = target;
		periodComplete = rawPeriodTotal >= target;
	}

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
				{loading ? (
					<View style={styles.center}>
						<ActivityIndicator color={colors.ink} />
					</View>
				) : (
					<>
						{/* Header */}
						<View style={[styles.header, { borderBottomColor: colors.line }]}>
							<Pressable
								onPress={onClose}
								style={[styles.backBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}
							>
								<Icon name="left" size={19} color={colors.ink} />
							</Pressable>
							<View style={styles.headerCenter}>
								<View style={[styles.colorDot, { backgroundColor: color }]} />
								<Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
									{habit.name}
								</Text>
							</View>
							<View style={styles.backBtn} />
						</View>

						<ScrollView
							style={styles.scroll}
							contentContainerStyle={styles.scrollContent}
							showsVerticalScrollIndicator={false}
						>
							{/* Habit meta */}
							<View style={styles.metaRow}>
								<MetaChip
									label={habit.frequency.charAt(0) + habit.frequency.slice(1).toLowerCase()}
									colors={colors}
								/>
								<MetaChip
									label={`Target: ${habit.target_per_period}`}
									colors={colors}
								/>
								{habit.unit && <MetaChip label={habit.unit} colors={colors} />}
								<MetaChip
									label={habit.mode === 'DO' ? 'Do' : 'Avoid'}
									colors={colors}
								/>
							</View>

							{/* View toggle: Week / Month */}
							<View style={styles.viewToggleRow}>
								<ViewPill
									label="Week"
									active={calView === 'week'}
									color={color}
									colors={colors}
									onPress={() => switchView('week')}
								/>
								<ViewPill
									label="Month"
									active={calView === 'month'}
									color={color}
									colors={colors}
									onPress={() => switchView('month')}
								/>
							</View>

							{/* Navigation: ‹ label › + Today */}
							<View style={styles.navRow}>
								<Pressable onPress={goPrev} style={styles.navArrow}>
									<Icon name="left" size={18} color={colors.ink} />
								</Pressable>
								<Text style={[styles.navLabel, { color: colors.ink }]}>
									{calView === 'week'
										? weekRangeLabel(anchor)
										: `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`}
								</Text>
								<Pressable onPress={goNext} style={styles.navArrow}>
									<Icon name="right" size={18} color={colors.ink} />
								</Pressable>
								<Pressable
									onPress={goToday}
									style={[styles.todayBtn, { borderColor: colors.line }]}
								>
									<Text style={[styles.todayBtnText, { color: colors.ink }]}>Today</Text>
								</Pressable>
							</View>

							{/* Calendar grid */}
							{calView === 'week' ? (
								<WeekGrid
									dates={weekDays}
									dayAmounts={dayAmounts}
									target={target}
									selectedDate={selectedDate}
									todayStr={todayStr}
									color={color}
									colors={colors}
									onSelect={setSelectedDate}
								/>
							) : (
								<MonthGrid
									year={anchor.getFullYear()}
									month0={anchor.getMonth()}
									dayAmounts={dayAmounts}
									target={target}
									selectedDate={selectedDate}
									todayStr={todayStr}
									color={color}
									colors={colors}
									onSelect={setSelectedDate}
								/>
							)}

							{/* +/- controls for selected day */}
							<View style={[styles.controlBar, { borderColor: colors.line }]}>
								<Pressable
									onPress={() => handleRemove(selectedDate)}
									disabled={selectedAmount <= 0}
									style={[
										styles.controlBtn,
										{
											backgroundColor: colors.chip,
											borderColor: colors.line,
											opacity: selectedAmount <= 0 ? 0.35 : 1,
										},
									]}
								>
									<Text style={[styles.controlBtnText, { color: colors.ink }]}>−</Text>
								</Pressable>

								<View style={styles.controlCenter}>
									<Text style={[styles.controlDateLabel, { color: colors.muted }]}>
										{formatSelectedLabel(selectedDate, todayStr)}
									</Text>
									<Text style={[styles.controlAmount, { color: periodComplete ? color : colors.ink }]}>
										{periodTotal}
										<Text style={[styles.controlTarget, { color: colors.muted }]}>
											{' / '}{periodTarget}
											{daysPerWeek ? ` days ${periodLabel(frequency)}` : !isDaily ? ` ${periodLabel(frequency)}` : ''}
										</Text>
									</Text>
									{!isDaily && (selectedAmount > 0 || daysPerWeek) && (
										<Text style={[styles.controlDayDetail, { color: colors.muted }]}>
											{formatSelectedLabel(selectedDate, todayStr)}: {selectedAmount}{daysPerWeek ? ` / ${target}` : ''}{habit?.unit ? ` ${habit.unit}` : ''}
										</Text>
									)}
								</View>

								<Pressable
									onPress={() => handleAdd(selectedDate)}
									disabled={selectedDate > todayStr}
									style={[
										styles.controlBtn,
										{
											backgroundColor: colors.chip,
											borderColor: colors.line,
											opacity: selectedDate > todayStr ? 0.35 : 1,
										},
									]}
								>
									<Text style={[styles.controlBtnText, { color: colors.ink }]}>+</Text>
								</Pressable>
							</View>

							{/* Stats */}
							{statsQ.data && (
								<>
									<Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 24 }]}>
										STREAKS
									</Text>
									<View style={styles.statsGrid}>
										<StatCard
											label="Current"
											value={statsQ.data.current_streak.length}
											sub={streakRange(statsQ.data.current_streak)}
											colors={colors}
											color={color}
										/>
										<StatCard
											label="Best"
											value={statsQ.data.best_streak.length}
											sub={streakRange(statsQ.data.best_streak)}
											colors={colors}
											color={color}
										/>
									</View>

									{(() => {
										const periods = statsQ.data.periods ?? {};
										const cards = (
											[
												['week', 'This week'],
												['month', 'This month'],
												['year', 'This year'],
											] as const
										).map(([key, label]) => {
											const p = periods[key];
											const judged = p?.periods_total ?? 0;
											return {
												key,
												label,
												value: judged > 0 ? `${p!.periods_succeeded}/${judged}` : '—',
												sub:
													judged > 0 && p!.completion_rate != null
														? `${Math.round(p!.completion_rate * 100)}%`
														: undefined,
											};
										});
										// A brand-new habit (or one whose period is longer than a
										// year view) has nothing judged anywhere — skip the row.
										if (cards.every((c) => c.value === '—')) return null;
										return (
											<>
												<Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 20 }]}>
													COMPLETION
												</Text>
												<View style={styles.statsGrid}>
													{cards.map((c) => (
														<StatCard
															key={c.key}
															label={c.label}
															value={c.value}
															sub={c.sub}
															colors={colors}
															color={color}
														/>
													))}
												</View>
											</>
										);
									})()}

									{(() => {
										const allTime = statsQ.data.periods?.all_time;
										if (!allTime) return null;
										return (
											<>
												<Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 20 }]}>
													ALL TIME
												</Text>
												<View style={styles.statsGrid}>
													<StatCard
														label="Total logged"
														value={allTime.events}
														sub={habit?.unit ?? undefined}
														colors={colors}
														color={color}
													/>
													{allTime.completion_rate != null && (
														<StatCard
															label="Rate"
															value={`${Math.round(allTime.completion_rate * 100)}%`}
															sub={`${allTime.periods_succeeded}/${allTime.periods_total} periods`}
															colors={colors}
															color={color}
														/>
													)}
												</View>
											</>
										);
									})()}

									{(() => {
										const rec = statsQ.data.records;
										if (!rec?.best_month && !rec?.best_year) return null;
										const unit = habit?.unit ?? 'logged';
										return (
											<>
												<Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 20 }]}>
													RECORDS
												</Text>
												<View style={styles.statsGrid}>
													{rec.best_month && (
														<StatCard
															label="Best month"
															value={monthKeyLabel(rec.best_month.month)}
															sub={`${Math.round(rec.best_month.count)} ${unit}`}
															colors={colors}
															color={color}
														/>
													)}
													{rec.best_year && (
														<StatCard
															label="Best year"
															value={rec.best_year.year}
															sub={`${Math.round(rec.best_year.count)} ${unit}`}
															colors={colors}
															color={color}
														/>
													)}
												</View>
											</>
										);
									})()}
								</>
							)}
						</ScrollView>
					</>
				)}
			</SafeAreaView>
		</Modal>
	);
}

// ── Sub-components ──────────────────────────────────────────────────────

function MetaChip({ label, colors }: { label: string; colors: any }) {
	return (
		<View style={[styles.metaChip, { backgroundColor: colors.chip }]}>
			<Text style={[styles.metaChipText, { color: colors.ink }]}>{label}</Text>
		</View>
	);
}

function ViewPill({
	label, active, color, colors, onPress,
}: {
	label: string; active: boolean; color: string; colors: any; onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.viewPill,
				{
					backgroundColor: active ? color : colors.chip,
				},
			]}
		>
			<Text style={[styles.viewPillText, { color: active ? '#fff' : colors.ink }]}>
				{label}
			</Text>
		</Pressable>
	);
}

function WeekGrid({
	dates, dayAmounts, target, selectedDate, todayStr, color, colors, onSelect,
}: {
	dates: string[];
	dayAmounts: Map<string, number>;
	target: number;
	selectedDate: string;
	todayStr: string;
	color: string;
	colors: any;
	onSelect: (d: string) => void;
}) {
	return (
		<View style={styles.calGrid}>
			{/* Day-of-week headers */}
			<View style={styles.calHeaderRow}>
				{WEEK_LABELS_SHORT.map((lbl, i) => (
					<View key={i} style={styles.calHeaderCell}>
						<Text style={[styles.calHeaderText, { color: colors.muted }]}>{lbl}</Text>
					</View>
				))}
			</View>
			{/* Day cells */}
			<View style={styles.calRow}>
				{dates.map((iso) => {
					const amount = dayAmounts.get(iso) ?? 0;
					const isFuture = iso > todayStr;
					return (
						<DayCell
							key={iso}
							dayNum={parseInt(iso.slice(8), 10)}
							amount={amount}
							target={target}
							selected={iso === selectedDate}
							isToday={iso === todayStr}
							isFuture={isFuture}
							color={color}
							colors={colors}
							onPress={() => !isFuture && onSelect(iso)}
						/>
					);
				})}
			</View>
		</View>
	);
}

function MonthGrid({
	year, month0, dayAmounts, target, selectedDate, todayStr, color, colors, onSelect,
}: {
	year: number;
	month0: number;
	dayAmounts: Map<string, number>;
	target: number;
	selectedDate: string;
	todayStr: string;
	color: string;
	colors: any;
	onSelect: (d: string) => void;
}) {
	const dates = useMemo(() => monthDates(year, month0), [year, month0]);
	const offset = useMemo(() => monthGridOffset(year, month0), [year, month0]);

	const rows: (string | null)[][] = [];
	let current: (string | null)[] = Array.from({ length: offset }, () => null);
	for (const iso of dates) {
		current.push(iso);
		if (current.length === 7) {
			rows.push(current);
			current = [];
		}
	}
	if (current.length > 0) {
		while (current.length < 7) current.push(null);
		rows.push(current);
	}

	return (
		<View style={styles.calGrid}>
			{/* Day-of-week headers */}
			<View style={styles.calHeaderRow}>
				{WEEK_LABELS_SHORT.map((lbl, i) => (
					<View key={i} style={styles.calHeaderCell}>
						<Text style={[styles.calHeaderText, { color: colors.muted }]}>{lbl}</Text>
					</View>
				))}
			</View>
			{/* Day rows */}
			{rows.map((row, ri) => (
				<View key={ri} style={styles.calRow}>
					{row.map((iso, ci) => {
						if (!iso) {
							return <View key={`empty-${ci}`} style={styles.calCellWrap} />;
						}
						const amount = dayAmounts.get(iso) ?? 0;
						const isFuture = iso > todayStr;
						return (
							<DayCell
								key={iso}
								dayNum={parseInt(iso.slice(8), 10)}
								amount={amount}
								target={target}
								selected={iso === selectedDate}
								isToday={iso === todayStr}
								isFuture={isFuture}
								color={color}
								colors={colors}
								onPress={() => !isFuture && onSelect(iso)}
							/>
						);
					})}
				</View>
			))}
		</View>
	);
}

function DayCell({
	dayNum, amount, target, selected, isToday, isFuture, color, colors, onPress,
}: {
	dayNum: number;
	amount: number;
	target: number;
	selected: boolean;
	isToday: boolean;
	isFuture: boolean;
	color: string;
	colors: any;
	onPress: () => void;
}) {
	const ratio = target > 0 ? Math.min(amount / target, 1) : 0;
	const hasFill = ratio > 0;

	let bg = 'transparent';
	if (hasFill) {
		const intensity = 0.12 + ratio * 0.35;
		bg = mixColors(color, colors.paper, intensity);
	}

	return (
		<View style={styles.calCellWrap}>
			<Pressable
				onPress={onPress}
				disabled={isFuture}
				style={[
					styles.calCell,
					{
						backgroundColor: bg,
						borderWidth: isToday ? 1.5 : 0,
						borderColor: isToday ? color : 'transparent',
						opacity: isFuture ? 0.3 : 1,
					},
				]}
			>
				<Text
					style={[
						styles.calCellText,
						{
							color: colors.ink,
							fontFamily: isToday ? FONTS.display.semibold : FONTS.display.regular,
						},
					]}
				>
					{dayNum}
				</Text>
			</Pressable>
			{selected && (
				<View style={[styles.selectedBar, { backgroundColor: color }]} />
			)}
		</View>
	);
}

function StatCard({
	label, value, colors, color, sub,
}: {
	label: string;
	value: string | number;
	colors: any;
	color: string;
	sub?: string;
}) {
	return (
		<View style={[styles.statCard, { backgroundColor: colors.chip }]}>
			<Text style={[styles.statValue, { color }]}>
				{typeof value === 'number' ? Math.round(value) : value}
			</Text>
			{sub != null && (
				<Text style={[styles.statSub, { color: colors.muted }]} numberOfLines={1}>
					{sub}
				</Text>
			)}
			<Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
		</View>
	);
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: { flex: 1 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: 40 },

	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingTop: 6,
		paddingBottom: 12,
		borderBottomWidth: 1,
	},
	backBtn: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
		borderColor: 'transparent',
	},
	headerCenter: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	colorDot: {
		width: 12,
		height: 12,
		borderRadius: 4,
	},
	title: {
		fontFamily: FONTS.display.regular,
		fontSize: 19,
		letterSpacing: -0.3,
	},

	metaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 8,
	},
	metaChip: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: RADII.default,
	},
	metaChipText: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},

	// View toggle
	viewToggleRow: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 4,
	},
	viewPill: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 16,
	},
	viewPillText: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},

	// Nav row
	navRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 10,
		gap: 6,
	},
	navArrow: {
		width: 32,
		height: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
	navLabel: {
		flex: 1,
		fontFamily: FONTS.display.regular,
		fontSize: 15,
		textAlign: 'center',
	},
	todayBtn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	todayBtnText: {
		fontFamily: FONTS.body.medium,
		fontSize: 12,
	},

	// Calendar grid
	calGrid: {
		paddingHorizontal: 16,
		paddingBottom: 4,
	},
	calHeaderRow: {
		flexDirection: 'row',
	},
	calHeaderCell: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 4,
	},
	calHeaderText: {
		fontFamily: FONTS.body.medium,
		fontSize: 11,
	},
	calRow: {
		flexDirection: 'row',
	},
	calCellWrap: {
		flex: 1,
		aspectRatio: 1,
		padding: 2,
	},
	calCell: {
		flex: 1,
		borderRadius: RADII.default,
		alignItems: 'center',
		justifyContent: 'center',
	},
	calCellText: {
		fontSize: 14,
	},
	selectedBar: {
		height: 3,
		borderRadius: 1.5,
		marginHorizontal: 6,
		marginTop: 2,
	},

	// Control bar
	controlBar: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 20,
		marginTop: 12,
		paddingVertical: 14,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		gap: 16,
	},
	controlBtn: {
		width: 44,
		height: 44,
		borderRadius: RADII.default,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	controlBtnText: {
		fontFamily: FONTS.display.medium,
		fontSize: 22,
		lineHeight: 24,
	},
	controlCenter: {
		flex: 1,
		alignItems: 'center',
	},
	controlDateLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginBottom: 2,
	},
	controlAmount: {
		fontFamily: FONTS.display.semibold,
		fontSize: 22,
		letterSpacing: -0.3,
	},
	controlTarget: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	controlDayDetail: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginTop: 2,
	},

	sectionLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 10,
	},

	statsGrid: {
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 20,
	},
	statCard: {
		flex: 1,
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	statSub: {
		fontFamily: FONTS.body.regular,
		fontSize: 10,
		marginTop: 1,
	},
	statValue: {
		fontFamily: FONTS.display.semibold,
		fontSize: 24,
		letterSpacing: -0.5,
	},
	statLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginTop: 2,
	},
});
