import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../../constants/DesignSystem";
import { saveGameToFirestore } from "../../config/firebase";
import { getCurrentUser, getUserData } from "../../config/auth";

type Difficulty = "easy" | "medium" | "hard";

// Max wrong guesses per difficulty
const MAX_GUESSES: Record<Difficulty, number> = {
	easy: 6,
	medium: 5,
	hard: 4,
};

// Min/max word length per difficulty
const WORD_LENGTH: Record<Difficulty, { min: number; max: number }> = {
	easy: { min: 3, max: 7 },
	medium: { min: 5, max: 10 },
	hard: { min: 7, max: 15 },
};

const CreateHangmanPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [word, setWord] = useState("");
	const [hint, setHint] = useState("");
	const [loading, setLoading] = useState(false);

	const validateHangman = (): boolean => {
		const trimmedWord = word.trim().toUpperCase();

		if (!trimmedWord) {
			Alert.alert("Missing Word", "Please enter a word for the game.");
			return false;
		}

		if (!/^[A-Z]+$/.test(trimmedWord)) {
			Alert.alert(
				"Invalid Word",
				"The word can only contain letters (A–Z). No spaces, numbers, or special characters."
			);
			return false;
		}

		const { min, max } = WORD_LENGTH[difficulty];
		if (trimmedWord.length < min || trimmedWord.length > max) {
			Alert.alert(
				"Word Length",
				`For ${difficulty} difficulty, the word must be between ${min} and ${max} letters long. Your word has ${trimmedWord.length} letters.`
			);
			return false;
		}

		return true;
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateHangman()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;
			const trimmedWord = word.trim().toUpperCase();
			const trimmedHint = hint.trim();

			await saveGameToFirestore(
				"hangman",
				difficulty,
				{
					word: trimmedWord,
					hint: trimmedHint || undefined,
					maxGuesses: MAX_GUESSES[difficulty],
				},
				user.uid,
				username
			);

			Alert.alert(
				"Success",
				"Your Hangman game has been created successfully!",
				[{ text: "OK", onPress: () => router.back() }]
			);
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

	const { min, max } = WORD_LENGTH[difficulty];

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Create Hangman</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + Spacing.xl },
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
			>
				{/* Difficulty Selector */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Difficulty</Text>
					<Text style={styles.sectionSubtitle}>
						Sets the word length range and number of wrong guesses allowed
					</Text>
					<View style={styles.difficultyRow}>
						{(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
							<TouchableOpacity
								key={d}
								style={[
									styles.difficultyButton,
									difficulty === d && styles.difficultyButtonActive,
								]}
								onPress={() => {
									setDifficulty(d);
									setWord("");
								}}
							>
								<Text
									style={[
										styles.difficultyButtonText,
										difficulty === d && styles.difficultyButtonTextActive,
									]}
								>
									{d.charAt(0).toUpperCase() + d.slice(1)}
								</Text>
								<Text
									style={[
										styles.difficultyDetail,
										difficulty === d && styles.difficultyDetailActive,
									]}
								>
									{WORD_LENGTH[d].min}–{WORD_LENGTH[d].max} letters
								</Text>
								<Text
									style={[
										styles.difficultyDetail,
										difficulty === d && styles.difficultyDetailActive,
									]}
								>
									{MAX_GUESSES[d]} wrong guesses
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{/* Word Input */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Word to Guess</Text>
					<Text style={styles.sectionSubtitle}>
						Letters only, {min}–{max} characters for {difficulty} difficulty
					</Text>
					<TextInput
						style={styles.textInput}
						value={word}
						onChangeText={(text) => setWord(text.replace(/[^a-zA-Z]/g, ""))}
						placeholder={`Enter a word (${min}–${max} letters)`}
						placeholderTextColor={Colors.text.inactive}
						autoCapitalize="characters"
						autoCorrect={false}
						maxLength={max}
					/>
					{word.length > 0 && (
						<Text style={styles.charCount}>
							{word.trim().length} / {max} letters
						</Text>
					)}
				</View>

				{/* Hint Input */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Hint (Optional)</Text>
					<Text style={styles.sectionSubtitle}>
						Give players a clue about the word (category, description, etc.)
					</Text>
					<TextInput
						style={[styles.textInput, styles.textInputMultiline]}
						value={hint}
						onChangeText={setHint}
						placeholder="e.g. A type of fruit, Something you wear..."
						placeholderTextColor={Colors.text.inactive}
						multiline
						numberOfLines={3}
						maxLength={120}
					/>
					{hint.length > 0 && (
						<Text style={styles.charCount}>{hint.length} / 120</Text>
					)}
				</View>

				{/* Preview */}
				{word.trim().length > 0 && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Preview</Text>
						<View style={styles.previewContainer}>
							<View style={styles.previewWordRow}>
								{word
									.trim()
									.toUpperCase()
									.split("")
									.map((_, i) => (
										<View key={i} style={styles.previewLetterBox}>
											<Text style={styles.previewUnderscore}>_</Text>
										</View>
									))}
							</View>
							{hint.trim().length > 0 && (
								<Text style={styles.previewHint}>💡 {hint.trim()}</Text>
							)}
							<Text style={styles.previewInfo}>
								{word.trim().length} letters · {MAX_GUESSES[difficulty]} wrong guesses allowed
							</Text>
						</View>
					</View>
				)}

				{/* Submit Button */}
				<TouchableOpacity
					style={[styles.submitButton, loading && styles.submitButtonDisabled]}
					onPress={handleSubmit}
					disabled={loading}
				>
					{loading ? (
						<ActivityIndicator color={Colors.text.white} />
					) : (
						<Text style={styles.submitButtonText}>Create Hangman Game</Text>
					)}
				</TouchableOpacity>
			</ScrollView>
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
		paddingHorizontal: Spacing.md,
		paddingBottom: Spacing.md,
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		flex: 1,
		textAlign: "center",
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	headerSpacer: {
		width: 32,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: Spacing.md,
		gap: Spacing.md,
	},
	section: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.md,
		...Shadows.light,
	},
	sectionTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	sectionSubtitle: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginBottom: Spacing.md,
	},
	difficultyRow: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	difficultyButton: {
		flex: 1,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.borders.primary,
		padding: Spacing.sm,
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
	},
	difficultyButtonActive: {
		borderColor: Colors.primary,
		backgroundColor: Colors.primary + "15",
	},
	difficultyButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		marginBottom: 2,
	},
	difficultyButtonTextActive: {
		color: Colors.text.primary,
	},
	difficultyDetail: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.inactive,
		textAlign: "center",
	},
	difficultyDetailActive: {
		color: Colors.text.secondary,
	},
	textInput: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.primary,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		letterSpacing: 2,
	},
	textInputMultiline: {
		letterSpacing: 0,
		fontWeight: Typography.fontWeight.regular,
		fontSize: Typography.fontSize.body,
		minHeight: 80,
		textAlignVertical: "top",
	},
	charCount: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.inactive,
		textAlign: "right",
		marginTop: Spacing.xs,
	},
	previewContainer: {
		alignItems: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.sm,
	},
	previewWordRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	previewLetterBox: {
		width: 32,
		height: 36,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.sm,
		borderBottomWidth: 3,
		borderBottomColor: Colors.text.inactive,
		justifyContent: "center",
		alignItems: "center",
	},
	previewUnderscore: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.inactive,
	},
	previewHint: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		fontStyle: "italic",
	},
	previewInfo: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.inactive,
	},
	submitButton: {
		backgroundColor: Colors.primary,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 52,
		...Shadows.medium,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
		letterSpacing: 0.5,
	},
});

export default CreateHangmanPage;

