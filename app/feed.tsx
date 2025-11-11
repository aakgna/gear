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
	const [puzzleStartTimes, setPuzzleStartTimes] = useState<
		Record<string, number>
	>({});
	const [currentPuzzleId, setCurrentPuzzleId] = useState<string>("");
	const isResettingRef = useRef(false);
	const [scrollEnabled, setScrollEnabled] = useState(true);

	const { addCompletedPuzzle } = useGameStore();

	// Load user data and puzzles from Firestore
	useEffect(() => {
		loadUserData();
		loadPuzzlesFromFirestore();
	}, []);

	const loadUserData = async () => {
		const user = getCurrentUser();
		if (user) {
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

				// Fetch Riddle (only easy and hard based on Firestore structure)
				if (difficulty !== "medium") {
					const riddleGames = await fetchGamesFromFirestore(
						"riddle",
						difficulty
					);
					riddleGames.forEach((game) => {
						if (game.question && game.answer) {
							allPuzzles.push({
								id: `riddle_${difficulty}_${game.id}`,
								type: "riddle",
								data: {
									prompt: game.question,
									answer: game.answer,
								} as RiddleData,
								difficulty: difficulty === "easy" ? 1 : 3,
								createdAt: new Date().toISOString(),
							});
						}
					});
				}
			}

			setPuzzles(allPuzzles);
			// Initialize timer for first puzzle
			if (allPuzzles.length > 0) {
				const firstPuzzleId = allPuzzles[0].id;
				setCurrentPuzzleId(firstPuzzleId);
				setPuzzleStartTimes({ [firstPuzzleId]: Date.now() });
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

	// Simplify filteredPuzzles - only exclude completed games
	const filteredPuzzles = puzzles.filter((puzzle) => {
		// Exclude completed games
		if (userData?.completedGames.includes(puzzle.id)) {
			return false;
		}
		return true;
	});

	// Function to move a skipped puzzle to a random position between index 4 and the end
	const movePuzzleAhead = useCallback(
		(puzzleIdToMove: string, currentFilteredPuzzles: Puzzle[]) => {
			isResettingRef.current = true;

			setPuzzles((prevPuzzles) => {
				const puzzleIndex = prevPuzzles.findIndex(
					(p) => p.id === puzzleIdToMove
				);
				if (puzzleIndex === -1) {
					isResettingRef.current = false;
					return prevPuzzles;
				}

				const puzzle = prevPuzzles[puzzleIndex];
				const newPuzzles = [...prevPuzzles];
				newPuzzles.splice(puzzleIndex, 1); // Remove from current position

				// Calculate random position between index 4 and end
				// If there are less than 5 puzzles, move to end
				const minIndex = Math.min(4, newPuzzles.length);
				const maxIndex = newPuzzles.length;
				const randomIndex = Math.floor(
					Math.random() * (maxIndex - minIndex) + minIndex
				);

				// Insert at random position
				newPuzzles.splice(randomIndex, 0, puzzle);

				// Reset flag after state update
				setTimeout(() => {
					isResettingRef.current = false;
				}, 0);

				return newPuzzles;
			});

			// Ensure scroll stays at 0
			requestAnimationFrame(() => {
				flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
			});
		},
		[]
	);

	// Reset timer when current puzzle changes
	useEffect(() => {
		if (
			filteredPuzzles.length > 0 &&
			filteredPuzzles[currentIndex] &&
			!isResettingRef.current
		) {
			const puzzleId = filteredPuzzles[currentIndex].id;
			if (puzzleId !== currentPuzzleId) {
				setCurrentPuzzleId(puzzleId);
				setPuzzleStartTimes((prev) => ({
					...prev,
					[puzzleId]: Date.now(),
				}));
			}
		}
	}, [
		currentIndex,
		puzzles,
		userData,
		currentPuzzleId,
		puzzleStartTimes,
		filteredPuzzles,
	]);

	const handleGameComplete = async (result: GameResult) => {
		addCompletedPuzzle(result);

		// Reload user data to get updated completed games list
		await loadUserData();

		// Don't show alert or auto-navigate - let user stay on completed game
		// and manually swipe to next game
	};

	const handleScrollBeginDrag = (event: any) => {
		// When user starts dragging down from index 0, they're skipping
		if (currentIndex === 0 && !isResettingRef.current) {
			const skippedPuzzleId = filteredPuzzles[0]?.id;
			if (skippedPuzzleId && skippedPuzzleId === currentPuzzleId) {
				const wasCompleted =
					userData?.completedGames.includes(skippedPuzzleId) || false;

				// If not completed, move puzzle immediately and prevent scroll
				if (!wasCompleted) {
					setScrollEnabled(false);
					movePuzzleAhead(skippedPuzzleId, filteredPuzzles);
					// Re-enable scrolling after puzzle moves
					setTimeout(() => {
						setScrollEnabled(true);
					}, 50);
				}
			}
		}
	};

	const handleScroll = (event: any) => {
		// Don't allow scrolling if we're resetting or scroll is disabled
		if (isResettingRef.current || !scrollEnabled) {
			// Keep scroll locked at 0
			flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
			return;
		}

		const offsetY = event.nativeEvent.contentOffset.y;

		// Always keep scroll at 0 - immediately reset any scroll
		if (offsetY > 0) {
			flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
		}
	};

	const itemHeight = Math.max(0, SCREEN_HEIGHT - headerHeight);

	const renderPuzzleCard = ({
		item,
		index,
	}: {
		item: Puzzle;
		index: number;
	}) => {
		// Get or create start time for this puzzle
		const puzzleStartTime = puzzleStartTimes[item.id] || Date.now();

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
				<View style={styles.logoContainer}>
					<Text style={styles.logoText}>⚙️ GEAR</Text>
				</View>

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
								onScroll={handleScroll}
								onScrollBeginDrag={handleScrollBeginDrag}
								scrollEventThrottle={16}
								style={styles.feed}
								keyboardDismissMode="on-drag"
								keyboardShouldPersistTaps="handled"
								scrollEnabled={scrollEnabled}
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
		paddingTop: 50,
		paddingBottom: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
		zIndex: 10,
		...Shadows.medium,
	},
	logoContainer: {
		flex: 1,
	},
	logoText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: -0.5,
		textShadowColor: Colors.accent,
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 8,
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
