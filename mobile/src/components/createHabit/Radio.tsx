import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';

export function Radio({ on }: { on: boolean }) {
	const { colors } = useTheme();
	return (
		<View
			style={[
				styles.outer,
				{ borderColor: on ? colors.accent : 'rgba(0,0,0,0.14)' },
			]}
		>
			{on && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
		</View>
	);
}

const styles = StyleSheet.create({
	outer: {
		width:        20,
		height:       20,
		borderRadius: 10,
		borderWidth:  2,
		alignItems:     'center',
		justifyContent: 'center',
	},
	dot: { width: 10, height: 10, borderRadius: 5 },
});
