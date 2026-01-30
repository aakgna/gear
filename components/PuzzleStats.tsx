import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { PuzzleStats as PuzzleStatsType, PuzzleType } from "../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

interface PuzzleStatsProps {
	stats: PuzzleStatsType | null;
	puzzleType: PuzzleType;
	loading?: boolean;
	userTime: number;
	userAttempts?: number;
	userMistakes?: number;
}

const PuzzleStats: React.FC<PuzzleStatsProps> = ({
	stats,
	puzzleType,
	loading,
	userTime,
	userAttempts,
	userMistakes,
}) => {
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<ActivityIndicator size="small" color={Colors.accent} />
				<Text style={styles.loadingText}>Loading stats...</Text>
			</View>
		);
	}

	if (!stats) {
		return (
			<View style={styles.container}>
				<Text style={styles.noStatsText}>
					You're the first to complete this puzzle! 🎉
				</Text>
			</View>
		);
	}

	const isFasterThanAverage = userTime < stats.averageTime;
	const isSlowerThanAverage = userTime > stats.averageTime;
	const isBestTime = userTime === stats.fastestTime;

	// Check if user achieved best attempts (lowest tries)
	const isBestAttempts =
		userAttempts !== undefined &&
		stats.bestAttempts !== undefined &&
		userAttempts === stats.bestAttempts;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>How You Compare</Text>
			<Text style={styles.subtitle}>
				{stats.totalCompletions}{" "}
				{stats.totalCompletions === 1 ? "person" : "people"} completed this
				puzzle
			</Text>

			{/* Time Stats */}
			<View style={styles.statCard}>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>Your Time</Text>
					<Text
						style={[
							styles.statValue,
							isBestTime && styles.bestValue,
							isFasterThanAverage && !isBestTime && styles.goodValue,
							isSlowerThanAverage && styles.averageValue,
						]}
					>
						{formatTime(userTime)}
						{isBestTime && " 🏆"}
					</Text>
				</View>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>Average Time</Text>
					<Text style={styles.statValue}>{formatTime(stats.averageTime)}</Text>
				</View>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>Fastest</Text>
					<Text style={[styles.statValue, styles.bestValue]}>
						{formatTime(stats.fastestTime)}
					</Text>
				</View>
			</View>

			{/* Trivia Score Stats */}
			{puzzleType === "trivia" &&
				userAttempts !== undefined &&
				userMistakes !== undefined &&
				stats.bestAttempts !== undefined && (
					<View style={styles.statCard}>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Your Score</Text>
							<Text
								style={[
									styles.statValue,
									isBestAttempts && styles.bestValue,
									!isBestAttempts &&
										userAttempts >= stats.bestAttempts &&
										styles.goodValue,
								]}
							>
								{userAttempts}/{userAttempts + userMistakes}
								{isBestAttempts && " 🏆"}
							</Text>
						</View>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Best Score</Text>
							<Text style={[styles.statValue, styles.bestValue]}>
								{stats.bestAttempts}/{userAttempts + userMistakes}
							</Text>
						</View>
						{isBestAttempts && (
							<Text style={styles.comparisonText}>
								Perfect! You matched the best score! 🏆
							</Text>
						)}
						{!isBestAttempts && userAttempts >= stats.bestAttempts && (
							<Text style={styles.comparisonText}>
								Great job! Close to perfect!
							</Text>
						)}
					</View>
				)}

		{/* Attempts Stats (WordForm/Riddle/WordChain/Inference/Maze/CodeBreaker/Sequencing) */}
		{(puzzleType === "wordform" ||
			puzzleType === "riddle" ||
			puzzleType === "wordChain" ||
			puzzleType === "inference" ||
			puzzleType === "maze" ||
			puzzleType === "codebreaker" ||
			puzzleType === "sequencing") &&
			userAttempts !== undefined &&
			stats.bestAttempts !== undefined && (
					<View style={styles.statCard}>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Your Tries</Text>
							<Text
								style={[
									styles.statValue,
									isBestAttempts && styles.bestValue,
									!isBestAttempts &&
										userAttempts < stats.bestAttempts &&
										styles.goodValue,
								]}
							>
								{userAttempts}
								{isBestAttempts && " 🏆"}
							</Text>
						</View>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Best (Fewest Tries)</Text>
							<Text style={[styles.statValue, styles.bestValue]}>
								{stats.bestAttempts}
							</Text>
						</View>
						{isBestAttempts && (
							<Text style={styles.comparisonText}>
								You matched the best score! 🏆
							</Text>
						)}
						{!isBestAttempts && userAttempts < stats.bestAttempts && (
							<Text style={styles.comparisonText}>
								Great job! Close to the best!
							</Text>
						)}
					</View>
				)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: Spacing.xl,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		marginTop: Spacing.lg,
		borderWidth: 0,
		borderColor: "transparent",
		...Shadows.medium,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
		textAlign: "center",
	},
	subtitle: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.lg,
		textAlign: "center",
	},
	statCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.md,
		borderWidth: 0,
		borderColor: "transparent",
		...Shadows.light,
	},
	statRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	statLabel: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	statValue: {
		fontSize: Typography.fontSize.h3,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
		fontFamily: Typography.fontFamily.monospace,
	},
	bestValue: {
		color: Colors.game.correct,
	},
	goodValue: {
		color: Colors.accent,
	},
	averageValue: {
		color: Colors.text.secondary,
	},
	comparisonText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.accent,
		textAlign: "center",
		marginTop: Spacing.sm,
		fontWeight: Typography.fontWeight.medium,
	},
	loadingText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.sm,
		textAlign: "center",
	},
	noStatsText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.medium,
	},
});

export default PuzzleStats;
