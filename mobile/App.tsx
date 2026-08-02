import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
	FamiljenGrotesk_400Regular,
	FamiljenGrotesk_500Medium,
	FamiljenGrotesk_600SemiBold,
	FamiljenGrotesk_700Bold,
} from '@expo-google-fonts/familjen-grotesk';
import {
	HankenGrotesk_400Regular,
	HankenGrotesk_500Medium,
	HankenGrotesk_600SemiBold,
	HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { LoginScreen } from './src/screens/LoginScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { ThemeProvider } from './src/theme';

/**
 * App root.
 *
 * Provider stack (outer → inner):
 *   1. SafeAreaProvider  — insets for status bar / home indicator
 *   2. QueryClientProvider — React Query cache
 *   3. ThemeProvider     — surface theme + habit palette
 *   4. AuthProvider      — login state + token actions
 *   5. <Gate>            — picks LoginScreen vs TodayScreen
 */
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			// React Native doesn't have window focus; foreground-focus refetching
			// is fine to enable later via TanStack's focusManager when needed.
			refetchOnWindowFocus: false,
		},
	},
});

function Gate() {
	const { isAuthenticated, isLoading } = useAuth();
	if (isLoading) return null;                          // brief blank during storage read
	return isAuthenticated ? <TodayScreen /> : <LoginScreen />;
}

export default function App() {
	const [fontsLoaded] = useFonts({
		HankenGrotesk_400Regular,
		HankenGrotesk_500Medium,
		HankenGrotesk_600SemiBold,
		HankenGrotesk_700Bold,
		FamiljenGrotesk_400Regular,
		FamiljenGrotesk_500Medium,
		FamiljenGrotesk_600SemiBold,
		FamiljenGrotesk_700Bold,
	});

	if (!fontsLoaded) return null;

	return (
		<SafeAreaProvider>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<AuthProvider>
						<Gate />
					</AuthProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</SafeAreaProvider>
	);
}
