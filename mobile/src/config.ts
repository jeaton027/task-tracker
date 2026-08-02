import { Platform } from 'react-native';

/**
 * Where the backend lives. Override via env (EXPO_PUBLIC_API_URL) when
 * running on a physical device on Wi-Fi (use your laptop's LAN IP) or in
 * production. On the Android emulator, 10.0.2.2 is a special alias for
 * the host machine's loopback.
 */
const DEV_API_URL =
	Platform.OS === 'android'
		? 'http://10.0.2.2:8000'
		: 'http://localhost:8000';

export const API_BASE_URL =
	(process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? DEV_API_URL);
