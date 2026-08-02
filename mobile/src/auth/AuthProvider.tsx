/**
 * Auth context — single source of truth for "is the user logged in" and
 * the login/logout/register actions.
 *
 * Flow on app start:
 *   1. Read access token from AsyncStorage.
 *   2. If present, mark authenticated optimistically. The first protected
 *      API call will 401 and trip logout if the token is invalid (handled
 *      in the API client wrapper / React Query later).
 *   3. If absent, isAuthenticated = false → LoginScreen renders.
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from 'react';

import { setUnauthorizedHandler } from '../api/client';
import { auth as authApi } from '../api/endpoints';
import {
	clearTokens,
	getAccessToken,
	saveTokens,
} from '../api/storage';

interface AuthState {
	isAuthenticated: boolean;
	isLoading:       boolean;
	login:           (email: string, password: string) => Promise<void>;
	register:        (email: string, password: string) => Promise<void>;
	logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isAuthenticated, setAuthenticated] = useState(false);
	const [isLoading, setLoading] = useState(true);

	// Bootstrap: check storage on mount
	useEffect(() => {
		(async () => {
			const token = await getAccessToken();
			setAuthenticated(!!token);
			setLoading(false);
		})();
	}, []);

	// Whenever any authenticated request comes back 401, clear tokens and
	// flip back to unauthenticated -> Gate renders LoginScreen.
	useEffect(() => {
		setUnauthorizedHandler(() => {
			clearTokens().catch(() => {});
			setAuthenticated(false);
		});
		return () => setUnauthorizedHandler(null);
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const tokens = await authApi.login(email, password);
		await saveTokens(tokens.access_token, tokens.refresh_token);
		setAuthenticated(true);
	}, []);

	const register = useCallback(async (email: string, password: string) => {
		// Registration returns the user, not tokens. Immediately log in.
		await authApi.register(email, password);
		const tokens = await authApi.login(email, password);
		await saveTokens(tokens.access_token, tokens.refresh_token);
		setAuthenticated(true);
	}, []);

	const logout = useCallback(async () => {
		await clearTokens();
		setAuthenticated(false);
	}, []);

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, isLoading, login, register, logout }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
	return ctx;
}
