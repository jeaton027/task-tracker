import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS, RADII, useTheme } from '../../theme';

export type TodayView = 'Today' | 'Week' | 'Month' | 'Year';
const VIEWS: TodayView[] = ['Today', 'Week', 'Month', 'Year'];

interface ViewToggleProps {
	view: TodayView;
	onChange: (v: TodayView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
	const { colors } = useTheme();
	return (
		<View style={styles.row}>
			{VIEWS.map((v) => {
				const on = v === view;
				return (
					<Pressable
						key={v}
						onPress={() => onChange(v)}
						style={[
							styles.tab,
							{
								borderColor:     on ? colors.ink : colors.line,
								backgroundColor: on ? colors.ink : colors.card,
							},
						]}
					>
						<Text
							style={{
								fontFamily: FONTS.body.regular,
								fontSize:   13,
								color:      on ? colors.paper : colors.ink,
							}}
						>
							{v}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection:    'row',
		gap:              4,
		paddingHorizontal: 16,
		paddingTop:       2,
		paddingBottom:    12,
	},
	tab: {
		flex:           1,
		paddingVertical: 9,
		alignItems:     'center',
		borderWidth:    1,
		borderRadius:   RADII.default,
	},
});
