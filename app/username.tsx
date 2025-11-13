import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Image,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
	checkUsernameAvailability,
	saveUsername,
	getCurrentUser,
	getUserData,
} from "../config/auth";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const UsernameScreen = () => {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [loading, setLoading] = useState(false);
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		// Check if user already has a username (shouldn't happen, but safety check)
		const checkExistingUsername = async () => {
			const user = getCurrentUser();
			if (user) {
				const userData = await getUserData(user.uid);
				if (userData?.username) {
					// User already has username, go to feed
					router.replace("/feed");
				}
			}
		};
		checkExistingUsername();
	}, []);

	const validateUsername = (text: string): string | null => {
		const trimmed = text.trim();
		if (trimmed.length < 3) {
			return "Username must be at least 3 characters";
		}
		if (trimmed.length > 20) {
			return "Username must be less than 20 characters";
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			return "Username can only contain letters, numbers, and underscores";
		}
		return null;
	};

	const handleCheckAvailability = async () => {
		const trimmed = username.trim();
		const validationError = validateUsername(trimmed);
		if (validationError) {
			setError(validationError);
			return;
		}

		setError("");
		setChecking(true);

		try {
			const isAvailable = await checkUsernameAvailability(trimmed);
			if (isAvailable) {
				// Username is available, proceed to save
				await handleSaveUsername(trimmed);
			} else {
				setError("This username is already taken. Please choose another.");
			}
		} catch (error: any) {
			console.error("Error checking username:", error);
			setError("Failed to check username availability. Please try again.");
		} finally {
			setChecking(false);
		}
	};

	const handleSaveUsername = async (usernameToSave: string) => {
		setLoading(true);
		try {
			const user = getCurrentUser();
			if (!user) {
				Alert.alert("Error", "You must be signed in to set a username.");
				router.replace("/signin");
				return;
			}

			await saveUsername(user.uid, usernameToSave);
			// Success! Navigate to feed
			router.replace("/feed");
		} catch (error: any) {
			console.error("Error saving username:", error);
			Alert.alert(
				"Error",
				error.message || "Failed to save username. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const handleUsernameChange = (text: string) => {
		setUsername(text);
		if (error) {
			setError("");
		}
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<LinearGradient
				colors={Colors.background.gradient as [string, string]}
				style={StyleSheet.absoluteFill}
			/>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<View style={styles.content}>
					<View style={styles.logoContainer}>
						<Image
							source={require("../assets/images/logo2.png")}
							style={styles.logoImage}
						/>
						<Text style={styles.logo}>ThinkTok</Text>
						<Text style={styles.subtitle}>Choose your username</Text>
					</View>

					<View style={styles.formContainer}>
						{/* <Text style={styles.welcomeText}>Welcome!</Text> */}
						<Text style={styles.descriptionText}>
							Pick a unique username to get started. You can use letters,
							numbers, and underscores.
						</Text>

						<View style={styles.inputContainer}>
							<TextInput
								style={[styles.input, error && styles.inputError]}
								placeholder="Enter username"
								placeholderTextColor={Colors.text.secondary}
								value={username}
								onChangeText={handleUsernameChange}
								autoCapitalize="none"
								autoCorrect={false}
								maxLength={20}
								editable={!loading && !checking}
							/>
							{error ? (
								<View style={styles.errorContainer}>
									<Ionicons
										name="alert-circle"
										size={16}
										color={Colors.error}
									/>
									<Text style={styles.errorText}>{error}</Text>
								</View>
							) : null}
						</View>

						<TouchableOpacity
							style={[
								styles.submitButton,
								(loading || checking || !username.trim()) &&
									styles.buttonDisabled,
							]}
							onPress={handleCheckAvailability}
							disabled={loading || checking || !username.trim()}
						>
							{loading || checking ? (
								<ActivityIndicator color={Colors.text.primary} />
							) : (
								<>
									<Text style={styles.submitButtonText}>Continue</Text>
									<Ionicons
										name="arrow-forward"
										size={20}
										color={Colors.text.primary}
										style={styles.arrowIcon}
									/>
								</>
							)}
						</TouchableOpacity>

						<Text style={styles.hintText}>
							3-20 characters • Letters, numbers, and underscores only
						</Text>
					</View>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	keyboardView: {
		flex: 1,
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
		marginBottom: Spacing.md,
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
	formContainer: {
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
	inputContainer: {
		width: "100%",
		marginBottom: Spacing.md,
	},
	input: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.3)",
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		...Shadows.light,
	},
	inputError: {
		borderColor: Colors.error,
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: Spacing.sm,
		paddingHorizontal: Spacing.sm,
	},
	errorText: {
		fontSize: Typography.fontSize.small,
		color: Colors.error,
		marginLeft: Spacing.xs,
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.lg,
		width: "100%",
		marginBottom: Spacing.md,
		...Shadows.heavy,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	arrowIcon: {
		marginLeft: Spacing.sm,
	},
	hintText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		textAlign: "center",
		opacity: 0.8,
	},
});

export default UsernameScreen;
