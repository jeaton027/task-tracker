import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetHabitRow } from './data';
import { WIDGET_COLORS, type WidgetTheme } from './widget-theme';

type SingleState =
	| { state: 'ok'; row: WidgetHabitRow }
	| { state: 'unconfigured' }
	| { state: 'logged-out' }
	| { state: 'error' };

/**
 * "Daybook: Single habit" — one habit, whole card taps to log (DO habits).
 * AVOID habits open the app instead so a stray tap can't record a slip.
 *
 * widthDp comes from widgetInfo so the progress bar can be sized in dp
 * (RemoteViews has no percentage widths).
 */
export function HabitWidget({
	theme,
	data,
	widthDp,
}: {
	theme: WidgetTheme;
	data: SingleState;
	widthDp: number;
}) {
	const c = WIDGET_COLORS[theme];

	if (data.state !== 'ok') {
		const text =
			data.state === 'unconfigured'
				? 'Tap to pick a habit'
				: data.state === 'logged-out'
					? 'Signed out — tap to open'
					: "Can't reach Daybook";
		return (
			<FlexWidget
				style={{
					width: 'match_parent',
					height: 'match_parent',
					backgroundColor: c.paper,
					borderRadius: 20,
					alignItems: 'center',
					justifyContent: 'center',
					padding: 10,
				}}
				clickAction="OPEN_APP"
			>
				<TextWidget text={text} style={{ fontSize: 12, color: c.muted, textAlign: 'center' }} />
			</FlexWidget>
		);
	}

	const { row } = data;
	const color = row.colorHex as `#${string}`;
	const barWidth = Math.max(widthDp - 28, 40);
	const ratio = row.target > 0 ? Math.min(row.done / row.target, 1) : row.completed ? 1 : 0;
	const fillWidth = Math.max(Math.round(barWidth * ratio), row.done > 0 ? 6 : 0);
	const canLog = row.mode === 'DO';

	return (
		<FlexWidget
			style={{
				width: 'match_parent',
				height: 'match_parent',
				backgroundColor: c.paper,
				borderRadius: 20,
				padding: 14,
				flexDirection: 'column',
				justifyContent: 'space-between',
			}}
			clickAction={canLog ? 'LOG_HABIT' : 'OPEN_APP'}
			clickActionData={canLog ? { habitId: row.id } : undefined}
		>
			<FlexWidget
				style={{
					width: 'match_parent',
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
					<FlexWidget
						style={{
							width: 8,
							height: 8,
							borderRadius: 2,
							backgroundColor: color,
							marginRight: 8,
						}}
					/>
					<TextWidget
						text={row.name}
						truncate="END"
						maxLines={1}
						style={{ fontSize: 13, color: c.ink }}
					/>
				</FlexWidget>
				<TextWidget
					text={row.completed && row.mode === 'DO' ? '✓' : `${Math.round(row.done)}/${row.target}`}
					style={{ fontSize: 16, fontWeight: '700', color }}
				/>
			</FlexWidget>

			{/* Progress bar */}
			<FlexWidget
				style={{
					width: barWidth,
					height: 5,
					borderRadius: 3,
					backgroundColor: c.chip,
					flexDirection: 'row',
				}}
			>
				{fillWidth > 0 && (
					<FlexWidget
						style={{
							width: fillWidth,
							height: 5,
							borderRadius: 3,
							backgroundColor: color,
						}}
					/>
				)}
			</FlexWidget>
		</FlexWidget>
	);
}
