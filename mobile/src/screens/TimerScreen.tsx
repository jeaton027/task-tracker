import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	Vibration,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/ui/Icon';
import { FONTS, RADII, useTheme } from '../theme';

type TimerMode = 'stopwatch' | 'timer' | 'pomodoro';
type PomodoroPhase = 'work' | 'break';

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

const TIMER_PRESETS = [
	{ label: '1m',  seconds: 60 },
	{ label: '5m',  seconds: 300 },
	{ label: '10m', seconds: 600 },
	{ label: '15m', seconds: 900 },
	{ label: '30m', seconds: 1800 },
];

interface TimerScreenProps {
	visible: boolean;
	onClose: () => void;
}

export function TimerScreen({ visible, onClose }: TimerScreenProps) {
	const { colors } = useTheme();

	const [mode, setMode] = useState<TimerMode>('stopwatch');
	const [elapsed, setElapsed] = useState(0);
	const [running, setRunning] = useState(false);
	const [timerDuration, setTimerDuration] = useState(300);
	const [customOpen, setCustomOpen] = useState(false);
	const [customMin, setCustomMin] = useState('');
	const [customSec, setCustomSec] = useState('');
	const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('work');
	const [pomodoroCount, setPomodoroCount] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const hasAlerted = useRef(false);

	useEffect(() => {
		if (visible) {
			setElapsed(0);
			setRunning(false);
			hasAlerted.current = false;
			setPomodoroPhase('work');
			setPomodoroCount(0);
		}
	}, [visible]);

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

	const currentTarget = mode === 'pomodoro'
		? (pomodoroPhase === 'work' ? POMODORO_WORK : POMODORO_BREAK)
		: timerDuration;

	const remaining = Math.max(currentTarget - elapsed, 0);
	const isCountdownDone = (mode === 'timer' || mode === 'pomodoro') && remaining === 0 && elapsed > 0;

	useEffect(() => {
		if (!isCountdownDone || hasAlerted.current) return;
		hasAlerted.current = true;
		Vibration.vibrate([0, 400, 200, 400]);

		if (mode === 'pomodoro') {
			setRunning(false);
		}
	}, [isCountdownDone, mode]);

	const displayTime = mode === 'stopwatch' ? elapsed : remaining;

	const formatTime = (secs: number) => {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${m}:${String(s).padStart(2, '0')}`;
	};

	const reset = useCallback(() => {
		setElapsed(0);
		setRunning(false);
		hasAlerted.current = false;
		if (mode === 'pomodoro') {
			setPomodoroPhase('work');
			setPomodoroCount(0);
		}
	}, [mode]);

	const toggleRunning = useCallback(() => {
		if (isCountdownDone) {
			setElapsed(0);
			hasAlerted.current = false;
			setRunning(true);
		} else {
			setRunning((r) => !r);
		}
	}, [isCountdownDone]);

	const applyCustom = useCallback(() => {
		const m = parseInt(customMin, 10) || 0;
		const s = parseInt(customSec, 10) || 0;
		const total = m * 60 + s;
		if (total > 0) {
			setTimerDuration(total);
			setCustomOpen(false);
		}
	}, [customMin, customSec]);

	const openCustom = useCallback(() => {
		setCustomMin('');
		setCustomSec('');
		setCustomOpen(true);
	}, []);

	const switchMode = useCallback((next: TimerMode) => {
		setMode(next);
		setElapsed(0);
		setRunning(false);
		hasAlerted.current = false;
		setPomodoroPhase('work');
		setPomodoroCount(0);
	}, []);

	const pomodoroAdvance = useCallback(() => {
		if (pomodoroPhase === 'work') {
			setPomodoroPhase('break');
			setPomodoroCount((c) => c + 1);
		} else {
			setPomodoroPhase('work');
		}
		setElapsed(0);
		hasAlerted.current = false;
		setRunning(true);
	}, [pomodoroPhase]);

	const progress = mode === 'stopwatch'
		? 0
		: Math.min(elapsed / currentTarget, 1);

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
				{/* Header */}
				<View style={styles.header}>
					<Pressable onPress={onClose} hitSlop={8}>
						<Icon name="close" size={22} color={colors.ink} />
					</Pressable>
					<Text style={[styles.headerTitle, { color: colors.ink }]}>Timer</Text>
					<View style={{ width: 22 }} />
				</View>

				{/* Mode tabs */}
				<View style={[styles.modeTabs, { backgroundColor: colors.chip }]}>
					{(['stopwatch', 'timer', 'pomodoro'] as TimerMode[]).map((m) => (
						<Pressable
							key={m}
							style={[
								styles.modeTab,
								mode === m && { backgroundColor: colors.paper },
							]}
							onPress={() => switchMode(m)}
						>
							<Text style={[
								styles.modeTabLabel,
								{ color: mode === m ? colors.ink : colors.muted },
							]}>
								{m === 'stopwatch' ? 'Stopwatch' : m === 'timer' ? 'Timer' : 'Pomodoro'}
							</Text>
						</Pressable>
					))}
				</View>

				<View style={styles.content}>
					{/* Pomodoro phase label */}
					{mode === 'pomodoro' && (
						<View style={styles.phaseRow}>
							<Text style={[styles.phaseLabel, {
								color: pomodoroPhase === 'work' ? colors.accent : colors.muted,
							}]}>
								{pomodoroPhase === 'work' ? 'Focus' : 'Break'}
							</Text>
							{pomodoroCount > 0 && (
								<Text style={[styles.phaseCount, { color: colors.muted }]}>
									{pomodoroCount} {pomodoroCount === 1 ? 'session' : 'sessions'} done
								</Text>
							)}
						</View>
					)}

					{/* Progress ring (for countdown modes) */}
					{(mode === 'timer' || mode === 'pomodoro') && (
						<View style={styles.ringContainer}>
							<View style={[styles.ringTrack, { borderColor: colors.line }]}>
								<ProgressArc
									progress={progress}
									size={240}
									strokeWidth={6}
									color={isCountdownDone
										? colors.accent
										: pomodoroPhase === 'break' ? colors.muted : colors.ink}
								/>
								<View style={styles.ringCenter}>
									<Text style={[
										styles.time,
										{ color: isCountdownDone ? colors.accent : colors.ink },
									]}>
										{formatTime(displayTime)}
									</Text>
								</View>
							</View>
						</View>
					)}

					{/* Stopwatch display */}
					{mode === 'stopwatch' && (
						<View style={styles.stopwatchDisplay}>
							<Text style={[styles.timeXL, { color: colors.ink }]}>
								{formatTime(displayTime)}
							</Text>
						</View>
					)}

					{/* Timer presets (only when not running & timer mode) */}
					{mode === 'timer' && !running && elapsed === 0 && (
						<>
							<View style={styles.presets}>
								{TIMER_PRESETS.map((p) => {
									const isCustom = !TIMER_PRESETS.some((pr) => pr.seconds === timerDuration);
									const active = timerDuration === p.seconds && !isCustom;
									return (
										<Pressable
											key={p.label}
											style={[
												styles.preset,
												{
													borderColor: active ? colors.ink : colors.line,
													backgroundColor: active ? colors.ink : 'transparent',
												},
											]}
											onPress={() => { setTimerDuration(p.seconds); setCustomOpen(false); }}
										>
											<Text style={[
												styles.presetLabel,
												{ color: active ? colors.paper : colors.ink },
											]}>
												{p.label}
											</Text>
										</Pressable>
									);
								})}
							</View>

							{!customOpen ? (
								<Pressable onPress={openCustom} style={styles.customBtn}>
									<Text style={[styles.customBtnText, { color: colors.muted }]}>
										Custom
									</Text>
								</Pressable>
							) : (
								<View style={styles.customRow}>
									<View style={[styles.customField, { borderColor: colors.line, backgroundColor: colors.card }]}>
										<TextInput
											style={[styles.customInput, { color: colors.ink }]}
											value={customMin}
											onChangeText={setCustomMin}
											keyboardType="number-pad"
											placeholder="0"
											placeholderTextColor={colors.muted}
											maxLength={3}
										/>
										<Text style={[styles.customUnit, { color: colors.muted }]}>min</Text>
									</View>
									<View style={[styles.customField, { borderColor: colors.line, backgroundColor: colors.card }]}>
										<TextInput
											style={[styles.customInput, { color: colors.ink }]}
											value={customSec}
											onChangeText={setCustomSec}
											keyboardType="number-pad"
											placeholder="0"
											placeholderTextColor={colors.muted}
											maxLength={2}
										/>
										<Text style={[styles.customUnit, { color: colors.muted }]}>sec</Text>
									</View>
									<Pressable
										style={[styles.customSetBtn, { backgroundColor: colors.ink }]}
										onPress={applyCustom}
									>
										<Text style={[styles.customSetText, { color: colors.paper }]}>Set</Text>
									</Pressable>
								</View>
							)}
						</>
					)}

					<View style={{ flex: 1 }} />

					{/* Pomodoro advance button */}
					{mode === 'pomodoro' && isCountdownDone && (
						<Pressable
							style={[styles.advanceBtn, { backgroundColor: colors.accent }]}
							onPress={pomodoroAdvance}
						>
							<Text style={[styles.advanceBtnLabel, { color: colors.paper }]}>
								{pomodoroPhase === 'work' ? 'Start Break' : 'Start Focus'}
							</Text>
						</Pressable>
					)}

					{/* Controls */}
					<View style={styles.controls}>
						<Pressable
							style={[styles.controlBtn, { borderColor: colors.line }]}
							onPress={reset}
						>
							<Icon name="restart" size={22} color={colors.ink} />
						</Pressable>

						<Pressable
							style={[styles.playBtn, { backgroundColor: colors.ink }]}
							onPress={toggleRunning}
						>
							<Icon
								name={running ? 'pause' : 'play'}
								size={28}
								color={colors.paper}
								fill={running ? 'none' : colors.paper}
								strokeWidth={running ? 2 : 0}
							/>
						</Pressable>

						<View style={{ width: 52 }} />
					</View>
				</View>
			</SafeAreaView>
		</Modal>
	);
}

// Simple SVG-free progress arc using a rotating border trick
function ProgressArc({ progress, size, strokeWidth, color }: {
	progress: number;
	size: number;
	strokeWidth: number;
	color: string;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const filled = circumference * progress;

	return (
		<View style={[styles.arcContainer, { width: size, height: size }]}>
			<View
				style={[
					styles.arcTrack,
					{
						width: size,
						height: size,
						borderRadius: size / 2,
						borderWidth: strokeWidth,
						borderColor: 'transparent',
					},
				]}
			/>
			{progress > 0 && (
				<View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
					{Array.from({ length: Math.ceil(progress * 72) }, (_, i) => {
						const angle = (i / 72) * 360 - 90;
						const rad = (angle * Math.PI) / 180;
						const dotSize = strokeWidth;
						const cx = size / 2 + radius * Math.cos(rad) - dotSize / 2;
						const cy = size / 2 + radius * Math.sin(rad) - dotSize / 2;
						return (
							<View
								key={i}
								style={{
									position: 'absolute',
									left: cx,
									top: cy,
									width: dotSize,
									height: dotSize,
									borderRadius: dotSize / 2,
									backgroundColor: color,
								}}
							/>
						);
					})}
				</View>
			)}
		</View>
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
	headerTitle: {
		fontFamily: FONTS.display.regular,
		fontSize: 18,
		letterSpacing: -0.3,
	},
	modeTabs: {
		flexDirection: 'row',
		marginHorizontal: 20,
		borderRadius: RADII.default,
		padding: 3,
	},
	modeTab: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: RADII.default - 2,
		alignItems: 'center',
	},
	modeTabLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		paddingTop: 32,
	},
	phaseRow: {
		alignItems: 'center',
		marginBottom: 16,
	},
	phaseLabel: {
		fontFamily: FONTS.display.semibold,
		fontSize: 20,
		letterSpacing: -0.3,
	},
	phaseCount: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		marginTop: 4,
	},
	ringContainer: {
		alignItems: 'center',
		marginBottom: 24,
	},
	ringTrack: {
		width: 240,
		height: 240,
		borderRadius: 120,
		borderWidth: 3,
		alignItems: 'center',
		justifyContent: 'center',
	},
	ringCenter: {
		position: 'absolute',
		alignItems: 'center',
		justifyContent: 'center',
	},
	time: {
		fontFamily: FONTS.body.medium,
		fontSize: 48,
		letterSpacing: -1,
	},
	stopwatchDisplay: {
		alignItems: 'center',
		paddingTop: 60,
		paddingBottom: 40,
	},
	timeXL: {
		fontFamily: FONTS.body.medium,
		fontSize: 64,
		letterSpacing: -2,
	},
	presets: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 10,
		marginTop: 8,
	},
	preset: {
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: RADII.default,
		borderWidth: 1,
	},
	presetLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},
	customBtn: {
		alignItems: 'center',
		marginTop: 12,
	},
	customBtnText: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},
	customRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 10,
		marginTop: 12,
	},
	customField: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	customInput: {
		fontFamily: FONTS.body.medium,
		fontSize: 16,
		width: 36,
		textAlign: 'center',
		padding: 0,
	},
	customUnit: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		marginLeft: 2,
	},
	customSetBtn: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: RADII.default,
	},
	customSetText: {
		fontFamily: FONTS.body.medium,
		fontSize: 13,
	},
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 24,
		paddingBottom: 32,
	},
	controlBtn: {
		width: 52,
		height: 52,
		borderRadius: 26,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	playBtn: {
		width: 72,
		height: 72,
		borderRadius: 36,
		alignItems: 'center',
		justifyContent: 'center',
	},
	advanceBtn: {
		alignItems: 'center',
		paddingVertical: 14,
		borderRadius: RADII.default,
		marginBottom: 24,
	},
	advanceBtnLabel: {
		fontFamily: FONTS.body.medium,
		fontSize: 15,
	},
	arcContainer: {
		position: 'absolute',
	},
	arcTrack: {},
});
