import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS, useTheme } from '../../theme';

/**
 * Grid picker of days 1..31 — used for "Select date(s) in the month" on
 * MONTHLY habits. Multi-select; tap a day to toggle.
 */
export function MonthDatePicker({
	selected, onChange,
}: {
	selected: number[];
	onChange: (next: number[]) => void;
}) {
	const { colors } = useTheme();

	const toggle = (d: number) => {
		const set = new Set(selected);
		if (set.has(d)) set.delete(d); else set.add(d);
		onChange(Array.from(set).sort((a, b) => a - b));
	};

	return (
		<View style={styles.grid}>
			{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
				const sel = selected.includes(d);
				return (
					<Pressable
						key={d}
						onPress={() => toggle(d)}
						style={[
							styles.cell,
							{
								backgroundColor: sel ? colors.accent : colors.card,
								borderColor:     sel ? colors.accent : 'rgba(0,0,0,0.10)',
							},
						]}
					>
						<Text
							style={{
								fontFamily: FONTS.display.regular,
								fontSize:   13,
								color:      sel ? colors.paper : colors.ink,
							}}
						>
							{d}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: 'row',
		flexWrap:      'wrap',
		gap:           6,
	},
	cell: {
		width:          34,
		height:         34,
		borderRadius:   17,
		borderWidth:    1,
		alignItems:     'center',
		justifyContent: 'center',
	},
});
