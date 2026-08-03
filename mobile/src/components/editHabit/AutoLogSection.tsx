import { useState } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';

import { useIntegration, useRemoveIntegration, useSetIntegration } from '../../api/queries';
import type { IntegrationConfig } from '../../api/types';
import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

const REPCUE_CATEGORIES = [
	{ id: 'run',      label: 'Run' },
	{ id: 'bike',     label: 'Bike' },
	{ id: 'stretch',  label: 'Stretch' },
	{ id: 'pt',       label: 'PT' },
	{ id: 'strength', label: 'Strength' },
	{ id: 'yoga',     label: 'Yoga' },
];

interface Props {
	habitId: string | null;
}

export function AutoLogSection({ habitId }: Props) {
	const { colors } = useTheme();
	const integrationQ = useIntegration(habitId);
	const setIntegration = useSetIntegration();
	const removeIntegration = useRemoveIntegration();
	const [pickerOpen, setPickerOpen] = useState(false);

	const integration = integrationQ.data;
	const isConnected = integration != null;
	const matchMode = integration?.match_mode ?? null;

	const summary = (() => {
		if (!isConnected) return 'Not connected';
		if (matchMode === 'ANY') return 'Any workout';
		const parts: string[] = [];
		if (integration.category_ids.length > 0) {
			const labels = integration.category_ids
				.map((id) => REPCUE_CATEGORIES.find((c) => c.id === id)?.label ?? id)
				.join(', ');
			parts.push(labels);
		}
		if (integration.workout_ids.length > 0) {
			parts.push(`${integration.workout_ids.length} workout${integration.workout_ids.length > 1 ? 's' : ''}`);
		}
		if (integration.collection_ids.length > 0) {
			parts.push(`${integration.collection_ids.length} collection${integration.collection_ids.length > 1 ? 's' : ''}`);
		}
		return parts.length > 0 ? parts.join(', ') : 'Configured';
	})();

	const handleSetAny = () => {
		if (!habitId) return;
		setIntegration.mutate({
			habitId,
			config: {
				match_mode: 'ANY',
				workout_ids: [],
				category_ids: [],
				collection_ids: [],
			},
		});
		setPickerOpen(false);
	};

	const handleRemove = () => {
		if (!habitId) return;
		removeIntegration.mutate(habitId);
		setPickerOpen(false);
	};

	const toggleCategory = (catId: string) => {
		if (!habitId) return;
		const current = integration?.category_ids ?? [];
		const next = current.includes(catId)
			? current.filter((c) => c !== catId)
			: [...current, catId];

		if (next.length === 0 && (integration?.workout_ids.length ?? 0) === 0 && (integration?.collection_ids.length ?? 0) === 0) {
			removeIntegration.mutate(habitId);
			return;
		}

		setIntegration.mutate({
			habitId,
			config: {
				match_mode: 'SPECIFIC',
				workout_ids: integration?.workout_ids ?? [],
				category_ids: next,
				collection_ids: integration?.collection_ids ?? [],
			},
		});
	};

	return (
		<>
			<Pressable
				style={[styles.row, { borderBottomColor: colors.line }]}
				onPress={() => setPickerOpen(true)}
			>
				<View style={{ flex: 1 }}>
					<Text style={[styles.label, { color: colors.ink }]}>Auto-log from RepCue</Text>
					<Text style={[styles.sub, { color: colors.muted }]}>{summary}</Text>
				</View>
				<Icon name="right" size={16} color={colors.muted} />
			</Pressable>

			<Modal
				visible={pickerOpen}
				transparent
				animationType="slide"
				onRequestClose={() => setPickerOpen(false)}
			>
				<View style={styles.backdrop}>
					<Pressable style={styles.backdropTap} onPress={() => setPickerOpen(false)} />
					<View style={[styles.sheet, { backgroundColor: colors.card }]}>
						<View style={styles.sheetHandle}>
							<View style={[styles.handle, { backgroundColor: colors.muted }]} />
						</View>
						<Text style={[styles.sheetTitle, { color: colors.ink }]}>
							Auto-log trigger
						</Text>
						<Text style={[styles.sheetSub, { color: colors.muted }]}>
							Log this habit when a RepCue workout completes
						</Text>

						<ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
							{/* Any workout option */}
							<Pressable
								style={[styles.option, { borderBottomColor: colors.line }]}
								onPress={handleSetAny}
							>
								<Text style={[styles.optionLabel, { color: colors.ink }]}>Any workout</Text>
								{matchMode === 'ANY' && (
									<Icon name="check" size={18} color={colors.accent} />
								)}
							</Pressable>

							{/* Category section */}
							<Text style={[styles.sectionHeader, { color: colors.muted }]}>
								Categories
							</Text>
							{REPCUE_CATEGORIES.map((cat) => {
								const selected = matchMode === 'SPECIFIC' && (integration?.category_ids ?? []).includes(cat.id);
								return (
									<Pressable
										key={cat.id}
										style={[styles.option, { borderBottomColor: colors.line }]}
										onPress={() => toggleCategory(cat.id)}
									>
										<Text style={[styles.optionLabel, { color: colors.ink }]}>{cat.label}</Text>
										{selected && (
											<Icon name="check" size={18} color={colors.accent} />
										)}
									</Pressable>
								);
							})}

							{/* Disconnect option */}
							{isConnected && (
								<Pressable
									style={[styles.disconnectBtn, { borderColor: colors.line }]}
									onPress={handleRemove}
								>
									<Text style={[styles.disconnectText, { color: '#D94040' }]}>
										Disconnect
									</Text>
								</Pressable>
							)}
						</ScrollView>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 18,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	label: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
		letterSpacing: -0.2,
	},
	sub: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		marginTop: 2,
	},

	backdrop: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	backdropTap: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
	},
	sheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		maxHeight: '70%',
		paddingBottom: 32,
	},
	sheetHandle: {
		alignItems: 'center',
		paddingTop: 10,
		paddingBottom: 6,
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		opacity: 0.4,
	},
	sheetTitle: {
		fontFamily: FONTS.display.semibold,
		fontSize: 17,
		paddingHorizontal: 18,
		paddingTop: 8,
	},
	sheetSub: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		paddingHorizontal: 18,
		paddingTop: 4,
		paddingBottom: 12,
	},
	sheetScroll: {
		paddingHorizontal: 18,
	},
	sectionHeader: {
		fontFamily: FONTS.body.semibold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginTop: 16,
		marginBottom: 6,
	},
	option: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 13,
		borderBottomWidth: 1,
	},
	optionLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	disconnectBtn: {
		marginTop: 20,
		paddingVertical: 12,
		borderWidth: 1,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	disconnectText: {
		fontFamily: FONTS.display.regular,
		fontSize: 14,
	},
});
