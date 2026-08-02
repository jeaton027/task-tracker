import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../ui/Icon';
import { FONTS, useTheme } from '../../theme';

export type NavTab = 'Today' | 'Stats' | 'Calendar' | 'Settings';

const TAB_DEFS: { label: NavTab; icon: IconName }[] = [
	{ label: 'Today',    icon: 'home' },
	{ label: 'Stats',    icon: 'stats' },
	{ label: 'Calendar', icon: 'calendar' },
	{ label: 'Settings', icon: 'settings' },
];

interface BottomNavProps {
	active?: NavTab;
	onTabChange?: (tab: NavTab) => void;
}

export function BottomNav({ active = 'Today', onTabChange }: BottomNavProps) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.paper,
					borderTopColor:  colors.line,
					paddingBottom:   Math.max(insets.bottom, 18),
				},
			]}
		>
			{TAB_DEFS.map((t) => {
				const on = t.label === active;
				return (
					<Pressable key={t.label} style={styles.tab} onPress={() => onTabChange?.(t.label)}>
						<Icon
							name={t.icon}
							size={22}
							color={on ? colors.ink : colors.muted}
							strokeWidth={on ? 2.2 : 1.9}
						/>
						<Text
							style={{
								marginTop:  5,
								fontFamily: FONTS.body.regular,
								fontSize:   10,
								color:      on ? colors.ink : colors.muted,
							}}
						>
							{t.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection:   'row',
		justifyContent:  'space-around',
		alignItems:      'flex-start',
		paddingHorizontal: 18,
		paddingTop:        12,
		borderTopWidth:    1,
	},
	tab: {
		alignItems: 'center',
	},
});
