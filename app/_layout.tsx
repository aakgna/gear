import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import BottomNavigationBar from "../components/BottomNavigationBar";
import MainAppContainer from "../components/MainAppContainer";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const pathname = usePathname();
	const [loaded] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
	});

	useEffect(() => {
		if (loaded) {
			SplashScreen.hideAsync();
		}
	}, [loaded]);

	if (!loaded) {
		return null;
	}

	// Routes that use MainAppContainer (main app screens that stay mounted)
	const mainAppRoutes = ["/feed", "/profile", "/create-game"];
	const isMainAppRoute = mainAppRoutes.includes(pathname);
	// Check if we're on a create-game sub-route (like /create-game/wordle)
	const isCreateGameSubRoute = pathname?.startsWith("/create-game/") && pathname !== "/create-game";
	// Check if we're on a play-game route (games opened from profile)
	const isPlayGameRoute = pathname?.startsWith("/play-game/");
	// Check if we're on an overlay route (user profiles, followers-following, search, notifications, play-game, inbox, chat)
	// Note: pathname might include query params, so we check with startsWith
	const isOverlayRoute = pathname?.startsWith("/user/") || 
		pathname?.startsWith("/followers-following") ||
		pathname?.startsWith("/search-friends") ||
		pathname?.startsWith("/notifications") ||
		pathname?.startsWith("/inbox") ||
		pathname?.startsWith("/chat/") ||
		isPlayGameRoute;
	// Routes that should show the bottom navigation bar
	const routesWithBottomNav = ["/feed", "/profile", "/create-game"];
	const shouldShowBottomNav = (routesWithBottomNav.includes(pathname) || pathname?.startsWith("/create-game/")) && !isPlayGameRoute;
	// Routes where we should keep MainAppContainer mounted (includes user profiles, create-game sub-routes, play-game, and overlay routes)
	const shouldKeepMainAppMounted = isMainAppRoute || isOverlayRoute || isCreateGameSubRoute;
	// Auth routes that use Stack navigation
	const authRoutes = ["/", "/index", "/signin", "/username"];

	return (
		<SafeAreaProvider>
			<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
				<View style={{ flex: 1 }}>
					{/* Stack for auth screens - these can unmount */}
					<Stack screenOptions={{ headerShown: false }}>
						<Stack.Screen name="index" options={{ headerShown: false }} />
						<Stack.Screen name="signin" options={{ headerShown: false }} />
						<Stack.Screen
							name="username"
							options={{ headerShown: false, gestureEnabled: true }}
						/>
						{/* Main app routes - these will be handled by MainAppContainer */}
						<Stack.Screen name="feed" options={{ headerShown: false }} />
						<Stack.Screen name="profile" options={{ headerShown: false }} />
						{/* User profile routes - these render on top of MainAppContainer */}
						<Stack.Screen 
							name="user/[username]" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* Search and notifications routes */}
						<Stack.Screen 
							name="search-friends" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						<Stack.Screen 
							name="notifications" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* Followers/Following list route */}
						<Stack.Screen 
							name="followers-following" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* Inbox route - messages/conversations */}
						<Stack.Screen 
							name="inbox" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* Chat route - individual conversations */}
						<Stack.Screen 
							name="chat/[conversationId]" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* Play game route - opens on top of profile */}
						<Stack.Screen 
							name="play-game/[gameId]" 
							options={{ 
								headerShown: false,
								presentation: "card",
								gestureEnabled: true,
							}} 
						/>
						{/* create-game folder with sub-routes - let Expo Router handle automatically */}
					</Stack>
					{/* MainAppContainer - keeps all main screens mounted */}
					{shouldKeepMainAppMounted && (
						<View
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								zIndex: isMainAppRoute ? 10 : 0, // Lower z-index when on overlay routes (user profiles, followers-following, create-game sub-routes)
								pointerEvents: isMainAppRoute ? "auto" : "none", // Disable touches when on overlay routes
							}}
						>
							<MainAppContainer />
						</View>
					)}
					{shouldShowBottomNav && <BottomNavigationBar />}
					<StatusBar style="auto" />
				</View>
			</ThemeProvider>
		</SafeAreaProvider>
	);
}
