/**
 * Typed endpoint functions. Components consume these via the React Query
 * hooks in ./queries.ts — don't call these directly from screens.
 */
import { apiFetch } from './client';
import type {
	AggregateStatsResponse,
	CategoryResponse,
	HabitCreate,
	HabitLogCreate,
	HabitLogResponse,
	HabitResponse,
	HabitStatsResponse,
	HabitUpdate,
	MonthlyCalendarResponse,
	RoutineCreate,
	RoutineResponse,
	RoutineUpdate,
	TodayResponse,
	TokenResponse,
	TrendsResponse,
	UserResponse,
	VacationCreate,
	VacationResponse,
	VacationUpdate,
	WeeklyCalendarItem,
	YearlyCalendarItem,
} from './types';

// ── Auth ────────────────────────────────────────────────────────────────

export const auth = {
	login: (email: string, password: string) =>
		apiFetch<TokenResponse>('/api/v1/auth/login', {
			method:   'POST',
			body:     { email, password },
			skipAuth: true,
		}),

	register: (email: string, password: string) =>
		apiFetch<UserResponse>('/api/v1/auth/register', {
			method:   'POST',
			body:     { email, password },
			skipAuth: true,
		}),

	me: () => apiFetch<UserResponse>('/api/v1/auth/me'),

	refresh: (refreshToken: string) =>
		apiFetch<TokenResponse>('/api/v1/auth/refresh', {
			method:   'POST',
			body:     { refresh_token: refreshToken },
			skipAuth: true,
		}),

	changePassword: (currentPassword: string, newPassword: string) =>
		apiFetch<void>('/api/v1/auth/change-password', {
			method: 'POST',
			body:   { current_password: currentPassword, new_password: newPassword },
		}),

	forgotPassword: (email: string) =>
		apiFetch<void>('/api/v1/auth/forgot-password', {
			method:   'POST',
			body:     { email },
			skipAuth: true,
		}),

	resetPassword: (token: string, newPassword: string) =>
		apiFetch<void>('/api/v1/auth/reset-password', {
			method:   'POST',
			body:     { token, new_password: newPassword },
			skipAuth: true,
		}),
};

// ── Habits ──────────────────────────────────────────────────────────────

export type TodayScope = 'today' | 'week' | 'month' | 'year';

export const habits = {
	today: (date?: string, hour?: number, scope?: TodayScope) =>
		apiFetch<TodayResponse>('/api/v1/habits/today', {
			query: { date, hour: hour != null ? String(hour) : undefined, scope },
		}),

	list: () =>
		apiFetch<HabitResponse[]>('/api/v1/habits'),

	get: (habitId: string) =>
		apiFetch<HabitResponse>(`/api/v1/habits/${habitId}`),

	create: (body: HabitCreate) =>
		apiFetch<HabitResponse>('/api/v1/habits', {
			method: 'POST',
			body,
		}),

	update: (habitId: string, body: HabitUpdate) =>
		apiFetch<HabitResponse>(`/api/v1/habits/${habitId}`, {
			method: 'PATCH',
			body,
		}),

	log: (habitId: string, body: HabitLogCreate = {}) =>
		apiFetch<HabitLogResponse>(`/api/v1/habits/${habitId}/log`, {
			method: 'POST',
			body,
		}),

	unlog: (habitId: string, date?: string) =>
		apiFetch<void>(`/api/v1/habits/${habitId}/log`, {
			method: 'DELETE',
			query:  { date },
		}),

	stats: (habitId: string) =>
		apiFetch<HabitStatsResponse>(`/api/v1/habits/${habitId}/stats`),

	delete: (habitId: string) =>
		apiFetch<void>(`/api/v1/habits/${habitId}`, {
			method: 'DELETE',
		}),
};

// ── Calendar ───────────────────────────────────────────────────────────

export const calendar = {
	weekly: (date?: string) =>
		apiFetch<WeeklyCalendarItem[]>('/api/v1/calendar/weekly', {
			query: { date },
		}),

	monthly: (habitId: string, month: string) =>
		apiFetch<MonthlyCalendarResponse>('/api/v1/calendar/monthly', {
			query: { habit_id: habitId, month },
		}),

	yearly: (year: number) =>
		apiFetch<YearlyCalendarItem[]>('/api/v1/calendar/yearly', {
			query: { year },
		}),
};

// ── Stats ──────────────────────────────────────────────────────────────

export const stats = {
	overview: (start?: string, end?: string) =>
		apiFetch<AggregateStatsResponse>('/api/v1/stats/overview', {
			query: { start, end },
		}),

	trends: (start?: string, end?: string, habitIds?: string[]) =>
		apiFetch<TrendsResponse>('/api/v1/stats/trends', {
			query: { start, end, habit_id: habitIds },
		}),
};

// ── Categories ──────────────────────────────────────────────────────────

export const categories = {
	list:   () => apiFetch<CategoryResponse[]>('/api/v1/categories'),
	create: (name: string) =>
		apiFetch<CategoryResponse>('/api/v1/categories', {
			method: 'POST',
			body:   { name },
		}),
	update: (id: string, name: string) =>
		apiFetch<CategoryResponse>(`/api/v1/categories/${id}`, {
			method: 'PATCH',
			body:   { name },
		}),
	delete: (id: string) =>
		apiFetch<void>(`/api/v1/categories/${id}`, { method: 'DELETE' }),
};

// ── Routines ────────────────────────────────────────────────────────────

export const routines = {
	list:   () => apiFetch<RoutineResponse[]>('/api/v1/routines'),
	get:    (id: string) => apiFetch<RoutineResponse>(`/api/v1/routines/${id}`),
	create: (body: RoutineCreate) =>
		apiFetch<RoutineResponse>('/api/v1/routines', {
			method: 'POST',
			body,
		}),
	update: (id: string, body: RoutineUpdate) =>
		apiFetch<RoutineResponse>(`/api/v1/routines/${id}`, {
			method: 'PATCH',
			body,
		}),
	delete: (id: string) =>
		apiFetch<void>(`/api/v1/routines/${id}`, { method: 'DELETE' }),
};

// ── Integrations ──────────────────────────────────────────────────────

import type { IntegrationConfig, IntegrationKeyResponse, IntegrationResponse } from './types';

export const integrations = {
	list: () =>
		apiFetch<IntegrationResponse[]>('/api/v1/integrations'),

	get: (habitId: string) =>
		apiFetch<IntegrationResponse | null>(`/api/v1/integrations/${habitId}`),

	set: (habitId: string, config: IntegrationConfig) =>
		apiFetch<IntegrationResponse>(`/api/v1/integrations/${habitId}`, {
			method: 'PUT',
			body: config,
		}),

	remove: (habitId: string) =>
		apiFetch<void>(`/api/v1/integrations/${habitId}`, {
			method: 'DELETE',
		}),

	getCurrentKey: () =>
		apiFetch<IntegrationKeyResponse | null>('/api/v1/integrations/keys/current'),

	createKey: () =>
		apiFetch<IntegrationKeyResponse>('/api/v1/integrations/keys', {
			method: 'POST',
		}),

	revokeKey: () =>
		apiFetch<void>('/api/v1/integrations/keys', {
			method: 'DELETE',
		}),
};

// ── Vacations ──────────────────────────────────────────────────────────

export const vacations = {
	list:   () => apiFetch<VacationResponse[]>('/api/v1/vacations'),
	create: (body: VacationCreate) =>
		apiFetch<VacationResponse>('/api/v1/vacations', {
			method: 'POST',
			body,
		}),
	update: (id: string, body: VacationUpdate) =>
		apiFetch<VacationResponse>(`/api/v1/vacations/${id}`, {
			method: 'PATCH',
			body,
		}),
	delete: (id: string) =>
		apiFetch<void>(`/api/v1/vacations/${id}`, { method: 'DELETE' }),
};
