/**
 * Friendly aliases for the generated OpenAPI types.
 *
 * The generated schema lives in `./schema.ts` and is regenerated with:
 *   npm run gen:api    (or: npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.ts)
 *
 * Import these aliases throughout the app instead of poking into
 * `components['schemas']['...']` everywhere.
 */
import type { components } from './schema';

type S = components['schemas'];

// auth
export type TokenResponse  = S['TokenResponse'];
export type UserResponse   = S['UserResponse'];

// habits
export type HabitCreate         = S['HabitCreate'];
export type HabitUpdate         = S['HabitUpdate'];
export type HabitResponse       = S['HabitResponse'];
export type HabitTodayResponse  = S['HabitTodayResponse'];
export type TodayResponse       = S['TodayResponse'];
export type TodaySection        = S['TodaySection'];
export type HabitStatus         = S['HabitStatus'];
export type HabitMode           = S['HabitMode'];
export type HabitSection        = S['HabitSection'];
export type HabitFrequency      = S['HabitFrequency'];

// categories
export type CategoryResponse    = S['CategoryResponse'];

// logs
export type HabitLogCreate    = S['HabitLogCreate'];
export type HabitLogResponse  = S['HabitLogResponse'];

// routines
export type RoutineCreate          = S['RoutineCreate'];
export type RoutineUpdate          = S['RoutineUpdate'];
export type RoutineResponse        = S['RoutineResponse'];
export type RoutineTodayResponse   = S['RoutineTodayResponse'];
export type RoutineHabitSlotInput  = S['RoutineHabitSlotInput'];
export type RoutineHabitSlotResponse = S['RoutineHabitSlotResponse'];

// stats
export type HabitStatsResponse      = S['HabitStatsResponse'];
export type StreakInfo               = S['StreakInfo'];
export type PeriodStats             = S['PeriodStats'];
export type AggregateStatsResponse  = S['AggregateStatsResponse'];
export type HabitSummary            = S['HabitSummary'];
export type TrendPoint              = S['TrendPoint'];
export type TrendsResponse          = S['TrendsResponse'];

// vacations
export type VacationCreate    = S['VacationCreate'];
export type VacationResponse  = S['VacationResponse'];
export type VacationUpdate    = S['VacationUpdate'];

// integrations
export interface IntegrationConfig {
	source?: string;
	match_mode: 'ANY' | 'SPECIFIC';
	workout_ids: string[];
	category_ids: string[];
	collection_ids: string[];
}

export interface IntegrationResponse {
	id: string;
	habit_id: string;
	source: string;
	match_mode: 'ANY' | 'SPECIFIC';
	workout_ids: string[];
	category_ids: string[];
	collection_ids: string[];
}

export interface IntegrationKeyResponse {
	id: string;
	label: string;
	created_at: string;
	key?: string | null;
}

// calendar
export type CalendarDay              = S['CalendarDay'];
export type WeeklyCalendarItem       = S['WeeklyCalendarItem'];
export type MonthlyCalendarResponse  = S['MonthlyCalendarResponse'];
export type MonthlySummary           = S['MonthlySummary'];
export type YearlyCalendarItem       = S['YearlyCalendarItem'];
