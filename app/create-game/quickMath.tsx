import React, { useState, useMemo } from "react";
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

const CreateQuickMathPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [numQuestions, setNumQuestions] = useState<3 | 4>(3);
	const [quickMathQuestions, setQuickMathQuestions] = useState<string[]>(
		Array(3).fill("")
	);
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [quickMathErrors, setQuickMathErrors] = useState<boolean[]>(
		Array(3).fill(false)
	);

	const evaluateExpression = (expression: string): number => {
		let safe = expression.replace(/×/g, "*").replace(/÷/g, "/");
		safe = safe.replace(/[^0-9+\-*/()\s.]/g, "");
		try {
			// eslint-disable-next-line no-eval
			return Math.round((eval(safe) as number) * 1000) / 1000;
		} catch {
			return 0;
		}
	};

	const quickMathAnswers = useMemo(() => {
		const errors: boolean[] = [];
		const answers = quickMathQuestions.map((question, index) => {
			if (!question.trim()) {
				errors[index] = false;
				return "";
			}
			const expression = question.split("=")[0].trim();
			if (!expression) {
				errors[index] = true;
				return "";
			}
			try {
				const result = evaluateExpression(expression);
				if (isNaN(result) || !isFinite(result) || result <= 0) {
					errors[index] = true;
					return "";
				}
				errors[index] = false;
				if (result % 1 === 0) {
					return result.toString();
				} else {
					return (Math.round(result * 10) / 10).toString();
				}
			} catch {
				errors[index] = true;
				return "";
			}
		});
		setQuickMathErrors(errors);
		return answers;
	}, [quickMathQuestions]);

	const handleNumQuestionsChange = (num: 3 | 4) => {
		setNumQuestions(num);
		setQuickMathQuestions(Array(num).fill(""));
		setQuickMathErrors(Array(num).fill(false));
	};

	const handleQuickMathQuestionChange = (index: number, value: string) => {
		const newQuestions = [...quickMathQuestions];
		newQuestions[index] = value;
		setQuickMathQuestions(newQuestions);
	};

	const validateQuickMath = (): boolean => {
		for (let i = 0; i < numQuestions; i++) {
			if (!quickMathQuestions[i]?.trim()) {
				Alert.alert("Validation Error", `Please enter question ${i + 1}.`);
				return false;
			}
		}

		const hasErrors = quickMathErrors.some((error, index) => {
			return error && index < numQuestions;
		});

		if (hasErrors) {
			const errorIndices: number[] = [];
			quickMathErrors.forEach((error, index) => {
				if (error && index < numQuestions) {
					errorIndices.push(index + 1);
				}
			});
			Alert.alert(
				"Validation Error",
				`The following questions have errors:\n${errorIndices.join(
					", "
				)}\n\nPlease fix:\n- Invalid expressions\n- Non-positive answers\n- Division by zero or other calculation errors`
			);
			return false;
		}

		for (let i = 0; i < numQuestions; i++) {
			if (!quickMathAnswers[i] || quickMathAnswers[i] === "") {
				Alert.alert(
					"Validation Error",
					`Question ${
						i + 1
					} could not be evaluated. Please check the expression.`
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

		if (!validateQuickMath()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			await saveGameToFirestore(
				"quickMath",
				difficulty,
				{
					questions: quickMathQuestions.map((q) => q.trim()),
					answers: quickMathAnswers.map((a) => a.trim()),
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Quick Math game has been created successfully!",
				[
					{
						text: "OK",
						onPress: () => router.back(),
					},
				]
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
				<Text style={styles.headerTitle}>Create Quick Math</Text>
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
					<Text style={styles.sectionTitle}>Create Quick Math Game</Text>
					<Text style={styles.description}>
						Choose the number of questions and difficulty, then enter your math
						expressions. Answers will be automatically calculated and displayed.
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
									numQuestions === 4 && styles.selectorButtonActive,
								]}
								onPress={() => handleNumQuestionsChange(4)}
							>
								<Text
									style={[
										styles.selectorButtonText,
										numQuestions === 4 && styles.selectorButtonTextActive,
									]}
								>
									4
								</Text>
							</TouchableOpacity>
						</View>
					</View>

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
					</View>

					{/* Questions and Answers */}
					<Text style={styles.label}>Questions & Answers</Text>
					{Array.from({ length: numQuestions }).map((_, index) => {
						const hasError =
							quickMathErrors[index] && quickMathQuestions[index]?.trim();
						return (
							<View key={index} style={styles.questionAnswerRow}>
								<Text style={styles.questionNumber}>Q{index + 1}</Text>
								<View style={styles.questionAnswerContainer}>
									<TextInput
										style={[
											styles.questionInput,
											hasError && styles.questionInputError,
										]}
										placeholder={`Question ${index + 1} (e.g., 5 + 3)`}
										placeholderTextColor={Colors.text.disabled}
										value={quickMathQuestions[index]}
										onChangeText={(text) =>
											handleQuickMathQuestionChange(index, text)
										}
									/>
									<View
										style={[
											styles.answerDisplay,
											hasError && styles.answerDisplayError,
										]}
									>
										<Text
											style={[
												styles.answerText,
												hasError && styles.answerTextError,
											]}
										>
											{quickMathAnswers[index] || "?"}
										</Text>
									</View>
								</View>
								{hasError && (
									<Text style={styles.errorText}>
										Invalid expression or non-positive answer
									</Text>
								)}
							</View>
						);
					})}

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
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		...Shadows.light,
	},
	questionInputError: {
		borderColor: Colors.error,
		borderWidth: 2,
		backgroundColor: Colors.error + "10",
	},
	answerDisplay: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	answerText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
		textAlign: "center",
	},
	answerDisplayError: {
		borderColor: Colors.error,
		borderWidth: 2,
		backgroundColor: Colors.error + "10",
	},
	answerTextError: {
		color: Colors.error,
	},
	errorText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.error,
		marginTop: Spacing.xs,
		marginLeft: Spacing.sm,
		fontWeight: Typography.fontWeight.medium,
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

export default CreateQuickMathPage;

