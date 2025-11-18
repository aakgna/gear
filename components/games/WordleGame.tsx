import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	Animated,
} from "react-native";
import { WordleData, GameResult } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	Layout,
} from "../../constants/DesignSystem";

const { width } = Dimensions.get("window");
const TILE_SIZE_FALLBACK = (width - 60) / 5;

interface WordleGameProps {
	inputData: WordleData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
}

interface TileState {
	letter: string;
	status: "empty" | "present" | "correct" | "absent";
}

const WordleGame: React.FC<WordleGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	const [currentGuess, setCurrentGuess] = useState("");
	const [guesses, setGuesses] = useState<string[]>([]);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [attempts, setAttempts] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [answerRevealed, setAnswerRevealed] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false); // Track if user has made first interaction

	const answer = inputData.answer.toUpperCase();
	const wordLength = answer.length;
	const maxGuesses = 5;

	// Validate word length (3-8 letters)
	const validWordLength = wordLength >= 3 && wordLength <= 8;

	// Initialize board based on word length
	const initializeBoard = () => {
		const board: TileState[][] = [];
		for (let i = 0; i < maxGuesses; i++) {
			board[i] = [];
			for (let j = 0; j < wordLength; j++) {
				board[i][j] = { letter: "", status: "empty" };
			}
		}
		return board;
	};

	const [board, setBoard] = useState<TileState[][]>(initializeBoard);
	const [tileSize, setTileSize] = useState(TILE_SIZE_FALLBACK);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Reset timer when puzzle changes or startTime prop changes
	useEffect(() => {
		// Only reset if this is a different puzzle or startTime prop changed
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== answer) {
			puzzleIdRef.current = answer;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setGameWon(false);
			setGameLost(false);
			setCurrentGuess("");
			setGuesses([]);
			setAttempts(0);
			hasAttemptedRef.current = false; // Reset attempted flag for new puzzle
			setBoard(initializeBoard());
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
	}, [answer, propStartTime, startTime]);

	// Timer effect - updates every second
	useEffect(() => {
		if (gameWon || gameLost) {
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
	}, [gameWon, gameLost, startTime]);

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const keyboardLayout = [
		["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
		["A", "S", "D", "F", "G", "H", "J", "K", "L"],
		["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
	];

	const checkGuess = (guess: string): TileState[] => {
		const result: TileState[] = [];
		const answerLetters = answer.split("");
		const guessLetters = guess.split("");

		// First pass: mark correct letters
		for (let i = 0; i < wordLength; i++) {
			if (guessLetters[i] === answerLetters[i]) {
				result[i] = { letter: guessLetters[i], status: "correct" };
				answerLetters[i] = ""; // Remove from consideration for present check
			}
		}

		// Second pass: mark present/absent letters
		for (let i = 0; i < wordLength; i++) {
			if (result[i]) continue; // Already marked as correct

			const index = answerLetters.indexOf(guessLetters[i]);
			if (index !== -1) {
				result[i] = { letter: guessLetters[i], status: "present" };
				answerLetters[index] = ""; // Remove from consideration
			} else {
				result[i] = { letter: guessLetters[i], status: "absent" };
			}
		}

		return result;
	};

	const handleShowAnswer = () => {
		if (gameWon || gameLost || answerRevealed) return;

		// Fill the board with the correct answer
		const correctGuess = answer;
		const newGuesses = [...guesses, correctGuess];
		setGuesses(newGuesses);
		setCurrentGuess("");
		setAnswerRevealed(true);
		setGameWon(true);

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		
		// Stop timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		setElapsedTime(timeTaken);

		// Create board with correct answer
		const newBoard = [...board];
		const currentRow = guesses.length;
		
		for (let i = 0; i < wordLength; i++) {
			newBoard[currentRow][i] = {
				letter: answer[i],
				status: "correct",
			};
		}
		setBoard(newBoard);

		// Mark as completed
		onComplete({
			puzzleId: puzzleId || `wordle_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts: guesses.length + 1,
			mistakes: undefined,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const handleKeyPress = (key: string) => {
		if (gameWon || gameLost || !validWordLength || answerRevealed) return;

		if (key === "ENTER") {
			if (currentGuess.length === wordLength) {
				const newAttempts = attempts + 1;
				setAttempts(newAttempts);

				const guessResult = checkGuess(currentGuess);
				const newGuesses = [...guesses, currentGuess];
				setGuesses(newGuesses);

				// Update board
				const newBoard = [...board];
				newBoard[attempts] = guessResult;
				setBoard(newBoard);

				// Check win/lose conditions
				if (currentGuess === answer) {
					const timeTaken = Math.floor((Date.now() - startTime) / 1000);
					// Stop timer
					if (timerIntervalRef.current) {
						clearInterval(timerIntervalRef.current);
					}
					setElapsedTime(timeTaken);
					setGameWon(true);
					// Success animation - blue glow + scale
					Animated.sequence([
						Animated.timing(successScale, {
							toValue: 1.1,
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
				puzzleId: puzzleId || `wordle_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: newAttempts,
				completedAt: new Date().toISOString(),
			});
				} else if (newAttempts >= maxGuesses) {
					const timeTaken = Math.floor((Date.now() - startTime) / 1000);
					// Stop timer
					if (timerIntervalRef.current) {
						clearInterval(timerIntervalRef.current);
					}
					setElapsedTime(timeTaken);
					setGameLost(true);
					// Shake animation for incorrect
					Animated.sequence([
						Animated.timing(shakeAnimation, {
							toValue: 10,
							duration: Animation.duration.fast,
							useNativeDriver: true,
						}),
						Animated.timing(shakeAnimation, {
							toValue: -10,
							duration: Animation.duration.fast,
							useNativeDriver: true,
						}),
						Animated.timing(shakeAnimation, {
							toValue: 10,
							duration: Animation.duration.fast,
							useNativeDriver: true,
						}),
						Animated.timing(shakeAnimation, {
							toValue: 0,
							duration: Animation.duration.fast,
							useNativeDriver: true,
						}),
					]).start();
					onComplete({
						puzzleId: puzzleId || `wordle_${Date.now()}`,
						completed: false,
						timeTaken,
						attempts: newAttempts,
						completedAt: new Date().toISOString(),
					});
				} else {
					// Shake animation for incorrect guess
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

				setCurrentGuess("");
			}
		} else if (key === "⌫") {
			setCurrentGuess((prev) => prev.slice(0, -1));
		} else if (currentGuess.length < wordLength && key !== "ENTER") {
			// Track first interaction (user started attempting the game)
			if (!hasAttemptedRef.current && currentGuess.length === 0 && puzzleId) {
				hasAttemptedRef.current = true;
				
				// Update session tracking in feed.tsx
				// Firestore will be updated only if user skips after attempting
				if (onAttempt) {
					onAttempt(puzzleId);
				}
			}
			
			setCurrentGuess((prev) => prev + key);
		}
	};

	const getTileStyle = (tile: TileState) => {
		switch (tile.status) {
			case "correct":
				return [
					styles.tile,
					{ width: tileSize, height: tileSize },
					styles.correct,
				];
			case "present":
				return [
					styles.tile,
					{ width: tileSize, height: tileSize },
					styles.present,
				];
			case "absent":
				return [
					styles.tile,
					{ width: tileSize, height: tileSize },
					styles.absent,
				];
			default:
				return [
					styles.tile,
					{ width: tileSize, height: tileSize },
					styles.empty,
				];
		}
	};

	const getTileTextStyle = (tile: TileState, isActiveRowLetter: boolean) => {
		// Active row letters and empty tiles should be dark on light background
		if (tile.status === "empty" || isActiveRowLetter) {
			return [styles.tileText, styles.darkText];
		}
		// Guessed tiles with colored backgrounds should use light text
		return [styles.tileText, styles.lightText];
	};

	const getKeyStyle = (key: string) => {
		// This would need to track key states across guesses
		// For simplicity, using basic styling for now
		return [styles.key];
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Wordle</Text>
				<View style={styles.timerBadge}>
					<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
				</View>
			</View>
			{!validWordLength && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>
						Invalid word length. Must be 3-8 letters.
					</Text>
				</View>
			)}

			{/* Game Board */}
			<View
				style={styles.boardContainer}
				onLayout={(e) => {
					const availableHeight = e.nativeEvent.layout.height;
					if (!availableHeight || !validWordLength) return;
					// 5 rows -> 4 gaps + tile margins
					const verticalGaps = 4 * 16;
					const maxByHeight = (availableHeight - verticalGaps) / 5;
					const maxByWidth = (width - Spacing.xl * 2 - 24) / wordLength;
					const nextSize = Math.floor(Math.min(maxByWidth, maxByHeight, 80));
					if (nextSize > 0 && nextSize !== tileSize) setTileSize(nextSize);
				}}
			>
				<Animated.View
					style={[
						styles.board,
						{
							transform: [
								{ translateX: shakeAnimation },
								{ scale: successScale },
							],
						},
					]}
				>
					{board.map((row, rowIndex) => (
						<View key={rowIndex} style={styles.row}>
							{row.map((tile, colIndex) => (
								<View key={colIndex} style={getTileStyle(tile)}>
									<Text
										style={getTileTextStyle(
											tile,
											rowIndex === guesses.length &&
												colIndex < currentGuess.length
										)}
									>
										{rowIndex === guesses.length &&
										colIndex < currentGuess.length
											? currentGuess[colIndex]
											: tile.letter}
									</Text>
								</View>
							))}
						</View>
					))}
				</Animated.View>
			</View>

			{/* Virtual Keyboard */}
			<View style={styles.keyboard}>
				{keyboardLayout.map((row, rowIndex) => (
					<View key={rowIndex} style={styles.keyboardRow}>
						{row.map((key) => (
							<TouchableOpacity
								key={key}
								style={[
									getKeyStyle(key),
									key === "ENTER" || key === "⌫"
										? styles.wideKey
										: styles.regularKey,
								]}
								onPress={() => handleKeyPress(key)}
								activeOpacity={0.7}
							>
								<Text style={styles.keyText}>{key}</Text>
							</TouchableOpacity>
						))}
					</View>
				))}
			</View>

			{/* Show Answer Button */}
			{!gameWon && !gameLost && !answerRevealed && (
				<TouchableOpacity
					style={styles.showAnswerButton}
					onPress={handleShowAnswer}
					activeOpacity={0.7}
				>
					<Text style={styles.showAnswerText}>Show Answer</Text>
				</TouchableOpacity>
			)}

			{/* View Stats Button - shown when game is completed */}
			{(gameWon || gameLost) && onShowStats && (
				<TouchableOpacity
					style={styles.viewStatsButton}
					onPress={onShowStats}
					activeOpacity={0.7}
				>
					<Text style={styles.viewStatsButtonText}>View Stats</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.lg,
		alignItems: "center",
		backgroundColor: Colors.background.primary,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
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
	errorContainer: {
		marginBottom: Spacing.lg,
		padding: Spacing.md,
		backgroundColor: Colors.error + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.error + "40",
	},
	errorText: {
		fontSize: Typography.fontSize.body,
		color: Colors.error,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
	},
	boardContainer: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: Spacing.lg,
	},
	board: {
		alignItems: "center",
	},
	row: {
		flexDirection: "row",
		marginBottom: 16,
		gap: 6,
	},
	tile: {
		borderWidth: 2,
		borderColor: Colors.text.disabled,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.md,
		...Shadows.light,
	},
	empty: {
		backgroundColor: Colors.background.tertiary,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	correct: {
		backgroundColor: Colors.game.correct,
		borderColor: Colors.game.correct,
	},
	present: {
		backgroundColor: Colors.game.present,
		borderColor: Colors.game.present,
	},
	absent: {
		backgroundColor: Colors.game.absent,
		borderColor: Colors.game.absent,
	},
	tileText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
	},
	lightText: { color: Colors.text.white },
	darkText: { color: Colors.text.primary },
	keyboard: {
		width: "100%",
		paddingTop: Spacing.md,
	},
	keyboardRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: Spacing.sm,
		gap: 4,
	},
	key: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.15)",
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
		...Shadows.light,
	},
	regularKey: {
		minWidth: 32,
	},
	wideKey: {
		minWidth: 56,
		paddingHorizontal: Spacing.md,
	},
	keyText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	statusContainer: {
		marginTop: Spacing.xl,
		padding: Spacing.xxl,
		backgroundColor: Colors.accent + "10",
		borderRadius: BorderRadius.xl,
		alignItems: "center",
		borderWidth: 2,
		borderColor: Colors.accent,
		...Shadows.large,
		width: "100%",
	},
	statusEmoji: {
		fontSize: 48,
		marginBottom: Spacing.sm,
	},
	statusTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.md,
		letterSpacing: -0.5,
	},
	answerText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.lg,
		letterSpacing: 2,
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
	viewStatsButton: {
		marginTop: Spacing.xl,
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},
	viewStatsButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	showAnswerButton: {
		marginTop: Spacing.lg,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
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
});

export default WordleGame;
