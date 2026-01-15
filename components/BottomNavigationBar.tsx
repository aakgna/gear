import React, { useRef } from "react";
import {
	View,
	TouchableOpacity,
	StyleSheet,
	Text,
	Animated,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Home, Plus, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Spacing,
	BorderRadius,
	Shadows,
	Typography,
	Gradients,
	Animation,
} from "../constants/DesignSystem";

const BottomNavigationBar = () => {
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();

	// Animation refs for button press feedback
	const homeScale = useRef(new Animated.Value(1)).current;
	const profileScale = useRef(new Animated.Value(1)).current;
	const createScale = useRef(new Animated.Value(1)).current;

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

	// Animated press handler
	const handlePress = (scaleAnim: Animated.Value, route: string) => {
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
		navigateTo(route);
	};

	const homeActive = isActive("/feed");
	const profileActive = isActive("/profile");

	return (
		<View
			style={[styles.container, { paddingBottom: Math.max(insets.bottom, 0) }]}
		>
			{/* Glassmorphism backdrop */}
			<BlurView
				intensity={70}
				tint="light"
				style={[
					StyleSheet.absoluteFill,
					{
						elevation: 0,
						shadowOpacity: 0,
						shadowRadius: 0,
						shadowOffset: { width: 0, height: 0 },
						shadowColor: "transparent",
						borderWidth: 0,
						borderTopWidth: 0,
					},
				]}
			/>

			{/* Home Button */}
			<Animated.View style={{ transform: [{ scale: homeScale }] }}>
				<TouchableOpacity
					style={styles.button}
					onPress={() => handlePress(homeScale, "/feed")}
					activeOpacity={0.7}
				>
					<View style={styles.iconWrapper}>
						{homeActive ? (
							<LinearGradient
								colors={Gradients.primary}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={styles.activeIconContainer}
							>
								<Home
									size={16}
									color={Colors.text.white}
									fill={Colors.text.white}
								/>
							</LinearGradient>
						) : (
							<Home
								size={16}
								color={Colors.text.secondary}
								fill="transparent"
							/>
						)}
					</View>
					<Text
						style={[
							styles.label,
							{
								color: homeActive ? Colors.accent : Colors.text.secondary,
								fontWeight: homeActive
									? Typography.fontWeight.bold
									: Typography.fontWeight.medium,
							},
						]}
					>
						Home
					</Text>
				</TouchableOpacity>
			</Animated.View>

			{/* Create Game Button (Plus with gradient) */}
			<Animated.View style={{ transform: [{ scale: createScale }] }}>
				<TouchableOpacity
					style={styles.createButton}
					onPress={() => handlePress(createScale, "/create-game")}
					activeOpacity={0.7}
				>
					<LinearGradient
						colors={Gradients.primary}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.gradientButton}
					>
						<Plus size={22} color={Colors.text.white} strokeWidth={2.5} />
					</LinearGradient>
				</TouchableOpacity>
			</Animated.View>

			{/* Profile Button */}
			<Animated.View style={{ transform: [{ scale: profileScale }] }}>
				<TouchableOpacity
					style={styles.button}
					onPress={() => handlePress(profileScale, "/profile")}
					activeOpacity={0.7}
				>
					<View style={styles.iconWrapper}>
						{profileActive ? (
							<LinearGradient
								colors={Gradients.primary}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={styles.activeIconContainer}
							>
								<User
									size={16}
									color={Colors.text.white}
									fill={Colors.text.white}
								/>
							</LinearGradient>
						) : (
							<User
								size={16}
								color={Colors.text.secondary}
								fill="transparent"
							/>
						)}
					</View>
					<Text
						style={[
							styles.label,
							{
								color: profileActive ? Colors.accent : Colors.text.secondary,
								fontWeight: profileActive
									? Typography.fontWeight.bold
									: Typography.fontWeight.medium,
							},
						]}
					>
						Profile
					</Text>
				</TouchableOpacity>
			</Animated.View>
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
		alignItems: "flex-end",
		backgroundColor: "rgba(255, 255, 255, 0.85)",
		paddingTop: Spacing.xxs,
		paddingHorizontal: Spacing.md,
		paddingBottom: 0,
		minHeight: 48,
		zIndex: 1000,
		overflow: "hidden",
		borderWidth: 0,
		borderTopWidth: 0,
		borderBottomWidth: 0,
		borderLeftWidth: 0,
		borderRightWidth: 0,
	},
	button: {
		flex: 1,
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: 0,
		gap: 1,
		minHeight: 44,
		maxHeight: 48,
	},
	label: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.medium,
		marginTop: 0,
		letterSpacing: 0.2,
	},
	iconWrapper: {
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	activeIconContainer: {
		width: 28,
		height: 28,
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	createButton: {
		alignItems: "center",
		justifyContent: "flex-end",
		marginHorizontal: Spacing.md,
		paddingBottom: 0,
		minHeight: 44,
		maxHeight: 48,
	},
	gradientButton: {
		width: 38,
		height: 38,
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
});

export default BottomNavigationBar;
