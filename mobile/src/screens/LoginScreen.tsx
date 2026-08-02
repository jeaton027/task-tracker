import { useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { auth } from '../api/endpoints';
import { useAuth } from '../auth/AuthProvider';
import { FONTS, RADII, useTheme } from '../theme';

type Mode = 'signin' | 'register' | 'forgot' | 'reset';

export function LoginScreen() {
	const { colors } = useTheme();
	const { login, register } = useAuth();

	const [mode, setMode] = useState<Mode>('signin');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [resetToken, setResetToken] = useState('');
	const [confirmPw, setConfirmPw] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const goTo = (next: Mode) => {
		setError(null);
		setMessage(null);
		setMode(next);
	};

	const submit = async () => {
		setError(null);
		setMessage(null);
		setSubmitting(true);
		try {
			if (mode === 'register') {
				await register(email.trim(), password);
			} else if (mode === 'forgot') {
				await auth.forgotPassword(email.trim());
				setMessage('If that email exists, a reset link has been sent.');
			} else if (mode === 'reset') {
				if (password.length < 8) {
					setError('Password must be at least 8 characters.');
					return;
				}
				if (password !== confirmPw) {
					setError('Passwords do not match.');
					return;
				}
				await auth.resetPassword(resetToken.trim(), password);
				setMessage('Password updated. Sign in with your new password.');
				setPassword('');
				setConfirmPw('');
				setResetToken('');
				setMode('signin');
			} else {
				await login(email.trim(), password);
			}
		} catch (e) {
			if (e instanceof ApiError) {
				setError(e.message);
			} else if (e instanceof Error) {
				setError(e.message);
			} else {
				setError('Something went wrong.');
			}
		} finally {
			setSubmitting(false);
		}
	};

	const canSubmit = (() => {
		if (submitting) return false;
		if (mode === 'forgot') return email.length > 0;
		if (mode === 'reset') return resetToken.length > 0 && password.length > 0 && confirmPw.length > 0;
		return email.length > 0 && password.length > 0;
	})();

	const isRegister = mode === 'register';

	const heading = {
		signin: 'Welcome back',
		register: 'Create your account',
		forgot: 'Reset your password',
		reset: 'Enter reset code',
	}[mode];

	const cta = {
		signin: 'Sign in',
		register: 'Create account',
		forgot: 'Send reset link',
		reset: 'Reset password',
	}[mode];

	return (
		<SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
			<KeyboardAvoidingView
				style={styles.kav}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.content}>
					<Text style={[styles.title, { color: colors.ink }]}>Daybook</Text>
					<Text style={[styles.subtitle, { color: colors.ink }]}>{heading}</Text>

					{(mode === 'signin' || mode === 'register' || mode === 'forgot') && (
						<TextInput
							style={[
								styles.input,
								{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
							]}
							placeholder="Email"
							placeholderTextColor={colors.muted}
							autoCapitalize="none"
							autoComplete="email"
							keyboardType="email-address"
							value={email}
							onChangeText={setEmail}
							editable={!submitting}
						/>
					)}

					{mode === 'reset' && (
						<TextInput
							style={[
								styles.input,
								{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
							]}
							placeholder="Reset token"
							placeholderTextColor={colors.muted}
							autoCapitalize="none"
							value={resetToken}
							onChangeText={setResetToken}
							editable={!submitting}
						/>
					)}

					{(mode === 'signin' || mode === 'register' || mode === 'reset') && (
						<TextInput
							style={[
								styles.input,
								{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
							]}
							placeholder={mode === 'reset' ? 'New password' : 'Password'}
							placeholderTextColor={colors.muted}
							autoCapitalize="none"
							autoComplete={isRegister ? 'new-password' : 'current-password'}
							secureTextEntry
							value={password}
							onChangeText={setPassword}
							editable={!submitting}
						/>
					)}

					{mode === 'reset' && (
						<TextInput
							style={[
								styles.input,
								{ backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
							]}
							placeholder="Confirm new password"
							placeholderTextColor={colors.muted}
							autoCapitalize="none"
							secureTextEntry
							value={confirmPw}
							onChangeText={setConfirmPw}
							editable={!submitting}
						/>
					)}

					{error && (
						<Text style={[styles.error, { color: colors.accent }]}>{error}</Text>
					)}
					{message && (
						<Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
					)}

					<Pressable
						style={({ pressed }) => [
							styles.button,
							{
								backgroundColor: colors.ink,
								opacity: pressed || !canSubmit ? 0.7 : 1,
							},
						]}
						disabled={!canSubmit}
						onPress={submit}
					>
						<Text style={[styles.buttonLabel, { color: colors.paper }]}>
							{submitting ? '...' : cta}
						</Text>
					</Pressable>

					{mode === 'signin' && (
						<Pressable onPress={() => goTo('forgot')} disabled={submitting}>
							<Text style={[styles.link, { color: colors.muted }]}>
								Forgot password?
							</Text>
						</Pressable>
					)}

					{mode === 'forgot' && (
						<>
							<Pressable onPress={() => goTo('reset')} disabled={submitting}>
								<Text style={[styles.link, { color: colors.muted }]}>
									Have a reset code? Enter it here
								</Text>
							</Pressable>
							<Pressable onPress={() => goTo('signin')} disabled={submitting}>
								<Text style={[styles.switch, { color: colors.ink }]}>
									Back to sign in
								</Text>
							</Pressable>
						</>
					)}

					{mode === 'reset' && (
						<Pressable onPress={() => goTo('signin')} disabled={submitting}>
							<Text style={[styles.switch, { color: colors.ink }]}>
								Back to sign in
							</Text>
						</Pressable>
					)}

					{(mode === 'signin' || mode === 'register') && (
						<Pressable
							onPress={() => goTo(isRegister ? 'signin' : 'register')}
							disabled={submitting}
						>
							<Text style={[styles.switch, { color: colors.ink }]}>
								{isRegister
									? 'Already have an account? Sign in'
									: 'New here? Create an account'}
							</Text>
						</Pressable>
					)}
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	kav:  { flex: 1 },
	content: {
		flex: 1,
		paddingHorizontal: 24,
		justifyContent: 'center',
		gap: 12,
	},
	title: {
		fontFamily: FONTS.display.regular,
		fontSize: 36,
		letterSpacing: -1,
	},
	subtitle: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
		marginBottom: 12,
	},
	input: {
		borderWidth: 1,
		borderRadius: RADII.default,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	error: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
	},
	button: {
		marginTop: 8,
		paddingVertical: 14,
		borderRadius: RADII.default,
		alignItems: 'center',
	},
	buttonLabel: {
		fontFamily: FONTS.body.regular,
		fontSize: 15,
	},
	switch: {
		marginTop: 14,
		fontFamily: FONTS.body.regular,
		fontSize: 14,
		textAlign: 'center',
	},
	link: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		textAlign: 'center',
		marginTop: 4,
	},
	message: {
		fontFamily: FONTS.body.regular,
		fontSize: 13,
		textAlign: 'center',
	},
});
