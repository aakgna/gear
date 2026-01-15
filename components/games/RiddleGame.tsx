import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Animated,
	ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

interface RiddleGameProps {
	inputData: RiddleData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

const RiddleGame: React.FC<RiddleGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const gameColor = getGameColor("riddle"); // Get game-specific orange color (#F59E0B)
	const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false); // Track if user has made first interaction
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Reset timer when puzzle changes (using prompt and answer as unique identifier)
	const puzzleSignature = `${inputData.prompt}-${inputData.answer}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setCompleted(false);
			setSelectedChoice(null);
			setFeedback(null);
			setAttempts(0);
			hasAttemptedRef.current = false; // Reset attempted flag for new puzzle
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			// Only set startTime if propStartTime is provided
			if (propStartTime) {
				setStartTime(propStartTime);
			} else {
				setStartTime(undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			// startTime prop changed - could be initial start or resume from pause
			// Calculate elapsed time from new startTime to maintain continuity
			const newElapsed = Math.floor((Date.now() - propStartTime) / 1000);
			setElapsedTime(newElapsed);
			setStartTime(propStartTime);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}
	}, [puzzleSignature, propStartTime, startTime]);

	// Timer effect - updates every second (only if startTime is set and game is active)
	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (completed) {
			// Stop timer when game is completed
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (!isActive) {
			// Pause timer when game is not active
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
		if (!selectedChoice) return;

		const correctAnswer = inputData.answer.trim().toLowerCase();
		const isCorrect = selectedChoice.toLowerCase() === correctAnswer;
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
				puzzleId: puzzleId || `riddle_${Date.now()}`,
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

	const handleChoiceSelect = (choice: string) => {
		if (completed) return;

		// Track first interaction
		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		setSelectedChoice(choice);
		setFeedback(null);
	};

	const scrollViewRef = useRef<ScrollView>(null);

	return (
		<View style={styles.container}>
			<GameHeader
				title="Riddle"
				elapsedTime={elapsedTime}
				showDifficulty={false}
			/>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg },
				]}
				showsVerticalScrollIndicator={false}
			>
				<Animated.View
					style={[
						styles.promptContainer,
						{
							transform: [{ translateX: shakeAnimation }],
						},
					]}
				>
					<View style={styles.promptCard}>
						<Text style={styles.prompt}>{inputData.prompt}</Text>
					</View>
				</Animated.View>

				{inputData.hint && (
					<View style={styles.hintContainer}>
						<Text style={styles.hintLabel}>💡 Hint:</Text>
						<Text style={styles.hint}>{inputData.hint}</Text>
					</View>
				)}

				<View style={styles.choicesContainer}>
					{inputData.choices.map((choice, index) => {
						const isSelected = selectedChoice === choice;
						const correctAnswer = inputData.answer.trim().toLowerCase();
						const isCorrect = choice.toLowerCase() === correctAnswer;
						const showCorrect = completed && isCorrect;
						const showWrong = completed && isSelected && !isCorrect;

						return (
							<TouchableOpacity
								key={index}
								style={[
									styles.choiceButton,
									isSelected && !completed && styles.choiceButtonSelected,
									showCorrect && styles.choiceButtonCorrect,
									showWrong && styles.choiceButtonWrong,
								]}
								onPress={() => handleChoiceSelect(choice)}
								activeOpacity={0.7}
								disabled={completed}
							>
								<Text
									style={[
										styles.choiceText,
										isSelected && !completed && styles.choiceTextSelected,
										showCorrect && styles.choiceTextCorrect,
										showWrong && styles.choiceTextWrong,
									]}
								>
									{choice}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>

				{feedback && !completed && (
					<View style={styles.feedbackContainer}>
						<Text style={styles.feedback}>{feedback}</Text>
					</View>
				)}

				<TouchableOpacity
					style={[
						styles.submit,
						(!selectedChoice || completed) && styles.submitDisabled,
					]}
					onPress={completed ? onShowStats : submit}
					activeOpacity={0.7}
					disabled={!selectedChoice && !completed}
				>
					<Text style={styles.submitText}>
						{completed ? "Submitted, View Stats" : "Submit Answer"}
					</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.md,
		marginBottom: Spacing.lg,
	},
	title: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
	},
	timerBadge: {
		backgroundColor: Colors.accent + "20",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
	},
	promptContainer: {
		width: "100%",
		marginBottom: Spacing.lg,
	},
	promptCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.xl,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		...Shadows.medium,
		alignItems: "center",
	},
	prompt: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: Typography.fontSize.body * 1.4,
		fontWeight: Typography.fontWeight.medium,
	},
	hintContainer: {
		backgroundColor: "#F59E0B10", // Game-specific orange with opacity
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1.5,
		borderColor: "#F59E0B30",
		...Shadows.light,
	},
	hintLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: "#F59E0B", // Game-specific orange
		marginBottom: Spacing.xs,
	},
	hint: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		lineHeight: Typography.fontSize.caption * 1.4,
		fontStyle: "italic",
	},
	choicesContainer: {
		marginBottom: Spacing.md,
		gap: Spacing.sm,
	},
	choiceButton: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		...Shadows.light,
		minHeight: 56,
		justifyContent: "center",
	},
	choiceButtonSelected: {
		backgroundColor: "#F59E0B20", // Game-specific orange with opacity
		borderColor: "#F59E0B", // Game-specific orange
		borderWidth: 2.5,
		...Shadows.medium,
	},
	choiceButtonCorrect: {
		backgroundColor: Colors.game.correct + "50",
		borderColor: Colors.game.correct,
		borderWidth: 3,
	},
	choiceButtonWrong: {
		backgroundColor: Colors.error + "20",
		borderColor: Colors.error,
		borderWidth: 3,
	},
	choiceText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
	},
	choiceTextSelected: {
		color: "#F59E0B", // Game-specific orange
		fontWeight: Typography.fontWeight.bold,
	},
	choiceTextCorrect: {
		color: Colors.game.correct,
		fontWeight: Typography.fontWeight.bold,
	},
	choiceTextWrong: {
		color: Colors.error,
		fontWeight: Typography.fontWeight.bold,
	},
	submit: {
		backgroundColor: "#F59E0B", // Game-specific orange
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: ComponentStyles.button.alignItems,
		justifyContent: ComponentStyles.button.justifyContent,
		width: "100%",
		...Shadows.medium,
		marginBottom: Spacing.sm,
	},
	submitText: {
		color: Colors.text.white,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
	submitDisabled: {
		opacity: 0.5,
	},
	feedbackContainer: {
		marginBottom: Spacing.md,
		padding: Spacing.sm,
		backgroundColor: Colors.error + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.error + "40",
	},
	feedback: {
		fontSize: Typography.fontSize.caption,
		color: Colors.error,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
	},
	completionContainer: {
		marginTop: Spacing.xl,
		padding: Spacing.xxl,
		backgroundColor: "#F59E0B10", // Game-specific orange with opacity
		borderRadius: BorderRadius.xl,
		alignItems: "center",
		borderWidth: 2.5,
		borderColor: "#F59E0B", // Game-specific orange
		...Shadows.heavy,
	},
	completionEmoji: {
		fontSize: 56,
		marginBottom: Spacing.md,
	},
	completionText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: "#F59E0B", // Game-specific orange
		marginBottom: Spacing.lg,
		letterSpacing: -0.5,
	},
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xl,
	},
	statItem: {
		alignItems: "center",
		gap: Spacing.xs,
	},
	statLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	statValue: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
		fontFamily: Typography.fontFamily.monospace,
	},
	statDivider: {
		width: 1,
		height: 32,
		backgroundColor: "rgba(255, 255, 255, 0.2)",
	},
});

export default RiddleGame;
