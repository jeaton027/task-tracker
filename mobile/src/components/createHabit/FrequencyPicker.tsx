/**
 * Frequency row + per-tab sub-options + Customize sheet trigger.
 *
 * State model:
 *   - `perTab` controls the segmented control (Day / Week / Month / Year)
 *   - One sub-option per tab is the "active" choice for that tab
 *   - A `customCadence` value (set via the Customize sheet) overrides the
 *     inline sub-options entirely — the user sees a summary card instead.
 *
 * The form's submit handler translates this UI state into backend fields
 * (frequency + scheduled_* + interval_days + optional target_per_period
 * override) — see `buildScheduleFields` exported below.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';
import { MonthDatePicker } from './MonthDatePicker';
import { Radio } from './Radio';
import { Segmented } from './Segmented';
import { Stepper } from './Stepper';
import { TbdPill } from './TbdPill';
import { WeekdayPicker } from './WeekdayPicker';
import type { CustomCadence } from './CustomizeSheet';
import type { HabitFrequency } from '../../api/types';

// ── Types ───────────────────────────────────────────────────────────────

export type PerTab = 'Day' | 'Week' | 'Month' | 'Year';
const PER_TABS: readonly PerTab[] = ['Day', 'Week', 'Month', 'Year'];

export type DaySub   = 'everyday' | 'selectDays' | 'countPerWeek';
export type WeekSub  = 'anytime' | 'selectWeekday';
export type MonthSub = 'anytime' | 'selectDate' | 'selectWeek';   // selectWeek = TBD
export type YearSub  = 'anytime' | 'selectMonth';                 // selectMonth = TBD

export interface ScheduleState {
	perTab:    PerTab;
	day:       DaySub;
	week:      WeekSub;
	month:     MonthSub;
	year:      YearSub;
	weekdays:  number[];       // Mon=0..Sun=6
	daysOfMonth: number[];     // 1..31
	daysPerWeek: number;       // Day:countPerWeek
	custom:    CustomCadence | null;
}

export const initialScheduleState: ScheduleState = {
	perTab:      'Day',
	day:         'everyday',
	week:        'anytime',
	month:       'anytime',
	year:        'anytime',
	weekdays:    [],
	daysOfMonth: [],
	daysPerWeek: 3,
	custom:      null,
};

// Default sub-option per tab — used when switching tabs to reset (per spec).
const TAB_DEFAULTS: Record<PerTab, keyof ScheduleState> = {
	Day:   'day',
	Week:  'week',
	Month: 'month',
	Year:  'year',
};
const TAB_DEFAULT_VALUE: Record<PerTab, DaySub | WeekSub | MonthSub | YearSub> = {
	Day:   'everyday',
	Week:  'anytime',
	Month: 'anytime',
	Year:  'anytime',
};

// ── Schedule -> backend fields ──────────────────────────────────────────

export interface ScheduleFields {
	frequency:              HabitFrequency;
	scheduled_weekdays:     number[];
	scheduled_days_of_month: number[];
	scheduled_dates:        string[];
	interval_days:          number | null;
	days_per_week:          number | null;
}

export function buildScheduleFields(s: ScheduleState): ScheduleFields {
	const empty: ScheduleFields = {
		frequency:              'DAILY',
		scheduled_weekdays:     [],
		scheduled_days_of_month: [],
		scheduled_dates:        [],
		interval_days:          null,
		days_per_week:          null,
	};

	if (s.custom?.type === 'INTERVAL') {
		return { ...empty, frequency: 'INTERVAL', interval_days: s.custom.interval_days };
	}

	switch (s.perTab) {
		case 'Day':
			if (s.day === 'everyday')     return empty;
			if (s.day === 'selectDays')   return { ...empty, frequency: 'WEEKLY', scheduled_weekdays: s.weekdays };
			if (s.day === 'countPerWeek') return { ...empty, frequency: 'WEEKLY', days_per_week: s.daysPerWeek };
			break;
		case 'Week':
			if (s.week === 'anytime') return { ...empty, frequency: 'WEEKLY' };
			break;
		case 'Month':
			if (s.month === 'anytime')    return { ...empty, frequency: 'MONTHLY' };
			if (s.month === 'selectDate') return { ...empty, frequency: 'MONTHLY', scheduled_days_of_month: s.daysOfMonth };
			break;
		case 'Year':
			if (s.year === 'anytime') return { ...empty, frequency: 'YEARLY' };
			break;
	}
	return empty;
}

// ── Component ───────────────────────────────────────────────────────────

interface FrequencyPickerProps {
	state:           ScheduleState;
	onChange:        (next: ScheduleState) => void;
	onOpenCustomize: () => void;
}

export function FrequencyPicker({
	state, onChange, onOpenCustomize,
}: FrequencyPickerProps) {
	const { colors } = useTheme();

	const setPerTab = (tab: PerTab) => {
		// Spec: every tab switch resets to that tab's default sub-option and
		// clears any custom cadence.
		onChange({
			...state,
			perTab:     tab,
			[TAB_DEFAULTS[tab]]: TAB_DEFAULT_VALUE[tab] as any,
			custom:     null,
		});
	};

	return (
		<View style={[styles.frame, { borderBottomColor: colors.line }]}>
			{/* Header row: label + Customize button */}
			<View style={styles.headerRow}>
				<View style={{ flex: 1 }}>
					<Text style={[styles.label, { color: colors.ink }]}>Frequency</Text>
					<Text style={[styles.sub,   { color: colors.muted }]}>Per</Text>
				</View>
				<Pressable
					onPress={onOpenCustomize}
					style={[styles.iconBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}
				>
					<Icon name="calendar" size={18} color={colors.ink} />
				</Pressable>
			</View>

			{/* Per-tab segmented control */}
			<Segmented items={PER_TABS} active={state.perTab} onChange={setPerTab} />

			{/* Sub-options panel — or a "custom" summary if Customize was used */}
			<View style={styles.subPanel}>
				{state.custom ? (
					<CustomSummary cadence={state.custom} onEdit={onOpenCustomize} />
				) : (
					<SubOptions state={state} onChange={onChange} />
				)}
			</View>
		</View>
	);
}

// ── Sub-option panels ───────────────────────────────────────────────────

function SubOptions({
	state, onChange,
}: {
	state:    ScheduleState;
	onChange: (next: ScheduleState) => void;
}) {
	switch (state.perTab) {
		case 'Day':   return <DayPanel   state={state} onChange={onChange} />;
		case 'Week':  return <WeekPanel  state={state} onChange={onChange} />;
		case 'Month': return <MonthPanel state={state} onChange={onChange} />;
		case 'Year':  return <YearPanel  state={state} onChange={onChange} />;
	}
}

function DayPanel({
	state, onChange,
}: {
	state:    ScheduleState;
	onChange: (next: ScheduleState) => void;
}) {
	const setDay = (day: DaySub) => onChange({ ...state, day });
	return (
		<View>
			<OptRow
				active={state.day === 'everyday'}
				onPress={() => setDay('everyday')}
				label="Everyday"
			/>
			<OptRow
				active={state.day === 'selectDays'}
				onPress={() => setDay('selectDays')}
				label="Select days of the week"
				expanded={
					<WeekdayPicker
						selected={state.weekdays}
						onChange={(weekdays) => onChange({ ...state, weekdays })}
					/>
				}
			/>
			<OptRow
				active={state.day === 'countPerWeek'}
				onPress={() => setDay('countPerWeek')}
				label="Number of days per week"
				expanded={
					<View style={{ paddingLeft: 32 }}>
						<Stepper
							value={state.daysPerWeek}
							onChange={(daysPerWeek) => onChange({ ...state, daysPerWeek })}
							min={1}
							max={7}
							suffix="days per week"
						/>
					</View>
				}
				last
			/>
		</View>
	);
}

function WeekPanel({
	state, onChange,
}: {
	state:    ScheduleState;
	onChange: (next: ScheduleState) => void;
}) {
	const setWeek = (week: WeekSub) => onChange({ ...state, week });
	return (
		<View>
			<OptRow
				active={state.week === 'anytime'}
				onPress={() => setWeek('anytime')}
				label="Anytime"
				last
			/>
		</View>
	);
}

function MonthPanel({
	state, onChange,
}: {
	state:    ScheduleState;
	onChange: (next: ScheduleState) => void;
}) {
	const setMonth = (month: MonthSub) => onChange({ ...state, month });
	return (
		<View>
			<OptRow
				active={state.month === 'anytime'}
				onPress={() => setMonth('anytime')}
				label="Anytime"
			/>
			<OptRow
				active={state.month === 'selectDate'}
				onPress={() => setMonth('selectDate')}
				label="Select date"
				expanded={
					<MonthDatePicker
						selected={state.daysOfMonth}
						onChange={(daysOfMonth) => onChange({ ...state, daysOfMonth })}
					/>
				}
			/>
			<OptRow
				active={false}
				onPress={() => { /* TBD */ }}
				label="Select week (1st / 2nd / 3rd / 4th)"
				tbd
				last
			/>
		</View>
	);
}

function YearPanel({
	state, onChange,
}: {
	state:    ScheduleState;
	onChange: (next: ScheduleState) => void;
}) {
	const setYear = (year: YearSub) => onChange({ ...state, year });
	return (
		<View>
			<OptRow
				active={state.year === 'anytime'}
				onPress={() => setYear('anytime')}
				label="Anytime"
			/>
			<OptRow
				active={false}
				onPress={() => { /* TBD */ }}
				label="Select month"
				tbd
				last
			/>
		</View>
	);
}

// ── Atoms ───────────────────────────────────────────────────────────────

function OptRow({
	active, onPress, label, expanded, tbd, last,
}: {
	active: boolean;
	onPress: () => void;
	label: string;
	expanded?: React.ReactNode;
	tbd?: boolean;
	last?: boolean;
}) {
	const { colors } = useTheme();
	return (
		<View
			style={[
				styles.optBlock,
				{ borderBottomColor: colors.line, borderBottomWidth: last ? 0 : 1 },
				tbd ? { opacity: 0.62 } : null,
			]}
		>
			<Pressable
				onPress={tbd ? undefined : onPress}
				style={styles.optHeader}
			>
				<Radio on={active} />
				<Text style={[styles.optLabel, { color: colors.ink }]}>{label}</Text>
				{tbd && <TbdPill />}
			</Pressable>
			{/* Only show the expanded controls when this option is the active
			    radio — keeps the form vertically compact. */}
			{active && expanded && <View style={styles.optExpanded}>{expanded}</View>}
		</View>
	);
}

function CustomSummary({
	cadence, onEdit,
}: {
	cadence: CustomCadence;
	onEdit: () => void;
}) {
	const { colors } = useTheme();
	const summary = cadence.type === 'INTERVAL'
		? `Every ${cadence.interval_days} days`
		: '';
	return (
		<View
			style={[
				styles.customSummary,
				{ backgroundColor: colors.chip, borderColor: colors.line },
			]}
		>
			<View style={{ flex: 1 }}>
				<Text style={[styles.customCaption, { color: colors.muted }]}>Custom cadence</Text>
				<Text style={[styles.customValue,   { color: colors.ink }]}>{summary}</Text>
			</View>
			<Pressable
				onPress={onEdit}
				style={[styles.editBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
			>
				<Text style={[styles.editLabel, { color: colors.ink }]}>Edit</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	frame: {
		paddingHorizontal: 18,
		paddingTop:        12,
		paddingBottom:     14,
		borderBottomWidth: 1,
	},
	headerRow: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              12,
		marginBottom:     9,
	},
	label: { fontFamily: FONTS.display.regular, fontSize: 15, letterSpacing: -0.2 },
	sub:   { fontFamily: FONTS.body.regular,    fontSize: 12, marginTop: 2 },
	iconBtn: {
		width:        38,
		height:       38,
		borderRadius: RADII.default,
		borderWidth:  1,
		alignItems:     'center',
		justifyContent: 'center',
	},
	subPanel: { paddingTop: 6 },

	optBlock: {
		paddingVertical:   12,
		paddingHorizontal: 2,
	},
	optHeader: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           12,
	},
	optLabel: {
		flex:       1,
		fontFamily: FONTS.body.regular,
		fontSize:   14.5,
	},
	optExpanded: {
		marginTop: 13,
	},

	customSummary: {
		flexDirection:    'row',
		alignItems:       'center',
		gap:              12,
		padding:          12,
		borderWidth:      1,
		borderRadius:     RADII.default,
	},
	customCaption: { fontFamily: FONTS.body.regular, fontSize: 12, marginBottom: 2 },
	customValue:   { fontFamily: FONTS.display.regular, fontSize: 15 },
	editBtn: {
		paddingHorizontal: 12,
		paddingVertical:   7,
		borderRadius:      RADII.default,
		borderWidth:       1,
	},
	editLabel: { fontFamily: FONTS.body.regular, fontSize: 13 },
});
