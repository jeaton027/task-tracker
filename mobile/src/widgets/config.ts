/**
 * Per-widget configuration, keyed by Android's widgetId.
 *
 * Two widget types:
 *   DaybookToday — list of habits. Auto mode mirrors the Today tab (with
 *                  per-habit exclusions + frequency toggles); custom mode is
 *                  a hand-picked list.
 *   DaybookHabit — a single habit with one-tap logging.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WidgetFrequencyKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'interval';

export interface TodayWidgetConfig {
	kind: 'today';
	mode: 'auto' | 'custom';
	/** auto mode: habits the user never wants on the widget */
	hiddenHabitIds: string[];
	/** auto mode: frequency sections to include */
	frequencies: Record<WidgetFrequencyKey, boolean>;
	/** custom mode: the hand-picked habit ids, in display order */
	habitIds: string[];
}

export interface HabitWidgetConfig {
	kind: 'habit';
	habitId: string | null;
}

export type WidgetConfig = TodayWidgetConfig | HabitWidgetConfig;

export const DEFAULT_TODAY_CONFIG: TodayWidgetConfig = {
	kind: 'today',
	mode: 'auto',
	hiddenHabitIds: [],
	frequencies: { daily: true, weekly: true, monthly: true, yearly: true, interval: true },
	habitIds: [],
};

export const DEFAULT_HABIT_CONFIG: HabitWidgetConfig = {
	kind: 'habit',
	habitId: null,
};

const keyFor = (widgetId: number) => `widget-config:${widgetId}`;

export function defaultConfigFor(widgetName: string): WidgetConfig {
	return widgetName === 'DaybookHabit'
		? { ...DEFAULT_HABIT_CONFIG }
		: { ...DEFAULT_TODAY_CONFIG };
}

export async function getWidgetConfig(
	widgetId: number,
	widgetName: string,
): Promise<WidgetConfig> {
	try {
		const raw = await AsyncStorage.getItem(keyFor(widgetId));
		if (raw) return JSON.parse(raw) as WidgetConfig;
	} catch {
		// fall through to default
	}
	return defaultConfigFor(widgetName);
}

export async function saveWidgetConfig(
	widgetId: number,
	config: WidgetConfig,
): Promise<void> {
	await AsyncStorage.setItem(keyFor(widgetId), JSON.stringify(config));
}

export async function removeWidgetConfig(widgetId: number): Promise<void> {
	await AsyncStorage.removeItem(keyFor(widgetId));
}
