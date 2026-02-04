import React, { useRef, useEffect } from "react";
import {
	View,
	TouchableOpacity,
	StyleSheet,
	Text,
	Animated,
	Alert,
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
import { getCurrentUser } from "../config/auth";
import { db } from "../config/firebase";

const BottomNavigationBar = () => {
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();

	// Animation refs for button press feedback
	const homeScale = useRef(new Animated.Value(1)).current;
	const profileScale = useRef(new Animated.Value(1)).current;
	const createScale = useRef(new Animated.Value(1)).current;

	const homeActive = pathname === "/feed" || pathname === "/";
	const profileActive = pathname === "/profile";

	// Animation refs for smooth transitions
	const homeActiveAnim = useRef(new Animated.Value(homeActive ? 1 : 0)).current;
	const profileActiveAnim = useRef(
		new Animated.Value(profileActive ? 1 : 0)
	).current;

	// Animate transitions when active state changes
	useEffect(() => {
		Animated.parallel([
			Animated.timing(homeActiveAnim, {
				toValue: homeActive ? 1 : 0,
				duration: Animation.duration.normal,
				useNativeDriver: true,
			}),
			Animated.timing(profileActiveAnim, {
				toValue: profileActive ? 1 : 0,
				duration: Animation.duration.normal,
				useNativeDriver: true,
			}),
		]).start();
	}, [homeActive, profileActive]);

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

	// Handle create game button press - check gameStrikeCount first
	const handleCreateGamePress = async (scaleAnim: Animated.Value) => {
		// Animate button press
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

		// Check if user has too many game strikes
		const user = getCurrentUser();
		if (!user) {
			// If not logged in, navigate normally (they'll be prompted to sign in)
			navigateTo("/create-game");
			return;
		}

		try {
			const userDoc = await db.collection("users").doc(user.uid).get();
			const userData = userDoc.data();
			const gameStrikeCount = userData?.gameStrikeCount || 0;

			if (gameStrikeCount > 7) {
				Alert.alert(
					"Game Creation Disabled",
					"You have too many strikes. Game creation has been disabled for your account."
				);
				return;
			}

			// If checks pass, navigate to create game
			navigateTo("/create-game");
		} catch (error) {
			// If error checking, allow navigation (fail open)
			navigateTo("/create-game");
		}
	};

	return (
		<View
			style={[
				styles.container,
				{ paddingBottom: Math.max(insets.bottom - 10, 0) },
			]}
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
						<Animated.View
							style={[styles.activeIconContainer, { opacity: homeActiveAnim }]}
						>
							<LinearGradient
								colors={Gradients.primary}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={StyleSheet.absoluteFill}
							/>
							<Home
								size={16}
								color={Colors.text.white}
								fill={Colors.text.white}
							/>
						</Animated.View>
						{!homeActive && (
							<Home
								size={16}
								color={Colors.text.secondary}
								fill="transparent"
								style={{ position: "absolute" }}
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
					onPress={() => handleCreateGamePress(createScale)}
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
						<Animated.View
							style={[
								styles.activeIconContainer,
								{ opacity: profileActiveAnim },
							]}
						>
							<LinearGradient
								colors={Gradients.primary}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={StyleSheet.absoluteFill}
							/>
							<User
								size={16}
								color={Colors.text.white}
								fill={Colors.text.white}
							/>
						</Animated.View>
						{!profileActive && (
							<User
								size={16}
								color={Colors.text.secondary}
								fill="transparent"
								style={{ position: "absolute" }}
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
		borderTopWidth: 2,
		borderBottomWidth: 0,
		borderLeftWidth: 0,
		borderRightWidth: 0,
		borderTopColor: Colors.accent,
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
		overflow: "hidden",
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
