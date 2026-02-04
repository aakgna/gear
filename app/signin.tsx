import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import TikTokButton from "../components/TikTokButton";
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
			<StatusBar style="dark" />
			<View style={styles.content}>
				{/* Logo stays the same */}
				<View style={styles.logoContainer}>
					<Image
						source={require("../assets/images/logo_transparent.png")}
						style={styles.logoImage}
					/>
				</View>

				{/* New: soft card container (background stays the same) */}
				<View style={styles.card}>
					{/* subtle accent strip (very low pop) */}
					<View style={styles.cardAccent} />

					<Text style={styles.welcomeText}>Get Kracked!</Text>
					<Text style={styles.descriptionText}>
						Start your brain training journey today
					</Text>

					{/* Feature bullets like screenshot 2 */}
					<View style={styles.features}>
						<View style={styles.featureRow}>
							<View style={styles.checkmarkCircle}>
								<Ionicons name="checkmark" size={14} color="#000000" />
							</View>
							<Text style={styles.featureText}>
								Personalized puzzle recommendations
							</Text>
						</View>

						<View style={styles.featureRow}>
							<View style={styles.checkmarkCircle}>
								<Ionicons name="checkmark" size={14} color="#000000" />
							</View>
							<Text style={styles.featureText}>Track your progress and streaks</Text>
						</View>

						<View style={styles.featureRow}>
							<View style={styles.checkmarkCircle}>
								<Ionicons name="checkmark" size={14} color="#000000" />
							</View>
							<Text style={styles.featureText}>
								Compete on global leaderboards
							</Text>
						</View>
					</View>

					<View style={styles.buttonWrap}>
						<TikTokButton
							label="Continue with Google"
							onPress={handleGoogleSignIn}
							disabled={loading}
							loading={loading}
							icon={
								<Ionicons
									name="logo-google"
									size={20}
									color={Colors.text.white}
								/>
							}
							fullWidth
						/>
					</View>

					<Text style={styles.privacyText}>
						By continuing, you agree to our Terms of Service and Privacy Policy
					</Text>
				</View>

				{/* Optional subtle footer like screenshot 2 */}
				<Text style={styles.secureText}>
					<Ionicons name="lock-closed" size={14} color={Colors.text.secondary} />
					{"  "}Secure authentication powered by Google
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		// Background stays the same as your current page
		backgroundColor: Colors.background.secondary,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: Spacing.xl,
	},
	logoContainer: {
		alignItems: "center",
		justifyContent: "center",
		// Slightly tighter than before to match the card layout
		marginTop: Spacing.xl,
		marginBottom: Spacing.sm,
	},
	logoImage: {
		width: 180,
		height: 180,
		resizeMode: "contain",
		marginBottom: Spacing.md,
	},

	// New card styles (screenshot 2 vibe)
	card: {
		width: "100%",
		backgroundColor: Colors.background.tertiary, // your card bg (#fffcf9)
		borderRadius: BorderRadius.xl,
		paddingVertical: Spacing.xl,
		paddingHorizontal: Spacing.xl,
		...Shadows.medium,
		overflow: "hidden",
		marginBottom: Spacing.lg,

		// very subtle separation (keeps it from "popping")
		borderWidth: 1,
		borderColor: "rgba(0,0,0,0.035)",
	},

	// Subtle accent strip (low opacity)
	cardAccent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 5,
		backgroundColor: Colors.accent,
		opacity: 0.2,
	},

	welcomeText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
		textAlign: "center",
	},
	descriptionText: {
		fontSize: 15,
		color: Colors.text.secondary,
		textAlign: "center",
		marginBottom: Spacing.lg,
		lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.body,
	},

	features: {
		width: "100%",
		marginBottom: Spacing.xl,
	},
	checkmarkCircle: {
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: Colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	featureRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	featureText: {
		marginLeft: Spacing.md,
		fontSize: 13,
		color: Colors.text.primary,
		opacity: 0.9,
		flex: 1,
	},

	buttonWrap: {
		width: "100%",
		marginBottom: Spacing.lg,
	},

	privacyText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		textAlign: "center",
		opacity: 0.85,
	},

	secureText: {
		marginTop: Spacing.lg,
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		opacity: 0.8,
		textAlign: "center",
	},
});

export default SignInScreen;
