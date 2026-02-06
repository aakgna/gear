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
import LeoProfanity from "leo-profanity";
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

const MAX_LEN = 20;

const UsernameScreen = () => {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [loading, setLoading] = useState(false);
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const checkExistingUsername = async () => {
			const user = getCurrentUser();
			if (user) {
				const userData = await getUserData(user.uid);
				if (userData?.username) {
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

		// Profanity check (client-side only)
		try {
			if (LeoProfanity.check(trimmed)) {
				return "This username contains inappropriate language. Please choose another.";
			}
		} catch {
			// Fail-open on client errors so we don't block sign-up
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
		if (error) setError("");
	};

	const progressPct = Math.min(username.length / MAX_LEN, 1) * 100;

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
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
							source={require("../assets/images/kracked.png")}
							style={styles.logoImage}
						/>
					</View>

					<Text style={styles.title}>Choose Your Username</Text>

					<View style={styles.card}>
						<Text style={styles.inputLabel}>Username</Text>

						<View style={styles.inputWrapper}>
							<TextInput
								style={[styles.input, error && styles.inputError]}
								placeholderTextColor={Colors.text.secondary}
								value={username}
								onChangeText={handleUsernameChange}
								autoCapitalize="none"
								autoCorrect={false}
								maxLength={MAX_LEN}
								editable={!loading && !checking}
							/>
							{username.length === 0 && (
								<View style={styles.placeholderOverlay} pointerEvents="none">
									<Text style={styles.placeholderOverlayText}>
										your_username
									</Text>
								</View>
							)}
						</View>

						{/* progress + count */}
						<View style={styles.progressRow}>
							<View style={styles.progressTrack}>
								<View style={[styles.progressFill, { width: `${progressPct}%` }]} />
							</View>
							<Text style={styles.countText}>
								{username.length}/{MAX_LEN}
							</Text>
						</View>

						{/* bullets */}
						<View style={styles.bullets}>
							<View style={styles.bulletRow}>
								<Text style={styles.bulletDot}>•</Text>
								<Text style={styles.bulletText}>3-20 characters</Text>
							</View>
							<View style={styles.bulletRow}>
								<Text style={styles.bulletDot}>•</Text>
								<Text style={styles.bulletText}>
									Letters, numbers, and underscores only
								</Text>
							</View>
						</View>

						{error ? (
							<View style={styles.errorContainer}>
								<Ionicons name="alert-circle" size={16} color={Colors.error} />
								<Text style={styles.errorText}>{error}</Text>
							</View>
						) : null}

						<TouchableOpacity
							style={[
								styles.submitButton,
								(loading || checking || !username.trim()) && styles.buttonDisabled,
							]}
							onPress={handleCheckAvailability}
							disabled={loading || checking || !username.trim()}
						>
							{loading || checking ? (
								<ActivityIndicator color={Colors.text.white} />
							) : (
								<>
									<Text style={styles.submitButtonText}>Continue</Text>
									<Ionicons
										name="arrow-forward"
										size={20}
										color={Colors.text.white}
										style={styles.arrowIcon}
									/>
								</>
							)}
						</TouchableOpacity>
					</View>

					<Text style={styles.footerText}>
						You can change your username later in settings
					</Text>
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
		alignItems: "center",
		paddingHorizontal: Spacing.xl,
		paddingTop: 70,
	},
	logoContainer: {
		alignItems: "center",
		justifyContent: "center",
		marginTop: 10,
		overflow: "visible",
	},
	logoImage: {
		width: 180,
		height: 180,
		resizeMode: "contain",
		transform: [{ scale: 2.5 }],
	},
	title: {
		fontSize: 28,
		fontWeight: 900,
		color: "black",
		textAlign: "center",
		marginBottom: Spacing.xl,
	},

	card: {
		width: "100%",
		backgroundColor: Colors.background.primary,
		alignSelf: "center",
		borderRadius: 28,
		padding: Spacing.xl,
		...Shadows.medium,
	},
	inputLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	inputWrapper: {
		position: "relative",
		width: "100%",
	},
	placeholderOverlay: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		justifyContent: "center",
		paddingHorizontal: Spacing.lg,
	},
	placeholderOverlayText: {
		fontSize: 16,
		color: Colors.text.secondary,
	},
	input: {
		backgroundColor: "#F6F6F6",
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: 18,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
	},
	inputError: {
		borderColor: Colors.error,
	},
	progressRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: Spacing.md,
	},
	progressTrack: {
		flex: 1,
		height: 6,
		backgroundColor: "#E6E6E6",
		borderRadius: 999,
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#CFCFCF",
	},
	countText: {
		marginLeft: Spacing.md,
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
	},
	bullets: {
		marginTop: Spacing.lg,
		marginBottom: Spacing.lg,
	},
	bulletRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	bulletDot: {
		fontSize: 16,
		color: Colors.text.secondary,
		marginRight: Spacing.sm,
	},
	bulletText: {
		fontSize: 14,
		color: Colors.text.secondary,
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	errorText: {
		fontSize: Typography.fontSize.small,
		color: Colors.error,
		marginLeft: Spacing.xs,
		flex: 1,
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.md,
		borderRadius: 18,
		width: "100%",
		...Shadows.light,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.white,
	},
	arrowIcon: {
		marginLeft: Spacing.sm,
	},
	footerText: {
		marginTop: Spacing.xl,
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		textAlign: "center",
		opacity: 0.8,
	},
});

export default UsernameScreen;
