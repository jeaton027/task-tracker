import React from 'react';
import type { WidgetInfo } from 'react-native-android-widget';

import { getWidgetConfig } from './config';
import { fetchSingleHabitRow, fetchTodayWidgetRows } from './data';
import { HabitWidget } from './HabitWidget';
import { TodayWidget } from './TodayWidget';

/** "Mon, Jul 20" */
function todayLabel(): string {
	return new Date().toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}

/**
 * Build the light/dark representation for one widget instance.
 * Shared by the task handler (headless) and in-app refresh.
 */
export async function buildWidget(widgetInfo: WidgetInfo) {
	const config = await getWidgetConfig(widgetInfo.widgetId, widgetInfo.widgetName);

	if (config.kind === 'habit') {
		const data = await fetchSingleHabitRow(config.habitId);
		return {
			light: <HabitWidget theme="light" data={data} widthDp={widgetInfo.width} />,
			dark: <HabitWidget theme="dark" data={data} widthDp={widgetInfo.width} />,
		};
	}

	const data = await fetchTodayWidgetRows(config);
	const dateLabel = todayLabel();
	return {
		light: <TodayWidget theme="light" data={data} dateLabel={dateLabel} />,
		dark: <TodayWidget theme="dark" data={data} dateLabel={dateLabel} />,
	};
}
