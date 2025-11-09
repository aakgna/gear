import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	Animated,
} from "react-native";
import { GameResult, RiddleData } from "../../config/types";
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

interface RiddleGameProps {
	inputData: RiddleData;
	onComplete: (result: GameResult) => void;
	startTime?: number;
}

const RiddleGame: React.FC<RiddleGameProps> = ({
	inputData,
	onComplete,
	startTime: propStartTime,
}) => {
	const [guess, setGuess] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Reset timer when puzzle changes (using prompt and answer as unique identifier)
	const puzzleSignature = `${inputData.prompt}-${inputData.answer}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setCompleted(false);
			setGuess("");
			setFeedback(null);
			setAttempts(0);
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
	}, [puzzleSignature, propStartTime, startTime]);

	// Timer effect - updates every second
	useEffect(() => {
		if (completed) {
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
	}, [completed, startTime]);

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const submit = () => {
		const normalized = guess.trim().toLowerCase();
		if (!normalized) return;

		// Parse comma-separated answers from Firestore
		const validAnswers = inputData.answer
			.split(",")
			.map((ans) => ans.trim().toLowerCase());

		const isCorrect = validAnswers.includes(normalized);
		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		setAttempts((a) => a + 1);
		if (isCorrect) {
			// Stop timer
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			setElapsedTime(timeTaken);
			setCompleted(true);
			setFeedback("Correct!");
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
				puzzleId: `riddle_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts + 1,
				completedAt: new Date().toISOString(),
			});
		} else {
			setFeedback("Try again.");
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
				<Text style={styles.title}>Riddle</Text>
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
				<Text style={styles.prompt}>{inputData.prompt}</Text>
			</Animated.View>
			<TextInput
				style={styles.input}
				value={guess}
				onChangeText={setGuess}
				autoCapitalize="none"
				autoCorrect={false}
				placeholder="Your answer"
				placeholderTextColor={Colors.text.disabled}
				returnKeyType="done"
				onSubmitEditing={submit}
			/>
			<TouchableOpacity
				style={styles.submit}
				onPress={submit}
				activeOpacity={0.7}
			>
				<Text style={styles.submitText}>Submit</Text>
			</TouchableOpacity>
			{inputData.hint && (
				<Text style={styles.hint}>Hint: {inputData.hint}</Text>
			)}
			{feedback && (
				<Text
					style={[
						styles.feedback,
						completed ? styles.feedbackSuccess : styles.feedbackError,
					]}
				>
					{feedback}
				</Text>
			)}
			{completed && (
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
						Time: {formatTime(elapsedTime)} • Attempts: {attempts}
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
		marginBottom: Spacing.sm,
		paddingHorizontal: Spacing.md,
	},
	prompt: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: Typography.fontSize.h3 * Typography.lineHeight.normal,
		fontWeight: Typography.fontWeight.medium,
	},
	input: {
		width: "100%",
		borderWidth: 1,
		borderColor: Colors.text.disabled,
		borderRadius: BorderRadius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		backgroundColor: Colors.background.primary,
		fontSize: Typography.fontSize.body,
		textAlign: "center",
		color: Colors.text.primary,
		minHeight: Layout.tapTarget,
		shadowColor: Shadows.light.shadowColor,
		shadowOffset: Shadows.light.shadowOffset,
		shadowOpacity: Shadows.light.shadowOpacity,
		shadowRadius: Shadows.light.shadowRadius,
		elevation: Shadows.light.elevation,
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
	hint: {
		marginTop: Spacing.sm,
		color: Colors.text.secondary,
		fontSize: Typography.fontSize.caption,
		fontStyle: "italic",
	},
	feedback: {
		marginTop: Spacing.sm,
		fontWeight: Typography.fontWeight.semiBold,
		fontSize: Typography.fontSize.body,
	},
	feedbackSuccess: {
		color: Colors.accent,
	},
	feedbackError: {
		color: Colors.error,
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

export default RiddleGame;
