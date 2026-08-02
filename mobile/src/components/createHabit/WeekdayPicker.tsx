import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS, RADII, useTheme } from '../../theme';

const DAYS: { label: string; value: number }[] = [
	{ label: 'M',  value: 0 },
	{ label: 'T',  value: 1 },
	{ label: 'W',  value: 2 },
	{ label: 'Th', value: 3 },
	{ label: 'F',  value: 4 },
	{ label: 'S',  value: 5 },
	{ label: 'Su', value: 6 },
];

const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND  = [5, 6];

/**
 * Seven-circle weekday picker (Mon=0 ... Sun=6). Tap a day to toggle.
 * Two quick-action chips below: "Weekdays" sets [0..4], "Weekends" sets [5,6].
 */
export function WeekdayPicker({
	selected, onChange,
}: {
	selected: number[];
	onChange: (next: number[]) => void;
}) {
	const { colors } = useTheme();

	const toggle = (v: number) => {
		const set = new Set(selected);
		if (set.has(v)) set.delete(v); else set.add(v);
		onChange(Array.from(set).sort((a, b) => a - b));
	};

	const setQuick = (vals: number[]) => onChange(vals.slice().sort((a, b) => a - b));

	return (
		<View>
			<View style={styles.daysRow}>
				{DAYS.map(({ label, value }) => {
					const sel = selected.includes(value);
					return (
						<Pressable
							key={value}
							onPress={() => toggle(value)}
							style={[
								styles.circle,
								{
									backgroundColor: sel ? colors.accent : colors.card,
									borderColor:     sel ? colors.accent : 'rgba(0,0,0,0.14)',
								},
							]}
						>
							<Text
								style={{
									fontFamily: FONTS.display.regular,
									fontSize:   12.5,
									color:      sel ? colors.paper : colors.ink,
								}}
							>
								{label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<View style={styles.chipsRow}>
				<QuickChip label="Weekdays" onPress={() => setQuick(WEEKDAYS)} />
				<QuickChip label="Weekends" onPress={() => setQuick(WEEKEND)} />
			</View>
		</View>
	);
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			style={[styles.chip, { backgroundColor: colors.chip, borderColor: colors.line }]}
		>
			<Text style={[styles.chipLabel, { color: colors.muted }]}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	daysRow: {
		flexDirection:  'row',
		gap:            7,
		justifyContent: 'space-between',
	},
	circle: {
		width:          32,
		height:         32,
		borderRadius:   16,
		borderWidth:    1,
		alignItems:     'center',
		justifyContent: 'center',
		flex:           0,
	},
	chipsRow: {
		flexDirection: 'row',
		gap:           8,
		marginTop:     11,
	},
	chip: {
		paddingHorizontal: 11,
		paddingVertical:   5,
		borderRadius:      RADII.pill,
		borderWidth:       1,
	},
	chipLabel: {
		fontFamily: FONTS.body.regular,
		fontSize:   12.5,
	},
});
