import React, { useMemo, useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	Animated,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

interface QuickMathProps {
	inputData: QuickMathData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

function evaluateExpression(expression: string): number {
	// PEMDAS is respected by JS eval for + - * / and parentheses when sanitized.
	// Replace × with * and ÷ with / for evaluation
	// We only allow digits, spaces, parentheses and the operators + - * /.
	let safe = expression.replace(/×/g, "*").replace(/÷/g, "/");
	safe = safe.replace(/[^0-9+\-*/()\s.]/g, "");
	// eslint-disable-next-line no-eval
	return Math.round((eval(safe) as number) * 1000) / 1000;
}

const QuickMathGame: React.FC<QuickMathProps> = ({
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
	const gameColor = getGameColor("quickMath"); // Get game-specific red color (#EF4444)
	const problems = useMemo(
		() => inputData.problems.slice(0, 5),
		[inputData.problems]
	);
	
	const [answers, setAnswers] = useState<string[]>(
		Array(problems.length).fill("")
	);
	const [submitted, setSubmitted] = useState(false);
	const [answerRevealed, setAnswerRevealed] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [mistakes, setMistakes] = useState(0); // Track number of incorrect submissions
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false); // Track if user has made first interaction
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Reset timer when puzzle changes (using a unique identifier from inputData)
	const puzzleSignature = `${inputData.problems.join(
		","
	)}-${inputData.answers.join(",")}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setSubmitted(false);
			setAnswerRevealed(false);
			setFeedback(null);
			setAnswers(Array(problems.length).fill(""));
			setMistakes(0);
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
	}, [puzzleSignature, problems.length, propStartTime, startTime]);

	// Timer effect - updates every second (only if startTime is set and game is active)
	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (submitted || answerRevealed) {
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
	}, [submitted, answerRevealed, startTime]);

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
		// Track first interaction (user started attempting the game)
		if (!hasAttemptedRef.current && value.length > 0 && puzzleId) {
			hasAttemptedRef.current = true;

			// Update session tracking in feed.tsx
			// Firestore will be updated only if user skips after attempting
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		// Filter to only allow digits, minus sign, and decimal point
		let filtered = value.replace(/[^0-9\-.]/g, "");
		
		// Handle minus sign - only allow at the start
		if (filtered.includes("-")) {
			const minusIndex = filtered.indexOf("-");
			if (minusIndex !== 0) {
				filtered = filtered.replace(/-/g, "");
			} else {
				// Remove any other minus signs
				filtered = "-" + filtered.replace(/-/g, "");
			}
		}
		
		// Handle decimal point - only allow one, and limit to one decimal place
		const decimalIndex = filtered.indexOf(".");
		if (decimalIndex !== -1) {
			// Remove any additional decimal points
			const parts = filtered.split(".");
			if (parts.length > 2) {
				filtered = parts[0] + "." + parts.slice(1).join("");
			}
			
			// Limit to one digit after decimal point
			if (parts.length >= 2 && parts[1].length > 1) {
				filtered = parts[0] + "." + parts[1].substring(0, 1);
			}
		}
		
		setAnswers((prev) => {
			const next = [...prev];
			next[idx] = filtered;
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

		const timeTaken = startTime
			? Math.floor((Date.now() - startTime) / 1000)
			: 0;
		let correct = 0;
		let allCorrect = true;

		for (let i = 0; i < problems.length; i++) {
			const got = answers[i].trim();
			
			// Extract the expression part (before the = sign if present)
			const expression = problems[i].split("=")[0].trim();
			
			try {
				// Evaluate the expression
				const result = evaluateExpression(expression);
				
				// Round to tenths place (one decimal place)
				const roundedResult = Math.round(result * 10) / 10;
				
				// Parse user's answer and round to tenths place
				const userAnswerNum = parseFloat(got);
				if (isNaN(userAnswerNum)) {
					allCorrect = false;
					continue;
				}
				const roundedUserAnswer = Math.round(userAnswerNum * 10) / 10;
				
				// Compare rounded values with small tolerance for floating point precision
				const isCorrect = Math.abs(roundedResult - roundedUserAnswer) < 0.05;
				
				if (isCorrect) {
					correct++;
				} else {
					allCorrect = false;
				}
			} catch (error) {
				// If evaluation fails, mark as incorrect
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
				puzzleId: puzzleId || `quickmath_${Date.now()}`,
				completed: true,
				timeTaken,
				accuracy,
				mistakes,
				completedAt: new Date().toISOString(),
			});
		} else {
			// Increment mistakes counter
			setMistakes((prev) => prev + 1);
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

	const handleShowAnswer = () => {
		if (submitted || answerRevealed) return;

		// Fill in all answers from inputData.answers
		if (inputData.answers && inputData.answers.length === problems.length) {
			setAnswers([...inputData.answers]);
		}
		setAnswerRevealed(true);
		setSubmitted(true);

		// Stop timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		const timeTaken = startTime
			? Math.floor((Date.now() - startTime) / 1000)
			: 0;
		setElapsedTime(timeTaken);

		// Mark as completed with answer revealed
		onComplete({
			puzzleId: puzzleId || `quickmath_${Date.now()}`,
			completed: true,
			timeTaken,
			accuracy: 100,
			mistakes,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scrollViewRef = useRef<ScrollView>(null);
	const inputRowRefs = useRef<(View | null)[]>([]);
	const inputRowYPositionsRef = useRef<number[]>([]);
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	useEffect(() => {
		const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
			setKeyboardHeight(e.endCoordinates.height);
		});
		const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
			setKeyboardHeight(0);
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, []);

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			keyboardVerticalOffset={0}
		>
			<GameHeader
				title="Quick Math"
				elapsedTime={elapsedTime}
				showDifficulty={false}
				gameType="quickMath"
				puzzleId={puzzleId}
			/>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingBottom:
							keyboardHeight > 0
								? keyboardHeight + 100
								: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
					},
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				scrollEnabled={true}
			>
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
							<View
								key={idx}
								ref={(ref) => (inputRowRefs.current[idx] = ref)}
								style={styles.problemRow}
								onLayout={(e) => {
									// Store the Y position of each input row
									inputRowYPositionsRef.current[idx] = e.nativeEvent.layout.y;
								}}
							>
								<View style={styles.problemNumberBadge}>
									<Text style={styles.problemNumber}>{idx + 1}</Text>
								</View>
								<Text style={styles.problemText}>{p}</Text>
								<Text style={styles.equalSign}>=</Text>
								<TextInput
									ref={(ref) => (inputRefs.current[idx] = ref)}
									style={styles.answerInput}
									value={answers[idx]}
									onChangeText={(t) => handleChange(idx, t)}
									keyboardType="default"
									returnKeyType="done"
									placeholderTextColor={Colors.text.disabled}
									placeholder="?"
									editable={!submitted && !answerRevealed}
									onFocus={() => {
										// Scroll to input when focused
										setTimeout(() => {
											if (
												scrollViewRef.current &&
												inputRowYPositionsRef.current[idx] !== undefined
											) {
												scrollViewRef.current.scrollTo({
													y: Math.max(
														0,
														inputRowYPositionsRef.current[idx] - 150
													),
													animated: true,
												});
											}
										}, 300);
									}}
								/>
							</View>
						))}
					</View>
				</Animated.View>

				{!submitted ? (
					<TouchableOpacity
						style={styles.submit}
						onPress={handleSubmit}
						activeOpacity={0.7}
					>
						<Text style={styles.submitText}>Submit Answers</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						style={styles.submit}
						onPress={onShowStats}
						activeOpacity={0.7}
					>
						<Text style={styles.submitText}>View Stats</Text>
					</TouchableOpacity>
				)}

				{!submitted && !answerRevealed && (
					<TouchableOpacity
						style={styles.showAnswerButton}
						onPress={handleShowAnswer}
						activeOpacity={0.7}
					>
						<Text style={styles.showAnswerText}>Show Answer</Text>
					</TouchableOpacity>
				)}

				{feedback && !submitted && (
					<View style={styles.feedbackContainer}>
						<Text style={styles.feedback}>{feedback}</Text>
					</View>
				)}
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: "100%",
		height: "100%",
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
		backgroundColor: "#EF444415", // Game-specific red with opacity
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#EF444440",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#EF4444", // Game-specific red
		fontFamily: Typography.fontFamily.monospace,
	},
	scrollView: {
		flex: 1,
		width: "100%",
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	boardContainer: {
		width: "100%",
		alignItems: "center",
	},
	problemList: {
		width: "100%",
		gap: Spacing.md,
	},
	problemRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		...Shadows.medium,
		gap: Spacing.sm,
	},
	problemNumberBadge: {
		width: 36,
		height: 36,
		borderRadius: BorderRadius.md,
		backgroundColor: "#EF444415", // Game-specific red with opacity
		borderWidth: 1.5,
		borderColor: "#EF444440",
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	problemNumber: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: "#EF4444", // Game-specific red
	},
	problemText: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		flex: 1,
		fontWeight: Typography.fontWeight.semiBold,
	},
	equalSign: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
		marginHorizontal: Spacing.xs,
	},
	answerInput: {
		width: 100,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
		borderWidth: 2.5,
		borderColor: "#EF444460", // Game-specific red with opacity
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.primary,
		textAlign: "center",
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
		minHeight: 52,
		...Shadows.light,
	},
	submit: {
		marginTop: Spacing.xl,
		backgroundColor: "#EF4444", // Game-specific red
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: ComponentStyles.button.alignItems,
		justifyContent: ComponentStyles.button.justifyContent,
		width: "100%",
		...Shadows.medium,
	},
	submitText: {
		color: Colors.text.white,
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
	submitDisabled: {
		opacity: 0.6,
	},
	showAnswerButton: {
		marginTop: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.xs,
	},
	showAnswerText: {
		color: Colors.text.secondary,
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		textDecorationLine: "underline",
	},
	feedbackContainer: {
		marginTop: Spacing.lg,
		padding: Spacing.lg,
		backgroundColor: Colors.error + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.error + "40",
	},
	feedback: {
		fontSize: Typography.fontSize.body,
		color: Colors.error,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
	},
	completionContainer: {
		marginTop: Spacing.xl,
		padding: Spacing.xxl,
		backgroundColor: "#EF444410", // Game-specific red with opacity
		borderRadius: BorderRadius.xl,
		alignItems: "center",
		borderWidth: 2.5,
		borderColor: "#EF4444", // Game-specific red
		...Shadows.heavy,
	},
	completionEmoji: {
		fontSize: 56,
		marginBottom: Spacing.md,
	},
	completionText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: "#EF4444", // Game-specific red
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

export default QuickMathGame;
