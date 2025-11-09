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
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import {
	Puzzle,
	GameResult,
	PuzzleFilter,
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
	const [filter, setFilter] = useState<PuzzleFilter>("all");
	const [headerHeight, setHeaderHeight] = useState(0);
	const [footerHeight, setFooterHeight] = useState(0);
	const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
	const [loading, setLoading] = useState(true);
	const [userData, setUserData] = useState<UserData | null>(null);
	const [puzzleStartTimes, setPuzzleStartTimes] = useState<
		Record<string, number>
	>({});
	const [currentPuzzleId, setCurrentPuzzleId] = useState<string>("");
	const [previousPuzzleId, setPreviousPuzzleId] = useState<string>("");

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

	// Filter puzzles based on selected filter and exclude completed games
	const filteredPuzzles = puzzles.filter((puzzle) => {
		// First check if puzzle matches the selected filter
		let matchesFilter = false;
		switch (filter) {
			case "words":
				matchesFilter = puzzle.type === "wordle" || puzzle.type === "riddle";
				break;
			case "numbers":
				matchesFilter = puzzle.type === "quickMath";
				break;
			case "logic":
				matchesFilter = puzzle.type === "riddle";
				break;
			default:
				matchesFilter = true;
		}

		if (!matchesFilter) return false;

		// Then exclude completed games
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
			const puzzleId = filteredPuzzles[currentIndex].id;
			if (puzzleId !== currentPuzzleId) {
				// Check if user skipped previous puzzle (viewed >= 15 seconds without completing)
				if (previousPuzzleId && previousPuzzleId !== puzzleId) {
					const previousStartTime = puzzleStartTimes[previousPuzzleId];
					if (previousStartTime) {
						const elapsedSeconds = Math.floor(
							(Date.now() - previousStartTime) / 1000
						);
						const wasCompleted =
							userData?.completedGames.includes(previousPuzzleId) || false;

						// If viewed >= 15 seconds and not completed, move puzzle
						if (elapsedSeconds >= 15 && !wasCompleted) {
							movePuzzleAhead(previousPuzzleId, filteredPuzzles);
						}
					}
				}

				setPreviousPuzzleId(currentPuzzleId || "");
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
		filter,
		userData,
		currentPuzzleId,
		previousPuzzleId,
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

	const itemHeight = Math.max(0, SCREEN_HEIGHT - headerHeight - footerHeight);

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
				>
					<Ionicons name="person-circle" size={32} color="#1e88e5" />
				</TouchableOpacity>
			</View>
		);
	};

	const renderFooter = () => {
		return (
			<View
				style={styles.footer}
				onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
			>
				<TouchableOpacity
					style={[styles.filterButton, filter === "all" && styles.activeFilter]}
					onPress={() => setFilter("all")}
				>
					<Text
						style={[
							styles.filterText,
							filter === "all" && styles.activeFilterText,
						]}
					>
						All
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.filterButton,
						filter === "words" && styles.activeFilter,
					]}
					onPress={() => setFilter("words")}
				>
					<Text
						style={[
							styles.filterText,
							filter === "words" && styles.activeFilterText,
						]}
					>
						Words
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.filterButton,
						filter === "numbers" && styles.activeFilter,
					]}
					onPress={() => setFilter("numbers")}
				>
					<Text
						style={[
							styles.filterText,
							filter === "numbers" && styles.activeFilterText,
						]}
					>
						Numbers
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.filterButton,
						filter === "logic" && styles.activeFilter,
					]}
					onPress={() => setFilter("logic")}
				>
					<Text
						style={[
							styles.filterText,
							filter === "logic" && styles.activeFilterText,
						]}
					>
						Logic
					</Text>
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
					<ActivityIndicator size="large" color="#1e88e5" />
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

					{/* Footer */}
					{renderFooter()}
				</>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f7fa",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingTop: 50,
		paddingBottom: 10,
		backgroundColor: "#ffffff",
		zIndex: 10,
	},
	logoContainer: {
		flex: 1,
	},
	logoText: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1e88e5",
	},
	profileButton: {
		padding: 5,
	},
	feed: {
		flex: 1,
	},
	puzzleCard: {
		width: SCREEN_WIDTH,
	},
	footer: {
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
		paddingVertical: 15,
		paddingHorizontal: 20,
		backgroundColor: "#ffffff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
	},
	filterButton: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: "#f5f5f5",
	},
	activeFilter: {
		backgroundColor: "#1e88e5",
	},
	filterText: {
		fontSize: 14,
		color: "#666",
		fontWeight: "500",
	},
	activeFilterText: {
		color: "#ffffff",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#f5f7fa",
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: "#666",
	},
	emptyText: {
		fontSize: 16,
		color: "#666",
		textAlign: "center",
	},
});

export default FeedScreen;
