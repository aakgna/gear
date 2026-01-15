import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
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
				<Text style={styles.title}>{title}</Text>
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
		letterSpacing: Typography.letterSpacing.tight,
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
});

export default React.memo(GameHeader);
