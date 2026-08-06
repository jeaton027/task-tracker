import { useEffect, useMemo, useState } from 'react';
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import {
	useCategories,
	useCreateCategory,
	useCreateRoutine,
	useDeleteHabit,
	useHabit,
	useRoutines,
	useUpdateHabit,
} from '../api/queries';
import type { HabitResponse, HabitSection, HabitUpdate } from '../api/types';
import {
	Caption,
	ColorPreview,
	ColorSheet,
	Row,
	SelectStyle,
	TextField,
	UnitSheet,
	formStyles,
} from '../components/createHabit/FormPrimitives';
import {
	FrequencyPicker,
	buildScheduleFields,
	type ScheduleState,
} from '../components/createHabit/FrequencyPicker';
import { CategoryPicker } from '../components/createHabit/CategoryPicker';
import { RoutinePicker } from '../components/createHabit/RoutinePicker';
import { SectionPicker } from '../components/createHabit/SectionPicker';
import { Stepper } from '../components/createHabit/Stepper';
import { Toggle } from '../components/createHabit/Toggle';
import {
	CustomizeSheet,
	type CustomCadence,
} from '../components/createHabit/CustomizeSheet';
import { AutoLogSection } from '../components/editHabit/AutoLogSection';
import { Icon } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';

// ── Helpers ────────────────────────────────────────────────────────────

function habitToScheduleState(h: HabitResponse): ScheduleState {
	const base: ScheduleState = {
		perTab: 'Day',
		day: 'everyday',
		week: 'anytime',
		month: 'anytime',
		year: 'anytime',
		weekdays: h.scheduled_weekdays ?? [],
		daysOfMonth: h.scheduled_days_of_month ?? [],
		daysPerWeek: h.days_per_week ?? 3,
		custom: null,
	};

	switch (h.frequency) {
		case 'DAILY':
			base.perTab = 'Day';
			base.day = 'everyday';
			break;
		case 'WEEKLY': {
			const hasWeekdays = h.scheduled_weekdays && h.scheduled_weekdays.length > 0;
			const hasDaysPerWeek = h.days_per_week != null;
			if (hasWeekdays) {
				base.perTab = 'Day';
				base.day = 'selectDays';
			} else if (hasDaysPerWeek) {
				base.perTab = 'Day';
				base.day = 'countPerWeek';
			} else {
				base.perTab = 'Week';
				base.week = 'anytime';
			}
			break;
		}
		case 'MONTHLY':
			base.perTab = 'Month';
			if (h.scheduled_days_of_month && h.scheduled_days_of_month.length > 0) {
				base.month = 'selectDate';
			}
			break;
		case 'YEARLY':
			base.perTab = 'Year';
			break;
		case 'INTERVAL':
			base.custom = { type: 'INTERVAL', interval_days: h.interval_days ?? 1 };
			break;
	}

	return base;
}

function formatDate(iso: string): string {
	const d = new Date(iso + 'T00:00:00');
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────

interface EditHabitScreenProps {
	visible:  boolean;
	habitId:  string | null;
	onClose:  () => void;
}

export function EditHabitScreen({ visible, habitId, onClose }: EditHabitScreenProps) {
	const { colors } = useTheme();

	const habitQuery     = useHabit(visible ? habitId : null);
	const categoriesQ    = useCategories();
	const routinesQ      = useRoutines();
	const createCategory = useCreateCategory();
	const createRoutine  = useCreateRoutine();
	const updateHabit    = useUpdateHabit();
	const deleteHabit    = useDeleteHabit();

	// Form state — initialized from fetched habit
	const [name, setName]               = useState('');
	const [colorKey, setColorKey]       = useState<string | null>(null);
	const [target, setTarget]           = useState(1);
	const [unit, setUnit]               = useState<string | null>('times');
	const [schedule, setSchedule]       = useState<ScheduleState | null>(null);
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
	const [section, setSection] = useState<HabitSection | null>(null);
	const [routineIds, setRoutineIds]   = useState<string[]>([]);
	const [isActive, setIsActive]       = useState(true);
	const [isArchived, setIsArchived]   = useState(false);

	// UI state
	const [colorSheetOpen, setColorSheet]   = useState(false);
	const [unitSheetOpen, setUnitSheet]     = useState(false);
	const [customizeOpen, setCustomize]     = useState(false);
	const [submitError, setSubmitError]     = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [initialized, setInitialized]     = useState(false);

	// Read-only fields from fetched habit
	const habit = habitQuery.data;

	// Derive which routines this habit belongs to
	const habitRoutineIds = useMemo(() => {
		if (!routinesQ.data || !habitId) return [];
		return routinesQ.data
			.filter((r) => r.habits?.some((slot) => slot.habit.id === habitId))
			.map((r) => r.id);
	}, [routinesQ.data, habitId]);

	// Initialize form when habit data arrives
	useEffect(() => {
		if (!habit || initialized) return;
		setName(habit.name);
		setColorKey(habit.color_key);
		setTarget(habit.target_per_period);
		setUnit(habit.unit);
		setSchedule(habitToScheduleState(habit));
		setSelectedCategoryId(habit.category_id);
		setSection(habit.section ?? null);
		setIsActive(habit.is_active);
		setIsArchived(habit.is_archived);
		setRoutineIds(habitRoutineIds);
		setInitialized(true);
	}, [habit, habitRoutineIds, initialized]);

	// Reset when modal closes
	useEffect(() => {
		if (!visible) {
			setInitialized(false);
			setConfirmDelete(false);
			setSubmitError(null);
		}
	}, [visible]);

	// Keep routineIds in sync if they load after initialization
	useEffect(() => {
		if (initialized && habitRoutineIds.length > 0 && routineIds.length === 0) {
			setRoutineIds(habitRoutineIds);
		}
	}, [habitRoutineIds, initialized]);

	const canSubmit = name.trim().length > 0 && !updateHabit.isPending;

	const dismiss = () => {
		onClose();
	};

	const onCustomizeDone = (custom: CustomCadence | null) => {
		if (schedule) setSchedule({ ...schedule, custom });
		setCustomize(false);
	};

	const submit = async () => {
		if (!habitId || !schedule) return;
		setSubmitError(null);

		const sched = buildScheduleFields(schedule);
		const body: HabitUpdate = {
			name:                    name.trim(),
			frequency:               sched.frequency,
			scheduled_weekdays:      sched.scheduled_weekdays,
			scheduled_days_of_month: sched.scheduled_days_of_month,
			scheduled_dates:         sched.scheduled_dates,
			interval_days:           sched.interval_days,
			days_per_week:           sched.days_per_week,
			target_per_period:       target,
			section:                 section,
			category_id:             selectedCategoryId,
			color_key:               colorKey,
			unit:                    unit || null,
			is_active:               isActive,
			is_archived:             isArchived,
			routine_ids:             routineIds,
		};

		try {
			await updateHabit.mutateAsync({ habitId, body });
			dismiss();
		} catch (e) {
			if (e instanceof ApiError) setSubmitError(e.message);
			else if (e instanceof Error) setSubmitError(e.message);
			else setSubmitError('Could not save habit.');
		}
	};

	const handleDelete = () => {
		if (!habitId) return;
		deleteHabit.mutate(habitId);
		dismiss();
	};

	if (!visible) return null;

	// Loading state
	if (habitQuery.isLoading || !habit || !schedule) {
		return (
			<Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
				<SafeAreaView style={[formStyles.root, { backgroundColor: colors.paper }]} edges={['top']}>
					<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
						<Text style={{ color: colors.muted, fontFamily: FONTS.body.regular }}>Loading…</Text>
					</View>
				</SafeAreaView>
			</Modal>
		);
	}

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
			<SafeAreaView style={[formStyles.root, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
				<KeyboardAvoidingView
					style={formStyles.flex}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					{/* ── Header ─────────────────────────────────────── */}
					<View style={[formStyles.header, { borderBottomColor: colors.line }]}>
						<Pressable onPress={dismiss} style={[formStyles.iconBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}>
							<Icon name="left" size={19} color={colors.ink} />
						</Pressable>
						<Text style={[formStyles.title, { color: colors.ink }]}>Edit Habit</Text>
						<Pressable onPress={() => setConfirmDelete(true)} style={[formStyles.iconBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}>
							<Icon name="trash" size={18} color="#D94040" strokeWidth={1.8} />
						</Pressable>
					</View>

					<ScrollView
						style={formStyles.flex}
						contentContainerStyle={formStyles.scrollContent}
						keyboardShouldPersistTaps="handled"
					>
						{/* ── Name ───────────────────────────────────── */}
						<Row label="Name">
							<TextField value={name} onChangeText={setName} placeholder="Habit name" />
						</Row>

						{/* ── Color ──────────────────────────────────── */}
						<Row
							label="Color"
							sub={colorKey ? undefined : 'Tap to choose'}
							onPress={() => setColorSheet(true)}
						>
							<ColorPreview colorKey={colorKey} />
						</Row>

						{/* ── Goal type (read-only) ──────────────────── */}
						<Row label="Goal type">
							<SelectStyle
								value={habit.mode === 'DO' ? 'Do' : 'Avoid'}
								open={false}
								onPress={() => {}}
								width={130}
								disabled
							/>
						</Row>

						{/* ── Target amount + Unit ────────────────────── */}
						<View style={[formStyles.row, { borderBottomColor: colors.line }]}>
							<View style={formStyles.colTarget}>
								<Caption>Target amount</Caption>
								<Stepper value={target} onChange={setTarget} min={0} />
							</View>
							<View style={formStyles.colUnit}>
								<Caption>Unit</Caption>
								<SelectStyle
									value={unit ?? '—'}
									open={false}
									onPress={() => setUnitSheet(true)}
									width="100%"
								/>
							</View>
						</View>

						{/* ── Frequency ──────────────────────────────── */}
						<FrequencyPicker
							state={schedule}
							onChange={setSchedule}
							onOpenCustomize={() => setCustomize(true)}
						/>

						{/* ── Section (time of day) ───────────────────── */}
						<SectionPicker
							selected={section}
							onSelect={setSection}
						/>

						{/* ── Category (user grouping) ────────────────── */}
						<CategoryPicker
							categories={categoriesQ.data ?? []}
							selectedId={selectedCategoryId}
							onSelect={setSelectedCategoryId}
							onCreate={async (catName: string) => {
								const cat = await createCategory.mutateAsync(catName);
								return cat.id;
							}}
						/>

						{/* ── Routine multi-select ───────────────────── */}
						<RoutinePicker
							routines={routinesQ.data ?? []}
							selectedIds={routineIds}
							onChange={setRoutineIds}
							onCreate={async (routineName) => {
								const routine = await createRoutine.mutateAsync({
									name: routineName,
									is_active:  true,
									frequency:  'DAILY',
									start_date: habit.start_date,
									habits:     [],
								});
								return routine.id;
							}}
						/>

						{/* ── Auto-log (RepCue) ───────────────────── */}
						<AutoLogSection habitId={habitId} />

						{/* ── Active toggle ──────────────────────────── */}
						<View style={[eStyles.toggleRow, { borderBottomColor: colors.line }]}>
							<View style={{ flex: 1 }}>
								<Text style={[eStyles.toggleLabel, { color: colors.ink }]}>Active</Text>
								<Text style={[eStyles.toggleSub, { color: colors.muted }]}>
									Paused habits won't appear on Today
								</Text>
							</View>
							<Toggle on={isActive} onPress={() => setIsActive((v) => !v)} />
						</View>

						{/* ── Archive toggle ─────────────────────────── */}
						<View style={[eStyles.toggleRow, { borderBottomColor: colors.line }]}>
							<View style={{ flex: 1 }}>
								<Text style={[eStyles.toggleLabel, { color: colors.ink }]}>Archived</Text>
								<Text style={[eStyles.toggleSub, { color: colors.muted }]}>
									Hidden from Today and calendar views
								</Text>
							</View>
							<Toggle on={isArchived} onPress={() => setIsArchived((v) => !v)} />
						</View>

						{/* ── Start date (read-only) ─────────────────── */}
						<View style={[eStyles.infoRow, { borderBottomColor: colors.line }]}>
							<Text style={[eStyles.infoLabel, { color: colors.muted }]}>Started</Text>
							<Text style={[eStyles.infoValue, { color: colors.ink }]}>
								{formatDate(habit.start_date)}
							</Text>
						</View>

						{submitError && (
							<Text style={[formStyles.error, { color: colors.accent }]}>{submitError}</Text>
						)}
					</ScrollView>

					{/* ── Sticky bottom bar ──────────────────────────── */}
					<View style={[eStyles.bottomBar, { borderTopColor: colors.line, backgroundColor: colors.paper }]}>
						<Pressable
							onPress={dismiss}
							style={[eStyles.bottomBtn, { backgroundColor: colors.chip }]}
						>
							<Text style={[eStyles.bottomBtnText, { color: colors.ink }]}>Cancel</Text>
						</Pressable>
						<Pressable
							onPress={submit}
							disabled={!canSubmit}
							style={({ pressed }) => [
								eStyles.bottomBtn,
								{
									backgroundColor: colors.accent,
									opacity: !canSubmit || pressed ? 0.55 : 1,
									flex: 1.5,
								},
							]}
						>
							<Text style={[eStyles.bottomBtnText, { color: colors.paper }]}>
								{updateHabit.isPending ? '…' : 'Save'}
							</Text>
						</Pressable>
					</View>
				</KeyboardAvoidingView>

				{/* ── Sheets ─────────────────────────────────────────── */}
				<ColorSheet
					visible={colorSheetOpen}
					selectedKey={colorKey}
					onPick={(k) => { setColorKey(k); setColorSheet(false); }}
					onClose={() => setColorSheet(false)}
				/>
				<UnitSheet
					visible={unitSheetOpen}
					selected={unit}
					onPick={(u) => { setUnit(u); setUnitSheet(false); }}
					onClose={() => setUnitSheet(false)}
				/>
				<CustomizeSheet
					visible={customizeOpen}
					initialInterval={schedule.custom}
					onClose={() => setCustomize(false)}
					onDone={onCustomizeDone}
				/>

				{/* ── Delete confirmation ────────────────────────────── */}
				<Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
					<Pressable style={eStyles.deleteBackdrop} onPress={() => setConfirmDelete(false)}>
						<View style={[eStyles.deleteSheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
							<Text style={[eStyles.deleteTitle, { color: colors.ink }]}>Delete Habit?</Text>
							<Text style={[eStyles.deleteBody, { color: colors.muted }]}>
								This action is permanent. All previous associated data will be erased as well.
							</Text>
							<View style={eStyles.deleteActions}>
								<Pressable
									style={[eStyles.deleteBtn, { backgroundColor: colors.chip }]}
									onPress={() => setConfirmDelete(false)}
								>
									<Text style={[eStyles.deleteBtnText, { color: colors.ink }]}>Cancel</Text>
								</Pressable>
								<Pressable
									style={[eStyles.deleteBtn, { backgroundColor: '#D94040' }]}
									onPress={handleDelete}
								>
									<Text style={[eStyles.deleteBtnText, { color: '#fff' }]}>Delete</Text>
								</Pressable>
							</View>
						</View>
					</Pressable>
				</Modal>
			</SafeAreaView>
		</Modal>
	);
}

// ── Styles ─────────────────────────────────────────────────────────────

const eStyles = StyleSheet.create({
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 18,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	toggleLabel: { fontFamily: FONTS.display.regular, fontSize: 15, letterSpacing: -0.2 },
	toggleSub:   { fontFamily: FONTS.body.regular, fontSize: 12, marginTop: 2 },

	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 18,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	infoLabel: { fontFamily: FONTS.body.regular, fontSize: 13 },
	infoValue: { fontFamily: FONTS.display.regular, fontSize: 15, letterSpacing: -0.2 },

	bottomBar: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderTopWidth: 1,
	},
	bottomBtn: {
		flex: 1,
		paddingVertical: 13,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	bottomBtnText: { fontFamily: FONTS.display.regular, fontSize: 15 },

	deleteBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	deleteSheet: {
		width: 260,
		borderRadius: RADII.default,
		paddingVertical: 8,
		shadowColor: '#000',
		shadowOpacity: 0.15,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 8,
	},
	deleteTitle: {
		fontFamily: FONTS.display.regular,
		fontSize: 17,
		textAlign: 'center',
		paddingTop: 16,
		paddingBottom: 8,
	},
	deleteBody: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		textAlign: 'center',
		paddingHorizontal: 24,
		paddingBottom: 20,
		lineHeight: 18,
	},
	deleteActions: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	deleteBtn: {
		flex: 1,
		paddingVertical: 11,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	deleteBtnText: { fontFamily: FONTS.display.regular, fontSize: 15 },
});
