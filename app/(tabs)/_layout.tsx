import { useRouter, Tabs } from "expo-router";
import {
	View,
	StyleSheet,
	Pressable,
	Alert,
	Keyboard,
	Platform,
	Text,
} from "react-native";
import {
	MessageSquare,
	History,
	Calendar,
	Settings,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import Animated, {
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/ui/IconSymbol";
// Update Firebase imports to use new modular SDK
import { getAuth } from "@react-native-firebase/auth";
import {
	getFirestore,
	doc,
	getDoc,
	updateDoc,
} from "@react-native-firebase/firestore";
import { useState, useEffect } from "react";

interface TabBarProps {
	state: any;
	descriptors: any;
	navigation: any;
}

function TabBar({ state, descriptors, navigation }: TabBarProps) {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const [voted, setVoted] = useState(true);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

	useEffect(() => {
		if (Platform.OS === "android") {
			const subscription = Keyboard.addListener("keyboardDidShow", () => {
				setIsKeyboardVisible(true);
			});
			const subscription2 = Keyboard.addListener("keyboardDidHide", () => {
				setIsKeyboardVisible(false);
			});

			return () => {
				subscription.remove();
				subscription2.remove();
			};
		}
	}, []);

	return (
		<View
			style={[
				styles.tabBar,
				{
					paddingBottom: Math.max(insets.bottom, 8),
					// Only apply keyboard hiding logic on Android
					...(Platform.OS === "android" && {
						display: isKeyboardVisible ? "none" : "flex",
						height: isKeyboardVisible ? 0 : "auto",
					}),
				},
			]}
		>
			<LinearGradient
				colors={["#1A1A1A", "#121212"]}
				style={styles.tabBarGradient}
			/>
			{state.routes.map((route: any, index: number) => {
				const { options } = descriptors[route.key];
				const label = options.tabBarLabel || options.title || route.name;
				const isFocused = state.index === index;
				const isActive =
					pathname === route.name || pathname.startsWith(`/${route.name}`);

				const indicatorStyle = useAnimatedStyle(() => {
					return {
						opacity: withTiming(isActive ? 1 : 0, { duration: 200 }),
						transform: [
							{ scale: withTiming(isActive ? 1 : 0.8, { duration: 200 }) },
						],
					};
				});

				const checkUserVote = async () => {
					// Use new modular SDK API
					const auth = getAuth();
					const firestore = getFirestore();

					const userId = auth.currentUser?.uid;
					if (!userId) return;

					try {
						// Use new modular SDK API for getting document
						const userDocRef = doc(firestore, "users", userId);
						const userDoc = await getDoc(userDocRef);

						const userData = userDoc.data();
						const today = new Date();
						today.setHours(0, 0, 0, 0);

						// If updatedAt exists, compare only the date portion (YYYY-MM-DD)
						if (userData?.updatedAt) {
							const lastVoteDate = userData.updatedAt; // Get just YYYY-MM-DD
							const todayDate = today.toISOString().substring(0, 10); // Get just YYYY-MM-DD
							const hasVotedToday = lastVoteDate === todayDate;
							if (!hasVotedToday || !userData.voted) {
								// Use new modular SDK API for updating document
								await updateDoc(userDocRef, {
									voted: false,
									messageCount: 100,
								});
								setVoted(false);
							} else {
								setVoted(userData.voted);
							}
						} else {
							setVoted(false);
						}
					} catch (error) {
						console.error("Error checking vote:", error);
					}
				};
				const onPress = async () => {
					const event = navigation.emit({
						type: "tabPress",
						target: route.key,
						canPreventDefault: true,
					});

					if (!isFocused && !event.defaultPrevented) {
						if (route.name == "discussion") {
							await checkUserVote();
							if (!voted) {
								router.push("/(tabs)/start");
								return;
							}
						}
						navigation.navigate(route.name);
					}
				};

				return (
					<Pressable
						key={route.key}
						accessibilityRole="button"
						accessibilityState={isFocused ? { selected: true } : {}}
						accessibilityLabel={options.tabBarAccessibilityLabel}
						testID={options.tabBarTestID}
						onPress={onPress}
						style={styles.tabItem}
					>
						<View style={styles.tabIconContainer}>
							{options.tabBarIcon &&
								options.tabBarIcon({
									color: isActive ? "#9D00FF" : "#777777",
									size: 24,
								})}
							<Animated.View style={[styles.activeIndicator, indicatorStyle]} />
						</View>
						<Animated.Text
							style={[
								styles.tabLabel,
								{ color: isActive ? "#9D00FF" : "#777777" },
							]}
						>
							{label}
						</Animated.Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
			}}
			tabBar={(props) => <TabBar {...props} />}
		>
			<Tabs.Screen
				name="start"
				options={{
					title: "Today",
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name="house.fill" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="discussion"
				options={{
					href: null,
					title: "Discussion",
					tabBarIcon: ({ color, size }) => (
						<MessageSquare size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="ai-bot"
				options={{
					title: "AI Bot",
					tabBarIcon: ({ color, size }) => (
						<MessageSquare size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="history"
				options={{
					title: "History",
					tabBarIcon: ({ color, size }) => (
						<History size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	tabBar: {
		flexDirection: "row",
		backgroundColor: "transparent",
		borderTopWidth: 1,
		borderTopColor: "#333333",
		paddingTop: 12,
		position: "relative",
	},
	tabBarGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	tabItem: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	tabIconContainer: {
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
		marginBottom: 4,
	},
	activeIndicator: {
		position: "absolute",
		bottom: -6,
		width: 4,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#9D00FF",
	},
	tabLabel: {
		fontSize: 12,
		fontFamily: "Inter-Medium",
	},
	chatBot: {
		position: "absolute",
		right: 20,
		width: 120,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
	},
	chatBotText: {
		color: "#FFFFFF",
		fontSize: 16, // Increased from 14 for better fit
		fontWeight: "600",
	},
});
