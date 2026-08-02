import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Home-screen widgets (Android only). Registered lazily so iOS/web bundles
// don't pull in the Android widget machinery.
if (Platform.OS === 'android') {
	const {
		registerWidgetTaskHandler,
		registerWidgetConfigurationScreen,
	} = require('react-native-android-widget');
	const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
	const { WidgetConfigurationScreen } = require('./src/widgets/WidgetConfigurationScreen');

	registerWidgetTaskHandler(widgetTaskHandler);
	registerWidgetConfigurationScreen(WidgetConfigurationScreen);
}
