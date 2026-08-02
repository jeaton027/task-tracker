import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';
import {
	currentWeekStrip,
	formatMonthYear,
	formatTodayHeader,
	formatYear,
} from '../../utils/dates';
import type { TodayView } from './ViewToggle';

interface PeriodNavProps {
	view:        TodayView;
	viewingDate: Date;
	doneCount:   number;
	total:       number;
	onPrev:      () => void;
	onNext:      () => void;
	onToday:     () => void;
}

export function PeriodNav({ view, viewingDate, doneCount, total, onPrev, onNext, onToday }: PeriodNavProps) {
	if (view === 'Week')  return <DateStrip viewingDate={viewingDate} onPrev={onPrev} onNext={onNext} onToday={onToday} />;
	if (view === 'Today') return <TodayHeader doneCount={doneCount} total={total} />;
	return <MonthYearNav view={view} viewingDate={viewingDate} onPrev={onPrev} onNext={onNext} onToday={onToday} />;
}

// ── Today: "Friday, June 5" + "N of N done" ─────────────────────────────
function TodayHeader({ doneCount, total }: { doneCount: number; total: number }) {
	const { colors } = useTheme();
	return (
		<View style={styles.todayRow}>
			<Text style={[styles.todayDate, { color: colors.ink }]}>{formatTodayHeader()}</Text>
			<Text style={[styles.todayProgress, { color: colors.ink }]}>
				{doneCount} of {total} done
			</Text>
		</View>
	);
}

// ── Week: 7-day strip with nav arrows ──────────────────────────────────
function DateStrip({ viewingDate, onPrev, onNext, onToday }: { viewingDate: Date; onPrev: () => void; onNext: () => void; onToday: () => void }) {
	const { colors } = useTheme();
	const cells = currentWeekStrip(viewingDate);
	const today = new Date();
	const isCurrentWeek = cells.some((c) => c.today);
	return (
		<View>
			<View style={styles.monthYearRow}>
				<Pressable onPress={onPrev} style={[styles.navButton, { backgroundColor: colors.chip, borderColor: colors.line }]}>
					<Icon name="left" size={18} color={colors.ink} />
				</Pressable>
				<Text style={[styles.monthYearLabel, { color: colors.ink }]}>
					{formatMonthYear(viewingDate)}
				</Text>
				<Pressable onPress={onNext} style={[styles.navButton, { backgroundColor: colors.chip, borderColor: colors.line }]}>
					<Icon name="right" size={18} color={colors.ink} />
				</Pressable>
				{!isCurrentWeek && (
					<Pressable onPress={onToday} style={[styles.todayChip, { backgroundColor: colors.chip, borderColor: colors.line }]}>
						<Text style={{ fontFamily: FONTS.body.regular, fontSize: 13, color: colors.accent }}>Today</Text>
					</Pressable>
				)}
			</View>
			<View style={styles.stripRow}>
				{cells.map((d) => (
					<View
						key={`${d.d}-${d.n}`}
						style={[
							styles.stripCell,
							{
								backgroundColor: d.today ? colors.card : colors.chip,
								borderColor:     d.today ? colors.ink : 'transparent',
								borderWidth:     d.today ? 1.5 : 1,
							},
						]}
					>
						<Text
							style={{
								fontFamily:    FONTS.body.regular,
								fontSize:      10,
								marginBottom:  3,
								color:         d.weekend ? colors.accent : colors.ink,
							}}
						>
							{d.d}
						</Text>
						<Text style={{ fontFamily: FONTS.display.regular, fontSize: 16, color: colors.ink }}>
							{d.n}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

// ── Month / Year: arrows + label + Today shortcut ───────────────────────
function MonthYearNav({ view, viewingDate, onPrev, onNext, onToday }: { view: 'Month' | 'Year'; viewingDate: Date; onPrev: () => void; onNext: () => void; onToday: () => void }) {
	const { colors } = useTheme();
	const label = view === 'Month' ? formatMonthYear(viewingDate) : formatYear(viewingDate);
	const navButton = {
		backgroundColor: colors.chip,
		borderColor:     colors.line,
	};

	return (
		<View style={styles.monthYearRow}>
			<Pressable onPress={onPrev} style={[styles.navButton, navButton]}>
				<Icon name="left" size={18} color={colors.ink} />
			</Pressable>

			<Text style={[styles.monthYearLabel, { color: colors.ink }]}>{label}</Text>

			<Pressable onPress={onNext} style={[styles.navButton, navButton]}>
				<Icon name="right" size={18} color={colors.ink} />
			</Pressable>

			<Pressable
				onPress={onToday}
				style={[
					styles.todayChip,
					{ backgroundColor: colors.chip, borderColor: colors.line },
				]}
			>
				<Text style={{ fontFamily: FONTS.body.regular, fontSize: 13, color: colors.accent }}>
					Today
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	// Today
	todayRow: {
		flexDirection:    'row',
		alignItems:       'flex-end',
		justifyContent:   'space-between',
		paddingHorizontal: 20,
		paddingBottom:    14,
	},
	todayDate: {
		fontFamily: FONTS.display.regular,
		fontSize:   15,
	},
	todayProgress: {
		fontFamily: FONTS.body.regular,
		fontSize:   13,
	},
	// Week
	stripRow: {
		flexDirection:    'row',
		gap:              7,
		paddingHorizontal: 16,
		paddingBottom:    14,
	},
	stripCell: {
		flex:           1,
		alignItems:     'center',
		paddingVertical: 8,
		borderRadius:   RADII.default,
	},
	// Month / Year
	monthYearRow: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              8,
		paddingHorizontal: 16,
		paddingBottom:    14,
	},
	navButton: {
		width:          36,
		height:         36,
		alignItems:     'center',
		justifyContent: 'center',
		borderWidth:    1,
		borderRadius:   RADII.default,
	},
	monthYearLabel: {
		flex:       1,
		textAlign:  'center',
		fontFamily: FONTS.display.regular,
		fontSize:   16,
	},
	todayChip: {
		paddingHorizontal: 13,
		paddingVertical:   8,
		borderWidth:       1,
		borderRadius:      RADII.default,
	},
});
