import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

interface GameFooterProps {
	// Primary action (Submit/Check)
	onPrimaryAction?: () => void;
	primaryLabel?: string;
	primaryDisabled?: boolean;
	showPrimary?: boolean;

	// Secondary action (Show Answer/Hint)
	onSecondaryAction?: () => void;
	secondaryLabel?: string;
	showSecondary?: boolean;

	// Stats action (View Stats)
	onStatsAction?: () => void;
	showStats?: boolean;

	// Game state
	gameCompleted?: boolean;
	gameWon?: boolean;
}

const GameFooter: React.FC<GameFooterProps> = ({
	onPrimaryAction,
	primaryLabel = "Submit",
	primaryDisabled = false,
	showPrimary = true,
	onSecondaryAction,
	secondaryLabel = "Show Answer",
	showSecondary = true,
	onStatsAction,
	showStats = false,
	gameCompleted = false,
	gameWon = false,
}) => {
	// Don't show primary/secondary when game is completed
	const showActionButtons = !gameCompleted;

	return (
		<View style={styles.container}>
			{showActionButtons && (
				<View style={styles.actionRow}>
					{/* Secondary Action (Show Answer) - Left side, less prominent */}
					{showSecondary && onSecondaryAction && (
						<TouchableOpacity
							style={styles.secondaryButton}
							onPress={onSecondaryAction}
							activeOpacity={0.7}
						>
							<Ionicons
								name="eye-outline"
								size={18}
								color={Colors.text.secondary}
							/>
							<Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
						</TouchableOpacity>
					)}

					{/* Primary Action (Submit/Check) - Right side, prominent */}
					{showPrimary && onPrimaryAction && (
						<TouchableOpacity
							style={[
								styles.primaryButton,
								primaryDisabled && styles.primaryButtonDisabled,
							]}
							onPress={onPrimaryAction}
							activeOpacity={0.7}
							disabled={primaryDisabled}
						>
							<Text
								style={[
									styles.primaryButtonText,
									primaryDisabled && styles.primaryButtonTextDisabled,
								]}
							>
								{primaryLabel}
							</Text>
							<Ionicons
								name="checkmark-circle"
								size={20}
								color={primaryDisabled ? Colors.text.disabled : Colors.text.primary}
							/>
						</TouchableOpacity>
					)}
				</View>
			)}

			{/* Stats Button - shown when game is completed */}
			{showStats && onStatsAction && (
				<TouchableOpacity
					style={styles.statsButton}
					onPress={onStatsAction}
					activeOpacity={0.7}
				>
					<Ionicons
						name="stats-chart"
						size={20}
						color={Colors.text.primary}
					/>
					<Text style={styles.statsButtonText}>View Stats</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		width: "100%",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		gap: Spacing.md,
	},
	actionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: Spacing.md,
	},
	primaryButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.lg,
		gap: Spacing.sm,
		...Shadows.medium,
	},
	primaryButtonDisabled: {
		backgroundColor: Colors.background.tertiary,
		opacity: 0.5,
	},
	primaryButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	primaryButtonTextDisabled: {
		color: Colors.text.disabled,
	},
	secondaryButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "transparent",
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		gap: Spacing.xs,
	},
	secondaryButtonText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	statsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.lg,
		gap: Spacing.sm,
		...Shadows.medium,
	},
	statsButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
});

export default GameFooter;


