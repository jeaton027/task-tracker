/**
 * JWT storage for the API client.
 *
 * TODO: swap to expo-secure-store before Play Store publish. AsyncStorage
 * is unencrypted at rest — fine for local dev / portfolio use, not for
 * shipped apps holding real user data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY  = 'daybook.access_token';
const REFRESH_KEY = 'daybook.refresh_token';

export async function getAccessToken(): Promise<string | null> {
	return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
	return AsyncStorage.getItem(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
	await Promise.all([
		AsyncStorage.setItem(ACCESS_KEY, access),
		AsyncStorage.setItem(REFRESH_KEY, refresh),
	]);
}

export async function clearTokens(): Promise<void> {
	await Promise.all([
		AsyncStorage.removeItem(ACCESS_KEY),
		AsyncStorage.removeItem(REFRESH_KEY),
	]);
}
