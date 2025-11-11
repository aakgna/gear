import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
	signInWithGoogle,
	configureGoogleSignIn,
	getUserData,
	getCurrentUser,
} from "../config/auth";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const SignInScreen = () => {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Configure Google Sign-In on mount
		configureGoogleSignIn();
	}, []);

	const handleGoogleSignIn = async () => {
		setLoading(true);
		try {
			const user = await signInWithGoogle();
			if (user) {
				// Check if user document exists and has username
				const userData = await getUserData(user.uid);

				// Route to username page if:
				// 1. User document doesn't exist (!userData)
				// 2. User document exists but doesn't have username field (!userData.username)
				if (!userData || !userData.username) {
					// User needs to set username, go to username screen
					setLoading(false);
					router.replace("/username");
				} else {
					// User has username, go to feed
					setLoading(false);
					router.replace("/feed");
				}
			} else {
				setLoading(false);
			}
		} catch (error: any) {
			setLoading(false);
			if (error.message === "Sign in was cancelled") {
				// User cancelled, don't show error
				return;
			}
			Alert.alert(
				"Sign In Error",
				error.message || "Failed to sign in. Please try again."
			);
		}
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<LinearGradient
				colors={Colors.background.gradient as [string, string]}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.content}>
				<View style={styles.logoContainer}>
					<Text style={styles.logo}>⚙️ GEAR</Text>
					<Text style={styles.subtitle}>
						Brain training, one puzzle at a time
					</Text>
				</View>

				<View style={styles.signInContainer}>
					<Text style={styles.welcomeText}>Welcome!</Text>
					<Text style={styles.descriptionText}>
						Sign in to track your progress and unlock personalized puzzle
						recommendations.
					</Text>

					<TouchableOpacity
						style={[styles.googleButton, loading && styles.buttonDisabled]}
						onPress={handleGoogleSignIn}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator color={Colors.text.primary} />
						) : (
							<>
								<Ionicons
									name="logo-google"
									size={24}
									color={Colors.text.primary}
								/>
								<Text style={styles.googleButtonText}>
									Continue with Google
								</Text>
							</>
						)}
					</TouchableOpacity>

					<Text style={styles.privacyText}>
						By continuing, you agree to our Terms of Service and Privacy Policy
					</Text>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: Spacing.xl,
	},
	logoContainer: {
		alignItems: "center",
		marginBottom: Spacing.xxl,
	},
	logo: {
		fontSize: 64,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
		textShadowColor: Colors.accent,
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 12,
	},
	subtitle: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.secondary,
		textAlign: "center",
	},
	signInContainer: {
		width: "100%",
		alignItems: "center",
	},
	welcomeText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
		textAlign: "center",
	},
	descriptionText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		marginBottom: Spacing.xl,
		lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.body,
	},
	googleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.lg,
		width: "100%",
		marginBottom: Spacing.lg,
		...Shadows.heavy,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	googleButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginLeft: Spacing.md,
	},
	privacyText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		textAlign: "center",
		opacity: 0.8,
	},
});

export default SignInScreen;
