/**
 * React Query hooks — the single place screens get data from. Caching,
 * refetching, and mutation invalidation all live here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { calendar, categories, habits, integrations, routines, stats, vacations, type TodayScope } from './endpoints';
import { refreshHomeScreenWidgets } from '../widgets/refresh';
import type {
	AggregateStatsResponse,
	HabitCreate,
	HabitLogCreate,
	HabitStatsResponse,
	HabitUpdate,
	IntegrationConfig,
	IntegrationKeyResponse,
	IntegrationResponse,
	MonthlyCalendarResponse,
	RoutineCreate,
	RoutineUpdate,
	TrendsResponse,
	VacationCreate,
	WeeklyCalendarItem,
	YearlyCalendarItem,
} from './types';

export const queryKeys = {
	today:      (date?: string, scope?: string) => ['today', date ?? 'now', scope ?? 'today'] as const,
	weekly:     (date?: string) => ['calendar', 'weekly', date ?? 'now'] as const,
	yearly:     (year: number)  => ['calendar', 'yearly', year] as const,
	categories: () => ['categories'] as const,
	routines:   () => ['routines'] as const,
	vacations:  () => ['vacations'] as const,
};

/** GET /habits/today */
export function useToday(date?: string, hour?: number, scope?: TodayScope) {
	return useQuery({
		queryKey: queryKeys.today(date, scope),
		queryFn:  () => habits.today(date, hour, scope),
		staleTime: 1000 * 30,	// 30s — re-fetch on next mount/focus after that
	});
}

/** GET /calendar/weekly */
export function useWeeklyCalendar(date: string | undefined) {
	return useQuery({
		queryKey: queryKeys.weekly(date),
		queryFn:  () => calendar.weekly(date),
		enabled:  date != null,
		staleTime: 1000 * 30,
	});
}

/** GET /calendar/yearly */
export function useYearlyCalendar(year: number | undefined) {
	return useQuery({
		queryKey: ['calendar', 'yearly', year] as const,
		queryFn:  () => calendar.yearly(year!),
		enabled:  year != null,
		staleTime: 1000 * 60,
	});
}

/** POST /habits/{id}/log */
export function useLogHabit() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ habitId, body }: { habitId: string; body?: HabitLogCreate }) =>
			habits.log(habitId, body),

		// Bump the count in the cache BEFORE the network call returns
		onMutate: async ({ habitId }) => {
			await qc.cancelQueries({ queryKey: ['today'] });
			await qc.cancelQueries({ queryKey: ['calendar'] });

			const prevToday = qc.getQueriesData({ queryKey: ['today'] });

			// Optimistic update: every cached today/tab variant
			qc.setQueriesData({ queryKey: ['today'] }, (old: any) => {
				if (!old) return old;
				const sectionKeys = ['daily', 'weekly', 'monthly', 'yearly', 'interval'];
				const next = { ...old };
				for (const key of sectionKeys) {
					const section = next[key];
					if (!section?.habits) continue;
					next[key] = {
						...section,
						habits: section.habits.map((h: any) => {
							if (h.id !== habitId) return h;
							const newCount = h.current_period_count + 1;
							const updated: any = { ...h, current_period_count: newCount };
							if (h.week_completed_days != null && newCount >= h.target_per_period) {
								updated.week_completed_days = h.week_completed_days + 1;
							}
							return updated;
						}),
					};
				}
				return next;
			});

			const now = new Date();
			const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

			const bumpDay = (days: any[], increment: number) =>
				days.map((d: any) =>
					d.date === todayISO ? { ...d, amount: d.amount + increment } : d,
				);

			// Weekly caches
			qc.setQueriesData<WeeklyCalendarItem[]>(
				{ queryKey: ['calendar', 'weekly'] },
				(old) => old?.map((item) =>
					item.habit.id === habitId
						? { ...item, days: bumpDay(item.days, item.habit.increment) }
						: item,
				),
			);

			// Yearly caches
			qc.setQueriesData<YearlyCalendarItem[]>(
				{ queryKey: ['calendar', 'yearly'] },
				(old) => old?.map((item) =>
					item.habit.id === habitId
						? { ...item, days: bumpDay(item.days, item.habit.increment) }
						: item,
				),
			);

			// Monthly caches (per-habit, so only update matching habit)
			qc.getQueriesData<MonthlyCalendarResponse>({ queryKey: ['calendar', 'monthly'] })
				.forEach(([key, data]) => {
					if (!data || data.habit.id !== habitId) return;
					qc.setQueryData(key, {
						...data,
						days: bumpDay(data.days, data.habit.increment),
					});
				});

			return { prevToday };
		},

		// POST failed — restore the pre-mutation caches
		onError: (_err, _vars, context) => {
			for (const [key, data] of context?.prevToday ?? []) {
				qc.setQueryData(key, data);
			}
			// Calendar caches: just refetch — simpler than tracking every key
			qc.invalidateQueries({ queryKey: ['calendar'] });
		},

		// Always refetch at the end to make sure we converge with the server
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ['today'] });
			qc.invalidateQueries({ queryKey: ['calendar'] });
			refreshHomeScreenWidgets();
		},
	});
}

/** DELETE /habits/{id} */
export function useDeleteHabit() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (habitId: string) => habits.delete(habitId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['today'] });
			qc.invalidateQueries({ queryKey: ['calendar'] });
			qc.invalidateQueries({ queryKey: ['habits'] });
		},
	});
}

/** DELETE /habits/{id}/log */
export function useUnlogHabit() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ habitId, date }: { habitId: string; date?: string }) =>
			habits.unlog(habitId, date),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['today'] });
			qc.invalidateQueries({ queryKey: ['calendar'] });
			refreshHomeScreenWidgets();
		},
	});
}

/** GET /categories — cached forever-ish since seeded categories rarely change. */
export function useCategories() {
	return useQuery({
		queryKey: queryKeys.categories(),
		queryFn:  categories.list,
		staleTime: 1000 * 60 * 5,	// 5 min
	});
}

/** POST /categories — inline-create from the New Habit form. */
export function useCreateCategory() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => categories.create(name),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.categories() });
		},
	});
}

/** GET /routines — user's routines, used by the New Habit picker. */
export function useRoutines() {
	return useQuery({
		queryKey: queryKeys.routines(),
		queryFn:  routines.list,
		staleTime: 1000 * 30,
	});
}

/** POST /routines — inline-create from the New Habit form. */
export function useCreateRoutine() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: RoutineCreate) => routines.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.routines() });
		},
	});
}

/** GET /routines/{id} */
export function useRoutine(routineId: string | null) {
	return useQuery({
		queryKey: ['routine', routineId] as const,
		queryFn:  () => routines.get(routineId!),
		enabled:  routineId != null,
	});
}

/** PATCH /routines/{id} */
export function useUpdateRoutine() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: RoutineUpdate }) =>
			routines.update(id, body),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: queryKeys.routines() });
			qc.invalidateQueries({ queryKey: ['routine', id] });
			qc.invalidateQueries({ queryKey: ['today'] });
		},
	});
}

/** GET /habits — all habits for the current user. */
export function useAllHabits() {
	return useQuery({
		queryKey: ['habits'] as const,
		queryFn:  () => habits.list(),
		staleTime: 1000 * 30,
	});
}

/** GET /habits/{id}/stats */
export function useHabitStats(habitId: string | null) {
	return useQuery({
		queryKey: ['habit', habitId, 'stats'] as const,
		queryFn:  () => habits.stats(habitId!),
		enabled:  habitId != null,
		staleTime: 1000 * 30,
	});
}

/** GET /habits/{id} */
export function useHabit(habitId: string | null) {
	return useQuery({
		queryKey: ['habit', habitId] as const,
		queryFn:  () => habits.get(habitId!),
		enabled:  habitId != null,
	});
}

/** PATCH /habits/{id} */
export function useUpdateHabit() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ habitId, body }: { habitId: string; body: HabitUpdate }) =>
			habits.update(habitId, body),
		onSuccess: (_data, { habitId }) => {
			qc.invalidateQueries({ queryKey: ['today'] });
			qc.invalidateQueries({ queryKey: ['calendar'] });
			qc.invalidateQueries({ queryKey: ['habit', habitId] });
			qc.invalidateQueries({ queryKey: ['habits'] });
			qc.invalidateQueries({ queryKey: queryKeys.routines() });
		},
	});
}

/** GET /stats/overview */
export function useStatsOverview(start?: string, end?: string) {
	return useQuery({
		queryKey: ['stats', 'overview', start, end] as const,
		queryFn: () => stats.overview(start, end),
		staleTime: 1000 * 30,
	});
}

/** GET /stats/trends */
export function useStatsTrends(start?: string, end?: string, habitIds?: string[]) {
	return useQuery({
		queryKey: ['stats', 'trends', start, end, habitIds] as const,
		queryFn: () => stats.trends(start, end, habitIds),
		staleTime: 1000 * 30,
	});
}

/** POST /habits */
export function useCreateHabit() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: HabitCreate) => habits.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['today'] });
			qc.invalidateQueries({ queryKey: ['habits'] });
			qc.invalidateQueries({ queryKey: queryKeys.routines() });
			qc.invalidateQueries({ queryKey: ['routine'] });
		},
	});
}

/** PATCH /categories/{id} */
export function useUpdateCategory() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			categories.update(id, name),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.categories() });
		},
	});
}

/** DELETE /categories/{id} */
export function useDeleteCategory() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => categories.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.categories() });
			qc.invalidateQueries({ queryKey: ['today'] });
		},
	});
}

/** DELETE /routines/{id} */
export function useDeleteRoutine() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => routines.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.routines() });
			qc.invalidateQueries({ queryKey: ['today'] });
		},
	});
}

/** GET /vacations */
export function useVacations() {
	return useQuery({
		queryKey: queryKeys.vacations(),
		queryFn:  vacations.list,
		staleTime: 1000 * 60,
	});
}

/** POST /vacations */
export function useCreateVacation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: VacationCreate) => vacations.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.vacations() });
			qc.invalidateQueries({ queryKey: ['today'] });
		},
	});
}

/** DELETE /vacations/{id} */
export function useDeleteVacation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => vacations.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.vacations() });
			qc.invalidateQueries({ queryKey: ['today'] });
		},
	});
}

/** GET /integrations/{habitId} */
export function useIntegration(habitId: string | null) {
	return useQuery({
		queryKey: ['integration', habitId] as const,
		queryFn: () => integrations.get(habitId!),
		enabled: habitId != null,
		staleTime: 1000 * 60,
	});
}

/** PUT /integrations/{habitId} */
export function useSetIntegration() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ habitId, config }: { habitId: string; config: IntegrationConfig }) =>
			integrations.set(habitId, config),
		onSuccess: (_data, { habitId }) => {
			qc.invalidateQueries({ queryKey: ['integration', habitId] });
		},
	});
}

/** DELETE /integrations/{habitId} */
export function useRemoveIntegration() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (habitId: string) => integrations.remove(habitId),
		onSuccess: (_data, habitId) => {
			qc.invalidateQueries({ queryKey: ['integration', habitId] });
		},
	});
}

/** GET /integrations/keys/current */
export function useIntegrationKey() {
	return useQuery({
		queryKey: ['integration-key'] as const,
		queryFn: () => integrations.getCurrentKey(),
		staleTime: 1000 * 60,
	});
}

/** POST /integrations/keys */
export function useCreateIntegrationKey() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => integrations.createKey(),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['integration-key'] });
		},
	});
}

/** DELETE /integrations/keys */
export function useRevokeIntegrationKey() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => integrations.revokeKey(),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['integration-key'] });
		},
	});
}
