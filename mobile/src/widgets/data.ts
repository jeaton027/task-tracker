/**
 * Fetch + shape habit data for home-screen widgets.
 *
 * Reuses the app's apiFetch client (token + refresh handled from storage,
 * which works in the headless widget task too).
 */
import { habits } from '../api/endpoints';
import type { HabitTodayResponse, TodayResponse } from '../api/types';
import { ApiError } from '../api/client';
import { paletteMap } from '../theme/palettes';
import { isoDate } from '../utils/dates';
import type { TodayWidgetConfig, WidgetFrequencyKey } from './config';

/** Slim, serializable row the widget UI renders. */
export interface WidgetHabitRow {
	id: string;
	name: string;
	colorHex: string;
	mode: 'DO' | 'AVOID';
	done: number;
	target: number;
	completed: boolean;
}

export type WidgetData =
	| { state: 'ok'; rows: WidgetHabitRow[]; doneCount: number; totalCount: number }
	| { state: 'logged-out' }
	| { state: 'error' };

const SECTION_KEYS: WidgetFrequencyKey[] = [
	'daily', 'weekly', 'monthly', 'yearly', 'interval',
];

/** Widgets cap the payload; the list scrolls, this is just sanity. */
const MAX_ROWS = 15;

const HEX = paletteMap('earthy');
const FALLBACK_COLOR = '#988F81';

function toRow(h: HabitTodayResponse): WidgetHabitRow {
	const isDaysPerWeek = h.days_per_week != null && h.days_per_week > 0;
	const done = isDaysPerWeek
		? (h.week_completed_days ?? 0)
		: h.current_period_count;
	const target = isDaysPerWeek ? h.days_per_week! : h.target_per_period;
	return {
		id: h.id,
		name: h.name,
		colorHex: (h.color_key && HEX[h.color_key]) || FALLBACK_COLOR,
		mode: h.mode as 'DO' | 'AVOID',
		done,
		target,
		completed: h.mode === 'DO' ? done >= target : done <= target,
	};
}

function flatten(
	data: TodayResponse,
	frequencies?: Record<WidgetFrequencyKey, boolean>,
): HabitTodayResponse[] {
	return SECTION_KEYS.flatMap((key) =>
		frequencies && !frequencies[key] ? [] : data[key]?.habits ?? [],
	);
}

export async function fetchTodayWidgetRows(
	config: TodayWidgetConfig,
): Promise<WidgetData> {
	const today = isoDate(new Date());
	try {
		if (config.mode === 'custom') {
			// year scope = every habit; filter down to the hand-picked list
			const data = await habits.today(today, undefined, 'year');
			const byId = new Map(flatten(data).map((h) => [h.id, h]));
			const rows = config.habitIds
				.map((id) => byId.get(id))
				.filter((h): h is HabitTodayResponse => h != null)
				.map(toRow)
				.slice(0, MAX_ROWS);
			return withCounts(rows);
		}

		const data = await habits.today(today, undefined, 'today');
		const hidden = new Set(config.hiddenHabitIds);
		const rows = flatten(data, config.frequencies)
			.filter((h) => !hidden.has(h.id))
			.map(toRow)
			.slice(0, MAX_ROWS);
		return withCounts(rows);
	} catch (e) {
		if (e instanceof ApiError && e.status === 401) return { state: 'logged-out' };
		return { state: 'error' };
	}
}

export async function fetchSingleHabitRow(
	habitId: string | null,
): Promise<{ state: 'ok'; row: WidgetHabitRow } | { state: 'unconfigured' } | { state: 'logged-out' } | { state: 'error' }> {
	if (!habitId) return { state: 'unconfigured' };
	const today = isoDate(new Date());
	try {
		const data = await habits.today(today, undefined, 'year');
		const habit = flatten(data).find((h) => h.id === habitId);
		if (!habit) return { state: 'unconfigured' };	// deleted or archived
		return { state: 'ok', row: toRow(habit) };
	} catch (e) {
		if (e instanceof ApiError && e.status === 401) return { state: 'logged-out' };
		return { state: 'error' };
	}
}

export async function logHabitFromWidget(habitId: string): Promise<void> {
	await habits.log(habitId, { log_date: isoDate(new Date()) });
}

function withCounts(rows: WidgetHabitRow[]): WidgetData {
	const doCount = rows.filter((r) => r.mode === 'DO');
	return {
		state: 'ok',
		rows,
		doneCount: doCount.filter((r) => r.completed).length,
		totalCount: doCount.length,
	};
}
