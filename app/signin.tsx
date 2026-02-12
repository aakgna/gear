import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, Image, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import TikTokButton from "../components/TikTokButton";
import {
	signInWithGoogle,
	signInWithApple,
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
	const [googleLoading, setGoogleLoading] = useState(false);
	const [appleLoading, setAppleLoading] = useState(false);

	useEffect(() => {
		// Configure Google Sign-In on mount
		configureGoogleSignIn();
	}, []);

	const handleGoogleSignIn = async () => {
		setGoogleLoading(true);
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
					setGoogleLoading(false);
					router.replace("/username");
				} else {
					// User has username, go to feed
					setGoogleLoading(false);
					router.replace("/feed");
				}
			} else {
				setGoogleLoading(false);
			}
		} catch (error: any) {
			setGoogleLoading(false);
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

	const handleAppleSignIn = async () => {
		setAppleLoading(true);
		try {
			const user = await signInWithApple();
			if (user) {
				// Check if user document exists and has username
				const userData = await getUserData(user.uid);

				// Route to username page if:
				// 1. User document doesn't exist (!userData)
				// 2. User document exists but doesn't have username field (!userData.username)
				if (!userData || !userData.username) {
					// User needs to set username, go to username screen
					setAppleLoading(false);
					router.replace("/username");
				} else {
					// User has username, go to feed
					setAppleLoading(false);
					router.replace("/feed");
				}
			} else {
				setAppleLoading(false);
			}
		} catch (error: any) {
			setAppleLoading(false);
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
						source={require("../assets/images/kracked.png")}
						style={styles.logoImage}
					/>
				</View>

				{/* New: soft card container (background stays the same) */}
				<View style={styles.card}>
					{/* subtle accent strip (very low pop) */}
					<View style={styles.cardAccent} />

					<Text style={styles.descriptionText}>
						Start your brain training journey today!
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
						{Platform.OS === "ios" && (
							<TikTokButton
								label="Continue with Apple"
								onPress={handleAppleSignIn}
								disabled={googleLoading || appleLoading}
								loading={appleLoading}
								icon={
									<Ionicons
										name="logo-apple"
										size={20}
										color={Colors.text.white}
									/>
								}
								fullWidth
							/>
						)}
						{Platform.OS === "ios" && <View style={styles.buttonSpacing} />}
						<TikTokButton
							label="Continue with Google"
							onPress={handleGoogleSignIn}
							disabled={googleLoading || appleLoading}
							loading={googleLoading}
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
						By continuing, you agree to our{" "}
						<Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://www.kracked.app/terms")}>
							Terms of Service
						</Text>
						,{" "}
						<Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://www.kracked.app/privacy")}>
							Privacy Policy
						</Text>
						, and{" "}
						<Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://www.kracked.app/eula")}>
							End User License Agreement (EULA)
						</Text>
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
		overflow: "visible",
	},
	logoImage: {
		width: 180,
		height: 180,
		resizeMode: "contain",
		marginBottom: Spacing.md,
		transform: [{ scale: 2.5 }],
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
	fontSize: 24,
	fontWeight: Typography.fontWeight.bold,
	color: Colors.text.primary,
	textAlign: "center",
	marginBottom: Spacing.lg,
	lineHeight: 30,
	letterSpacing: 0.3,
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
	buttonSpacing: {
		height: Spacing.md,
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
