import { useRef, useEffect, useState } from 'react';
import {
	Animated,
	Dimensions,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import type { HabitSection } from '../../api/types';
import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

export interface DrawerFilters {
	timeOfDay: HabitSection | null;
	categoryId: string | null;
	routineId: string | null;
}

interface DrawerMenuProps {
	visible: boolean;
	onClose: () => void;
	filters: DrawerFilters;
	onFiltersChange: (f: DrawerFilters) => void;
	categories: { id: string; name: string }[];
	routines: { id: string; name: string }[];
	onAllHabits: () => void;
}

const TIME_OF_DAY: { key: HabitSection; label: string }[] = [
	{ key: 'MORNING',   label: 'Morning' },
	{ key: 'AFTERNOON', label: 'Afternoon' },
	{ key: 'EVENING',   label: 'Evening' },
];

export function DrawerMenu({
	visible,
	onClose,
	filters,
	onFiltersChange,
	categories,
	routines,
	onAllHabits,
}: DrawerMenuProps) {
	const { colors } = useTheme();
	const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['category', 'routine']));
	const toggle = (key: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key); else next.add(key);
			return next;
		});

	useEffect(() => {
		if (visible) {
			Animated.parallel([
				Animated.timing(slideAnim, {
					toValue: 0,
					duration: 250,
					useNativeDriver: true,
				}),
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 250,
					useNativeDriver: true,
				}),
			]).start();
		} else {
			slideAnim.setValue(-DRAWER_WIDTH);
			fadeAnim.setValue(0);
		}
	}, [visible, slideAnim, fadeAnim]);

	const animateClose = () => {
		Animated.parallel([
			Animated.timing(slideAnim, {
				toValue: -DRAWER_WIDTH,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => onClose());
	};

	const pickTimeOfDay = (key: HabitSection | null) => {
		onFiltersChange({ ...filters, timeOfDay: key });
		animateClose();
	};

	const pickCategory = (id: string | null) => {
		onFiltersChange({ ...filters, categoryId: id });
		animateClose();
	};

	const pickRoutine = (id: string | null) => {
		onFiltersChange({ ...filters, routineId: id });
		animateClose();
	};

	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
			<View style={styles.container}>
				<Animated.View
					style={[styles.backdrop, { opacity: fadeAnim }]}
				>
					<Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
				</Animated.View>

				<Animated.View
					style={[
						styles.drawer,
						{ backgroundColor: colors.paper, transform: [{ translateX: slideAnim }] },
					]}
				>
					{/* Header */}
					<View style={[styles.header, { borderBottomColor: colors.line }]}>
						<Text style={[styles.headerTitle, { color: colors.ink }]}>Menu</Text>
						<Pressable onPress={animateClose} hitSlop={8}>
							<Icon name="close" size={20} color={colors.ink} />
						</Pressable>
					</View>

					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
						{/* Time of Day */}
						<CollapsibleSection
							label="Time of Day"
							isOpen={!collapsed.has('timeOfDay')}
							onToggle={() => toggle('timeOfDay')}
							colors={colors}
						>
							<RadioGroup
								options={[
									{ key: null, label: 'All' },
									...TIME_OF_DAY.map((t) => ({ key: t.key, label: t.label })),
								]}
								selected={filters.timeOfDay}
								onSelect={(k) => pickTimeOfDay(k as HabitSection | null)}
								colors={colors}
							/>
						</CollapsibleSection>

						<View style={[styles.divider, { backgroundColor: colors.line }]} />

						{/* Categories */}
						{categories.length > 0 && (
							<>
								<CollapsibleSection
									label="Category"
									isOpen={!collapsed.has('category')}
									onToggle={() => toggle('category')}
									colors={colors}
								>
									<RadioGroup
										options={[
											{ key: null, label: 'All' },
											...categories.map((c) => ({ key: c.id, label: c.name })),
										]}
										selected={filters.categoryId}
										onSelect={pickCategory}
										colors={colors}
									/>
								</CollapsibleSection>
								<View style={[styles.divider, { backgroundColor: colors.line }]} />
							</>
						)}

						{/* Routines */}
						{routines.length > 0 && (
							<>
								<CollapsibleSection
									label="Routine"
									isOpen={!collapsed.has('routine')}
									onToggle={() => toggle('routine')}
									colors={colors}
								>
									<RadioGroup
										options={[
											{ key: null, label: 'All' },
											...routines.map((r) => ({ key: r.id, label: r.name })),
										]}
										selected={filters.routineId}
										onSelect={pickRoutine}
										colors={colors}
									/>
								</CollapsibleSection>
								<View style={[styles.divider, { backgroundColor: colors.line }]} />
							</>
						)}

						{/* All Habits */}
						<Pressable
							style={({ pressed }) => [
								styles.menuRow,
								pressed && { backgroundColor: colors.chip },
							]}
							onPress={() => {
								animateClose();
								setTimeout(onAllHabits, 220);
							}}
						>
							<Icon name="list" size={18} color={colors.ink} strokeWidth={1.8} />
							<Text style={[styles.menuRowLabel, { color: colors.ink }]}>All Habits</Text>
							<Icon name="right" size={16} color={colors.muted} />
						</Pressable>
					</ScrollView>
				</Animated.View>
			</View>
		</Modal>
	);
}

function CollapsibleSection({
	label, isOpen, onToggle, colors, children,
}: {
	label: string; isOpen: boolean; onToggle: () => void;
	colors: any; children: React.ReactNode;
}) {
	return (
		<View>
			<Pressable style={styles.sectionHeader} onPress={onToggle}>
				<Text style={[styles.sectionTitle, { color: colors.muted }]}>{label}</Text>
				<Icon
					name={isOpen ? 'chevron' : 'right'}
					size={14}
					color={colors.muted}
				/>
			</Pressable>
			{isOpen && children}
		</View>
	);
}

function RadioGroup({
	options,
	selected,
	onSelect,
	colors,
}: {
	options: { key: string | null; label: string }[];
	selected: string | null;
	onSelect: (key: string | null) => void;
	colors: any;
}) {
	return (
		<View style={styles.radioGroup}>
			{options.map((opt) => {
				const isSelected = opt.key === selected;
				return (
					<Pressable
						key={opt.key ?? '__all__'}
						style={[
							styles.radioRow,
							isSelected && { backgroundColor: colors.chip },
						]}
						onPress={() => onSelect(opt.key)}
					>
						<View
							style={[
								styles.radioOuter,
								{ borderColor: isSelected ? colors.accent : colors.line },
							]}
						>
							{isSelected && (
								<View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
							)}
						</View>
						<Text
							style={[
								styles.radioLabel,
								{ color: colors.ink },
								isSelected && { fontFamily: FONTS.display.medium },
							]}
						>
							{opt.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: 'row',
	},
	backdrop: {
		position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	drawer: {
		width: DRAWER_WIDTH,
		height: '100%',
		shadowColor: '#000',
		shadowOpacity: 0.2,
		shadowRadius: 16,
		shadowOffset: { width: 4, height: 0 },
		elevation: 16,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingTop: 60,
		paddingBottom: 16,
		borderBottomWidth: 1,
	},
	headerTitle: {
		fontFamily: FONTS.display.semibold,
		fontSize: 20,
		letterSpacing: -0.3,
	},
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: 40 },
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 8,
	},
	sectionTitle: {
		fontFamily: FONTS.body.medium,
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
	},
	radioGroup: {
		paddingHorizontal: 12,
	},
	radioRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 11,
		paddingHorizontal: 8,
		borderRadius: RADII.default,
	},
	radioOuter: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
	},
	radioInner: {
		width: 9,
		height: 9,
		borderRadius: 4.5,
	},
	radioLabel: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
	divider: {
		height: 1,
		marginHorizontal: 20,
		marginVertical: 8,
	},
	menuRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
		marginHorizontal: 8,
		borderRadius: RADII.default,
	},
	menuRowLabel: {
		flex: 1,
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
});
