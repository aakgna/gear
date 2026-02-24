import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	Animated,
	ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameResult, HangmanData } from "../../config/types";
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

interface HangmanGameProps {
	inputData: HangmanData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}

const HangmanGame: React.FC<HangmanGameProps> = ({
	inputData = { word: "EXTRAORDINARY", hint: "Something remarkable or unusual", maxGuesses: 6 },
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
	initialCompletedResult,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70;
	const gameColor = getGameColor("hangman");

	const word = inputData.word.toUpperCase();
	const maxGuesses = inputData.maxGuesses || 6;

	const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
	const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [attempts, setAttempts] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	const puzzleSignature = `${word}_${inputData.hint || ""}`;

	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

	const isWordComplete = word.split("").every(letter => guessedLetters.has(letter));

	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;

			if (initialCompletedResult && initialCompletedResult.completed && !initialCompletedResult.answerRevealed) {
				setElapsedTime(initialCompletedResult.timeTaken);
				setAttempts(initialCompletedResult.attempts || 0);
				hasAttemptedRef.current = true;

				const allLetters = new Set(word.split(""));
				setGuessedLetters(allLetters);
				setWrongGuesses([]);
				setGameWon(true);
				setGameLost(false);

				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
				}
				setStartTime(undefined);
			} else {
				setElapsedTime(0);
				setAttempts(0);
				setGuessedLetters(new Set());
				setWrongGuesses([]);
				setGameWon(false);
				setGameLost(false);
				hasAttemptedRef.current = false;
				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
				}
				if (propStartTime) {
					setStartTime(propStartTime);
				} else {
					setStartTime(undefined);
				}
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
	}, [puzzleSignature, propStartTime, startTime, initialCompletedResult]);

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

	useEffect(() => {
		if (gameWon || gameLost) return;

		if (isWordComplete && guessedLetters.size > 0) {
			setGameWon(true);
			handleComplete(true);
		}

		if (wrongGuesses.length >= maxGuesses) {
			setGameLost(true);
			handleComplete(false);
		}
	}, [guessedLetters, wrongGuesses, isWordComplete]);

	const handleComplete = (won: boolean) => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		const timeTaken = startTime
			? Math.floor((Date.now() - startTime) / 1000)
			: 0;
		setElapsedTime(timeTaken);

		if (won) {
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
		}

		onComplete({
			puzzleId: puzzleId || `hangman_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts,
			mistakes: wrongGuesses.length,
			completedAt: new Date().toISOString(),
		});
	};

	const handleLetterGuess = (letter: string) => {
		if (gameWon || gameLost || guessedLetters.has(letter)) return;

		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		setAttempts(prev => prev + 1);
		const newGuessed = new Set(guessedLetters);
		newGuessed.add(letter);
		setGuessedLetters(newGuessed);

		if (!word.includes(letter)) {
			setWrongGuesses(prev => [...prev, letter]);

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
		}
	};

	const renderHangman = () => {
		const parts = wrongGuesses.length;

		return (
			<Animated.View
				style={[
					styles.hangmanContainer,
					{ transform: [{ translateX: shakeAnimation }] }
				]}
			>
				<View style={styles.gallowsWrapper}>
					{/* Base */}
					<View style={styles.gallowsBase} />
					{/* Vertical pole */}
					<View style={styles.gallowsPole} />
					{/* Top horizontal beam */}
					<View style={styles.gallowsTop} />
					{/* Rope */}
					<View style={styles.gallowsRope} />

					{/* Hangman figure */}
					<View style={styles.hangmanFigure}>
						{/* Head */}
						{parts >= 1 && <View style={styles.hangmanHead} />}
						{/* Body */}
						{parts >= 2 && <View style={styles.hangmanBody} />}
						{/* Left arm - overlapping body */}
						{parts >= 3 && <View style={styles.hangmanLeftArm} />}
						{/* Right arm - overlapping body */}
						{parts >= 4 && <View style={styles.hangmanRightArm} />}
						{/* Left leg - overlapping body bottom */}
						{parts >= 5 && <View style={styles.hangmanLeftLeg} />}
						{/* Right leg - overlapping body bottom */}
						{parts >= 6 && <View style={styles.hangmanRightLeg} />}
					</View>
				</View>
			</Animated.View>
		);
	};

	const renderWord = () => {
		const screenWidth = Dimensions.get('window').width;
		const availableWidth = screenWidth - (Spacing.md * 4);
		const wordLength = word.length;

		let letterBoxWidth = 40;
		let letterGap = Spacing.xs;
		let fontSize = Typography.fontSize.h1;

		let totalWidth = (letterBoxWidth * wordLength) + (letterGap * (wordLength - 1));

		if (totalWidth > availableWidth) {
			const scale = availableWidth / totalWidth;
			letterBoxWidth = Math.floor(letterBoxWidth * scale);
			letterGap = Math.floor(letterGap * scale);
			fontSize = Math.floor(fontSize * scale);

			letterBoxWidth = Math.max(letterBoxWidth, 25);
			letterGap = Math.max(letterGap, 2);
			fontSize = Math.max(fontSize, 16);
		}

		const letterBoxHeight = letterBoxWidth * 1.25;

		return (
			<Animated.View
				style={[
					styles.wordWrapper,
					{ transform: [{ scale: successScale }] }
				]}
			>
				<View style={styles.wordRow}>
					{word.split("").map((letter, index) => (
						<View
							key={index}
							style={[
								styles.letterBox,
								{
									width: letterBoxWidth,
									height: letterBoxHeight,
									marginHorizontal: letterGap / 2,
								}
							]}
						>
							<Text style={[styles.letterText, { fontSize }]}>
								{guessedLetters.has(letter) ? letter : "_"}
							</Text>
						</View>
					))}
				</View>
			</Animated.View>
		);
	};

	return (
		<View style={styles.container}>
			<GameHeader
				title="Hangman"
				elapsedTime={elapsedTime}
				showDifficulty={false}
				gameType="hangman"
				puzzleId={puzzleId}
			/>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg },
				]}
				showsVerticalScrollIndicator={false}
			>
				{inputData.hint && (
					<View style={styles.hintContainer}>
						<Text style={styles.hintLabel}>💡 Hint:</Text>
						<Text style={styles.hintText}>{inputData.hint}</Text>
					</View>
				)}

				{renderHangman()}

				<View style={styles.guessesContainer}>
					<Text style={styles.guessesText}>
						Guesses remaining: {maxGuesses - wrongGuesses.length}
					</Text>
				</View>

				{renderWord()}

				{wrongGuesses.length > 0 && (
					<View style={styles.wrongGuessesContainer}>
						<Text style={styles.wrongGuessesLabel}>Wrong guesses:</Text>
						<View style={styles.wrongGuessesList}>
							{wrongGuesses.map((letter, index) => (
								<View key={index} style={styles.wrongLetter}>
									<Text style={styles.wrongLetterText}>{letter}</Text>
								</View>
							))}
						</View>
					</View>
				)}

				{gameWon && (
					<View style={styles.resultContainer}>
						<Text style={styles.successText}>🎉 You won!</Text>
						<Text style={styles.resultSubtext}>
							You guessed the word with {maxGuesses - wrongGuesses.length} {maxGuesses - wrongGuesses.length === 1 ? 'guess' : 'guesses'} remaining!
						</Text>
					</View>
				)}

				{gameLost && (
					<View style={styles.resultContainer}>
						<Text style={styles.failureText}>Game Over!</Text>
						<Text style={styles.resultSubtext}>
							The word was: <Text style={styles.revealedWord}>{word}</Text>
						</Text>
					</View>
				)}

				{!gameWon && !gameLost && (
					<View style={styles.keyboardContainer}>
						<View style={styles.keyboard}>
							{alphabet.map((letter) => {
								const isGuessed = guessedLetters.has(letter);
								const isWrong = wrongGuesses.includes(letter);
								const isCorrect = isGuessed && !isWrong;

								return (
									<TouchableOpacity
										key={letter}
										style={[
											styles.letterButton,
											isGuessed && styles.letterButtonGuessed,
											isCorrect && styles.letterButtonCorrect,
											isWrong && styles.letterButtonWrong,
										]}
										onPress={() => handleLetterGuess(letter)}
										disabled={isGuessed}
									>
										<Text
											style={[
												styles.letterButtonText,
												isGuessed && styles.letterButtonTextGuessed,
											]}
										>
											{letter}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				)}

				{(gameWon || gameLost) && (
					<TouchableOpacity
						style={styles.statsButton}
						onPress={onShowStats}
					>
						<Text style={styles.statsButtonText}>View Stats</Text>
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
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.md,
	},
	hintContainer: {
		backgroundColor: Colors.background.primary,
		padding: Spacing.md,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.lg,
		...Shadows.light,
	},
	hintLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	hintText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		lineHeight: Typography.fontSize.body * 1.5,
	},
	hangmanContainer: {
		alignItems: "center",
		justifyContent: "center",
		marginVertical: Spacing.lg,
		minHeight: 220,
	},
	gallowsWrapper: {
		position: "relative",
		width: 160,
		height: 220,
		alignItems: "center",
	},
	gallowsBase: {
		position: "absolute",
		bottom: 0,
		left: 20,
		width: 120,
		height: 4,
		backgroundColor: Colors.text.primary,
	},
	gallowsPole: {
		position: "absolute",
		bottom: 4,
		left: 40,
		width: 4,
		height: 180,
		backgroundColor: Colors.text.primary,
	},
	gallowsTop: {
		position: "absolute",
		top: 36,
		left: 40,
		width: 80,
		height: 4,
		backgroundColor: Colors.text.primary,
	},
	gallowsRope: {
		position: "absolute",
		top: 40,
		left: 116,
		width: 2,
		height: 30,
		backgroundColor: Colors.text.primary,
	},
	hangmanFigure: {
		position: "absolute",
		top: 70,
		left: 101,
		alignItems: "center",
	},
	hangmanHead: {
		width: 30,
		height: 30,
		borderRadius: 15,
		borderWidth: 3,
		borderColor: Colors.text.primary,
		backgroundColor: "transparent",
	},
	hangmanBody: {
		width: 3,
		height: 50,
		backgroundColor: Colors.text.primary,
		marginTop: 0,
	},
	hangmanLeftArm: {
		position: "absolute",
		top: 35,
		left: -11.5,
		width: 15,
		height: 3,
		backgroundColor: Colors.text.primary,
		transform: [{ rotate: "-45deg" }],
	},
	hangmanRightArm: {
		position: "absolute",
		top: 35,
		right: -11.5,
		width: 15,
		height: 3,
		backgroundColor: Colors.text.primary,
		transform: [{ rotate: "45deg" }],
	},
	hangmanLeftLeg: {
		position: "absolute",
		bottom: -28,
		left: -9.5,
		width: 20,
		height: 3,
		backgroundColor: Colors.text.primary,
		transform: [{ rotate: "-50deg" }],
	},
	hangmanRightLeg: {
		position: "absolute",
		bottom: -28,
		right: -9.5,
		width: 20,
		height: 3,
		backgroundColor: Colors.text.primary,
		transform: [{ rotate: "50deg" }],
	},
	guessesContainer: {
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	guessesText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},
	wordWrapper: {
		alignItems: "center",
		marginVertical: Spacing.lg,
		paddingHorizontal: Spacing.md,
	},
	wordRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		flexWrap: "nowrap",
	},
	letterBox: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		justifyContent: "center",
		alignItems: "center",
		borderBottomWidth: 3,
		borderBottomColor: Colors.text.inactive,
		...Shadows.light,
	},
	letterText: {
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	wrongGuessesContainer: {
		backgroundColor: Colors.background.primary,
		padding: Spacing.md,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.lg,
		...Shadows.light,
	},
	wrongGuessesLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.error,
		marginBottom: Spacing.sm,
	},
	wrongGuessesList: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.xs,
	},
	wrongLetter: {
		backgroundColor: Colors.error + "20",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.error + "40",
	},
	wrongLetterText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.error,
	},
	resultContainer: {
		backgroundColor: Colors.background.primary,
		padding: Spacing.lg,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.lg,
		alignItems: "center",
		...Shadows.medium,
	},
	successText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.game.correct,
		marginBottom: Spacing.sm,
	},
	failureText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.error,
		marginBottom: Spacing.sm,
	},
	resultSubtext: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
	},
	revealedWord: {
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	keyboardContainer: {
		marginBottom: Spacing.lg,
	},
	keyboard: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	letterButton: {
		width: 38,
		height: 48,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	letterButtonGuessed: {
		backgroundColor: Colors.background.tertiary,
		opacity: 0.5,
	},
	letterButtonCorrect: {
		backgroundColor: Colors.game.correct + "20",
		borderWidth: 2,
		borderColor: Colors.game.correct,
		opacity: 1,
	},
	letterButtonWrong: {
		backgroundColor: Colors.error + "20",
		borderWidth: 2,
		borderColor: Colors.error,
		opacity: 1,
	},
	letterButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	letterButtonTextGuessed: {
		color: Colors.text.inactive,
	},
	statsButton: {
		backgroundColor: ComponentStyles.button.backgroundColor,
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		marginBottom: Spacing.lg,
		...Shadows.medium,
	},
	statsButtonText: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.white,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
	},
});

export default HangmanGame;

