import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';

/**
 * iOS-style pill toggle. Track is accent when on, neutral when off; knob
 * is paper white with a soft shadow.
 */
export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.track,
				{ backgroundColor: on ? colors.accent : 'rgba(0,0,0,0.16)' },
				on ? styles.alignEnd : styles.alignStart,
			]}
		>
			<View style={[styles.knob, { backgroundColor: colors.paper }]} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	track: {
		width:        44,
		height:       26,
		borderRadius: 999,
		padding:      3,
		flexDirection: 'row',
	},
	alignStart: { justifyContent: 'flex-start' },
	alignEnd:   { justifyContent: 'flex-end' },
	knob: {
		width:        20,
		height:       20,
		borderRadius: 10,
		shadowColor:  '#000',
		shadowOpacity: 0.25,
		shadowOffset: { width: 0, height: 1 },
		shadowRadius: 2,
		elevation:    2,
	},
});
