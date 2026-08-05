import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
	useAllHabits,
	useCategories,
	useCreateCategory,
	useCreateRoutine,
	useCreateVacation,
	useDeleteCategory,
	useDeleteRoutine,
	useDeleteVacation,
	useCreateIntegrationKey,
	useIntegrationKey,
	useRevokeIntegrationKey,
	useRoutine,
	useRoutines,
	useUpdateCategory,
	useUpdateRoutine,
	useVacations,
} from '../api/queries';
import { API_BASE_URL } from '../config';
import { useAuth } from '../auth/AuthProvider';
import { BottomNav, type NavTab } from '../components/today/BottomNav';
import { Icon, type IconName } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';
import type { SurfaceName } from '../theme/types';
import { isoDate } from '../utils/dates';

const THEME_OPTIONS: { key: SurfaceName | 'system'; label: string }[] = [
	{ key: 'system', label: 'System' },
	{ key: 'light',  label: 'Light' },
	{ key: 'dark',   label: 'Dark' },
];

const WEEK_START_OPTIONS = [
	{ key: 'monday', label: 'Monday' },
	{ key: 'sunday', label: 'Sunday' },
];

const TIME_FORMAT_OPTIONS = [
	{ key: '12h', label: '12-hour' },
	{ key: '24h', label: '24-hour' },
];

export function SettingsScreen({ onNavigate }: { onNavigate?: (tab: NavTab) => void }) {
	const { colors, setSurface } = useTheme();
	const { logout } = useAuth();

	const vacationsQ = useVacations();

	const createVacation = useCreateVacation();
	const deleteVacation = useDeleteVacation();

	const [themeChoice, setThemeChoice] = useState<SurfaceName | 'system'>('system');
	const [weekStart, setWeekStart]     = useState('monday');
	const [timeFormat, setTimeFormat]   = useState('12h');

	const [categoriesOpen, setCategoriesOpen] = useState(false);
	const [routinesOpen, setRoutinesOpen]     = useState(false);
	const [changePasswordOpen, setChangePasswordOpen] = useState(false);
	const [repcueModalOpen, setRepcueModalOpen] = useState(false);

	const todayStr = isoDate(new Date());
	const activeVacation = (vacationsQ.data ?? []).find(
		(v) => v.start_date <= todayStr && v.end_date >= todayStr,
	);

	const handleThemeChange = (key: SurfaceName | 'system') => {
		setThemeChoice(key);
		if (key === 'system') {
			setSurface('light');
		} else {
			setSurface(key);
		}
	};

	const toggleVacation = () => {
		if (activeVacation) {
			deleteVacation.mutate(activeVacation.id);
		} else {
			const end = new Date();
			end.setDate(end.getDate() + 7);
			createVacation.mutate({
				name: 'Vacation',
				start_date: todayStr,
				end_date: isoDate(end),
			});
		}
	};

	const confirmLogout = () => {
		Alert.alert('Log Out', 'Are you sure?', [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Log Out', style: 'destructive', onPress: () => logout() },
		]);
	};

	const confirmDeleteAccount = () => {
		Alert.alert(
			'Delete Account',
			'This will permanently delete your account and all data. This cannot be undone.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete Account', style: 'destructive', onPress: () => {
					// TODO: implement account deletion endpoint
				}},
			],
		);
	};

	return (
		<ScrollView
			style={[styles.root, { backgroundColor: colors.paper }]}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			{/* ── Quick Actions ─────────────────────────────── */}
			<GroupHeader label="Quick Actions" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Row
					icon="pause"
					label="Vacation Mode"
					colors={colors}
					right={
						<Text style={[styles.rowValue, {
							color: activeVacation ? colors.accent : colors.muted,
						}]}>
							{activeVacation ? 'On' : 'Off'}
						</Text>
					}
					onPress={toggleVacation}
				/>
			</View>

			{/* ── Manage ───────────────────────────────────── */}
			<GroupHeader label="Manage" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Row icon="list" label="Manage Categories" colors={colors}
					onPress={() => setCategoriesOpen(true)} />
				<View style={[styles.rowDivider, { backgroundColor: colors.line }]} />
				<Row icon="reorder" label="Manage Routines" colors={colors}
					onPress={() => setRoutinesOpen(true)} />
				<View style={[styles.rowDivider, { backgroundColor: colors.line }]} />
				<Row icon="grid" label="Widgets" colors={colors}
					onPress={() => Alert.alert(
						'Widgets',
						'To add or configure widgets, long-press your home screen and select "Widgets", then find Daybook in the list.',
					)} />
			</View>

			{/* ── Integrations ────────────────────────────── */}
			<GroupHeader label="Integrations" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Row icon="link" label="RepCue Connection" colors={colors}
					onPress={() => setRepcueModalOpen(true)} />
			</View>

			{/* ── Appearance ───────────────────────────────── */}
			<GroupHeader label="Appearance" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Text style={[styles.subGroupLabel, { color: colors.muted }]}>Theme</Text>
				<SegmentedControl
					options={THEME_OPTIONS}
					selected={themeChoice}
					onSelect={handleThemeChange}
					colors={colors}
				/>

				<View style={[styles.separator, { backgroundColor: colors.line }]} />

				<Text style={[styles.subGroupLabel, { color: colors.muted }]}>Week Starts On</Text>
				<SegmentedControl
					options={WEEK_START_OPTIONS}
					selected={weekStart}
					onSelect={setWeekStart}
					colors={colors}
				/>

				<View style={[styles.separator, { backgroundColor: colors.line }]} />

				<Text style={[styles.subGroupLabel, { color: colors.muted }]}>Time Format</Text>
				<SegmentedControl
					options={TIME_FORMAT_OPTIONS}
					selected={timeFormat}
					onSelect={setTimeFormat}
					colors={colors}
				/>
			</View>

			{/* ── Account ──────────────────────────────────── */}
			<GroupHeader label="Account" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<Row icon="edit" label="Change Password" colors={colors} onPress={() => setChangePasswordOpen(true)} />
				<View style={[styles.rowDivider, { backgroundColor: colors.line }]} />
				<Row icon="right" label="Log Out" colors={colors} onPress={confirmLogout} />
				<View style={[styles.rowDivider, { backgroundColor: colors.line }]} />
				<Row
					icon="trash"
					label="Delete Account"
					colors={colors}
					labelColor={colors.accent}
					onPress={confirmDeleteAccount}
				/>
			</View>

			{/* ── About ────────────────────────────────────── */}
			<GroupHeader label="About" colors={colors} />
			<View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}>
				<View style={styles.aboutRow}>
					<Text style={[styles.rowLabel, { color: colors.ink }]}>Daybook</Text>
					<Text style={[styles.rowValue, { color: colors.muted }]}>v0.1.0</Text>
				</View>
			</View>

			<View style={{ height: 60 }} />

			{/* ── Modals ───────────────────────────────────── */}
			<ManageCategoriesModal
				visible={categoriesOpen}
				onClose={() => setCategoriesOpen(false)}
				onNavigate={onNavigate}
			/>
			<ManageRoutinesModal
				visible={routinesOpen}
				onClose={() => setRoutinesOpen(false)}
				onNavigate={onNavigate}
			/>
			<ChangePasswordModal
				visible={changePasswordOpen}
				onClose={() => setChangePasswordOpen(false)}
			/>
			<RepCueConnectionModal
				visible={repcueModalOpen}
				onClose={() => setRepcueModalOpen(false)}
			/>
		</ScrollView>
	);
}

// ── Manage Categories Modal ────────────────────────────────────────────

function ManageCategoriesModal({
	visible, onClose, onNavigate,
}: {
	visible: boolean; onClose: () => void; onNavigate?: (tab: NavTab) => void;
}) {
	const { colors } = useTheme();
	const categoriesQ    = useCategories();
	const createCategory = useCreateCategory();
	const updateCategory = useUpdateCategory();
	const deleteCategory = useDeleteCategory();

	const [editingId, setEditingId]     = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');
	const [creating, setCreating]       = useState(false);
	const [newName, setNewName]         = useState('');
	const submitting = useRef(false);

	const submitRename = () => {
		if (!editingId) return;
		const trimmed = editingName.trim();
		if (trimmed) updateCategory.mutate({ id: editingId, name: trimmed });
		setEditingId(null);
		setEditingName('');
	};

	const submitCreate = () => {
		if (submitting.current) return;
		const trimmed = newName.trim();
		if (!trimmed) {
			setCreating(false);
			setNewName('');
			return;
		}
		submitting.current = true;
		createCategory.mutate(trimmed, {
			onSettled: () => {
				submitting.current = false;
				setCreating(false);
				setNewName('');
			},
		});
	};

	const confirmDelete = (id: string, name: string) => {
		Alert.alert(
			'Delete Category',
			`Remove "${name}"? Habits in this category will become uncategorized.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete', style: 'destructive', onPress: () => deleteCategory.mutate(id) },
			],
		);
	};

	const items = categoriesQ.data ?? [];

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			<SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.paper }]} edges={['top']}>
				<View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
					<Pressable onPress={onClose} hitSlop={8}>
						<Icon name="left" size={22} color={colors.ink} />
					</Pressable>
					<Text style={[styles.modalTitle, { color: colors.ink }]}>Categories</Text>
					<Pressable onPress={() => { setCreating(true); setEditingId(null); }} hitSlop={8}>
						<Icon name="plus" size={22} color={colors.ink} strokeWidth={2} />
					</Pressable>
				</View>

				<ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
					{creating && (
						<View style={[styles.manageRow, { borderBottomColor: colors.line }]}>
							<TextInput
								autoFocus
								value={newName}
								onChangeText={setNewName}
								onSubmitEditing={submitCreate}
								onBlur={submitCreate}
								placeholder="New category name"
								placeholderTextColor={colors.muted}
								returnKeyType="done"
								style={[styles.editInput, {
									color: colors.ink,
									borderColor: colors.accent,
									backgroundColor: colors.card,
								}]}
							/>
						</View>
					)}

					{items.length === 0 && !creating ? (
						<Text style={[styles.emptyHint, { color: colors.muted }]}>
							No categories yet. Tap + to create one.
						</Text>
					) : (
						items.map((cat) => (
							<View
								key={cat.id}
								style={[styles.manageRow, { borderBottomColor: colors.line }]}
							>
								{editingId === cat.id ? (
									<TextInput
										autoFocus
										value={editingName}
										onChangeText={setEditingName}
										onSubmitEditing={submitRename}
										onBlur={submitRename}
										returnKeyType="done"
										style={[styles.editInput, {
											color: colors.ink,
											borderColor: colors.accent,
											backgroundColor: colors.card,
										}]}
									/>
								) : (
									<Pressable
										style={styles.manageLabel}
										onPress={() => {
											setEditingId(cat.id);
											setEditingName(cat.name);
											setCreating(false);
										}}
									>
										<Text style={[styles.rowLabel, { color: colors.ink }]}>
											{cat.name}
										</Text>
										<Text style={[styles.tapHint, { color: colors.muted }]}>
											Tap to rename
										</Text>
									</Pressable>
								)}
								<Pressable
									hitSlop={8}
									onPress={() => confirmDelete(cat.id, cat.name)}
								>
									<Icon name="trash" size={18} color={colors.muted} />
								</Pressable>
							</View>
						))
					)}
				</ScrollView>
				<BottomNav active="Settings" onTabChange={(tab) => {
					onClose();
					onNavigate?.(tab);
				}} />
			</SafeAreaView>
		</Modal>
	);
}

// ── Manage Routines Modal ──────────────────────────────────────────────

function ManageRoutinesModal({
	visible, onClose, onNavigate,
}: {
	visible: boolean; onClose: () => void; onNavigate?: (tab: NavTab) => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const handleClose = () => {
		setSelectedId(null);
		onClose();
	};

	const handleNav = (tab: NavTab) => {
		setSelectedId(null);
		onClose();
		onNavigate?.(tab);
	};

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			{selectedId ? (
				<RoutineDetailView routineId={selectedId} onBack={() => setSelectedId(null)} onNavigate={handleNav} />
			) : (
				<RoutineListView
					onClose={handleClose}
					onSelect={setSelectedId}
					onNavigate={handleNav}
				/>
			)}
		</Modal>
	);
}

function RoutineListView({
	onClose, onSelect, onNavigate,
}: {
	onClose: () => void; onSelect: (id: string) => void; onNavigate?: (tab: NavTab) => void;
}) {
	const { colors } = useTheme();
	const routinesQ     = useRoutines();
	const createRoutine = useCreateRoutine();
	const deleteRoutine = useDeleteRoutine();

	const [creating, setCreating] = useState(false);
	const [newName, setNewName]   = useState('');
	const submitting = useRef(false);

	const submitCreate = () => {
		if (submitting.current) return;
		const trimmed = newName.trim();
		if (!trimmed) {
			setCreating(false);
			setNewName('');
			return;
		}
		submitting.current = true;
		createRoutine.mutate({
			name:       trimmed,
			is_active:  true,
			frequency:  'DAILY',
			start_date: isoDate(new Date()),
			habits:     [],
		}, {
			onSettled: () => {
				submitting.current = false;
				setCreating(false);
				setNewName('');
			},
		});
	};

	const confirmDelete = (id: string, name: string) => {
		Alert.alert(
			'Delete Routine',
			`Remove "${name}"?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete', style: 'destructive', onPress: () => deleteRoutine.mutate(id) },
			],
		);
	};

	const items = routinesQ.data ?? [];

	return (
		<SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.paper }]} edges={['top']}>
			<View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
				<Pressable onPress={onClose} hitSlop={8}>
					<Icon name="left" size={22} color={colors.ink} />
				</Pressable>
				<Text style={[styles.modalTitle, { color: colors.ink }]}>Routines</Text>
				<Pressable onPress={() => setCreating(true)} hitSlop={8}>
					<Icon name="plus" size={22} color={colors.ink} strokeWidth={2} />
				</Pressable>
			</View>

			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<ScrollView
					style={styles.modalScroll}
					contentContainerStyle={styles.modalContent}
					keyboardShouldPersistTaps="handled"
				>
					{creating && (
						<View style={[styles.manageRow, { borderBottomColor: colors.line }]}>
							<TextInput
								autoFocus
								value={newName}
								onChangeText={setNewName}
								onSubmitEditing={submitCreate}
								onBlur={submitCreate}
								placeholder="New routine name"
								placeholderTextColor={colors.muted}
								returnKeyType="done"
								style={[styles.editInput, {
									color: colors.ink,
									borderColor: colors.accent,
									backgroundColor: colors.card,
								}]}
							/>
						</View>
					)}

					{items.length === 0 && !creating ? (
						<Text style={[styles.emptyHint, { color: colors.muted }]}>
							No routines yet. Tap + to create one.
						</Text>
					) : (
						items.map((r) => (
							<Pressable
								key={r.id}
								style={[styles.manageRow, { borderBottomColor: colors.line }]}
								onPress={() => onSelect(r.id)}
							>
								<View style={styles.manageLabel}>
									<Text style={[styles.rowLabel, { color: colors.ink }]}>
										{r.name}
									</Text>
									<Text style={[styles.tapHint, { color: colors.muted }]}>
										{r.frequency.toLowerCase()} · {r.habits?.length ?? 0} habits
									</Text>
								</View>
								<Pressable
									hitSlop={8}
									onPress={(e) => { e.stopPropagation(); confirmDelete(r.id, r.name); }}
								>
									<Icon name="trash" size={18} color={colors.muted} />
								</Pressable>
							</Pressable>
						))
					)}
				</ScrollView>
			</KeyboardAvoidingView>
			<BottomNav active="Settings" onTabChange={(tab) => onNavigate?.(tab)} />
		</SafeAreaView>
	);
}

// ── Routine Detail (habits management) ──────────────────────────────

type SlotDraft = {
	habit_id: string;
	habitName: string;
	timer_seconds: number | null;
	timer_type: 'TIMER' | 'COUNTDOWN' | null;
};

function RoutineDetailView({
	routineId, onBack, onNavigate,
}: {
	routineId: string; onBack: () => void; onNavigate?: (tab: NavTab) => void;
}) {
	const { colors } = useTheme();
	const routineQ      = useRoutine(routineId);
	const allHabitsQ    = useAllHabits();
	const updateRoutine = useUpdateRoutine();

	const [slots, setSlots]       = useState<SlotDraft[]>([]);
	const [editing, setEditing]   = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [timerSlotIdx, setTimerSlotIdx] = useState<number | null>(null);
	const [dirty, setDirty]       = useState(false);

	const routine = routineQ.data;

	useEffect(() => {
		if (!routine || dirty) return;
		setSlots(
			(routine.habits ?? [])
				.sort((a, b) => a.position - b.position)
				.map((s) => ({
					habit_id:      s.habit.id,
					habitName:     s.habit.name,
					timer_seconds: s.timer_seconds ?? null,
					timer_type:    s.timer_type ?? null,
				})),
		);
	}, [routine, dirty]);

	const saveSlots = (slotsToSave: SlotDraft[]) => {
		updateRoutine.mutate({
			id: routineId,
			body: {
				habits: slotsToSave.map((s) => ({
					habit_id: s.habit_id,
					timer_seconds: s.timer_seconds,
					timer_type:    s.timer_seconds ? (s.timer_type ?? 'COUNTDOWN') : null,
				})),
			},
		}, {
			onSuccess: () => {
				setDirty(false);
				setEditing(false);
			},
		});
	};

	const save = () => saveSlots(slots);

	const removeSlot = (idx: number) => {
		setSlots((prev) => prev.filter((_, i) => i !== idx));
		setDirty(true);
	};

	const moveSlot = (from: number, to: number) => {
		if (to < 0 || to >= slots.length) return;
		setSlots((prev) => {
			const next = [...prev];
			const [item] = next.splice(from, 1);
			next.splice(to, 0, item);
			return next;
		});
		setDirty(true);
	};

	const addHabits = (habitIds: { id: string; name: string }[]) => {
		setSlots((prev) => [
			...prev,
			...habitIds.map((h) => ({
				habit_id:      h.id,
				habitName:     h.name,
				timer_seconds: null as number | null,
				timer_type:    null as 'TIMER' | 'COUNTDOWN' | null,
			})),
		]);
		setDirty(true);
		setPickerOpen(false);
	};

	const setTimer = (idx: number, seconds: number | null, type: 'TIMER' | 'COUNTDOWN' | null) => {
		const updated = slots.map((s, i) =>
			i === idx ? { ...s, timer_seconds: seconds, timer_type: type } : s,
		);
		setSlots(updated);
		setTimerSlotIdx(null);
		if (editing) {
			setDirty(true);
		} else {
			saveSlots(updated);
		}
	};

	const existingIds = new Set(slots.map((s) => s.habit_id));
	const availableHabits = (allHabitsQ.data ?? [])
		.filter((h) => !existingIds.has(h.id))
		.map((h) => ({ id: h.id, name: h.name }));

	const formatTimer = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`;
	};

	return (
		<SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.paper }]} edges={['top']}>
			<View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
				<Pressable onPress={onBack} hitSlop={8}>
					<Icon name="left" size={22} color={colors.ink} />
				</Pressable>
				<Text style={[styles.modalTitle, { color: colors.ink }]} numberOfLines={1}>
					{routine?.name ?? '…'}
				</Text>
				<Pressable
					onPress={() => {
						if (editing && dirty) save();
						else setEditing(!editing);
					}}
					hitSlop={8}
				>
					<Text style={{
						fontFamily: FONTS.body.medium,
						fontSize: 15,
						color: editing && dirty ? colors.accent : colors.ink,
					}}>
						{editing ? (dirty ? 'Save' : 'Done') : 'Edit'}
					</Text>
				</Pressable>
			</View>

			{routineQ.isLoading ? (
				<View style={styles.detailCenter}>
					<Text style={{ color: colors.muted, fontFamily: FONTS.body.regular }}>Loading…</Text>
				</View>
			) : (
				<ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
					{slots.length === 0 ? (
						<Text style={[styles.emptyHint, { color: colors.muted }]}>
							No habits in this routine yet.
						</Text>
					) : (
						slots.map((slot, idx) => (
							<View
								key={`${slot.habit_id}-${idx}`}
								style={[styles.manageRow, { borderBottomColor: colors.line }]}
							>
								{editing && (
									<View style={styles.reorderControls}>
										<Pressable
											hitSlop={4}
											onPress={() => moveSlot(idx, idx - 1)}
											disabled={idx === 0}
										>
											<View style={{ transform: [{ rotate: '180deg' }] }}>
												<Icon name="chevron" size={16}
													color={idx === 0 ? colors.line : colors.ink}
												/>
											</View>
										</Pressable>
										<Pressable
											hitSlop={4}
											onPress={() => moveSlot(idx, idx + 1)}
											disabled={idx === slots.length - 1}
										>
											<Icon name="chevron" size={16}
												color={idx === slots.length - 1 ? colors.line : colors.ink}
											/>
										</Pressable>
									</View>
								)}

								<View style={styles.manageLabel}>
									<Text style={[styles.rowLabel, { color: colors.ink }]}>
										{slot.habitName}
									</Text>
									{slot.timer_seconds ? (
										<Pressable onPress={() => setTimerSlotIdx(idx)}>
											<Text style={[styles.tapHint, { color: colors.accent }]}>
												{slot.timer_type === 'TIMER' ? '⏱' : '⏳'} {formatTimer(slot.timer_seconds)}
											</Text>
										</Pressable>
									) : (
										<Pressable onPress={() => setTimerSlotIdx(idx)}>
											<Text style={[styles.tapHint, { color: colors.muted }]}>
												Tap to set timer
											</Text>
										</Pressable>
									)}
								</View>

								{editing && (
									<Pressable hitSlop={8} onPress={() => removeSlot(idx)}>
										<Icon name="close" size={16} color={colors.muted} />
									</Pressable>
								)}
							</View>
						))
					)}

					{editing && (
						<Pressable
							style={[styles.addHabitBtn, { borderColor: colors.line }]}
							onPress={() => setPickerOpen(true)}
						>
							<Icon name="plus" size={18} color={colors.accent} strokeWidth={2} />
							<Text style={{
								fontFamily: FONTS.body.medium,
								fontSize: 15,
								color: colors.accent,
								marginLeft: 8,
							}}>
								Add Habit
							</Text>
						</Pressable>
					)}
				</ScrollView>
			)}

			<BottomNav active="Settings" onTabChange={(tab) => onNavigate?.(tab)} />

			{/* Habit Picker */}
			<Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
				<HabitPickerView
					available={availableHabits}
					onAdd={addHabits}
					onClose={() => setPickerOpen(false)}
				/>
			</Modal>

			{/* Timer Editor */}
			<Modal visible={timerSlotIdx !== null} animationType="fade" transparent>
				{timerSlotIdx !== null && (
					<TimerEditor
						slot={slots[timerSlotIdx]}
						onSave={(secs, type) => setTimer(timerSlotIdx, secs, type)}
						onClear={() => setTimer(timerSlotIdx, null, null)}
						onClose={() => setTimerSlotIdx(null)}
					/>
				)}
			</Modal>
		</SafeAreaView>
	);
}

// ── Habit Picker ────────────────────────────────────────────────────

function HabitPickerView({
	available, onAdd, onClose,
}: {
	available: { id: string; name: string }[];
	onAdd: (habits: { id: string; name: string }[]) => void;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [search, setSearch]     = useState('');

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const filtered = search.trim()
		? available.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
		: available;

	return (
		<SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.paper }]} edges={['top']}>
			<View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
				<Pressable onPress={onClose} hitSlop={8}>
					<Icon name="left" size={22} color={colors.ink} />
				</Pressable>
				<Text style={[styles.modalTitle, { color: colors.ink }]}>Add Habits</Text>
				<Pressable
					onPress={() => {
						const picks = available.filter((h) => selected.has(h.id));
						if (picks.length > 0) onAdd(picks);
						else onClose();
					}}
					hitSlop={8}
				>
					<Text style={{
						fontFamily: FONTS.body.medium,
						fontSize: 15,
						color: selected.size > 0 ? colors.accent : colors.muted,
					}}>
						{selected.size > 0 ? `Add (${selected.size})` : 'Done'}
					</Text>
				</Pressable>
			</View>

			<View style={[styles.searchRow, { borderBottomColor: colors.line }]}>
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search habits…"
					placeholderTextColor={colors.muted}
					style={[styles.searchInput, {
						color: colors.ink,
						backgroundColor: colors.card,
						borderColor: colors.line,
					}]}
				/>
			</View>

			<ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
				{filtered.length === 0 ? (
					<Text style={[styles.emptyHint, { color: colors.muted }]}>
						{available.length === 0
							? 'All habits are already in this routine.'
							: 'No habits match your search.'}
					</Text>
				) : (
					filtered.map((h) => (
						<Pressable
							key={h.id}
							style={[styles.manageRow, { borderBottomColor: colors.line }]}
							onPress={() => toggle(h.id)}
						>
							<View style={[
								styles.checkbox,
								{
									borderColor: selected.has(h.id) ? colors.accent : colors.line,
									backgroundColor: selected.has(h.id) ? colors.accent : 'transparent',
								},
							]}>
								{selected.has(h.id) && (
									<Icon name="check" size={14} color={colors.paper} strokeWidth={2.5} />
								)}
							</View>
							<Text style={[styles.rowLabel, { color: colors.ink }]}>{h.name}</Text>
						</Pressable>
					))
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

// ── Timer Editor ────────────────────────────────────────────────────

function TimerEditor({
	slot, onSave, onClear, onClose,
}: {
	slot: SlotDraft;
	onSave: (seconds: number, type: 'TIMER' | 'COUNTDOWN') => void;
	onClear: () => void;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const [minutes, setMinutes] = useState(() =>
		slot.timer_seconds ? String(Math.floor(slot.timer_seconds / 60)) : '',
	);
	const [seconds, setSeconds] = useState(() =>
		slot.timer_seconds ? String(slot.timer_seconds % 60) : '',
	);
	const [type, setType] = useState<'TIMER' | 'COUNTDOWN'>(
		slot.timer_type ?? 'COUNTDOWN',
	);

	const handleSave = () => {
		const totalSecs = (parseInt(minutes || '0', 10) * 60) + parseInt(seconds || '0', 10);
		if (totalSecs > 0) onSave(totalSecs, type);
		else onClose();
	};

	return (
		<Pressable style={styles.timerOverlay} onPress={onClose}>
			<Pressable style={[styles.timerCard, { backgroundColor: colors.paper }]}>
				<Text style={[styles.timerTitle, { color: colors.ink }]}>
					Timer for {slot.habitName}
				</Text>

				<View style={styles.timerInputRow}>
					<View style={styles.timerField}>
						<TextInput
							value={minutes}
							onChangeText={setMinutes}
							keyboardType="number-pad"
							placeholder="0"
							placeholderTextColor={colors.muted}
							maxLength={3}
							style={[styles.timerInput, {
								color: colors.ink,
								borderColor: colors.line,
								backgroundColor: colors.card,
							}]}
						/>
						<Text style={[styles.timerUnit, { color: colors.muted }]}>min</Text>
					</View>
					<View style={styles.timerField}>
						<TextInput
							value={seconds}
							onChangeText={setSeconds}
							keyboardType="number-pad"
							placeholder="0"
							placeholderTextColor={colors.muted}
							maxLength={2}
							style={[styles.timerInput, {
								color: colors.ink,
								borderColor: colors.line,
								backgroundColor: colors.card,
							}]}
						/>
						<Text style={[styles.timerUnit, { color: colors.muted }]}>sec</Text>
					</View>
				</View>

				<View style={styles.timerTypeRow}>
					{(['COUNTDOWN', 'TIMER'] as const).map((t) => (
						<Pressable
							key={t}
							style={[
								styles.timerTypeBtn,
								{
									borderColor: type === t ? colors.accent : colors.line,
									backgroundColor: type === t ? colors.accent + '18' : 'transparent',
								},
							]}
							onPress={() => setType(t)}
						>
							<Text style={{
								fontFamily: FONTS.body.medium,
								fontSize: 13,
								color: type === t ? colors.accent : colors.ink,
							}}>
								{t === 'COUNTDOWN' ? '⏳ Countdown' : '⏱ Stopwatch'}
							</Text>
						</Pressable>
					))}
				</View>

				<Text style={[styles.timerHint, { color: colors.muted }]}>
					{type === 'COUNTDOWN'
						? 'Counts down to zero. Can run alongside other habits.'
						: 'Counts up. Pauses when you move to the next habit.'}
				</Text>

				<View style={styles.timerActions}>
					{slot.timer_seconds && (
						<Pressable onPress={onClear} style={styles.timerActionBtn}>
							<Text style={{ fontFamily: FONTS.body.medium, fontSize: 15, color: colors.muted }}>
								Remove
							</Text>
						</Pressable>
					)}
					<Pressable onPress={onClose} style={styles.timerActionBtn}>
						<Text style={{ fontFamily: FONTS.body.medium, fontSize: 15, color: colors.ink }}>
							Cancel
						</Text>
					</Pressable>
					<Pressable onPress={handleSave} style={styles.timerActionBtn}>
						<Text style={{ fontFamily: FONTS.body.medium, fontSize: 15, color: colors.accent }}>
							Save
						</Text>
					</Pressable>
				</View>
			</Pressable>
		</Pressable>
	);
}

// ── Change Password Modal ──────────────────────────────────────────────

function ChangePasswordModal({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const [current, setCurrent] = useState('');
	const [newPw, setNewPw] = useState('');
	const [confirm, setConfirm] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const reset = () => {
		setCurrent('');
		setNewPw('');
		setConfirm('');
		setError(null);
		setSuccess(false);
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const submit = async () => {
		setError(null);
		if (newPw.length < 8) {
			setError('New password must be at least 8 characters.');
			return;
		}
		if (newPw !== confirm) {
			setError('New passwords do not match.');
			return;
		}
		setSubmitting(true);
		try {
			const { auth } = await import('../api/endpoints');
			await auth.changePassword(current, newPw);
			setSuccess(true);
		} catch (e: any) {
			setError(e?.message ?? 'Something went wrong.');
		} finally {
			setSubmitting(false);
		}
	};

	const canSubmit = current.length > 0 && newPw.length > 0 && confirm.length > 0 && !submitting;

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
			<SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.paper }]} edges={['top']}>
				<View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
					<Pressable onPress={handleClose} hitSlop={8}>
						<Icon name="left" size={22} color={colors.ink} />
					</Pressable>
					<Text style={[styles.modalTitle, { color: colors.ink }]}>Change Password</Text>
					<View style={{ width: 22 }} />
				</View>

				<View style={styles.changePwContent}>
					{success ? (
						<View style={styles.changePwSuccess}>
							<Icon name="check" size={32} color={colors.accent} strokeWidth={2.5} />
							<Text style={[styles.changePwSuccessText, { color: colors.ink }]}>
								Password updated
							</Text>
							<Pressable
								style={[styles.changePwBtn, { backgroundColor: colors.ink }]}
								onPress={handleClose}
							>
								<Text style={[styles.changePwBtnLabel, { color: colors.paper }]}>Done</Text>
							</Pressable>
						</View>
					) : (
						<>
							<TextInput
								style={[styles.changePwInput, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
								placeholder="Current password"
								placeholderTextColor={colors.muted}
								secureTextEntry
								autoCapitalize="none"
								value={current}
								onChangeText={setCurrent}
								editable={!submitting}
							/>
							<TextInput
								style={[styles.changePwInput, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
								placeholder="New password"
								placeholderTextColor={colors.muted}
								secureTextEntry
								autoCapitalize="none"
								value={newPw}
								onChangeText={setNewPw}
								editable={!submitting}
							/>
							<TextInput
								style={[styles.changePwInput, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
								placeholder="Confirm new password"
								placeholderTextColor={colors.muted}
								secureTextEntry
								autoCapitalize="none"
								value={confirm}
								onChangeText={setConfirm}
								editable={!submitting}
							/>
							{error && (
								<Text style={[styles.changePwError, { color: colors.accent }]}>{error}</Text>
							)}
							<Pressable
								style={[styles.changePwBtn, { backgroundColor: colors.ink, opacity: canSubmit ? 1 : 0.5 }]}
								disabled={!canSubmit}
								onPress={submit}
							>
								<Text style={[styles.changePwBtnLabel, { color: colors.paper }]}>
									{submitting ? '...' : 'Update Password'}
								</Text>
							</Pressable>
						</>
					)}
				</View>
			</SafeAreaView>
		</Modal>
	);
}

// ── RepCue Connection Modal ────────────────────────────────────────────

function RepCueConnectionModal({
	visible, onClose,
}: {
	visible: boolean; onClose: () => void;
}) {
	const { colors } = useTheme();
	const keyQ = useIntegrationKey();
	const createKey = useCreateIntegrationKey();
	const revokeKey = useRevokeIntegrationKey();
	const [newKey, setNewKey] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);

	const existingKey = keyQ.data;

	const handleGenerate = useCallback(() => {
		const verb = existingKey ? 'regenerate' : 'generate';
		Alert.alert(
			`${existingKey ? 'Regenerate' : 'Generate'} API Key`,
			existingKey
				? 'This will revoke your current key. RepCue will need the new key to keep syncing.'
				: 'This creates a permanent API key for RepCue to send workout data to Daybook.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: existingKey ? 'Regenerate' : 'Generate',
					onPress: () => {
						createKey.mutate(undefined, {
							onSuccess: (data) => {
								if (data.key) setNewKey(data.key);
							},
						});
					},
				},
			],
		);
	}, [existingKey, createKey]);

	const handleRevoke = useCallback(() => {
		Alert.alert(
			'Revoke API Key',
			'RepCue will no longer be able to send workout data to Daybook.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Revoke',
					style: 'destructive',
					onPress: () => {
						revokeKey.mutate();
						setNewKey(null);
					},
				},
			],
		);
	}, [revokeKey]);

	const copyToClipboard = useCallback((label: string, text: string) => {
		Clipboard.setStringAsync(text).then(() => {
			setCopied(label);
			setTimeout(() => setCopied(null), 2000);
		});
	}, []);

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
				<View style={[rcStyles.header, { borderBottomColor: colors.line }]}>
					<Text style={[rcStyles.title, { color: colors.ink }]}>RepCue Connection</Text>
					<Pressable onPress={onClose} hitSlop={12}>
						<Text style={[rcStyles.doneBtn, { color: colors.accent }]}>Done</Text>
					</Pressable>
				</View>

				<ScrollView style={{ flex: 1 }} contentContainerStyle={rcStyles.body}>
					<Text style={[rcStyles.intro, { color: colors.muted }]}>
						Enter these details in RepCue's settings to connect workout completions to Daybook habits.
					</Text>

					{/* API URL */}
					<Text style={[rcStyles.fieldLabel, { color: colors.muted }]}>API URL</Text>
					<Pressable
						style={[rcStyles.fieldBox, { backgroundColor: colors.chip, borderColor: colors.line }]}
						onPress={() => copyToClipboard('url', API_BASE_URL)}
					>
						<Text style={[rcStyles.fieldValue, { color: colors.ink }]} numberOfLines={1}>
							{API_BASE_URL}
						</Text>
						<Text style={[rcStyles.copyHint, { color: copied === 'url' ? colors.accent : colors.muted }]}>
							{copied === 'url' ? 'Copied!' : 'Tap to copy'}
						</Text>
					</Pressable>

					{/* API Key */}
					<Text style={[rcStyles.fieldLabel, { color: colors.muted }]}>API Key</Text>

					{newKey ? (
						<>
							<Pressable
								style={[rcStyles.fieldBox, { backgroundColor: colors.chip, borderColor: colors.line }]}
								onPress={() => copyToClipboard('key', newKey)}
							>
								<Text style={[rcStyles.fieldValue, { color: colors.ink }]} numberOfLines={1}>
									{newKey.slice(0, 24)}…
								</Text>
								<Text style={[rcStyles.copyHint, { color: copied === 'key' ? colors.accent : colors.muted }]}>
									{copied === 'key' ? 'Copied!' : 'Tap to copy'}
								</Text>
							</Pressable>
							<Text style={[rcStyles.note, { color: colors.muted }]}>
								Save this key now — it won't be shown again.
							</Text>
						</>
					) : existingKey ? (
						<>
							<View style={[rcStyles.fieldBox, { backgroundColor: colors.chip, borderColor: colors.line }]}>
								<Text style={[rcStyles.fieldValue, { color: colors.ink }]}>
									Key active since {new Date(existingKey.created_at).toLocaleDateString()}
								</Text>
							</View>
							<View style={rcStyles.keyActions}>
								<Pressable
									style={[rcStyles.actionBtn, { borderColor: colors.line }]}
									onPress={handleGenerate}
								>
									<Text style={[rcStyles.actionBtnText, { color: colors.ink }]}>
										Regenerate
									</Text>
								</Pressable>
								<Pressable
									style={[rcStyles.actionBtn, { borderColor: colors.line }]}
									onPress={handleRevoke}
								>
									<Text style={[rcStyles.actionBtnText, { color: '#D94040' }]}>
										Revoke
									</Text>
								</Pressable>
							</View>
						</>
					) : (
						<>
							<Pressable
								style={[rcStyles.generateBtn, { backgroundColor: colors.accent }]}
								onPress={handleGenerate}
							>
								<Text style={[rcStyles.generateBtnText, { color: '#fff' }]}>
									Generate API Key
								</Text>
							</Pressable>
							<Text style={[rcStyles.note, { color: colors.muted }]}>
								This key does not expire. You only need to set it up once.
							</Text>
						</>
					)}
				</ScrollView>
			</SafeAreaView>
		</Modal>
	);
}

const rcStyles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 18,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	title: {
		fontFamily: FONTS.display.semibold,
		fontSize: 17,
	},
	doneBtn: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
	body: {
		padding: 18,
	},
	intro: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 24,
	},
	fieldLabel: {
		fontFamily: FONTS.body.semibold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 6,
	},
	fieldBox: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderRadius: RADII.default,
		borderWidth: 1,
		marginBottom: 20,
	},
	fieldValue: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		flex: 1,
		marginRight: 8,
	},
	copyHint: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},
	note: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		lineHeight: 17,
		marginTop: 4,
	},
	keyActions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: -8,
		marginBottom: 12,
	},
	actionBtn: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 10,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	actionBtnText: {
		fontFamily: FONTS.display.regular,
		fontSize: 14,
	},
	generateBtn: {
		alignItems: 'center',
		paddingVertical: 12,
		borderRadius: RADII.default,
		marginBottom: 8,
	},
	generateBtnText: {
		fontFamily: FONTS.display.semibold,
		fontSize: 14,
	},
});

// ── Shared subcomponents ───────────────────────────────────────────────

function GroupHeader({ label, colors }: { label: string; colors: any }) {
	return (
		<Text style={[styles.groupHeader, { color: colors.muted }]}>{label}</Text>
	);
}

function Row({
	icon, label, colors, right, onPress, labelColor,
}: {
	icon: IconName; label: string; colors: any;
	right?: React.ReactNode; onPress?: () => void;
	labelColor?: string;
}) {
	return (
		<Pressable
			style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
			onPress={onPress}
			disabled={!onPress}
		>
			<Icon name={icon} size={18} color={labelColor ?? colors.ink} strokeWidth={1.8} />
			<Text style={[styles.rowLabel, { color: labelColor ?? colors.ink, flex: 1 }]}>
				{label}
			</Text>
			{right}
			{onPress && !right && (
				<Icon name="right" size={16} color={colors.muted} />
			)}
		</Pressable>
	);
}

function SegmentedControl<T extends string>({
	options, selected, onSelect, colors,
}: {
	options: { key: T; label: string }[];
	selected: T;
	onSelect: (key: T) => void;
	colors: any;
}) {
	return (
		<View style={[styles.segmented, { borderColor: colors.line }]}>
			{options.map((opt) => {
				const on = opt.key === selected;
				return (
					<Pressable
						key={opt.key}
						style={[
							styles.segmentedItem,
							on && { backgroundColor: colors.ink },
						]}
						onPress={() => onSelect(opt.key)}
					>
						<Text style={{
							fontFamily: FONTS.display.regular,
							fontSize: 13,
							color: on ? colors.paper : colors.muted,
						}}>
							{opt.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: 16, paddingTop: 8 },
	groupHeader: {
		fontFamily: FONTS.body.medium,
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginTop: 24,
		marginBottom: 8,
		marginLeft: 4,
	},
	group: {
		borderRadius: RADII.default,
		borderWidth: 1,
		overflow: 'hidden',
	},
	subGroupLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		paddingHorizontal: 14,
		paddingTop: 12,
		paddingBottom: 6,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 13,
		paddingHorizontal: 14,
	},
	rowLabel: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
	rowValue: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
	},
	rowDivider: {
		height: 1,
		marginLeft: 44,
	},
	separator: {
		height: 1,
		marginHorizontal: 14,
		marginVertical: 4,
	},
	aboutRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 13,
		paddingHorizontal: 14,
	},
	segmented: {
		flexDirection: 'row',
		marginHorizontal: 14,
		marginBottom: 12,
		borderRadius: RADII.default,
		borderWidth: 1,
		overflow: 'hidden',
	},
	segmentedItem: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 8,
	},

	// Modal styles
	modalRoot: { flex: 1 },
	modalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 14,
		borderBottomWidth: 1,
	},
	modalTitle: {
		fontFamily: FONTS.display.semibold,
		fontSize: 20,
		letterSpacing: -0.3,
	},
	modalScroll: { flex: 1 },
	modalContent: { paddingBottom: 40 },
	manageRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		paddingHorizontal: 20,
		gap: 14,
		borderBottomWidth: 1,
	},
	manageLabel: { flex: 1 },
	editInput: {
		flex: 1,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: RADII.default,
		borderWidth: 1,
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	tapHint: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginTop: 2,
	},
	emptyHint: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		paddingHorizontal: 20,
		paddingTop: 24,
		textAlign: 'center',
	},
	detailCenter: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	reorderControls: {
		gap: 6,
		alignItems: 'center',
		marginRight: 4,
	},
	addHabitBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		marginHorizontal: 20,
		marginTop: 12,
		borderWidth: 1,
		borderStyle: 'dashed',
		borderRadius: RADII.default,
	},
	searchRow: {
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderBottomWidth: 1,
	},
	searchInput: {
		height: 36,
		paddingHorizontal: 12,
		borderRadius: RADII.default,
		borderWidth: 1,
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 4,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	timerOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	timerCard: {
		width: '100%',
		borderRadius: 14,
		padding: 24,
		gap: 16,
	},
	timerTitle: {
		fontFamily: FONTS.display.semibold,
		fontSize: 17,
		textAlign: 'center',
	},
	timerInputRow: {
		flexDirection: 'row',
		gap: 16,
		justifyContent: 'center',
	},
	timerField: {
		alignItems: 'center',
		gap: 4,
	},
	timerInput: {
		width: 70,
		height: 44,
		textAlign: 'center',
		fontFamily: FONTS.body.medium,
		fontSize: 20,
		borderWidth: 1,
		borderRadius: RADII.default,
	},
	timerUnit: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},
	timerTypeRow: {
		flexDirection: 'row',
		gap: 10,
	},
	timerTypeBtn: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 10,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	timerHint: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		textAlign: 'center',
	},
	timerActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 16,
	},
	timerActionBtn: {
		paddingVertical: 6,
		paddingHorizontal: 4,
	},
	changePwContent: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 32,
		gap: 14,
	},
	changePwInput: {
		height: 44,
		paddingHorizontal: 14,
		borderRadius: RADII.default,
		borderWidth: 1,
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	changePwError: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
	},
	changePwBtn: {
		alignItems: 'center',
		justifyContent: 'center',
		height: 44,
		borderRadius: RADII.default,
		marginTop: 4,
	},
	changePwBtnLabel: {
		fontFamily: FONTS.display.semibold,
		fontSize: 15,
	},
	changePwSuccess: {
		alignItems: 'center',
		gap: 16,
		paddingTop: 40,
	},
	changePwSuccessText: {
		fontFamily: FONTS.display.semibold,
		fontSize: 18,
	},
});
