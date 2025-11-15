import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	FlatList,
	StyleSheet,
	Dimensions,
	TouchableOpacity,
	Text,
	Alert,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
	Animated,
	Image,
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
} from "../config/types";
import GameWrapper from "../components/games/GameWrapper";
import { useGameStore } from "../stores/gameStore";
import { fetchGamesFromFirestore, FirestoreGame } from "../config/firebase";
import { getCurrentUser, getUserData, UserData } from "../config/auth";

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

	const { addCompletedPuzzle } = useGameStore();

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
					// Save elapsed time for current puzzle before switching away
					if (
						currentPuzzleId &&
						puzzleVisibleTimesRef.current[currentPuzzleId]
					) {
						const timeVisible =
							Date.now() - puzzleVisibleTimesRef.current[currentPuzzleId];
						const additionalElapsed = Math.floor(timeVisible / 1000);
						// Add to existing elapsed time
						puzzleElapsedTimesRef.current[currentPuzzleId] =
							(puzzleElapsedTimesRef.current[currentPuzzleId] || 0) +
							additionalElapsed;
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

	const handleGameComplete = async (result: GameResult) => {
		addCompletedPuzzle(result);

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
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : undefined}
						style={{ flex: 1 }}
					>
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
							/>
						) : (
							<View style={styles.loadingContainer}>
								<Text style={styles.emptyText}>No puzzles available</Text>
							</View>
						)}
					</KeyboardAvoidingView>

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
