import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	Animated,
	TextInput,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
} from "react-native";
import words from "an-array-of-english-words";
import { WordChainData, GameResult } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	Layout,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

const { width } = Dimensions.get("window");

// Create a Set for fast word lookup (case-insensitive)
const wordsSet = new Set(words.map((word: string) => word.toLowerCase()));

interface WordChainGameProps {
	inputData: WordChainData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

const WordChainGame: React.FC<WordChainGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	const { startWord, endWord, validWords, minSteps } = inputData;
	const wordLength = startWord.length;
	const numInputs = wordLength - 1; // n letters = n-1 input fields

	const [chain, setChain] = useState<string[]>(Array(numInputs).fill(""));
	const [chainStatus, setChainStatus] = useState<
		("empty" | "valid" | "invalid" | "correct")[]
	>(Array(numInputs).fill("empty"));
	const [gameWon, setGameWon] = useState(false);
	const [gameLost, setGameLost] = useState(false);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [attempts, setAttempts] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;
	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scrollViewRef = useRef<ScrollView>(null);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const hasAttemptedRef = useRef(false); // Track if user has made first interaction

	// Reset timer when puzzle changes
	useEffect(() => {
		if (puzzleIdRef.current !== puzzleId) {
			puzzleIdRef.current = puzzleId || "";
			setElapsedTime(0);
			setGameWon(false);
			setGameLost(false);
			setChain(Array(numInputs).fill(""));
			setChainStatus(Array(numInputs).fill("empty"));
			setAttempts(0);
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
	}, [puzzleId, propStartTime, startTime, numInputs]);

	// Timer effect (only if startTime is set and game is active)
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
			// Pause timer when game is not active
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

	// Keyboard listeners for scrolling
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

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	// Check if two words differ by exactly one letter
	const differsByOneLetter = (word1: string, word2: string): boolean => {
		if (word1.length !== word2.length) return false;
		let differences = 0;
		for (let i = 0; i < word1.length; i++) {
			if (word1[i].toUpperCase() !== word2[i].toUpperCase()) {
				differences++;
			}
		}
		return differences === 1;
	};

	// Validate the entire chain
	const validateChain = (): {
		isValid: boolean;
		statuses: ("valid" | "invalid")[];
	} => {
		const statuses: ("valid" | "invalid")[] = [];
		let allValid = true;

		for (let i = 0; i < chain.length; i++) {
			const word = chain[i].trim().toUpperCase();
			const lowerWord = chain[i].trim().toLowerCase();

			// Check if word is filled
			if (!word || word.length !== wordLength) {
				statuses.push("invalid");
				allValid = false;
				continue;
			}

			// Check if word is a valid English word using the dictionary
			if (!wordsSet.has(lowerWord)) {
				statuses.push("invalid");
				allValid = false;
				continue;
			}

			// Check if it differs by exactly one letter from previous word
			let isValidStep = false;
			if (i === 0) {
				// First word must differ by exactly one letter from start word
				isValidStep = differsByOneLetter(startWord.toUpperCase(), word);
			} else {
				// Must differ by exactly one letter from previous word in chain
				const prevWord = chain[i - 1].trim().toUpperCase();
				if (!prevWord || prevWord.length !== wordLength) {
					isValidStep = false;
				} else {
					isValidStep = differsByOneLetter(prevWord, word);
				}
			}

			if (isValidStep) {
				statuses.push("valid");
			} else {
				statuses.push("invalid");
				allValid = false;
			}
		}

		// Check if the last word differs by one letter from end word
		if (allValid && chain.length > 0) {
			const lastWord = chain[chain.length - 1].trim().toUpperCase();
			if (!differsByOneLetter(lastWord, endWord.toUpperCase())) {
				allValid = false;
				statuses[statuses.length - 1] = "invalid";
			}
		}

		return { isValid: allValid, statuses };
	};

	const handleChainSubmit = () => {
		if (gameWon || gameLost) return;

		// Check if all fields are filled
		const allFilled = chain.every((word) => word.trim().length === wordLength);
		if (!allFilled) {
			// Shake animation for incomplete fields
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
			return;
		}

		const newAttempts = attempts + 1;
		setAttempts(newAttempts);

		// Validate the entire chain
		const validation = validateChain();

		if (validation.isValid) {
			// Chain is valid - check if it connects to end word
			const lastWord = chain[chain.length - 1].trim().toUpperCase();
			if (differsByOneLetter(lastWord, endWord.toUpperCase())) {
				// Success!
				setChainStatus(validation.statuses.map(() => "valid" as const));
				setGameWon(true);

				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
				}
				setElapsedTime(Math.floor((Date.now() - startTime) / 1000));

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
					puzzleId: puzzleId || `wordchain_${Date.now()}`,
					completed: true,
					timeTaken: Math.floor((Date.now() - startTime) / 1000),
					attempts: newAttempts,
					completedAt: new Date().toISOString(),
				});
			} else {
				// Chain is valid but doesn't connect to end word
				setChainStatus(validation.statuses);
				// Shake animation
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
		} else {
			// Chain has invalid words
			setChainStatus(validation.statuses);
			// Shake animation
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

	const handleWordChange = (index: number, value: string) => {
		if (gameWon || gameLost) return;

		// Track first interaction (user started attempting the game)
		if (!hasAttemptedRef.current && value.length > 0 && puzzleId) {
			hasAttemptedRef.current = true;

			// Update session tracking in feed.tsx
			// Firestore will be updated only if user skips after attempting
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		// Only allow letters and limit to word length
		const filtered = value
			.replace(/[^a-zA-Z]/g, "")
			.toUpperCase()
			.slice(0, wordLength);
		const newChain = [...chain];
		newChain[index] = filtered;
		setChain(newChain);
		// Reset status when user edits
		const newStatus = [...chainStatus];
		newStatus[index] = "empty";
		setChainStatus(newStatus);
	};

	const handleKeyPress = (index: number, e: any) => {
		// Move to next input on Enter/Return if current is filled
		if (e.nativeEvent.key === "Enter" || e.nativeEvent.key === "return") {
			if (chain[index].length === wordLength && index < chain.length - 1) {
				inputRefs.current[index + 1]?.focus();
			} else if (
				chain[index].length === wordLength &&
				index === chain.length - 1
			) {
				// Last field - submit if all filled
				handleChainSubmit();
			}
		}
	};

	const getInputStyle = (index: number) => {
		const status = chainStatus[index];
		if (status === "valid") {
			return [styles.input, styles.validInput];
		}
		if (status === "invalid") {
			return [styles.input, styles.invalidInput];
		}
		return [styles.input, styles.emptyInput];
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			keyboardVerticalOffset={0}
		>
			<GameHeader
				title="Word Chain"
				elapsedTime={elapsedTime}
				showDifficulty={false}
			/>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingBottom:
							keyboardHeight > 0 ? keyboardHeight + 200 : Spacing.xl,
					},
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				scrollEnabled={true}
			>
				{/* Start and End Words */}
				<View style={styles.startEndContainer}>
					<View style={styles.wordBox}>
						<Text style={styles.wordLabel}>Start</Text>
						<Text style={styles.startWord}>{startWord.toUpperCase()}</Text>
					</View>
					<Text style={styles.arrow}>→</Text>
					<View style={styles.wordBox}>
						<Text style={styles.wordLabel}>End</Text>
						<Text style={styles.endWord}>{endWord.toUpperCase()}</Text>
					</View>
				</View>

				{/* Chain Input Fields */}
				<Animated.View
					style={[
						styles.chainContainer,
						{
							transform: [
								{ translateX: shakeAnimation },
								{ scale: successScale },
							],
						},
					]}
				>
					{chain.map((word, index) => (
						<View key={index} style={styles.chainRow}>
							<TextInput
								ref={(ref) => {
									inputRefs.current[index] = ref;
								}}
								style={getInputStyle(index) as any}
								value={word}
								onChangeText={(value) => handleWordChange(index, value)}
								onKeyPress={(e) => handleKeyPress(index, e)}
								maxLength={wordLength}
								autoCapitalize="characters"
								editable={!gameWon && !gameLost}
								selectTextOnFocus
								placeholder={`Word ${index + 1}`}
								placeholderTextColor={Colors.text.disabled}
								onFocus={() => {
									// Simple scroll calculation based on index
									// Each input row is approximately 80px tall (input + margin)
									// Start/End section is approximately 100px
									// We want the focused input to be visible with some space above
									const estimatedY = 100 + index * 80;
									setTimeout(() => {
										scrollViewRef.current?.scrollTo({
											y: estimatedY,
											animated: true,
										});
									}, 100);
								}}
							/>
						</View>
					))}
				</Animated.View>

				{/* Submit Button */}
				{!gameWon && !gameLost && (
					<TouchableOpacity
						style={[
							styles.submitButton,
							chain.every((w) => w.trim().length === wordLength) &&
								styles.submitButtonEnabled,
						]}
						onPress={handleChainSubmit}
						disabled={!chain.every((w) => w.trim().length === wordLength)}
						activeOpacity={0.7}
					>
						<Text
							style={[
								styles.submitButtonText,
								chain.every((w) => w.trim().length === wordLength) &&
									styles.submitButtonTextEnabled,
							]}
						>
							Submit Chain
						</Text>
					</TouchableOpacity>
				)}

				{/* View Stats Button */}
				{(gameWon || gameLost) && onShowStats && (
					<TouchableOpacity
						style={styles.viewStatsButton}
						onPress={onShowStats}
						activeOpacity={0.7}
					>
						<Text style={styles.viewStatsButtonText}>View Stats</Text>
					</TouchableOpacity>
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
	startEndContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: Spacing.lg,
		marginBottom: Spacing.xl,
		gap: Spacing.md,
	},
	wordBox: {
		alignItems: "center",
		padding: Spacing.md,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		borderWidth: 2,
		borderColor: Colors.accent,
		minWidth: 100,
	},
	wordLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginBottom: Spacing.xs,
		fontWeight: Typography.fontWeight.medium,
	},
	startWord: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		letterSpacing: 2,
	},
	endWord: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.game.correct,
		letterSpacing: 2,
	},
	arrow: {
		fontSize: Typography.fontSize.h1,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.bold,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	chainContainer: {
		width: "100%",
		marginBottom: Spacing.lg,
	},
	chainRow: {
		width: "100%",
		marginBottom: Spacing.md,
		alignItems: "center",
	},
	input: {
		width: "80%",
		maxWidth: 300,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 2,
		textAlign: "center",
		color: Colors.text.primary,
		...Shadows.light,
	},
	emptyInput: {
		backgroundColor: Colors.background.tertiary,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	validInput: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
		color: Colors.text.white,
	},
	invalidInput: {
		backgroundColor: Colors.error,
		borderColor: Colors.error,
		color: Colors.text.white,
	},
	submitButton: {
		marginTop: Spacing.xl,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.2)",
		opacity: 0.5,
	},
	submitButtonEnabled: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
		opacity: 1,
		...Shadows.medium,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},
	submitButtonTextEnabled: {
		color: Colors.text.white,
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
});

export default WordChainGame;
