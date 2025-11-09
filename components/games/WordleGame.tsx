import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
} from "react-native";
import { WordleData, GameResult } from "../../config/types";

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
					onComplete({
						puzzleId: `wordle_${Date.now()}`,
						completed: false,
						timeTaken,
						attempts: newAttempts,
						completedAt: new Date().toISOString(),
					});
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
					const verticalGaps = 5 * 8;
					const maxByHeight = (availableHeight - verticalGaps) / 6;
					const maxByWidth = (width - 60) / wordLength;
					const nextSize = Math.floor(Math.min(maxByWidth, maxByHeight));
					if (nextSize > 0 && nextSize !== tileSize) setTileSize(nextSize);
				}}
			>
				<View style={styles.board}>
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
				</View>
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
							>
								<Text style={styles.keyText}>{key}</Text>
							</TouchableOpacity>
						))}
					</View>
				))}
			</View>

			{/* Game Status */}
			{gameWon && (
				<View style={styles.status}>
					<Text style={styles.statusText}>🎉 Correct! Well done!</Text>
					<Text style={styles.statusSubtext}>
						Time: {formatTime(elapsedTime)} • Attempts: {attempts}
					</Text>
				</View>
			)}

			{gameLost && (
				<View style={styles.status}>
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
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 8,
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		marginBottom: 12,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#212121",
	},
	timer: {
		fontSize: 20,
		fontWeight: "600",
		color: "#1e88e5",
		fontFamily: "monospace",
	},
	boardContainer: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
	},
	board: {
		marginBottom: 0,
	},
	row: {
		flexDirection: "row",
		marginBottom: 8,
	},
	tile: {
		borderWidth: 2,
		borderColor: "#d3d6da",
		margin: 2,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 4,
	},
	empty: {
		backgroundColor: "#ffffff",
	},
	correct: {
		backgroundColor: "#6aaa64",
		borderColor: "#6aaa64",
	},
	present: {
		backgroundColor: "#c9b458",
		borderColor: "#c9b458",
	},
	absent: {
		backgroundColor: "#787c7e",
		borderColor: "#787c7e",
	},
	tileText: {
		fontSize: 24,
		fontWeight: "bold",
	},
	lightText: { color: "#ffffff" },
	darkText: { color: "#212121" },
	keyboard: {
		marginTop: 12,
	},
	keyboardRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: 8,
	},
	key: {
		backgroundColor: "#d3d6da",
		padding: 10,
		margin: 2,
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	regularKey: {
		minWidth: 30,
	},
	wideKey: {
		minWidth: 50,
	},
	keyText: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#212121",
	},
	status: {
		marginTop: 20,
		padding: 15,
		backgroundColor: "#f5f7fa",
		borderRadius: 8,
		alignItems: "center",
	},
	statusText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#212121",
		marginBottom: 8,
	},
	statusSubtext: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	errorText: {
		fontSize: 16,
		color: "#d32f2f",
		marginBottom: 12,
		textAlign: "center",
	},
});

export default WordleGame;
