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
	AppState,
	InteractionManager,
	Modal,
	TouchableWithoutFeedback,
	Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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
	Gradients,
	Animation,
} from "../constants/DesignSystem";
import {
	Puzzle,
	PuzzleType,
	GameResult,
	QuickMathData,
	WordFormData,
	RiddleData,
	WordChainData,
	InferenceData,
	MazeData,
	FutoshikiData,
	MagicSquareData,
	TrailFinderData,
	SudokuData,
	TriviaData,
	CodeBreakerData,
	SequencingData,
} from "../config/types";
import GameWrapper from "../components/games/GameWrapper";
import WelcomeCard from "../components/WelcomeCard";
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
	fetchGamesByIds,
	getAllCompletedGameIds,
	getAllGameHistoryIds,
} from "../config/firebase";
import auth from "@react-native-firebase/auth";
import { useSessionEndRefresh } from "../utils/sessionRefresh";

const COMPUTE_NEXT_RECOMMENDATIONS_URL =
	"https://us-central1-gear-ff009.cloudfunctions.net/compute_next_recommendations";
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
	requestNotificationPermission,
	getFCMToken,
	registerFCMToken,
	removeFCMToken,
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
	}

	return Array.from(seen.values());
}

// Helper function to convert FirestoreGame to Puzzle
function convertFirestoreGameToPuzzle(
	game: FirestoreGame,
	gameId: string
): Puzzle | null {
	const parts = gameId.split("_");
	if (parts.length < 3) return null;

	const gameType = parts[0].toLowerCase();
	const difficulty = parts[1];
	const difficultyNum =
		difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;

	// Convert based on game type
	switch (gameType) {
		case "quickmath":
			if (game.questions && game.answers) {
				return {
					id: gameId,
					type: "quickMath",
					data: {
						problems: game.questions,
						answers: game.answers,
					} as QuickMathData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "wordform":
			if (game.qna) {
				return {
					id: gameId,
					type: "wordform",
					data: {
						answer: game.qna.toUpperCase(),
					} as WordFormData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "riddle":
			if (game.question && game.answer && game.choices) {
				return {
					id: gameId,
					type: "riddle",
					data: {
						prompt: game.question,
						answer: game.answer,
						choices: game.choices,
					} as RiddleData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "trivia":
			if (game.questions && Array.isArray(game.questions)) {
				return {
					id: gameId,
					type: "trivia",
					data: {
						questions: game.questions as any,
					} as TriviaData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "codebreaker":
			if (
				game.secretCode &&
				Array.isArray(game.secretCode) &&
				game.maxGuesses
			) {
				return {
					id: gameId,
					type: "codebreaker",
					data: {
						secretCode: game.secretCode,
						maxGuesses: game.maxGuesses,
					} as CodeBreakerData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "sequencing":
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
				return {
					id: gameId,
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
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "wordchain":
			if (game.startWord && game.endWord && game.answer) {
				const answerArray = Array.isArray(game.answer)
					? game.answer
					: typeof game.answer === "string"
					? [game.answer]
					: [];
				return {
					id: gameId,
					type: "wordChain",
					data: {
						startWord: game.startWord,
						endWord: game.endWord,
						answer: answerArray,
						minSteps: game.minSteps || 3,
						hint: game.hint,
					} as WordChainData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "inference":
			if (game.definitions && game.answer && game.choices) {
				return {
					id: gameId,
					type: "inference",
					data: {
						definitions: game.definitions,
						answer: game.answer,
						choices: game.choices,
						hint: game.hint,
					} as InferenceData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "maze":
			if (game.rows && game.cols && game.cells && game.solution) {
				return {
					id: gameId,
					type: "maze",
					data: {
						rows: game.rows,
						cols: game.cols,
						cells: game.cells,
						solution: game.solution,
					} as MazeData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "futoshiki":
			if (game.size && game.grid && game.givens && game.inequalities) {
				return {
					id: gameId,
					type: "futoshiki",
					data: {
						size: game.size,
						grid: game.grid,
						givens: game.givens,
						inequalities: game.inequalities,
					} as FutoshikiData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "magicsquare":
			if (
				game.size &&
				game.grid &&
				game.magicConstant !== undefined &&
				game.givens
			) {
				return {
					id: gameId,
					type: "magicSquare",
					data: {
						size: game.size,
						grid: game.grid,
						magicConstant: game.magicConstant,
						givens: game.givens,
					} as MagicSquareData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "trailfinder":
			if (
				game.rows &&
				game.cols &&
				game.startNum !== undefined &&
				game.endNum !== undefined &&
				game.path &&
				game.givens
			) {
				return {
					id: gameId,
					type: "trailfinder",
					data: {
						rows: game.rows,
						cols: game.cols,
						startNum: game.startNum,
						endNum: game.endNum,
						path: game.path,
						givens: game.givens,
					} as TrailFinderData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
		case "sudoku":
			if (game.grid && game.givens) {
				return {
					id: gameId,
					type: "sudoku",
					data: {
						grid: game.grid,
						givens: game.givens,
					} as SudokuData,
					difficulty: difficultyNum,
					createdAt: new Date().toISOString(),
					username: game.username,
					uid: game.uid,
					profilePicture: null,
				};
			}
			break;
	}
	return null;
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
	// Track if we're currently refreshing recommendations
	const isRefreshingRef = useRef(false);
	// Track current game index for progressive loading
	const currentGameIndexRef = useRef(0);
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
	// Filter modal visibility (UI only for now)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [isFilterPillVisible, setIsFilterPillVisible] = useState(true);
	// Current visible index for For You (0 = welcome card, 1+ = puzzle) — for fixed share pill
	const [currentVisibleIndexForYou, setCurrentVisibleIndexForYou] = useState(0);
	const currentVisibleIndexForYouRef = useRef(0);
	const [isShareMenuVisible, setIsShareMenuVisible] = useState(false);
	const shareHandlersRef = useRef<{
		puzzleId: string;
		handlers: { shareExternal: () => void; shareInternal: () => void; openShareMenu: () => void };
	} | null>(null);
	// Active filter selections
	const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
	const [selectedGameTypes, setSelectedGameTypes] = useState<PuzzleType[]>([]);

	// Applied (committed) filters — only updated when user presses Apply
	const appliedDifficultiesRef = useRef<number[]>([]);
	const appliedGameTypesRef = useRef<PuzzleType[]>([]);

	type ForYouStreamCache = {
		all: Puzzle[];
		displayed: Puzzle[];
		hasMore: boolean;
		prefetched: Puzzle[];
	};

	const forYouStreamCacheRef = useRef<Record<string, ForYouStreamCache>>({});
	const activeFilterKeyRef = useRef<string>("all");

	const makeFilterKey = (d: number[], t: PuzzleType[]) =>
		JSON.stringify({
			d: [...d].sort((a, b) => a - b),
			t: [...t].sort(),
		});

	const getAppliedFilterPayload = () => ({
		difficulties: appliedDifficultiesRef.current.length
			? appliedDifficultiesRef.current
			: undefined,
		// IMPORTANT: backend expects these exact strings (camelCase for quickMath/wordChain/magicSquare)
		gameTypes: appliedGameTypesRef.current.length
			? appliedGameTypesRef.current
			: undefined,
	});

	const [followingPuzzles, setFollowingPuzzles] = useState<Puzzle[]>([]);
	const [loadingFollowing, setLoadingFollowing] = useState(false);
	// Separate refs for each FlatList
	const forYouFlatListRef = useRef<FlatList<Puzzle>>(null);
	const followingFlatListRef = useRef<FlatList<Puzzle>>(null);
	// FCM notification prompt state
	const [showNotifPrompt, setShowNotifPrompt] = useState(false);
	const hasCheckedFCMRef = useRef(false);
	// Prefetched recommendations buffer for instant "For You" refresh
	// Store full Puzzle objects (not just IDs) to avoid Firestore calls on refresh
	const prefetchedPuzzlesRef = useRef<Puzzle[]>([]);
	const isFetchingPrefetchRef = useRef(false);

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

	// Animation refs for tab transitions
	const tabIndicatorAnim = useRef(
		new Animated.Value(activeTab === "forYou" ? 0 : 1)
	).current;
	const tabOpacityAnim = useRef(new Animated.Value(1)).current;

	// Update tab indicator animation when tab changes
	useEffect(() => {
		Animated.parallel([
			Animated.spring(tabIndicatorAnim, {
				toValue: activeTab === "forYou" ? 0 : 1,
				useNativeDriver: true,
				tension: 100,
				friction: 8,
			}),
			Animated.sequence([
				Animated.timing(tabOpacityAnim, {
					toValue: 0.5,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(tabOpacityAnim, {
					toValue: 1,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
			]),
		]).start();
	}, [activeTab]);

	// Keep For You stream cached per applied filter key so switching filters preserves games
	useEffect(() => {
		if (activeTab !== "forYou") return;

		forYouStreamCacheRef.current[activeFilterKeyRef.current] = {
			all: allRecommendedPuzzles,
			displayed: displayedPuzzles,
			hasMore: hasMoreGamesToFetch,
			prefetched: prefetchedPuzzlesRef.current,
		};
	}, [activeTab, allRecommendedPuzzles, displayedPuzzles, hasMoreGamesToFetch]);

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

	// FCM notification prompt effect
	useEffect(() => {
		if (showNotifPrompt) {
			Alert.alert(
				"Enable Notifications?",
				"Would you like to turn on notifications to stay updated on new games and social activity?",
				[
					{
						text: "No, thanks",
						style: "cancel",
						onPress: () => {
							setShowNotifPrompt(false);
							handleNotificationOptOut();
						},
					},
					{
						text: "Yes",
						onPress: () => {
							setShowNotifPrompt(false);
							handleNotificationOptIn();
						},
					},
				]
			);
		}
	}, [showNotifPrompt]);

	// Handle notification opt-in
	const handleNotificationOptIn = async () => {
		try {
			const user = getCurrentUser();
			if (!user) return;

			const hasPermission = await requestNotificationPermission();
			if (hasPermission) {
				const token = await getFCMToken();
				if (token) {
					await registerFCMToken(user.uid, token);
					console.log("[FCM] Token registered successfully");
				} else {
					console.warn("[FCM] Failed to get token");
				}
			} else {
				// User denied permission, mark as declined
				await removeFCMToken(user.uid);
				Alert.alert(
					"Notifications Disabled",
					"You can enable notifications later in your profile settings."
				);
			}
		} catch (error) {
			console.error("[FCM] Error during opt-in:", error);
		}
	};

	// Handle notification opt-out
	const handleNotificationOptOut = async () => {
		try {
			const user = getCurrentUser();
			if (!user) return;

			// Mark as declined by removing/clearing token
			await removeFCMToken(user.uid);
			console.log("[FCM] User opted out of notifications");
		} catch (error) {
			console.error("[FCM] Error during opt-out:", error);
		}
	};

	// Load following feed
	const loadFollowingFeed = async () => {
		const user = getCurrentUser();
		if (!user) return;

		setLoadingFollowing(true);
		setFollowingPuzzles([]);
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
					// Handle WordForm
					else if (game.gameType === "wordform" && gameData.qna) {
						puzzleData = {
							answer: gameData.qna.toUpperCase(),
						} as WordFormData;
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
					// Handle CodeBreaker
					else if (
						game.gameType === "codebreaker" &&
						gameData.secretCode &&
						Array.isArray(gameData.secretCode) &&
						gameData.maxGuesses
					) {
						puzzleData = {
							secretCode: gameData.secretCode,
							maxGuesses: gameData.maxGuesses,
						} as CodeBreakerData;
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
					// Handle Inference
					else if (
						game.gameType === "inference" &&
						gameData.definitions &&
						gameData.answer &&
						gameData.choices
					) {
						puzzleData = {
							definitions: gameData.definitions,
							answer: gameData.answer,
							choices: gameData.choices,
							hint: gameData.hint,
						} as InferenceData;
						isValid = true;
					}
					// Handle Maze
					else if (
						game.gameType === "maze" &&
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
						} as MazeData;
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
					// Handle TrailFinder
					else if (
						game.gameType === "trailfinder" &&
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
						} as TrailFinderData;
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
						username: gameData.username || game.username,
						uid: game.createdBy || game.uid,
						profilePicture: gameData.profilePicture || null,
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

	// Prefetch next batch of recommendations in background for instant "For You" refresh
	// Fetches full Puzzle objects so refresh is truly instant (no Firestore calls needed)
	const prefetchNextBatch = async () => {
		// Don't prefetch if already fetching
		if (isFetchingPrefetchRef.current) {
			console.log("[Prefetch] Already fetching, skipping");
			return;
		}
		
		const user = getCurrentUser();
		if (!user) return;
		
		isFetchingPrefetchRef.current = true;
		console.log("[Prefetch] Starting background prefetch...");
		
		try {
			const idToken = await auth().currentUser?.getIdToken();
			if (!idToken) {
				console.warn("[Prefetch] No auth token");
				return;
			}
			
			// Step 1: Get recommended game IDs from cloud function
			const res = await fetch(COMPUTE_NEXT_RECOMMENDATIONS_URL, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json", 
					Authorization: `Bearer ${idToken}` 
				},
				body: JSON.stringify({ 
				data: { 
					excludeGameIds: [], 
					count: 50,
					...getAppliedFilterPayload(),
				} 
			}),
			});
			
			const result = await res.json();
			
			if (result.result?.gameIds && Array.isArray(result.result.gameIds)) {
				const gameIds = result.result.gameIds;
				console.log(`[Prefetch] Got ${gameIds.length} game IDs, fetching full data...`);
				
				// Step 2: Fetch full game data from Firestore
				const firestoreGames = await fetchGamesByIds(gameIds);
				
				// Step 3: Convert to Puzzle objects
				const puzzles: Puzzle[] = [];
				for (const gameId of gameIds) {
					const firestoreGame = firestoreGames.find((g) => g.id === gameId);
					if (firestoreGame) {
						const puzzle = convertFirestoreGameToPuzzle(firestoreGame, gameId);
						if (puzzle) {
							puzzles.push(puzzle);
						}
					}
				}
				
				// Store ready-to-use puzzles (blocked users already filtered by cloud function)
				prefetchedPuzzlesRef.current = puzzles;
				console.log(`[Prefetch] Buffered ${puzzles.length} ready-to-use puzzles`);
			}
		} catch (error) {
			console.error("[Prefetch] Error:", error);
		} finally {
			isFetchingPrefetchRef.current = false;
		}
	};

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
			
			const user = getCurrentUser();
			if (!user) {
				await loadPuzzlesFromFirestore();
				return;
			}
			
			// INSTANT PATH: Use prefetched puzzles if available (no network calls!)
			if (prefetchedPuzzlesRef.current.length > 0) {
				console.log(`[ForYou] INSTANT: Using ${prefetchedPuzzlesRef.current.length} prefetched puzzles`);
				
				// Grab the prefetched puzzles and clear the buffer
				const prefetchedPuzzles = [...prefetchedPuzzlesRef.current];
				prefetchedPuzzlesRef.current = [];
				
				// INSTANT: Apply committed filters and set puzzles - no Firestore calls needed!
				const filteredPrefetched = applyAppliedFiltersLocal(prefetchedPuzzles);
				setDisplayedPuzzles(filteredPrefetched);
				setAllRecommendedPuzzles(filteredPrefetched);
				setPuzzles(filteredPrefetched);
				
				// Initialize elapsed times
				const initialElapsedTimes: Record<string, number> = {};
				prefetchedPuzzles.forEach((puzzle) => {
					initialElapsedTimes[puzzle.id] = 0;
				});
				puzzleElapsedTimesRef.current = initialElapsedTimes;
				
				// Filter completed games in background (non-blocking)
				getAllCompletedGameIds(user.uid).then((completedIds) => {
					const filteredPuzzles = filteredPrefetched.filter(
						(puzzle) => !completedIds.has(puzzle.id)
					);
					if (filteredPuzzles.length !== filteredPrefetched.length) {
						setDisplayedPuzzles(filteredPuzzles);
						setAllRecommendedPuzzles(filteredPuzzles);
						setPuzzles(filteredPuzzles);
					}
				}).catch((error) => {
					console.error("Error filtering completed games:", error);
				});
				
				// BACKGROUND: Refill the buffer for next time
				prefetchNextBatch();
				
				return; // Exit early - instant load complete!
			}
			
			// SLOW PATH: No prefetched buffer - fetch fresh (7 second wait)
			console.log("[ForYou] No prefetched buffer, fetching fresh recommendations...");
			setLoading(true);
			
			try {
				const idToken = await auth().currentUser?.getIdToken();
				if (idToken) {
					const res = await fetch(COMPUTE_NEXT_RECOMMENDATIONS_URL, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
						body: JSON.stringify({ 
							data: { 
								excludeGameIds: [], 
								count: 50,
								...getAppliedFilterPayload(),
							} 
						}),					
					});
					const result = await res.json();
					
					if (result.result?.gameIds && Array.isArray(result.result.gameIds)) {
						// Fetch games directly
						const firestoreGames = await fetchGamesByIds(result.result.gameIds);
						
						// Convert to puzzles
						const puzzles: Puzzle[] = [];
						for (const gameId of result.result.gameIds) {
							const firestoreGame = firestoreGames.find((g) => g.id === gameId);
							if (firestoreGame) {
								const puzzle = convertFirestoreGameToPuzzle(firestoreGame, gameId);
								if (puzzle) {
									puzzles.push(puzzle);
								}
							}
						}
						
						// Set puzzles immediately (blocked users already filtered by cloud function)
						setDisplayedPuzzles(puzzles);
						setAllRecommendedPuzzles(puzzles);
						setPuzzles(puzzles);
						
						// Initialize elapsed times
						const initialElapsedTimes: Record<string, number> = {};
						puzzles.forEach((puzzle) => {
							initialElapsedTimes[puzzle.id] = 0;
						});
						puzzleElapsedTimesRef.current = initialElapsedTimes;
						
						// Filter completed games in background (non-blocking)
						getAllCompletedGameIds(user.uid).then((completedIds) => {
							const filteredPuzzles = puzzles.filter(
								(puzzle) => !completedIds.has(puzzle.id)
							);
							if (filteredPuzzles.length !== puzzles.length) {
								setDisplayedPuzzles(filteredPuzzles);
								setAllRecommendedPuzzles(filteredPuzzles);
								setPuzzles(filteredPuzzles);
							}
						}).catch((error) => {
							console.error("Error filtering completed games:", error);
						});
						
						setLoading(false);
						
						// BACKGROUND: Prefetch for next time
						prefetchNextBatch();
						
						return; // Exit early - feed is populated
					}
				}
			} catch (e) {
				console.error("Recommendation refresh failed:", e);
			}
			
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
			setLoadingFollowing(true);
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
				return;
			}

			// Check for FCM token on initial load only (prompt once per session)
			if (isInitialLoad && !hasCheckedFCMRef.current) {
				hasCheckedFCMRef.current = true;
				// If user doesn't have fcmToken field, prompt them for notifications
				if (!data.fcmToken) {
					// Small delay to let the feed load first
					setTimeout(() => {
						setShowNotifPrompt(true);
					}, 1500);
				}
			}
		}
	};

	const loadPuzzlesFromFirestore = async () => {
		setLoading(true);
		try {
			const user = getCurrentUser();
			if (!user) {
				setLoading(false);
				return;
			}

			// Check for pre-computed recommendations first
			const currentUserData = await getUserData(user.uid);
			if (
				currentUserData?.precomputedRecommendations?.gameIds &&
				currentUserData.precomputedRecommendations.gameIds.length > 0
			) {
				const precomputedGameIds =
					currentUserData.precomputedRecommendations.gameIds;

				// INSTANT LOAD: Fetch games and display immediately
				// Don't wait for completed check - do it in background
				fetchGamesByIds(precomputedGameIds)
					.then((firestoreGames) => {
						// Convert FirestoreGame to Puzzle
						// Create a map for O(1) lookup while preserving order from precomputedGameIds
						const gameMap = new Map<string, FirestoreGame>();
						firestoreGames.forEach((game) => {
							gameMap.set(game.id, game);
						});

						const puzzles: Puzzle[] = [];
						// Iterate through precomputedGameIds in order to preserve Firebase order
						for (const gameId of precomputedGameIds) {
							const firestoreGame = gameMap.get(gameId);
							if (firestoreGame) {
								const puzzle = convertFirestoreGameToPuzzle(
									firestoreGame,
									gameId
								);
								if (puzzle) {
									puzzles.push(puzzle);
								}
							}
						}

						// Set games immediately (blocked users already filtered by cloud function)
						setDisplayedPuzzles(puzzles);
						setAllRecommendedPuzzles(puzzles);
						setPuzzles(puzzles);
						console.log("puzzles", puzzles.length);
						// Initialize elapsed times
						const initialElapsedTimes: Record<string, number> = {};
						puzzles.forEach((puzzle) => {
							initialElapsedTimes[puzzle.id] = 0;
						});
						puzzleElapsedTimesRef.current = initialElapsedTimes;

						// Filter out completed games in background (non-blocking)
						getAllCompletedGameIds(user.uid)
							.then((completedIds) => {
								const filteredPuzzles = puzzles.filter(
									(puzzle) => !completedIds.has(puzzle.id)
								);

								// Update if any were filtered out
								if (filteredPuzzles.length !== puzzles.length) {
									setDisplayedPuzzles(filteredPuzzles);
									setAllRecommendedPuzzles(filteredPuzzles);
									setPuzzles(filteredPuzzles);
								}
							})
							.catch((error) => {
								console.error("Error filtering completed games:", error);
							});
					})
					.catch((error) => {
						console.error("Error fetching pre-computed games:", error);
						setLoading(false);
					});

				// FLUSH: Clear precomputed array in background (non-blocking)
				db.collection("users")
					.doc(user.uid)
					.update({
						"precomputedRecommendations.gameIds": [],
					})
					.catch((error) => {
						console.error("Error flushing precomputed recommendations:", error);
					});

				// PREFETCH: Start prefetching next batch in background for instant "For You" refresh
				prefetchNextBatch();

				setLoading(false);
				return; // Exit early - instant load!
			}

			// Fallback: First time user or no pre-computed games
			// Use compute_next_recommendations cloud function for personalized recommendations
			console.log("[Feed] Fallback: Using compute_next_recommendations...");

			const idToken = await auth().currentUser?.getIdToken();
			if (idToken) {
				const historyIds = await getAllGameHistoryIds(user.uid);

				const res = await fetch(COMPUTE_NEXT_RECOMMENDATIONS_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						data: { 
							excludeGameIds: Array.from(historyIds), 
							count: 50,
							...getAppliedFilterPayload(),
						},
					}),
				});

				const result = await res.json();

				if (result.result?.gameIds && Array.isArray(result.result.gameIds)) {
					console.log(`[Feed] Fallback got ${result.result.gameIds.length} game IDs`);
					
					// Fetch full game data from Firestore
					const firestoreGames = await fetchGamesByIds(result.result.gameIds);

					// Convert to Puzzle objects
					const allPuzzles: Puzzle[] = [];
					for (const gameId of result.result.gameIds) {
						const firestoreGame = firestoreGames.find((g) => g.id === gameId);
						if (firestoreGame) {
							const puzzle = convertFirestoreGameToPuzzle(firestoreGame, gameId);
							if (puzzle) {
								allPuzzles.push(puzzle);
							}
						}
					}

					// Store all puzzles (blocked users already filtered by cloud function)
					setPuzzles(allPuzzles);
					setAllRecommendedPuzzles(allPuzzles);
					setDisplayedPuzzles(allPuzzles);

					// Initialize elapsed times for all puzzles to 0
					const initialElapsedTimes: Record<string, number> = {};
					allPuzzles.forEach((puzzle) => {
						initialElapsedTimes[puzzle.id] = 0;
					});
					puzzleElapsedTimesRef.current = initialElapsedTimes;

					// Filter completed games in background (non-blocking)
					getAllCompletedGameIds(user.uid)
						.then((completedIds) => {
							const filteredPuzzles = allPuzzles.filter(
								(puzzle) => !completedIds.has(puzzle.id)
							);
							if (filteredPuzzles.length !== allPuzzles.length) {
								setDisplayedPuzzles(filteredPuzzles);
								setAllRecommendedPuzzles(filteredPuzzles);
								setPuzzles(filteredPuzzles);
							}
						})
						.catch((error) => {
							console.error("Error filtering completed games (fallback):", error);
						});

					// PREFETCH: Start prefetching next batch in background for instant "For You" refresh
					prefetchNextBatch();
				}
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
	// Note: blocked users already filtered by cloud function
	const filterDisplayedGamesInBackground = async (games: Puzzle[]) => {
		const user = getCurrentUser();
		if (!user) return;

		// Only check games we haven't checked yet
		const uncheckedGames = games.filter(
			(g) => !checkedGamesRef.current.has(g.id)
		);
		if (uncheckedGames.length === 0) return;

		const gameIds = uncheckedGames.map((g) => g.id);

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
			setDisplayedPuzzles((prev) =>
				prev.filter((p) => !completedIds.has(p.id))
			);
		}
	};

	// Apply difficulty + game-type filters to a list of puzzles
const applyForYouFilters = useCallback(
  (puzzles: Puzzle[]): Puzzle[] => {
    if (selectedDifficulties.length === 0 && selectedGameTypes.length === 0) {
      return puzzles;
    }

    return puzzles.filter((puzzle) => {
      // Difficulty filter
      if (
        selectedDifficulties.length > 0 &&
        !selectedDifficulties.includes(puzzle.difficulty)
      ) {
        return false;
      }

      // Game type filter
      if (
        selectedGameTypes.length > 0 &&
        !selectedGameTypes.includes(puzzle.type)
      ) {
        return false;
      }

      return true;
    });
  },
  [selectedDifficulties, selectedGameTypes]
);

	// Apply filters based on the committed (applied) refs (not live chip selection)
	const applyAppliedFiltersLocal = useCallback((puzzles: Puzzle[]): Puzzle[] => {
		const diffs = appliedDifficultiesRef.current;
		const types = appliedGameTypesRef.current;

		if (diffs.length === 0 && types.length === 0) return puzzles;

		return puzzles.filter((p) => {
			if (diffs.length > 0 && !diffs.includes(p.difficulty)) return false;
			if (types.length > 0 && !types.includes(p.type)) return false;
			return true;
		});
	}, []);

	// Fetch more games from Firestore for infinite scroll
	const fetchMoreGamesFromFirestore = async () => {
		if (isFetchingMore || !hasMoreGamesToFetch) return;

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

				// Fetch WordForm
				const wordformGames = await fetchGamesFromFirestore("wordform", difficulty);
				wordformGames.forEach((game) => {
					if (game.qna) {
						newGames.push({
							id: `wordform_${difficulty}_${game.id}`,
							type: "wordform",
							data: {
								answer: game.qna.toUpperCase(),
							} as WordFormData,
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
				triviaGames.forEach((game) => {
					if (game.questions && Array.isArray(game.questions)) {
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
					}
				});

				// Fetch CodeBreaker
				const codebreakerGamesPrefetch = await fetchGamesFromFirestore(
					"codebreaker",
					difficulty
				);
				codebreakerGamesPrefetch.forEach((game) => {
					if (
						game.secretCode &&
						Array.isArray(game.secretCode) &&
						game.maxGuesses
					) {
						newGames.push({
							id: `codebreaker_${difficulty}_${game.id}`,
							type: "codebreaker",
							data: {
								secretCode: game.secretCode,
								maxGuesses: game.maxGuesses,
							} as CodeBreakerData,
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

				// Fetch Inference
				const inferenceGames = await fetchGamesFromFirestore("inference", difficulty);
				inferenceGames.forEach((game) => {
					if (game.definitions && game.answer) {
						newGames.push({
							id: `inference_${difficulty}_${game.id}`,
							type: "inference",
							data: {
								definitions: game.definitions,
								answer: game.answer,
								hint: game.hint,
							} as InferenceData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
							username: game.username,
						});
					}
				});

				// Fetch Maze
				const mazeGames = await fetchGamesFromFirestore("maze", difficulty);
				mazeGames.forEach((game) => {
					if (game.rows && game.cols && game.cells && game.solution) {
						newGames.push({
							id: `maze_${difficulty}_${game.id}`,
							type: "maze",
							data: {
								rows: game.rows,
								cols: game.cols,
								cells: game.cells,
								solution: game.solution,
							} as MazeData,
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

				// Fetch TrailFinder
				const trailfinderGames = await fetchGamesFromFirestore("trailfinder", difficulty);
				trailfinderGames.forEach((game) => {
					if (
						game.rows &&
						game.cols &&
						game.startNum !== undefined &&
						game.endNum !== undefined &&
						game.path &&
						game.givens
					) {
						newGames.push({
							id: `trailfinder_${difficulty}_${game.id}`,
							type: "trailfinder",
							data: {
								rows: game.rows,
								cols: game.cols,
								startNum: game.startNum,
								endNum: game.endNum,
								path: game.path,
								givens: game.givens,
							} as TrailFinderData,
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
				setHasMoreGamesToFetch(false);
				return;
			}

			// Filter out games that:
			// 1. We already have in our current pool (avoid immediate duplicates)
			// 2. User has already completed (permanently done)
			// NOTE: We DO allow previously skipped games (user might want to try again)
			const freshGames = newGames.filter(
				(game) =>
					!existingGameIds.has(game.id) && !completedGameIds.has(game.id)
			);

			if (freshGames.length === 0) {
				setHasMoreGamesToFetch(false);
				return;
			}

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

				return [...prev, ...newUnique];
			});
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

		if (loadingMore) return;

		// If we're at the end of the current stream, fetch more from backend (endless scrolling)
		if (displayedPuzzles.length >= allRecommendedPuzzles.length) {
			if (hasMoreGamesToFetch) {
				setLoadingMore(true);
				try {
					const user = getCurrentUser();
					if (!user) return;

					const idToken = await auth().currentUser?.getIdToken();
					if (!idToken) return;

					const excludeIds = allRecommendedPuzzles.map((p) => p.id);
					const res = await fetch(COMPUTE_NEXT_RECOMMENDATIONS_URL, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${idToken}`,
						},
						body: JSON.stringify({
							data: {
								excludeGameIds: excludeIds,
								count: 50,
								...getAppliedFilterPayload(),
							},
						}),
					});

					const result = await res.json();
					const gameIds: string[] = Array.isArray(result.result?.gameIds)
						? result.result.gameIds
						: [];

					if (gameIds.length === 0) {
						setHasMoreGamesToFetch(false);
						return;
					}

					const firestoreGames = await fetchGamesByIds(gameIds);
					const newPuzzles: Puzzle[] = [];
					for (const gameId of gameIds) {
						const fg = firestoreGames.find((g) => g.id === gameId);
						if (!fg) continue;
						const puzzle = convertFirestoreGameToPuzzle(fg, gameId);
						if (puzzle) newPuzzles.push(puzzle);
					}

					if (newPuzzles.length === 0) {
						setHasMoreGamesToFetch(false);
						return;
					}

					setAllRecommendedPuzzles((prev) => [...prev, ...newPuzzles]);
					setDisplayedPuzzles((prev) => [...prev, ...newPuzzles]);
				} finally {
					setLoadingMore(false);
				}
			}
			return;
		}

		// PREFETCH: At 90%, fetch more games in background
		const percentageViewed =
			displayedPuzzles.length / allRecommendedPuzzles.length;
		const appliedHasFilters =
			appliedDifficultiesRef.current.length > 0 ||
			appliedGameTypesRef.current.length > 0;
		if (
			!appliedHasFilters &&
			percentageViewed >= 0.9 &&
			!isFetchingMore &&
			hasMoreGamesToFetch
		) {
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
			// Apply committed filters to the batch first
			const filteredBatch = applyAppliedFiltersLocal(nextBatch);
			
			// Check completion for this batch only
			await filterDisplayedGamesInBackground(filteredBatch);

			// Add non-completed games
			const filtered = filteredBatch.filter(
				(g) => !initialCompletedGamesRef.current.has(g.id)
			);

			if (filtered.length > 0) {
				// LAYER 4: Deduplicate before adding to displayed list
				const displayedIds = new Set(displayedPuzzles.map((p) => p.id));
				const uniqueBatch = filtered.filter((g) => !displayedIds.has(g.id));

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
		applyAppliedFiltersLocal,
	]);

	// Handle viewable items changed (TikTok-like scrolling)
	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: any[] }) => {
			if (viewableItems.length > 0) {
				const newIndex = viewableItems[0].index ?? 0;
				const newPuzzleId = viewableItems[0].item?.id;

				// Track visible index for For You (0 = welcome, 1+ = puzzle) so share pill stays fixed
				if (activeTab === "forYou") {
					setCurrentVisibleIndexForYou(newIndex);
				}

				// Skip welcome card in viewability tracking (puzzle-specific logic below)
				if (newPuzzleId === "__welcome__") {
					return;
				}

				// Get current state for the active tab
				const currentTabPuzzleId =
					activeTab === "forYou"
						? currentPuzzleIdForYou
						: currentPuzzleIdFollowing;

				if (newPuzzleId && newPuzzleId !== currentTabPuzzleId) {
					// If user swiped to a new game, show the filter pill again (For You only)
					if (activeTab === "forYou") {
						setIsFilterPillVisible(true);
					}
					// Update current game index for progressive loading
					if (activeTab === "forYou") {
						// Calculate relative index within current batch (every 50 games)
						const relativeIndex = newIndex % 50;
						console.log("relativeIndex", relativeIndex);
						currentGameIndexRef.current = relativeIndex;

						// Trigger progressive refresh at game 35 of each batch (indices 35, 85, 135, etc.)
						if (relativeIndex === 35 && !isRefreshingRef.current) {
							console.log("triggering progressive refresh");
							isRefreshingRef.current = true;
							triggerProgressiveRefresh().finally(() => {
								console.log("progressive refresh finished");
								console.log("puzzle length", displayedPuzzles.length);
								isRefreshingRef.current = false;
							});
						}
					}

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

						const user = getCurrentUser();

						if (!wasCompleted && wasAttempted && !wasAlreadySkipped) {
							// User attempted but didn't complete - mark as attempted
							skippedPuzzlesRef.current.add(currentTabPuzzleId); // Still mark as "left" so we don't track again

							// Call addAttemptedGame to update user stats
							if (user) {
								addAttemptedGame(user.uid, currentTabPuzzleId)
									.then(() => {
										// Successfully tracked
									})
									.catch((error) => {
										console.error(
											"[ATTEMPTED] Error adding attempted game:",
											error
										);
									});
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
		minimumViewTime: 100,
		waitForInteraction: false,
	}).current;

	// Progressive refresh: Compute next 50 games in background (at game 35)
	const triggerProgressiveRefresh = async () => {
		const user = getCurrentUser();
		if (!user) return;

		try {
			// Get current feed game IDs (to avoid duplicates)
			// Note: COMPUTE_NEXT_RECOMMENDATIONS_URL already filters out completed games
			const currentFeedIds = new Set(displayedPuzzles.map((game) => game.id));
			const excludeIds = Array.from(currentFeedIds);

			// Get auth token (using modular API to avoid deprecation warning)
			const currentUser = auth().currentUser;
			if (!currentUser) {
				console.error("No current user available");
				return;
			}

			const idToken = await currentUser.getIdToken();
			if (!idToken) {
				console.error("No auth token available");
				return;
			}

			// Call Firebase function via HTTP to compute next 50
			const response = await fetch(COMPUTE_NEXT_RECOMMENDATIONS_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					data: {
						excludeGameIds: excludeIds,
						count: 50,
						...getAppliedFilterPayload(),
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();

			if (result.result?.gameIds && Array.isArray(result.result.gameIds)) {
				// Fetch the new games
				const firestoreGames = await fetchGamesByIds(result.result.gameIds);

				// Convert FirestoreGame to Puzzle
				const newPuzzles: Puzzle[] = [];
				for (const gameId of result.result.gameIds) {
					const firestoreGame = firestoreGames.find((g) => g.id === gameId);
					if (firestoreGame) {
						const puzzle = convertFirestoreGameToPuzzle(firestoreGame, gameId);
						if (puzzle) {
							newPuzzles.push(puzzle);
						}
					}
				}

				// Append to current feed at the end (games 51-100, 101-150, etc.)
				setDisplayedPuzzles((prev) => [...prev, ...newPuzzles]);
				setAllRecommendedPuzzles((prev) => [...prev, ...newPuzzles]);

				// Reset tracking index for next batch (so next trigger happens at game 35 of new batch)
				// Note: The actual FlatList index continues (0-49, 50-99, 100-149...)
				// But we track relative position (0-49) within each batch
				currentGameIndexRef.current = 0;
			}
		} catch (error) {
			console.error("Failed to refresh recommendations:", error);
			// Fallback: Use client-side algorithm if server fails
			// (This would require loading all games, so we skip for now)
		}
	};

	// Memoize displayed puzzle IDs to avoid recalculating on every render
	const displayedPuzzleIds = useMemo(
		() => displayedPuzzles.map((g) => g.id),
		[displayedPuzzles]
	);

	// Create data array with welcome card as permanent first item (only for "For You" tab)
	const feedData = useMemo(() => {
		// Always show welcome card as first item in "For You" tab
		if (activeTab === "forYou") {
			// Create a placeholder puzzle object for the welcome card
			const welcomeCard: Puzzle = {
				id: "__welcome__",
				type: "wordform" as PuzzleType, // Dummy type, won't be used
				difficulty: 1,
				data: {} as any, // Dummy data
				createdAt: new Date().toISOString(),
				uid: "",
				username: "",
			};
			return [welcomeCard, ...displayedPuzzles];
		}
		return displayedPuzzles;
	}, [displayedPuzzles, activeTab]);

	// Use shared session end refresh hook (only sets up listener if user is authenticated)
	useSessionEndRefresh(displayedPuzzleIds);

	// Initialize first puzzle timer
	useEffect(() => {
		if (feedData.length > 0 && !currentPuzzleId) {
			// Find first non-welcome puzzle
			const firstPuzzle = feedData.find(p => p.id !== "__welcome__");
			if (!firstPuzzle) return;
			const firstPuzzleId = firstPuzzle.id;
			setCurrentPuzzleId(firstPuzzleId);
			setCurrentIndex(0);
			// Calculate startTime for first puzzle (elapsed time is 0, so startTime is now)
			const elapsedTime = puzzleElapsedTimesRef.current[firstPuzzleId] || 0;
			const startTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[firstPuzzleId] = startTime;
			// Mark when first puzzle became visible
			puzzleVisibleTimesRef.current[firstPuzzleId] = Date.now();
		}
	}, [feedData, currentPuzzleId, setCurrentPuzzleId, setCurrentIndex]);


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
			attemptedPuzzlesRef.current.add(puzzleId);

			// If this game was previously marked as skipped in this session, remove it
			if (skippedPuzzlesRef.current.has(puzzleId)) {
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

	const registerShareHandlers = useCallback(
		(
			handlers: {
				shareExternal: () => void;
				shareInternal: () => void;
				openShareMenu: () => void;
			} | null,
			puzzleId: string
		) => {
			if (handlers === null) {
				if (shareHandlersRef.current?.puzzleId === puzzleId) {
					shareHandlersRef.current = null;
				}
			} else {
				shareHandlersRef.current = { puzzleId, handlers };
			}
		},
		[]
	);

	const renderPuzzleCard = useCallback(
		({ item, index }: { item: Puzzle; index: number }) => {
			// Check if this is the welcome card
			if (item.id === "__welcome__") {
				return (
					<View style={[styles.puzzleCard, { height: itemHeight }]}>
						<WelcomeCard height={itemHeight} />
					</View>
				);
			}

			// Check if this puzzle is currently active/visible for the current tab
			const currentTabPuzzleId =
				activeTab === "forYou"
					? currentPuzzleIdForYou
					: currentPuzzleIdFollowing;
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
						onStartGame={
							activeTab === "forYou"
								? () => setIsFilterPillVisible(false)
								: undefined
						}
						startTime={puzzleStartTime}
						isActive={isActive}
						onElapsedTimeUpdate={handleElapsedTimeUpdate}
						onRegisterShareHandlers={registerShareHandlers}
					/>
				</View>
			);
		},
		[
			activeTab,
			currentPuzzleIdForYou,
			currentPuzzleIdFollowing,
			itemHeight,
			handleGameComplete,
			handleGameAttempt,
			handleElapsedTimeUpdate,
			setIsFilterPillVisible,
			registerShareHandlers,
		]
	);

	const renderHeader = useCallback(() => {
		const tabWidth = SCREEN_WIDTH / 2;
		const indicatorTranslateX = tabIndicatorAnim.interpolate({
			inputRange: [0, 1],
			outputRange: [0, tabWidth],
		});
		const forYouColors = Gradients.primary as any;
		const followingColors = ([...(Gradients.primary as any)].reverse() as any);

		return (
			<>
				{/* Glassmorphism header */}
				<View
					style={[styles.header, { paddingTop: insets.top }]}
					onLayout={(e) => {
						const height = e.nativeEvent.layout.height;
						if (height > 0 && height !== headerHeight) {
							setHeaderHeight(height);
						}
					}}
				/>

				{/* Tabs with animated indicator */}
				<View style={styles.tabContainer}>
					<Animated.View
						style={[
							styles.tabIndicator,
							{
								transform: [{ translateX: indicatorTranslateX }],
							},
						]}
					>
						<LinearGradient
							colors={(activeTab === "following" ? followingColors : forYouColors) as any}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={StyleSheet.absoluteFill}
						/>
					</Animated.View>
					<TouchableOpacity
						style={styles.tab}
						onPress={handleForYouTabPress}
						activeOpacity={0.7}
					>
						<Animated.Text
							style={[
								styles.tabText,
								activeTab === "forYou" && styles.activeTabText,
								{ opacity: tabOpacityAnim },
							]}
						>
							For You
						</Animated.Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.tab}
						onPress={handleFollowingTabPress}
						activeOpacity={0.7}
					>
						<Animated.Text
							style={[
								styles.tabText,
								activeTab === "following" && styles.activeTabText,
								{ opacity: tabOpacityAnim },
							]}
						>
							Following
						</Animated.Text>
					</TouchableOpacity>
				</View>
			</>
		);
	}, [
		activeTab,
		insets.top,
		headerHeight,
		tabIndicatorAnim,
		tabOpacityAnim,
		handleForYouTabPress,
		handleFollowingTabPress,
	]);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			{renderHeader()}

			{/* Share pill - fixed like filter, shows on welcome card and puzzle intro */}
			{activeTab === "forYou" && isFilterPillVisible && (
				<TouchableOpacity
					style={[
						styles.sharePill,
						{ top: headerHeight + 90 + Spacing.xs },
					]}
					onPress={() => {
						const visibleIndex = currentVisibleIndexForYouRef.current;
						if (visibleIndex === 0) {
							setIsShareMenuVisible(true);
							return;
						}
						// Prefer GameWrapper's share menu (touch in same tree so Share.share works on iOS)
						const openMenu = shareHandlersRef.current?.handlers?.openShareMenu;
						if (typeof openMenu === "function") {
							openMenu();
						} else {
							setIsShareMenuVisible(true);
						}
					}}
					activeOpacity={0.85}
				>
					<Ionicons
						name="share-outline"
						size={16}
						color={Colors.accent}
					/>
				</TouchableOpacity>
			)}

			{/* Filter pill - positioned just below the tabs, similar to Games Completed counter */}
			{activeTab === "forYou" && isFilterPillVisible && (
				<TouchableOpacity
					style={[
						styles.filterPill,
						{ top: headerHeight + 44 + Spacing.xs }, // header + tab height
					]}
					onPress={() => setIsFilterModalVisible(true)}
					activeOpacity={0.85}
				>
					<Ionicons
						name="options-outline"
						size={16}
						color={Colors.accent}
					/>
				</TouchableOpacity>
			)}

			{/* Share menu modal - fixed at feed level */}
			<Modal
				visible={isShareMenuVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setIsShareMenuVisible(false)}
			>
				<TouchableWithoutFeedback onPress={() => setIsShareMenuVisible(false)}>
					<View style={styles.shareMenuOverlay}>
						<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
							<View style={styles.shareMenuContainer}>
								{currentVisibleIndexForYou === 0 ? (
									<TouchableOpacity
										style={styles.shareMenuItem}
										onPress={async () => {
											// Close modal first - iOS can't present Share sheet from within a modal
											setIsShareMenuVisible(false);
											
											// Wait for modal to fully close before calling Share API
											// This matches the pattern in GameSocialOverlay
											setTimeout(async () => {
												try {
													await Share.share({
														message:
															"Check out ThinkTok – swipe through puzzles, compete with friends, and sharpen your mind!",
														url: "https://apps.apple.com/app/thinktok/id6739000000",
													});
												} catch (e: any) {
													if (e?.message !== "User did not share") {
														console.error("Share error:", e);
													}
												}
											}, 300); // Wait for modal to fully close (matches GameSocialOverlay)
										}}
										activeOpacity={0.7}
									>
										<Ionicons name="share-outline" size={24} color={Colors.text.primary} />
										<Text style={styles.shareMenuText}>Share app</Text>
									</TouchableOpacity>
								) : (
									<>
										<TouchableOpacity
											style={styles.shareMenuItem}
											onPress={() => {
												setIsShareMenuVisible(false);
												setTimeout(() => shareHandlersRef.current?.handlers?.shareInternal(), 150);
											}}
											activeOpacity={0.7}
										>
											<Ionicons name="chatbubbles-outline" size={24} color={Colors.text.primary} />
											<Text style={styles.shareMenuText}>Send to Friend</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={styles.shareMenuItem}
											onPress={async () => {
												const shareExternal = shareHandlersRef.current?.handlers?.shareExternal;
												
												if (typeof shareExternal === 'function') {
													// Close modal first - iOS can't present Share sheet from within a modal
													setIsShareMenuVisible(false);
													
													// Wait for modal to fully close before calling Share API
													// This matches the pattern in GameSocialOverlay
													setTimeout(async () => {
														try {
															// Call the function - it may return a Promise (even though type says void)
															// @ts-ignore - handleShareBeforePlay is async but typed as void
															const result: any = shareExternal();
															// If it returns a promise, handle it
															if (result && typeof result.then === 'function') {
																await result;
															}
														} catch (error) {
															console.error('[FeedScreen] Error calling shareExternal():', error);
														}
													}, 300); // Wait for modal to fully close (matches GameSocialOverlay)
												} else {
													setIsShareMenuVisible(false);
												}
											}}
											activeOpacity={0.7}
										>
											<Ionicons name="share-outline" size={24} color={Colors.text.primary} />
											<Text style={styles.shareMenuText}>Share Externally</Text>
										</TouchableOpacity>
									</>
								)}
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			{/* Loading state with animated gradient */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<LinearGradient
						colors={Gradients.primary}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.loadingGradient}
					>
						<ActivityIndicator size="large" color={Colors.text.white} />
					</LinearGradient>
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
						{feedData.length > 0 ? (
							<FlatList
								ref={forYouFlatListRef}
								data={feedData}
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
								scrollEventThrottle={32}
								style={{
									flex: 1,
									elevation: 0,
									shadowOpacity: 0,
									shadowRadius: 0,
									shadowOffset: { width: 0, height: 0 },
									shadowColor: "transparent",
								}}
								keyboardDismissMode="on-drag"
								keyboardShouldPersistTaps="handled"
								scrollEnabled={!isKeyboardVisible && activeTab === "forYou"}
								onEndReached={loadNextBatch}
								onEndReachedThreshold={0.8}
								onScrollToIndexFailed={(info: any) => {
									const wait = new Promise((resolve) =>
										setTimeout(resolve, 500)
									);
									wait.then(() => {
										if (
											forYouFlatListRef.current &&
											info.index < feedData.length
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
											<LinearGradient
												colors={Gradients.primary}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}
												style={styles.loadingGradientSmall}
											>
												<ActivityIndicator
													size="small"
													color={Colors.text.white}
												/>
											</LinearGradient>
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
								windowSize={3}
								initialNumToRender={2}
								maxToRenderPerBatch={2}
								updateCellsBatchingPeriod={50}
								showsVerticalScrollIndicator={false}
								onViewableItemsChanged={onViewableItemsChanged}
								viewabilityConfig={viewabilityConfig}
								scrollEventThrottle={32}
								style={{
									flex: 1,
									elevation: 0,
									shadowOpacity: 0,
									shadowRadius: 0,
									shadowOffset: { width: 0, height: 0 },
									shadowColor: "transparent",
								}}
								keyboardDismissMode="on-drag"
								keyboardShouldPersistTaps="handled"
								scrollEnabled={!isKeyboardVisible && activeTab === "following"}
								removeClippedSubviews={true}
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
								<LinearGradient
									colors={Gradients.primary}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									style={styles.loadingGradient}
								>
									<ActivityIndicator size="large" color={Colors.text.white} />
								</LinearGradient>
								<Text style={styles.loadingText}>Loading puzzles...</Text>
							</View>
						) : (
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyText}>
									Your Followers haven't made anything new
								</Text>
							</View>
						)}
					</View>
				</View>
			)}

			{/* Filter Modal - simple UI shell for now */}
			<Modal
				visible={isFilterModalVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setIsFilterModalVisible(false)}
			>
				<TouchableWithoutFeedback
					onPress={() => setIsFilterModalVisible(false)}
				>
					<View style={styles.filterBackdrop}>
						<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
							<View style={styles.filterCard}>
							<Text style={styles.filterTitle}>Filter Games</Text>

							{/* Difficulty section */}
							<View style={styles.filterSection}>
								<Text style={styles.filterSectionTitle}>Difficulty</Text>
								<View style={styles.chipRow}>
								{[1, 2, 3].map((difficulty) => {
									const isSelected = selectedDifficulties.includes(difficulty);
									const labels: Record<number, string> = {
									1: "Easy",
									2: "Medium",
									3: "Hard",
									};
									return (
									<TouchableOpacity
										key={difficulty}
										style={[styles.chip, isSelected && styles.chipSelected]}
										onPress={() => {
										if (isSelected) {
											setSelectedDifficulties(
											selectedDifficulties.filter((d) => d !== difficulty)
											);
										} else {
											setSelectedDifficulties([
											...selectedDifficulties,
											difficulty,
											]);
										}
										}}
									>
										<Text
										style={[
											styles.chipLabel,
											isSelected && styles.chipLabelSelected,
										]}
										>
										{labels[difficulty]}
										</Text>
									</TouchableOpacity>
									);
								})}
								</View>
							</View>

							{/* Game type section */}
							<View style={styles.filterSection}>
								<Text style={styles.filterSectionTitle}>Game Type</Text>
								<View style={styles.chipRow}>
								{[
									"wordform",
									"quickMath",
									"riddle",
									"wordChain",
									"inference",
									"maze",
									"futoshiki",
									"magicSquare",
									"trailfinder",
									"sudoku",
									"trivia",
									"codebreaker",
									"sequencing",
								].map((gameType) => {
									const isSelected = selectedGameTypes.includes(gameType as PuzzleType);
									return (
									<TouchableOpacity
										key={gameType}
										style={[styles.chip, isSelected && styles.chipSelected]}
										onPress={() => {
										if (isSelected) {
											setSelectedGameTypes(
											selectedGameTypes.filter((t) => t !== gameType)
											);
										} else {
											setSelectedGameTypes([
											...selectedGameTypes,
											gameType as PuzzleType,
											]);
										}
										}}
									>
										<Text
										style={[
											styles.chipLabel,
											isSelected && styles.chipLabelSelected,
										]}
										>
										{gameType.charAt(0).toUpperCase() + gameType.slice(1)}
										</Text>
									</TouchableOpacity>
									);
								})}
								</View>
							</View>

							{/* Apply button */}
							<View style={styles.filterActions}>
								<TouchableOpacity
								style={styles.applyButton}
								onPress={async () => {
									// Commit filters
									appliedDifficultiesRef.current = [...selectedDifficulties];
									appliedGameTypesRef.current = [...selectedGameTypes];

									const nextKey = makeFilterKey(
										appliedDifficultiesRef.current,
										appliedGameTypesRef.current
									);

									// Save current stream into cache before switching
									forYouStreamCacheRef.current[activeFilterKeyRef.current] = {
										all: allRecommendedPuzzles,
										displayed: displayedPuzzles,
										hasMore: hasMoreGamesToFetch,
										prefetched: prefetchedPuzzlesRef.current,
									};

									// Switch active key
									activeFilterKeyRef.current = nextKey;

									// Restore from cache if available
									const cached = forYouStreamCacheRef.current[nextKey];
									if (cached) {
										prefetchedPuzzlesRef.current = cached.prefetched;
										setHasMoreGamesToFetch(cached.hasMore);
										setAllRecommendedPuzzles(cached.all);
										setDisplayedPuzzles(cached.displayed);

										setCurrentIndexForYou(0);
										setCurrentPuzzleIdForYou("");
										forYouFlatListRef.current?.scrollToOffset({
											offset: 0,
											animated: true,
										});

										setIsFilterModalVisible(false);
										return;
									}

									// New filter stream: clear old stream + prefetch and fetch first page
									prefetchedPuzzlesRef.current = [];
									setHasMoreGamesToFetch(true);
									setAllRecommendedPuzzles([]);
									setDisplayedPuzzles([]);

									setCurrentIndexForYou(0);
									setCurrentPuzzleIdForYou("");
									forYouFlatListRef.current?.scrollToOffset({
										offset: 0,
										animated: true,
									});

									await handleForYouTabPress();
									setIsFilterModalVisible(false);
								}}
								activeOpacity={0.9}
								>
								<View style={styles.applyButtonInner}>
									<Text style={styles.applyButtonText}>Apply</Text>
								</View>
								</TouchableOpacity>
							</View>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>
		</View>
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
	header: {
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 0,
		borderBottomColor: "transparent",
		zIndex: 10,
		paddingHorizontal: 0,
		paddingBottom: 0,
		overflow: "hidden",
		height: 40,
		justifyContent: "flex-end",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	headerTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	tabContainer: {
		flexDirection: "row",
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 0,
		borderBottomColor: "transparent",
		position: "relative",
		overflow: "hidden",
		zIndex: 9,
		height: 44,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
		paddingHorizontal: 0,
	},
	tab: {
		flex: 1,
		paddingVertical: Spacing.xs,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	tabIndicator: {
		position: "absolute",
		bottom: 0,
		left: 0,
		width: "50%",
		height: 2,
		zIndex: 1,
	},
	tabText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		letterSpacing: Typography.letterSpacing.normal,
	},
	activeTabText: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	feedContainer: {
		flex: 1,
		position: "relative",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	feed: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	feedAbsolute: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: Colors.background.primary,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	puzzleCard: {
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.secondary,
		overflow: "hidden",
		position: "relative",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
	},
	loadingGradient: {
		width: 60,
		height: 60,
		borderRadius: BorderRadius.lg,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	loadingGradientSmall: {
		width: 40,
		height: 40,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	loadingText: {
		marginTop: Spacing.lg,
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
		letterSpacing: Typography.letterSpacing.normal,
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
	sharePill: {
		position: "absolute",
		right: Spacing.lg,
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
		elevation: 2,
		backgroundColor: Colors.background.quaternary,
		...Shadows.medium,
	},
	filterPill: {
		position: "absolute",
		right: Spacing.lg,
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
		elevation: 2,
		backgroundColor: Colors.background.quaternary,
		...Shadows.medium,
	},
	shareMenuOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	shareMenuContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.sm,
		minWidth: 200,
		...Shadows.heavy,
	},
	shareMenuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	shareMenuText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	filterBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	filterCard: {
		width: SCREEN_WIDTH * 0.85,
		padding: Spacing.xl,
		borderRadius: BorderRadius.lg,
		backgroundColor: Colors.background.primary,
		...Shadows.medium,
	},
	filterTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	filterSubtitle: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
	},
	filterSection: {
		marginTop: Spacing.lg,
	},
	filterSectionTitle: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		marginBottom: Spacing.sm,
	},
	chipRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	chip: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.pill,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.background.secondary,
	},
	chipSelected: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
	},
	chipLabel: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	chipLabelSelected: {
		color: Colors.text.white,
		fontWeight: Typography.fontWeight.semiBold,
	},
	filterActions: {
		marginTop: Spacing.xl,
	},
	applyButton: {
		borderRadius: BorderRadius.md,
		overflow: "hidden",
	},
	applyButtonInner: {
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.md,
	},
	applyButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.white,
	},
});

// Export the component for use in MainAppContainer
export { FeedScreen };
// Default export returns null - MainAppContainer handles rendering
export default function FeedRoute() {
	return null;
}
