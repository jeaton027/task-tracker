import { useRef, useState } from 'react';
import {
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';

import type { CategoryResponse } from '../../api/types';
import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

interface CategoryPickerProps {
	categories:  CategoryResponse[];
	selectedId:  string | null;
	onSelect:    (id: string | null) => void;
	onCreate:    (name: string) => Promise<string>;
}

export function CategoryPicker({
	categories, selectedId, onSelect, onCreate,
}: CategoryPickerProps) {
	const { colors } = useTheme();
	const [creating, setCreating] = useState(false);
	const [newName, setNewName]   = useState('');
	const [busy, setBusy]         = useState(false);
	const [error, setError]       = useState<string | null>(null);
	const submitting = useRef(false);

	const submitNew = async () => {
		if (submitting.current) return;
		const name = newName.trim();
		if (!name) {
			setCreating(false);
			setNewName('');
			return;
		}
		submitting.current = true;
		setBusy(true);
		setError(null);
		try {
			const newId = await onCreate(name);
			onSelect(newId);
			setNewName('');
			setCreating(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Could not create.');
		} finally {
			submitting.current = false;
			setBusy(false);
		}
	};

	return (
		<View style={[styles.frame, { borderBottomColor: colors.line }]}>
			<Text style={[styles.label, { color: colors.ink }]}>Category</Text>
			<Text style={[styles.sub, { color: colors.muted }]}>
				Group related habits together
			</Text>

			<View style={styles.chipRow}>
				{/* "None" chip */}
				<Pressable
					onPress={() => onSelect(null)}
					style={[
						styles.chip,
						{
							backgroundColor: selectedId === null ? colors.ink : colors.card,
							borderColor:     selectedId === null ? colors.ink : colors.line,
						},
					]}
				>
					<Text style={{
						fontFamily: FONTS.display.regular,
						fontSize: 13,
						color: selectedId === null ? colors.paper : colors.muted,
					}}>
						None
					</Text>
				</Pressable>

				{categories.map((c) => {
					const on = selectedId === c.id;
					return (
						<Pressable
							key={c.id}
							onPress={() => onSelect(c.id)}
							style={[
								styles.chip,
								{
									backgroundColor: on ? colors.ink : colors.card,
									borderColor:     on ? colors.ink : colors.line,
								},
							]}
						>
							<Text style={{
								fontFamily: FONTS.display.regular,
								fontSize: 13,
								color: on ? colors.paper : colors.muted,
							}} numberOfLines={1}>
								{c.name}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{creating ? (
				<View style={styles.createWrap}>
					<TextInput
						autoFocus
						value={newName}
						onChangeText={setNewName}
						onSubmitEditing={submitNew}
						onBlur={submitNew}
						placeholder="New category name"
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
					{error && (
						<Text style={[styles.error, { color: colors.accent }]}>{error}</Text>
					)}
				</View>
			) : (
				<Pressable
					onPress={() => { setError(null); setCreating(true); }}
					style={styles.newBtn}
				>
					<Icon name="plus" size={15} color={colors.accent} strokeWidth={2.2} />
					<Text style={[styles.newLabel, { color: colors.accent }]}>New category</Text>
				</Pressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	frame: {
		paddingHorizontal: 18,
		paddingTop:        12,
		paddingBottom:     14,
		borderBottomWidth: 1,
	},
	label: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
		letterSpacing: -0.2,
	},
	sub: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginTop: 2,
		marginBottom: 10,
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
	},
	chip: {
		paddingVertical: 9,
		paddingHorizontal: 14,
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
	},
	newBtn: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           7,
		marginTop:     12,
		alignSelf:     'flex-start',
	},
	newLabel: {
		fontFamily: FONTS.display.regular,
		fontSize: 13.5,
	},
	createWrap: { marginTop: 12 },
	newInput: {
		height:            38,
		paddingHorizontal: 11,
		borderRadius:      RADII.default,
		borderWidth:       1,
		fontFamily:        FONTS.body.regular,
		fontSize:          15,
	},
	error: {
		marginTop:  6,
		fontFamily: FONTS.body.regular,
		fontSize:   12,
	},
});
