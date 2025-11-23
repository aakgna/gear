import React, { useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	Text,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	Puzzle,
	GameResult,
	PuzzleStats as PuzzleStatsType,
} from "../../config/types";
import WordleGame from "./WordleGame";
import QuickMathGame from "./QuickMathGame";
import RiddleGame from "./RiddleGame";
import WordChainGame from "./WordChainGame";
import AliasGame from "./AliasGame";
import ZipGame from "./ZipGame";
import FutoshikiGame from "./FutoshikiGame";
import MagicSquareGame from "./MagicSquareGame";
import HidatoGame from "./HidatoGame";
import SudokuGame from "./SudokuGame";
import PuzzleStats from "../PuzzleStats";
import { getCurrentUser, addCompletedGame } from "../../config/auth";
import { savePuzzleCompletion, fetchPuzzleStats } from "../../config/firebase";
import { Colors, Shadows } from "../../constants/DesignSystem";

interface GameWrapperProps {
	puzzle: Puzzle;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	onSkipped?: () => void;
	startTime?: number;
}

const GameWrapper: React.FC<GameWrapperProps> = ({
	puzzle,
	onComplete,
	onAttempt,
	onSkipped,
	startTime,
}) => {
	const [showStats, setShowStats] = useState(false);
	const [puzzleStats, setPuzzleStats] = useState<PuzzleStatsType | null>(null);
	const [loadingStats, setLoadingStats] = useState(false);
	const [completedResult, setCompletedResult] = useState<GameResult | null>(
		null
	);

	// Enhanced onComplete that also tracks completion and prepares stats
	const handleComplete = async (result: GameResult) => {
		const user = getCurrentUser();
		if (user && result.completed) {
			// Update result with actual puzzle ID
			const updatedResult = {
				...result,
				puzzleId: puzzle.id,
			};

			// Save to user's completed games
			await addCompletedGame(
				user.uid,
				puzzle.id,
				result.timeTaken,
				result.answerRevealed
			);

			// Save puzzle completion to Firestore for stats
			// (skipped if answerRevealed is true)
			await savePuzzleCompletion(
				puzzle.id,
				user.uid,
				result.timeTaken,
				result.attempts,
				result.mistakes,
				result.answerRevealed
			);

			// Store result for stats display (but don't show yet)
			setCompletedResult(updatedResult);
		}

		// Still call the original onComplete callback
		onComplete(result);
	};

	// Handle showing stats when button is clicked
	const handleShowStats = async () => {
		if (!completedResult) return;

		setLoadingStats(true);
		setShowStats(true);
		const stats = await fetchPuzzleStats(puzzle.id);
		setPuzzleStats(stats);
		setLoadingStats(false);
	};
	const renderGame = () => {
		switch (puzzle.type) {
			case "wordle":
				return (
					<WordleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "quickMath":
				return (
					<QuickMathGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "riddle":
				return (
					<RiddleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "wordChain":
				return (
					<WordChainGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "alias":
				return (
					<AliasGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "zip":
				return (
					<ZipGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "futoshiki":
				return (
					<FutoshikiGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "magicSquare":
				return (
					<MagicSquareGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "hidato":
				return (
					<HidatoGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			case "sudoku":
				return (
					<SudokuGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={startTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
					/>
				);
			default:
				return (
					<View style={styles.error}>
						<Text>Unknown game type</Text>
					</View>
				);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={[]}>
			<View style={styles.container}>
				{/* Game Container - scrollable, takes less space when stats are shown */}
				<View
					style={[
						styles.gameContainer,
						showStats && styles.gameContainerWithStats,
					]}
				>
					{renderGame()}
				</View>

				{/* Stats Container - always visible when shown, fixed at bottom */}
				{showStats && completedResult && (
					<View style={styles.statsContainer}>
						<View style={styles.statsHeader}>
							<Text style={styles.statsHeaderText}>Comparison Stats</Text>
							<TouchableOpacity
								onPress={() => setShowStats(false)}
								style={styles.closeButton}
							>
								<Ionicons name="close" size={24} color={Colors.text.primary} />
							</TouchableOpacity>
						</View>
						<ScrollView
							style={styles.statsScrollView}
							contentContainerStyle={styles.statsContent}
							showsVerticalScrollIndicator={true}
						>
							<PuzzleStats
								stats={puzzleStats}
								puzzleType={puzzle.type}
								loading={loadingStats}
								userTime={completedResult.timeTaken}
								userAttempts={completedResult.attempts}
							/>
						</ScrollView>
					</View>
				)}
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
		flexDirection: "column",
	},
	gameContainer: {
		flex: 1,
		overflow: "hidden",
	},
	gameContainerWithStats: {
		flex: 0.55, // Takes 55% when stats are shown
	},
	statsContainer: {
		flex: 0.45, // Takes 45% when shown
		backgroundColor: Colors.background.secondary,
		borderTopWidth: 2,
		borderTopColor: Colors.accent,
		...Shadows.heavy,
	},
	statsHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	statsHeaderText: {
		fontSize: 18,
		fontWeight: "bold",
		color: Colors.text.primary,
	},
	closeButton: {
		padding: 4,
	},
	statsScrollView: {
		flex: 1,
	},
	statsContent: {
		paddingBottom: 20,
	},
	error: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
	},
});

export default GameWrapper;
