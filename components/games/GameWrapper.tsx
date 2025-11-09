import React, { useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Puzzle, GameResult } from "../../config/types";
import WordleGame from "./WordleGame";
import QuickMathGame from "./QuickMathGame";
import RiddleGame from "./RiddleGame";
import {
	getCurrentUser,
	addSeenGame,
	addCompletedGame,
} from "../../config/auth";

interface GameWrapperProps {
	puzzle: Puzzle;
	onComplete: (result: GameResult) => void;
	onSkipped?: () => void;
	startTime?: number;
}

const GameWrapper: React.FC<GameWrapperProps> = ({
	puzzle,
	onComplete,
	onSkipped,
	startTime,
}) => {
	// Track when game is seen
	useEffect(() => {
		const trackSeenGame = async () => {
			const user = getCurrentUser();
			if (user) {
				await addSeenGame(user.uid, puzzle.id);
			}
		};
		trackSeenGame();
	}, [puzzle.id]);

	// Enhanced onComplete that also tracks completion
	const handleComplete = async (result: GameResult) => {
		const user = getCurrentUser();
		if (user) {
			await addCompletedGame(user.uid, puzzle.id);
		}
		onComplete(result);
	};
	const renderGame = () => {
		switch (puzzle.type) {
			case "wordle":
				return (
					<WordleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						startTime={startTime}
					/>
				);
			case "quickMath":
				return (
					<QuickMathGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						startTime={startTime}
					/>
				);
			case "riddle":
				return (
					<RiddleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						startTime={startTime}
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
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				{renderGame()}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#f5f7fa",
	},
	container: {
		flex: 1,
		backgroundColor: "#f5f7fa",
	},
	error: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
});

export default GameWrapper;
