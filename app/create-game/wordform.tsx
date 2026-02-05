import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LeoProfanity from "leo-profanity";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../../constants/DesignSystem";
import { saveGameToFirestore } from "../../config/firebase";
import { getCurrentUser, getUserData } from "../../config/auth";
import words from "an-array-of-english-words";

type Difficulty = "easy" | "medium" | "hard";

const CreateWordFormPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [wordFormWord, setWordFormWord] = useState("");
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);

	const getWordFormLengthRange = (): { min: number; max: number } => {
		switch (difficulty) {
			case "easy":
				return { min: 3, max: 4 };
			case "medium":
				return { min: 5, max: 6 };
			case "hard":
				return { min: 7, max: 8 };
			default:
				return { min: 3, max: 8 };
		}
	};

	const validateWordForm = (): boolean => {
		if (!wordFormWord.trim()) {
			Alert.alert("Validation Error", "Please enter a word.");
			return false;
		}
		const word = wordFormWord.trim().toUpperCase();
		const { min, max } = getWordFormLengthRange();

		if (word.length < min || word.length > max) {
			Alert.alert(
				"Validation Error",
				`Word must be between ${min} and ${max} letters for ${difficulty} difficulty.`
			);
			return false;
		}
		if (!/^[A-Z]+$/.test(word)) {
			Alert.alert("Validation Error", "Word must contain only letters.");
			return false;
		}
		
		// Final profanity check before submission
		try {
			if (LeoProfanity.check(word)) {
				Alert.alert(
					"Validation Error",
					"Your word contains inappropriate language. Please revise your text."
				);
				return false;
			}
		} catch (error) {
			// If there's an error with profanity checking, block submission to be safe
			Alert.alert(
				"Validation Error",
				"Unable to validate content. Please try again."
			);
			return false;
		}
		
		// Validate word is in the dictionary
		if (!words.includes(word.toLowerCase())) {
			Alert.alert(
				"Validation Error",
				`"${word}" is not a valid English word.`
			);
			return false;
		}
		
		return true;
	};

	const handleWordFormWordChange = (text: string) => {
		const filtered = text.toUpperCase().replace(/[^A-Z]/g, "");
		const { max } = getWordFormLengthRange();
		
		// Check for profanity
		if (filtered.trim()) {
			try {
				const hasProfanity = LeoProfanity.check(filtered);
				if (hasProfanity) {
					Alert.alert(
						"Inappropriate Language",
						"Your word contains inappropriate language. Please revise your text.",
						[{ text: "OK" }]
					);
					// Clear the word
					setWordFormWord("");
					return;
				}
			} catch (error) {
				// If there's an error with profanity checking, allow the input
				// to prevent blocking users due to technical issues
			}
		}
		
		if (filtered.length <= max) {
			setWordFormWord(filtered);
		}
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateWordForm()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			await saveGameToFirestore(
				"wordform",
				difficulty,
				{
					qna: wordFormWord.trim().toUpperCase(),
				},
				user.uid,
				username
			);
			Alert.alert("Success", "Your WordForm game has been created successfully!", [
				{
					text: "OK",
					onPress: () => router.back(),
				},
			]);
		} catch (error: any) {
			console.error("Error creating game:", error);
			Alert.alert(
				"Error",
				error.message || "Failed to create game. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const wordLength = wordFormWord.length;
	const { min, max } = getWordFormLengthRange();
	const isValidLength = wordLength >= min && wordLength <= max;
	const difficultyText =
		difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Create WordForm</Text>
				<View style={styles.headerSpacer} />
			</View>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<ScrollView
					style={styles.content}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					<Text style={styles.sectionTitle}>Create WordForm Game</Text>
					<Text style={styles.description}>
						Enter a word. The length depends on difficulty: Easy (3-4 letters),
						Medium (5-6 letters), Hard (7-8 letters).
					</Text>

					{/* Difficulty Selector */}
					<View style={styles.selectorContainer}>
						<Text style={styles.label}>Difficulty</Text>
						<View style={styles.selectorRow}>
							{(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
								<TouchableOpacity
									key={diff}
									style={[
										styles.selectorButton,
										difficulty === diff && styles.selectorButtonActive,
									]}
									onPress={() => setDifficulty(diff)}
								>
									<Text
										style={[
											styles.selectorButtonText,
											difficulty === diff &&
												styles.selectorButtonTextActive,
										]}
									>
										{diff.charAt(0).toUpperCase() + diff.slice(1)}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					<TextInput
						style={[
							styles.input,
							wordLength > 0 && !isValidLength && styles.inputError,
						]}
						placeholder={`Enter word (${min}-${max} letters for ${difficultyText})`}
						placeholderTextColor={Colors.text.disabled}
						value={wordFormWord}
						onChangeText={handleWordFormWordChange}
						autoCapitalize="characters"
						maxLength={max}
					/>
					{wordLength > 0 && (
						<Text
							style={[
								styles.helperText,
								!isValidLength && styles.helperTextError,
							]}
						>
							{wordLength} letter{wordLength !== 1 ? "s" : ""}
							{!isValidLength &&
								` (must be between ${min}-${max} letters for ${difficultyText})`}
						</Text>
					)}

					<TouchableOpacity
						style={[
							styles.submitButton,
							loading && styles.submitButtonDisabled,
						]}
						onPress={handleSubmit}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator size="small" color={Colors.text.primary} />
						) : (
							<>
								<Ionicons
									name="checkmark-circle"
									size={24}
									color={Colors.text.primary}
								/>
								<Text style={styles.submitButtonText}>Create Game</Text>
							</>
						)}
					</TouchableOpacity>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		paddingHorizontal: Spacing.md,
		paddingBottom: Spacing.md,
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	headerSpacer: {
		width: 40,
	},
	keyboardView: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Layout.margin,
	},
	scrollContent: {
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	sectionTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
	},
	description: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.lg,
		lineHeight: 20,
	},
	selectorContainer: {
		marginBottom: Spacing.lg,
	},
	label: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	selectorRow: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	selectorButton: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	selectorButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	selectorButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	selectorButtonTextActive: {
		color: Colors.accent,
	},
	input: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		marginBottom: Spacing.xs,
		...Shadows.light,
	},
	inputError: {
		borderColor: Colors.error,
		borderWidth: 2,
	},
	helperText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginBottom: Spacing.md,
		marginTop: -Spacing.xs,
	},
	helperTextError: {
		color: Colors.error,
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.xl,
		marginBottom: Spacing.xxl,
		...Shadows.heavy,
	},
	submitButtonDisabled: {
		opacity: 0.5,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginLeft: Spacing.sm,
	},
});

export default CreateWordFormPage;

