import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RoutineResponse } from '../../api/types';
import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

interface RoutineChipsProps {
	routines: RoutineResponse[];
	onSelect: (routineId: string) => void;
}

export function RoutineChips({ routines, onSelect }: RoutineChipsProps) {
	const { colors } = useTheme();

	if (routines.length === 0) return null;

	return (
		<View style={styles.wrapper}>
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.container}
		>
			{routines.map((r) => (
				<Pressable
					key={r.id}
					style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.line }]}
					onPress={() => onSelect(r.id)}
				>
					<Icon name="play" size={12} color={colors.accent} fill={colors.accent} strokeWidth={0} />
					<Text style={[styles.label, { color: colors.ink }]} numberOfLines={1}>
						{r.name}
					</Text>
					<Text style={[styles.count, { color: colors.muted }]}>
						{r.habits?.length ?? 0}
					</Text>
				</Pressable>
			))}
		</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		flexShrink: 0,
		flexGrow: 0,
	},
	container: {
		paddingHorizontal: 16,
		paddingVertical: 4,
		gap: 8,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	label: {
		fontFamily: FONTS.body.medium,
		fontSize: 13.5,
		maxWidth: 120,
	},
	count: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},
});
