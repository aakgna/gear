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
	startTime?: number;
}

interface TileState {
	letter: string;
	status: "empty" | "present" | "correct" | "absent";
}

const WordleGame: React.FC<WordleGameProps> = ({
	inputData,
	onComplete,
	startTime: propStartTime,
}) => {
	const [currentGuess, setCurrentGuess] = useState("");
	const [guesses, setGuesses] = useState<string[]>([]);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [attempts, setAttempts] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");

	const answer = inputData.answer.toUpperCase();
	const wordLength = answer.length;
	const maxGuesses = 6;

	// Validate word length (3-10 letters)
	const validWordLength = wordLength >= 3 && wordLength <= 10;

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

	const handleKeyPress = (key: string) => {
		if (gameWon || gameLost || !validWordLength) return;

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
						puzzleId: `wordle_${Date.now()}`,
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
						puzzleId: `wordle_${Date.now()}`,
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
				<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
			</View>
			{!validWordLength && (
				<Text style={styles.errorText}>
					Invalid word length. Must be 3-10 letters.
				</Text>
			)}

			{/* Game Board */}
			<View
				style={styles.boardContainer}
				onLayout={(e) => {
					const availableHeight = e.nativeEvent.layout.height;
					if (!availableHeight || !validWordLength) return;
					// 6 rows -> 5 gaps of 8px between rows + tile margins (2px each side)
					const verticalGaps = 5 * Spacing.sm;
					const maxByHeight = (availableHeight - verticalGaps) / 6;
					const maxByWidth = (width - 60) / wordLength;
					const nextSize = Math.floor(Math.min(maxByWidth, maxByHeight));
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

			{/* Game Status */}
			{gameWon && (
				<Animated.View
					style={[
						styles.status,
						styles.statusSuccess,
						{
							transform: [{ scale: successScale }],
						},
					]}
				>
					<Text style={styles.statusText}>🎉 Correct! Well done!</Text>
					<Text style={styles.statusSubtext}>
						Time: {formatTime(elapsedTime)} • Attempts: {attempts}
					</Text>
				</Animated.View>
			)}

			{gameLost && (
				<View style={[styles.status, styles.statusError]}>
					<Text style={styles.statusText}>😔 The word was: {answer}</Text>
					<Text style={styles.statusSubtext}>
						Time: {formatTime(elapsedTime)} • Attempts: {attempts}
					</Text>
				</View>
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
	},
	board: {
		marginBottom: 0,
	},
	row: {
		flexDirection: "row",
		marginBottom: Spacing.sm,
	},
	tile: {
		borderWidth: 2,
		borderColor: Colors.text.disabled,
		margin: 2,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.sm,
	},
	empty: {
		backgroundColor: Colors.background.primary,
		borderColor: Colors.text.disabled,
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
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
	},
	lightText: { color: Colors.text.white },
	darkText: { color: Colors.text.primary },
	keyboard: {
		marginTop: Spacing.md,
	},
	keyboardRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	key: {
		backgroundColor: Colors.text.disabled,
		padding: Spacing.sm,
		margin: 2,
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		minHeight: Layout.tapTarget,
		minWidth: Layout.tapTarget,
	},
	regularKey: {
		minWidth: 30,
	},
	wideKey: {
		minWidth: 50,
	},
	keyText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	status: {
		marginTop: Spacing.lg,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		shadowColor: Shadows.light.shadowColor,
		shadowOffset: Shadows.light.shadowOffset,
		shadowOpacity: Shadows.light.shadowOpacity,
		shadowRadius: Shadows.light.shadowRadius,
		elevation: Shadows.light.elevation,
	},
	statusSuccess: {
		backgroundColor: Colors.accent + "15", // 15% opacity
		borderWidth: 2,
		borderColor: Colors.accent,
	},
	statusError: {
		backgroundColor: Colors.error + "15",
		borderWidth: 2,
		borderColor: Colors.error,
	},
	statusText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	statusSubtext: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	errorText: {
		fontSize: Typography.fontSize.body,
		color: Colors.error,
		marginBottom: Spacing.md,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
	},
});

export default WordleGame;
