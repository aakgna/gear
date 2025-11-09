import React, { useMemo, useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	Animated,
} from "react-native";
import { GameResult, QuickMathData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
	Layout,
} from "../../constants/DesignSystem";

interface QuickMathProps {
	inputData: QuickMathData;
	onComplete: (result: GameResult) => void;
	startTime?: number;
}

function evaluateExpression(expression: string): number {
	// PEMDAS is respected by JS eval for + - * / and parentheses when sanitized.
	// We only allow digits, spaces, parentheses and the operators + - * /.
	const safe = expression.replace(/[^0-9+\-*/()\s.]/g, "");
	// eslint-disable-next-line no-eval
	return Math.round((eval(safe) as number) * 1000) / 1000;
}

const QuickMathGame: React.FC<QuickMathProps> = ({
	inputData,
	onComplete,
	startTime: propStartTime,
}) => {
	const problems = useMemo(
		() => inputData.problems.slice(0, 5),
		[inputData.problems]
	);
	const [answers, setAnswers] = useState<string[]>(
		Array(problems.length).fill("")
	);
	const [submitted, setSubmitted] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Use answers from Firestore instead of evaluating expressions
	const correctAnswers = useMemo(
		() => inputData.answers.slice(0, 5),
		[inputData.answers]
	);

	// Reset timer when puzzle changes (using a unique identifier from inputData)
	const puzzleSignature = `${inputData.problems.join(
		","
	)}-${inputData.answers.join(",")}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setSubmitted(false);
			setFeedback(null);
			setAnswers(Array(problems.length).fill(""));
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			// Reset timer when startTime prop changes (puzzle switch)
			setElapsedTime(0);
			setStartTime(propStartTime);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}
	}, [puzzleSignature, problems.length, propStartTime, startTime]);

	// Timer effect - updates every second
	useEffect(() => {
		if (submitted) {
			// Stop timer when game is completed
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		// Clear any existing interval
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		// Start timer
		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [submitted, startTime]);

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const handleChange = (idx: number, value: string) => {
		// Allow numeric including negative and decimal
		setAnswers((prev) => {
			const next = [...prev];
			next[idx] = value;
			return next;
		});
	};

	const handleSubmit = () => {
		if (submitted) return;

		// Check if all answers are filled
		const allFilled = answers.every((ans) => ans.trim() !== "");
		if (!allFilled) {
			setFeedback("Please fill in all answers before submitting.");
			return;
		}

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		let correct = 0;
		let allCorrect = true;

		for (let i = 0; i < problems.length; i++) {
			const got = answers[i].trim();
			// Parse comma-separated answers from Firestore
			const validAnswers = correctAnswers[i]
				.split(",")
				.map((ans) => ans.trim());

			// Check if user's answer matches any of the valid answers
			const isCorrect = validAnswers.includes(got);

			if (isCorrect) {
				correct++;
			} else {
				allCorrect = false;
			}
		}

		// Only complete if ALL answers are correct
		if (allCorrect) {
			const accuracy = Math.round((correct / problems.length) * 100);
			setSubmitted(true);
			setFeedback(null);
			// Stop timer
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			setElapsedTime(timeTaken);
			// Success animation
			Animated.sequence([
				Animated.timing(successScale, {
					toValue: 1.05,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(successScale, {
					toValue: 1,
					duration: Animation.duration.normal,
					useNativeDriver: true,
				}),
			]).start();
			onComplete({
				puzzleId: `quickmath_${Date.now()}`,
				completed: true,
				timeTaken,
				accuracy,
				completedAt: new Date().toISOString(),
			});
		} else {
			// Show feedback that not all answers are correct
			setFeedback(
				`Not all answers are correct. ${correct}/${problems.length} correct. Try again!`
			);
			// Shake animation for incorrect
			Animated.sequence([
				Animated.timing(shakeAnimation, {
					toValue: 5,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(shakeAnimation, {
					toValue: -5,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(shakeAnimation, {
					toValue: 0,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
			]).start();
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Quick Math</Text>
				<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
			</View>
			<Animated.View
				style={[
					styles.boardContainer,
					{
						transform: [{ translateX: shakeAnimation }],
					},
				]}
			>
				<View style={styles.problemList}>
					{problems.map((p, idx) => (
						<View key={idx} style={styles.problemRow}>
							<Text style={styles.problemText}>{p} =</Text>
							<TextInput
								style={styles.answerInput}
								value={answers[idx]}
								onChangeText={(t) =>
									handleChange(idx, t.replace(/[^0-9\-+.]/g, ""))
								}
								keyboardType="numbers-and-punctuation"
								returnKeyType="done"
								placeholderTextColor={Colors.text.disabled}
							/>
						</View>
					))}
				</View>
			</Animated.View>
			<TouchableOpacity
				style={[styles.submit, submitted && styles.submitDisabled]}
				onPress={handleSubmit}
				disabled={submitted}
				activeOpacity={0.7}
			>
				<Text style={styles.submitText}>Submit</Text>
			</TouchableOpacity>
			{feedback && <Text style={styles.feedback}>{feedback}</Text>}
			{submitted && (
				<Animated.View
					style={[
						styles.completionContainer,
						{
							transform: [{ scale: successScale }],
						},
					]}
				>
					<Text style={styles.completionText}>🎉 Completed!</Text>
					<Text style={styles.completionSubtext}>
						Time: {formatTime(elapsedTime)} • Accuracy: 100%
					</Text>
				</Animated.View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.sm,
		alignItems: "center",
		backgroundColor: Colors.background.primary,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		marginBottom: Spacing.md,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	boardContainer: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
	},
	problemList: {
		width: "100%",
		gap: Spacing.sm,
	},
	problemRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.text.disabled,
		shadowColor: Shadows.light.shadowColor,
		shadowOffset: Shadows.light.shadowOffset,
		shadowOpacity: Shadows.light.shadowOpacity,
		shadowRadius: Shadows.light.shadowRadius,
		elevation: Shadows.light.elevation,
	},
	problemText: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		marginRight: Spacing.sm,
		flexShrink: 1,
		fontWeight: Typography.fontWeight.medium,
	},
	answerInput: {
		width: 90,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.text.disabled,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.primary,
		textAlign: "center",
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.semiBold,
		minHeight: Layout.tapTarget,
	},
	submit: {
		marginTop: Spacing.md,
		backgroundColor: ComponentStyles.button.backgroundColor,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		minHeight: ComponentStyles.button.minHeight,
		alignItems: ComponentStyles.button.alignItems,
		justifyContent: ComponentStyles.button.justifyContent,
	},
	submitText: {
		color: Colors.text.white,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
	submitDisabled: {
		opacity: 0.5,
	},
	feedback: {
		marginTop: Spacing.md,
		fontSize: Typography.fontSize.caption,
		color: Colors.error,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
	},
	completionContainer: {
		marginTop: Spacing.lg,
		padding: Spacing.lg,
		backgroundColor: Colors.accent + "15",
		borderRadius: BorderRadius.md,
		alignItems: "center",
		borderWidth: 2,
		borderColor: Colors.accent,
		shadowColor: Shadows.light.shadowColor,
		shadowOffset: Shadows.light.shadowOffset,
		shadowOpacity: Shadows.light.shadowOpacity,
		shadowRadius: Shadows.light.shadowRadius,
		elevation: Shadows.light.elevation,
	},
	completionText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.sm,
	},
	completionSubtext: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
});

export default QuickMathGame;
