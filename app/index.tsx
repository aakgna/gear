import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import {
	onAuthStateChanged,
	getCurrentUser,
	getUserData,
} from "../config/auth";
import { Colors, Typography, Spacing } from "../constants/DesignSystem";

export default function SplashScreen() {
	const router = useRouter();
	const [checkingAuth, setCheckingAuth] = useState(true);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		// Mark component as mounted
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;

		let unsubscribe: (() => void) | null = null;

		const navigate = async (path: "/feed" | "/signin" | "/username") => {
			// Use requestAnimationFrame to ensure router is ready
			requestAnimationFrame(() => {
				try {
					router.replace(path as any);
				} catch (error) {
					// If navigation fails, try again after a short delay
					setTimeout(() => {
						router.replace(path as any);
					}, 200);
				}
			});
		};

		const checkUsernameAndNavigate = async (userId: string) => {
			try {
				const userData = await getUserData(userId);

				// Route to username page if:
				// 1. User document doesn't exist (!userData)
				// 2. User document exists but doesn't have username field (!userData.username)
				if (!userData || !userData.username) {
					// User needs to set username, go to username screen
					navigate("/username");
				} else {
					// User has username, go to feed
					navigate("/feed");
				}
			} catch (error) {
				console.error("Error checking username:", error);
				// On error, go to feed (will check again there)
				navigate("/feed");
			}
		};

		// Small delay to ensure navigation is ready
		const timer = setTimeout(() => {
			// Check auth state
			unsubscribe = onAuthStateChanged(async (user) => {
				setCheckingAuth(false);
				if (user) {
					// User is signed in, check if they have username
					await checkUsernameAndNavigate(user.uid);
				} else {
					// User is not signed in, go to sign in screen
					navigate("/signin");
				}
			});

			// Also check current user immediately
			const currentUser = getCurrentUser();
			if (currentUser) {
				setCheckingAuth(false);
				checkUsernameAndNavigate(currentUser.uid);
			}
		}, 200);

		return () => {
			clearTimeout(timer);
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [mounted, router]);

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<View style={styles.logoContainer}>
					<Image
						source={require("../assets/images/logo.png")}
						style={styles.logoImage}
					/>
					<Text style={styles.logo}>ThinkTok</Text>
					<Text style={styles.subtitle}>
						Brain training, one puzzle at a time
					</Text>
				</View>
				{checkingAuth && (
					<ActivityIndicator
						size="large"
						color={Colors.text.primary}
						style={{ marginTop: Spacing.lg }}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#1a1b31",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	logoContainer: {
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.xxl,
	},
	logoImage: {
		width: 180,
		height: 180,
		resizeMode: "contain",
		marginBottom: Spacing.md,
	},
	logo: {
		fontSize: 48,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
		textShadowColor: Colors.accent,
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 12,
	},
	subtitle: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.secondary,
		textAlign: "center",
	},
});
