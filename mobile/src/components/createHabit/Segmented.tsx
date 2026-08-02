import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS, RADII, useTheme } from '../../theme';

/**
 * Pill segmented control — chip-background container with the selected
 * item raised on a card. Matches the New-Habit mockup styling (different
 * from the Today screen's ViewToggle which uses an inverted look).
 */
export function Segmented<T extends string>({
	items, active, onChange,
}: {
	items: readonly T[];
	active: T;
	onChange: (item: T) => void;
}) {
	const { colors } = useTheme();
	return (
		<View style={[styles.container, { backgroundColor: colors.chip }]}>
			{items.map((item) => {
				const on = item === active;
				return (
					<Pressable
						key={item}
						onPress={() => onChange(item)}
						style={[
							styles.item,
							on ? {
								backgroundColor: colors.card,
								shadowColor:     '#000',
								shadowOpacity:   0.10,
								shadowOffset:    { width: 0, height: 1 },
								shadowRadius:    2,
								elevation:       1,
							} : null,
						]}
					>
						<Text
							style={{
								fontFamily:    FONTS.display.regular,
								fontSize:      13.5,
								letterSpacing: -0.2,
								color:         on ? colors.ink : colors.muted,
							}}
						>
							{item}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		padding:       3,
		gap:           3,
		borderRadius:  RADII.default,
	},
	item: {
		flex:           1,
		paddingVertical: 7,
		alignItems:     'center',
		borderRadius:   RADII.default - 1,
	},
});
