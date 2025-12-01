import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Animated,
	ScrollView,
} from "react-native";
import { GameResult, MastermindData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
} from "../../constants/DesignSystem";

interface MastermindGameProps {
	inputData: MastermindData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
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
	feedback: { correctPosition: number; correctColor: number };
}

const MastermindGame: React.FC<MastermindGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	const [currentGuess, setCurrentGuess] = useState<(string | null)[]>(
		new Array(6).fill(null)
	);
	const [guessHistory, setGuessHistory] = useState<GuessHistory[]>([]);
	const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [attemptsUsed, setAttemptsUsed] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);

	const availableColors = getAvailableColors(inputData.secretCode);

	// Calculate feedback for a guess
	const calculateFeedback = (
		guess: string[],
		secret: string[]
	): { correctPosition: number; correctColor: number } => {
		let correctPosition = 0;
		let correctColor = 0;

		// Track which positions are already matched
		const secretUsed = new Array(6).fill(false);
		const guessUsed = new Array(6).fill(false);

		// First pass: count correct positions
		for (let i = 0; i < 6; i++) {
			if (guess[i] === secret[i]) {
				correctPosition++;
				secretUsed[i] = true;
				guessUsed[i] = true;
			}
		}

		// Second pass: count correct colors in wrong positions
		for (let i = 0; i < 6; i++) {
			if (!guessUsed[i]) {
				for (let j = 0; j < 6; j++) {
					if (!secretUsed[j] && guess[i] === secret[j]) {
						correctColor++;
						secretUsed[j] = true;
						break;
					}
				}
			}
		}

		return { correctPosition, correctColor };
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
			setStartTime(propStartTime || Date.now());
			setElapsedTime(0);
			setGameWon(false);
			setGameLost(false);
			setAttemptsUsed(0);
			setCurrentGuess(new Array(6).fill(null));
			setGuessHistory([]);
			setSelectedPosition(null);
			hasAttemptedRef.current = false;
		}

		// Set up new timer
		const newStartTime = propStartTime || Date.now();
		setStartTime(newStartTime);
		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - newStartTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
		};
	}, [puzzleId, propStartTime]);

	// Handle color selection
	const handleColorSelect = (color: string) => {
		if (selectedPosition !== null && !gameWon && !gameLost) {
			const newGuess = [...currentGuess];
			newGuess[selectedPosition] = color;
			setCurrentGuess(newGuess);
			// Auto-advance to next empty position or deselect
			const nextEmpty = newGuess.findIndex((c, idx) => c === null && idx > selectedPosition);
			if (nextEmpty !== -1) {
				setSelectedPosition(nextEmpty);
			} else {
				setSelectedPosition(null);
			}
		}
	};

	// Handle position selection (select or clear)
	const handlePositionSelect = (index: number) => {
		if (gameWon || gameLost) return;

		if (currentGuess[index] !== null) {
			// Clear the position
			const newGuess = [...currentGuess];
			newGuess[index] = null;
			setCurrentGuess(newGuess);
			setSelectedPosition(index);
		} else {
			// Select the position
			setSelectedPosition(index);
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
		if (feedback.correctPosition === 6) {
			setGameWon(true);
			handleGameComplete(true, attemptsUsed + 1);
		} else if (attemptsUsed + 1 >= inputData.maxGuesses) {
			// Check for loss
			setGameLost(true);
			handleGameComplete(false, attemptsUsed + 1);
		}

		// Reset current guess
		setCurrentGuess(new Array(6).fill(null));
		setSelectedPosition(null);
	};

	const handleGameComplete = (won: boolean, attempts: number) => {
		if (completed) return;

		setCompleted(true);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		const finalTime = Math.floor((Date.now() - startTime) / 1000);

		onComplete({
			puzzleId: puzzleIdRef.current || "",
			completed: won,
			timeTaken: finalTime,
			attempts: attempts,
			completedAt: new Date().toISOString(),
		});
	};

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const isGuessComplete = currentGuess.every((c) => c !== null);

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.title}>Mastermind</Text>
				<View style={styles.headerInfo}>
					<Text style={styles.guessCount}>
						Guesses: {attemptsUsed}/{inputData.maxGuesses}
					</Text>
					<Text style={styles.timer}>⏱️ {formatTime(elapsedTime)}</Text>
				</View>
			</View>

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
								{entry.guess.map((color, colorIdx) => (
									<View key={colorIdx} style={styles.historySlot}>
										<Text style={styles.historyEmoji}>
											{COLOR_EMOJI[color]}
										</Text>
									</View>
								))}
							</View>
							<View style={styles.feedbackContainer}>
								<Text style={styles.feedbackText}>
									{entry.feedback.correctPosition} correct
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
							<TouchableOpacity
								key={idx}
								style={[
									styles.guessSlot,
									selectedPosition === idx && styles.selectedSlot,
									color && styles.filledSlot,
								]}
								onPress={() => handlePositionSelect(idx)}
							>
								<Text style={styles.slotEmoji}>
									{color ? COLOR_EMOJI[color] : ""}
								</Text>
							</TouchableOpacity>
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
								style={styles.colorButton}
								onPress={() => handleColorSelect(color)}
								disabled={selectedPosition === null}
							>
								<Text style={styles.colorButtonEmoji}>
									{COLOR_EMOJI[color]}
								</Text>
							</TouchableOpacity>
						))}
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
				<TouchableOpacity
					style={styles.statsButton}
					onPress={onShowStats}
				>
					<Text style={styles.statsButtonText}>View Stats</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
		padding: Spacing.md,
	},
	header: {
		marginBottom: Spacing.md,
	},
	title: {
		...Typography.h2,
		color: Colors.text,
		textAlign: "center",
		marginBottom: Spacing.xs,
	},
	headerInfo: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	guessCount: {
		...Typography.body,
		color: "#CCCCCC",
		fontSize: 16,
		fontWeight: "500",
	},
	timer: {
		...Typography.body,
		color: "#CCCCCC",
		fontSize: 16,
		fontWeight: "500",
	},
	resultContainer: {
		backgroundColor: Colors.surface,
		padding: Spacing.md,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.md,
		...Shadows.small,
	},
	successText: {
		...Typography.h3,
		color: Colors.success,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	failureText: {
		...Typography.h3,
		color: Colors.error,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	secretCodeContainer: {
		alignItems: "center",
	},
	secretCodeLabel: {
		...Typography.body,
		color: Colors.textSecondary,
		marginBottom: Spacing.xs,
	},
	historySection: {
		flex: 1,
		marginBottom: Spacing.md,
	},
	sectionLabel: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		marginBottom: Spacing.xs,
		fontSize: 16,
		fontWeight: "600",
	},
	historyScroll: {
		maxHeight: 350,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		padding: Spacing.sm,
		...Shadows.small,
	},
	historyRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	historyGuess: {
		flexDirection: "row",
		gap: 4,
	},
	historySlot: {
		width: 28,
		height: 28,
		backgroundColor: Colors.background,
		borderRadius: BorderRadius.sm,
		justifyContent: "center",
		alignItems: "center",
	},
	historyEmoji: {
		fontSize: 20,
	},
	feedbackContainer: {
		paddingHorizontal: Spacing.sm,
	},
	feedbackText: {
		...Typography.body,
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600",
	},
	currentGuessSection: {
		marginBottom: Spacing.md,
	},
	codeRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 8,
	},
	guessSlot: {
		width: 48,
		height: 48,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.border,
		justifyContent: "center",
		alignItems: "center",
		...Shadows.small,
	},
	selectedSlot: {
		borderColor: Colors.primary,
		borderWidth: 3,
	},
	filledSlot: {
		backgroundColor: Colors.background,
	},
	slotEmoji: {
		fontSize: 32,
	},
	codeSlot: {
		width: 48,
		height: 48,
		backgroundColor: Colors.background,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.border,
		justifyContent: "center",
		alignItems: "center",
	},
	colorEmoji: {
		fontSize: 32,
	},
	paletteSection: {
		marginBottom: Spacing.md,
	},
	palette: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
	},
	colorButton: {
		width: 48,
		height: 48,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		justifyContent: "center",
		alignItems: "center",
		...Shadows.small,
	},
	colorButtonEmoji: {
		fontSize: 32,
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
		backgroundColor: Colors.disabled,
		opacity: 0.6,
	},
	submitButtonText: {
		...Typography.buttonLarge,
		color: ComponentStyles.button.textColor,
		fontWeight: "600",
	},
	statsButton: {
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
	statsButtonText: {
		...Typography.buttonLarge,
		color: ComponentStyles.button.textColor,
		fontWeight: "600",
	},
});

export default MastermindGame;

