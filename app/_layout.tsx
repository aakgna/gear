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

	// Routes that should show the bottom navigation bar
	const routesWithBottomNav = ["/feed", "/profile", "/create-game"];
	const shouldShowBottomNav = routesWithBottomNav.includes(pathname);
	// Routes that use MainAppContainer (main app screens that stay mounted)
	const mainAppRoutes = ["/feed", "/profile", "/create-game"];
	const isMainAppRoute = mainAppRoutes.includes(pathname);
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
						<Stack.Screen name="create-game" options={{ headerShown: false }} />
					</Stack>
					{/* MainAppContainer - keeps all main screens mounted */}
					{isMainAppRoute && (
						<View
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								zIndex: 10,
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
