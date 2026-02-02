import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	Animated,
	TouchableOpacity,
	Modal,
	TouchableWithoutFeedback,
	ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	getGameColor,
} from "../constants/DesignSystem";
import {
	getDifficultyLabel,
	getDifficultyColor,
	gameInstructions,
} from "../config/gameInstructions";
import { PuzzleType } from "../config/types";

interface GameHeaderProps {
	title: string;
	elapsedTime: number;
	difficulty?: number;
	showDifficulty?: boolean;
	subtitle?: string;
	gameType?: PuzzleType;
}

const GameHeader: React.FC<GameHeaderProps> = ({
	title,
	elapsedTime,
	difficulty = 1,
	showDifficulty = true,
	subtitle,
	gameType,
}) => {
	const [showHelp, setShowHelp] = useState(false);
	
	const instructions = gameType ? gameInstructions[gameType] : null;
	const gameColor = gameType ? getGameColor(gameType) : Colors.accent;
	// Animation for entrance
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(-10)).current;

	useEffect(() => {
		Animated.parallel([
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: Animation.duration.normal,
				useNativeDriver: true,
			}),
			Animated.spring(slideAnim, {
				toValue: 0,
				tension: 50,
				friction: 7,
				useNativeDriver: true,
			}),
		]).start();
	}, []);

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

	// Create gradient colors for difficulty badge
	const getDifficultyGradient = (color: string) => {
		return [color, color + "DD"];
	};

	return (
		<>
			<Animated.View
				style={[
					styles.header,
					{
						opacity: fadeAnim,
						transform: [{ translateY: slideAnim }],
					},
				]}
			>
				<View style={styles.headerLeft}>
					<View style={styles.titleRow}>
						<Text style={styles.title}>{title}</Text>
						{gameType && instructions && (
							<TouchableOpacity
								onPress={() => setShowHelp(true)}
								style={styles.helpButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="help-circle-outline"
									size={22}
									color={gameColor}
								/>
							</TouchableOpacity>
						)}
					</View>
					{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
				</View>
				<View style={styles.headerRight}>
					{showDifficulty && (
						<LinearGradient
							colors={getDifficultyGradient(difficultyColor)}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={styles.difficultyBadge}
						>
							<Text style={styles.difficultyText}>{difficultyLabel}</Text>
						</LinearGradient>
					)}
					<LinearGradient
						colors={[Colors.accent + "20", Colors.accent + "10"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.timerBadge}
					>
						<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
					</LinearGradient>
				</View>
			</Animated.View>

			{/* Instructions Modal */}
			{gameType && instructions && (
				<Modal
					visible={showHelp}
					transparent={true}
					animationType="fade"
					onRequestClose={() => setShowHelp(false)}
				>
					<TouchableWithoutFeedback onPress={() => setShowHelp(false)}>
						<View style={styles.modalOverlay}>
							<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
								<View style={styles.helpModal}>
									<View style={styles.helpHeader}>
										<Text style={styles.helpTitle}>How to Play</Text>
										<TouchableOpacity
											onPress={() => setShowHelp(false)}
											style={styles.closeButton}
										>
											<Ionicons
												name="close"
												size={24}
												color={Colors.text.primary}
											/>
										</TouchableOpacity>
									</View>
								<ScrollView
									style={styles.helpScrollView}
									contentContainerStyle={styles.helpContent}
									showsVerticalScrollIndicator={true}
									bounces={true}
									nestedScrollEnabled={true}
								>
										{instructions.instructions.map((instruction, index) => (
											<View key={index} style={styles.instructionItem}>
												<View style={[styles.instructionBullet, { backgroundColor: gameColor }]}>
													<Text style={styles.bulletText}>{index + 1}</Text>
												</View>
												<Text style={styles.instructionText}>
													{instruction}
												</Text>
											</View>
										))}
										<View style={[styles.exampleContainer, { borderLeftColor: gameColor }]}>
											<Text style={[styles.exampleLabel, { color: gameColor }]}>Example</Text>
											<Text style={styles.exampleText}>
												{instructions.example}
											</Text>
										</View>
									</ScrollView>
								</View>
							</TouchableWithoutFeedback>
						</View>
					</TouchableWithoutFeedback>
				</Modal>
			)}
		</>
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
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: Typography.letterSpacing.tight,
	},
	helpButton: {
		padding: Spacing.xs,
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
		overflow: "hidden",
		...Shadows.light,
	},
	difficultyText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: Typography.letterSpacing.wideUppercase,
		color: Colors.text.white,
	},
	timerBadge: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
		overflow: "hidden",
		...Shadows.glowAccent,
	},
	timer: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	helpModal: {
		width: "85%",
		maxHeight: "75%",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		...Shadows.medium,
	},
	helpHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	helpTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	helpScrollView: {
		flexGrow: 1,
		flexShrink: 1,
	},
	helpContent: {
		padding: Spacing.lg,
		paddingTop: Spacing.md,
		gap: Spacing.md,
	},
	instructionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.sm,
	},
	instructionBullet: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
	},
	bulletText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	instructionText: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: 22,
	},
	exampleContainer: {
		marginTop: Spacing.md,
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderLeftWidth: 3,
		borderLeftColor: Colors.accent,
	},
	exampleLabel: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.xs,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	exampleText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		lineHeight: 20,
	},
});

export default React.memo(GameHeader);
