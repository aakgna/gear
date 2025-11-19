import React, { useState, useEffect, useRef } from "react";
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
import { GameResult, AliasData } from "../../config/types";
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

interface AliasGameProps {
	inputData: AliasData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
}

const AliasGame: React.FC<AliasGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	const [guess, setGuess] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [answerRevealed, setAnswerRevealed] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false); // Track if user has made first interaction
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Reset timer when puzzle changes (using definitions and answer as unique identifier)
	const puzzleSignature = `${inputData.definitions.join("-")}-${inputData.answer}`;

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
			hasAttemptedRef.current = false; // Reset attempted flag for new puzzle
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

	const handleShowAnswer = () => {
		if (completed || answerRevealed) return;

		setGuess(inputData.answer);
		setAnswerRevealed(true);
		setCompleted(true);
		setFeedback("Answer revealed!");

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);

		// Stop timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		setElapsedTime(timeTaken);

		// Mark as completed
		onComplete({
			puzzleId: puzzleId || `alias_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts: attempts + 1,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const submit = () => {
		const normalized = guess.trim().toLowerCase();
		if (!normalized) return;

		// Case-insensitive comparison
		const isCorrect = normalized === inputData.answer.toLowerCase().trim();
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
				puzzleId: puzzleId || `alias_${Date.now()}`,
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

	const inputRef = useRef<TextInput>(null);
	const scrollViewRef = useRef<ScrollView>(null);
	const inputContainerRef = useRef<View>(null);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const inputYPositionRef = useRef<number>(0);

	useEffect(() => {
		const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
			setKeyboardHeight(e.endCoordinates.height);
			// Scroll to input when keyboard appears
			setTimeout(() => {
				if (scrollViewRef.current && inputYPositionRef.current > 0) {
					scrollViewRef.current.scrollTo({
						y: Math.max(0, inputYPositionRef.current - 150),
						animated: true,
					});
				}
			}, 300);
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
			<View style={styles.header}>
				<Text style={styles.title}>Alias</Text>
				<View style={styles.timerBadge}>
					<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
				</View>
			</View>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingBottom:
							keyboardHeight > 0 ? keyboardHeight + 100 : Spacing.xl,
					},
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				scrollEnabled={true}
			>
				<Animated.View
					style={[
						styles.definitionsContainer,
						{
							transform: [
								{ translateX: shakeAnimation },
								{ scale: successScale },
							],
						},
					]}
				>
					<View style={styles.definitionsCard}>
						<Text style={styles.definitionsIcon}>🔍</Text>
						<Text style={styles.definitionsTitle}>
							Find the word that matches all definitions:
						</Text>
						<View style={styles.definitionsList}>
							{inputData.definitions.map((definition, index) => (
								<View key={index} style={styles.definitionItem}>
									<Text style={styles.definitionNumber}>{index + 1}.</Text>
									<Text style={styles.definitionText}>{definition}</Text>
								</View>
							))}
						</View>
					</View>
				</Animated.View>

				{inputData.hint && (
					<View style={styles.hintContainer}>
						<Text style={styles.hintLabel}>💡 Hint:</Text>
						<Text style={styles.hint}>{inputData.hint}</Text>
					</View>
				)}

				<View
					ref={inputContainerRef}
					style={styles.inputContainer}
					onLayout={(e) => {
						// Store the Y position of the input container
						inputYPositionRef.current = e.nativeEvent.layout.y;
					}}
				>
					<TextInput
						ref={inputRef}
						style={styles.input}
						value={guess}
						onChangeText={(text) => {
							// Track first interaction (user started attempting the game)
							if (!hasAttemptedRef.current && text.length > 0 && puzzleId) {
								hasAttemptedRef.current = true;

								// Update session tracking in feed.tsx
								// Firestore will be updated only if user skips after attempting
								if (onAttempt) {
									onAttempt(puzzleId);
								}
							}

							setGuess(text);
						}}
						autoCapitalize="none"
						autoCorrect={false}
						placeholder="Type your answer here..."
						placeholderTextColor={Colors.text.disabled}
						returnKeyType="done"
						onSubmitEditing={submit}
						editable={!completed}
						onFocus={() => {
							// Scroll to input when focused
							setTimeout(() => {
								if (scrollViewRef.current && inputYPositionRef.current > 0) {
									scrollViewRef.current.scrollTo({
										y: Math.max(0, inputYPositionRef.current - 150),
										animated: true,
									});
								}
							}, 300);
						}}
					/>
				</View>

				<TouchableOpacity
					style={[styles.submit, completed && styles.submitDisabled]}
					onPress={completed ? onShowStats : submit}
					activeOpacity={0.7}
				>
					<Text style={styles.submitText}>
						{completed ? "View Stats" : "Submit Answer"}
					</Text>
				</TouchableOpacity>

				{!completed && !answerRevealed && (
					<TouchableOpacity
						style={styles.showAnswerButton}
						onPress={handleShowAnswer}
						activeOpacity={0.7}
					>
						<Text style={styles.showAnswerText}>Show Answer</Text>
					</TouchableOpacity>
				)}

				{feedback && !completed && (
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
		backgroundColor: Colors.background.primary,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.lg,
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
		paddingBottom: Spacing.xxl,
	},
	definitionsContainer: {
		width: "100%",
		marginBottom: Spacing.xl,
	},
	definitionsCard: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.xxl,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.medium,
		alignItems: "center",
	},
	definitionsIcon: {
		fontSize: 48,
		marginBottom: Spacing.lg,
	},
	definitionsTitle: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.bold,
		marginBottom: Spacing.lg,
	},
	definitionsList: {
		width: "100%",
		gap: Spacing.md,
	},
	definitionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: Spacing.md,
	},
	definitionNumber: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginRight: Spacing.md,
		minWidth: 24,
	},
	definitionText: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: Typography.fontSize.body * 1.5,
		fontWeight: Typography.fontWeight.medium,
	},
	hintContainer: {
		backgroundColor: Colors.accent + "10",
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.xl,
		borderWidth: 1,
		borderColor: Colors.accent + "30",
	},
	hintLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.xs,
	},
	hint: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		lineHeight: Typography.fontSize.body * 1.5,
		fontStyle: "italic",
	},
	inputContainer: {
		marginBottom: Spacing.lg,
	},
	input: {
		width: "100%",
		borderWidth: 2,
		borderColor: "rgba(124, 77, 255, 0.3)",
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		backgroundColor: Colors.background.tertiary,
		fontSize: Typography.fontSize.h3,
		textAlign: "center",
		color: Colors.text.primary,
		minHeight: 56,
		fontWeight: Typography.fontWeight.medium,
		...Shadows.light,
	},
	submit: {
		backgroundColor: ComponentStyles.button.backgroundColor,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: ComponentStyles.button.minHeight,
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
		marginTop: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
	},
	showAnswerText: {
		color: Colors.text.secondary,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
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
});

export default AliasGame;

