import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	Vibration,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';
import type { PlaySlot } from './RoutineScreen';

interface RoutinePlayScreenProps {
	visible: boolean;
	slots: PlaySlot[];
	onLog: (habitId: string) => void;
	onClose: () => void;
}

export function RoutinePlayScreen({ visible, slots: slotsProp, onLog, onClose }: RoutinePlayScreenProps) {
	const { colors } = useTheme();
	const [frozenSlots, setFrozenSlots] = useState<PlaySlot[]>([]);
	const [currentIdx, setCurrentIdx] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	const [running, setRunning] = useState(false);
	const [finished, setFinished] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const hasAlerted = useRef(false);

	const slots = frozenSlots;
	const slot = slots[currentIdx] as PlaySlot | undefined;
	const isCountdown = slot?.timerType === 'COUNTDOWN' && slot.timerSeconds != null;
	const isStopwatch = slot?.timerType === 'TIMER' && slot.timerSeconds != null;
	const hasTimer = isCountdown || isStopwatch;

	const countdownRemaining = isCountdown ? Math.max((slot.timerSeconds ?? 0) - elapsed, 0) : 0;
	const countdownDone = isCountdown && countdownRemaining === 0 && elapsed > 0;

	useEffect(() => {
		if (visible) {
			setFrozenSlots(slotsProp);
			setCurrentIdx(0);
			setElapsed(0);
			setRunning(false);
			setFinished(false);
			hasAlerted.current = false;
		}
	}, [visible]);

	useEffect(() => {
		setElapsed(0);
		setRunning(hasTimer);
		hasAlerted.current = false;
	}, [currentIdx]);

	useEffect(() => {
		if (running) {
			intervalRef.current = setInterval(() => {
				setElapsed((e) => e + 1);
			}, 1000);
		} else if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [running]);

	useEffect(() => {
		if (countdownDone && !hasAlerted.current) {
			hasAlerted.current = true;
			setRunning(false);
			Vibration.vibrate([0, 300, 100, 300]);
		}
	}, [countdownDone]);

	const restart = useCallback(() => {
		setElapsed(0);
		setRunning(true);
		hasAlerted.current = false;
	}, []);

	const advance = useCallback(() => {
		if (!slot) return;
		onLog(slot.habitView.id);
		if (currentIdx < slots.length - 1) {
			setCurrentIdx((i) => i + 1);
		} else {
			setRunning(false);
			setFinished(true);
		}
	}, [slot, currentIdx, slots.length, onLog]);

	const skip = useCallback(() => {
		if (currentIdx < slots.length - 1) {
			setCurrentIdx((i) => i + 1);
		} else {
			setRunning(false);
			setFinished(true);
		}
	}, [currentIdx, slots.length]);

	const formatTime = (secs: number) => {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	};

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
				{/* Header */}
				<View style={styles.header}>
					<Pressable onPress={onClose} hitSlop={8}>
						<Icon name="close" size={22} color={colors.ink} />
					</Pressable>
					<Text style={[styles.progress, { color: colors.muted }]}>
						{currentIdx + 1} of {slots.length}
					</Text>
					<View style={{ width: 22 }} />
				</View>

				{/* Progress bar */}
				<View style={[styles.progressBar, { backgroundColor: colors.line }]}>
					<View style={[
						styles.progressFill,
						{
							backgroundColor: colors.accent,
							width: `${((currentIdx + (finished ? 1 : 0)) / slots.length) * 100}%`,
						},
					]} />
				</View>

				{finished ? (
					<View style={styles.center}>
						<Icon name="check" size={48} color={colors.accent} strokeWidth={2.5} />
						<Text style={[styles.finishedTitle, { color: colors.ink }]}>
							Routine Complete!
						</Text>
						<Text style={[styles.finishedSub, { color: colors.muted }]}>
							{slots.length} {slots.length === 1 ? 'habit' : 'habits'} done
						</Text>
						<Pressable
							style={[styles.doneBtn, { backgroundColor: colors.ink }]}
							onPress={onClose}
						>
							<Text style={[styles.doneBtnLabel, { color: colors.paper }]}>Done</Text>
						</Pressable>
					</View>
				) : slot ? (
					<View style={styles.content}>
						{/* Habit name */}
						<View style={styles.habitInfo}>
							<Text style={[styles.habitName, { color: colors.ink }]}>
								{slot.habitView.name}
							</Text>
							{slot.habitView.unit ? (
								<Text style={[styles.habitUnit, { color: colors.muted }]}>
									{slot.habitView.unit}
								</Text>
							) : null}
						</View>

						{/* Timer display */}
						{hasTimer && (
							<View style={styles.timerArea}>
								<Text style={[
									styles.timerDisplay,
									{
										color: countdownDone ? colors.accent : colors.ink,
									},
								]}>
									{isCountdown ? formatTime(countdownRemaining) : formatTime(elapsed)}
								</Text>
								<Text style={[styles.timerLabel, { color: colors.muted }]}>
									{isCountdown
										? (countdownDone ? 'Time\'s up!' : 'countdown')
										: 'stopwatch'}
								</Text>
							</View>
						)}

						{/* Timer controls */}
						{hasTimer && (
							<View style={styles.timerControls}>
								<Pressable
									style={[styles.controlBtn, { borderColor: colors.line }]}
									onPress={restart}
								>
									<Icon name="restart" size={20} color={colors.ink} />
								</Pressable>
								{!countdownDone && (
									<Pressable
										style={[styles.controlBtn, { borderColor: colors.line }]}
										onPress={() => setRunning((r) => !r)}
									>
										<Icon
											name={running ? 'pause' : 'play'}
											size={20}
											color={colors.ink}
											fill={running ? 'none' : colors.ink}
											strokeWidth={running ? 2 : 0}
										/>
									</Pressable>
								)}
							</View>
						)}

						{/* Spacer */}
						<View style={{ flex: 1 }} />

						{/* Action buttons */}
						<View style={styles.actions}>
							<Pressable
								style={[styles.skipBtn, { borderColor: colors.line }]}
								onPress={skip}
							>
								<Icon name="skip" size={18} color={colors.muted} />
								<Text style={[styles.skipLabel, { color: colors.muted }]}>Skip</Text>
							</Pressable>

							<Pressable
								style={[styles.nextBtn, { backgroundColor: colors.accent }]}
								onPress={advance}
							>
								<Text style={[styles.nextLabel, { color: colors.paper }]}>
									{currentIdx < slots.length - 1 ? 'Next' : 'Finish'}
								</Text>
								<Icon
									name={currentIdx < slots.length - 1 ? 'right' : 'check'}
									size={18}
									color={colors.paper}
									strokeWidth={2.5}
								/>
							</Pressable>
						</View>
					</View>
				) : null}
			</SafeAreaView>
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
		paddingTop: 12,
		paddingBottom: 8,
	},
	progress: {
		fontFamily: FONTS.body.medium,
		fontSize: 14,
	},
	progressBar: {
		height: 3,
		marginHorizontal: 20,
		borderRadius: 2,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		borderRadius: 2,
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		paddingTop: 40,
	},
	habitInfo: {
		alignItems: 'center',
		marginBottom: 32,
	},
	habitName: {
		fontFamily: FONTS.display.semibold,
		fontSize: 28,
		letterSpacing: -0.5,
		textAlign: 'center',
	},
	habitUnit: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
		marginTop: 6,
	},
	timerArea: {
		alignItems: 'center',
		marginBottom: 24,
	},
	timerDisplay: {
		fontFamily: FONTS.body.medium,
		fontSize: 56,
		letterSpacing: -1,
	},
	timerLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		marginTop: 4,
	},
	timerControls: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 16,
	},
	controlBtn: {
		width: 48,
		height: 48,
		borderRadius: 24,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	actions: {
		flexDirection: 'row',
		gap: 12,
		paddingBottom: 24,
	},
	skipBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	skipLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 15,
	},
	nextBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 14,
		borderRadius: RADII.default,
	},
	nextLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 15,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	finishedTitle: {
		fontFamily: FONTS.display.semibold,
		fontSize: 24,
		letterSpacing: -0.3,
	},
	finishedSub: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	doneBtn: {
		marginTop: 20,
		paddingVertical: 12,
		paddingHorizontal: 32,
		borderRadius: RADII.default,
	},
	doneBtnLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 15,
	},
});
