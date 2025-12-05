import React, { useState, useEffect, useRef } from "react";
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
	Dimensions,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import {
	saveGameToFirestore,
	saveGameIdeaToFirestore,
} from "../config/firebase";
import { getCurrentUser } from "../config/auth";

type GameType = "wordle" | "riddle" | "quickMath" | "gameIdea" | null;
type Difficulty = "easy" | "medium" | "hard";

const CreateGameScreen = () => {
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const previousPathnameRef = useRef<string>(pathname);
	const [gameType, setGameType] = useState<GameType>(null);
	const [loading, setLoading] = useState(false);

	// Wordle state
	const [wordleWord, setWordleWord] = useState("");

	// Riddle state
	const [riddleQuestion, setRiddleQuestion] = useState("");
	const [riddleAnswer, setRiddleAnswer] = useState("");

	// Difficulty state (applies to all game types)
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");

	// Quick Math state
	const [numQuestions, setNumQuestions] = useState<3 | 5>(3);
	const [quickMathQuestions, setQuickMathQuestions] = useState<string[]>(
		Array(3).fill("")
	);
	const [quickMathAnswers, setQuickMathAnswers] = useState<string[]>(
		Array(3).fill("")
	);

	// Game Idea state
	const [gameIdea, setGameIdea] = useState("");

	// Reset function to clear all form state
	const resetFormState = () => {
		setGameType(null);
		setWordleWord("");
		setRiddleQuestion("");
		setRiddleAnswer("");
		setNumQuestions(3);
		setDifficulty("easy");
		setQuickMathQuestions(Array(3).fill(""));
		setQuickMathAnswers(Array(3).fill(""));
		setGameIdea("");
		setLoading(false);
	};

	// Reset state when navigating back to create-game from another screen
	useEffect(() => {
		const wasOnCreateGame = previousPathnameRef.current === "/create-game";
		const isOnCreateGame = pathname === "/create-game";
		const navigatedAway = wasOnCreateGame && !isOnCreateGame;
		const navigatedBack = !wasOnCreateGame && isOnCreateGame;

		// If we navigated away from create-game, mark it
		if (navigatedAway) {
			// User navigated away - state will be reset when they come back
		}

		// If we navigated back to create-game, reset the state
		if (navigatedBack) {
			resetFormState();
		}

		previousPathnameRef.current = pathname;
	}, [pathname]);

	const handleGameTypeSelect = (type: GameType) => {
		setGameType(type);
		// Reset all form states
		setWordleWord("");
		setRiddleQuestion("");
		setRiddleAnswer("");
		setNumQuestions(3);
		setDifficulty("easy");
		setQuickMathQuestions(Array(3).fill(""));
		setQuickMathAnswers(Array(3).fill(""));
		setGameIdea("");
	};

	// Clear wordle word if it becomes invalid when difficulty changes
	useEffect(() => {
		if (gameType === "wordle" && wordleWord) {
			let min: number, max: number;
			switch (difficulty) {
				case "easy":
					min = 3;
					max = 4;
					break;
				case "medium":
					min = 5;
					max = 6;
					break;
				case "hard":
					min = 7;
					max = 8;
					break;
				default:
					min = 3;
					max = 8;
			}
			if (wordleWord.length < min || wordleWord.length > max) {
				setWordleWord("");
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [difficulty, gameType]); // Only run when difficulty or gameType changes, not when wordleWord changes

	const handleNumQuestionsChange = (num: 3 | 5) => {
		setNumQuestions(num);
		setQuickMathQuestions(Array(num).fill(""));
		setQuickMathAnswers(Array(num).fill(""));
	};

	const handleQuickMathQuestionChange = (index: number, value: string) => {
		const newQuestions = [...quickMathQuestions];
		newQuestions[index] = value;
		setQuickMathQuestions(newQuestions);
	};

	const handleQuickMathAnswerChange = (index: number, value: string) => {
		const newAnswers = [...quickMathAnswers];
		newAnswers[index] = value;
		setQuickMathAnswers(newAnswers);
	};

	const getWordleLengthRange = (): { min: number; max: number } => {
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

	const validateWordle = (): boolean => {
		if (!wordleWord.trim()) {
			Alert.alert("Validation Error", "Please enter a word.");
			return false;
		}
		const word = wordleWord.trim().toUpperCase();
		const { min, max } = getWordleLengthRange();

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
		return true;
	};

	const validateRiddle = (): boolean => {
		if (!riddleQuestion.trim()) {
			Alert.alert("Validation Error", "Please enter a riddle question.");
			return false;
		}
		if (!riddleAnswer.trim()) {
			Alert.alert("Validation Error", "Please enter a riddle answer.");
			return false;
		}
		return true;
	};

	const validateQuickMath = (): boolean => {
		for (let i = 0; i < numQuestions; i++) {
			if (!quickMathQuestions[i]?.trim()) {
				Alert.alert("Validation Error", `Please enter question ${i + 1}.`);
				return false;
			}
			if (!quickMathAnswers[i]?.trim()) {
				Alert.alert("Validation Error", `Please enter answer ${i + 1}.`);
				return false;
			}
		}
		return true;
	};

	const validateGameIdea = (): boolean => {
		const trimmed = gameIdea.trim();
		if (trimmed.length < 350) {
			Alert.alert(
				"Validation Error",
				`Your game idea must be at least 350 characters. You have ${trimmed.length} characters.`
			);
			return false;
		}
		// Check for examples - look for common example indicators
		const exampleIndicators = [
			"example",
			"for instance",
			"for example",
			"such as",
			"like",
			"e.g.",
			"e.g",
		];
		const lowerText = trimmed.toLowerCase();
		const hasExample = exampleIndicators.some((indicator) =>
			lowerText.includes(indicator)
		);
		if (!hasExample) {
			Alert.alert(
				"Validation Error",
				"Please include examples in your game idea. Submissions without examples will not be accepted."
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

		let isValid = false;
		let gameData: any = {};

		switch (gameType) {
			case "wordle":
				isValid = validateWordle();
				if (isValid) {
					gameData = {
						qna: wordleWord.trim().toUpperCase(),
					};
				}
				break;
			case "riddle":
				isValid = validateRiddle();
				if (isValid) {
					gameData = {
						question: riddleQuestion.trim(),
						answer: riddleAnswer.trim(),
					};
				}
				break;
			case "quickMath":
				isValid = validateQuickMath();
				if (isValid) {
					gameData = {
						questions: quickMathQuestions.map((q) => q.trim()),
						answers: quickMathAnswers.map((a) => a.trim()),
					};
				}
				break;
			case "gameIdea":
				isValid = validateGameIdea();
				// Game ideas are saved differently, handled in the submit section
				break;
			default:
				Alert.alert("Error", "Please select a game type.");
				return;
		}

		if (!isValid) return;

		setLoading(true);
		try {
			// Handle game idea submission separately
			if (gameType === "gameIdea") {
				await saveGameIdeaToFirestore(gameIdea.trim(), user.uid);
				Alert.alert(
					"Success",
					"Your game idea has been submitted successfully! We'll review it and may implement it in the future.",
					[
						{
							text: "OK",
							onPress: () => {
								// Reset form
								setGameType(null);
								setGameIdea("");
							},
						},
					]
				);
			} else {
				await saveGameToFirestore(gameType!, difficulty, gameData, user.uid);
				Alert.alert("Success", "Your game has been created successfully!", [
					{
						text: "OK",
						onPress: () => {
							// Reset form
							setGameType(null);
							setWordleWord("");
							setRiddleQuestion("");
							setRiddleAnswer("");
							setNumQuestions(3);
							setDifficulty("easy");
							setQuickMathQuestions(Array(3).fill(""));
							setQuickMathAnswers(Array(3).fill(""));
						},
					},
				]);
			}
		} catch (error: any) {
			console.error("Error creating game:", error);
			console.error("Error details:", {
				code: error?.code,
				message: error?.message,
				stack: error?.stack,
			});
			Alert.alert(
				"Error",
				error.message || "Failed to create game. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const renderDifficultySelector = () => (
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
								difficulty === diff && styles.selectorButtonTextActive,
							]}
						>
							{diff.charAt(0).toUpperCase() + diff.slice(1)}
						</Text>
					</TouchableOpacity>
				))}
			</View>
		</View>
	);

	const renderGameTypeSelection = () => (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>Choose Game Type</Text>
			<View style={styles.gameTypeContainer}>
				<TouchableOpacity
					style={[
						styles.gameTypeButton,
						gameType === "gameIdea" && styles.gameTypeButtonActive,
					]}
					onPress={() => handleGameTypeSelect("gameIdea")}
				>
					<Ionicons
						name="bulb-outline"
						size={32}
						color={
							gameType === "gameIdea" ? Colors.accent : Colors.text.secondary
						}
					/>
					<Text
						style={[
							styles.gameTypeText,
							gameType === "gameIdea" && styles.gameTypeTextActive,
						]}
					>
						Own Game
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.gameTypeButton,
						gameType === "wordle" && styles.gameTypeButtonActive,
					]}
					onPress={() => handleGameTypeSelect("wordle")}
				>
					<Ionicons
						name="text-outline"
						size={32}
						color={
							gameType === "wordle" ? Colors.accent : Colors.text.secondary
						}
					/>
					<Text
						style={[
							styles.gameTypeText,
							gameType === "wordle" && styles.gameTypeTextActive,
						]}
					>
						Wordle
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.gameTypeButton,
						gameType === "riddle" && styles.gameTypeButtonActive,
					]}
					onPress={() => handleGameTypeSelect("riddle")}
				>
					<Ionicons
						name="help-circle-outline"
						size={32}
						color={
							gameType === "riddle" ? Colors.accent : Colors.text.secondary
						}
					/>
					<Text
						style={[
							styles.gameTypeText,
							gameType === "riddle" && styles.gameTypeTextActive,
						]}
					>
						Riddle
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.gameTypeButton,
						gameType === "quickMath" && styles.gameTypeButtonActive,
					]}
					onPress={() => handleGameTypeSelect("quickMath")}
				>
					<Ionicons
						name="calculator-outline"
						size={32}
						color={
							gameType === "quickMath" ? Colors.accent : Colors.text.secondary
						}
					/>
					<Text
						style={[
							styles.gameTypeText,
							gameType === "quickMath" && styles.gameTypeTextActive,
						]}
					>
						Quick Math
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	const handleWordleWordChange = (text: string) => {
		// Filter out non-letter characters and convert to uppercase
		const filtered = text.toUpperCase().replace(/[^A-Z]/g, "");
		// Enforce max length based on difficulty
		const { max } = getWordleLengthRange();
		if (filtered.length <= max) {
			setWordleWord(filtered);
		}
	};

	const renderWordleForm = () => {
		const wordLength = wordleWord.length;
		const { min, max } = getWordleLengthRange();
		const isValidLength = wordLength >= min && wordLength <= max;
		const difficultyText =
			difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

		return (
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Create Wordle Game</Text>
				<Text style={styles.description}>
					Enter a word. The length depends on difficulty: Easy (3-4 letters),
					Medium (5-6 letters), Hard (7-8 letters).
				</Text>
				{renderDifficultySelector()}
				<TextInput
					style={[
						styles.input,
						wordLength > 0 && !isValidLength && styles.inputError,
					]}
					placeholder={`Enter word (${min}-${max} letters for ${difficultyText})`}
					placeholderTextColor={Colors.text.disabled}
					value={wordleWord}
					onChangeText={handleWordleWordChange}
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
			</View>
		);
	};

	const renderRiddleForm = () => (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>Create Riddle Game</Text>
			<Text style={styles.description}>
				Enter a riddle question and its answer.
			</Text>
			{renderDifficultySelector()}
			<TextInput
				style={[styles.input, styles.textArea]}
				placeholder="Enter riddle question..."
				placeholderTextColor={Colors.text.disabled}
				value={riddleQuestion}
				onChangeText={setRiddleQuestion}
				multiline
				numberOfLines={4}
			/>
			<TextInput
				style={styles.input}
				placeholder="Enter answer..."
				placeholderTextColor={Colors.text.disabled}
				value={riddleAnswer}
				onChangeText={setRiddleAnswer}
			/>
		</View>
	);

	const renderGameIdeaForm = () => {
		const charCount = gameIdea.length;
		const minChars = 350;
		const isValidLength = charCount >= minChars;
		const hasExamples =
			gameIdea.trim().toLowerCase().includes("example") ||
			gameIdea.trim().toLowerCase().includes("for instance") ||
			gameIdea.trim().toLowerCase().includes("for example") ||
			gameIdea.trim().toLowerCase().includes("such as") ||
			gameIdea.trim().toLowerCase().includes("like") ||
			gameIdea.trim().toLowerCase().includes("e.g.") ||
			gameIdea.trim().toLowerCase().includes("e.g");

		return (
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Submit Your Game Idea</Text>
				<Text style={styles.description}>
					Describe your game idea in detail (minimum 350 characters). Include
					examples of how the game would work. Only submissions with examples
					will be accepted (use the word "example" in your submission).
				</Text>
				<TextInput
					style={[
						styles.input,
						styles.textArea,
						charCount > 0 &&
							(!isValidLength || !hasExamples) &&
							styles.inputError,
					]}
					placeholder="Describe your game idea here... Include examples of gameplay, mechanics, and how players would interact with it..."
					placeholderTextColor={Colors.text.disabled}
					value={gameIdea}
					onChangeText={setGameIdea}
					multiline
					numberOfLines={12}
					textAlignVertical="top"
				/>
				<View style={styles.validationContainer}>
					<Text
						style={[
							styles.helperText,
							!isValidLength && styles.helperTextError,
						]}
					>
						{charCount} / {minChars} characters
						{!isValidLength && ` (minimum ${minChars} required)`}
					</Text>
					{charCount > 0 && (
						<Text
							style={[
								styles.helperText,
								!hasExamples && styles.helperTextError,
								hasExamples && { color: Colors.game.correct },
							]}
						>
							{hasExamples ? "✓ Examples included" : "⚠ Examples required"}
						</Text>
					)}
				</View>
			</View>
		);
	};

	const renderQuickMathForm = () => (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>Create Quick Math Game</Text>
			<Text style={styles.description}>
				Choose the number of questions and difficulty, then enter your questions
				and answers.
			</Text>

			{/* Number of Questions */}
			<View style={styles.selectorContainer}>
				<Text style={styles.label}>Number of Questions</Text>
				<View style={styles.selectorRow}>
					<TouchableOpacity
						style={[
							styles.selectorButton,
							numQuestions === 3 && styles.selectorButtonActive,
						]}
						onPress={() => handleNumQuestionsChange(3)}
					>
						<Text
							style={[
								styles.selectorButtonText,
								numQuestions === 3 && styles.selectorButtonTextActive,
							]}
						>
							3
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[
							styles.selectorButton,
							numQuestions === 5 && styles.selectorButtonActive,
						]}
						onPress={() => handleNumQuestionsChange(5)}
					>
						<Text
							style={[
								styles.selectorButtonText,
								numQuestions === 5 && styles.selectorButtonTextActive,
							]}
						>
							5
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Difficulty */}
			{renderDifficultySelector()}

			{/* Questions and Answers */}
			<Text style={styles.label}>Questions & Answers</Text>
			{Array.from({ length: numQuestions }).map((_, index) => (
				<View key={index} style={styles.questionAnswerRow}>
					<Text style={styles.questionNumber}>Q{index + 1}</Text>
					<View style={styles.questionAnswerContainer}>
						<TextInput
							style={styles.questionInput}
							placeholder={`Question ${index + 1} (e.g., 5 + 3)`}
							placeholderTextColor={Colors.text.disabled}
							value={quickMathQuestions[index]}
							onChangeText={(text) =>
								handleQuickMathQuestionChange(index, text)
							}
						/>
						<TextInput
							style={styles.answerInput}
							placeholder={`Answer ${index + 1}`}
							placeholderTextColor={Colors.text.disabled}
							value={quickMathAnswers[index]}
							onChangeText={(text) => handleQuickMathAnswerChange(index, text)}
							keyboardType="numeric"
						/>
					</View>
				</View>
			))}
		</View>
	);

	return (
		<View style={styles.container}>
			<StatusBar style="light" />

			{/* Header - minimal header for spacing (Dynamic Island) */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				{/* Minimal header for spacing - navigation moved to bottom bar */}
			</View>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<ScrollView
					style={styles.content}
					contentContainerStyle={{
						paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
					}}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					{renderGameTypeSelection()}

					{gameType === "gameIdea" && renderGameIdeaForm()}
					{gameType === "wordle" && renderWordleForm()}
					{gameType === "riddle" && renderRiddleForm()}
					{gameType === "quickMath" && renderQuickMathForm()}

					{!gameType && (
						<View style={styles.infoNote}>
							<Ionicons name="information-circle-outline" size={20} color={Colors.text.secondary} />
							<Text style={styles.infoNoteText}>
								Want to add a new game type? Use "Own Game" to submit your game idea, and we'll review it for future implementation.
							</Text>
						</View>
					)}

					{gameType && (
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
					)}
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	header: {
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
		zIndex: 10,
		...Shadows.medium,
	},
	keyboardView: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Layout.margin,
	},
	section: {
		marginTop: Spacing.xl,
		marginBottom: Spacing.lg,
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
	gameTypeContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "flex-start",
		gap: Spacing.md,
		paddingHorizontal: 0, // Remove any padding to ensure proper calculation
	},
	gameTypeButton: {
		width:
			(Dimensions.get("window").width - Layout.margin * 2 - Spacing.md * 2) / 3, // Exactly 3 columns: (screen width - container padding - gaps) / 3
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		alignItems: "center",
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	gameTypeButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "1A",
	},
	gameTypeText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		marginTop: Spacing.sm,
	},
	gameTypeTextActive: {
		color: Colors.accent,
	},
	input: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
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
	validationContainer: {
		marginTop: Spacing.xs,
		marginBottom: Spacing.md,
	},
	textArea: {
		minHeight: 100,
		textAlignVertical: "top",
		marginBottom: Spacing.md,
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
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
	},
	selectorButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "1A",
	},
	selectorButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	selectorButtonTextActive: {
		color: Colors.accent,
	},
	questionAnswerRow: {
		marginBottom: Spacing.md,
	},
	questionNumber: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.xs,
	},
	questionAnswerContainer: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	questionInput: {
		flex: 2,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	answerInput: {
		flex: 1,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
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
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginLeft: Spacing.sm,
	},
	infoNote: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		marginBottom: Spacing.md,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		gap: Spacing.sm,
	},
	infoNoteText: {
		flex: 1,
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		lineHeight: Typography.fontSize.caption * Typography.lineHeight.normal,
	},
});

// Export the component for use in MainAppContainer
export { CreateGameScreen };
// Default export returns null - MainAppContainer handles rendering
export default function CreateGameRoute() {
	return null;
}
