import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Animated,
	ScrollView,
} from "react-native";
import { GameResult, TriviaData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
} from "../../constants/DesignSystem";

interface TriviaGameProps {
	inputData: TriviaData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
}

const TriviaGame: React.FC<TriviaGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [selectedChoices, setSelectedChoices] = useState<(string | null)[]>(
		new Array(inputData.questions.length).fill(null)
	);
	const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>(
		new Array(inputData.questions.length).fill(false)
	);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
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
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setCompleted(false);
			setCurrentQuestionIndex(0);
			setSelectedChoices(new Array(inputData.questions.length).fill(null));
			setAnsweredQuestions(new Array(inputData.questions.length).fill(false));
			hasAttemptedRef.current = false;
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			setElapsedTime(0);
			setStartTime(propStartTime);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}
	}, [puzzleSignature, propStartTime, startTime, inputData.questions.length]);

	// Timer effect
	useEffect(() => {
		if (completed) {
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
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Trivia</Text>
					<Text style={styles.questionCounter}>
						Question {currentQuestionIndex + 1} of {inputData.questions.length}
					</Text>
				</View>
				<View style={styles.timerBadge}>
					<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
				</View>
			</View>

			{/* Progress bar */}
			<View style={styles.progressBarContainer}>
				<View style={[styles.progressBar, { width: `${progress}%` }]} />
			</View>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
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
		backgroundColor: Colors.background.primary,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.md,
	},
	title: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
	},
	questionCounter: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
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
		backgroundColor: Colors.primary,
		borderRadius: 2,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.lg,
	},
	questionContainer: {
		width: "100%",
		marginBottom: Spacing.lg,
	},
	questionCard: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
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
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderWidth: 2,
		borderColor: "rgba(124, 77, 255, 0.3)",
		...Shadows.light,
		minHeight: 44,
		justifyContent: "center",
	},
	choiceButtonSelected: {
		backgroundColor: Colors.primary + "20",
		borderColor: Colors.primary,
	},
	choiceButtonCorrect: {
		backgroundColor: "#10b98150",
		borderColor: "#10b981",
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
		color: Colors.primary,
		fontWeight: Typography.fontWeight.bold,
	},
	choiceTextCorrect: {
		color: "#10b981",
		fontWeight: Typography.fontWeight.bold,
	},
	choiceTextWrong: {
		color: Colors.error,
		fontWeight: Typography.fontWeight.bold,
	},
	submitButton: {
		backgroundColor: ComponentStyles.button.backgroundColor,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		minHeight: 48,
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
		backgroundColor: Colors.primary,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		minHeight: 48,
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

