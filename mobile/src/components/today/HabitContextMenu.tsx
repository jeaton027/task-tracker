import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../ui/Icon';
import { FONTS, RADII, useTheme } from '../../theme';

interface HabitContextMenuProps {
	visible:    boolean;
	habitName:  string;
	onEdit:     () => void;
	onReorder:  () => void;
	onDelete:   () => void;
	onClose:    () => void;
}

export function HabitContextMenu({
	visible, habitName, onEdit, onReorder, onDelete, onClose,
}: HabitContextMenuProps) {
	const { colors } = useTheme();
	const [confirming, setConfirming] = useState(false);

	const handleClose = () => {
		setConfirming(false);
		onClose();
	};

	const handleDeleteTap = () => setConfirming(true);

	const handleConfirmDelete = () => {
		setConfirming(false);
		onDelete();
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleClose}
		>
			<Pressable style={styles.backdrop} onPress={handleClose}>
				<View style={[styles.sheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
					{confirming ? (
						<>
							<Text style={[styles.confirmTitle, { color: colors.ink }]}>
								Delete Habit?
							</Text>
							<Text style={[styles.confirmBody, { color: colors.muted }]}>
								This action is permanent. All previous associated data will be erased as well.
							</Text>
							<View style={styles.confirmActions}>
								<Pressable
									style={[styles.confirmBtn, { backgroundColor: colors.chip }]}
									onPress={handleClose}
								>
									<Text style={[styles.confirmBtnText, { color: colors.ink }]}>
										Cancel
									</Text>
								</Pressable>
								<Pressable
									style={[styles.confirmBtn, { backgroundColor: '#D94040' }]}
									onPress={handleConfirmDelete}
								>
									<Text style={[styles.confirmBtnText, { color: '#fff' }]}>
										Delete
									</Text>
								</Pressable>
							</View>
						</>
					) : (
						<>
							<Text style={[styles.menuTitle, { color: colors.muted }]} numberOfLines={1}>
								{habitName}
							</Text>
							<MenuItem
								icon="edit"
								label="Edit"
								onPress={onEdit}
							/>
							<MenuItem
								icon="reorder"
								label="Reorder"
								onPress={onReorder}
								disabled
							/>
							<View style={[styles.separator, { backgroundColor: colors.line }]} />
							<MenuItem
								icon="trash"
								label="Delete"
								onPress={handleDeleteTap}
								destructive
							/>
						</>
					)}
				</View>
			</Pressable>
		</Modal>
	);
}

function MenuItem({
	icon, label, onPress, destructive, disabled,
}: {
	icon: 'edit' | 'reorder' | 'trash';
	label: string;
	onPress: () => void;
	destructive?: boolean;
	disabled?: boolean;
}) {
	const { colors } = useTheme();
	const textColor = destructive ? '#D94040' : disabled ? colors.muted : colors.ink;
	const iconColor = destructive ? '#D94040' : disabled ? colors.muted : colors.ink;

	return (
		<Pressable
			style={({ pressed }) => [
				styles.menuItem,
				pressed && !disabled && { backgroundColor: colors.chip },
			]}
			onPress={disabled ? undefined : onPress}
			disabled={disabled}
		>
			<Icon name={icon} size={18} color={iconColor} strokeWidth={1.8} />
			<Text style={[styles.menuItemLabel, { color: textColor }]}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	sheet: {
		width: 260,
		borderRadius: RADII.default,
		paddingVertical: 8,
		shadowColor: '#000',
		shadowOpacity: 0.15,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 8,
	},
	menuTitle: {
		fontFamily: FONTS.body.regular,
		fontSize: 12,
		paddingHorizontal: 16,
		paddingVertical: 6,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	menuItemLabel: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
	separator: {
		height: 1,
		marginHorizontal: 16,
		marginVertical: 4,
	},
	confirmTitle: {
		fontFamily: FONTS.display.regular,
		fontSize: 17,
		textAlign: 'center',
		paddingTop: 16,
		paddingBottom: 8,
	},
	confirmBody: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		textAlign: 'center',
		paddingHorizontal: 24,
		paddingBottom: 20,
		lineHeight: 18,
	},
	confirmActions: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	confirmBtn: {
		flex: 1,
		paddingVertical: 11,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	confirmBtnText: {
		fontFamily: FONTS.display.regular,
		fontSize: 15,
	},
});
