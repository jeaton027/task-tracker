import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

interface AppHeaderProps {
	onMenuPress?: () => void;
}

export function AppHeader({ onMenuPress }: AppHeaderProps) {
	const { colors } = useTheme();

	const iconButton = {
		backgroundColor: colors.chip,
		borderColor:     colors.line,
	};

	return (
		<View style={styles.row}>
			<Pressable style={[styles.iconButton, iconButton]} onPress={onMenuPress}>
				<Icon name="menu" size={20} color={colors.ink} />
			</Pressable>

			<Text style={[styles.title, { color: colors.ink }]}>Habits</Text>

			<Pressable style={[styles.iconButton, iconButton]}>
				<Icon name="timer" size={20} color={colors.ink} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              10,
		paddingHorizontal: 18,
		paddingTop:       6,
		paddingBottom:    12,
	},
	iconButton: {
		width:          40,
		height:         40,
		alignItems:     'center',
		justifyContent: 'center',
		borderWidth:    1,
		borderRadius:   RADII.default,
	},
	title: {
		flex:          1,
		textAlign:     'center',
		fontFamily:    FONTS.display.regular,
		fontSize:      21,
		letterSpacing: -0.4,
	},
});
