import { StyleSheet, Text, View } from 'react-native';

import { FONTS } from '../../theme';

/**
 * Small "backend TBD" badge. Used on form rows whose backend support
 * doesn't exist yet — keeps the design honest without hiding the option.
 */
export function TbdPill() {
	return (
		<View style={styles.pill}>
			<Text style={styles.text}>backend TBD</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	pill: {
		backgroundColor: 'rgba(156,90,60,0.12)',
		borderColor:     'rgba(156,90,60,0.25)',
		borderWidth:     1,
		paddingHorizontal: 6,
		paddingVertical:   3,
		borderRadius:    3,
		alignSelf:       'flex-start',
	},
	text: {
		color:           '#9C5A3C',
		fontFamily:      FONTS.body.regular,
		fontSize:        9.5,
		letterSpacing:   0.6,
		textTransform:   'uppercase',
	},
});
