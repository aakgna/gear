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

	let attemptComparison: string | null = null;
	if (
		puzzleType === "wordle" ||
		puzzleType === "riddle" ||
		puzzleType === "wordChain"
	) {
		if (userAttempts !== undefined && stats.averageAttempts !== undefined) {
			if (userAttempts < stats.averageAttempts) {
				attemptComparison = `Better than average (${stats.averageAttempts} tries)`;
			} else if (userAttempts > stats.averageAttempts) {
				attemptComparison = `More than average (${stats.averageAttempts} tries)`;
			} else {
				attemptComparison = `Average (${stats.averageAttempts} tries)`;
			}
			if (
				stats.bestAttempts !== undefined &&
				userAttempts === stats.bestAttempts
			) {
				attemptComparison = `Best score! 🏆`;
			}
		}
	}

	let mistakeComparison: string | null = null;
	if (puzzleType === "quickMath") {
		if (userMistakes !== undefined && stats.averageMistakes !== undefined) {
			if (userMistakes < stats.averageMistakes) {
				mistakeComparison = `Fewer mistakes than average (${stats.averageMistakes})`;
			} else if (userMistakes > stats.averageMistakes) {
				mistakeComparison = `More mistakes than average (${stats.averageMistakes})`;
			} else {
				mistakeComparison = `Average mistakes (${stats.averageMistakes})`;
			}
			if (
				stats.bestMistakes !== undefined &&
				userMistakes === stats.bestMistakes
			) {
				mistakeComparison = `Perfect! No mistakes! 🏆`;
			}
		}
	}

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

			{/* Attempts Stats (Wordle/Riddle/WordChain) */}
			{(puzzleType === "wordle" ||
				puzzleType === "riddle" ||
				puzzleType === "wordChain") &&
				stats.averageAttempts !== undefined && (
					<View style={styles.statCard}>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Your Attempts</Text>
							<Text
								style={[
									styles.statValue,
									userAttempts === stats.bestAttempts && styles.bestValue,
									userAttempts !== undefined &&
										stats.averageAttempts !== undefined &&
										userAttempts < stats.averageAttempts &&
										styles.goodValue,
								]}
							>
								{userAttempts}
								{userAttempts === stats.bestAttempts && " 🏆"}
							</Text>
						</View>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Average Attempts</Text>
							<Text style={styles.statValue}>{stats.averageAttempts}</Text>
						</View>
						<View style={styles.statRow}>
							<Text style={styles.statLabel}>Best</Text>
							<Text style={[styles.statValue, styles.bestValue]}>
								{stats.bestAttempts} tries
							</Text>
						</View>
						{attemptComparison && (
							<Text style={styles.comparisonText}>{attemptComparison}</Text>
						)}
					</View>
				)}

			{/* Mistakes Stats (QuickMath) */}
			{puzzleType === "quickMath" && stats.averageMistakes !== undefined && (
				<View style={styles.statCard}>
					<View style={styles.statRow}>
						<Text style={styles.statLabel}>Your Mistakes</Text>
						<Text
							style={[
								styles.statValue,
								userMistakes === stats.bestMistakes && styles.bestValue,
								userMistakes !== undefined &&
									stats.averageMistakes !== undefined &&
									userMistakes < stats.averageMistakes &&
									styles.goodValue,
							]}
						>
							{userMistakes}
							{userMistakes === stats.bestMistakes && " 🏆"}
						</Text>
					</View>
					<View style={styles.statRow}>
						<Text style={styles.statLabel}>Average Mistakes</Text>
						<Text style={styles.statValue}>{stats.averageMistakes}</Text>
					</View>
					<View style={styles.statRow}>
						<Text style={styles.statLabel}>Best</Text>
						<Text style={[styles.statValue, styles.bestValue]}>
							{stats.bestMistakes === 0
								? "Perfect!"
								: `${stats.bestMistakes} mistakes`}
						</Text>
					</View>
					{mistakeComparison && (
						<Text style={styles.comparisonText}>{mistakeComparison}</Text>
					)}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: Spacing.xl,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.xl,
		marginTop: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
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
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.md,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
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
