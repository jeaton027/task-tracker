import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { habits as habitsApi } from '../api/endpoints';
import type { HabitResponse } from '../api/types';
import { paletteMap } from '../theme/palettes';
import {
	getWidgetConfig,
	saveWidgetConfig,
	type HabitWidgetConfig,
	type TodayWidgetConfig,
	type WidgetConfig,
	type WidgetFrequencyKey,
} from './config';
import { buildWidget } from './render';
import { WIDGET_COLORS } from './widget-theme';

const FREQ_LABELS: { key: WidgetFrequencyKey; label: string }[] = [
	{ key: 'daily', label: 'Daily' },
	{ key: 'weekly', label: 'Weekly' },
	{ key: 'monthly', label: 'Monthly' },
	{ key: 'yearly', label: 'Yearly' },
	{ key: 'interval', label: 'Interval' },
];

/**
 * Configuration UI for both widget types. Which widget is being configured
 * comes from widgetInfo.widgetName; per-instance settings are stored under
 * widgetInfo.widgetId.
 */
export function WidgetConfigurationScreen({
	widgetInfo,
	setResult,
	renderWidget,
}: WidgetConfigurationScreenProps) {
	const scheme = useColorScheme();
	const c = WIDGET_COLORS[scheme === 'dark' ? 'dark' : 'light'];
	const hexMap = paletteMap('earthy');

	const [config, setConfig] = useState<WidgetConfig | null>(null);
	const [allHabits, setAllHabits] = useState<HabitResponse[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [cfg, list] = await Promise.all([
					getWidgetConfig(widgetInfo.widgetId, widgetInfo.widgetName),
					habitsApi.list(),
				]);
				if (cancelled) return;
				setConfig(cfg);
				setAllHabits(list.filter((h) => h.is_active && !h.is_archived));
			} catch {
				if (!cancelled) {
					setLoadError('Couldn’t load your habits. Open Daybook to sign in, then try again.');
				}
			}
		})();
		return () => { cancelled = true; };
	}, [widgetInfo.widgetId, widgetInfo.widgetName]);

	const onSave = async () => {
		if (!config) return;
		setSaving(true);
		try {
			await saveWidgetConfig(widgetInfo.widgetId, config);
			renderWidget(await buildWidget(widgetInfo));
			setResult('ok');
		} catch {
			setSaving(false);
		}
	};

	const body = useMemo(() => {
		if (loadError) {
			return <Text style={[styles.message, { color: c.muted }]}>{loadError}</Text>;
		}
		if (!config || !allHabits) {
			return (
				<View style={styles.center}>
					<ActivityIndicator color={c.ink} />
				</View>
			);
		}
		if (config.kind === 'habit') {
			return (
				<HabitPicker
					config={config}
					habits={allHabits}
					hexMap={hexMap}
					colors={c}
					onChange={setConfig}
				/>
			);
		}
		return (
			<TodayConfigEditor
				config={config}
				habits={allHabits}
				hexMap={hexMap}
				colors={c}
				onChange={setConfig}
			/>
		);
	}, [loadError, config, allHabits, c, hexMap]);

	const canSave =
		config != null &&
		!saving &&
		(config.kind !== 'habit' || config.habitId != null);

	// SafeArea keeps the Cancel/Save row clear of the gesture nav bar — this
	// activity renders outside the app's own providers.
	return (
		<SafeAreaProvider>
			<SafeAreaView
				style={[styles.root, { backgroundColor: c.paper }]}
				edges={['top', 'bottom']}
			>
				<Text style={[styles.title, { color: c.ink }]}>
					{widgetInfo.widgetName === 'DaybookHabit' ? 'Choose a habit' : 'Widget settings'}
				</Text>
				<ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
					{body}
				</ScrollView>
				<View style={styles.buttonRow}>
					<Pressable
						style={[styles.button, { borderColor: c.line, backgroundColor: c.card }]}
						onPress={() => setResult('cancel')}
					>
						<Text style={{ color: c.ink }}>Cancel</Text>
					</Pressable>
					<Pressable
						style={[
							styles.button,
							{ backgroundColor: canSave ? c.ink : c.chip, borderColor: c.line },
						]}
						disabled={!canSave}
						onPress={onSave}
					>
						<Text style={{ color: canSave ? c.paper : c.muted }}>
							{saving ? 'Saving…' : 'Save'}
						</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

// ── Single habit picker ────────────────────────────────────────────────

function HabitPicker({
	config, habits, hexMap, colors, onChange,
}: {
	config: HabitWidgetConfig;
	habits: HabitResponse[];
	hexMap: Record<string, string>;
	colors: (typeof WIDGET_COLORS)['light'];
	onChange: (c: HabitWidgetConfig) => void;
}) {
	return (
		<View>
			{habits.map((h) => {
				const on = config.habitId === h.id;
				return (
					<HabitRowToggle
						key={h.id}
						name={h.name}
						colorHex={h.color_key ? hexMap[h.color_key] : undefined}
						selected={on}
						colors={colors}
						onPress={() => onChange({ ...config, habitId: h.id })}
					/>
				);
			})}
		</View>
	);
}

// ── Today-list editor ──────────────────────────────────────────────────

function TodayConfigEditor({
	config, habits, hexMap, colors, onChange,
}: {
	config: TodayWidgetConfig;
	habits: HabitResponse[];
	hexMap: Record<string, string>;
	colors: (typeof WIDGET_COLORS)['light'];
	onChange: (c: TodayWidgetConfig) => void;
}) {
	const auto = config.mode === 'auto';

	const toggleHidden = (id: string) => {
		const hidden = new Set(config.hiddenHabitIds);
		hidden.has(id) ? hidden.delete(id) : hidden.add(id);
		onChange({ ...config, hiddenHabitIds: [...hidden] });
	};
	const togglePicked = (id: string) => {
		const picked = new Set(config.habitIds);
		picked.has(id) ? picked.delete(id) : picked.add(id);
		onChange({ ...config, habitIds: [...picked] });
	};

	return (
		<View>
			{/* Mode */}
			<View style={styles.segmentRow}>
				{(['auto', 'custom'] as const).map((m) => {
					const on = config.mode === m;
					return (
						<Pressable
							key={m}
							style={[
								styles.segment,
								{
									backgroundColor: on ? colors.ink : colors.card,
									borderColor: colors.line,
								},
							]}
							onPress={() => onChange({ ...config, mode: m })}
						>
							<Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13 }}>
								{m === 'auto' ? "Today's habits" : 'Custom list'}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{auto ? (
				<>
					<Text style={[styles.sectionLabel, { color: colors.muted }]}>SHOW FREQUENCIES</Text>
					<View style={styles.chipRow}>
						{FREQ_LABELS.map(({ key, label }) => {
							const on = config.frequencies[key];
							return (
								<Pressable
									key={key}
									style={[
										styles.chip,
										{
											backgroundColor: on ? colors.ink : colors.card,
											borderColor: colors.line,
										},
									]}
									onPress={() =>
										onChange({
											...config,
											frequencies: { ...config.frequencies, [key]: !on },
										})
									}
								>
									<Text style={{ color: on ? colors.paper : colors.ink, fontSize: 12 }}>
										{label}
									</Text>
								</Pressable>
							);
						})}
					</View>

					<Text style={[styles.sectionLabel, { color: colors.muted }]}>
						HIDE SPECIFIC HABITS
					</Text>
					{habits.map((h) => (
						<HabitRowToggle
							key={h.id}
							name={h.name}
							colorHex={h.color_key ? hexMap[h.color_key] : undefined}
							selected={config.hiddenHabitIds.includes(h.id)}
							selectedLabel="Hidden"
							colors={colors}
							onPress={() => toggleHidden(h.id)}
						/>
					))}
				</>
			) : (
				<>
					<Text style={[styles.sectionLabel, { color: colors.muted }]}>
						PICK HABITS TO SHOW
					</Text>
					{habits.map((h) => (
						<HabitRowToggle
							key={h.id}
							name={h.name}
							colorHex={h.color_key ? hexMap[h.color_key] : undefined}
							selected={config.habitIds.includes(h.id)}
							colors={colors}
							onPress={() => togglePicked(h.id)}
						/>
					))}
				</>
			)}
		</View>
	);
}

// ── Shared row ─────────────────────────────────────────────────────────

function HabitRowToggle({
	name, colorHex, selected, selectedLabel, colors, onPress,
}: {
	name: string;
	colorHex?: string;
	selected: boolean;
	selectedLabel?: string;
	colors: (typeof WIDGET_COLORS)['light'];
	onPress: () => void;
}) {
	return (
		<Pressable
			style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.line }]}
			onPress={onPress}
		>
			<View style={[styles.dot, { backgroundColor: colorHex ?? colors.muted }]} />
			<Text style={[styles.habitName, { color: colors.ink }]} numberOfLines={1}>
				{name}
			</Text>
			<Text style={{ color: selected ? colors.ink : colors.muted, fontSize: 13 }}>
				{selected ? (selectedLabel ?? '✓') : ''}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, paddingTop: 12, paddingHorizontal: 16 },
	title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
	scroll: { flex: 1 },
	center: { paddingVertical: 40, alignItems: 'center' },
	message: { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
	segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
	segment: {
		flex: 1,
		paddingVertical: 10,
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 10,
	},
	sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
	chip: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
	},
	habitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 12,
		marginBottom: 6,
	},
	dot: { width: 10, height: 10, borderRadius: 3 },
	habitName: { flex: 1, fontSize: 14 },
	buttonRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
	button: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 12,
		borderRadius: 10,
		borderWidth: 1,
	},
});
