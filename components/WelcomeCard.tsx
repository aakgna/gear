import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
} from "../constants/DesignSystem";

interface WelcomeCardProps {
	height: number;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ height }) => {
	const swipeUpAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		// Create a continuous loop animation for swipe up indicator
		const animate = () => {
			Animated.sequence([
				Animated.timing(swipeUpAnim, {
					toValue: 1,
					duration: 1000,
					useNativeDriver: true,
				}),
				Animated.timing(swipeUpAnim, {
					toValue: 0,
					duration: 1000,
					useNativeDriver: true,
				}),
			]).start(() => animate());
		};
		animate();
	}, []);

	const translateY = swipeUpAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 10],
	});

	const opacity = swipeUpAnim.interpolate({
		inputRange: [0, 0.5, 1],
		outputRange: [0.7, 1, 0.7],
	});

	return (
		<View style={[styles.container, { height }]}>
			<View style={styles.content}>
				{/* Large circular icon with lightning bolt */}
				<View style={styles.iconContainer}>
					<View style={styles.iconCircle}>
						<Ionicons
							name="flash"
							size={64}
							color={Colors.accent}
						/>
					</View>
				</View>

				{/* Main heading */}
				<Text style={styles.heading}>Ready to challenge your brain?</Text>

				{/* Subheading */}
				<Text style={styles.subheading}>
					Swipe through puzzles, compete with friends, and sharpen your mind!
				</Text>

				{/* Features list */}
				<View style={styles.featuresContainer}>
					<View style={styles.featureItem}>
						<Ionicons
							name="game-controller"
							size={20}
							color={Colors.accent}
							style={styles.featureIcon}
						/>
						<Text style={styles.featureText}>13+ puzzle types</Text>
					</View>

					<View style={styles.featureItem}>
						<Ionicons
							name="trophy"
							size={20}
							color={Colors.accent}
							style={styles.featureIcon}
						/>
						<Text style={styles.featureText}>Track your progress</Text>
					</View>

					<View style={styles.featureItem}>
						<Ionicons
							name="people"
							size={20}
							color={Colors.accent}
							style={styles.featureIcon}
						/>
						<Text style={styles.featureText}>Challenge friends</Text>
					</View>
				</View>

				{/* Swipe up animation */}
				<Animated.View
					style={[
						styles.swipeUpContainer,
						{
							transform: [{ translateY }],
							opacity,
						},
					]}
				>
					<Ionicons
						name="chevron-up"
						size={24}
						color={Colors.accent}
						style={styles.swipeUpIcon}
					/>
					<Text style={styles.swipeUpText}>Swipe up</Text>
				</Animated.View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		width: "100%",
		backgroundColor: Colors.background.primary,
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xl,
		flex: 1,
	},
	iconContainer: {
		marginBottom: Spacing.xl,
		alignItems: "center",
	},
	iconCircle: {
		width: 120,
		height: 120,
		borderRadius: 60,
		backgroundColor: Colors.accent + "20", // 20% opacity
		justifyContent: "center",
		alignItems: "center",
	},
	heading: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		marginBottom: Spacing.md,
	},
	subheading: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
		marginBottom: Spacing.xl,
		lineHeight: Typography.fontSize.body * Typography.lineHeight.normal,
		paddingHorizontal: Spacing.lg,
	},
	featuresContainer: {
		alignItems: "center",
		marginBottom: Spacing.xl,
		maxWidth: "80%",
	},
	featureItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
		justifyContent: "flex-start",
		width: "100%",
	},
	featureIcon: {
		marginRight: Spacing.sm,
		width: 24, // Fixed width to ensure icons align
	},
	featureText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	swipeUpContainer: {
		alignItems: "center",
		marginTop: Spacing.lg,
	},
	swipeUpIcon: {
		marginBottom: Spacing.xs,
	},
	swipeUpText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.accent,
		fontWeight: Typography.fontWeight.medium,
	},
});

export default WelcomeCard;

