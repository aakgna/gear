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
import { signInWithGoogle, configureGoogleSignIn } from "../config/auth";

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
			await signInWithGoogle();
			// Navigation will happen automatically via auth state listener
			router.replace("/feed");
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
				colors={["#1e88e5", "#1565c0"]}
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
							<ActivityIndicator color="#fff" />
						) : (
							<>
								<Ionicons name="logo-google" size={24} color="#fff" />
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
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 30,
	},
	logoContainer: {
		alignItems: "center",
		marginBottom: 60,
	},
	logo: {
		fontSize: 56,
		fontWeight: "bold",
		color: "#ffffff",
		marginBottom: 16,
	},
	subtitle: {
		fontSize: 18,
		color: "#e3f2fd",
		textAlign: "center",
	},
	signInContainer: {
		width: "100%",
		alignItems: "center",
	},
	welcomeText: {
		fontSize: 28,
		fontWeight: "bold",
		color: "#ffffff",
		marginBottom: 12,
		textAlign: "center",
	},
	descriptionText: {
		fontSize: 16,
		color: "#e3f2fd",
		textAlign: "center",
		marginBottom: 40,
		lineHeight: 24,
	},
	googleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#ffffff",
		paddingVertical: 16,
		paddingHorizontal: 32,
		borderRadius: 12,
		width: "100%",
		marginBottom: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	googleButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1e88e5",
		marginLeft: 12,
	},
	privacyText: {
		fontSize: 12,
		color: "#e3f2fd",
		textAlign: "center",
		opacity: 0.8,
	},
});

export default SignInScreen;
