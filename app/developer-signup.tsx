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
	ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../components/MinimalHeader";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";
import { getCurrentUser, getUserData } from "../config/auth";
import { saveDeveloperSignup } from "../config/auth";

const DeveloperSignupScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [phoneNumber, setPhoneNumber] = useState("");
	const [gameIdea, setGameIdea] = useState("");
	const [loading, setLoading] = useState(false);
	const [userData, setUserData] = useState<any>(null);

	useEffect(() => {
		const loadUserData = async () => {
			const user = getCurrentUser();
			if (!user) {
				Alert.alert("Error", "You must be signed in to join the developer program.");
				router.back();
				return;
			}

			const data = await getUserData(user.uid);
			if (!data) {
				Alert.alert("Error", "Unable to load user data. Please try again.");
				router.back();
				return;
			}

			setUserData(data);
		};

		loadUserData();
	}, []);

	const validatePhoneNumber = (phone: string): string | null => {
		const trimmed = phone.trim();
		
		// Remove common formatting characters
		const cleaned = trimmed.replace(/[\s\-\(\)]/g, "");
		
		// Check if it's a valid US phone number (10 digits) or international format
		if (cleaned.length < 10) {
			return "Please enter a valid phone number";
		}
		
		// Basic validation - should contain only digits (and optional + at start)
		if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
			return "Please enter a valid phone number";
		}
		
		return null;
	};

	const validateGameIdea = (idea: string): string | null => {
		const trimmed = idea.trim();
		
		if (trimmed.length < 20) {
			return "Please provide at least 2-3 sentences about your game idea";
		}
		
		if (trimmed.length > 500) {
			return "Please keep your game idea to 500 characters or less";
		}
		
		return null;
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user || !userData) {
			Alert.alert("Error", "You must be signed in to join the developer program.");
			return;
		}

		// Validate phone number
		const phoneError = validatePhoneNumber(phoneNumber);
		if (phoneError) {
			Alert.alert("Invalid Phone Number", phoneError);
			return;
		}

		// Validate game idea
		const ideaError = validateGameIdea(gameIdea);
		if (ideaError) {
			Alert.alert("Invalid Game Idea", ideaError);
			return;
		}

		setLoading(true);
		try {
			await saveDeveloperSignup(
				user.uid,
				userData.username || "",
				userData.email || "",
				phoneNumber.trim(),
				gameIdea.trim()
			);

			Alert.alert(
				"Success!",
				"Thank you for joining the waitlist! We'll be in touch soon about the Game Developer Program.",
				[
					{
						text: "OK",
						onPress: () => router.back(),
					},
				]
			);
		} catch (error: any) {
			console.error("Error submitting developer signup:", error);
			Alert.alert(
				"Error",
				error.message || "Failed to submit your signup. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
		>
			<StatusBar style="dark" />
			<MinimalHeader title="Developer Program" />

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<View style={styles.iconWrapper}>
						<Ionicons name="code-working" size={32} color={Colors.accent} />
					</View>
					<Text style={styles.title}>Join the Developer Program</Text>
					<Text style={styles.subtitle}>
						Sign up for the waitlist to get early access to our Game Developer Program. 
						Create custom game types and share your unique puzzles with the Kracked community.
					</Text>
				</View>

				<View style={styles.form}>
					<View style={styles.inputGroup}>
						<Text style={styles.label}>Phone Number *</Text>
						<TextInput
							style={styles.input}
							placeholder="(555) 123-4567"
							placeholderTextColor={Colors.text.tertiary}
							value={phoneNumber}
							onChangeText={setPhoneNumber}
							keyboardType="phone-pad"
							autoCapitalize="none"
							autoCorrect={false}
							editable={!loading}
						/>
						<Text style={styles.helperText}>
							We'll use this to contact you about the program
						</Text>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>Game Idea *</Text>
						<TextInput
							style={[styles.input, styles.textArea]}
							placeholder="Describe the game you'd like to develop for Kracked (2-3 sentences)..."
							placeholderTextColor={Colors.text.tertiary}
							value={gameIdea}
							onChangeText={setGameIdea}
							multiline
							numberOfLines={6}
							textAlignVertical="top"
							autoCapitalize="sentences"
							autoCorrect={true}
							editable={!loading}
							maxLength={500}
						/>
						<Text style={styles.helperText}>
							{gameIdea.length}/500 characters
						</Text>
					</View>

					<TouchableOpacity
						style={[styles.submitButton, loading && styles.submitButtonDisabled]}
						onPress={handleSubmit}
						disabled={loading}
						activeOpacity={0.8}
					>
						{loading ? (
							<ActivityIndicator color={Colors.background.primary} />
						) : (
							<Text style={styles.submitButtonText}>Join Waitlist</Text>
						)}
					</TouchableOpacity>

					<Text style={styles.disclaimer}>
						By joining the waitlist, you agree to be contacted about the Game Developer Program. 
						We'll review your application and reach out if you're selected.
					</Text>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	content: {
		flex: 1,
	},
	scrollContent: {
		padding: Spacing.lg,
		paddingBottom: Spacing.xxl,
	},
	header: {
		alignItems: "center",
		marginBottom: Spacing.xl,
	},
	iconWrapper: {
		width: 64,
		height: 64,
		borderRadius: BorderRadius.full,
		backgroundColor: Colors.accent + "15",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.md,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	subtitle: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		lineHeight: Typography.fontSize.body * Typography.lineHeight.normal,
	},
	form: {
		marginTop: Spacing.lg,
	},
	inputGroup: {
		marginBottom: Spacing.lg,
	},
	label: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	input: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: Colors.border,
		...Shadows.light,
	},
	textArea: {
		minHeight: 120,
		paddingTop: Spacing.md,
	},
	helperText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.tertiary,
		marginTop: Spacing.xs,
	},
	submitButton: {
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		justifyContent: "center",
		marginTop: Spacing.md,
		...Shadows.medium,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.background.primary,
	},
	disclaimer: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.tertiary,
		textAlign: "center",
		marginTop: Spacing.lg,
		lineHeight: Typography.fontSize.caption * Typography.lineHeight.normal,
	},
});

export default DeveloperSignupScreen;

