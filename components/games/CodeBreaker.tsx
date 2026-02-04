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
import { GameResult, CodeBreakerData } from "../../config/types";
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

interface CodeBreakerGameProps {
	inputData: CodeBreakerData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

// Color mapping from string to emoji
const COLOR_EMOJI: Record<string, string> = {
	red: "🔴",
	blue: "🔵",
	green: "🟢",
	yellow: "🟡",
	orange: "🟠",
	purple: "🟣",
	black: "⚫",
	white: "⚪",
	brown: "🟤",
	lightblue: "🔷",
	pink: "💗",
	lime: "🟩",
};

interface GuessHistory {
	guess: string[];
	feedback: {
		correctPosition: number;
		correctColor: number;
		correctPositions: boolean[]; // Array indicating which positions are correct
	};
}

const CodeBreakerGame: React.FC<CodeBreakerGameProps> = ({
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
	const gameColor = getGameColor("codebreaker"); // Get game-specific rose color (#F43F5E)
	const codeLength = inputData.secretCode.length;
	const [currentGuess, setCurrentGuess] = useState<(string | null)[]>(
		new Array(codeLength).fill(null)
	);
	const [guessHistory, setGuessHistory] = useState<GuessHistory[]>([]);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [attemptsUsed, setAttemptsUsed] = useState(0);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const rainbowRotation = useRef(new Animated.Value(0)).current;

	const availableColors = getAvailableColors(inputData.secretCode);

	// Start rainbow border animation
	useEffect(() => {
		const animation = Animated.loop(
			Animated.timing(rainbowRotation, {
				toValue: 1,
				duration: 2000, // 2 seconds for full rotation
				useNativeDriver: true,
			}),
			{ iterations: -1 } // Infinite iterations
		);
		animation.start();

		return () => {
			animation.stop();
			rainbowRotation.setValue(0);
		};
	}, [rainbowRotation]);

	// Calculate feedback for a guess
	const calculateFeedback = (
		guess: string[],
		secret: string[]
	): {
		correctPosition: number;
		correctColor: number;
		correctPositions: boolean[];
	} => {
		let correctPosition = 0;
		let correctColor = 0;
		const correctPositions = new Array(secret.length).fill(false);

		// Track which positions are already matched
		const secretUsed = new Array(secret.length).fill(false);
		const guessUsed = new Array(secret.length).fill(false);

		// First pass: count correct positions
		for (let i = 0; i < secret.length; i++) {
			if (guess[i] === secret[i]) {
				correctPosition++;
				correctPositions[i] = true;
				secretUsed[i] = true;
				guessUsed[i] = true;
			}
		}

		// Second pass: count correct colors in wrong positions
		for (let i = 0; i < secret.length; i++) {
			if (!guessUsed[i]) {
				for (let j = 0; j < secret.length; j++) {
					if (!secretUsed[j] && guess[i] === secret[j]) {
						correctColor++;
						secretUsed[j] = true;
						break;
					}
				}
			}
		}

		return { correctPosition, correctColor, correctPositions };
	};

	// Get available colors based on secret code (to determine difficulty)
	function getAvailableColors(secretCode: string[]): string[] {
		const uniqueColors = new Set(secretCode);
		const colorCount = Math.max(...secretCode.map(() => 6)); // Fallback

		// Determine color set based on secret code colors
		const allColors = Object.keys(COLOR_EMOJI);
		const colorsInCode = Array.from(
			new Set(secretCode.filter((c) => allColors.includes(c)))
		);

		// Easy: 6 colors, Medium: 9 colors, Hard: 12 colors
		if (colorsInCode.some((c) => ["lightblue", "pink", "lime"].includes(c))) {
			// Hard - 12 colors
			return [
				"red",
				"blue",
				"green",
				"yellow",
				"orange",
				"purple",
				"black",
				"white",
				"brown",
				"lightblue",
				"pink",
				"lime",
			];
		} else if (
			colorsInCode.some((c) => ["black", "white", "brown"].includes(c))
		) {
			// Medium - 9 colors
			return [
				"red",
				"blue",
				"green",
				"yellow",
				"orange",
				"purple",
				"black",
				"white",
				"brown",
			];
		} else {
			// Easy - 6 colors
			return ["red", "blue", "green", "yellow", "orange", "purple"];
		}
	}

	// Setup timer and puzzleId tracking
	useEffect(() => {
		// Clear any existing timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}

		// Reset if puzzle changed
		if (puzzleId && puzzleIdRef.current !== puzzleId) {
			puzzleIdRef.current = puzzleId;
			setElapsedTime(0);
			setGameWon(false);
			setGameLost(false);
			setAttemptsUsed(0);
			setCurrentGuess(new Array(inputData.secretCode.length).fill(null));
			setGuessHistory([]);
			hasAttemptedRef.current = false;
			// Only set startTime if propStartTime is provided
			if (propStartTime) {
				setStartTime(propStartTime);
			} else {
				setStartTime(undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			setStartTime(propStartTime);
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
		}

		// Only set up timer if startTime is provided and game is active
		if (startTime && isActive) {
			timerIntervalRef.current = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
			}, 1000);
		} else if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
		};
	}, [puzzleId, propStartTime, startTime, isActive]);

	// Handle color selection (click color to fill next empty slot)
	const handleColorSelect = (color: string) => {
		if (gameWon || gameLost) return;

		const newGuess = [...currentGuess];
		// Find first empty position
		const firstEmpty = newGuess.findIndex((c) => c === null);
		if (firstEmpty !== -1) {
			newGuess[firstEmpty] = color;
			setCurrentGuess(newGuess);
		}
	};

	// Handle clear (X button) - removes last filled position
	const handleClear = () => {
		if (gameWon || gameLost) return;

		const newGuess = [...currentGuess];
		// Find last filled position
		for (let i = newGuess.length - 1; i >= 0; i--) {
			if (newGuess[i] !== null) {
				newGuess[i] = null;
				setCurrentGuess(newGuess);
				break;
			}
		}
	};

	// Handle guess submission
	const handleSubmitGuess = () => {
		// Check if all positions are filled
		if (currentGuess.some((c) => c === null)) {
			return;
		}

		if (!hasAttemptedRef.current && onAttempt && puzzleIdRef.current) {
			onAttempt(puzzleIdRef.current);
			hasAttemptedRef.current = true;
		}

		const guess = currentGuess as string[];
		const feedback = calculateFeedback(guess, inputData.secretCode);

		// Add to history
		setGuessHistory([...guessHistory, { guess, feedback }]);
		setAttemptsUsed(attemptsUsed + 1);

		// Check for win
		if (feedback.correctPosition === inputData.secretCode.length) {
			setGameWon(true);
			handleGameComplete(true, attemptsUsed + 1);
		} else if (attemptsUsed + 1 >= inputData.maxGuesses) {
			// Check for loss
			setGameLost(true);
			handleGameComplete(false, attemptsUsed + 1);
		}

		// Reset current guess
		setCurrentGuess(new Array(inputData.secretCode.length).fill(null));
	};

	const handleGameComplete = (won: boolean, attempts: number) => {
		if (completed) return;

		setCompleted(true);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		const finalTime = startTime
			? Math.floor((Date.now() - startTime) / 1000)
			: 0;

		onComplete({
			puzzleId: puzzleIdRef.current || "",
			completed: true,
			timeTaken: finalTime,
			attempts: attempts,
			completedAt: new Date().toISOString(),
		});
	};

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const isGuessComplete = currentGuess.every((c) => c !== null);

	// Calculate bottom padding to account for bottom navigation bar
	const bottomPadding = BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg;

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={[
				styles.scrollContent,
				{ paddingBottom: bottomPadding },
			]}
			showsVerticalScrollIndicator={true}
		>
			{/* Header */}
			<GameHeader
				title="CodeBreaker"
				elapsedTime={elapsedTime}
				showDifficulty={false}
				gameType="codebreaker"
				subtitle={`Guesses: ${attemptsUsed}/${inputData.maxGuesses}`}
				puzzleId={puzzleId}
			/>

			{/* Game Won/Lost Message */}
			{gameWon && (
				<View style={styles.resultContainer}>
					<Text style={styles.successText}>🎉 You cracked the code!</Text>
					<View style={styles.secretCodeContainer}>
						<Text style={styles.secretCodeLabel}>Secret Code:</Text>
						<View style={styles.codeRow}>
							{inputData.secretCode.map((color, idx) => (
								<View key={idx} style={styles.codeSlot}>
									<Text style={styles.colorEmoji}>{COLOR_EMOJI[color]}</Text>
								</View>
							))}
						</View>
					</View>
				</View>
			)}

			{gameLost && (
				<View style={styles.resultContainer}>
					<Text style={styles.failureText}>Out of guesses!</Text>
					<View style={styles.secretCodeContainer}>
						<Text style={styles.secretCodeLabel}>Secret Code was:</Text>
						<View style={styles.codeRow}>
							{inputData.secretCode.map((color, idx) => (
								<View key={idx} style={styles.codeSlot}>
									<Text style={styles.colorEmoji}>{COLOR_EMOJI[color]}</Text>
								</View>
							))}
						</View>
					</View>
				</View>
			)}

			{/* Guess History */}
			<View style={styles.historySection}>
				<Text style={styles.sectionLabel}>Previous Guesses:</Text>
				<ScrollView style={styles.historyScroll}>
					{guessHistory.map((entry, idx) => (
						<View key={idx} style={styles.historyRow}>
							<View style={styles.historyGuess}>
								{entry.guess.map((color, colorIdx) => {
									const isCorrect = entry.feedback.correctPositions[colorIdx];
									const rotate = rainbowRotation.interpolate({
										inputRange: [0, 1],
										outputRange: ["0deg", "360deg"],
									});

									// Rainbow colors for the border - more segments for smoother effect
									const rainbowColors = [
										"#FF0000", // Red
										"#FF4000", // Red-Orange
										"#FF7F00", // Orange
										"#FFBF00", // Orange-Yellow
										"#FFFF00", // Yellow
										"#80FF00", // Yellow-Green
										"#00FF00", // Green
										"#00FF80", // Green-Cyan
										"#00FFFF", // Cyan
										"#0080FF", // Cyan-Blue
										"#0000FF", // Blue
										"#4000FF", // Blue-Indigo
										"#8000FF", // Indigo
										"#BF00FF", // Indigo-Violet
										"#FF00FF", // Violet
										"#FF0080", // Violet-Red
									];

									return (
										<View key={colorIdx} style={styles.historySlotContainer}>
											{isCorrect && (
												<Animated.View
													style={[
														styles.rainbowBorderContainer,
														{
															transform: [{ rotate }],
														},
													]}
												>
													{rainbowColors.map((rainbowColor, idx) => {
														const segmentAngle = 360 / rainbowColors.length;
														const angle = segmentAngle * idx - 90; // Start from top
														const radius = 14; // Border radius
														const center = 16; // Center of 32x32 container

														// Calculate position on the circle for the segment
														const radian = (angle * Math.PI) / 180;
														// Position segment at the border
														const x = center + radius * Math.cos(radian);
														const y = center + radius * Math.sin(radian);

														// Create larger, more visible segments
														const segmentLength = 4; // Longer segments for better visibility
														const segmentWidth = 4; // Wider segments

														return (
															<View
																key={idx}
																style={[
																	styles.rainbowSegment,
																	{
																		backgroundColor: rainbowColor,
																		left: x - segmentWidth / 2,
																		top: y - segmentLength / 2,
																		width: segmentWidth,
																		height: segmentLength,
																		transform: [{ rotate: `${angle + 90}deg` }],
																	},
																]}
															/>
														);
													})}
												</Animated.View>
											)}
											<View
												style={[
													styles.historySlot,
													isCorrect && styles.correctPositionSlot,
												]}
											>
												<Text style={styles.historyEmoji}>
													{COLOR_EMOJI[color]}
												</Text>
											</View>
										</View>
									);
								})}
							</View>
							<View style={styles.feedbackContainer}>
								<Text style={styles.feedbackText}>
									{entry.feedback.correctPosition} correct position
									{entry.feedback.correctPosition !== 1 ? "s" : ""}
								</Text>
							</View>
						</View>
					))}
				</ScrollView>
			</View>

			{/* Current Guess */}
			{!gameWon && !gameLost && (
				<View style={styles.currentGuessSection}>
					<Text style={styles.sectionLabel}>Current Guess:</Text>
					<View style={styles.codeRow}>
						{currentGuess.map((color, idx) => (
							<View
								key={idx}
								style={[styles.guessSlot, color && styles.filledSlot]}
							>
								<Text style={styles.slotEmoji}>
									{color ? COLOR_EMOJI[color] : ""}
								</Text>
							</View>
						))}
					</View>
				</View>
			)}

			{/* Color Palette */}
			{!gameWon && !gameLost && (
				<View style={styles.paletteSection}>
					<Text style={styles.sectionLabel}>Select Color:</Text>
					<View style={styles.palette}>
						{availableColors.map((color, idx) => (
							<TouchableOpacity
								key={idx}
								style={[
									styles.colorButton,
									isGuessComplete && styles.colorButtonDisabled,
								]}
								onPress={() => handleColorSelect(color)}
								disabled={isGuessComplete}
							>
								<Text style={styles.colorButtonEmoji}>
									{COLOR_EMOJI[color]}
								</Text>
							</TouchableOpacity>
						))}
						{/* Clear/Back Button (X) */}
						<TouchableOpacity
							style={[
								styles.colorButton,
								styles.clearButton,
								!currentGuess.some((c) => c !== null) &&
									styles.colorButtonDisabled,
							]}
							onPress={handleClear}
							disabled={!currentGuess.some((c) => c !== null)}
						>
							<Text style={styles.clearButtonText}>✕</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{/* Submit Button */}
			{!gameWon && !gameLost && (
				<TouchableOpacity
					style={[
						styles.submitButton,
						!isGuessComplete && styles.submitButtonDisabled,
					]}
					onPress={handleSubmitGuess}
					disabled={!isGuessComplete}
				>
					<Text style={styles.submitButtonText}>Submit Guess</Text>
				</TouchableOpacity>
			)}

			{/* View Stats Button */}
			{(gameWon || gameLost) && (
				<TouchableOpacity style={styles.statsButton} onPress={onShowStats}>
					<Text style={styles.statsButtonText}>View Stats</Text>
				</TouchableOpacity>
			)}
		</ScrollView>
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
	scrollContent: {
		padding: Spacing.md,
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
	headerLeft: {
		flex: 1,
	},
	title: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
		marginBottom: Spacing.xs,
	},
	progressInfo: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	timerBadge: {
		backgroundColor: "#F43F5E15", // Game-specific rose with opacity
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#F43F5E40",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#F43F5E", // Game-specific rose
		fontFamily: Typography.fontFamily.monospace,
	},
	resultContainer: {
		backgroundColor: Colors.background.secondary,
		padding: Spacing.md,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.md,
		...Shadows.light,
	},
	successText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.game.correct,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	failureText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.error,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	secretCodeContainer: {
		alignItems: "center",
	},
	secretCodeLabel: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.xs,
	},
	historySection: {
		marginBottom: Spacing.md,
	},
	sectionLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	historyScroll: {
		maxHeight: 350,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.sm,
		...Shadows.light,
	},
	historyRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	historyGuess: {
		flexDirection: "row",
		gap: Spacing.xs,
	},
	historySlotContainer: {
		width: 32,
		height: 32,
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
	},
	rainbowBorderContainer: {
		position: "absolute",
		width: 32,
		height: 32,
		borderRadius: 16,
		overflow: "visible", // Allow segments to be visible outside
	},
	rainbowSegment: {
		position: "absolute",
		width: 4,
		height: 4,
		borderRadius: 2,
		zIndex: 0,
	},
	historySlot: {
		width: 28,
		height: 28,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.sm,
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
		zIndex: 1,
	},
	correctPositionSlot: {
		backgroundColor: Colors.game.correct + "20",
	},
	historyEmoji: {
		fontSize: Typography.fontSize.h3,
	},
	feedbackContainer: {
		paddingHorizontal: Spacing.sm,
	},
	feedbackText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	currentGuessSection: {
		marginBottom: Spacing.md,
	},
	codeRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.sm,
	},
	guessSlot: {
		width: 48,
		height: 48,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	filledSlot: {
		backgroundColor: Colors.background.primary,
	},
	slotEmoji: {
		fontSize: Typography.fontSize.h1,
	},
	codeSlot: {
		width: 48,
		height: 48,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		justifyContent: "center",
		alignItems: "center",
	},
	colorEmoji: {
		fontSize: Typography.fontSize.h1,
	},
	paletteSection: {
		marginBottom: Spacing.md,
	},
	palette: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.sm,
	},
	colorButton: {
		width: 48,
		height: 48,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	colorButtonEmoji: {
		fontSize: Typography.fontSize.h1,
	},
	colorButtonDisabled: {
		opacity: 0.4,
	},
	clearButton: {
		backgroundColor: Colors.error + "20",
		borderWidth: 2,
		borderColor: Colors.error,
	},
	clearButtonText: {
		fontSize: Typography.fontSize.h2,
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
	},
	submitButtonDisabled: {
		backgroundColor: Colors.background.tertiary,
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.white,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
	statsButton: {
		marginTop: Spacing.xl,
		backgroundColor: "#F43F5E",
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
	},
	statsButtonText: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.white,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
});

export default CodeBreakerGame;
