import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
} from "../constants/DesignSystem";
import {
	getDifficultyLabel,
	getDifficultyColor,
} from "../config/gameInstructions";
import { PuzzleType } from "../config/types";

interface GameHeaderProps {
	title: string;
	elapsedTime: number;
	difficulty?: number;
	showDifficulty?: boolean;
	subtitle?: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({
	title,
	elapsedTime,
	difficulty = 1,
	showDifficulty = true,
	subtitle,
}) => {
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const difficultyLabel = getDifficultyLabel(difficulty);
	const difficultyColor = getDifficultyColor(difficulty);

	return (
		<View style={styles.header}>
			<View style={styles.headerLeft}>
				<Text style={styles.title}>{title}</Text>
				{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
			</View>
			<View style={styles.headerRight}>
				{showDifficulty && (
					<View
						style={[
							styles.difficultyBadge,
							{
								backgroundColor: difficultyColor + "20",
								borderColor: difficultyColor + "60",
							},
						]}
					>
						<Text style={[styles.difficultyText, { color: difficultyColor }]}>
							{difficultyLabel}
						</Text>
					</View>
				)}
				<View style={styles.timerBadge}>
					<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.sm,
	},
	headerLeft: {
		flex: 1,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: -0.5,
	},
	subtitle: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	difficultyBadge: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
	},
	difficultyText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	timerBadge: {
		backgroundColor: Colors.accent + "20",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
	},
	timer: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
});

export default GameHeader;


