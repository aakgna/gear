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
import { GameResult, TriviaData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

interface TriviaGameProps {
	inputData: TriviaData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}

const TriviaGame: React.FC<TriviaGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
	initialCompletedResult,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const gameColor = getGameColor("trivia"); // Get game-specific teal color (#14B8A6)
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [selectedChoices, setSelectedChoices] = useState<(string | null)[]>(
		new Array(inputData.questions.length).fill(null)
	);
	const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>(
		new Array(inputData.questions.length).fill(false)
	);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;
	const scrollViewRef = useRef<ScrollView>(null);

	// Reset timer when puzzle changes
	const puzzleSignature = `${inputData.questions[0]?.question}-${inputData.questions.length}`;

	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			
			// Restore from initialCompletedResult if provided
			if (initialCompletedResult && initialCompletedResult.completed) {
				setCompleted(true);
				setElapsedTime(initialCompletedResult.timeTaken);
				// Restore selected choices to correct answers
				const correctChoices = inputData.questions.map((q) => q.correctAnswer);
				setSelectedChoices(correctChoices);
				setAnsweredQuestions(new Array(inputData.questions.length).fill(true));
				setCurrentQuestionIndex(inputData.questions.length - 1);
				hasAttemptedRef.current = true;
				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
				}
				setStartTime(undefined);
			} else {
				setElapsedTime(0);
				setCompleted(false);
				setCurrentQuestionIndex(0);
				setSelectedChoices(new Array(inputData.questions.length).fill(null));
				setAnsweredQuestions(new Array(inputData.questions.length).fill(false));
				hasAttemptedRef.current = false;
				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
				}
				// Only set startTime if propStartTime is provided
				if (propStartTime) {
					setStartTime(propStartTime);
				} else {
					setStartTime(undefined);
				}
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
	}, [puzzleSignature, propStartTime, startTime, inputData.questions.length, initialCompletedResult, inputData.questions]);

	// Timer effect (only if startTime is set and game is active)
	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (completed) {
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

		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [completed, startTime]);

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const handleChoiceSelect = (choice: string) => {
		if (answeredQuestions[currentQuestionIndex] || completed) return;

		// Track first interaction
		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		const newSelectedChoices = [...selectedChoices];
		newSelectedChoices[currentQuestionIndex] = choice;
		setSelectedChoices(newSelectedChoices);
	};

	const handleSubmit = () => {
		const currentQuestion = inputData.questions[currentQuestionIndex];
		const selectedChoice = selectedChoices[currentQuestionIndex];

		if (!selectedChoice) return;

		// Mark this question as answered
		const newAnsweredQuestions = [...answeredQuestions];
		newAnsweredQuestions[currentQuestionIndex] = true;
		setAnsweredQuestions(newAnsweredQuestions);

		// Complete game on last answer so social overlay shows immediately
		if (currentQuestionIndex === inputData.questions.length - 1) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			const timeTaken = startTime != null ? Math.floor((Date.now() - startTime) / 1000) : 0;
			setElapsedTime(timeTaken);
			setCompleted(true);
			const finalChoices = [...selectedChoices];
			finalChoices[currentQuestionIndex] = selectedChoice;
			const correctAnswers = finalChoices.filter(
				(c, i) => c && inputData.questions[i].answer.toLowerCase() === c.toLowerCase()
			).length;
			const totalQuestions = inputData.questions.length;
			onComplete({
				puzzleId: puzzleId || `trivia_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: correctAnswers,
				mistakes: totalQuestions - correctAnswers,
				accuracy: (correctAnswers / totalQuestions) * 100,
				completedAt: new Date().toISOString(),
			});
		}

		const isCorrect =
			selectedChoice.toLowerCase() === currentQuestion.answer.toLowerCase();

		if (isCorrect) {
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
		} else {
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

	const handleNext = () => {
		if (currentQuestionIndex < inputData.questions.length - 1) {
			setCurrentQuestionIndex(currentQuestionIndex + 1);
			// Scroll to top when moving to next question
			setTimeout(() => {
				scrollViewRef.current?.scrollTo({ y: 0, animated: true });
			}, 100);
		}
	};

	const handleViewStats = () => {
		if (completed) {
			if (onShowStats) {
				onShowStats();
			}
			return;
		}

		// Calculate final stats
		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		const correctAnswers = selectedChoices.filter((choice, index) => {
			if (!choice) return false;
			return (
				choice.toLowerCase() ===
				inputData.questions[index].answer.toLowerCase()
			);
		}).length;
		const totalQuestions = inputData.questions.length;

		// Stop timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		setElapsedTime(timeTaken);
		setCompleted(true);

		onComplete({
			puzzleId: puzzleId || `trivia_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts: correctAnswers, // Number of correct answers for trivia
			mistakes: totalQuestions - correctAnswers, // Number of wrong answers
			accuracy: (correctAnswers / totalQuestions) * 100,
			completedAt: new Date().toISOString(),
		});

		if (onShowStats) {
			onShowStats();
		}
	};

	const currentQuestion = inputData.questions[currentQuestionIndex];
	const currentSelected = selectedChoices[currentQuestionIndex];
	const isCurrentAnswered = answeredQuestions[currentQuestionIndex];
	const isLastQuestion = currentQuestionIndex === inputData.questions.length - 1;

	// Calculate progress
	const answeredCount = answeredQuestions.filter((a) => a).length;
	const progress = (answeredCount / inputData.questions.length) * 100;

	return (
		<View style={styles.container}>
			<GameHeader
				title="Trivia"
				elapsedTime={elapsedTime}
				showDifficulty={false}
				gameType="trivia"
				subtitle={`Question ${currentQuestionIndex + 1} of ${inputData.questions.length}`}
				puzzleId={puzzleId}
			/>

			{/* Progress bar */}
			<View style={styles.progressBarContainer}>
				<View style={[styles.progressBar, { width: `${progress}%` }]} />
			</View>

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
						styles.questionContainer,
						{
							transform: [{ translateX: shakeAnimation }],
						},
					]}
				>
					<View style={styles.questionCard}>
						<Text style={styles.question}>{currentQuestion.question}</Text>
					</View>
				</Animated.View>

				<View style={styles.choicesContainer}>
					{currentQuestion.choices.map((choice, index) => {
						const isSelected = currentSelected === choice;
						const correctAnswer = currentQuestion.answer.trim().toLowerCase();
						const isCorrect = choice.toLowerCase() === correctAnswer;
						const showCorrect = isCurrentAnswered && isCorrect;
						const showWrong = isCurrentAnswered && isSelected && !isCorrect;

						return (
							<TouchableOpacity
								key={index}
								style={[
									styles.choiceButton,
									isSelected && !isCurrentAnswered && styles.choiceButtonSelected,
									showCorrect && styles.choiceButtonCorrect,
									showWrong && styles.choiceButtonWrong,
								]}
								onPress={() => handleChoiceSelect(choice)}
								activeOpacity={0.7}
								disabled={isCurrentAnswered}
							>
								<Text
									style={[
										styles.choiceText,
										isSelected &&
											!isCurrentAnswered &&
											styles.choiceTextSelected,
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

				{!isCurrentAnswered ? (
					<TouchableOpacity
						style={[
							styles.submitButton,
							!currentSelected && styles.submitButtonDisabled,
						]}
						onPress={handleSubmit}
						activeOpacity={0.7}
						disabled={!currentSelected}
					>
						<Text style={styles.submitButtonText}>Submit Answer</Text>
					</TouchableOpacity>
				) : isLastQuestion ? (
					<TouchableOpacity
						style={styles.submitButton}
						onPress={handleViewStats}
						activeOpacity={0.7}
					>
						<Text style={styles.submitButtonText}>View Stats</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						style={styles.nextButton}
						onPress={handleNext}
						activeOpacity={0.7}
					>
						<Text style={styles.nextButtonText}>Next Question →</Text>
					</TouchableOpacity>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
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
		marginBottom: Spacing.xs,
	},
	questionCounter: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	timerBadge: {
		backgroundColor: "#14B8A615", // Game-specific teal with opacity
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#14B8A640",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#14B8A6", // Game-specific teal
		fontFamily: Typography.fontFamily.monospace,
	},
	progressBarContainer: {
		height: 4,
		backgroundColor: Colors.background.secondary,
		marginHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
		borderRadius: 2,
		overflow: "hidden",
	},
	progressBar: {
		height: "100%",
		backgroundColor: "#14B8A6", // Game-specific teal
		borderRadius: 2,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
	},
	questionContainer: {
		width: "100%",
		marginBottom: Spacing.lg,
	},
	questionCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.xl,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		...Shadows.medium,
		alignItems: "center",
	},
	question: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: Typography.fontSize.body * 1.4,
		fontWeight: Typography.fontWeight.medium,
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
		backgroundColor: "#14B8A620", // Game-specific teal with opacity
		borderColor: "#14B8A6", // Game-specific teal
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
		color: "#14B8A6", // Game-specific teal
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
	submitButton: {
		backgroundColor: "#14B8A6", // Game-specific teal
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
		marginBottom: Spacing.sm,
	},
	submitButtonText: {
		color: Colors.text.white,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
	submitButtonDisabled: {
		opacity: 0.5,
	},
	nextButton: {
		backgroundColor: "#14B8A6", // Game-specific teal
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
	},
	nextButtonText: {
		color: Colors.text.white,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
});

export default TriviaGame;

