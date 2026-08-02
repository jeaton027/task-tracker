import { Fragment, useCallback, useMemo, useState } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toHabitView, type HabitView } from '../api/adapter';
import { useLogHabit, useRoutine, useToday } from '../api/queries';
import type { HabitTodayResponse, RoutineHabitSlotResponse } from '../api/types';
import { HabitRow } from '../components/today/HabitRow';
import { SectionBar } from '../components/today/SectionBar';
import { Icon } from '../components/ui/Icon';
import { FONTS, useTheme } from '../theme';
import { isoDate } from '../utils/dates';
import { RoutinePlayScreen } from './RoutinePlayScreen';

export interface PlaySlot {
	habitView: HabitView;
	timerSeconds: number | null;
	timerType: 'TIMER' | 'COUNTDOWN' | null;
}

interface RoutineScreenProps {
	visible: boolean;
	routineId: string | null;
	onClose: () => void;
}

export function RoutineScreen({ visible, routineId, onClose }: RoutineScreenProps) {
	const { colors } = useTheme();
	const routineQ = useRoutine(routineId);
	const todayStr = isoDate(new Date());
	const todayQ = useToday(todayStr, new Date().getHours());
	const logHabit = useLogHabit();

	const [completedCollapsed, setCompletedCollapsed] = useState(true);
	const [playing, setPlaying] = useState(false);

	const routine = routineQ.data;

	const todayHabitMap = useMemo(() => {
		if (!todayQ.data) return new Map<string, HabitTodayResponse>();
		const map = new Map<string, HabitTodayResponse>();
		for (const key of ['daily', 'weekly', 'monthly', 'yearly', 'interval'] as const) {
			const section = todayQ.data[key];
			if (!section?.habits) continue;
			for (const h of section.habits) {
				map.set(h.id, h);
			}
		}
		return map;
	}, [todayQ.data]);

	const slots = useMemo(() => {
		if (!routine?.habits) return [];
		return routine.habits
			.sort((a, b) => a.position - b.position)
			.map((slot) => {
				const todayData = todayHabitMap.get(slot.habit.id);
				const habitView: HabitView = todayData
					? toHabitView(todayData)
					: {
						id: slot.habit.id,
						name: slot.habit.name,
						colorKey: slot.habit.color_key ?? 'stone',
						frequency: slot.habit.frequency,
						mode: slot.habit.mode,
						unit: slot.habit.unit ?? '',
						done: 0,
						target: slot.habit.target_per_period,
						streak: 0,
						section: slot.habit.section ?? null,
						categoryId: slot.habit.category_id ?? null,
					};
				return { habitView, slot };
			});
	}, [routine, todayHabitMap]);

	const incomplete = slots.filter(
		(s) => s.habitView.mode === 'AVOID' || s.habitView.done < s.habitView.target,
	);
	const completed = slots.filter(
		(s) => s.habitView.mode !== 'AVOID' && s.habitView.done >= s.habitView.target,
	);

	const playSlots: PlaySlot[] = incomplete.map((s) => ({
		habitView: s.habitView,
		timerSeconds: s.slot.timer_seconds ?? null,
		timerType: s.slot.timer_type ?? null,
	}));

	const onLog = useCallback((habitId: string) => {
		logHabit.mutate({ habitId, body: { log_date: todayStr } });
	}, [logHabit, todayStr]);

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
				<View style={[styles.header, { borderBottomColor: colors.line }]}>
					<Pressable onPress={onClose} hitSlop={8}>
						<Icon name="left" size={22} color={colors.ink} />
					</Pressable>
					<Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
						{routine?.name ?? '…'}
					</Text>
					<Pressable
						onPress={() => setPlaying(true)}
						hitSlop={8}
						disabled={playSlots.length === 0}
					>
						<Icon
							name="play"
							size={20}
							color={playSlots.length > 0 ? colors.accent : colors.muted}
							fill={playSlots.length > 0 ? colors.accent : colors.muted}
							strokeWidth={0}
						/>
					</Pressable>
				</View>

				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					{slots.length === 0 && (
						<Text style={[styles.empty, { color: colors.muted }]}>
							No habits in this routine yet.
						</Text>
					)}

					{incomplete.length > 0 && (
						<View style={styles.section}>
							{incomplete.map((s) => (
								<HabitRow
									key={s.habitView.id}
									habit={s.habitView}
									view="Today"
									onLog={() => onLog(s.habitView.id)}
								/>
							))}
						</View>
					)}

					{completed.length > 0 && (
						<Fragment>
							<SectionBar
								label="Completed"
								count={completed.length}
								collapsed={completedCollapsed}
								onToggle={() => setCompletedCollapsed((p) => !p)}
							/>
							{!completedCollapsed && (
								<View style={styles.section}>
									{completed.map((s) => (
										<HabitRow
											key={s.habitView.id}
											habit={s.habitView}
											view="Today"
											onLog={() => onLog(s.habitView.id)}
										/>
									))}
								</View>
							)}
						</Fragment>
					)}

					<View style={{ height: 40 }} />
				</ScrollView>

				<View style={[styles.footer, { borderTopColor: colors.line }]}>
					<Text style={[styles.progress, { color: colors.muted }]}>
						{completed.length} of {slots.length} completed
					</Text>
					{playSlots.length > 0 && (
						<Pressable
							style={[styles.playBtn, { backgroundColor: colors.accent }]}
							onPress={() => setPlaying(true)}
						>
							<Icon name="play" size={16} color={colors.paper} fill={colors.paper} strokeWidth={0} />
							<Text style={[styles.playLabel, { color: colors.paper }]}>
								Play ({playSlots.length})
							</Text>
						</Pressable>
					)}
				</View>
			</SafeAreaView>

			<RoutinePlayScreen
				visible={playing}
				slots={playSlots}
				onLog={onLog}
				onClose={() => setPlaying(false)}
			/>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 14,
		borderBottomWidth: 1,
	},
	title: {
		fontFamily: FONTS.display.semibold,
		fontSize: 20,
		letterSpacing: -0.3,
		flex: 1,
		textAlign: 'center',
		marginHorizontal: 12,
	},
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: 20 },
	section: {
		paddingHorizontal: 16,
		gap: 9,
		marginBottom: 6,
		marginTop: 8,
	},
	empty: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		textAlign: 'center',
		paddingVertical: 32,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderTopWidth: 1,
	},
	progress: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
	},
	playBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingVertical: 9,
		paddingHorizontal: 16,
		borderRadius: 20,
	},
	playLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 14,
	},
});
