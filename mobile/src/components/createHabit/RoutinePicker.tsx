/**
 * Routine multi-select row + bottom sheet.
 *
 * The row shows a Select-style trigger ("None" / "2 selected" / single name)
 * that opens a sheet listing the user's routines with checkboxes. The new
 * habit is appended (no timer, next-position) to each checked routine via
 * the HabitCreate `routine_ids` array — that logic lives on the backend.
 *
 * Inline "+ New routine" creates a DAILY routine with no habits attached
 * yet (the form's habit will be added to it once submit fires). Per-routine
 * frequency / scheduling editing happens later — this is a creation
 * convenience, not a full routine editor.
 */
import { useState } from 'react';
import {
	Dimensions,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';

import type { RoutineResponse } from '../../api/types';
import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';
import { Checkbox } from './Checkbox';

interface RoutinePickerProps {
	routines:   RoutineResponse[];
	selectedIds: string[];
	onChange:   (next: string[]) => void;
	/** Create a new routine and return its id (so we can auto-check it). */
	onCreate:   (name: string) => Promise<string>;
}

export function RoutinePicker({
	routines, selectedIds, onChange, onCreate,
}: RoutinePickerProps) {
	const { colors } = useTheme();
	const [sheetOpen, setSheet] = useState(false);

	const displayLabel = (() => {
		if (selectedIds.length === 0) return 'None';
		if (selectedIds.length === 1) {
			const r = routines.find((r) => r.id === selectedIds[0]);
			return r?.name ?? '1 selected';
		}
		return `${selectedIds.length} selected`;
	})();

	return (
		<View style={[styles.frame, { borderBottomColor: colors.line }]}>
			<Pressable style={styles.row} onPress={() => setSheet(true)}>
				<View style={{ flex: 1 }}>
					<Text style={[styles.label, { color: colors.ink }]}>Routine</Text>
					<Text style={[styles.sub, { color: colors.muted }]}>Optional</Text>
				</View>
				<View
					style={[
						styles.select,
						{
							backgroundColor: colors.card,
							borderColor: colors.line,
						},
					]}
				>
					<Text
						style={[
							styles.selectValue,
							{ color: selectedIds.length === 0 ? colors.muted : colors.ink },
						]}
						numberOfLines={1}
					>
						{displayLabel}
					</Text>
					<Icon name="chevron" size={16} color={colors.muted} strokeWidth={2.2} />
				</View>
			</Pressable>

			<RoutineSheet
				visible={sheetOpen}
				routines={routines}
				selectedIds={selectedIds}
				onChange={onChange}
				onCreate={onCreate}
				onClose={() => setSheet(false)}
			/>
		</View>
	);
}

// ── Sheet ───────────────────────────────────────────────────────────────

function RoutineSheet({
	visible, routines, selectedIds, onChange, onCreate, onClose,
}: {
	visible:     boolean;
	routines:    RoutineResponse[];
	selectedIds: string[];
	onChange:    (next: string[]) => void;
	onCreate:    (name: string) => Promise<string>;
	onClose:     () => void;
}) {
	const { colors } = useTheme();
	const [creating, setCreating] = useState(false);
	const [newName, setNewName]   = useState('');
	const [createErr, setErr]     = useState<string | null>(null);
	const [busy, setBusy]         = useState(false);

	const toggle = (id: string) => {
		const set = new Set(selectedIds);
		if (set.has(id)) set.delete(id); else set.add(id);
		onChange(Array.from(set));
	};

	const submitNew = async () => {
		const name = newName.trim();
		if (!name) {
			setCreating(false);
			setNewName('');
			return;
		}
		setBusy(true);
		setErr(null);
		try {
			const newId = await onCreate(name);
			onChange([...selectedIds, newId]);		// auto-check the new one
			setNewName('');
			setCreating(false);
		} catch (e) {
			setErr(e instanceof Error ? e.message : 'Could not create.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable
					style={[styles.sheet, { backgroundColor: colors.paper, maxHeight: Dimensions.get('window').height * 0.8 }]}
					onPress={(e) => e.stopPropagation()}
				>
					<View style={[styles.grip, { backgroundColor: colors.line }]} />
					<Text style={[styles.sheetTitle, { color: colors.ink }]}>Add to routine</Text>

					<ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
						{routines.length === 0 && !creating && (
							<Text style={[styles.empty, { color: colors.muted }]}>
								You don't have any routines yet. Tap "New routine" to start one.
							</Text>
						)}

						{routines.map((r, i) => {
							const on = selectedIds.includes(r.id);
							const habitCount = r.habits?.length ?? 0;
							return (
								<Pressable
									key={r.id}
									onPress={() => toggle(r.id)}
									style={[
										styles.routineRow,
										{
											borderBottomColor: colors.line,
											borderBottomWidth: i < routines.length - 1 ? 1 : 0,
										},
									]}
								>
									<View style={{ flex: 1 }}>
										<Text style={[styles.routineName, { color: colors.ink }]}>{r.name}</Text>
										<Text style={[styles.routineMeta, { color: colors.muted }]}>
											{habitCount} {habitCount === 1 ? 'habit' : 'habits'}
										</Text>
									</View>
									<Checkbox on={on} />
								</Pressable>
							);
						})}

						{/* + New routine */}
						{creating ? (
							<View style={styles.createWrap}>
								<View style={styles.createRow}>
									<TextInput
										autoFocus
										value={newName}
										onChangeText={setNewName}
										onSubmitEditing={submitNew}
										placeholder="New routine name"
										placeholderTextColor={colors.muted}
										returnKeyType="done"
										editable={!busy}
										style={[
											styles.newInput,
											{
												backgroundColor: colors.card,
												borderColor:     colors.accent,
												color:           colors.ink,
											},
										]}
									/>
									<Pressable
										onPress={submitNew}
										disabled={busy || !newName.trim()}
										style={[
											styles.createConfirm,
											{ backgroundColor: newName.trim() ? colors.accent : colors.line },
										]}
									>
										<Icon name="check" size={16} color={colors.paper} strokeWidth={2.5} />
									</Pressable>
								</View>
								{createErr && (
									<Text style={[styles.errorText, { color: colors.accent }]}>{createErr}</Text>
								)}
							</View>
						) : (
							<Pressable
								onPress={() => { setErr(null); setCreating(true); }}
								style={styles.newBtn}
							>
								<Icon name="plus" size={15} color={colors.accent} strokeWidth={2.2} />
								<Text style={[styles.newLabel, { color: colors.accent }]}>New routine</Text>
							</Pressable>
						)}
					</ScrollView>

					<Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.ink }]}>
						<Text style={[styles.doneLabel, { color: colors.paper }]}>Done</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	frame: {
		paddingHorizontal: 18,
		paddingVertical:   11,
		borderBottomWidth: 1,
	},
	row: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           12,
	},
	label: { fontFamily: FONTS.display.regular, fontSize: 15, letterSpacing: -0.2 },
	sub:   { fontFamily: FONTS.body.regular,    fontSize: 12, marginTop: 2 },

	select: {
		height:        38,
		minWidth:      130,
		paddingLeft:   11,
		paddingRight:  8,
		borderRadius:  RADII.default,
		borderWidth:   1,
		flexDirection: 'row',
		alignItems:    'center',
		justifyContent: 'space-between',
	},
	selectValue: {
		fontFamily: FONTS.body.regular,
		fontSize:   15,
		flex:       1,
	},

	// Sheet
	backdrop: {
		flex:            1,
		justifyContent:  'flex-end',
		backgroundColor: 'rgba(28,22,16,0.34)',
	},
	sheet: {
		borderTopLeftRadius:  20,
		borderTopRightRadius: 20,
		paddingHorizontal:    18,
		paddingTop:           10,
		paddingBottom:        28,
	},
	grip: { width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 12 },
	sheetScroll: { flexShrink: 1 },
	sheetTitle: { fontFamily: FONTS.display.regular, fontSize: 16, marginBottom: 12, letterSpacing: -0.2 },
	empty: {
		fontFamily: FONTS.body.regular,
		fontSize:   13,
		paddingVertical: 16,
		textAlign:  'center',
	},

	routineRow: {
		flexDirection:    'row',
		alignItems:       'center',
		paddingVertical:  13,
		paddingHorizontal: 2,
		gap:              12,
	},
	routineName: { fontFamily: FONTS.display.regular, fontSize: 14.5 },
	routineMeta: { fontFamily: FONTS.body.regular,    fontSize: 12, marginTop: 1 },

	newBtn: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           7,
		marginTop:     14,
	},
	newLabel: { fontFamily: FONTS.display.regular, fontSize: 13.5 },

	createWrap: { marginTop: 14 },
	createRow: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           8,
	},
	createConfirm: {
		width:          36,
		height:         36,
		borderRadius:   RADII.default,
		alignItems:     'center',
		justifyContent: 'center',
	},
	newInput: {
		flex:            1,
		height:          38,
		paddingHorizontal: 11,
		borderRadius:    RADII.default,
		borderWidth:     1,
		fontFamily:      FONTS.body.regular,
		fontSize:        15,
	},
	errorText: {
		marginTop:  6,
		fontFamily: FONTS.body.regular,
		fontSize:   12,
	},
	doneBtn: {
		alignItems:    'center',
		paddingVertical: 11,
		borderRadius:  RADII.default,
		marginTop:     18,
	},
	doneLabel: {
		fontFamily: FONTS.body.medium,
		fontSize:   15,
	},
});
