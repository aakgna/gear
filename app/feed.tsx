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

	// Function to move a puzzle at least 15 positions ahead or to the end
	const movePuzzleAhead = useCallback(
		(puzzleIdToMove: string, currentFilteredPuzzles: Puzzle[]) => {
			setPuzzles((prevPuzzles) => {
				// Find the puzzle's position in the filtered list
				const filteredIndex = currentFilteredPuzzles.findIndex(
					(p) => p.id === puzzleIdToMove
				);
				if (filteredIndex === -1) return prevPuzzles;

				const puzzleIndex = prevPuzzles.findIndex(
					(p) => p.id === puzzleIdToMove
				);
				if (puzzleIndex === -1) return prevPuzzles;

				const puzzle = prevPuzzles[puzzleIndex];
				const newPuzzles = [...prevPuzzles];
				newPuzzles.splice(puzzleIndex, 1); // Remove from current position

				// Calculate target position (at least 15 ahead in filtered list, or end)
				const targetFilteredIndex = filteredIndex + 15;

				if (targetFilteredIndex >= currentFilteredPuzzles.length) {
					// Move to end of the full puzzles array
					newPuzzles.push(puzzle);
				} else {
					// Find the puzzle at the target filtered position and insert after it
					const targetPuzzleId = currentFilteredPuzzles[targetFilteredIndex].id;
					const targetPuzzleIndex = newPuzzles.findIndex(
						(p) => p.id === targetPuzzleId
					);
					if (targetPuzzleIndex !== -1) {
						// Insert after the target puzzle
						newPuzzles.splice(targetPuzzleIndex + 1, 0, puzzle);
					} else {
						// Fallback: add to end
						newPuzzles.push(puzzle);
					}
				}

				return newPuzzles;
			});
		},
		[]
	);

	// Reset timer when current puzzle changes and handle puzzle skipping
	useEffect(() => {
		if (filteredPuzzles.length > 0 && filteredPuzzles[currentIndex]) {
			console.log("filtered");
			const puzzleId = filteredPuzzles[currentIndex].id;
			if (puzzleId !== currentPuzzleId) {
				// Check if user skipped the puzzle they just left (currentPuzzleId)
				console.log("checking puzzle we just left:", currentPuzzleId);
				if (currentPuzzleId) {
					const previousStartTime = puzzleStartTimes[currentPuzzleId];
					if (previousStartTime) {
						const elapsedSeconds = Math.floor(
							(Date.now() - previousStartTime) / 1000
						);
						const wasCompleted =
							userData?.completedGames.includes(currentPuzzleId) || false;

						// If viewed >= 2 seconds and not completed, move puzzle
						console.log("elapsedSeconds", elapsedSeconds);
						if (elapsedSeconds >= 2 && !wasCompleted) {
							console.log("moving puzzle ahead:", currentPuzzleId);
							movePuzzleAhead(currentPuzzleId, filteredPuzzles);
						}
					}
				}

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
		movePuzzleAhead,
	]);

	const handleGameComplete = async (result: GameResult) => {
		addCompletedPuzzle(result);

		// Reload user data to get updated completed games list
		await loadUserData();

		// Don't show alert or auto-navigate - let user stay on completed game
		// and manually swipe to next game
	};

	const handleScroll = (event: any) => {
		const offsetY = event.nativeEvent.contentOffset.y;
		const index = Math.round(offsetY / SCREEN_HEIGHT);
		setCurrentIndex(index);
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
					<Ionicons name="person-circle" size={32} color={Colors.accent} />
				</TouchableOpacity>
			</View>
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
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: Layout.margin,
		paddingTop: 50,
		paddingBottom: Spacing.sm,
		backgroundColor: Colors.background.primary,
		zIndex: 10,
		shadowColor: Shadows.light.shadowColor,
		shadowOffset: Shadows.light.shadowOffset,
		shadowOpacity: Shadows.light.shadowOpacity,
		shadowRadius: Shadows.light.shadowRadius,
		elevation: Shadows.light.elevation,
	},
	logoContainer: {
		flex: 1,
	},
	logoText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
	},
	profileButton: {
		padding: Spacing.xs,
		minWidth: Layout.tapTarget,
		minHeight: Layout.tapTarget,
		justifyContent: "center",
		alignItems: "center",
	},
	feed: {
		flex: 1,
	},
	puzzleCard: {
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.primary,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
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
