import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	Shadows,
} from "../constants/DesignSystem";

interface MinimalHeaderProps {
	title?: string;
	showBack?: boolean;
	rightAction?: React.ReactNode;
	transparent?: boolean;
}

const MinimalHeader: React.FC<MinimalHeaderProps> = ({
	title,
	showBack = true,
	rightAction,
	transparent = false,
}) => {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={[
				styles.wrapper,
				{ paddingTop: insets.top },
				transparent && styles.transparent,
			]}
		>
			<View style={[styles.container, transparent && styles.transparent]}>
				{!transparent && (
					<BlurView
						intensity={80}
						tint="light"
						style={StyleSheet.absoluteFill}
					/>
				)}
				<View style={styles.content}>
					{showBack ? (
						<TouchableOpacity
							style={styles.backButton}
							onPress={() => router.back()}
							activeOpacity={0.7}
						>
							<Ionicons
								name="arrow-back"
								size={22}
								color={Colors.text.primary}
							/>
						</TouchableOpacity>
					) : (
						<View style={styles.backButton} />
					)}
					{title && (
						<Text style={styles.title} numberOfLines={1}>
							{title}
						</Text>
					)}
					{rightAction || <View style={styles.rightSpacer} />}
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	wrapper: {
		zIndex: 10,
	},
	container: {
		height: 48,
		backgroundColor: "rgba(255, 255, 255, 0.8)",
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		overflow: "hidden",
		...Shadows.light,
	},
	transparent: {
		backgroundColor: "transparent",
		borderBottomWidth: 0,
	},
	content: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.md,
		height: 48,
	},
	backButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		marginLeft: -Spacing.xs,
	},
	title: {
		flex: 1,
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		marginHorizontal: Spacing.sm,
	},
	rightSpacer: {
		width: 40,
	},
});

export default React.memo(MinimalHeader);
