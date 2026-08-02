import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../ui/Icon';
import { useTheme } from '../../theme';

/**
 * Floating Action Button — anchored above the bottom nav.
 * Lives outside the scroll list, so position is absolute relative to the screen.
 */
export function Fab({ onPress }: { onPress?: () => void }) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	// Sit above the bottom nav (≈ 18 + nav height 56). Bumped by insets so it
	// clears the home indicator on gesture-nav phones.
	const bottomOffset = 84 + (insets.bottom > 0 ? insets.bottom - 18 : 0);

	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.fab,
				{
					backgroundColor: colors.ink,
					bottom:          bottomOffset,
					shadowColor:     '#000',
				},
			]}
		>
			<Icon name="plus" size={26} color={colors.paper} strokeWidth={2.4} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	fab: {
		position:       'absolute',
		right:          18,
		width:          56,
		height:         56,
		borderRadius:   28,
		alignItems:     'center',
		justifyContent: 'center',
		// Android elevation
		elevation:      8,
		// iOS shadow
		shadowOffset:   { width: 0, height: 8 },
		shadowOpacity:  0.22,
		shadowRadius:   12,
	},
});
