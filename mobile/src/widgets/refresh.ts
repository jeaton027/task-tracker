import { Platform } from 'react-native';

/**
 * Re-render every home-screen widget instance with fresh data. Called after
 * in-app log/unlog so widgets never show stale counts. Fire-and-forget —
 * failures are irrelevant to the app flow.
 */
export function refreshHomeScreenWidgets(): void {
	if (Platform.OS !== 'android') return;
	(async () => {
		const { requestWidgetUpdate } = await import('react-native-android-widget');
		const { buildWidget } = await import('./render');
		for (const widgetName of ['DaybookToday', 'DaybookHabit']) {
			requestWidgetUpdate({
				widgetName,
				renderWidget: (info) => buildWidget(info),
			}).catch(() => {});
		}
	})().catch(() => {});
}
