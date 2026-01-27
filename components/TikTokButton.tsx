import React, { useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Animated,
	ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Gradients,
} from "../constants/DesignSystem";

interface TikTokButtonProps {
	label: string;
	onPress: () => void;
	variant?: "primary" | "secondary" | "outline";
	disabled?: boolean;
	loading?: boolean;
	fullWidth?: boolean;
	icon?: React.ReactNode;
}

const TikTokButton: React.FC<TikTokButtonProps> = ({
	label,
	onPress,
	variant = "primary",
	disabled = false,
	loading = false,
	fullWidth = false,
	icon,
}) => {
	const scaleAnim = useRef(new Animated.Value(1)).current;

	const handlePress = () => {
		if (disabled || loading) return;

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
		onPress();
	};

	const renderButton = () => {
		if (variant === "primary") {
			return (
				<LinearGradient
					colors={disabled ? ["#9CA3AF", "#6B7280"] : ["#fcd34d", "#fbbf24"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={[
						styles.button,
						styles.primaryButton,
						fullWidth && styles.fullWidth,
					]}
				>
					{loading ? (
						<ActivityIndicator size="small" color={Colors.text.white} />
					) : (
						<>
							{icon && <View style={styles.iconContainer}>{icon}</View>}
							<Text style={styles.primaryText}>{label}</Text>
						</>
					)}
				</LinearGradient>
			);
		}

		if (variant === "secondary") {
			return (
				<View
					style={[
						styles.button,
						styles.secondaryButton,
						fullWidth && styles.fullWidth,
						disabled && styles.disabled,
					]}
				>
					{loading ? (
						<ActivityIndicator size="small" color={Colors.accent} />
					) : (
						<>
							{icon && <View style={styles.iconContainer}>{icon}</View>}
							<Text style={styles.secondaryText}>{label}</Text>
						</>
					)}
				</View>
			);
		}

		// Outline variant
		return (
			<View
				style={[
					styles.button,
					styles.outlineButton,
					fullWidth && styles.fullWidth,
					disabled && styles.disabled,
				]}
			>
				{loading ? (
					<ActivityIndicator size="small" color={Colors.accent} />
				) : (
					<>
						{icon && <View style={styles.iconContainer}>{icon}</View>}
						<Text style={styles.outlineText}>{label}</Text>
					</>
				)}
			</View>
		);
	};

	return (
		<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
			<TouchableOpacity
				onPress={handlePress}
				activeOpacity={0.8}
				disabled={disabled || loading}
			>
				{renderButton()}
			</TouchableOpacity>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	button: {
		minHeight: 44,
		paddingVertical: Spacing.buttonPadding,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.lg,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	primaryButton: {
		overflow: "hidden",
		...Shadows.glowAccent,
	},
	secondaryButton: {
		backgroundColor: Colors.background.secondary,
	},
	outlineButton: {
		backgroundColor: "transparent",
		borderWidth: 1.5,
		borderColor: Colors.accent,
	},
	fullWidth: {
		width: "100%",
	},
	disabled: {
		opacity: 0.5,
	},
	primaryText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	secondaryText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	outlineText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.accent,
	},
	iconContainer: {
		marginRight: Spacing.xs,
	},
});

export default React.memo(TikTokButton);
