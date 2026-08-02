import { useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAllHabits } from '../api/queries';
import type { HabitResponse } from '../api/types';
import { Icon } from '../components/ui/Icon';
import { EditHabitScreen } from './EditHabitScreen';
import { FONTS, RADII, paletteMap, useTheme } from '../theme';

interface AllHabitsScreenProps {
	visible: boolean;
	onClose: () => void;
}

type StatusTab = 'active' | 'paused' | 'archived';

function classifyHabit(h: HabitResponse): StatusTab {
	if (h.is_archived) return 'archived';
	if (!h.is_active) return 'paused';
	return 'active';
}

export function AllHabitsScreen({ visible, onClose }: AllHabitsScreenProps) {
	const { colors } = useTheme();
	const habitsQ = useAllHabits();
	const [tab, setTab] = useState<StatusTab>('active');
	const [editHabitId, setEditHabitId] = useState<string | null>(null);

	const hexMap = useMemo(() => paletteMap('earthy'), []);

	const grouped = useMemo(() => {
		const all = habitsQ.data ?? [];
		return {
			active:   all.filter((h) => classifyHabit(h) === 'active'),
			paused:   all.filter((h) => classifyHabit(h) === 'paused'),
			archived: all.filter((h) => classifyHabit(h) === 'archived'),
		};
	}, [habitsQ.data]);

	const habits = grouped[tab];

	const tabs: { key: StatusTab; label: string; count: number }[] = [
		{ key: 'active',   label: 'Active',   count: grouped.active.length },
		{ key: 'paused',   label: 'Paused',   count: grouped.paused.length },
		{ key: 'archived', label: 'Archived', count: grouped.archived.length },
	];

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
				{/* Header */}
				<View style={[styles.header, { borderBottomColor: colors.line }]}>
					<Pressable
						onPress={onClose}
						style={[styles.backBtn, { backgroundColor: colors.chip, borderColor: colors.line }]}
					>
						<Icon name="left" size={19} color={colors.ink} />
					</Pressable>
					<Text style={[styles.title, { color: colors.ink }]}>All Habits</Text>
					<View style={styles.backBtn} />
				</View>

				{/* Tabs */}
				<View style={[styles.tabRow, { borderBottomColor: colors.line }]}>
					{tabs.map((t) => {
						const active = t.key === tab;
						return (
							<Pressable
								key={t.key}
								style={[styles.tab, active && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
								onPress={() => setTab(t.key)}
							>
								<Text
									style={[
										styles.tabLabel,
										{ color: active ? colors.ink : colors.muted },
										active && { fontFamily: FONTS.display.medium },
									]}
								>
									{t.label}
								</Text>
								<Text style={[styles.tabCount, { color: colors.muted }]}>{t.count}</Text>
							</Pressable>
						);
					})}
				</View>

				{/* Content */}
				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					{habitsQ.isLoading && (
						<View style={styles.center}>
							<ActivityIndicator color={colors.ink} />
						</View>
					)}

					{!habitsQ.isLoading && habits.length === 0 && (
						<View style={styles.center}>
							<Text style={[styles.emptyText, { color: colors.muted }]}>
								{tab === 'active' && 'No active habits.'}
								{tab === 'paused' && 'No paused habits.'}
								{tab === 'archived' && 'No archived habits.'}
							</Text>
						</View>
					)}

					{habits.map((habit) => {
						const hex = habit.color_key ? hexMap[habit.color_key] : colors.muted;
						return (
							<Pressable
								key={habit.id}
								style={({ pressed }) => [
									styles.habitRow,
									{ borderBottomColor: colors.line },
									pressed && { backgroundColor: colors.chip },
								]}
								onPress={() => setEditHabitId(habit.id)}
							>
								<View style={[styles.colorDot, { backgroundColor: hex }]} />
								<View style={styles.habitInfo}>
									<Text style={[styles.habitName, { color: colors.ink }]} numberOfLines={1}>
										{habit.name}
									</Text>
									<Text style={[styles.habitMeta, { color: colors.muted }]}>
										{habit.frequency.charAt(0) + habit.frequency.slice(1).toLowerCase()}
										{habit.unit ? ` · ${habit.unit}` : ''}
									</Text>
								</View>
								<Icon name="right" size={16} color={colors.muted} />
							</Pressable>
						);
					})}
				</ScrollView>

				<EditHabitScreen
					visible={editHabitId != null}
					habitId={editHabitId}
					onClose={() => setEditHabitId(null)}
				/>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingTop: 6,
		paddingBottom: 12,
		borderBottomWidth: 1,
	},
	backBtn: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderRadius: RADII.default,
		borderColor: 'transparent',
	},
	title: {
		flex: 1,
		textAlign: 'center',
		fontFamily: FONTS.display.regular,
		fontSize: 19,
		letterSpacing: -0.3,
	},
	tabRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
	},
	tab: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 12,
		borderBottomWidth: 2,
		borderBottomColor: 'transparent',
	},
	tabLabel: {
		fontFamily: FONTS.display.regular,
		fontSize: 14,
	},
	tabCount: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: 32 },
	center: {
		paddingVertical: 40,
		alignItems: 'center',
	},
	emptyText: {
		fontFamily: FONTS.body.regular,
		fontSize: 14,
	},
	habitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
	},
	colorDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	habitInfo: {
		flex: 1,
		gap: 2,
	},
	habitName: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
	habitMeta: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
	},
});
