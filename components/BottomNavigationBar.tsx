import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Home, Plus, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const BottomNavigationBar = () => {
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();

	const isActive = (route: string) => {
		if (route === "/feed" || route === "/") {
			return pathname === "/feed" || pathname === "/";
		}
		return pathname === route;
	};

	const navigateTo = (route: string) => {
		if (pathname !== route) {
			router.push(route as any);
		}
	};

	return (
		<View
			style={[
				styles.container,
				{ paddingBottom: Math.max(insets.bottom, Spacing.sm) },
			]}
		>
			{/* Home Button */}
			<TouchableOpacity
				style={styles.button}
				onPress={() => navigateTo("/feed")}
				activeOpacity={0.7}
			>
				<Home
					size={28}
					color={isActive("/feed") ? Colors.accent : Colors.text.secondary}
					fill={isActive("/feed") ? Colors.accent : "transparent"}
				/>
			</TouchableOpacity>

			{/* Create Game Button (Plus with gradient) */}
			<TouchableOpacity
				style={styles.createButton}
				onPress={() => navigateTo("/create-game")}
				activeOpacity={0.7}
			>
				<LinearGradient
					colors={[Colors.accent, "#00B894"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.gradientButton}
				>
					<Plus size={32} color={Colors.text.primary} strokeWidth={2.5} />
				</LinearGradient>
			</TouchableOpacity>

			{/* Profile Button */}
			<TouchableOpacity
				style={styles.button}
				onPress={() => navigateTo("/profile")}
				activeOpacity={0.7}
			>
				<User
					size={28}
					color={isActive("/profile") ? Colors.accent : Colors.text.secondary}
					fill={isActive("/profile") ? Colors.accent : "transparent"}
				/>
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
		borderTopWidth: 1,
		borderTopColor: "rgba(255, 255, 255, 0.1)",
		paddingTop: Spacing.md,
		paddingHorizontal: Spacing.lg,
		height: 70,
		zIndex: 1000,
		...Shadows.medium,
	},
	button: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.sm,
	},
	createButton: {
		alignItems: "center",
		justifyContent: "center",
		marginHorizontal: Spacing.lg,
	},
	gradientButton: {
		width: 56,
		height: 56,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.glow,
	},
});

export default BottomNavigationBar;
