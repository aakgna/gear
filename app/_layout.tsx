import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
	});

	useEffect(() => {
		if (Platform.OS === "android") {
			Notifications.setNotificationChannelAsync("default", {
				name: "Default",
				importance: Notifications.AndroidImportance.HIGH,
				sound: "default", // or your custom sound file in /assets
				vibrationPattern: [0, 250, 250, 250], // optional
			});
		}
	});

	useEffect(() => {
		if (loaded) {
			SplashScreen.hideAsync();
		}
	}, [loaded]);

	if (!loaded) {
		return null;
	}

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
				<Stack.Screen name="index" options={{ headerShown: false }} />
				<Stack.Screen name="verify" options={{ headerShown: false }} />
				<Stack.Screen
					name="start"
					options={{ headerShown: false, gestureEnabled: false }}
				/>
				<Stack.Screen name="discussion" options={{ headerShown: false }} />
				<Stack.Screen name="deletion" options={{ headerShown: false }} />
			</Stack>
			<StatusBar style="auto" />
		</ThemeProvider>
	);
}
