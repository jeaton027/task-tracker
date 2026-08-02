import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import type { HabitSection } from '../../api/types';
import { Toggle } from './Toggle';
import { FONTS, RADII, useTheme } from '../../theme';

const SECTIONS: { key: HabitSection; label: string }[] = [
	{ key: 'MORNING',   label: 'Morning' },
	{ key: 'AFTERNOON', label: 'Afternoon' },
	{ key: 'EVENING',   label: 'Evening' },
];

interface SectionPickerProps {
	selected: HabitSection | null;
	onSelect: (section: HabitSection | null) => void;
}

export function SectionPicker({ selected, onSelect }: SectionPickerProps) {
	const { colors } = useTheme();
	const enabled = selected !== null;

	return (
		<View style={[styles.frame, { borderBottomColor: colors.line }]}>
			<View style={styles.headerRow}>
				<View style={{ flex: 1 }}>
					<Text style={[styles.label, { color: colors.ink }]}>Time of Day</Text>
					<Text style={[styles.sub, { color: colors.muted }]}>
						When this habit appears on Today
					</Text>
				</View>
				<Toggle
					on={enabled}
					onPress={() => onSelect(enabled ? null : 'MORNING')}
				/>
			</View>

			{enabled && (
				<>
					<View style={styles.chipRow}>
						{SECTIONS.map((s) => {
							const on = selected === s.key;
							return (
								<Pressable
									key={s.key}
									onPress={() => onSelect(s.key)}
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
									}}>
										{s.label}
									</Text>
								</Pressable>
							);
						})}
					</View>

					<Text style={[styles.hint, { color: colors.muted }]}>
						{selected === 'MORNING'   ? 'Shows all day' :
						 selected === 'AFTERNOON' ? 'Shows after 12 pm' :
						                            'Shows after 5 pm'}
					</Text>
				</>
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
	headerRow: {
		flexDirection:  'row',
		alignItems:     'center',
		justifyContent: 'space-between',
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
	},
	chipRow: {
		flexDirection: 'row',
		gap: 6,
		marginTop: 10,
	},
	chip: {
		flex: 1,
		paddingVertical: 9,
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
	},
	hint: {
		fontFamily: FONTS.body.regular,
		fontSize: 11,
		marginTop: 8,
	},
});
