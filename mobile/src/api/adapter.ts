/**
 * Adapter layer: backend `HabitTodayResponse` -> the shape the UI expects.
 *
 * The backend doesn't yet track everything the UI wants to show, so we make
 * deterministic-but-imperfect approximations here. Each TODO is a backend
 * change we should make later.
 */
import { PALETTES } from '../theme';
import { WEEK_START_DAY } from '../utils/dates';
import type {
	CalendarDay,
	HabitFrequency,
	HabitMode,
	HabitSection,
	HabitTodayResponse,
	WeeklyCalendarItem,
	YearlyCalendarItem,
} from './types';

/** Shape consumed by HabitRow / StatusButton. */
export interface HabitView {
	id:         string;
	name:       string;
	colorKey:   string;
	frequency:  HabitFrequency;
	mode:       HabitMode;
	unit:       string;
	done:       number;
	target:     number;
	streak:     number;
	section:    HabitSection | null;
	categoryId: string | null;
	auto?:      boolean;
	perWeek?:   number;
	weekDone?:  number;
}

/**
 * Stable per-habit color pick from the active palette — used as a fallback
 * when the user hasn't chosen a color yet (habit.color_key is null).
 */
function colorKeyFor(id: string): string {
	const palette = PALETTES.earthy;
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return palette[h % palette.length].key;
}

// ── Calendar → heatmap level mapping ───────────────────────────────────
//
// Levels are continuous 0..1 representing fill intensity:
//   -1        future (dashed border, no fill)
//    0        no progress / not scheduled / vacation / failed with 0 logged
//    0..1     partial progress (amount / target)
//    1        fully completed (amount >= target)

type HabitStatus = CalendarDay['status'];

/**
 * Map one calendar cell to a heatmap fill level.
 *
 * Key rule: the heatmap lights up the *days work was done*, not the
 * whole period. For weekly/monthly/yearly habits the server marks every
 * day in a successful period as SUCCESS, but only the days with actual
 * logs (amount > 0) should be colored.
 *
 *   DAILY habits  → gradient based on amount/target (partial fill)
 *   Other freqs   → binary: amount > 0 → full color, else empty
 */
function dayToLevel(
	status: HabitStatus,
	amount: number,
	target: number,
	frequency: HabitFrequency,
): number {
	if (status === 'NOT_SCHEDULED' || status === 'VACATION') return 0;

	const isDaily = frequency === 'DAILY';

	// No logs on this specific day → empty (or future-dashed for open periods)
	if (amount <= 0) {
		return status === 'PENDING' ? -1 : 0;
	}

	// Day has logs — fill based on frequency
	if (isDaily) {
		// Gradient: amount / target, capped at 1
		return target > 0 ? Math.min(amount / target, 1) : 1;
	}

	// Non-daily: any logged day = full color
	return 1;
}

export interface HeatmapCell {
	level: number;   // -1 | 0..1
	date:  string;
}

export interface WeekHeatmapData {
	habitId:    string;
	colorKey:   string;
	cells:      HeatmapCell[];   // 7 entries, ordered from WEEK_START_DAY
	todayIndex: number | undefined;
}

export function toWeekHeatmaps(
	items: WeeklyCalendarItem[],
	todayStr: string,
): WeekHeatmapData[] {
	return items.map((item) => {
		const backendOffset = (WEEK_START_DAY - 1 + 7) % 7;
		const reordered = Array.from({ length: 7 }, (_, i) => {
			const backendIdx = (backendOffset + i) % 7;
			return item.days[backendIdx];
		});

		const cells: HeatmapCell[] = reordered.map((d) => ({
			level: dayToLevel(d.status, d.amount, item.habit.target_per_period, item.habit.frequency),
			date:  d.date,
		}));
		const todayIdx = reordered.findIndex((d) => d.date === todayStr);

		return {
			habitId:    item.habit.id,
			colorKey:   item.habit.color_key ?? colorKeyFor(item.habit.id),
			cells,
			todayIndex: todayIdx >= 0 ? todayIdx : undefined,
		};
	});
}

export interface YearHeatmapData {
	habitId:         string;
	colorKey:        string;
	cells:           HeatmapCell[];   // 365/366 entries, Jan 1 → Dec 31
	todayIndex:      number | undefined;
	/** Row offset for Jan 1 so each day lands in the correct weekday row.
	 *  0 = Jan 1 is WEEK_START_DAY, 1 = Jan 1 is one day after, etc. */
	yearStartOffset: number;
}

export function toYearHeatmaps(
	items: YearlyCalendarItem[],
	todayStr: string,
): YearHeatmapData[] {
	// Compute the weekday offset once — same for all habits in the same year.
	// Parse Jan 1 from the first item's first day date string.
	let yearStartOffset = 0;
	if (items.length > 0 && items[0].days.length > 0) {
		const jan1Str = items[0].days[0].date; // "YYYY-01-01"
		const jan1 = new Date(jan1Str + 'T00:00:00');
		const jsDay = jan1.getDay(); // 0=Sun
		yearStartOffset = (jsDay - WEEK_START_DAY + 7) % 7;
	}

	return items.map((item) => {
		const todayIdx = item.days.findIndex((d) => d.date === todayStr);
		return {
			habitId:    item.habit.id,
			colorKey:   item.habit.color_key ?? colorKeyFor(item.habit.id),
			cells:      item.days.map((d) => ({
				level: dayToLevel(d.status, d.amount, item.habit.target_per_period, item.habit.frequency),
				date:  d.date,
			})),
			todayIndex: todayIdx >= 0 ? todayIdx : undefined,
			yearStartOffset,
		};
	});
}

export interface MonthHeatmapData {
	cells:      HeatmapCell[];
	todayIndex: number | undefined;
}

export function toMonthHeatmap(
	days: CalendarDay[],
	target: number,
	frequency: HabitFrequency,
	todayStr: string,
): MonthHeatmapData {
	const todayIdx = days.findIndex((d) => d.date === todayStr);
	return {
		cells: days.map((d) => ({
			level: dayToLevel(d.status, d.amount, target, frequency),
			date:  d.date,
		})),
		todayIndex: todayIdx >= 0 ? todayIdx : undefined,
	};
}

/**
Habit line view
**/
export function toHabitView(h: HabitTodayResponse): HabitView {
	const weeklyDayCount =
		h.scheduled_weekdays.length > 0
			? h.scheduled_weekdays.length
			: h.days_per_week ?? undefined;

	let weekDone: number | undefined;
	if (h.week_completed_days != null) {
		weekDone = h.week_completed_days;
	} else if (weeklyDayCount != null && h.target_per_period > 0) {
		weekDone = Math.min(
			Math.floor(h.current_period_count / h.target_per_period),
			weeklyDayCount,
		);
	}

	return {
		id:         h.id,
		name:       h.name,
		colorKey:   h.color_key ?? colorKeyFor(h.id),
		frequency:  h.frequency,
		mode:       h.mode,
		unit:       h.unit ?? '',
		done:       h.current_period_count,
		target:     h.target_per_period,
		streak:     0,
		section:    h.section ?? null,
		categoryId: h.category_id ?? null,
		perWeek:    weeklyDayCount,
		weekDone,
	};
}
