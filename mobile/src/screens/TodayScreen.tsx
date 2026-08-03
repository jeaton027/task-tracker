import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
	toHabitView,
	toWeekHeatmaps,
	toYearHeatmaps,
	type HabitView,
	type WeekHeatmapData,
	type YearHeatmapData,
} from '../api/adapter';
import { ApiError } from '../api/client';
import { useCategories, useDeleteHabit, useLogHabit, useRoutines, useToday, useWeeklyCalendar, useYearlyCalendar } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../components/today/AppHeader';
import { BottomNav, type NavTab } from '../components/today/BottomNav';
import { DrawerMenu, type DrawerFilters } from '../components/today/DrawerMenu';
import { Fab } from '../components/today/Fab';
import { HabitContextMenu } from '../components/today/HabitContextMenu';
import { HabitRow } from '../components/today/HabitRow';
import { PeriodNav } from '../components/today/PeriodNav';
import { RoutineChips } from '../components/today/RoutineChips';
import { SectionBar } from '../components/today/SectionBar';
import { ViewToggle, type TodayView } from '../components/today/ViewToggle';
import { AllHabitsScreen } from './AllHabitsScreen';
import { CreateHabitScreen } from './CreateHabitScreen';
import { EditHabitScreen } from './EditHabitScreen';
import { HabitDetailScreen } from './HabitDetailScreen';
import { RoutineScreen } from './RoutineScreen';
import { SettingsScreen } from './SettingsScreen';
import { CalendarScreen } from './CalendarScreen';
import { StatsScreen } from './StatsScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS, useTheme } from '../theme';
import { isoDate, weekStartDate } from '../utils/dates';

const ROUTINE_ORDER_KEY = 'routine_last_played';

const SECTION_DEFS = [
	{ key: 'daily',    label: 'Daily Habits' },
	{ key: 'weekly',   label: 'Weekly Habits' },
	{ key: 'monthly',  label: 'Monthly Habits' },
	{ key: 'yearly',   label: 'Yearly Habits' },
	{ key: 'interval', label: 'Interval Habits' },
] as const;

type SectionKey = (typeof SECTION_DEFS)[number]['key'];

export function TodayScreen() {
	const { colors } = useTheme();
	const [navTab, setNavTab] = useState<NavTab>('Today');
	const [view, setView] = useState<TodayView>('Today');
	const [viewingDate, setViewingDate] = useState(() => new Date());
	const [creatingHabit, setCreatingHabit] = useState(false);
	const [collapsed, setCollapsed] = useState<Set<SectionKey | 'completed'>>(new Set(['completed']));
	const [menuHabit, setMenuHabit] = useState<HabitView | null>(null);
	const [editHabitId, setEditHabitId] = useState<string | null>(null);
	const [detailHabitId, setDetailHabitId] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [allHabitsOpen, setAllHabitsOpen] = useState(false);
	const [routineScreenId, setRoutineScreenId] = useState<string | null>(null);
	const [routineLastPlayed, setRoutineLastPlayed] = useState<Record<string, number>>({});
	const [filters, setFilters] = useState<DrawerFilters>({ timeOfDay: null, categoryId: null, routineId: null });

	useEffect(() => {
		AsyncStorage.getItem(ROUTINE_ORDER_KEY).then((raw) => {
			if (raw) setRoutineLastPlayed(JSON.parse(raw));
		});
	}, []);

	const toggleSection = (key: SectionKey | 'completed') => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	// ── Period navigation ───────────────────────────────────────────────
	const onPrev = useCallback(() => {
		setViewingDate((d) => {
			const next = new Date(d);
			if (view === 'Week')       next.setDate(next.getDate() - 7);
			else if (view === 'Month') next.setMonth(next.getMonth() - 1);
			else                       next.setFullYear(next.getFullYear() - 1);
			return next;
		});
	}, [view]);

	const onNext = useCallback(() => {
		setViewingDate((d) => {
			const next = new Date(d);
			if (view === 'Week')       next.setDate(next.getDate() + 7);
			else if (view === 'Month') next.setMonth(next.getMonth() + 1);
			else                       next.setFullYear(next.getFullYear() + 1);
			return next;
		});
	}, [view]);

	const onToday = useCallback(() => setViewingDate(new Date()), []);

	// ── Data fetching ───────────────────────────────────────────────────
	const todayStr = isoDate(new Date());
	// Today tab = due today; period tabs = everything belonging to that horizon
	const scope = view === 'Today' ? 'today' : (view.toLowerCase() as 'week' | 'month' | 'year');
	const { data, isLoading, isError, error, refetch } = useToday(todayStr, new Date().getHours(), scope);
	const routinesQ = useRoutines();
	const categoriesQ = useCategories();
	const logHabit = useLogHabit();
	const deleteHabit = useDeleteHabit();

	const weekDate = view === 'Week' ? weekStartDate(viewingDate) : undefined;
	const weekQ = useWeeklyCalendar(weekDate);

	const yearNum = view === 'Year' ? viewingDate.getFullYear() : undefined;
	const yearQ = useYearlyCalendar(yearNum);

	const weekHeatmaps = useMemo<Map<string, WeekHeatmapData>>(() => {
		if (view !== 'Week' || !weekQ.data) return new Map();
		const arr = toWeekHeatmaps(weekQ.data, todayStr);
		return new Map(arr.map((h) => [h.habitId, h]));
	}, [view, weekQ.data, todayStr]);

	const yearHeatmaps = useMemo<Map<string, YearHeatmapData>>(() => {
		if (view !== 'Year' || !yearQ.data) return new Map();
		const arr = toYearHeatmaps(yearQ.data, todayStr);
		return new Map(arr.map((h) => [h.habitId, h]));
	}, [view, yearQ.data, todayStr]);

	// ── Routine habit IDs for filtering ─────────────────────────────────
	const routineHabitIds = useMemo<Set<string> | null>(() => {
		if (!filters.routineId || !routinesQ.data) return null;
		const routine = routinesQ.data.find((r) => r.id === filters.routineId);
		if (!routine) return null;
		return new Set((routine.habits ?? []).map((s) => s.habit.id));
	}, [filters.routineId, routinesQ.data]);

	// ── Sections from Today endpoint ────────────────────────────────────
	// Which frequency sections each tab renders. The backend `scope` param
	// already limits which habits arrive (Today = due today only; period tabs
	// include unscheduled habits of fitting frequencies / interval lengths).
	const VISIBLE_SECTIONS: Record<TodayView, Set<string>> = {
		Today: new Set(['daily', 'weekly', 'monthly', 'yearly', 'interval']),
		Week:  new Set(['daily', 'weekly', 'interval']),
		Month: new Set(['daily', 'weekly', 'monthly', 'interval']),
		Year:  new Set(['daily', 'weekly', 'monthly', 'yearly', 'interval']),
	};

	const sections = SECTION_DEFS
		.filter((def) => VISIBLE_SECTIONS[view].has(def.key))
		.map((def) => {
			let habits = (data?.[def.key as SectionKey]?.habits ?? []).map(toHabitView);
			if (filters.timeOfDay) {
				habits = habits.filter((h) => h.section === filters.timeOfDay);
			}
			if (filters.categoryId) {
				habits = habits.filter((h) => h.categoryId === filters.categoryId);
			}
			if (routineHabitIds) {
				habits = habits.filter((h) => routineHabitIds.has(h.id));
			}
			return { ...def, habits };
		});

	// Split each section into incomplete vs completed (AVOID habits never complete)
	const incompleteSections = sections.map((s) => ({
		...s,
		habits: s.habits.filter((h) => h.mode === 'AVOID' || h.done < h.target),
	}));
	const completedHabits: HabitView[] = sections.flatMap((s) =>
		s.habits.filter((h) => h.mode !== 'AVOID' && h.done >= h.target),
	);

	const allHabits: HabitView[] = sections.flatMap((s) => s.habits);
	const doneCount = completedHabits.length;
	const populatedSections = incompleteSections.filter((s) => s.habits.length > 0);

	const calendarLoading =
		(view === 'Week' && weekQ.isLoading) ||
		(view === 'Year' && yearQ.isLoading);

	const sortedRoutines = useMemo(() => {
		const list = [...(routinesQ.data ?? [])];
		list.sort((a, b) => (routineLastPlayed[b.id] ?? 0) - (routineLastPlayed[a.id] ?? 0));
		return list;
	}, [routinesQ.data, routineLastPlayed]);

	const onRoutineClose = useCallback((routineId: string | null) => {
		if (routineId) {
			setRoutineLastPlayed((prev) => {
				const next = { ...prev, [routineId]: Date.now() };
				AsyncStorage.setItem(ROUTINE_ORDER_KEY, JSON.stringify(next));
				return next;
			});
		}
		setRoutineScreenId(null);
	}, []);

	const onLogHabit = (habitId: string) => {
		logHabit.mutate({ habitId, body: { log_date: todayStr } });
	};

	const onDeleteHabit = () => {
		if (!menuHabit) return;
		deleteHabit.mutate(menuHabit.id);
		setMenuHabit(null);
	};

	return (
		<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
			{navTab === 'Settings' ? (
				<SettingsScreen onNavigate={setNavTab} />
			) : navTab === 'Stats' ? (
				<StatsScreen />
			) : navTab === 'Calendar' ? (
				<CalendarScreen />
			) : (
			<>
			<AppHeader onMenuPress={() => setDrawerOpen(true)} />
			<ViewToggle view={view} onChange={setView} />
			<PeriodNav
				view={view}
				viewingDate={viewingDate}
				doneCount={doneCount}
				total={allHabits.length}
				onPrev={onPrev}
				onNext={onNext}
				onToday={onToday}
			/>

			{view === 'Today' && sortedRoutines.length > 0 && (
				<RoutineChips
					routines={sortedRoutines}
					onSelect={setRoutineScreenId}
				/>
			)}

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{(isLoading || calendarLoading) && (
					<View style={styles.center}>
						<ActivityIndicator color={colors.ink} />
					</View>
				)}

				{isError && (
					<ErrorBlock error={error} onRetry={() => refetch()} />
				)}

				{!isLoading && !isError && allHabits.length === 0 && <EmptyState />}

				{populatedSections.map((section) => {
					const isCollapsed = collapsed.has(section.key);
					return (
						<Fragment key={section.key}>
							<SectionBar
								label={section.label}
								count={section.habits.length}
								collapsed={isCollapsed}
								onToggle={() => toggleSection(section.key)}
							/>
							{!isCollapsed && (
								<View style={styles.sectionList}>
									{section.habits.map((habit) => (
										<HabitRow
											key={habit.id}
											habit={habit}
											view={view}
											viewingDate={viewingDate}
											weekHeatmap={weekHeatmaps.get(habit.id)}
											yearHeatmap={yearHeatmaps.get(habit.id)}
											onPress={() => setDetailHabitId(habit.id)}
											onLog={() => onLogHabit(habit.id)}
											onLongPress={() => setMenuHabit(habit)}
										/>
									))}
								</View>
							)}
						</Fragment>
					);
				})}

				{completedHabits.length > 0 && (
					<Fragment key="completed">
						<SectionBar
							label="Completed"
							count={completedHabits.length}
							collapsed={collapsed.has('completed')}
							onToggle={() => toggleSection('completed')}
						/>
						{!collapsed.has('completed') && (
							<View style={styles.sectionList}>
								{completedHabits.map((habit) => (
									<HabitRow
										key={habit.id}
										habit={habit}
										view={view}
										viewingDate={viewingDate}
										weekHeatmap={weekHeatmaps.get(habit.id)}
										yearHeatmap={yearHeatmaps.get(habit.id)}
										onPress={() => setDetailHabitId(habit.id)}
										onLog={() => onLogHabit(habit.id)}
										onLongPress={() => setMenuHabit(habit)}
									/>
								))}
							</View>
						)}
					</Fragment>
				)}

				<View style={{ height: 96 }} />
			</ScrollView>

			<Fab onPress={() => setCreatingHabit(true)} />
			</>
			)}

			<BottomNav active={navTab} onTabChange={setNavTab} />

			<HabitContextMenu
				visible={menuHabit != null}
				habitName={menuHabit?.name ?? ''}
				onEdit={() => {
					if (menuHabit) setEditHabitId(menuHabit.id);
					setMenuHabit(null);
				}}
				onReorder={() => setMenuHabit(null)}
				onDelete={onDeleteHabit}
				onClose={() => setMenuHabit(null)}
			/>

			<CreateHabitScreen
				visible={creatingHabit}
				onClose={() => setCreatingHabit(false)}
			/>

			<EditHabitScreen
				visible={editHabitId != null}
				habitId={editHabitId}
				onClose={() => setEditHabitId(null)}
			/>

			<HabitDetailScreen
				visible={detailHabitId != null}
				habitId={detailHabitId}
				onClose={() => setDetailHabitId(null)}
			/>

			<DrawerMenu
				visible={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				filters={filters}
				onFiltersChange={setFilters}
				categories={(categoriesQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
				routines={(routinesQ.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
				onAllHabits={() => setAllHabitsOpen(true)}
			/>

			<AllHabitsScreen
				visible={allHabitsOpen}
				onClose={() => setAllHabitsOpen(false)}
			/>

			<RoutineScreen
				visible={routineScreenId != null}
				routineId={routineScreenId}
				onClose={() => onRoutineClose(routineScreenId)}
			/>
		</SafeAreaView>
	);
}

// ── Sub-views for non-happy states ──────────────────────────────────────

function ErrorBlock({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	const { colors } = useTheme();
	const { logout } = useAuth();
	const message =
		error instanceof ApiError ? error.message :
		error instanceof Error    ? error.message :
		'Failed to load.';

	const isUnauthorized = error instanceof ApiError && error.status === 401;

	return (
		<View style={styles.center}>
			<Text style={{ color: colors.ink, fontFamily: FONTS.body.regular, fontSize: 14, marginBottom: 12 }}>
				{message}
			</Text>
			<Pressable
				onPress={isUnauthorized ? logout : onRetry}
				style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, backgroundColor: colors.ink }}
			>
				<Text style={{ color: colors.paper, fontFamily: FONTS.body.regular }}>
					{isUnauthorized ? 'Sign in again' : 'Retry'}
				</Text>
			</Pressable>
		</View>
	);
}

function EmptyState() {
	const { colors } = useTheme();
	return (
		<View style={styles.center}>
			<Text
				style={{
					color: colors.ink, fontFamily: FONTS.body.regular,
					fontSize: 14, textAlign: 'center',
				}}
			>
				No habits yet.
				{'\n'}
				Tap the + button to add one.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	root:   { flex: 1 },
	scroll: { flex: 1 },
	scrollContent: {
		paddingHorizontal: 0,
	},
	sectionList: {
		paddingHorizontal: 16,
		gap: 9,
		marginBottom: 6,
	},
	center: {
		paddingVertical: 32,
		alignItems: 'center',
	},
});
