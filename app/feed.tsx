import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";
import {
	View,
	FlatList,
	StyleSheet,
	Dimensions,
	TouchableOpacity,
	Text,
	Alert,
	ActivityIndicator,
	Animated,
	Image,
	Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
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
} from "../config/types";
import GameWrapper from "../components/games/GameWrapper";
import { useGameStore } from "../stores/gameStore";
import {
	fetchGamesFromFirestore,
	FirestoreGame,
	trackGameSkipped,
	trackGameAttempted,
	trackGameCompleted,
	decrementGameSkipped,
	batchCheckGameHistory,
	migrateUserArraysToHistory,
	db,
} from "../config/firebase";
import {
	getSimpleRecommendations,
	interleaveGamesByType,
} from "../config/recommendations";
import {
	getCurrentUser,
	getUserData,
	UserData,
	addSkippedGame,
	addAttemptedGame,
	moveFromSkippedToAttempted,
} from "../config/auth";
import { fetchFollowingFeed } from "../config/social";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// Utility function to deduplicate games by ID
function deduplicateGames(games: Puzzle[]): Puzzle[] {
	const seen = new Map<string, Puzzle>();
	let duplicateCount = 0;

	games.forEach((game) => {
		if (!seen.has(game.id)) {
			seen.set(game.id, game);
		} else {
			duplicateCount++;
		}
	});

	if (duplicateCount > 0) {
		console.log(`[Dedupe] Removed ${duplicateCount} duplicate games`);
	}

	return Array.from(seen.values());
}

const FeedScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	// Separate state for each tab to maintain independent scroll positions
	const [currentIndexForYou, setCurrentIndexForYou] = useState(0);
	const [currentIndexFollowing, setCurrentIndexFollowing] = useState(0);
	const [currentPuzzleIdForYou, setCurrentPuzzleIdForYou] =
		useState<string>("");
	const [currentPuzzleIdFollowing, setCurrentPuzzleIdFollowing] =
		useState<string>("");
	const [headerHeight, setHeaderHeight] = useState(0);
	const [feedHeight, setFeedHeight] = useState(0);
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
	const [displayedPuzzles, setDisplayedPuzzles] = useState<Puzzle[]>([]);
	const [allRecommendedPuzzles, setAllRecommendedPuzzles] = useState<Puzzle[]>(
		[]
	);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [userData, setUserData] = useState<UserData | null>(null);
	// Track elapsed time for each puzzle (in seconds) - initialized to 0 for all puzzles
	const puzzleElapsedTimesRef = useRef<Record<string, number>>({});
	// Track when each puzzle became visible (for calculating elapsed time)
	const puzzleVisibleTimesRef = useRef<Record<string, number>>({});
	// Track the startTime for each puzzle (calculated when it becomes visible)
	const puzzleStartTimesRef = useRef<Record<string, number>>({});
	// Track previous active puzzle to detect transitions (separate for each tab)
	const previousActivePuzzleIdRef = useRef<
		Record<"forYou" | "following", string>
	>({
		forYou: "",
		following: "",
	});
	// Track initial completed games to filter on load only
	const initialCompletedGamesRef = useRef<Set<string>>(new Set());
	// Track completed puzzles during this session
	const completedPuzzlesRef = useRef<Set<string>>(new Set());
	// Track attempted puzzles during this session (user interacted with it)
	const attemptedPuzzlesRef = useRef<Set<string>>(new Set());
	// Track skipped puzzles during this session to avoid duplicate tracking
	const skippedPuzzlesRef = useRef<Set<string>>(new Set());
	// Track checked games to avoid duplicate completion checks
	const checkedGamesRef = useRef<Map<string, boolean>>(new Map());
	// Track keyboard state to disable FlatList scrolling when keyboard is visible
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const keyboardHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	// Infinite scroll state
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const [hasMoreGamesToFetch, setHasMoreGamesToFetch] = useState(true);
	// Track if initial data load has completed to prevent reloading on refocus
	const hasLoadedRef = useRef(false);
	// Feed tabs state
	const [activeTab, setActiveTab] = useState<"forYou" | "following">("forYou");
	const [followingPuzzles, setFollowingPuzzles] = useState<Puzzle[]>([]);
	const [loadingFollowing, setLoadingFollowing] = useState(false);
	// Separate refs for each FlatList
	const forYouFlatListRef = useRef<FlatList<Puzzle>>(null);
	const followingFlatListRef = useRef<FlatList<Puzzle>>(null);

	// Computed current state based on active tab (must be after activeTab declaration)
	const currentIndex =
		activeTab === "forYou" ? currentIndexForYou : currentIndexFollowing;
	const currentPuzzleId =
		activeTab === "forYou" ? currentPuzzleIdForYou : currentPuzzleIdFollowing;
	const setCurrentIndex =
		activeTab === "forYou" ? setCurrentIndexForYou : setCurrentIndexFollowing;
	const setCurrentPuzzleId =
		activeTab === "forYou"
			? setCurrentPuzzleIdForYou
			: setCurrentPuzzleIdFollowing;

	const { addCompletedPuzzle } = useGameStore();

	// Listen to keyboard events to disable FlatList scrolling
	useEffect(() => {
		const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
			// Clear any pending hide timeout
			if (keyboardHideTimeoutRef.current) {
				clearTimeout(keyboardHideTimeoutRef.current);
				keyboardHideTimeoutRef.current = null;
			}
			setIsKeyboardVisible(true);
		});
		const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
			// Delay re-enabling scrolling to prevent stuck state during keyboard animation
			if (keyboardHideTimeoutRef.current) {
				clearTimeout(keyboardHideTimeoutRef.current);
			}
			keyboardHideTimeoutRef.current = setTimeout(() => {
				setIsKeyboardVisible(false);
				keyboardHideTimeoutRef.current = null;
			}, 300); // Wait for keyboard animation to complete
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
			if (keyboardHideTimeoutRef.current) {
				clearTimeout(keyboardHideTimeoutRef.current);
			}
		};
	}, []);

	// Load user data and puzzles from Firestore (only once on initial mount)
	// Since component stays mounted, this will only run once
	useEffect(() => {
		// Only load if we haven't loaded yet
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			loadUserData(true); // Pass true to indicate initial load
			loadPuzzlesFromFirestore();
			loadFollowingFeed();
		}
	}, []);

	// Load following feed
	const loadFollowingFeed = async () => {
		const user = getCurrentUser();
		if (!user) return;

		setLoadingFollowing(true);
		try {
			const followingGames = await fetchFollowingFeed(user.uid, 50);

			// Verify we only have games from followed users (safety check)
			// Get list of followed users to verify
			const followingSnapshot = await db
				.collection("users")
				.doc(user.uid)
				.collection("following")
				.get();
			const followedUids = new Set(followingSnapshot.docs.map((doc) => doc.id));

			// Filter out completed games first using batch check
			const gameIds = followingGames.map(
				(g) => `${g.gameType}_${g.difficulty}_${g.gameId}`
			);
			const completedGameIds = await batchCheckGameHistory(
				user.uid,
				gameIds,
				"completed"
			);

			// Transform following games to Puzzle format
			// We need to fetch the actual game data from Firestore
			const puzzles: Puzzle[] = [];

			for (const game of followingGames) {
				// Safety check: Only include games from users we follow
				if (game.createdBy && !followedUids.has(game.createdBy)) {
					console.warn(
						`[Following Feed] Skipping game from unfollowed user: ${game.createdBy}`
					);
					continue;
				}

				// Skip if user has already completed this game
				const gameId = `${game.gameType}_${game.difficulty}_${game.gameId}`;
				if (completedGameIds.has(gameId)) {
					continue;
				}
				try {
					const gameDoc = await db
						.collection("games")
						.doc(game.gameType)
						.collection(game.difficulty)
						.doc(game.gameId)
						.get();

					// Fix exists check to handle both function and property cases
					const exists =
						typeof gameDoc.exists === "function"
							? gameDoc.exists()
							: gameDoc.exists;
					if (!exists) continue;

					const gameData = gameDoc.data();
					if (!gameData) continue;

					// Transform based on game type (comprehensive handling like loadPuzzlesFromFirestore)
					let puzzleData: any = {};
					let puzzleType: PuzzleType = game.gameType as PuzzleType;
					let isValid = false;

					// Handle QuickMath
					if (
						game.gameType === "quickMath" &&
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
					else if (game.gameType === "wordle" && gameData.qna) {
						puzzleData = {
							answer: gameData.qna.toUpperCase(),
						} as WordleData;
						isValid = true;
					}
					// Handle Riddle
					else if (
						game.gameType === "riddle" &&
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
					else if (
						game.gameType === "trivia" &&
						gameData.questions &&
						Array.isArray(gameData.questions)
					) {
						puzzleData = {
							questions: gameData.questions as any,
						} as TriviaData;
						isValid = true;
					}
					// Handle Mastermind
					else if (
						game.gameType === "mastermind" &&
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
						game.gameType === "sequencing" &&
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
						game.gameType === "wordChain" &&
						gameData.startWord &&
						gameData.endWord &&
						gameData.answer
					) {
						// Ensure answer is an array (it might be stored as string or array in Firestore)
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
						game.gameType === "alias" &&
						gameData.definitions &&
						gameData.answer &&
						gameData.choices
					) {
						puzzleData = {
							definitions: gameData.definitions,
							answer: gameData.answer,
							choices: gameData.choices,
							hint: gameData.hint,
						} as AliasData;
						isValid = true;
					}
					// Handle Zip
					else if (
						game.gameType === "zip" &&
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
						game.gameType === "futoshiki" &&
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
					// Handle Magic Square
					else if (
						game.gameType === "magicSquare" &&
						gameData.size &&
						gameData.grid &&
						gameData.magicConstant !== undefined &&
						gameData.givens
					) {
						puzzleData = {
							size: gameData.size,
							grid: gameData.grid,
							magicConstant: gameData.magicConstant,
							givens: gameData.givens,
						} as MagicSquareData;
						isValid = true;
					}
					// Handle Hidato
					else if (
						game.gameType === "hidato" &&
						gameData.rows &&
						gameData.cols &&
						gameData.startNum !== undefined &&
						gameData.endNum !== undefined &&
						gameData.path &&
						gameData.givens
					) {
						puzzleData = {
							rows: gameData.rows,
							cols: gameData.cols,
							startNum: gameData.startNum,
							endNum: gameData.endNum,
							path: gameData.path,
							givens: gameData.givens,
						} as HidatoData;
						isValid = true;
					}
					// Handle Sudoku
					else if (
						game.gameType === "sudoku" &&
						gameData.grid &&
						gameData.givens
					) {
						puzzleData = {
							grid: gameData.grid,
							givens: gameData.givens,
						} as SudokuData;
						isValid = true;
					}

					// Only add puzzle if valid
					if (!isValid) {
						continue;
					}

					puzzles.push({
						id: `${game.gameType}_${game.difficulty}_${game.gameId}`,
						type: puzzleType,
						data: puzzleData,
						difficulty:
							game.difficulty === "easy"
								? 1
								: game.difficulty === "medium"
								? 2
								: 3,
						createdAt:
							game.createdAt?.toDate?.()?.toISOString() ||
							new Date().toISOString(),
						username: gameData.username,
					});
				} catch (error) {
					console.error(`Error loading game ${game.gameId}:`, error);
				}
			}

			setFollowingPuzzles(puzzles);
		} catch (error) {
			console.error("Error loading following feed:", error);
		} finally {
			setLoadingFollowing(false);
		}
	};

	// Get the correct flatListRef based on active tab
	const flatListRef =
		activeTab === "forYou" ? forYouFlatListRef : followingFlatListRef;

	// Handle tab press - if already on the tab, scroll to top and reload
	const handleForYouTabPress = async () => {
		if (activeTab === "forYou") {
			// Already on this tab - scroll to top and reload
			if (forYouFlatListRef.current) {
				forYouFlatListRef.current.scrollToOffset({ offset: 0, animated: true });
			}
			// Reset state and reload
			setCurrentIndexForYou(0);
			setCurrentPuzzleIdForYou("");
			setLoading(true);
			await loadPuzzlesFromFirestore();
		} else {
			setActiveTab("forYou");
		}
	};

	const handleFollowingTabPress = async () => {
		if (activeTab === "following") {
			// Already on this tab - scroll to top and reload
			if (followingFlatListRef.current) {
				followingFlatListRef.current.scrollToOffset({
					offset: 0,
					animated: true,
				});
			}
			// Reset state and reload
			setCurrentIndexFollowing(0);
			setCurrentPuzzleIdFollowing("");
			await loadFollowingFeed();
		} else {
			setActiveTab("following");
		}
	};

	const loadUserData = async (isInitialLoad = false) => {
		const user = getCurrentUser();
		if (user) {
			// Run migration on first load (will skip if already migrated)
			if (isInitialLoad) {
				await migrateUserArraysToHistory(user.uid);
			}

			const data = await getUserData(user.uid);
			setUserData(data);

			// Route to username page if:
			// 1. User document doesn't exist (!data)
			// 2. User document exists but doesn't have username field (!data.username)
			if (!data || !data.username) {
				router.replace("/username");
			}
		}
	};

	const loadPuzzlesFromFirestore = async () => {
		setLoading(true);
		try {
			const allPuzzles: Puzzle[] = [];

			// Fetch QuickMath games
			const difficulties: Array<"easy" | "medium" | "hard"> = [
				"easy",
				"medium",
				"hard",
			];

			for (const difficulty of difficulties) {
				// Fetch QuickMath
				const quickMathGames = await fetchGamesFromFirestore(
					"quickMath",
					difficulty
				);
				quickMathGames.forEach((game) => {
					if (game.questions && game.answers) {
						allPuzzles.push({
							id: `quickmath_${difficulty}_${game.id}`,
							type: "quickMath",
							data: {
								problems: game.questions,
								answers: game.answers,
							} as QuickMathData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Wordle
				const wordleGames = await fetchGamesFromFirestore("wordle", difficulty);
				wordleGames.forEach((game) => {
					if (game.qna) {
						allPuzzles.push({
							id: `wordle_${difficulty}_${game.id}`,
							type: "wordle",
							data: {
								answer: game.qna.toUpperCase(),
							} as WordleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Riddle
				const riddleGames = await fetchGamesFromFirestore("riddle", difficulty);
				riddleGames.forEach((game) => {
					if (game.question && game.answer && game.choices) {
						allPuzzles.push({
							id: `riddle_${difficulty}_${game.id}`,
							type: "riddle",
							data: {
								prompt: game.question,
								answer: game.answer,
								choices: game.choices,
							} as RiddleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Trivia
				const triviaGames = await fetchGamesFromFirestore("trivia", difficulty);
				console.log(
					`[Trivia] Fetched ${triviaGames.length} trivia games for ${difficulty}`
				);
				if (triviaGames.length > 0) {
					console.log(
						"[Trivia] First game:",
						JSON.stringify(triviaGames[0], null, 2)
					);
				}
				triviaGames.forEach((game) => {
					if (game.questions && Array.isArray(game.questions)) {
						console.log(
							`[Trivia] Adding game ${game.id} with ${game.questions.length} questions`
						);
						allPuzzles.push({
							id: `trivia_${difficulty}_${game.id}`,
							type: "trivia",
							data: {
								questions: game.questions as any,
							} as TriviaData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					} else {
						console.log(
							`[Trivia] Skipping game ${game.id} - invalid questions field:`,
							game.questions
						);
					}
				});

				// Fetch Mastermind
				const mastermindGames = await fetchGamesFromFirestore(
					"mastermind",
					difficulty
				);
				mastermindGames.forEach((game) => {
					if (
						game.secretCode &&
						Array.isArray(game.secretCode) &&
						game.maxGuesses
					) {
						allPuzzles.push({
							id: `mastermind_${difficulty}_${game.id}`,
							type: "mastermind",
							data: {
								secretCode: game.secretCode,
								maxGuesses: game.maxGuesses,
							} as MastermindData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Sequencing
				const sequencingGames = await fetchGamesFromFirestore(
					"sequencing",
					difficulty
				);
				sequencingGames.forEach((game) => {
					if (
						game.theme &&
						game.numSlots &&
						game.entities &&
						Array.isArray(game.entities) &&
						game.rules &&
						Array.isArray(game.rules) &&
						game.solution &&
						Array.isArray(game.solution)
					) {
						allPuzzles.push({
							id: `sequencing_${difficulty}_${game.id}`,
							type: "sequencing",
							data: {
								theme: game.theme as "people" | "appointments" | "runners",
								numSlots: game.numSlots,
								entities: game.entities,
								rules: game.rules.map((r: any) => ({
									type: r.type,
									entity1: r.entity1,
									entity2: r.entity2,
									position: r.position,
									minDistance: r.minDistance,
									description: r.description,
								})),
								solution: game.solution,
							} as SequencingData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch WordChain
				const wordChainGames = await fetchGamesFromFirestore(
					"wordChain",
					difficulty
				);
				wordChainGames.forEach((game) => {
					if (game.startWord && game.endWord && game.answer) {
						// Ensure answer is an array (it might be stored as string or array in Firestore)
						const answerArray = Array.isArray(game.answer)
							? game.answer
							: typeof game.answer === "string"
							? [game.answer]
							: [];

						allPuzzles.push({
							id: `wordchain_${difficulty}_${game.id}`,
							type: "wordChain",
							data: {
								startWord: game.startWord,
								endWord: game.endWord,
								answer: answerArray,
								minSteps: game.minSteps || 3,
								hint: game.hint,
							} as WordChainData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Alias
				const aliasGames = await fetchGamesFromFirestore("alias", difficulty);
				aliasGames.forEach((game) => {
					if (game.definitions && game.answer && game.choices) {
						allPuzzles.push({
							id: `alias_${difficulty}_${game.id}`,
							type: "alias",
							data: {
								definitions: game.definitions,
								answer: game.answer,
								choices: game.choices,
								hint: game.hint,
							} as AliasData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Zip
				const zipGames = await fetchGamesFromFirestore("zip", difficulty);
				zipGames.forEach((game) => {
					if (game.rows && game.cols && game.cells && game.solution) {
						allPuzzles.push({
							id: `zip_${difficulty}_${game.id}`,
							type: "zip",
							data: {
								rows: game.rows,
								cols: game.cols,
								cells: game.cells,
								solution: game.solution,
							} as ZipData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Futoshiki
				const futoshikiGames = await fetchGamesFromFirestore(
					"futoshiki",
					difficulty
				);
				futoshikiGames.forEach((game) => {
					if (game.size && game.grid && game.givens && game.inequalities) {
						allPuzzles.push({
							id: `futoshiki_${difficulty}_${game.id}`,
							type: "futoshiki",
							data: {
								size: game.size,
								grid: game.grid,
								givens: game.givens,
								inequalities: game.inequalities,
							} as FutoshikiData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Magic Square
				const magicSquareGames = await fetchGamesFromFirestore(
					"magicSquare",
					difficulty
				);
				magicSquareGames.forEach((game) => {
					if (
						game.size &&
						game.grid &&
						game.magicConstant !== undefined &&
						game.givens
					) {
						allPuzzles.push({
							id: `magicSquare_${difficulty}_${game.id}`,
							type: "magicSquare",
							data: {
								size: game.size,
								grid: game.grid,
								magicConstant: game.magicConstant,
								givens: game.givens,
							} as MagicSquareData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Hidato
				const hidatoGames = await fetchGamesFromFirestore("hidato", difficulty);
				hidatoGames.forEach((game) => {
					if (
						game.rows &&
						game.cols &&
						game.startNum !== undefined &&
						game.endNum !== undefined &&
						game.path &&
						game.givens
					) {
						allPuzzles.push({
							id: `hidato_${difficulty}_${game.id}`,
							type: "hidato",
							data: {
								rows: game.rows,
								cols: game.cols,
								startNum: game.startNum,
								endNum: game.endNum,
								path: game.path,
								givens: game.givens,
							} as HidatoData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});
			}

			// Fetch Sudoku games
			for (const difficulty of ["easy", "medium", "hard"] as const) {
				const sudokuGames = await fetchGamesFromFirestore("sudoku", difficulty);
				sudokuGames.forEach((game) => {
					if (game.grid && game.givens) {
						allPuzzles.push({
							id: `sudoku_${difficulty}_${game.id}`,
							type: "sudoku",
							data: {
								grid: game.grid,
								givens: game.givens,
							} as SudokuData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});
			}

			// Store all puzzles
			setPuzzles(allPuzzles);

			// Initialize elapsed times for all puzzles to 0
			const initialElapsedTimes: Record<string, number> = {};
			allPuzzles.forEach((puzzle) => {
				initialElapsedTimes[puzzle.id] = 0;
			});
			puzzleElapsedTimesRef.current = initialElapsedTimes;

			// Generate recommendations and show immediately (no filtering yet!)
			console.log("[Feed] Generating recommendations from all games...");

			// Get simple recommendations from ALL games (no upfront filtering)
			const recommended = getSimpleRecommendations(
				allPuzzles,
				userData,
				allPuzzles.length
			);

			// LAYER 1: Deduplicate after recommendations
			const uniqueRecommended = deduplicateGames(recommended);

			// Interleave game types for visual variety
			const interleaved = interleaveGamesByType(uniqueRecommended);

			// LAYER 2: Deduplicate after interleaving (double-check)
			const uniqueInterleaved = deduplicateGames(interleaved);
			setAllRecommendedPuzzles(uniqueInterleaved);

			// Display first 15 games immediately
			const BATCH_SIZE = 15;
			const firstBatch = uniqueInterleaved.slice(0, BATCH_SIZE);
			setDisplayedPuzzles(firstBatch);

			console.log(
				`[Feed] Displaying first ${firstBatch.length} games immediately`
			);

			// Now filter displayed games in background (non-blocking)
			const user = getCurrentUser();
			if (user) {
				// Don't await - let it run in background
				filterDisplayedGamesInBackground(firstBatch);
			}
		} catch (error) {
			console.error("Error loading puzzles from Firestore:", error);
			Alert.alert(
				"Error",
				"Failed to load puzzles. Please check your connection."
			);
		} finally {
			setLoading(false);
		}
	};

	// Filter displayed games in background (lazy filtering)
	const filterDisplayedGamesInBackground = async (games: Puzzle[]) => {
		const user = getCurrentUser();
		if (!user) return;

		// Only check games we haven't checked yet
		const uncheckedGames = games.filter(
			(g) => !checkedGamesRef.current.has(g.id)
		);
		if (uncheckedGames.length === 0) return;

		const gameIds = uncheckedGames.map((g) => g.id);

		console.log(
			`[LazyFilter] Checking ${gameIds.length} games for completion status...`
		);

		// Fast check - only these specific games (not all 500!)
		const completedIds = await batchCheckGameHistory(
			user.uid,
			gameIds,
			"completed"
		);

		// Cache results so we don't check again
		gameIds.forEach((id) => {
			checkedGamesRef.current.set(id, completedIds.has(id));
		});

		// Update session tracking
		completedIds.forEach((id) => {
			initialCompletedGamesRef.current.add(id);
			completedPuzzlesRef.current.add(id);
		});

		// Remove completed games from display
		if (completedIds.size > 0) {
			console.log(`[LazyFilter] Removing ${completedIds.size} completed games`);
			setDisplayedPuzzles((prev) =>
				prev.filter((p) => !completedIds.has(p.id))
			);
		}
	};

	// Fetch more games from Firestore for infinite scroll
	const fetchMoreGamesFromFirestore = async () => {
		if (isFetchingMore || !hasMoreGamesToFetch) return;

		console.log("[Prefetch] Starting background fetch of more games...");
		setIsFetchingMore(true);

		try {
			const user = getCurrentUser();
			if (!user) {
				setIsFetchingMore(false);
				return;
			}

			// Get all game IDs currently in use (displayed + recommended pool)
			const existingGameIds = new Set([
				...puzzles.map((p) => p.id),
				...allRecommendedPuzzles.map((p) => p.id),
			]);

			console.log(
				`[Prefetch] Currently have ${existingGameIds.size} unique games in pool`
			);

			// Fetch ONLY completed games from gameHistory
			// (We want to allow previously skipped games to appear again)
			const { fetchGameHistory } = require("../config/firebase");
			const completedHistory = await fetchGameHistory(user.uid, {
				action: "completed",
			});

			// Create set of completed games (permanently exclude these)
			const completedGameIds = new Set(
				completedHistory.map((h: any) => h.gameId)
			);

			console.log(
				`[Prefetch] User has completed ${completedGameIds.size} games (will exclude these)`
			);

			const newGames: Puzzle[] = [];
			const difficulties: Array<"easy" | "medium" | "hard"> = [
				"easy",
				"medium",
				"hard",
			];

			// Fetch more games (same logic as initial load)
			for (const difficulty of difficulties) {
				// Fetch QuickMath
				const quickMathGames = await fetchGamesFromFirestore(
					"quickMath",
					difficulty
				);
				quickMathGames.forEach((game) => {
					if (game.questions && game.answers) {
						newGames.push({
							id: `quickmath_${difficulty}_${game.id}`,
							type: "quickMath",
							data: {
								problems: game.questions,
								answers: game.answers,
							} as QuickMathData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Wordle
				const wordleGames = await fetchGamesFromFirestore("wordle", difficulty);
				wordleGames.forEach((game) => {
					if (game.qna) {
						newGames.push({
							id: `wordle_${difficulty}_${game.id}`,
							type: "wordle",
							data: {
								answer: game.qna.toUpperCase(),
							} as WordleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Riddle
				const riddleGames = await fetchGamesFromFirestore("riddle", difficulty);
				riddleGames.forEach((game) => {
					if (game.question && game.answer && game.choices) {
						newGames.push({
							id: `riddle_${difficulty}_${game.id}`,
							type: "riddle",
							data: {
								prompt: game.question,
								answer: game.answer,
								choices: game.choices,
							} as RiddleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Trivia
				const triviaGames = await fetchGamesFromFirestore("trivia", difficulty);
				console.log(
					`[Trivia Prefetch] Fetched ${triviaGames.length} trivia games for ${difficulty}`
				);
				if (triviaGames.length > 0) {
					console.log(
						"[Trivia Prefetch] First game:",
						JSON.stringify(triviaGames[0], null, 2)
					);
				}
				triviaGames.forEach((game) => {
					if (game.questions && Array.isArray(game.questions)) {
						console.log(
							`[Trivia Prefetch] Adding game ${game.id} with ${game.questions.length} questions`
						);
						newGames.push({
							id: `trivia_${difficulty}_${game.id}`,
							type: "trivia",
							data: {
								questions: game.questions as any,
							} as TriviaData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					} else {
						console.log(
							`[Trivia Prefetch] Skipping game ${game.id} - invalid questions field:`,
							game.questions
						);
					}
				});

				// Fetch Mastermind
				const mastermindGamesPrefetch = await fetchGamesFromFirestore(
					"mastermind",
					difficulty
				);
				mastermindGamesPrefetch.forEach((game) => {
					if (
						game.secretCode &&
						Array.isArray(game.secretCode) &&
						game.maxGuesses
					) {
						newGames.push({
							id: `mastermind_${difficulty}_${game.id}`,
							type: "mastermind",
							data: {
								secretCode: game.secretCode,
								maxGuesses: game.maxGuesses,
							} as MastermindData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Sequencing
				const sequencingGamesPrefetch = await fetchGamesFromFirestore(
					"sequencing",
					difficulty
				);
				sequencingGamesPrefetch.forEach((game) => {
					if (
						game.theme &&
						game.numSlots &&
						game.entities &&
						Array.isArray(game.entities) &&
						game.rules &&
						Array.isArray(game.rules) &&
						game.solution &&
						Array.isArray(game.solution)
					) {
						newGames.push({
							id: `sequencing_${difficulty}_${game.id}`,
							type: "sequencing",
							data: {
								theme: game.theme as "people" | "appointments" | "runners",
								numSlots: game.numSlots,
								entities: game.entities,
								rules: game.rules.map((r: any) => ({
									type: r.type,
									entity1: r.entity1,
									entity2: r.entity2,
									position: r.position,
									minDistance: r.minDistance,
									description: r.description,
								})),
								solution: game.solution,
							} as SequencingData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch WordChain
				const wordChainGames = await fetchGamesFromFirestore(
					"wordChain",
					difficulty
				);
				wordChainGames.forEach((game) => {
					if (game.startWord && game.endWord && game.answer) {
						// Ensure answer is an array (it might be stored as string or array in Firestore)
						const answerArray = Array.isArray(game.answer)
							? game.answer
							: typeof game.answer === "string"
							? [game.answer]
							: [];

						newGames.push({
							id: `wordchain_${difficulty}_${game.id}`,
							type: "wordChain",
							data: {
								startWord: game.startWord,
								endWord: game.endWord,
								answer: answerArray,
								minSteps: game.minSteps || 3,
								hint: game.hint,
							} as WordChainData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Alias
				const aliasGames = await fetchGamesFromFirestore("alias", difficulty);
				aliasGames.forEach((game) => {
					if (game.definitions && game.answer) {
						newGames.push({
							id: `alias_${difficulty}_${game.id}`,
							type: "alias",
							data: {
								definitions: game.definitions,
								answer: game.answer,
								hint: game.hint,
							} as AliasData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Zip
				const zipGames = await fetchGamesFromFirestore("zip", difficulty);
				zipGames.forEach((game) => {
					if (game.rows && game.cols && game.cells && game.solution) {
						newGames.push({
							id: `zip_${difficulty}_${game.id}`,
							type: "zip",
							data: {
								rows: game.rows,
								cols: game.cols,
								cells: game.cells,
								solution: game.solution,
							} as ZipData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Futoshiki
				const futoshikiGames = await fetchGamesFromFirestore(
					"futoshiki",
					difficulty
				);
				futoshikiGames.forEach((game) => {
					if (game.size && game.grid && game.givens && game.inequalities) {
						newGames.push({
							id: `futoshiki_${difficulty}_${game.id}`,
							type: "futoshiki",
							data: {
								size: game.size,
								grid: game.grid,
								givens: game.givens,
								inequalities: game.inequalities,
							} as FutoshikiData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Magic Square
				const magicSquareGames = await fetchGamesFromFirestore(
					"magicSquare",
					difficulty
				);
				magicSquareGames.forEach((game) => {
					if (
						game.size &&
						game.grid &&
						game.magicConstant !== undefined &&
						game.givens
					) {
						newGames.push({
							id: `magicSquare_${difficulty}_${game.id}`,
							type: "magicSquare",
							data: {
								size: game.size,
								grid: game.grid,
								magicConstant: game.magicConstant,
								givens: game.givens,
							} as MagicSquareData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Hidato
				const hidatoGames = await fetchGamesFromFirestore("hidato", difficulty);
				hidatoGames.forEach((game) => {
					if (
						game.rows &&
						game.cols &&
						game.startNum !== undefined &&
						game.endNum !== undefined &&
						game.path &&
						game.givens
					) {
						newGames.push({
							id: `hidato_${difficulty}_${game.id}`,
							type: "hidato",
							data: {
								rows: game.rows,
								cols: game.cols,
								startNum: game.startNum,
								endNum: game.endNum,
								path: game.path,
								givens: game.givens,
							} as HidatoData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});
			}

			// Fetch Sudoku games
			for (const difficulty of ["easy", "medium", "hard"] as const) {
				const sudokuGames = await fetchGamesFromFirestore("sudoku", difficulty);
				sudokuGames.forEach((game) => {
					if (game.grid && game.givens) {
						newGames.push({
							id: `sudoku_${difficulty}_${game.id}`,
							type: "sudoku",
							data: {
								grid: game.grid,
								givens: game.givens,
							} as SudokuData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});
			}

			if (newGames.length === 0) {
				console.log("[Prefetch] No more games available in Firestore");
				setHasMoreGamesToFetch(false);
				return;
			}

			console.log(
				`[Prefetch] Fetched ${newGames.length} raw games from Firestore`
			);

			// Filter out games that:
			// 1. We already have in our current pool (avoid immediate duplicates)
			// 2. User has already completed (permanently done)
			// NOTE: We DO allow previously skipped games (user might want to try again)
			const freshGames = newGames.filter(
				(game) =>
					!existingGameIds.has(game.id) && !completedGameIds.has(game.id)
			);

			if (freshGames.length === 0) {
				console.log(
					"[Prefetch] No new games found - user may have completed everything!"
				);
				setHasMoreGamesToFetch(false);
				return;
			}

			console.log(
				`[Prefetch] ${freshGames.length} fresh games after filtering (not in current pool, not completed)`
			);

			// Add fresh games to puzzles pool
			setPuzzles((prev) => [...prev, ...freshGames]);

			// Generate recommendations for fresh games
			const recommended = getSimpleRecommendations(
				freshGames,
				userData,
				freshGames.length
			);
			const interleaved = interleaveGamesByType(recommended);

			// LAYER 3: Deduplicate before appending to ensure no overlap
			setAllRecommendedPuzzles((prev) => {
				// Get existing IDs
				const existingIds = new Set(prev.map((p) => p.id));

				// Filter out any games that somehow already exist
				const newUnique = interleaved.filter((g) => !existingIds.has(g.id));

				if (newUnique.length < interleaved.length) {
					console.log(
						`[Dedupe] Filtered ${
							interleaved.length - newUnique.length
						} duplicates during prefetch append`
					);
				}

				return [...prev, ...newUnique];
			});

			console.log(`[Prefetch] Added fresh recommended games to pool`);
		} catch (error) {
			console.error("[Prefetch] Error fetching more games:", error);
		} finally {
			setIsFetchingMore(false);
		}
	};

	// Load next batch for infinite scroll (only for "For You" tab)
	const loadNextBatch = useCallback(async () => {
		// Don't load more games if we're on the Following tab
		if (activeTab === "following") {
			return;
		}

		if (
			loadingMore ||
			displayedPuzzles.length >= allRecommendedPuzzles.length
		) {
			return; // Already loading or no more games
		}

		// PREFETCH: At 90%, fetch more games in background
		const percentageViewed =
			displayedPuzzles.length / allRecommendedPuzzles.length;
		if (percentageViewed >= 0.9 && !isFetchingMore && hasMoreGamesToFetch) {
			console.log("[Prefetch] At 90%, fetching more games in background...");
			fetchMoreGamesFromFirestore(); // Don't await - background operation
		}

		setLoadingMore(true);
		const BATCH_SIZE = 15;
		const currentLength = displayedPuzzles.length;
		const nextBatch = allRecommendedPuzzles.slice(
			currentLength,
			currentLength + BATCH_SIZE
		);

		if (nextBatch.length > 0) {
			console.log(`[Feed] Loading next ${nextBatch.length} games`);

			// Check completion for this batch only
			await filterDisplayedGamesInBackground(nextBatch);

			// Add non-completed games
			const filtered = nextBatch.filter(
				(g) => !initialCompletedGamesRef.current.has(g.id)
			);

			if (filtered.length > 0) {
				// LAYER 4: Deduplicate before adding to displayed list
				const displayedIds = new Set(displayedPuzzles.map((p) => p.id));
				const uniqueBatch = filtered.filter((g) => !displayedIds.has(g.id));

				if (uniqueBatch.length < filtered.length) {
					console.log(
						`[Dedupe] Filtered ${
							filtered.length - uniqueBatch.length
						} duplicates from batch`
					);
				}

				if (uniqueBatch.length > 0) {
					setDisplayedPuzzles([...displayedPuzzles, ...uniqueBatch]);
				}
			}
		}

		setLoadingMore(false);
	}, [
		activeTab,
		displayedPuzzles,
		allRecommendedPuzzles,
		loadingMore,
		isFetchingMore,
		hasMoreGamesToFetch,
	]);

	// Handle viewable items changed (TikTok-like scrolling)
	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: any[] }) => {
			if (viewableItems.length > 0) {
				const newIndex = viewableItems[0].index ?? 0;
				const newPuzzleId = viewableItems[0].item?.id;

				// Get current state for the active tab
				const currentTabPuzzleId =
					activeTab === "forYou"
						? currentPuzzleIdForYou
						: currentPuzzleIdFollowing;

				if (newPuzzleId && newPuzzleId !== currentTabPuzzleId) {
					// Handle skip tracking for the previous puzzle
					if (currentTabPuzzleId) {
						// Save elapsed time for current puzzle before switching away
						if (puzzleVisibleTimesRef.current[currentTabPuzzleId]) {
							const timeVisible =
								Date.now() - puzzleVisibleTimesRef.current[currentTabPuzzleId];
							const additionalElapsed = Math.floor(timeVisible / 1000);
							// Add to existing elapsed time
							puzzleElapsedTimesRef.current[currentTabPuzzleId] =
								(puzzleElapsedTimesRef.current[currentTabPuzzleId] || 0) +
								additionalElapsed;
						}

						// Check if the puzzle was completed, attempted, or already skipped
						const wasCompleted =
							completedPuzzlesRef.current.has(currentTabPuzzleId);
						const wasAttempted =
							attemptedPuzzlesRef.current.has(currentTabPuzzleId);
						const wasAlreadySkipped =
							skippedPuzzlesRef.current.has(currentTabPuzzleId);

						console.log(
							`[SKIP CHECK] Puzzle: ${currentTabPuzzleId}, wasCompleted: ${wasCompleted}, wasAttempted: ${wasAttempted}, wasAlreadySkipped: ${wasAlreadySkipped}`
						);

						const user = getCurrentUser();

						if (!wasCompleted && wasAttempted && !wasAlreadySkipped) {
							// User attempted but didn't complete - mark as attempted
							console.log(
								`[ATTEMPTED] User attempted but didn't complete: ${currentTabPuzzleId}`
							);
							skippedPuzzlesRef.current.add(currentTabPuzzleId); // Still mark as "left" so we don't track again

							// Call addAttemptedGame to update user stats
							if (user) {
								console.log(
									`[ATTEMPTED] Calling addAttemptedGame for user ${user.uid}`
								);
								addAttemptedGame(user.uid, currentTabPuzzleId)
									.then(() => {
										console.log(
											`[ATTEMPTED] Successfully tracked attempted game: ${currentTabPuzzleId}`
										);
									})
									.catch((error) => {
										console.error(
											"[ATTEMPTED] Error adding attempted game:",
											error
										);
									});
							} else {
								console.log("[ATTEMPTED] No user found, cannot track");
							}

							// Track attempted at global game level
							trackGameAttempted(currentTabPuzzleId).catch((error) => {
								console.error(
									"[ATTEMPTED] Error tracking game attempted globally:",
									error
								);
							});
						} else if (!wasCompleted && !wasAttempted && !wasAlreadySkipped) {
							// User never interacted - mark as skipped
							skippedPuzzlesRef.current.add(currentTabPuzzleId);

							// Call addSkippedGame to update user stats
							if (user) {
								addSkippedGame(user.uid, currentTabPuzzleId).catch((error) => {
									console.error("Error adding skipped game:", error);
								});
							}

							// Track skipped at global game level
							trackGameSkipped(currentTabPuzzleId).catch((error) => {
								console.error(
									"[SKIPPED] Error tracking game skipped globally:",
									error
								);
							});
						}
					}

					// Update current puzzle for the active tab
					if (activeTab === "forYou") {
						setCurrentPuzzleIdForYou(newPuzzleId);
						setCurrentIndexForYou(newIndex);
						previousActivePuzzleIdRef.current.forYou = newPuzzleId;
					} else {
						setCurrentPuzzleIdFollowing(newPuzzleId);
						setCurrentIndexFollowing(newIndex);
						previousActivePuzzleIdRef.current.following = newPuzzleId;
					}

					// Calculate startTime for new puzzle based on its elapsed time
					const elapsedTime = puzzleElapsedTimesRef.current[newPuzzleId] || 0;
					const startTime = Date.now() - elapsedTime * 1000;
					puzzleStartTimesRef.current[newPuzzleId] = startTime;

					// Mark when this puzzle became visible (for calculating elapsed time)
					puzzleVisibleTimesRef.current[newPuzzleId] = Date.now();
				}
			}
		},
		[activeTab, currentPuzzleIdForYou, currentPuzzleIdFollowing]
	);

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50,
	}).current;

	// Initialize first puzzle timer
	useEffect(() => {
		if (displayedPuzzles.length > 0 && !currentPuzzleId) {
			const firstPuzzleId = displayedPuzzles[0].id;
			setCurrentPuzzleId(firstPuzzleId);
			setCurrentIndex(0);
			// Calculate startTime for first puzzle (elapsed time is 0, so startTime is now)
			const elapsedTime = puzzleElapsedTimesRef.current[firstPuzzleId] || 0;
			const startTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[firstPuzzleId] = startTime;
			// Mark when first puzzle became visible
			puzzleVisibleTimesRef.current[firstPuzzleId] = Date.now();
		}
	}, [displayedPuzzles, currentPuzzleId]);

	// Handle elapsed time updates from games
	const handleElapsedTimeUpdate = useCallback(
		(puzzleId: string, elapsedTime: number) => {
			// Save elapsed time to hashmap when game becomes inactive
			puzzleElapsedTimesRef.current[puzzleId] = elapsedTime;
			// Don't recalculate startTime here - it will be recalculated when game becomes active
		},
		[]
	);

	// Handle when user first interacts with a game
	const handleGameAttempt = (puzzleId: string) => {
		// Mark puzzle as attempted in this session
		if (!attemptedPuzzlesRef.current.has(puzzleId)) {
			console.log(`[SESSION] Marking puzzle as attempted: ${puzzleId}`);
			attemptedPuzzlesRef.current.add(puzzleId);

			// If this game was previously marked as skipped in this session, remove it
			if (skippedPuzzlesRef.current.has(puzzleId)) {
				console.log(
					`[SESSION] Removing ${puzzleId} from skipped session tracking`
				);
				skippedPuzzlesRef.current.delete(puzzleId);
			}

			// Check if this game was previously skipped and move it to attempted
			const user = getCurrentUser();
			if (user) {
				// Update user stats (decrement user's skipped)
				moveFromSkippedToAttempted(user.uid, puzzleId)
					.then((wasSkipped) => {
						// If it was previously skipped, also decrement global game stats
						if (wasSkipped) {
							decrementGameSkipped(puzzleId).catch((error) => {
								console.error(
									"[SESSION] Error decrementing game skipped:",
									error
								);
							});
						}
					})
					.catch((error) => {
						console.error(
							"[SESSION] Error moving from skipped to attempted:",
							error
						);
					});
			}
		}
	};

	const handleGameComplete = async (result: GameResult) => {
		addCompletedPuzzle(result);

		// Mark puzzle as completed in this session
		if (result.puzzleId) {
			completedPuzzlesRef.current.add(result.puzzleId);
			// Remove from skipped set if it was previously skipped (shouldn't happen, but just in case)
			skippedPuzzlesRef.current.delete(result.puzzleId);

			// Track completed at global game level (skip if answer was revealed)
			if (!result.answerRevealed) {
				trackGameCompleted(result.puzzleId).catch((error) => {
					console.error(
						"[COMPLETED] Error tracking game completed globally:",
						error
					);
				});
			} else {
				console.log(
					"[COMPLETED] Answer was revealed - skipping global completion tracking"
				);
			}
		}

		// Update user data but don't filter out completed games during session
		await loadUserData();

		// Don't show alert or auto-navigate - let user stay on completed game
		// and manually swipe to next game
	};

	// Calculate item height: use feed container height if available, otherwise calculate from screen
	// This ensures we use the actual available space rather than estimates
	const itemHeight = useMemo(() => {
		if (feedHeight > 0) {
			// Use the actual measured feed height - this is the most accurate
			return feedHeight;
		}
		// Fallback: calculate from screen height if feed hasn't been measured yet
		const estimatedHeaderHeight = headerHeight > 0 ? headerHeight : 100;
		return Math.max(
			0,
			SCREEN_HEIGHT - estimatedHeaderHeight - BOTTOM_NAV_HEIGHT
		);
	}, [feedHeight, headerHeight]);

	const renderPuzzleCard = ({
		item,
		index,
	}: {
		item: Puzzle;
		index: number;
	}) => {
		// Check if this puzzle is currently active/visible for the current tab
		const currentTabPuzzleId =
			activeTab === "forYou" ? currentPuzzleIdForYou : currentPuzzleIdFollowing;
		const isActive = currentTabPuzzleId === item.id;

		// Calculate startTime based on saved elapsed time
		// Only recalculate when transitioning from inactive to active
		let puzzleStartTime = puzzleStartTimesRef.current[item.id];
		const previousActiveId =
			activeTab === "forYou"
				? previousActivePuzzleIdRef.current.forYou
				: previousActivePuzzleIdRef.current.following;
		const wasActive = previousActiveId === item.id;

		if (isActive && !wasActive) {
			// Game just became active - recalculate startTime based on saved elapsed time
			const elapsedTime = puzzleElapsedTimesRef.current[item.id] || 0;
			puzzleStartTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[item.id] = puzzleStartTime;
		} else if (!puzzleStartTime) {
			// If not set yet, calculate based on elapsed time
			const elapsedTime = puzzleElapsedTimesRef.current[item.id] || 0;
			puzzleStartTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[item.id] = puzzleStartTime;
		}

		// Update previous active puzzle ref for the current tab
		if (isActive) {
			if (activeTab === "forYou") {
				previousActivePuzzleIdRef.current.forYou = item.id;
			} else {
				previousActivePuzzleIdRef.current.following = item.id;
			}
		}

		return (
			<View style={[styles.puzzleCard, { height: itemHeight }]}>
				<GameWrapper
					key={item.id}
					puzzle={item}
					onComplete={handleGameComplete}
					onAttempt={handleGameAttempt}
					startTime={puzzleStartTime}
					isActive={isActive}
					onElapsedTimeUpdate={handleElapsedTimeUpdate}
				/>
			</View>
		);
	};

	const renderHeader = () => {
		return (
			<>
				<View
					style={[styles.header, { paddingTop: insets.top }]}
					onLayout={(e) => {
						const height = e.nativeEvent.layout.height;
						if (height > 0 && height !== headerHeight) {
							setHeaderHeight(height);
						}
					}}
				></View>

				{/* Tabs */}
				<View style={styles.tabContainer}>
					<TouchableOpacity
						style={[styles.tab, activeTab === "forYou" && styles.activeTab]}
						onPress={handleForYouTabPress}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "forYou" && styles.activeTabText,
							]}
						>
							For You
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === "following" && styles.activeTab]}
						onPress={handleFollowingTabPress}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "following" && styles.activeTabText,
							]}
						>
							Following
						</Text>
					</TouchableOpacity>
				</View>
			</>
		);
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			{renderHeader()}

			{/* Loading state */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
					<Text style={styles.loadingText}>Loading puzzles...</Text>
				</View>
			) : (
				<View style={styles.feedContainer}>
					{/* For You Feed - always mounted, visibility controlled by zIndex/opacity */}
					<View
						style={[
							styles.feedAbsolute,
							{
								zIndex: activeTab === "forYou" ? 1 : 0,
								opacity: activeTab === "forYou" ? 1 : 0,
							},
						]}
						pointerEvents={activeTab === "forYou" ? "auto" : "none"}
						onLayout={(e) => {
							const height = e.nativeEvent.layout.height;
							if (height > 0 && height !== feedHeight) {
								setFeedHeight(height);
							}
						}}
					>
						{displayedPuzzles.length > 0 ? (
							<FlatList
								ref={forYouFlatListRef}
								data={displayedPuzzles}
								renderItem={renderPuzzleCard}
								keyExtractor={(item) => item.id}
								getItemLayout={
									itemHeight > 0
										? (data, index) => ({
												length: itemHeight,
												offset: itemHeight * index,
												index,
										  })
										: undefined
								}
								pagingEnabled
								windowSize={5}
								initialNumToRender={3}
								maxToRenderPerBatch={3}
								showsVerticalScrollIndicator={false}
								onViewableItemsChanged={onViewableItemsChanged}
								viewabilityConfig={viewabilityConfig}
								scrollEventThrottle={16}
								style={{ flex: 1 }}
								keyboardDismissMode="on-drag"
								keyboardShouldPersistTaps="handled"
								scrollEnabled={!isKeyboardVisible && activeTab === "forYou"}
								onEndReached={loadNextBatch}
								onEndReachedThreshold={0.5}
								removeClippedSubviews={false}
								onScrollToIndexFailed={(info) => {
									const wait = new Promise((resolve) =>
										setTimeout(resolve, 500)
									);
									wait.then(() => {
										if (
											forYouFlatListRef.current &&
											info.index < displayedPuzzles.length
										) {
											forYouFlatListRef.current.scrollToIndex({
												index: info.index,
												animated: false,
											});
										}
									});
								}}
								ListFooterComponent={
									loadingMore ? (
										<View style={styles.loadingFooter}>
											<ActivityIndicator size="small" color={Colors.accent} />
										</View>
									) : null
								}
							/>
						) : (
							<View style={styles.loadingContainer}>
								<Text style={styles.emptyText}>No puzzles available</Text>
							</View>
						)}
					</View>

					{/* Following Feed - always mounted, visibility controlled by zIndex/opacity */}
					<View
						style={[
							styles.feedAbsolute,
							{
								zIndex: activeTab === "following" ? 1 : 0,
								opacity: activeTab === "following" ? 1 : 0,
							},
						]}
						pointerEvents={activeTab === "following" ? "auto" : "none"}
					>
						{followingPuzzles.length > 0 ? (
							<FlatList
								ref={followingFlatListRef}
								data={followingPuzzles}
								renderItem={renderPuzzleCard}
								keyExtractor={(item) => item.id}
								getItemLayout={
									itemHeight > 0
										? (data, index) => ({
												length: itemHeight,
												offset: itemHeight * index,
												index,
										  })
										: undefined
								}
								pagingEnabled
								windowSize={5}
								initialNumToRender={3}
								maxToRenderPerBatch={3}
								showsVerticalScrollIndicator={false}
								onViewableItemsChanged={onViewableItemsChanged}
								viewabilityConfig={viewabilityConfig}
								scrollEventThrottle={16}
								style={{ flex: 1 }}
								keyboardDismissMode="on-drag"
								keyboardShouldPersistTaps="handled"
								scrollEnabled={!isKeyboardVisible && activeTab === "following"}
								removeClippedSubviews={false}
								onScrollToIndexFailed={(info) => {
									const wait = new Promise((resolve) =>
										setTimeout(resolve, 500)
									);
									wait.then(() => {
										if (
											followingFlatListRef.current &&
											info.index < followingPuzzles.length
										) {
											followingFlatListRef.current.scrollToIndex({
												index: info.index,
												animated: false,
											});
										}
									});
								}}
								ListFooterComponent={
									<View style={styles.emptyContainer}>
										<Text style={styles.emptyText}>
											Your Followers haven't made anything new
										</Text>
									</View>
								}
							/>
						) : loadingFollowing ? (
							<View style={styles.loadingContainer}>
								<ActivityIndicator size="large" color={Colors.accent} />
								<Text style={styles.loadingText}>Loading...</Text>
							</View>
						) : (
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyText}>
									Your Followers haven't made anything new
								</Text>
							</View>
						)}
					</View>

					{/* Bottom Gradient Overlay - Light theme with subtle fade */}
					<LinearGradient
						colors={["transparent", "rgba(255,255,255,0.8)"]}
						style={styles.bottomGradient}
						pointerEvents="none"
					/>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	header: {
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		zIndex: 10,
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.sm,
		...Shadows.light,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	tabContainer: {
		flexDirection: "row",
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	tab: {
		flex: 1,
		paddingVertical: Spacing.xs,
		alignItems: "center",
		borderBottomWidth: 2,
		borderBottomColor: "transparent",
	},
	activeTab: {
		borderBottomColor: Colors.accent,
	},
	tabText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	activeTabText: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	feedContainer: {
		flex: 1,
		position: "relative",
	},
	feed: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	feedAbsolute: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: Colors.background.primary,
	},
	puzzleCard: {
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.primary,
		overflow: "hidden",
		position: "relative",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
	},
	loadingText: {
		marginTop: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
	},
	emptyContainer: {
		padding: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 200,
	},
	loadingFooter: {
		padding: Spacing.lg,
		alignItems: "center",
		justifyContent: "center",
	},
	bottomGradient: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 100,
		zIndex: 50,
	},
});

// Export the component for use in MainAppContainer
export { FeedScreen };
// Default export returns null - MainAppContainer handles rendering
export default function FeedRoute() {
	return null;
}
