/**
 * The "Customize cadence" bottom sheet — opened by the calendar icon in the
 * Frequency row. Provides access to advanced scheduling that doesn't fit the
 * inline sub-options.
 *
 * Chunk 2 supports only the Day tab's "Every n days" path (-> INTERVAL).
 * Every other option in this sheet is marked backend TBD with a disabled
 * row, both to be honest with the user and to leave room for the design.
 *
 * `initialInterval` lets the form re-open the sheet at the previous cadence.
 * `onDone` reports either an INTERVAL spec or `null` (clear custom cadence
 * and revert to the inline sub-options).
 */
import { useState } from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import { FONTS, RADII, useTheme } from '../../theme';
import { Radio } from './Radio';
import { Segmented } from './Segmented';
import { Stepper } from './Stepper';
import { TbdPill } from './TbdPill';

export type CadenceTab = 'Day' | 'Week' | 'Month' | 'Year';
const CADENCE_TABS: readonly CadenceTab[] = ['Day', 'Week', 'Month', 'Year'];

export interface CustomCadence {
	type:          'INTERVAL';
	interval_days: number;
}

interface CustomizeSheetProps {
	visible:          boolean;
	initialInterval?: CustomCadence | null;
	onClose:          () => void;
	onDone:           (result: CustomCadence | null) => void;
}

type DayOption = 'everyday' | 'every-n' | 'tbd-cycle' | 'tbd-on-off';

export function CustomizeSheet({
	visible, initialInterval, onClose, onDone,
}: CustomizeSheetProps) {
	const { colors } = useTheme();
	const [tab, setTab] = useState<CadenceTab>('Day');
	const [dayOption, setDayOption] = useState<DayOption>(
		initialInterval ? 'every-n' : 'everyday',
	);
	const [intervalDays, setIntervalDays] = useState(
		initialInterval?.interval_days ?? 3,
	);

	const apply = () => {
		// Only the Day → "Every n days" path produces a backend-storable cadence.
		// Anything else (TBD options or "Everyday") clears the custom override
		// and lets the inline sub-options take over.
		if (tab === 'Day' && dayOption === 'every-n') {
			onDone({ type: 'INTERVAL', interval_days: intervalDays });
		} else {
			onDone(null);
		}
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable
					style={[styles.sheet, { backgroundColor: colors.paper }]}
					onPress={(e) => e.stopPropagation()}
				>
					<View style={styles.header}>
						<Pressable onPress={onClose}>
							<Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text>
						</Pressable>
						<Text style={[styles.title, { color: colors.ink }]}>Customize cadence</Text>
						<Pressable onPress={apply}>
							<Text style={[styles.done, { color: colors.accent }]}>Done</Text>
						</Pressable>
					</View>

					<View style={styles.tabs}>
						<Segmented items={CADENCE_TABS} active={tab} onChange={setTab} />
					</View>

					<View style={styles.body}>
						{tab === 'Day' && (
							<DayCadenceTab
								option={dayOption} onOption={setDayOption}
								intervalDays={intervalDays} onInterval={setIntervalDays}
							/>
						)}
						{tab !== 'Day' && <FullyTbdTab tab={tab} />}
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Day tab ─────────────────────────────────────────────────────────────

function DayCadenceTab({
	option, onOption, intervalDays, onInterval,
}: {
	option:       DayOption;
	onOption:     (o: DayOption) => void;
	intervalDays: number;
	onInterval:   (n: number) => void;
}) {
	const { colors } = useTheme();
	return (
		<View>
			<CadenceRow
				active={option === 'everyday'}
				onPress={() => onOption('everyday')}
				label="Everyday"
			/>

			<CadenceRow
				active={option === 'every-n'}
				onPress={() => onOption('every-n')}
				label="Every"
				right={
					<Stepper
						value={intervalDays}
						onChange={onInterval}
						min={2}
						suffix="days"
					/>
				}
			/>

			<CadenceRow
				active={false}
				onPress={() => { /* TBD */ }}
				label="Anytime in an n-day cycle"
				tbd
			/>

			<CadenceRow
				active={false}
				onPress={() => { /* TBD */ }}
				label="n days on, m days off"
				tbd
				last
			/>

			<Text style={[styles.helper, { color: colors.muted }]}>
				Picking Everyday or a TBD option here will clear custom cadence.
			</Text>
		</View>
	);
}

function FullyTbdTab({ tab }: { tab: CadenceTab }) {
	const { colors } = useTheme();
	const labels: Record<CadenceTab, string[]> = {
		Day:   [],
		Week:  ['Every week', 'Every n weeks', 'Anytime in an n-week cycle'],
		Month: ['Every month', 'Every n months', 'Anytime in an n-month cycle'],
		Year:  ['Every year', 'Every n years', 'Anytime in an n-year cycle'],
	};
	return (
		<View>
			{labels[tab].map((label, i) => (
				<CadenceRow
					key={label}
					active={false}
					onPress={() => { /* TBD */ }}
					label={label}
					tbd
					last={i === labels[tab].length - 1}
				/>
			))}
			<Text style={[styles.helper, { color: colors.muted }]}>
				Inline "Anytime" / "Select" options on the main form cover the
				supported {tab.toLowerCase()}-level cadences. Custom intervals here
				come once the backend custom-schedule fields land.
			</Text>
		</View>
	);
}

function CadenceRow({
	active, onPress, label, right, tbd, last,
}: {
	active: boolean;
	onPress: () => void;
	label: string;
	right?: React.ReactNode;
	tbd?: boolean;
	last?: boolean;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={tbd ? undefined : onPress}
			style={[
				styles.optRow,
				{ borderBottomColor: colors.line, borderBottomWidth: last ? 0 : 1 },
				tbd ? { opacity: 0.62 } : null,
			]}
		>
			<Radio on={active} />
			<Text style={[styles.optLabel, { color: colors.ink }]}>{label}</Text>
			{tbd && <TbdPill />}
			{right}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex:            1,
		justifyContent:  'flex-end',
		backgroundColor: 'rgba(28,22,16,0.34)',
	},
	sheet: {
		borderTopLeftRadius:  20,
		borderTopRightRadius: 20,
		paddingHorizontal: 18,
		paddingTop:        10,
		paddingBottom:     28,
	},
	header: {
		flexDirection: 'row',
		alignItems:    'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
		marginBottom:   8,
	},
	title:  { fontFamily: FONTS.display.regular, fontSize: 16, letterSpacing: -0.2 },
	cancel: { fontFamily: FONTS.body.regular, fontSize: 14 },
	done:   { fontFamily: FONTS.display.regular, fontSize: 14 },
	tabs:   { marginBottom: 14 },
	body:   {},
	optRow: {
		flexDirection: 'row',
		alignItems:    'center',
		gap:           12,
		paddingVertical: 12,
		paddingHorizontal: 2,
	},
	optLabel: {
		flex:       1,
		fontFamily: FONTS.body.regular,
		fontSize:   14.5,
	},
	helper: {
		marginTop:  14,
		fontFamily: FONTS.body.regular,
		fontSize:   12,
		lineHeight: 17,
	},
});
