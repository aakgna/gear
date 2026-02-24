import React, { useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Gradients,
	Animation,
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
	// Animation refs for button press feedback
	const primaryScale = useRef(new Animated.Value(1)).current;
	const secondaryScale = useRef(new Animated.Value(1)).current;
	const statsScale = useRef(new Animated.Value(1)).current;

	// Don't show primary/secondary when game is completed
	const showActionButtons = !gameCompleted;

	// Animated press handler
	const handlePress = (scaleAnim: Animated.Value, callback?: () => void) => {
		Animated.sequence([
			Animated.spring(scaleAnim, {
				toValue: 0.95,
				useNativeDriver: true,
				tension: 300,
				friction: 10,
			}),
			Animated.spring(scaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 300,
				friction: 10,
			}),
		]).start();
		if (callback) {
			callback();
		}
	};

	return (
		<View style={styles.container}>
			{showActionButtons && (
				<View style={styles.actionRow}>
					{/* Secondary Action (Show Answer) - Left side, less prominent */}
					{showSecondary && onSecondaryAction && (
						<Animated.View style={{ transform: [{ scale: secondaryScale }] }}>
							<TouchableOpacity
								style={styles.secondaryButton}
								onPress={() => handlePress(secondaryScale, onSecondaryAction)}
								activeOpacity={0.8}
							>
								<Ionicons
									name="eye-outline"
									size={18}
									color={Colors.text.secondary}
								/>
								<Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
							</TouchableOpacity>
						</Animated.View>
					)}

					{/* Primary Action (Submit/Check) - Right side, prominent with gradient */}
					{showPrimary && onPrimaryAction && (
						<Animated.View
							style={[
								{ transform: [{ scale: primaryScale }] },
								primaryDisabled && { opacity: 0.5 },
							]}
						>
							<TouchableOpacity
								onPress={() => handlePress(primaryScale, onPrimaryAction)}
								activeOpacity={0.8}
								disabled={primaryDisabled}
							>
								<LinearGradient
									colors={
										primaryDisabled ? ["#9CA3AF", "#6B7280"] : Gradients.button
									}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									style={styles.primaryButton}
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
										color={
											primaryDisabled ? Colors.text.disabled : Colors.text.white
										}
									/>
								</LinearGradient>
							</TouchableOpacity>
						</Animated.View>
					)}
				</View>
			)}

			{/* Stats Button - shown when game is completed with gradient */}
			{showStats && onStatsAction && (
				<Animated.View style={{ transform: [{ scale: statsScale }] }}>
					<TouchableOpacity
						onPress={() => handlePress(statsScale, onStatsAction)}
						activeOpacity={0.8}
					>
						<LinearGradient
							colors={Gradients.button}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={styles.statsButton}
						>
							<Ionicons
								name="stats-chart"
								size={20}
								color={Colors.text.white}
							/>
							<Text style={styles.statsButtonText}>View Stats</Text>
						</LinearGradient>
					</TouchableOpacity>
				</Animated.View>
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
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
		borderBottomWidth: 0,
		borderTopWidth: 0,
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
		paddingVertical: Spacing.buttonPadding,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.lg,
		gap: Spacing.sm,
		overflow: "hidden",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	primaryButtonDisabled: {
		opacity: 0.5,
	},
	primaryButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	primaryButtonTextDisabled: {
		color: Colors.text.disabled,
	},
	secondaryButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "transparent",
		paddingVertical: Spacing.buttonPadding,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.lg,
		borderWidth: 1,
		borderColor: Colors.border,
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
		paddingVertical: Spacing.buttonPadding,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.lg,
		gap: Spacing.sm,
		overflow: "hidden",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	statsButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
});

export default React.memo(GameFooter);
