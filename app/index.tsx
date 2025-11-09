import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, getCurrentUser } from "../config/auth";

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

		const navigate = (path: "/feed" | "/signin") => {
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

		// Small delay to ensure navigation is ready
		const timer = setTimeout(() => {
			// Check auth state
			unsubscribe = onAuthStateChanged((user) => {
				setCheckingAuth(false);
				if (user) {
					// User is signed in, go to feed
					navigate("/feed");
				} else {
					// User is not signed in, go to sign in screen
					navigate("/signin");
				}
			});

			// Also check current user immediately
			const currentUser = getCurrentUser();
			if (currentUser) {
				setCheckingAuth(false);
				navigate("/feed");
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
			<LinearGradient
				colors={["#1e88e5", "#1565c0"]}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.content}>
				<Text style={styles.logo}>⚙️ GEAR</Text>
				<Text style={styles.subtitle}>
					Brain training, one puzzle at a time
				</Text>
				{checkingAuth && (
					<ActivityIndicator
						size="large"
						color="#ffffff"
						style={{ marginTop: 20 }}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	logo: {
		fontSize: 48,
		fontWeight: "bold",
		color: "#ffffff",
		marginBottom: 16,
	},
	subtitle: {
		fontSize: 18,
		color: "#e3f2fd",
		textAlign: "center",
	},
});
