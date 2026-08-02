/**
 * Date formatting + week-strip helpers.
 * All dates use the user's LOCAL timezone.
 */

// Canonical day arrays indexed 0=Sunday (JS Date.getDay() convention).
// All week-ordered output goes through rotateToWeekStart() so changing
// WEEK_START_DAY is the only edit needed when users pick their own start day.
const ALL_LABELS_SHORT = ['Su', 'M', 'T', 'W', 'Th', 'F', 'S'] as const;
const ALL_LABELS_3CHAR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEK_LABELS_FULL  = [
	'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

// 0=Sun, 1=Mon, … 6=Sat. Change this one value to shift all week displays.
export const WEEK_START_DAY = 1; // Monday

function rotateFrom<T>(arr: readonly T[], startIndex: number): T[] {
	return [...arr.slice(startIndex), ...arr.slice(0, startIndex)];
}

export const WEEK_LABELS_SHORT = rotateFrom(ALL_LABELS_SHORT, WEEK_START_DAY);
export const WEEK_LABELS_3CHAR = rotateFrom(ALL_LABELS_3CHAR, WEEK_START_DAY);

export const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Locale-aware integer formatting (e.g. 3,200). */
export function formatNumber(n: number): string {
	return n.toLocaleString();
}

export interface WeekStripCell {
	d:        string;	// 3-char weekday
	n:        number;	// day of month
	weekend?: boolean;
	today?:   boolean;
}

/**
 * 7-day strip for the week containing `target`, starting from WEEK_START_DAY.
 * Used by PeriodNav's Week view.
 */
export function currentWeekStrip(target: Date = new Date()): WeekStripCell[] {
	const jsDay = target.getDay(); // 0=Sun
	const offset = (jsDay - WEEK_START_DAY + 7) % 7;
	const weekStart = new Date(target);
	weekStart.setDate(target.getDate() - offset);
	weekStart.setHours(0, 0, 0, 0);

	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(weekStart);
		d.setDate(weekStart.getDate() + i);
		const canonDay = d.getDay(); // 0=Sun
		return {
			d:       ALL_LABELS_3CHAR[canonDay],
			n:       d.getDate(),
			weekend: canonDay === 0 || canonDay === 6,
			today:   d.getTime() === new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime(),
		};
	});
}

/** "Friday, June 5" */
export function formatTodayHeader(target: Date = new Date()): string {
	const day   = WEEK_LABELS_FULL[target.getDay()];
	const month = MONTH_NAMES[target.getMonth()];
	return `${day}, ${month} ${target.getDate()}`;
}

/** "June 2026" */
export function formatMonthYear(target: Date = new Date()): string {
	return `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
}

/** "2026" */
export function formatYear(target: Date = new Date()): string {
	return String(target.getFullYear());
}

/**
 * Column offset (0-6) for day 1 of the given month in a grid that
 * starts on WEEK_START_DAY. E.g. if weeks start Monday and the 1st
 * is a Wednesday, offset = 2.
 */
export function monthFirstDayOffset(year: number, monthIndex0: number): number {
	const jsDay = new Date(year, monthIndex0, 1).getDay();
	return (jsDay - WEEK_START_DAY + 7) % 7;
}

/** ISO date string YYYY-MM-DD for the Monday (or WEEK_START_DAY) of the week containing `target`. */
export function weekStartDate(target: Date = new Date()): string {
	const offset = (target.getDay() - WEEK_START_DAY + 7) % 7;
	const d = new Date(target);
	d.setDate(d.getDate() - offset);
	return isoDate(d);
}

export function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function isoMonth(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}
