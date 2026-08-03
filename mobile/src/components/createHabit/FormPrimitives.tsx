import { useState } from 'react';
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../ui/Icon';
import { FONTS, PALETTES, RADII, useTheme } from '../../theme';

// ── Row ────────────────────────────────────────────────────────────────

export function Row({
	label, sub, children, onPress,
}: {
	label: string; sub?: string; children: React.ReactNode; onPress?: () => void;
}) {
	const { colors } = useTheme();
	const Wrap = onPress ? Pressable : View;
	return (
		<Wrap onPress={onPress} style={[styles.row, { borderBottomColor: colors.line }]}>
			<View style={styles.rowLabelCol}>
				<Text style={[styles.rowLabel, { color: colors.ink }]}>{label}</Text>
				{sub && <Text style={[styles.rowSub, { color: colors.muted }]}>{sub}</Text>}
			</View>
			{children}
		</Wrap>
	);
}

// ── Caption ────────────────────────────────────────────────────────────

export function Caption({ children }: { children: React.ReactNode }) {
	const { colors } = useTheme();
	return <Text style={[styles.caption, { color: colors.muted }]}>{children}</Text>;
}

// ── TextField ──────────────────────────────────────────────────────────

export function TextField({
	value, onChangeText, placeholder,
}: { value: string; onChangeText: (t: string) => void; placeholder?: string }) {
	const { colors } = useTheme();
	return (
		<TextInput
			value={value}
			onChangeText={onChangeText}
			placeholder={placeholder}
			placeholderTextColor={colors.muted}
			style={[
				styles.input,
				{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
			]}
		/>
	);
}

// ── SelectStyle ────────────────────────────────────────────────────────

export function SelectStyle({
	value, open, onPress, width, disabled,
}: { value: string; open: boolean; onPress: () => void; width: number | string; disabled?: boolean }) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={disabled ? undefined : onPress}
			style={[
				styles.select,
				{
					width: width as any,
					backgroundColor: colors.card,
					borderColor: open ? colors.accent : colors.line,
					opacity: disabled ? 0.5 : 1,
				},
			]}
		>
			<Text style={[styles.selectValue, { color: colors.ink }]} numberOfLines={1}>{value}</Text>
			{!disabled && (
				<View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
					<Icon name="chevron" size={16} color={colors.muted} strokeWidth={2.2} />
				</View>
			)}
		</Pressable>
	);
}

// ── ColorPreview ───────────────────────────────────────────────────────

export function ColorPreview({ colorKey }: { colorKey: string | null }) {
	const { colors, paletteMap } = useTheme();
	const hex = colorKey ? paletteMap[colorKey] : null;
	if (!hex) {
		return (
			<View
				style={[
					styles.colorDot,
					{
						backgroundColor: 'transparent',
						borderWidth: 1.5,
						borderColor: colors.line,
					},
				]}
			/>
		);
	}
	return (
		<View
			style={[
				styles.colorDot,
				{
					backgroundColor: hex,
					borderWidth: 2,
					borderColor: colors.paper,
					shadowColor: hex,
					shadowOpacity: 1,
					shadowRadius: 0,
					shadowOffset: { width: 0, height: 0 },
					elevation: 4,
				},
			]}
		/>
	);
}

// ── ColorSheet ─────────────────────────────────────────────────────────

export function ColorSheet({
	visible, selectedKey, onPick, onClose,
}: {
	visible: boolean;
	selectedKey: string | null;
	onPick: (key: string) => void;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<Pressable style={styles.sheetBackdrop} onPress={onClose}>
				<Pressable
					style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: Math.max(28, insets.bottom + 12) }]}
					onPress={(e) => e.stopPropagation()}
				>
					<View style={[styles.sheetGrip, { backgroundColor: colors.line }]} />
					<Text style={[styles.sheetTitle, { color: colors.ink }]}>Color</Text>
					<View style={styles.swatchGrid}>
						{PALETTES.earthy.map((c) => {
							const on = c.key === selectedKey;
							return (
								<Pressable key={c.key} onPress={() => onPick(c.key)} style={styles.swatchCell}>
									<View
										style={[
											styles.swatch,
											{
												backgroundColor: c.hex,
												borderWidth: on ? 2 : 0,
												borderColor: colors.paper,
											},
											on ? {
												shadowColor: c.hex,
												shadowOpacity: 1,
												shadowOffset: { width: 0, height: 0 },
												shadowRadius: 0,
												elevation: 5,
											} : null,
										]}
									/>
								</Pressable>
							);
						})}
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── UnitSheet ──────────────────────────────────────────────────────────

const UNIT_PRESETS = ['times', 'minutes', 'hours'] as const;

export function UnitSheet({
	visible, selected, onPick, onClose,
}: {
	visible: boolean;
	selected: string | null;
	onPick: (unit: string) => void;
	onClose: () => void;
}) {
	const { colors } = useTheme();
	const [customMode, setCustomMode] = useState(false);
	const [customValue, setCustomValue] = useState('');

	const enterCustom = () => {
		setCustomMode(true);
		setCustomValue('');
	};

	const submitCustom = () => {
		const v = customValue.trim();
		if (v) {
			onPick(v);
			setCustomMode(false);
		}
	};

	const insets = useSafeAreaInsets();
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<Pressable style={styles.sheetBackdrop} onPress={onClose}>
					<Pressable
						style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: Math.max(28, insets.bottom + 12) }]}
						onPress={(e) => e.stopPropagation()}
					>
						<View style={[styles.sheetGrip, { backgroundColor: colors.line }]} />
						<Text style={[styles.sheetTitle, { color: colors.ink }]}>Unit</Text>
						{UNIT_PRESETS.map((u) => (
							<Pressable
								key={u}
								onPress={() => onPick(u)}
								style={[styles.unitRow, { borderBottomColor: colors.line }]}
							>
								<Text style={[styles.unitLabel, { color: colors.ink }]}>{u}</Text>
								{selected === u && <Icon name="check" size={18} color={colors.accent} strokeWidth={2.6} />}
							</Pressable>
						))}
						{!customMode ? (
							<Pressable onPress={enterCustom} style={styles.unitRow}>
								<Text style={[styles.unitLabel, { color: colors.ink }]}>Custom unit…</Text>
								<Icon name="right" size={16} color={colors.muted} />
							</Pressable>
						) : (
							<View style={styles.customRow}>
								<TextInput
									autoFocus
									value={customValue}
									onChangeText={setCustomValue}
									placeholder="e.g. glasses"
									placeholderTextColor={colors.muted}
									onSubmitEditing={submitCustom}
									returnKeyType="done"
									style={[
										styles.customInput,
										{ backgroundColor: colors.card, borderColor: colors.accent, color: colors.ink },
									]}
								/>
							</View>
						)}
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ── Helpers ────────────────────────────────────────────────────────────

export function hexWithAlpha(hex: string, alpha: number): string {
	const h = hex.replace('#', '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

export function todayISO(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

// ── Styles ─────────────────────────────────────────────────────────────

export const formStyles = StyleSheet.create({
	root: { flex: 1 },
	flex: { flex: 1 },
	scrollContent: { paddingBottom: 80 },

	row: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              12,
		paddingHorizontal: 18,
		paddingVertical:  11,
		borderBottomWidth: 1,
	},

	header: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              10,
		paddingHorizontal: 14,
		paddingVertical:  10,
		borderBottomWidth: 1,
	},
	iconBtn: {
		width: 38, height: 38, borderRadius: RADII.default, borderWidth: 1,
		alignItems: 'center', justifyContent: 'center',
	},
	title: {
		flex: 1, textAlign: 'center',
		fontFamily: FONTS.display.regular, fontSize: 20, letterSpacing: -0.4,
	},

	colTarget: { flex: 0 },
	colUnit:   { flex: 1 },

	error: {
		marginTop: 18, marginHorizontal: 18,
		fontFamily: FONTS.body.regular, fontSize: 13,
	},
});

const styles = StyleSheet.create({
	row: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              12,
		paddingHorizontal: 18,
		paddingVertical:  11,
		borderBottomWidth: 1,
	},
	rowLabelCol: { flex: 1, minWidth: 0 },
	rowLabel:    { fontFamily: FONTS.display.regular, fontSize: 15, letterSpacing: -0.2 },
	rowSub:      { fontFamily: FONTS.body.regular, fontSize: 12, marginTop: 2 },

	caption: { fontFamily: FONTS.body.regular, fontSize: 12, marginBottom: 7 },

	input: {
		height: 38, width: 160,
		borderRadius: RADII.default,
		borderWidth: 1, paddingHorizontal: 11,
		fontFamily: FONTS.body.regular, fontSize: 15,
	},
	select: {
		height: 38, borderRadius: RADII.default, borderWidth: 1,
		paddingLeft: 11, paddingRight: 8,
		flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
	},
	selectValue: {
		flex: 1, fontFamily: FONTS.body.regular, fontSize: 15,
	},
	colorDot: { width: 24, height: 24, borderRadius: 6 },

	sheetBackdrop: {
		flex: 1, justifyContent: 'flex-end',
		backgroundColor: 'rgba(28,22,16,0.34)',
	},
	sheet: {
		paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28,
		borderTopLeftRadius: 20, borderTopRightRadius: 20,
	},
	sheetGrip: { width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 12 },
	sheetTitle: { fontFamily: FONTS.display.regular, fontSize: 16, marginBottom: 12, letterSpacing: -0.2 },

	swatchGrid: { flexDirection: 'row', flexWrap: 'wrap' },
	swatchCell: { width: '16.66%', alignItems: 'center', paddingVertical: 8 },
	swatch:     { width: 34, height: 34, borderRadius: 6 },

	unitRow: {
		flexDirection: 'row', alignItems: 'center',
		paddingVertical: 12, paddingHorizontal: 2,
		borderBottomWidth: 1,
	},
	unitLabel: { flex: 1, fontFamily: FONTS.body.regular, fontSize: 15 },
	customRow: { paddingTop: 8 },
	customInput: {
		height: 38, paddingHorizontal: 11,
		borderRadius: RADII.default, borderWidth: 1,
		fontFamily: FONTS.body.regular, fontSize: 15,
	},
});
