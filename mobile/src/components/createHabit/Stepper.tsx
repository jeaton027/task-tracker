import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

interface StepperProps {
	value:    number;
	onChange: (n: number) => void;
	min?:     number;
	max?:     number;
	suffix?:  string;
}

export function Stepper({ value, onChange, min = 0, max, suffix }: StepperProps) {
	const { colors } = useTheme();
	const canDec = value > min;
	const canInc = max == null || value < max;
	const btn = {
		backgroundColor: colors.chip,
		borderColor:     colors.line,
	};
	return (
		<View style={styles.row}>
			<Pressable
				onPress={() => canDec && onChange(value - 1)}
				disabled={!canDec}
				style={[styles.btn, btn]}
			>
				<Icon name="left" size={14} color={canDec ? colors.ink : colors.muted} strokeWidth={2.2} />
			</Pressable>
			<Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
			<Pressable
				onPress={() => canInc && onChange(value + 1)}
				disabled={!canInc}
				style={[styles.btn, btn]}
			>
				<Icon name="plus" size={14} color={canInc ? colors.ink : colors.muted} strokeWidth={2.2} />
			</Pressable>
			{suffix && <Text style={[styles.suffix, { color: colors.muted }]}>{suffix}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	btn: {
		width:           34,
		height:          34,
		borderRadius:    RADII.default,
		borderWidth:     1,
		alignItems:      'center',
		justifyContent:  'center',
	},
	value: {
		minWidth:    22,
		textAlign:   'center',
		fontFamily:  FONTS.display.regular,
		fontSize:    17,
	},
	suffix: {
		fontFamily: FONTS.body.regular,
		fontSize:   13.5,
		marginLeft: 2,
	},
});
