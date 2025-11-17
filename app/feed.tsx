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
} from "../config/firebase";
import {
	getCurrentUser,
	getUserData,
	UserData,
	addSkippedGame,
	addAttemptedGame,
	moveFromSkippedToAttempted,
} from "../config/auth";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const FeedScreen = () => {
	const router = useRouter();
	const flatListRef = useRef<FlatList>(null);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [headerHeight, setHeaderHeight] = useState(0);
	const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
	const [loading, setLoading] = useState(true);
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
	// Track keyboard state to disable FlatList scrolling when keyboard is visible
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const keyboardHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
			const data = await getUserData(user.uid);
			setUserData(data);
			// Store initial completed games for filtering on load only (only on initial load)
			if (isInitialLoad && data?.completedGames) {
				initialCompletedGamesRef.current = new Set(data.completedGames);
				// Also initialize completed puzzles ref to track during session
				completedPuzzlesRef.current = new Set(data.completedGames);
			}
			// Initialize skipped puzzles set from user data
			if (isInitialLoad && data?.skippedGames) {
				skippedPuzzlesRef.current = new Set(data.skippedGames);
			}
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
			}

			setPuzzles(allPuzzles);
			// Initialize elapsed times for all puzzles to 0
			const initialElapsedTimes: Record<string, number> = {};
			allPuzzles.forEach((puzzle) => {
				initialElapsedTimes[puzzle.id] = 0;
			});
			puzzleElapsedTimesRef.current = initialElapsedTimes;
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

	// Filter puzzles: only exclude completed games that were completed before app start
	// This allows completed games to show during the session
	const filteredPuzzles = puzzles.filter((puzzle) => {
		// Only exclude if it was in the initial completed games list
		if (initialCompletedGamesRef.current.has(puzzle.id)) {
			return false;
		}
		return true;
	});

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
		if (filteredPuzzles.length > 0 && !currentPuzzleId) {
			const firstPuzzleId = filteredPuzzles[0].id;
			setCurrentPuzzleId(firstPuzzleId);
			setCurrentIndex(0);
			// Calculate startTime for first puzzle (elapsed time is 0, so startTime is now)
			const elapsedTime = puzzleElapsedTimesRef.current[firstPuzzleId] || 0;
			const startTime = Date.now() - elapsedTime * 1000;
			puzzleStartTimesRef.current[firstPuzzleId] = startTime;
			// Mark when first puzzle became visible
			puzzleVisibleTimesRef.current[firstPuzzleId] = Date.now();
		}
	}, [filteredPuzzles, currentPuzzleId]);

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

			// Track completed at global game level
			trackGameCompleted(result.puzzleId).catch((error) => {
				console.error(
					"[COMPLETED] Error tracking game completed globally:",
					error
				);
			});
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
					{filteredPuzzles.length > 0 ? (
						<FlatList
							ref={flatListRef}
							data={filteredPuzzles}
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
});

export default FeedScreen;
