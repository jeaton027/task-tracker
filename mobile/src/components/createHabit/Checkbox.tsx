import { StyleSheet, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { RADII, useTheme } from '../../theme';

export function Checkbox({ on }: { on: boolean }) {
	const { colors } = useTheme();
	return (
		<View
			style={[
				styles.box,
				{
					borderColor:     on ? colors.accent : 'rgba(0,0,0,0.14)',
					backgroundColor: on ? colors.accent : 'transparent',
				},
			]}
		>
			{on && <Icon name="check" size={14} color={colors.paper} strokeWidth={3} />}
		</View>
	);
}

const styles = StyleSheet.create({
	box: {
		width:        22,
		height:       22,
		borderRadius: RADII.default,
		borderWidth:  2,
		alignItems:     'center',
		justifyContent: 'center',
	},
});
