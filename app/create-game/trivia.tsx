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

type Difficulty = "easy" | "medium" | "hard";

interface TriviaQuestion {
	question: string;
	choices: string[];
	correctAnswerIndex: number | null;
}

const CreateTriviaPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);

	const getNumQuestions = (): number => {
		switch (difficulty) {
			case "easy":
				return 3;
			case "medium":
				return 4;
			case "hard":
				return 5;
			default:
				return 3;
		}
	};

	const [questions, setQuestions] = useState<TriviaQuestion[]>(
		Array(getNumQuestions()).fill(null).map(() => ({
			question: "",
			choices: ["", "", "", ""],
			correctAnswerIndex: null,
		}))
	);

	// Update questions when difficulty changes
	React.useEffect(() => {
		const numQuestions = getNumQuestions();
		if (questions.length !== numQuestions) {
			setQuestions(
				Array(numQuestions).fill(null).map(() => ({
					question: "",
					choices: ["", "", "", ""],
					correctAnswerIndex: null,
				}))
			);
		}
	}, [difficulty]);

	const handleQuestionChange = (index: number, value: string) => {
		const newQuestions = [...questions];
		newQuestions[index] = { ...newQuestions[index], question: value };
		setQuestions(newQuestions);
	};

	const handleChoiceChange = (questionIndex: number, choiceIndex: number, value: string) => {
		const newQuestions = [...questions];
		const newChoices = [...newQuestions[questionIndex].choices];
		newChoices[choiceIndex] = value;
		newQuestions[questionIndex] = { ...newQuestions[questionIndex], choices: newChoices };
		setQuestions(newQuestions);
	};

	const handleCorrectAnswerSelect = (questionIndex: number, choiceIndex: number) => {
		const newQuestions = [...questions];
		newQuestions[questionIndex] = { ...newQuestions[questionIndex], correctAnswerIndex: choiceIndex };
		setQuestions(newQuestions);
	};

	const validateTrivia = (): boolean => {
		for (let i = 0; i < questions.length; i++) {
			const q = questions[i];
			if (!q.question.trim()) {
				Alert.alert("Validation Error", `Please enter question ${i + 1}.`);
				return false;
			}
			
			// Check all choices are filled
			for (let j = 0; j < q.choices.length; j++) {
				if (!q.choices[j].trim()) {
					Alert.alert(
						"Validation Error",
						`Please fill all 4 choices for question ${i + 1}.`
					);
					return false;
				}
			}
			
			// Check correct answer is selected
			if (q.correctAnswerIndex === null) {
				Alert.alert(
					"Validation Error",
					`Please mark the correct answer for question ${i + 1}.`
				);
				return false;
			}
			
			// Check for duplicate choices
			const trimmedChoices = q.choices.map((c) => c.trim().toLowerCase());
			const uniqueChoices = new Set(trimmedChoices);
			if (uniqueChoices.size !== q.choices.length) {
				Alert.alert(
					"Validation Error",
					`All choices for question ${i + 1} must be unique.`
				);
				return false;
			}
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

		if (!validateTrivia()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Format questions for Firestore
			const formattedQuestions = questions.map((q) => {
				const correctAnswer = q.choices[q.correctAnswerIndex!].trim();
				const shuffledChoices = q.choices.map((c) => c.trim()).sort(() => Math.random() - 0.5);
				
				return {
				question: q.question.trim(),
					answer: correctAnswer,
					choices: shuffledChoices,
				};
			});

			await saveGameToFirestore(
				"trivia",
				difficulty,
				{
					questions: formattedQuestions,
				},
				user.uid,
				username
			);
			Alert.alert("Success", "Your Trivia game has been created successfully!", [
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
				<Text style={styles.headerTitle}>Create Trivia</Text>
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
					<Text style={styles.sectionTitle}>Create Trivia Game</Text>
					<Text style={styles.description}>
					Create multiple-choice trivia questions. Enter 4 choices and mark the correct one.
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
						<Text style={styles.helperText}>
							{getNumQuestions()} question{getNumQuestions() !== 1 ? "s" : ""} required
						</Text>
					</View>

					{/* Questions */}
					{questions.map((q, qIndex) => (
						<View key={qIndex} style={styles.questionContainer}>
							<Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
						<Text style={styles.inputLabel}>Question</Text>
							<TextInput
								style={[styles.input, styles.textArea]}
								placeholder="Enter question..."
								placeholderTextColor={Colors.text.disabled}
								value={q.question}
							onChangeText={(text) => handleQuestionChange(qIndex, text)}
								multiline
								numberOfLines={2}
							/>
						<Text style={styles.inputLabel}>
							Answer Choices (mark correct answer)
						</Text>
							{q.choices.map((choice, cIndex) => (
							<View key={cIndex} style={styles.answerRow}>
								<TouchableOpacity
									style={styles.radioButton}
									onPress={() => handleCorrectAnswerSelect(qIndex, cIndex)}
								>
									<View
										style={[
											styles.radioCircle,
											q.correctAnswerIndex === cIndex && styles.radioCircleSelected,
										]}
									>
										{q.correctAnswerIndex === cIndex && (
											<View style={styles.radioInner} />
										)}
									</View>
								</TouchableOpacity>
								<TextInput
									style={[
										styles.input,
										styles.answerInput,
										q.correctAnswerIndex === cIndex && styles.correctInput,
									]}
									placeholder={`Choice ${cIndex + 1}...`}
									placeholderTextColor={Colors.text.disabled}
									value={choice}
									onChangeText={(text) =>
										handleChoiceChange(qIndex, cIndex, text)
									}
								/>
							</View>
							))}
						</View>
					))}

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
		marginTop: Spacing.md,
	},
	inputLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	helperText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
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
	questionContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	questionNumber: {
		fontSize: Typography.fontSize.h4,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.md,
	},
	input: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		marginBottom: Spacing.md,
		...Shadows.light,
	},
	textArea: {
		minHeight: 60,
		textAlignVertical: "top",
	},
	answerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.sm,
		gap: Spacing.sm,
	},
	radioButton: {
		padding: Spacing.xs,
	},
	radioCircle: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.secondary,
	},
	radioCircleSelected: {
		borderColor: Colors.game.correct,
		borderWidth: 2,
	},
	radioInner: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: Colors.game.correct,
	},
	answerInput: {
		flex: 1,
		marginBottom: 0,
	},
	correctInput: {
		borderColor: Colors.game.correct,
		backgroundColor: Colors.game.correct + "10",
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

export default CreateTriviaPage;

