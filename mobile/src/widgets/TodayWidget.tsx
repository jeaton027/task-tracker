import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetHabitRow } from './data';
import { WIDGET_COLORS, type WidgetTheme } from './widget-theme';

/**
 * "Daybook: Today" — scrollable list of habits with one-tap logging.
 *
 * Row tap opens the app; the circle button on the right logs the habit.
 * AVOID habits show their count but don't get a log button (an accidental
 * tap would record a slip) — tapping the row opens the app instead.
 */
export function TodayWidget({
	theme,
	data,
	dateLabel,
}: {
	theme: WidgetTheme;
	data: WidgetData;
	dateLabel: string;
}) {
	const c = WIDGET_COLORS[theme];

	return (
		<FlexWidget
			style={{
				width: 'match_parent',
				height: 'match_parent',
				backgroundColor: c.paper,
				borderRadius: 20,
				padding: 14,
				flexDirection: 'column',
			}}
			clickAction="OPEN_APP"
		>
			{/* Header */}
			<FlexWidget
				style={{
					width: 'match_parent',
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: 8,
				}}
			>
				<TextWidget
					text={dateLabel}
					style={{ fontSize: 14, fontWeight: '700', color: c.ink }}
				/>
				{data.state === 'ok' && data.totalCount > 0 && (
					<TextWidget
						text={`${data.doneCount}/${data.totalCount} done`}
						style={{ fontSize: 12, color: c.muted }}
					/>
				)}
			</FlexWidget>

			{data.state === 'ok' && data.rows.length > 0 && (
				<ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
					{data.rows.map((row) => (
						<HabitRow key={row.id} row={row} theme={theme} />
					))}
				</ListWidget>
			)}

			{data.state === 'ok' && data.rows.length === 0 && (
				<CenterMessage theme={theme} text="Nothing to show — enjoy the day" />
			)}
			{data.state === 'logged-out' && (
				<CenterMessage theme={theme} text="Signed out — tap to open Daybook" />
			)}
			{data.state === 'error' && (
				<CenterMessage theme={theme} text="Couldn't reach Daybook — tap to open" />
			)}
		</FlexWidget>
	);
}

function HabitRow({ row, theme }: { row: WidgetHabitRow; theme: WidgetTheme }) {
	const c = WIDGET_COLORS[theme];
	const showButton = row.mode === 'DO';

	return (
		<FlexWidget
			style={{
				width: 'match_parent',
				height: 44,
				flexDirection: 'row',
				alignItems: 'center',
			}}
			clickAction="OPEN_APP"
		>
			{/* Color dot */}
			<FlexWidget
				style={{
					width: 10,
					height: 10,
					borderRadius: 3,
					backgroundColor: row.colorHex as `#${string}`,
					marginRight: 10,
				}}
			/>
			{/* Name */}
			<FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
				<TextWidget
					text={row.name}
					truncate="END"
					maxLines={1}
					style={{
						fontSize: 14,
						color: row.completed && row.mode === 'DO' ? c.muted : c.ink,
					}}
				/>
			</FlexWidget>
			{/* Count */}
			<TextWidget
				text={`${Math.round(row.done)}/${row.target}`}
				style={{ fontSize: 12, color: c.muted, marginRight: 10 }}
			/>
			{/* Log button (DO only) */}
			{showButton && (
				<FlexWidget
					style={{
						width: 30,
						height: 30,
						borderRadius: 15,
						borderWidth: 2,
						borderColor: row.colorHex as `#${string}`,
						backgroundColor: row.completed
							? (row.colorHex as `#${string}`)
							: 'rgba(0, 0, 0, 0)',
						alignItems: 'center',
						justifyContent: 'center',
					}}
					clickAction="LOG_HABIT"
					clickActionData={{ habitId: row.id }}
				>
					<TextWidget
						text="✓"
						style={{
							fontSize: 15,
							fontWeight: '700',
							color: row.completed ? c.paper : (row.colorHex as `#${string}`),
						}}
					/>
				</FlexWidget>
			)}
		</FlexWidget>
	);
}

function CenterMessage({ theme, text }: { theme: WidgetTheme; text: string }) {
	const c = WIDGET_COLORS[theme];
	return (
		<FlexWidget
			style={{
				width: 'match_parent',
				height: 'match_parent',
				alignItems: 'center',
				justifyContent: 'center',
			}}
			clickAction="OPEN_APP"
		>
			<TextWidget text={text} style={{ fontSize: 13, color: c.muted }} />
		</FlexWidget>
	);
}
