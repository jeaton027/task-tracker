import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { removeWidgetConfig } from './config';
import { logHabitFromWidget } from './data';
import { buildWidget } from './render';

/**
 * Headless entry point for all widget events. Runs the JS bundle without
 * mounting the app, so everything here must work outside the React tree —
 * apiFetch reads tokens straight from storage, so auth just works.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
	switch (props.widgetAction) {
		case 'WIDGET_ADDED':
		case 'WIDGET_UPDATE':
		case 'WIDGET_RESIZED':
			props.renderWidget(await buildWidget(props.widgetInfo));
			break;

		case 'WIDGET_DELETED':
			await removeWidgetConfig(props.widgetInfo.widgetId);
			break;

		case 'WIDGET_CLICK':
			if (props.clickAction === 'LOG_HABIT') {
				const habitId = (props.clickActionData as { habitId?: string })?.habitId;
				if (habitId) {
					try {
						await logHabitFromWidget(habitId);
					} catch {
						// Render below shows current server state either way
					}
				}
				props.renderWidget(await buildWidget(props.widgetInfo));
			}
			break;

		default:
			break;
	}
}
