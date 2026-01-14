import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableOpacity,
	ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GameWrapper from "../../components/games/GameWrapper";
import {
	Puzzle,
	PuzzleType,
	GameResult,
	QuickMathData,
	WordleData,
	RiddleData,
	WordChainData,
	AliasData,
	ZipData,
	FutoshikiData,
	MagicSquareData,
	HidatoData,
	SudokuData,
	TriviaData,
	MastermindData,
	SequencingData,
} from "../../config/types";
import {
	db,
	trackGameAttempted,
	trackGameCompleted,
} from "../../config/firebase";
import {
	getCurrentUser,
	addAttemptedGame,
	addCompletedGame,
} from "../../config/auth";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../../constants/DesignSystem";
import { useSessionEndRefresh } from "../../utils/sessionRefresh";

// Utility function to load a game by puzzleId (format: gameType_difficulty_gameId)
const loadGameByPuzzleId = async (puzzleId: string): Promise<Puzzle | null> => {
	try {
		const parts = puzzleId.split("_");
		if (parts.length < 3) {
			console.error(
				`[loadGameByPuzzleId] Invalid puzzleId format: ${puzzleId}`
			);
			return null;
		}

		let gameType = parts[0];
		const difficulty = parts[1];
		const gameId = parts.slice(2).join("_"); // In case gameId contains underscores

		// Normalize gameType to match Firestore collection names
		// puzzleId uses lowercase (e.g., "quickmath"), but Firestore uses camelCase (e.g., "quickMath")
		if (gameType === "quickmath") {
			gameType = "quickMath";
		} else if (gameType === "wordchain") {
			gameType = "wordChain";
		} else if (gameType === "magicsquare") {
			gameType = "magicSquare";
		}
		// Other game types (wordle, riddle, trivia, mastermind, sequencing, alias, zip, futoshiki, hidato, sudoku) use lowercase in both

		// Fetch game from Firestore
		const gameDoc = await db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId)
			.get();

		const exists =
			typeof gameDoc.exists === "function" ? gameDoc.exists() : gameDoc.exists;
		if (!exists) {
			console.error(`[loadGameByPuzzleId] Game not found: ${puzzleId}`);
			return null;
		}

		const gameData = gameDoc.data();
		if (!gameData) {
			return null;
		}

		// Transform based on game type (use normalized gameType)
		let puzzleData: any = {};
		let isValid = false;
		const normalizedGameType = gameType; // Already normalized above

		// Handle QuickMath
		if (
			normalizedGameType === "quickMath" &&
			gameData.questions &&
			gameData.answers
		) {
			puzzleData = {
				problems: gameData.questions,
				answers: gameData.answers,
			} as QuickMathData;
			isValid = true;
		}
		// Handle Wordle
		else if (normalizedGameType === "wordle" && gameData.qna) {
			puzzleData = {
				answer: gameData.qna.toUpperCase(),
			} as WordleData;
			isValid = true;
		}
		// Handle Riddle
		else if (
			normalizedGameType === "riddle" &&
			gameData.question &&
			gameData.answer &&
			gameData.choices
		) {
			puzzleData = {
				prompt: gameData.question,
				answer: gameData.answer,
				choices: gameData.choices,
			} as RiddleData;
			isValid = true;
		}
		// Handle Trivia
		else if (normalizedGameType === "trivia" && gameData.questions) {
			puzzleData = {
				questions: gameData.questions,
			} as TriviaData;
			isValid = true;
		}
		// Handle Mastermind
		else if (
			normalizedGameType === "mastermind" &&
			gameData.secretCode &&
			Array.isArray(gameData.secretCode) &&
			gameData.maxGuesses
		) {
			puzzleData = {
				secretCode: gameData.secretCode,
				maxGuesses: gameData.maxGuesses,
			} as MastermindData;
			isValid = true;
		}
		// Handle Sequencing
		else if (
			normalizedGameType === "sequencing" &&
			gameData.theme &&
			gameData.numSlots &&
			gameData.entities &&
			Array.isArray(gameData.entities) &&
			gameData.rules &&
			Array.isArray(gameData.rules) &&
			gameData.solution &&
			Array.isArray(gameData.solution)
		) {
			puzzleData = {
				theme: gameData.theme as "people" | "appointments" | "runners",
				numSlots: gameData.numSlots,
				entities: gameData.entities,
				rules: gameData.rules.map((r: any) => ({
					type: r.type,
					entity1: r.entity1,
					entity2: r.entity2,
					position: r.position,
					minDistance: r.minDistance,
					description: r.description,
				})),
				solution: gameData.solution,
			} as SequencingData;
			isValid = true;
		}
		// Handle WordChain
		else if (
			normalizedGameType === "wordChain" &&
			gameData.startWord &&
			gameData.endWord &&
			gameData.answer
		) {
			const answerArray = Array.isArray(gameData.answer)
				? gameData.answer
				: typeof gameData.answer === "string"
				? [gameData.answer]
				: [];
			puzzleData = {
				startWord: gameData.startWord,
				endWord: gameData.endWord,
				answer: answerArray,
				minSteps: gameData.minSteps || 3,
				hint: gameData.hint,
			} as WordChainData;
			isValid = true;
		}
		// Handle Alias
		else if (
			normalizedGameType === "alias" &&
			gameData.definitions &&
			gameData.answer &&
			gameData.choices
		) {
			puzzleData = {
				definitions: gameData.definitions,
				answer: gameData.answer,
				choices: gameData.choices,
			} as AliasData;
			isValid = true;
		}
		// Handle Zip
		else if (
			normalizedGameType === "zip" &&
			gameData.rows &&
			gameData.cols &&
			gameData.cells &&
			gameData.solution
		) {
			puzzleData = {
				rows: gameData.rows,
				cols: gameData.cols,
				cells: gameData.cells,
				solution: gameData.solution,
			} as ZipData;
			isValid = true;
		}
		// Handle Futoshiki
		else if (
			normalizedGameType === "futoshiki" &&
			gameData.size &&
			gameData.grid &&
			gameData.givens &&
			gameData.inequalities
		) {
			puzzleData = {
				size: gameData.size,
				grid: gameData.grid,
				givens: gameData.givens,
				inequalities: gameData.inequalities,
			} as FutoshikiData;
			isValid = true;
		}
		// Handle MagicSquare
		else if (
			normalizedGameType === "magicSquare" &&
			gameData.size &&
			gameData.grid &&
			gameData.magicConstant
		) {
			puzzleData = {
				size: gameData.size,
				grid: gameData.grid,
				magicConstant: gameData.magicConstant,
			} as MagicSquareData;
			isValid = true;
		}
		// Handle Hidato
		else if (
			normalizedGameType === "hidato" &&
			gameData.size &&
			gameData.startNum &&
			gameData.endNum &&
			gameData.path
		) {
			puzzleData = {
				size: gameData.size,
				startNum: gameData.startNum,
				endNum: gameData.endNum,
				path: gameData.path,
			} as HidatoData;
			isValid = true;
		}
		// Handle Sudoku
		else if (
			normalizedGameType === "sudoku" &&
			gameData.size &&
			gameData.grid
		) {
			puzzleData = {
				size: gameData.size,
				grid: gameData.grid,
			} as SudokuData;
			isValid = true;
		}

		if (!isValid) {
			console.error(
				`[loadGameByPuzzleId] Invalid game data for ${normalizedGameType}:`,
				gameData
			);
			return null;
		}

		// Convert normalized gameType back to PuzzleType format (camelCase for types that need it)
		// The Puzzle type expects camelCase for quickMath, wordChain, magicSquare
		const puzzleType: PuzzleType = normalizedGameType as PuzzleType;

		return {
			id: puzzleId,
			type: puzzleType,
			data: puzzleData,
			difficulty: difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
			createdAt:
				gameData.createdAt?.toDate?.()?.toISOString() ||
				new Date().toISOString(),
			username: gameData.username,
			uid: gameData.uid || gameData.createdBy, // Add creator user ID (try both uid and createdBy)
			profilePicture: gameData.profilePicture || null, // Add creator profile picture
		};
	} catch (error) {
		console.error(
			`[loadGameByPuzzleId] Error loading game ${puzzleId}:`,
			error
		);
		return null;
	}
};

const PlayGameScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ gameId: string }>();
	const gameId = params.gameId ? decodeURIComponent(params.gameId) : undefined;
	const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (gameId) {
			loadGame();
		} else {
			setError("No game ID provided");
			setLoading(false);
		}
	}, [gameId]);

	const loadGame = async () => {
		if (!gameId) {
			console.error("[PlayGameScreen] No gameId provided");
			setError("No game ID provided");
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const loadedPuzzle = await loadGameByPuzzleId(gameId);
			if (loadedPuzzle) {
				setPuzzle(loadedPuzzle);
			} else {
				console.error("[PlayGameScreen] Game not found for puzzleId:", gameId);
				setError("Game not found");
			}
		} catch (err: any) {
			console.error("[PlayGameScreen] Error loading game:", err);
			setError(err.message || "Failed to load game");
		} finally {
			setLoading(false);
		}
	};

	const handleComplete = async (result: GameResult) => {
		const user = getCurrentUser();
		if (!user || !gameId) return;

		try {
			// Track completion
			await addCompletedGame(user.uid, gameId, result);
			await trackGameCompleted(gameId);

			// Don't auto-navigate - let user stay to view social features and use back button manually
		} catch (error) {
			console.error("Error handling game completion:", error);
		}
	};

	const handleAttempt = async () => {
		const user = getCurrentUser();
		if (!user || !gameId) return;

		try {
			await addAttemptedGame(user.uid, gameId);
			await trackGameAttempted(gameId);
		} catch (error) {
			console.error("Error tracking game attempt:", error);
		}
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Loading...</Text>
					<View style={styles.headerSpacer} />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			</View>
		);
	}

	if (error || !puzzle) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Error</Text>
					<View style={styles.headerSpacer} />
				</View>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error || "Game not found"}</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			{/* Header with Back Button */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Play Game</Text>
				<View style={styles.headerSpacer} />
			</View>

			{/* Game Wrapper */}
			<View style={styles.gameContainer}>
				<GameWrapper
					puzzle={puzzle}
					onComplete={handleComplete}
					onAttempt={handleAttempt}
					isActive={true}
					forceShowIntro={true}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		zIndex: 10,
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	headerSpacer: {
		width: 40,
	},
	gameContainer: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	errorText: {
		fontSize: Typography.fontSize.body,
		color: Colors.error,
		textAlign: "center",
	},
});

export default PlayGameScreen;
