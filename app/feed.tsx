import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
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
	const flatListRef = useRef<FlatList>(null);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [headerHeight, setHeaderHeight] = useState(0);
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
	const [currentPuzzleId, setCurrentPuzzleId] = useState<string>("");
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

	// Load user data and puzzles from Firestore
	useEffect(() => {
		loadUserData(true); // Pass true to indicate initial load
		loadPuzzlesFromFirestore();
	}, []);

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
						});
					}
				});

				// Fetch Riddle
				const riddleGames = await fetchGamesFromFirestore("riddle", difficulty);
				riddleGames.forEach((game) => {
					if (game.question && game.answer) {
						allPuzzles.push({
							id: `riddle_${difficulty}_${game.id}`,
							type: "riddle",
							data: {
								prompt: game.question,
								answer: game.answer,
							} as RiddleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
						});
					}
				});

				// Fetch WordChain
				const wordChainGames = await fetchGamesFromFirestore(
					"wordChain",
					difficulty
				);
				wordChainGames.forEach((game) => {
					if (game.startWord && game.endWord && game.validWords) {
						allPuzzles.push({
							id: `wordchain_${difficulty}_${game.id}`,
							type: "wordChain",
							data: {
								startWord: game.startWord,
								endWord: game.endWord,
								validWords: game.validWords,
								minSteps: game.minSteps || 3,
								hint: game.hint,
							} as WordChainData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
						});
					}
				});

				// Fetch Alias
				const aliasGames = await fetchGamesFromFirestore("alias", difficulty);
				aliasGames.forEach((game) => {
					if (game.definitions && game.answer) {
						allPuzzles.push({
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
						});
					}
				});

				// Fetch Riddle
				const riddleGames = await fetchGamesFromFirestore("riddle", difficulty);
				riddleGames.forEach((game) => {
					if (game.question && game.answer) {
						newGames.push({
							id: `riddle_${difficulty}_${game.id}`,
							type: "riddle",
							data: {
								prompt: game.question,
								answer: game.answer,
							} as RiddleData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
						});
					}
				});

				// Fetch WordChain
				const wordChainGames = await fetchGamesFromFirestore(
					"wordChain",
					difficulty
				);
				wordChainGames.forEach((game) => {
					if (game.startWord && game.endWord && game.validWords) {
						newGames.push({
							id: `wordchain_${difficulty}_${game.id}`,
							type: "wordChain",
							data: {
								startWord: game.startWord,
								endWord: game.endWord,
								validWords: game.validWords,
								minSteps: game.minSteps || 3,
								hint: game.hint,
							} as WordChainData,
							difficulty:
								difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
							createdAt: new Date().toISOString(),
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

	// Load next batch for infinite scroll
	const loadNextBatch = useCallback(async () => {
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

				if (newPuzzleId && newPuzzleId !== currentPuzzleId) {
					// Handle skip tracking for the previous puzzle
					if (currentPuzzleId) {
						// Save elapsed time for current puzzle before switching away
						if (puzzleVisibleTimesRef.current[currentPuzzleId]) {
							const timeVisible =
								Date.now() - puzzleVisibleTimesRef.current[currentPuzzleId];
							const additionalElapsed = Math.floor(timeVisible / 1000);
							// Add to existing elapsed time
							puzzleElapsedTimesRef.current[currentPuzzleId] =
								(puzzleElapsedTimesRef.current[currentPuzzleId] || 0) +
								additionalElapsed;
						}

						// Check if the puzzle was completed, attempted, or already skipped
						const wasCompleted =
							completedPuzzlesRef.current.has(currentPuzzleId);
						const wasAttempted =
							attemptedPuzzlesRef.current.has(currentPuzzleId);
						const wasAlreadySkipped =
							skippedPuzzlesRef.current.has(currentPuzzleId);

						console.log(
							`[SKIP CHECK] Puzzle: ${currentPuzzleId}, wasCompleted: ${wasCompleted}, wasAttempted: ${wasAttempted}, wasAlreadySkipped: ${wasAlreadySkipped}`
						);

						const user = getCurrentUser();

						if (!wasCompleted && wasAttempted && !wasAlreadySkipped) {
							// User attempted but didn't complete - mark as attempted
							console.log(
								`[ATTEMPTED] User attempted but didn't complete: ${currentPuzzleId}`
							);
							skippedPuzzlesRef.current.add(currentPuzzleId); // Still mark as "left" so we don't track again

							// Call addAttemptedGame to update user stats
							if (user) {
								console.log(
									`[ATTEMPTED] Calling addAttemptedGame for user ${user.uid}`
								);
								addAttemptedGame(user.uid, currentPuzzleId)
									.then(() => {
										console.log(
											`[ATTEMPTED] Successfully tracked attempted game: ${currentPuzzleId}`
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
							trackGameAttempted(currentPuzzleId).catch((error) => {
								console.error(
									"[ATTEMPTED] Error tracking game attempted globally:",
									error
								);
							});
						} else if (!wasCompleted && !wasAttempted && !wasAlreadySkipped) {
							// User never interacted - mark as skipped
							skippedPuzzlesRef.current.add(currentPuzzleId);

							// Call addSkippedGame to update user stats
							if (user) {
								addSkippedGame(user.uid, currentPuzzleId).catch((error) => {
									console.error("Error adding skipped game:", error);
								});
							}

							// Track skipped at global game level
							trackGameSkipped(currentPuzzleId).catch((error) => {
								console.error(
									"[SKIPPED] Error tracking game skipped globally:",
									error
								);
							});
						}
					}

					// Update current puzzle
					setCurrentPuzzleId(newPuzzleId);
					setCurrentIndex(newIndex);

					// Calculate startTime for new puzzle based on its elapsed time
					const elapsedTime = puzzleElapsedTimesRef.current[newPuzzleId] || 0;
					const startTime = Date.now() - elapsedTime * 1000;
					puzzleStartTimesRef.current[newPuzzleId] = startTime;

					// Mark when this puzzle became visible (for calculating elapsed time)
					puzzleVisibleTimesRef.current[newPuzzleId] = Date.now();
				}
			}
		},
		[currentPuzzleId, currentIndex]
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

	const itemHeight = Math.max(0, SCREEN_HEIGHT - headerHeight);

	const renderPuzzleCard = ({
		item,
		index,
	}: {
		item: Puzzle;
		index: number;
	}) => {
		// Use stored startTime if available, otherwise calculate it
		// This ensures consistent startTime across renders
		let puzzleStartTime = puzzleStartTimesRef.current[item.id];
		if (!puzzleStartTime) {
			// If not set yet, calculate based on elapsed time
			const elapsedTime = puzzleElapsedTimesRef.current[item.id] || 0;
			puzzleStartTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[item.id] = puzzleStartTime;
		}

		return (
			<View key={item.id} style={[styles.puzzleCard, { height: itemHeight }]}>
				<GameWrapper
					key={item.id}
					puzzle={item}
					onComplete={handleGameComplete}
					onAttempt={handleGameAttempt}
					startTime={puzzleStartTime}
				/>
			</View>
		);
	};

	const renderHeader = () => {
		return (
			<View
				style={styles.header}
				onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
			>
				<Image
					source={require("../assets/images/logo_transparent.png")}
					style={styles.logoImage}
				/>

				<TouchableOpacity
					style={styles.createGameButton}
					onPress={() => router.push("/create-game")}
					activeOpacity={0.7}
				>
					<Ionicons name="add-circle" size={24} color={Colors.accent} />
					<Text style={styles.createGameButtonText}>Create Game</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.profileButton}
					onPress={() => router.push("/profile")}
					activeOpacity={0.7}
				>
					<Ionicons name="person-circle" size={28} color={Colors.accent} />
				</TouchableOpacity>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />

			{/* Header */}
			{renderHeader()}

			{/* Loading state */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
					<Text style={styles.loadingText}>Loading puzzles...</Text>
				</View>
			) : (
				<>
					{/* Puzzle Feed */}
					{displayedPuzzles.length > 0 ? (
						<FlatList
							ref={flatListRef}
							data={displayedPuzzles}
							renderItem={renderPuzzleCard}
							keyExtractor={(item) => item.id}
							pagingEnabled
							showsVerticalScrollIndicator={false}
							onViewableItemsChanged={onViewableItemsChanged}
							viewabilityConfig={viewabilityConfig}
							scrollEventThrottle={16}
							style={styles.feed}
							keyboardDismissMode="on-drag"
							keyboardShouldPersistTaps="handled"
							scrollEnabled={!isKeyboardVisible}
							onEndReached={loadNextBatch}
							onEndReachedThreshold={0.5}
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

					{/* Remove footer rendering */}
				</>
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
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: Layout.margin,
		paddingTop: 60,
		paddingBottom: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
		zIndex: 10,
		...Shadows.medium,
	},
	logoImage: {
		width: 50,
		height: 50,
		resizeMode: "contain",
	},
	createGameButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.tertiary,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.3)",
	},
	createGameButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
		marginLeft: Spacing.xs,
	},
	profileButton: {
		padding: Spacing.xs,
		minWidth: Layout.tapTarget,
		minHeight: Layout.tapTarget,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.3)",
	},
	feed: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	puzzleCard: {
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.primary,
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
	loadingFooter: {
		padding: Spacing.lg,
		alignItems: "center",
		justifyContent: "center",
	},
});

export default FeedScreen;
