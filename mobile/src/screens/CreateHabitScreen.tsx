/**
 * New-habit form.
 *
 * Implemented:
 *   - Name, Color, Goal type, Target amount, Unit  (Chunk 1)
 *   - Frequency + per-tab sub-options + Customize sheet  (Chunk 2)
 * Pending:
 *   - Section / Category picker  (Chunk 3) — defaults to seeded "Day"
 *   - Routine multi-select       (Chunk 4)
 */
import { useCallback, useRef, useMemo, useState } from 'react';
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
	useCreateHabit,
	useCreateRoutine,
	useRoutines,
} from '../api/queries';
import type { HabitCreate, HabitMode, HabitSection } from '../api/types';
import {
	Caption,
	ColorPreview,
	ColorSheet,
	Row,
	SelectStyle,
	TextField,
	UnitSheet,
	formStyles,
	hexWithAlpha,
	todayISO,
} from '../components/createHabit/FormPrimitives';
import { CategoryPicker } from '../components/createHabit/CategoryPicker';
import { RoutinePicker } from '../components/createHabit/RoutinePicker';
import { SectionPicker } from '../components/createHabit/SectionPicker';
import { Stepper } from '../components/createHabit/Stepper';
import {
	CustomizeSheet,
	type CustomCadence,
} from '../components/createHabit/CustomizeSheet';
import {
	FrequencyPicker,
	buildScheduleFields,
	initialScheduleState,
	type ScheduleState,
} from '../components/createHabit/FrequencyPicker';
import { Icon } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';

interface CreateHabitScreenProps {
	visible: boolean;
	onClose: () => void;
}

export function CreateHabitScreen({ visible, onClose }: CreateHabitScreenProps) {
	const { colors } = useTheme();

	// Form state
	const [name, setName] = useState('');
	const [colorKey, setColorKey] = useState<string | null>(null);
	const [mode, setMode] = useState<HabitMode>('DO');
	const [target, setTarget] = useState(1);
	const [unit, setUnit] = useState<string | null>('times');
	const [schedule, setSchedule] = useState<ScheduleState>(initialScheduleState);
	const [section, setSection] = useState<HabitSection | null>(null);
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
	const [routineIds, setRoutineIds] = useState<string[]>([]);

	// Sheets / popovers
	const [colorSheetOpen, setColorSheet] = useState(false);
	const [unitSheetOpen, setUnitSheet] = useState(false);
	const [goalPopoverOpen, setGoalPopover] = useState(false);
	const [goalAnchor, setGoalAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
	const goalRowRef = useRef<View>(null);
	const [customizeOpen, setCustomize] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const openGoalPopover = useCallback(() => {
		goalRowRef.current?.measureInWindow((x, y, w, h) => {
			setGoalAnchor({ x, y, w, h });
			setGoalPopover(true);
		});
	}, []);

	const categoriesQuery = useCategories();
	const routinesQuery   = useRoutines();
	const createCategory  = useCreateCategory();
	const createRoutine   = useCreateRoutine();
	const createHabit     = useCreateHabit();

	const reset = () => {
		setName('');
		setColorKey(null);
		setMode('DO');
		setTarget(1);
		setUnit('times');
		setSchedule(initialScheduleState);
		setSection(null);
		setSelectedCategoryId(null);
		setRoutineIds([]);
		setSubmitError(null);
		setColorSheet(false);
		setUnitSheet(false);
		setGoalPopover(false);
		setCustomize(false);
	};

	const dismiss = () => {
		reset();
		onClose();
	};

	const onModeChange = (m: HabitMode) => {
		setMode(m);
		// Spec: DO default target=1, AVOID default target=0
		setTarget(m === 'AVOID' ? 0 : 1);
		setGoalPopover(false);
	};

	const onCustomizeDone = (custom: CustomCadence | null) => {
		setSchedule((s) => ({ ...s, custom }));
		setCustomize(false);
	};

	const canSubmit = name.trim().length > 0 && !createHabit.isPending;

	const submit = async () => {
		setSubmitError(null);
		const sched = buildScheduleFields(schedule);
		const body: HabitCreate = {
			name:    name.trim(),
			mode,
			frequency:               sched.frequency,
			scheduled_weekdays:      sched.scheduled_weekdays,
			scheduled_days_of_month: sched.scheduled_days_of_month,
			scheduled_dates:         sched.scheduled_dates,
			interval_days:           sched.interval_days,
			days_per_week:           sched.days_per_week,
			start_date:              todayISO(),
			section:                 section,
			category_id:             selectedCategoryId,
			target_per_period:       target,
			is_active:        true,
			is_archived:      false,
			increment:        1.0,
			color_key:        colorKey,
			unit:             unit || null,
			routine_ids:      routineIds,
		};
		try {
			// Temporary dev-only diagnostic — when a habit goes missing on Today,
			// this lets us see the exact body to compare against backend UTC date.
			if (__DEV__) {
				// eslint-disable-next-line no-console
				console.log('[create habit] body:', JSON.stringify(body));
			}
			await createHabit.mutateAsync(body);
			dismiss();
		} catch (e) {
			if (e instanceof ApiError) setSubmitError(e.message);
			else if (e instanceof Error) setSubmitError(e.message);
			else setSubmitError('Could not create habit.');
		}
	};

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
			<SafeAreaView style={[formStyles.root, { backgroundColor: colors.paper }]} edges={['top']}>
				<KeyboardAvoidingView
					style={formStyles.flex}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					<FormHeader onBack={dismiss} onSubmit={submit} canSubmit={canSubmit} pending={createHabit.isPending} />

					<ScrollView
						style={formStyles.flex}
						contentContainerStyle={formStyles.scrollContent}
						keyboardShouldPersistTaps="handled"
					>
						{/* ── Name ───────────────────────────────────────── */}
						<Row label="Name">
							<TextField value={name} onChangeText={setName} placeholder="Drink water" />
						</Row>

						{/* ── Color ──────────────────────────────────────── */}
						<Row
							label="Color"
							sub={colorKey ? undefined : 'Tap to choose'}
							onPress={() => setColorSheet(true)}
						>
							<ColorPreview colorKey={colorKey} />
						</Row>

						{/* ── Goal type ──────────────────────────────────── */}
						<View ref={goalRowRef} collapsable={false}>
							<Row label="Goal type" onPress={openGoalPopover}>
								<SelectStyle
									value={mode === 'DO' ? 'Do' : 'Avoid'}
									open={goalPopoverOpen}
									onPress={openGoalPopover}
									width={130}
								/>
							</Row>
						</View>

						{/* ── Target amount + Unit ───────────────────────── */}
						<View style={[formStyles.row, { borderBottomColor: colors.line }]}>
							<View style={formStyles.colTarget}>
								<Caption>{mode === 'DO' ? 'Target amount' : 'Limit amount'}</Caption>
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

						{/* ── Frequency ──────────────────────────────────── */}
						<FrequencyPicker
							state={schedule}
							onChange={setSchedule}
							onOpenCustomize={() => setCustomize(true)}
						/>

						{/* ── Section (time of day) ───────────────────────── */}
						<SectionPicker
							selected={section}
							onSelect={setSection}
						/>

						{/* ── Category (user grouping) ────────────────────── */}
						<CategoryPicker
							categories={categoriesQuery.data ?? []}
							selectedId={selectedCategoryId}
							onSelect={setSelectedCategoryId}
							onCreate={async (name) => {
								const cat = await createCategory.mutateAsync(name);
								return cat.id;
							}}
						/>

						{/* ── Routine multi-select ───────────────────────── */}
						<RoutinePicker
							routines={routinesQuery.data ?? []}
							selectedIds={routineIds}
							onChange={setRoutineIds}
							onCreate={async (name) => {
								// Minimal DAILY routine; per-routine scheduling lives on
								// the routines screen we haven't built yet.
								const routine = await createRoutine.mutateAsync({
									name,
									is_active:  true,
									frequency:  'DAILY',
									start_date: todayISO(),
									habits:     [],
								});
								return routine.id;
							}}
						/>

						{submitError && (
							<Text style={[formStyles.error, { color: colors.accent }]}>{submitError}</Text>
						)}
					</ScrollView>
				</KeyboardAvoidingView>

				<GoalPopover
					visible={goalPopoverOpen}
					anchor={goalAnchor}
					mode={mode}
					onPick={onModeChange}
					onDismiss={() => setGoalPopover(false)}
				/>

				{/* ── Bottom sheets ──────────────────────────────────────── */}
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
			</SafeAreaView>
		</Modal>
	);
}

function FormHeader({
	onBack, onSubmit, canSubmit, pending,
}: { onBack: () => void; onSubmit: () => void; canSubmit: boolean; pending: boolean }) {
	const { colors } = useTheme();
	return (
		<View style={[formStyles.header, { borderBottomColor: colors.line }]}>
			<Pressable onPress={onBack} style={[formStyles.iconBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}>
				<Icon name="left" size={19} color={colors.ink} />
			</Pressable>
			<Text style={[formStyles.title, { color: colors.ink }]}>New Habit</Text>
			<Pressable
				onPress={onSubmit}
				disabled={!canSubmit}
				style={({ pressed }) => [
					styles.submit,
					{
						backgroundColor: colors.accent,
						opacity: !canSubmit || pressed ? 0.55 : 1,
					},
				]}
			>
				<Text style={[styles.submitLabel, { color: colors.paper }]}>
					{pending ? '…' : 'Add Habit'}
				</Text>
			</Pressable>
		</View>
	);
}

function GoalPopover({
	visible, anchor, mode, onPick, onDismiss,
}: {
	visible: boolean;
	anchor: { x: number; y: number; w: number; h: number } | null;
	mode: HabitMode;
	onPick: (m: HabitMode) => void;
	onDismiss: () => void;
}) {
	const { colors } = useTheme();
	const options: { value: HabitMode; label: string; desc: string }[] = [
		{ value: 'DO',    label: 'Do',    desc: 'Build a habit' },
		{ value: 'AVOID', label: 'Avoid', desc: 'Break a habit' },
	];
	if (!visible || !anchor) return null;
	return (
		<Modal visible transparent animationType="none" onRequestClose={onDismiss}>
			<Pressable style={styles.dropdownBackdrop} onPress={onDismiss}>
				<View
					style={[
						styles.dropdown,
						{
							position: 'absolute',
							top: anchor.y + anchor.h + 2,
							right: 18,
							backgroundColor: colors.card,
							borderColor: colors.line,
						},
					]}
				>
					{options.map((opt) => {
						const on = opt.value === mode;
						return (
							<Pressable
								key={opt.value}
								onPress={() => { onPick(opt.value); onDismiss(); }}
								style={[
									styles.dropdownRow,
									on ? { backgroundColor: hexWithAlpha(colors.accent, 0.1) } : null,
								]}
							>
								<View style={{ flex: 1 }}>
									<Text style={{ fontFamily: FONTS.display.regular, fontSize: 15, color: colors.ink }}>{opt.label}</Text>
									<Text style={{ fontFamily: FONTS.body.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>{opt.desc}</Text>
								</View>
								{on && <Icon name="check" size={18} color={colors.accent} strokeWidth={2.6} />}
							</Pressable>
						);
					})}
				</View>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	submit: {
		paddingHorizontal: 14, paddingVertical: 9,
		borderRadius: RADII.default,
	},
	submitLabel: { fontFamily: FONTS.display.regular, fontSize: 14, letterSpacing: -0.2 },

	dropdownBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.15)',
	},
	dropdown: {
		minWidth: 240,
		maxWidth: 280,
		padding: 6,
		borderRadius: 9,
		borderWidth: 1,
		shadowColor: '#000',
		shadowOpacity: 0.12,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 6 },
		elevation: 6,
	},
	dropdownRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		padding: 12,
		borderRadius: 7,
	},
});
