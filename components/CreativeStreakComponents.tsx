import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withSequence,
	withTiming,
	interpolate,
} from "react-native-reanimated";

// Fixed Progress Dots Component
export const ProgressDots = ({ streakCount }: { streakCount: number }) => {
	const pulseAnimation = useSharedValue(0);

	useEffect(() => {
		pulseAnimation.value = withRepeat(
			withSequence(
				withTiming(1, { duration: 600 }),
				withTiming(0.7, { duration: 600 })
			),
			-1
		);
	}, []);

	// Move the animated style outside the loop - this is the key fix
	const animatedDotStyle = useAnimatedStyle(() => ({
		transform: [{ scale: interpolate(pulseAnimation.value, [0, 1], [1, 1.2]) }],
		shadowOpacity: pulseAnimation.value,
	}));

	const renderDots = () => {
		const maxDots = 5;
		var currDots = streakCount % maxDots;
		if (currDots == 0 && streakCount > 0) {
			currDots = maxDots;
		}
		const activeDots = Math.min(currDots, maxDots);
		const dots = [];

		for (let i = 0; i < maxDots; i++) {
			const isActive = i < activeDots;
			dots.push(
				<Animated.View
					key={i}
					style={[
						styles.progressDot,
						{
							backgroundColor: isActive ? "#8A2BE2" : "#333",
						},
						// Only apply animation to active dots, but don't call useAnimatedStyle in loop
						isActive && animatedDotStyle,
					]}
				/>
			);
		}

		return dots;
	};

	// Remove the condition - show for any streak count >= 0
	return (
		<View style={styles.dotsContainer}>
			<View style={styles.dotsRow}>{renderDots()}</View>
			<Text style={styles.dotsCounter}>{streakCount} days</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	dotsContainer: {
		alignItems: "center",
		marginBottom: 8,
	},
	dotsRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	progressDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		marginHorizontal: 2,
		elevation: 2,
		shadowColor: "#8A2BE2",
		shadowOffset: { width: 0, height: 1 },
		shadowRadius: 2,
	},
	dotsCounter: {
		color: "#8A2BE2",
		fontSize: 12,
		fontWeight: "600",
		marginTop: 4,
	},
});
