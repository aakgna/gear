import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PuzzleType } from "../config/types";
import {
	gameInstructions,
	getDifficultyLabel,
	getDifficultyColor,
} from "../config/gameInstructions";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

interface GameIntroScreenProps {
	gameType: PuzzleType;
	difficulty: number;
	username?: string;
	onPlay: () => void;
}

const GameIntroScreen: React.FC<GameIntroScreenProps> = ({
	gameType,
	difficulty,
	username,
	onPlay,
}) => {
	const [showInstructions, setShowInstructions] = useState(false);

	const instructions = gameInstructions[gameType];
	const difficultyLabel = getDifficultyLabel(difficulty);
	const difficultyColor = getDifficultyColor(difficulty);

	const formatGameType = (type: PuzzleType): string => {
		const formatted = type
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase())
			.trim();

		const specialCases: Record<string, string> = {
			quickMath: "Quick Math",
			wordChain: "Word Chain",
			magicSquare: "Magic Square",
		};

		return specialCases[type] || formatted;
	};

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				bounces={true}
			>
				{/* Game Title */}
				<View style={styles.titleSection}>
					<View
						style={[
							styles.difficultyBadge,
							{
								backgroundColor: difficultyColor + "20",
								borderColor: difficultyColor,
							},
						]}
					>
						<Text style={[styles.difficultyText, { color: difficultyColor }]}>
							{difficultyLabel}
						</Text>
					</View>
					<Text style={styles.gameTitle}>{formatGameType(gameType)}</Text>
					{username && (
						<Text style={styles.createdByText}>created by {username}</Text>
					)}
				</View>

				{/* How to Play Section */}
				<TouchableOpacity
					style={styles.howToPlayButton}
					onPress={() => setShowInstructions(!showInstructions)}
					activeOpacity={0.7}
				>
					<View style={styles.howToPlayHeader}>
						<Ionicons
							name="help-circle-outline"
							size={22}
							color={Colors.accent}
						/>
						<Text style={styles.howToPlayText}>How to Play</Text>
						<Ionicons
							name={showInstructions ? "chevron-up" : "chevron-down"}
							size={20}
							color={Colors.text.secondary}
							style={styles.chevronIcon}
						/>
					</View>
				</TouchableOpacity>

				{/* Instructions Content */}
				{showInstructions && (
					<View style={styles.instructionsContainer}>
						<View style={styles.instructionsContent}>
							{instructions.instructions.map((instruction, index) => (
								<View key={index} style={styles.instructionItem}>
									<View style={styles.instructionNumber}>
										<Text style={styles.instructionNumberText}>
											{index + 1}
										</Text>
									</View>
									<Text style={styles.instructionText}>{instruction}</Text>
								</View>
							))}
							<View style={styles.exampleContainer}>
								<View style={styles.exampleHeader}>
									<Ionicons
										name="bulb-outline"
										size={16}
										color={Colors.accent}
									/>
									<Text style={styles.exampleLabel}>Example</Text>
								</View>
								<Text style={styles.exampleText}>{instructions.example}</Text>
							</View>
						</View>
					</View>
				)}

				{/* Play Button */}
				<TouchableOpacity
					style={styles.playButton}
					onPress={onPlay}
					activeOpacity={0.85}
				>
					<Ionicons name="play" size={28} color={Colors.text.primary} />
					<Text style={styles.playButtonText}>Start Game</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
		width: "100%",
		height: "100%",
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: Spacing.xl,
		paddingTop: Spacing.xl * 2,
		paddingBottom: Spacing.xl * 2,
	},
	titleSection: {
		alignItems: "center",
		marginBottom: Spacing.xl * 1.5,
	},
	difficultyBadge: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.pill,
		borderWidth: 2,
		marginBottom: Spacing.lg,
	},
	difficultyText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 1.5,
	},
	gameTitle: {
		fontSize: Typography.fontSize.h1 * 1.15,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		letterSpacing: -0.8,
	},
	createdByText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.regular,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
		textAlign: "center",
	},
	howToPlayButton: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
	},
	howToPlayHeader: {
		flexDirection: "row",
		alignItems: "center",
	},
	howToPlayText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginLeft: Spacing.sm,
		flex: 1,
	},
	chevronIcon: {
		marginLeft: Spacing.sm,
	},
	instructionsContainer: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.xl,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
	},
	instructionsContent: {
		gap: Spacing.md,
	},
	instructionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.md,
	},
	instructionNumber: {
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: Colors.accent + "30",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
	},
	instructionNumberText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
	},
	instructionText: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: Typography.fontSize.body * 1.5,
	},
	exampleContainer: {
		marginTop: Spacing.sm,
		padding: Spacing.md,
		backgroundColor: Colors.accent + "15",
		borderRadius: BorderRadius.md,
		borderLeftWidth: 4,
		borderLeftColor: Colors.accent,
	},
	exampleHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.sm,
	},
	exampleLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	exampleText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: Typography.fontSize.body * 1.5,
		fontStyle: "italic",
	},
	playButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.xl,
		paddingHorizontal: Spacing.xl,
		marginTop: Spacing.md,
		...Shadows.medium,
		gap: Spacing.sm,
	},
	playButtonText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: 0.5,
	},
});

export default GameIntroScreen;
