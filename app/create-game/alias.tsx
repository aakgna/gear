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

const CreateAliasPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [definitions, setDefinitions] = useState<string[]>(["", "", ""]);
	const [answers, setAnswers] = useState<string[]>(["", "", ""]);
	const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);

	// Get number of answer choices based on difficulty
	const getAnswerCount = (): number => {
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

	// Update answers array when difficulty changes
	React.useEffect(() => {
		const count = getAnswerCount();
		setAnswers((prev) => {
			const newAnswers = [...prev];
			// Add empty strings if we need more
			while (newAnswers.length < count) {
				newAnswers.push("");
			}
			// Trim if we need fewer
			if (newAnswers.length > count) {
				newAnswers.splice(count);
			}
			return newAnswers;
		});
		// Reset correct answer if it's out of bounds
		if (correctAnswerIndex !== null && correctAnswerIndex >= count) {
			setCorrectAnswerIndex(null);
		}
	}, [difficulty]);

	const handleDefinitionChange = (index: number, value: string) => {
		const newDefinitions = [...definitions];
		newDefinitions[index] = value;
		setDefinitions(newDefinitions);
	};

	const validateAlias = (): boolean => {
		// Check all definitions are filled (fixed 3 definitions)
		for (let i = 0; i < 3; i++) {
			if (!definitions[i]?.trim()) {
				Alert.alert("Validation Error", `Please enter definition ${i + 1}.`);
				return false;
			}
		}

		// Check all answers are filled
		for (let i = 0; i < answers.length; i++) {
			if (!answers[i].trim()) {
				Alert.alert("Validation Error", `Please fill in answer choice ${i + 1}.`);
				return false;
			}
		}

		// Check correct answer is selected
		if (correctAnswerIndex === null) {
			Alert.alert("Validation Error", "Please mark one answer as correct.");
			return false;
		}

		// Check for duplicate answers
		const trimmedAnswers = answers.map((a) => a.trim().toLowerCase());
		const uniqueAnswers = new Set(trimmedAnswers);
		if (uniqueAnswers.size !== answers.length) {
			Alert.alert("Validation Error", "All answers must be unique.");
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

		if (!validateAlias()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Get correct answer and shuffle all choices
			const correctAnswer = answers[correctAnswerIndex!].trim();
			const allChoices = answers.map((a) => a.trim()).sort(() => Math.random() - 0.5);

			await saveGameToFirestore(
				"alias",
				difficulty,
				{
					definitions: definitions.slice(0, 3).map((d) => d.trim()),
					answer: correctAnswer,
					choices: allChoices,
				},
				user.uid,
				username
			);
			Alert.alert("Success", "Your Alias game has been created successfully!", [
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
				<Text style={styles.headerTitle}>Create Alias</Text>
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
					<Text style={styles.sectionTitle}>Create Alias Game</Text>
					<Text style={styles.description}>
					Enter 3 cryptic definitions that all describe the same word. Then provide answer choices and mark the correct one.
					</Text>

					{/* Difficulty */}
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
						{difficulty === "easy"
							? "3 answer choices"
							: difficulty === "medium"
								? "4 answer choices"
								: "5 answer choices"}
					</Text>
					</View>

					{/* Definitions */}
				<View style={styles.inputContainer}>
					<Text style={styles.inputLabel}>Definitions</Text>
					<Text style={styles.helperText}>
						Enter 3 cryptic clues that describe the same word
					</Text>
					{Array.from({ length: 3 }).map((_, index) => (
						<TextInput
							key={index}
							style={[styles.input, styles.textArea]}
							placeholder={`Definition ${index + 1}...`}
							placeholderTextColor={Colors.text.disabled}
							value={definitions[index]}
							onChangeText={(text) => handleDefinitionChange(index, text)}
							multiline
							numberOfLines={2}
						/>
					))}
				</View>

				{/* Answer Choices */}
				<View style={styles.inputContainer}>
					<Text style={styles.inputLabel}>
						Answer Choices (mark correct answer)
					</Text>
					{answers.map((answer, index) => (
						<View key={index} style={styles.answerRow}>
							<TouchableOpacity
								style={styles.radioButton}
								onPress={() => setCorrectAnswerIndex(index)}
							>
								<View
									style={[
										styles.radioCircle,
										correctAnswerIndex === index && styles.radioCircleSelected,
									]}
								>
									{correctAnswerIndex === index && (
										<View style={styles.radioInner} />
									)}
								</View>
							</TouchableOpacity>
					<TextInput
								style={[
									styles.input,
									styles.answerInput,
									correctAnswerIndex === index && styles.correctInput,
								]}
								placeholder={`Answer choice ${index + 1}...`}
						placeholderTextColor={Colors.text.disabled}
						value={answer}
								onChangeText={(text) => {
									const newAnswers = [...answers];
									newAnswers[index] = text;
									setAnswers(newAnswers);
								}}
					/>
						</View>
					))}
				</View>

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
		backgroundColor: Colors.background.primary,
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
	inputContainer: {
		marginBottom: Spacing.lg,
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
		backgroundColor: Colors.background.primary,
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

export default CreateAliasPage;

