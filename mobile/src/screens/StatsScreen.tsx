import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Dimensions,
	Modal,
	PanResponder,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import { useStatsOverview, useStatsTrends } from '../api/queries';
import type { HabitSummary, TrendPoint } from '../api/types';
import { Icon } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';
import { isoDate, weekStartDate } from '../utils/dates';

const MAX_TREND_SLOTS = 4;

// ── Types ──────────────────────────────────────────────────────────────

type StatsTab = 'Summary' | 'Trends' | 'Habits' | 'Limits';
const TABS: StatsTab[] = ['Summary', 'Trends', 'Habits', 'Limits'];

type TrendSeries = {
	key: string;
	label: string;
	color: string;
	points: TrendPoint[];
};

type TimePeriod = 'week' | 'month' | 'year' | 'all';
const PERIODS: { key: TimePeriod; label: string }[] = [
	{ key: 'week',  label: 'Week' },
	{ key: 'month', label: 'Month' },
	{ key: 'year',  label: 'Year' },
	{ key: 'all',   label: 'All' },
];

/** Calendar-aligned range starts, matching how periods are judged:
 * week = this week's Monday, month = the 1st, year = Jan 1. */
function periodStartDate(period: TimePeriod): string | undefined {
	if (period === 'all') return undefined;
	if (period === 'week') return weekStartDate();
	const d = new Date();
	if (period === 'month') return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
	return isoDate(new Date(d.getFullYear(), 0, 1));
}

// ── Main ───────────────────────────────────────────────────────────────

export function StatsScreen() {
	const { colors, paletteMap: hexMap } = useTheme();

	const [tab, setTab] = useState<StatsTab>('Summary');
	const [period, setPeriod] = useState<TimePeriod>('month');
	const [trendsSlots, setTrendsSlots] = useState<string[]>([]);
	const [trendsActive, setTrendsActive] = useState<string[] | undefined>();
	const [trendsInitialized, setTrendsInitialized] = useState(false);

	const startStr = periodStartDate(period);
	const overviewQ = useStatsOverview(startStr);
	const trendsQ = useStatsTrends(startStr, undefined, trendsActive);

	useEffect(() => {
		if (trendsInitialized || !overviewQ.data?.habits?.length) return;
		const top4 = [...overviewQ.data.habits]
			.sort((a, b) => (b.completion_rate ?? -1) - (a.completion_rate ?? -1))
			.slice(0, MAX_TREND_SLOTS)
			.map((h) => h.id);
		setTrendsSlots(top4);
		setTrendsInitialized(true);
	}, [overviewQ.data, trendsInitialized]);

	return (
		<View style={styles.root}>
			{/* Header */}
			<View style={styles.header}>
				<Text style={[styles.headerTitle, { color: colors.ink }]}>Stats</Text>
			</View>

			{/* Tab bar */}
			<View style={styles.tabRow}>
				{TABS.map((t) => {
					const on = t === tab;
					return (
						<Pressable
							key={t}
							onPress={() => setTab(t)}
							style={[
								styles.tab,
								{
									borderColor:     on ? colors.ink : colors.line,
									backgroundColor: on ? colors.ink : colors.card,
								},
							]}
						>
							<Text
								style={{
									fontFamily: FONTS.body.regular,
									fontSize:   13,
									color:      on ? colors.paper : colors.ink,
								}}
							>
								{t}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{/* Period filter */}
			<View style={styles.periodRow}>
				{PERIODS.map((p) => {
					const on = p.key === period;
					return (
						<Pressable
							key={p.key}
							onPress={() => setPeriod(p.key)}
							style={[
								styles.periodChip,
								{
									backgroundColor: on ? colors.chip : 'transparent',
									borderColor: on ? colors.line : 'transparent',
								},
							]}
						>
							<Text style={{
								fontFamily: FONTS.body.regular,
								fontSize: 12,
								color: on ? colors.ink : colors.muted,
							}}>
								{p.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{overviewQ.isLoading && (
					<View style={styles.center}>
						<ActivityIndicator color={colors.ink} />
					</View>
				)}

				{!overviewQ.isLoading && tab === 'Summary' && overviewQ.data && (
					<SummaryTab
						data={overviewQ.data}
						hexMap={hexMap}
					/>
				)}

				{!overviewQ.isLoading && tab === 'Trends' && (
					<TrendsTab
						data={trendsQ.data}
						loading={trendsQ.isLoading}
						habits={overviewQ.data?.habits ?? []}
						hexMap={hexMap}
						slots={trendsSlots}
						activeFilter={trendsActive}
						onSlotsChange={setTrendsSlots}
						onActiveChange={setTrendsActive}
					/>
				)}

				{!overviewQ.isLoading && tab === 'Habits' && (
					<HabitsTab
						habits={overviewQ.data?.habits ?? []}
						hexMap={hexMap}
					/>
				)}

				{!overviewQ.isLoading && tab === 'Limits' && (
					<LimitsTab
						habits={overviewQ.data?.avoid_habits ?? []}
						hexMap={hexMap}
					/>
				)}

				<View style={{ height: 32 }} />
			</ScrollView>
		</View>
	);
}

// ── Summary Tab ────────────────────────────────────────────────────────

function SummaryTab({
	data,
	hexMap,
}: {
	data: NonNullable<ReturnType<typeof useStatsOverview>['data']>;
	hexMap: Record<string, string>;
}) {
	const { colors } = useTheme();
	const rate = data.overall_completion_rate;
	const pct = rate != null ? Math.round(rate * 100) : null;

	return (
		<View style={styles.section}>
			{/* Big number */}
			<View style={[styles.bigCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Text style={[styles.bigNumber, { color: colors.ink }]}>
					{pct != null ? `${pct}%` : '—'}
				</Text>
				<Text style={[styles.bigLabel, { color: colors.muted }]}>
					Completion Rate
				</Text>
			</View>

			{/* Quick stats row */}
			<View style={styles.quickRow}>
				<QuickStat
					label="Active Streaks"
					value={String(data.active_streak_count)}
					icon="flame"
				/>
				<QuickStat
					label="Today"
					value={`${data.today_done}/${data.today_total}`}
					icon="check"
				/>
			</View>

			{/* Top performers */}
			{(data.top_habits?.length ?? 0) > 0 && (
				<>
					<Text style={[styles.sectionTitle, { color: colors.ink }]}>
						Top Performers
					</Text>
					<ColumnHeaders showRank />
					{data.top_habits!.map((h, i) => (
						<HabitStatRow
							key={h.id}
							habit={h}
							rank={i + 1}
							hexMap={hexMap}
						/>
					))}
				</>
			)}
		</View>
	);
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: string }) {
	const { colors } = useTheme();
	return (
		<View style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
			<Icon name={icon as any} size={16} color={colors.muted} strokeWidth={1.8} />
			<Text style={[styles.quickValue, { color: colors.ink }]}>{value}</Text>
			<Text style={[styles.quickLabel, { color: colors.muted }]}>{label}</Text>
		</View>
	);
}

// ── Trends Tab ─────────────────────────────────────────────────────────

function TrendsTab({
	data,
	loading,
	habits,
	hexMap,
	slots,
	activeFilter,
	onSlotsChange,
	onActiveChange,
}: {
	data: ReturnType<typeof useStatsTrends>['data'];
	loading: boolean;
	habits: HabitSummary[];
	hexMap: Record<string, string>;
	slots: string[];
	activeFilter: string[] | undefined;
	onSlotsChange: (ids: string[]) => void;
	onActiveChange: (ids: string[] | undefined) => void;
}) {
	const { colors } = useTheme();
	const [pickerOpen, setPickerOpen] = useState(false);

	const isAllMode = !activeFilter;

	const toggleChip = useCallback((id: string) => {
		if (isAllMode) {
			onActiveChange([id]);
		} else {
			const next = activeFilter.includes(id)
				? activeFilter.filter((x) => x !== id)
				: [...activeFilter, id];
			onActiveChange(next.length > 0 ? next : undefined);
		}
	}, [activeFilter, isAllMode, onActiveChange]);

	const selectAll = useCallback(() => onActiveChange(undefined), [onActiveChange]);

	const series = useMemo<TrendSeries[]>(() => {
		if (activeFilter && activeFilter.length > 0) {
			return activeFilter
				.map((id) => {
					const habit = habits.find((h) => h.id === id);
					return {
						key: id,
						label: habit?.name ?? 'Habit',
						color: habit?.color_key ? hexMap[habit.color_key] ?? colors.muted : colors.muted,
						points: data?.per_habit?.[id] ?? [],
					};
				})
				.filter((s) => s.points.length > 0);
		}
		const overall = data?.overall ?? [];
		if (overall.length === 0) return [];
		return [{ key: 'overall', label: 'All habits', color: colors.ink, points: overall }];
	}, [activeFilter, habits, data, hexMap, colors]);

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.ink} />
			</View>
		);
	}

	const drawable = series.filter((s) => s.points.length > 1);
	const slotHabits = slots
		.map((id) => habits.find((h) => h.id === id))
		.filter(Boolean) as HabitSummary[];

	return (
		<View style={styles.section}>
			{/* Filter row: All + slot chips + filter icon */}
			<View style={styles.filterRow}>
				<Pressable
					onPress={selectAll}
					style={[
						styles.filterChip,
						{
							backgroundColor: isAllMode ? colors.ink : colors.card,
							borderColor: isAllMode ? colors.ink : colors.line,
						},
					]}
				>
					<Text style={{
						fontFamily: FONTS.body.regular,
						fontSize: 11,
						color: isAllMode ? colors.paper : colors.ink,
					}}>
						All
					</Text>
				</Pressable>
				{slotHabits.map((h) => {
					const on = activeFilter?.includes(h.id) ?? false;
					const color = h.color_key ? hexMap[h.color_key] ?? colors.muted : colors.muted;
					return (
						<Pressable
							key={h.id}
							onPress={() => toggleChip(h.id)}
							style={[
								styles.filterChip,
								{
									backgroundColor: on ? color : colors.card,
									borderColor: on ? color : colors.line,
									flexShrink: 1,
								},
							]}
						>
							<Text style={{
								fontFamily: FONTS.body.regular,
								fontSize: 11,
								color: on ? '#fff' : colors.ink,
							}} numberOfLines={1}>
								{h.name}
							</Text>
						</Pressable>
					);
				})}
				<Pressable
					onPress={() => setPickerOpen(true)}
					style={[styles.filterIcon, { borderColor: colors.line, backgroundColor: colors.card }]}
					hitSlop={6}
				>
					<Icon name="chevron" size={14} color={colors.ink} />
				</Pressable>
			</View>

			{/* Mini line chart */}
			{drawable.length > 0 ? (
				<MiniLineChart series={drawable} />
			) : (
				<View style={[styles.emptyCard, { borderColor: colors.line }]}>
					<Text style={[styles.emptyText, { color: colors.muted }]}>
						Not enough data for trends yet.
					</Text>
				</View>
			)}

			<TrendsPickerSheet
				visible={pickerOpen}
				habits={habits}
				slots={slots}
				hexMap={hexMap}
				onSlotsChange={onSlotsChange}
				onClose={() => setPickerOpen(false)}
			/>
		</View>
	);
}

// ── Trends Picker Sheet ───────────────────────────────────────────────

function TrendsPickerSheet({
	visible,
	habits,
	slots,
	hexMap,
	onSlotsChange,
	onClose,
}: {
	visible: boolean;
	habits: HabitSummary[];
	slots: string[];
	hexMap: Record<string, string>;
	onSlotsChange: (ids: string[]) => void;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const screenH = Dimensions.get('window').height;
	const defaultH = Math.round(screenH / 3);
	const minH = Math.round(screenH * 0.2);
	const maxH = Math.round(screenH * 0.75);

	const [sheetHeight, setSheetHeight] = useState(defaultH);
	const heightRef = useRef(defaultH);

	useEffect(() => {
		if (visible) {
			setSheetHeight(defaultH);
			heightRef.current = defaultH;
		}
	}, [visible, defaultH]);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderMove: (_, gesture) => {
				const next = Math.max(minH, Math.min(maxH, heightRef.current - gesture.dy));
				setSheetHeight(next);
			},
			onPanResponderRelease: (_, gesture) => {
				heightRef.current = Math.max(minH, Math.min(maxH, heightRef.current - gesture.dy));
			},
		})
	).current;

	const slotSet = useMemo(() => new Set(slots), [slots]);
	const isFull = slots.length >= MAX_TREND_SLOTS;

	const selected = useMemo(
		() => habits.filter((h) => slotSet.has(h.id)),
		[habits, slotSet],
	);
	const unselected = useMemo(
		() => habits.filter((h) => !slotSet.has(h.id)),
		[habits, slotSet],
	);

	const toggleSlot = useCallback((id: string) => {
		if (slotSet.has(id)) {
			onSlotsChange(slots.filter((s) => s !== id));
		} else if (!isFull) {
			onSlotsChange([...slots, id]);
		}
	}, [slots, slotSet, isFull, onSlotsChange]);

	if (!visible) return null;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable style={styles.sheetBackdrop} onPress={onClose}>
				<Pressable
					style={[styles.sheetContainer, { backgroundColor: colors.paper, height: sheetHeight }]}
					onPress={(e) => e.stopPropagation()}
				>
					<View {...panResponder.panHandlers} style={styles.sheetHandleArea}>
						<View style={[styles.sheetHandle, { backgroundColor: colors.line }]} />
					</View>
					<Text style={[styles.sheetTitle, { color: colors.ink }]}>
						Select Habits ({slots.length}/{MAX_TREND_SLOTS})
					</Text>

					{/* Selected chips row */}
					{selected.length > 0 && (
						<View style={styles.selectedChipRow}>
							{selected.map((h) => {
								const color = h.color_key ? hexMap[h.color_key] ?? colors.muted : colors.muted;
								return (
									<Pressable
										key={h.id}
										style={[styles.selectedChip, { backgroundColor: color }]}
										onPress={() => toggleSlot(h.id)}
									>
										<Text style={styles.selectedChipText} numberOfLines={1}>
											{h.name}
										</Text>
										<Icon name="close" size={10} color="#fff" strokeWidth={2.5} />
									</Pressable>
								);
							})}
						</View>
					)}

					<ScrollView
						style={styles.sheetScroll}
						showsVerticalScrollIndicator={false}
					>
						{unselected.map((h) => {
							const color = h.color_key ? hexMap[h.color_key] ?? colors.muted : colors.muted;
							const disabled = isFull;
							return (
								<Pressable
									key={h.id}
									style={[styles.sheetRow, { borderBottomColor: colors.line, opacity: disabled ? 0.4 : 1 }]}
									onPress={() => toggleSlot(h.id)}
									disabled={disabled}
								>
									<View style={[styles.colorDot, { backgroundColor: color }]} />
									<Text style={[styles.sheetRowName, { color: colors.ink }]} numberOfLines={1}>
										{h.name}
									</Text>
								</Pressable>
							);
						})}
						<View style={{ height: 20 }} />
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function MiniLineChart({ series }: { series: TrendSeries[] }) {
	const { colors } = useTheme();
	const W = 320;
	const H = 140;
	const PAD = 24;

	// Shared x-axis: union of dates across all series, in order. Series may
	// have gaps (habit started later / no judged periods that week).
	const dates = useMemo(
		() => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(),
		[series],
	);
	const xStep = dates.length > 1 ? (W - PAD * 2) / (dates.length - 1) : 0;
	const xFor = (d: string) => PAD + dates.indexOf(d) * xStep;
	// Rates are period-success based, so 0..1 is a fixed scale
	const yFor = (rate: number) => H - PAD - Math.min(rate, 1) * (H - PAD * 2);

	return (
		<View style={[styles.chartCard, { borderColor: colors.line, backgroundColor: colors.card }]}>
			<View style={{ width: W, height: H }}>
				{/* SVG-like paths via absolute-positioned dots + rotated lines */}
				{/* (RN has no built-in SVG) */}
				{series.map((s) => (
					<View key={s.key} style={StyleSheet.absoluteFill}>
						{s.points.map((p) => (
							<View
								key={p.date}
								style={{
									position: 'absolute',
									left: xFor(p.date) - 3,
									top: yFor(p.rate) - 3,
									width: 6,
									height: 6,
									borderRadius: 3,
									backgroundColor: s.color,
								}}
							/>
						))}
						{s.points.slice(1).map((p, i) => {
							const x1 = xFor(s.points[i].date);
							const y1 = yFor(s.points[i].rate);
							const x2 = xFor(p.date);
							const y2 = yFor(p.rate);
							const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
							const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
							return (
								<View
									key={`line-${p.date}`}
									style={{
										position: 'absolute',
										left: x1,
										top: y1 - 0.5,
										width: len,
										height: 1,
										backgroundColor: s.color,
										transform: [{ rotate: `${angle}deg` }],
										transformOrigin: 'left center',
									}}
								/>
							);
						})}
					</View>
				))}
			</View>
			{/* Legend: latest rate per series */}
			<View style={styles.legendCol}>
				{series.map((s) => {
					const last = s.points[s.points.length - 1];
					return (
						<View key={s.key} style={styles.legendRow}>
							<View style={[styles.colorDot, { backgroundColor: s.color }]} />
							<Text style={[styles.legendName, { color: colors.ink }]} numberOfLines={1}>
								{s.label}
							</Text>
							<Text style={[styles.legendPct, { color: colors.muted }]}>
								{Math.round(last.rate * 100)}%
							</Text>
						</View>
					);
				})}
			</View>
		</View>
	);
}

// ── Habits Tab ─────────────────────────────────────────────────────────

function HabitsTab({
	habits,
	hexMap,
}: {
	habits: HabitSummary[];
	hexMap: Record<string, string>;
}) {
	const { colors } = useTheme();
	const sorted = useMemo(
		() => [...habits].sort((a, b) => (b.completion_rate ?? -1) - (a.completion_rate ?? -1)),
		[habits],
	);

	if (sorted.length === 0) {
		return (
			<View style={[styles.emptyCard, { borderColor: colors.line }]}>
				<Text style={[styles.emptyText, { color: colors.muted }]}>No DO habits yet.</Text>
			</View>
		);
	}

	return (
		<View style={styles.section}>
			<ColumnHeaders />
			{sorted.map((h) => (
				<HabitStatRow key={h.id} habit={h} hexMap={hexMap} />
			))}
		</View>
	);
}

// ── Limits (AVOID) Tab ─────────────────────────────────────────────────

function LimitsTab({
	habits,
	hexMap,
}: {
	habits: HabitSummary[];
	hexMap: Record<string, string>;
}) {
	const { colors } = useTheme();

	if (habits.length === 0) {
		return (
			<View style={[styles.emptyCard, { borderColor: colors.line }]}>
				<Text style={[styles.emptyText, { color: colors.muted }]}>No AVOID habits yet.</Text>
			</View>
		);
	}

	return (
		<View style={styles.section}>
			<ColumnHeaders />
			{habits.map((h) => (
				<AvoidStatRow key={h.id} habit={h} hexMap={hexMap} />
			))}
		</View>
	);
}

// ── Shared row components ──────────────────────────────────────────────

const COL_CURRENT = 48;
const COL_BEST = 36;
const COL_RATE = 40;

function ColumnHeaders({ showRank }: { showRank?: boolean }) {
	const { colors } = useTheme();
	return (
		<View style={styles.colHeaderRow}>
			{showRank && <View style={{ width: 20 }} />}
			<View style={{ width: 10 }} />
			<Text style={[styles.colHeaderText, styles.colHeaderHabit, { color: colors.muted }]}>
				Habit
			</Text>
			<Text style={[styles.colHeaderText, { color: colors.muted, width: COL_CURRENT, textAlign: 'center' }]}>
				Current
			</Text>
			<Text style={[styles.colHeaderText, { color: colors.muted, width: COL_BEST, textAlign: 'center' }]}>
				Best
			</Text>
			<Text style={[styles.colHeaderText, { color: colors.muted, width: COL_RATE, textAlign: 'right' }]}>
				Rate
			</Text>
		</View>
	);
}

function HabitStatRow({
	habit,
	rank,
	hexMap,
}: {
	habit: HabitSummary;
	rank?: number;
	hexMap: Record<string, string>;
}) {
	const { colors } = useTheme();
	const color = habit.color_key ? hexMap[habit.color_key] ?? colors.muted : colors.muted;
	const ratePct = habit.completion_rate != null ? Math.round(habit.completion_rate * 100) : null;
	const isYoung = ratePct == null;
	return (
		<View style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
			{rank != null && (
				<Text style={[styles.rank, { color: colors.muted }]}>#{rank}</Text>
			)}
			<View style={[styles.colorDot, { backgroundColor: color }]} />
			<View style={styles.nameCol}>
				<Text style={[styles.habitName, { color: colors.ink }]} numberOfLines={1}>
					{habit.name}
				</Text>
			</View>
			{isYoung ? (
				<Text style={[styles.youngLabel, { color: colors.muted }]}>Not enough data</Text>
			) : (
				<>
					<View style={[styles.colCell, { width: COL_CURRENT }]}>
						<Text style={[styles.streakText, { color: colors.ink }]}>
							{habit.current_streak}
						</Text>
						<Icon
							name="flame"
							size={12}
							color={habit.current_streak > 0 ? color : colors.muted}
							fill={habit.current_streak > 0 ? color : 'none'}
							strokeWidth={1.6}
						/>
					</View>
					<Text style={[styles.colCellText, { color: colors.muted, width: COL_BEST }]}>
						{habit.best_streak}
					</Text>
					<Text style={[styles.rateText, { color: colors.ink, width: COL_RATE }]}>
						{ratePct}%
					</Text>
				</>
			)}
		</View>
	);
}

function AvoidStatRow({
	habit,
	hexMap,
}: {
	habit: HabitSummary;
	hexMap: Record<string, string>;
}) {
	const { colors } = useTheme();
	const color = habit.color_key ? hexMap[habit.color_key] ?? colors.muted : colors.muted;
	const cleanPct = habit.completion_rate != null ? Math.round(habit.completion_rate * 100) : null;
	const slip = habit.days_since_last_slip;
	const subtitle =
		slip == null
			? 'No slips yet'
			: slip === 0
				? 'Slipped today'
				: `Last slip ${slip}d ago`;
	return (
		<View style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
			<View style={[styles.colorDot, { backgroundColor: color }]} />
			<View style={styles.nameCol}>
				<Text style={[styles.habitName, { color: colors.ink }]} numberOfLines={1}>
					{habit.name}
				</Text>
				<Text style={[styles.habitSub, { color: colors.muted }]} numberOfLines={1}>
					{subtitle}
				</Text>
			</View>
			<View style={[styles.colCell, { width: COL_CURRENT }]}>
				<Text style={[styles.streakText, { color: colors.ink }]}>
					{habit.current_streak}
				</Text>
				<Icon
					name="flame"
					size={12}
					color={habit.current_streak > 0 ? color : colors.muted}
					fill={habit.current_streak > 0 ? color : 'none'}
					strokeWidth={1.6}
				/>
			</View>
			<Text style={[styles.colCellText, { color: colors.muted, width: COL_BEST }]}>
				{habit.best_streak}
			</Text>
			{cleanPct != null ? (
				<Text style={[styles.rateText, { color: colors.ink, width: COL_RATE }]}>
					{cleanPct}%
				</Text>
			) : (
				<View style={{ width: COL_RATE }} />
			)}
		</View>
	);
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 16,
		paddingTop: 4,
		paddingBottom: 10,
	},
	headerTitle: {
		fontFamily: FONTS.display.bold,
		fontSize: 22,
		letterSpacing: -0.5,
	},
	tabRow: {
		flexDirection: 'row',
		gap: 4,
		paddingHorizontal: 16,
		paddingTop: 2,
		paddingBottom: 8,
	},
	tab: {
		flex: 1,
		paddingVertical: 9,
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
	},
	periodRow: {
		flexDirection: 'row',
		gap: 2,
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	periodChip: {
		paddingVertical: 5,
		paddingHorizontal: 12,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	center: {
		paddingVertical: 32,
		alignItems: 'center',
	},
	section: {
		gap: 8,
	},
	bigCard: {
		alignItems: 'center',
		paddingVertical: 24,
		borderWidth: 1,
		borderRadius: RADII.default,
		marginBottom: 8,
	},
	bigNumber: {
		fontFamily: FONTS.display.bold,
		fontSize: 48,
		letterSpacing: -2,
	},
	bigLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		marginTop: 2,
	},
	quickRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12,
	},
	quickCard: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 14,
		borderWidth: 1,
		borderRadius: RADII.default,
		gap: 4,
	},
	quickValue: {
		fontFamily: FONTS.display.semibold,
		fontSize: 20,
	},
	quickLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
	},
	sectionTitle: {
		fontFamily: FONTS.display.medium,
		fontSize: 14,
		marginTop: 8,
		marginBottom: 2,
	},
	habitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 11,
		borderWidth: 1,
		borderRadius: RADII.default,
	},
	rank: {
		fontFamily: FONTS.display.regular,
		fontSize: 12,
		width: 20,
	},
	colorDot: {
		width: 10,
		height: 10,
		borderRadius: 3,
	},
	habitName: {
		fontFamily: FONTS.display.regular,
		fontSize: 14,
		flexShrink: 1,
	},
	nameCol: {
		flex: 1,
		flexShrink: 1,
	},
	habitSub: {
		fontFamily: FONTS.body.regular,
		fontSize: 10,
		marginTop: 1,
	},
	colHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 12,
		marginBottom: 2,
	},
	colHeaderText: {
		fontFamily: FONTS.body.regular,
		fontSize: 10,
	},
	colHeaderHabit: {
		flex: 1,
	},
	colCell: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
	},
	colCellText: {
		fontFamily: FONTS.display.regular,
		fontSize: 12,
		textAlign: 'center',
	},
	streakText: {
		fontFamily: FONTS.display.regular,
		fontSize: 12,
	},
	rateText: {
		fontFamily: FONTS.display.semibold,
		fontSize: 14,
		textAlign: 'right',
	},
	youngLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		fontStyle: 'italic',
	},
	filterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: 12,
	},
	filterChip: {
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	filterIcon: {
		width: 28,
		height: 28,
		borderRadius: RADII.default,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 'auto',
	},
	sheetBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'flex-end',
	},
	sheetContainer: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingHorizontal: 16,
		overflow: 'hidden',
	},
	sheetHandleArea: {
		paddingTop: 10,
		paddingBottom: 8,
		alignItems: 'center',
	},
	sheetHandle: {
		width: 36,
		height: 4,
		borderRadius: 2,
	},
	sheetTitle: {
		fontFamily: FONTS.display.medium,
		fontSize: 15,
		marginBottom: 10,
	},
	sheetScroll: {
		flexShrink: 1,
	},
	sheetSectionLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
		marginBottom: 4,
		marginTop: 4,
	},
	sheetRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	sheetRowName: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		flex: 1,
	},
	selectedChipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		marginBottom: 10,
	},
	selectedChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 5,
		paddingLeft: 10,
		paddingRight: 7,
		borderRadius: RADII.default,
		maxWidth: '47%' as any,
	},
	selectedChipText: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		color: '#fff',
		flexShrink: 1,
	},
	chartCard: {
		borderWidth: 1,
		borderRadius: RADII.default,
		padding: 12,
		alignItems: 'center',
	},
	legendCol: {
		alignSelf: 'stretch',
		gap: 4,
		marginTop: 10,
	},
	legendRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	legendName: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
		flexShrink: 1,
	},
	legendPct: {
		fontFamily: FONTS.display.semibold,
		fontSize: 11,
		marginLeft: 'auto',
	},
	emptyCard: {
		borderWidth: 1,
		borderRadius: RADII.default,
		paddingVertical: 32,
		alignItems: 'center',
		marginHorizontal: 16,
		marginTop: 16,
	},
	emptyText: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
	},
});
