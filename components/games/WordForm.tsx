import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WordFormData, GameResult } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	Layout,
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

const { width, height } = Dimensions.get("window");

interface WordFormGameProps {
	inputData: WordFormData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

interface TileState {
	letter: string;
	status: "empty" | "present" | "correct" | "absent";
}

const WordFormGame: React.FC<WordFormGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70;
	const [currentGuess, setCurrentGuess] = useState("");
	const [guesses, setGuesses] = useState<string[]>([]);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [attempts, setAttempts] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);

	const answer = inputData.answer.toUpperCase();
	const wordLength = answer.length;
	const maxGuesses = 6;
	const gameColor = getGameColor("wordform");

	const validWordLength = wordLength >= 3 && wordLength <= 8;

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
	const [tileSize, setTileSize] = useState(50);
	const [keyboardHeight, setKeyboardHeight] = useState(400);
	const [keyStates, setKeyStates] = useState<
		Record<string, "absent" | "present" | "correct">
	>({});
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;
	const headerHeightRef = useRef(0);
	const boardContainerRef = useRef<View>(null);
	const keyboardRef = useRef<View>(null);
	const contentContainerRef = useRef<View>(null);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		if (puzzleIdRef.current !== answer) {
			puzzleIdRef.current = answer;
			setElapsedTime(0);
			setGameWon(false);
			setGameLost(false);
			setCurrentGuess("");
			setGuesses([]);
			setAttempts(0);
			hasAttemptedRef.current = false;
			setBoard(initializeBoard());
			setKeyStates({});
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			if (propStartTime) {
				setStartTime(propStartTime);
			} else {
				setStartTime(undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
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
	}, [answer, propStartTime, startTime]);

	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (gameWon || gameLost) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (!isActive) {
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
	}, [gameWon, gameLost, startTime, isActive]);

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
		const newKeyStates = { ...keyStates };

		for (let i = 0; i < wordLength; i++) {
			if (guessLetters[i] === answerLetters[i]) {
				result[i] = { letter: guessLetters[i], status: "correct" };
				answerLetters[i] = "";
				newKeyStates[guessLetters[i]] = "correct";
			}
		}

		for (let i = 0; i < wordLength; i++) {
			if (result[i]) continue;

			const index = answerLetters.indexOf(guessLetters[i]);
			if (index !== -1) {
				result[i] = { letter: guessLetters[i], status: "present" };
				answerLetters[index] = "";
				if (newKeyStates[guessLetters[i]] !== "correct") {
					newKeyStates[guessLetters[i]] = "present";
				}
			} else {
				result[i] = { letter: guessLetters[i], status: "absent" };
				if (
					!newKeyStates[guessLetters[i]] ||
					newKeyStates[guessLetters[i]] === "absent"
				) {
					newKeyStates[guessLetters[i]] = "absent";
				}
			}
		}

		setKeyStates(newKeyStates);

		return result;
	};

	const handleKeyPress = (key: string) => {
		if (gameWon || gameLost || !validWordLength) return;

		if (isKeyDisabled(key)) return;

		if (key === "ENTER") {
			if (currentGuess.length === wordLength) {
				const newAttempts = attempts + 1;
				setAttempts(newAttempts);

				const guessResult = checkGuess(currentGuess);
				const newGuesses = [...guesses, currentGuess];
				setGuesses(newGuesses);

				const newBoard = [...board];
				newBoard[attempts] = guessResult;
				setBoard(newBoard);

				if (currentGuess === answer) {
					const timeTaken = startTime
						? Math.floor((Date.now() - startTime) / 1000)
						: 0;
					if (timerIntervalRef.current) {
						clearInterval(timerIntervalRef.current);
					}
					setElapsedTime(timeTaken);
					setGameWon(true);
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
						puzzleId: puzzleId || `wordform_${Date.now()}`,
						completed: true,
						timeTaken,
						attempts: newAttempts,
						completedAt: new Date().toISOString(),
					});
				} else if (newAttempts >= maxGuesses) {
					const timeTaken = startTime
						? Math.floor((Date.now() - startTime) / 1000)
						: 0;
					if (timerIntervalRef.current) {
						clearInterval(timerIntervalRef.current);
					}
					setElapsedTime(timeTaken);
					setGameLost(true);
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
						puzzleId: puzzleId || `wordform_${Date.now()}`,
						completed: false,
						timeTaken,
						attempts: newAttempts,
						completedAt: new Date().toISOString(),
					});
				} else {
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
			if (!hasAttemptedRef.current && currentGuess.length === 0 && puzzleId) {
				hasAttemptedRef.current = true;

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
					{ backgroundColor: Colors.error + "40" },
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
		// Calculate font size based on tile size - scale down for smaller tiles
		const fontSize = Math.max(12, Math.min(22, tileSize * 0.42));
		if (tile.status === "empty" || isActiveRowLetter) {
			return [styles.tileText, styles.darkText, { fontSize }];
		}
		return [styles.tileText, styles.lightText, { fontSize }];
	};

	const getKeyStyle = (key: string) => {
		const keyState = keyStates[key];
		if (keyState === "absent") {
			return [styles.key, styles.keyAbsent];
		} else if (keyState === "present") {
			return [styles.key, styles.keyPresent];
		} else if (keyState === "correct") {
			return [styles.key, styles.keyCorrect];
		}
		return [styles.key];
	};

	const isKeyDisabled = (key: string): boolean => {
		return keyStates[key] === "absent";
	};

	useEffect(() => {
		if (!validWordLength) return;

		// Get screen dimensions
		const screenHeight = height;
		const screenWidth = width;

		// Account for header, bottom nav, and safe areas - use minimal estimates
		const headerEstimate = 60; // Reduced
		const bottomNavEstimate = 70;
		const safeAreaEstimate = 40; // Reduced
		const estimatedKeyboardHeight = 200; // Keyboard height estimate

		const availableHeight =
			screenHeight - headerEstimate - bottomNavEstimate - safeAreaEstimate;
		const boardAvailableHeight = availableHeight - estimatedKeyboardHeight - 8;

		// Calculate tile size based on constraints
		// Board: 5 rows with 2px gaps between them (even tighter)
		const rowGaps = 4 * 2;
		const boardHeightNeeded = boardAvailableHeight - rowGaps;
		const maxTileByHeight = boardHeightNeeded / 5;

		// Width constraint: tiles + gaps between them
		const horizontalPadding = Spacing.md * 2;
		const tileGaps = (wordLength - 1) * 2; // Tighter gaps
		const availableWidth = screenWidth - horizontalPadding - tileGaps;
		const maxTileByWidth = availableWidth / wordLength;

		// Use the smaller constraint
		const calculatedTileSize = Math.max(
			30,
			Math.min(maxTileByHeight, maxTileByWidth, 70)
		);

		if (Math.abs(calculatedTileSize - tileSize) > 2) {
			setTileSize(Math.floor(calculatedTileSize));
		}
	}, [wordLength, validWordLength, width]);

	return (
		<View style={styles.container}>
			<View
				ref={contentContainerRef}
				style={styles.contentContainer}
				onLayout={(e) => {
					const h = e.nativeEvent.layout.height;
					if (h > 0 && Math.abs(h - contentHeight) > 5) {
						setContentHeight(h);
					}
				}}
			>
				<View
					style={styles.headerWrapper}
					onLayout={(e) => {
						headerHeightRef.current = e.nativeEvent.layout.height;
					}}
				>
					<GameHeader
						title="WordForm"
						elapsedTime={elapsedTime}
						showDifficulty={false}
					/>
				</View>

				{!validWordLength && (
					<View style={styles.errorContainer}>
						<Text style={styles.errorText}>
							Invalid word length. Must be 3-8 letters. Current: {wordLength}
						</Text>
					</View>
				)}

				<View ref={boardContainerRef} style={styles.boardContainer}>
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

				{!gameWon && !gameLost && (
					<View
						ref={keyboardRef}
						style={styles.keyboard}
						onLayout={(e) => {
							const h = e.nativeEvent.layout.height;
							if (h > 0 && Math.abs(h - keyboardHeight) > 5) {
								setKeyboardHeight(h);
							}
						}}
					>
						{keyboardLayout.map((row, rowIndex) => (
							<View key={rowIndex} style={styles.keyboardRow}>
								{row.map((key) => {
									const disabled = isKeyDisabled(key);
									return (
										<TouchableOpacity
											key={key}
											style={[
												getKeyStyle(key),
												key === "ENTER" || key === "⌫"
													? styles.wideKey
													: styles.regularKey,
												disabled && styles.keyDisabled,
											]}
											onPress={() => handleKeyPress(key)}
											activeOpacity={disabled ? 1 : 0.7}
											disabled={disabled}
										>
											<Text
												style={[
													styles.keyText,
													disabled && styles.keyTextDisabled,
												]}
											>
												{key}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						))}
					</View>
				)}

				{gameLost && !gameWon && (
					<View style={styles.correctAnswerContainer}>
						<Text style={styles.correctAnswerLabel}>The correct word was:</Text>
						<Text style={styles.correctAnswerText}>{answer}</Text>
					</View>
				)}

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
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Spacing.md,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	contentContainer: {
		flex: 1,
		justifyContent: "flex-start", // Start from top instead of space-between
		paddingTop: 0,
	},
	headerWrapper: {
		flex: 0,
		paddingTop: 0,
		paddingBottom: 0,
		marginBottom: 0, // Remove margin
	},
	content: {
		flex: 1,
		paddingHorizontal: Spacing.md,
		alignItems: "center",
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
		backgroundColor: "#3B82F615",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#3B82F640",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#3B82F6",
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
		width: "100%",
		alignItems: "center",
		marginBottom: 0,
		marginTop: "2%",
		paddingVertical: 0, // Remove all padding
	},
	board: {
		alignItems: "center",
	},
	row: {
		flexDirection: "row",
		marginBottom: 2, // Even tighter gaps
		gap: 2,
	},
	tile: {
		borderWidth: 2,
		borderColor: Colors.text.disabled,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.sm, // Smaller radius like NYT
		...Shadows.light,
	},
	empty: {
		backgroundColor: Colors.background.tertiary,
		borderColor: "#E5E5E5",
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
		flex: 0,
		width: "100%",
		paddingTop: 0, // Remove spacing
		paddingBottom: 0,
		marginTop: "7%",
	},
	keyboardRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: 6, // Increased from 2
		gap: 2,
		paddingHorizontal: 0, // Remove horizontal padding
	},
	key: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		paddingVertical: 8, // Increased from 2
		paddingHorizontal: 2,
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 50, // Minimum tile height
		...Shadows.light,
	},
	regularKey: {
		flex: 1,
		minWidth: 24,
		maxWidth: 34,
	},
	wideKey: {
		flex: 1.3,
		minWidth: 44,
		maxWidth: 58,
		paddingHorizontal: 3,
	},
	keyText: {
		fontSize: 11,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	keyAbsent: {
		backgroundColor: "#787c7e",
	},
	keyPresent: {
		backgroundColor: "#c9b458",
	},
	keyCorrect: {
		backgroundColor: "#6aaa64",
	},
	keyDisabled: {
		opacity: 1,
	},
	keyTextDisabled: {
		color: "#ffffff",
		textDecorationLine: "none",
	},
	statusContainer: {
		marginTop: Spacing.xl,
		padding: Spacing.xxl,
		backgroundColor: "#3B82F610",
		borderRadius: BorderRadius.xl,
		alignItems: "center",
		borderWidth: 2.5,
		borderColor: "#3B82F6",
		...Shadows.heavy,
		width: "100%",
	},
	statusEmoji: {
		fontSize: 56,
		marginBottom: Spacing.md,
	},
	statusTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: "#3B82F6",
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
	correctAnswerContainer: {
		width: "100%",
		alignItems: "center",
		marginTop: Spacing.sm,
		marginBottom: Spacing.sm,
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		borderWidth: 2,
		borderColor: "#3B82F640",
		...Shadows.light,
	},
	correctAnswerLabel: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.sm,
		fontWeight: Typography.fontWeight.medium,
	},
	correctAnswerText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: "#3B82F6",
		letterSpacing: 2,
		textTransform: "uppercase",
	},
	viewStatsButton: {
		marginTop: Spacing.xl,
		backgroundColor: "#3B82F6",
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
	},
	viewStatsButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	showAnswerButton: {
		marginTop: Spacing.md,
		backgroundColor: "#ffffff",
		borderRadius: 24,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		borderWidth: 1,
		borderColor: "#d3d6da",
	},
	showAnswerText: {
		color: "#000000",
		fontSize: Typography.fontSize.body,
		fontWeight: "600",
	},
});

export default WordFormGame;
