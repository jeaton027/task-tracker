import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, useTheme } from '../../theme';

interface SectionBarProps {
	label:     string;
	count:     number;
	collapsed?: boolean;
	onToggle?: () => void;
}

/**
 * Section header. When `onToggle` is provided, the entire row is tappable
 * and the chevron rotates to indicate state (down = expanded, right = collapsed).
 */
export function SectionBar({ label, count, collapsed, onToggle }: SectionBarProps) {
	const { colors } = useTheme();

	const content = (
		<View style={styles.row}>
			<Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
			<Text style={[styles.count, { color: colors.ink }]}>{count}</Text>
			<View style={[styles.chevronCircle, { borderColor: colors.line }]}>
				<View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
					<Icon name="chevron" size={13} color={colors.ink} />
				</View>
			</View>
		</View>
	);

	if (onToggle) {
		return (
			<Pressable onPress={onToggle} hitSlop={6}>
				{content}
			</Pressable>
		);
	}
	return content;
}

const styles = StyleSheet.create({
	row: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              10,
		paddingHorizontal: 20,
		paddingTop:       6,
		paddingBottom:    10,
	},
	label: {
		flex:          1,
		fontFamily:    FONTS.display.regular,
		fontSize:      15,
		letterSpacing: -0.2,
	},
	count: {
		fontFamily: FONTS.body.regular,
		fontSize:   14,
	},
	chevronCircle: {
		width:          22,
		height:         22,
		borderRadius:   11,
		borderWidth:    1.5,
		alignItems:     'center',
		justifyContent: 'center',
	},
});
