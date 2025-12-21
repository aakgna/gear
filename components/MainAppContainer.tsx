import React from "react";
import { View, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import { FeedScreen } from "../app/feed";
import { ProfileScreen } from "../app/profile";
import { CreateGameScreen } from "../app/create-game";

const MainAppContainer = () => {
	const pathname = usePathname();
	
	// Check if we're on a main app route (feed, profile, or create-game index)
	const isFeedRoute = pathname === "/feed" || pathname === "/";
	const isProfileRoute = pathname === "/profile";
	const isCreateGameIndexRoute = pathname === "/create-game";
	
	// Check if we're on a create-game sub-route (like /create-game/wordle)
	const isCreateGameSubRoute = pathname?.startsWith("/create-game/") && pathname !== "/create-game";

	return (
		<View style={styles.container}>
			{/* Feed Screen - always mounted, visible only on feed route */}
			<View
				style={[
					styles.screen,
					isFeedRoute ? styles.visible : styles.hidden,
				]}
			>
				<FeedScreen />
			</View>

			{/* Profile Screen - always mounted, visible only on profile route */}
			<View
				style={[
					styles.screen,
					isProfileRoute ? styles.visible : styles.hidden,
				]}
			>
				<ProfileScreen />
			</View>

			{/* Create Game Screen - always mounted, visible only on create-game index route */}
			<View
				style={[
					styles.screen,
					isCreateGameIndexRoute ? styles.visible : styles.hidden,
				]}
			>
				<CreateGameScreen />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: "relative",
	},
	screen: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	visible: {
		zIndex: 1,
		opacity: 1,
		pointerEvents: "auto",
	},
	hidden: {
		zIndex: 0,
		opacity: 0,
		pointerEvents: "none",
	},
});

export default MainAppContainer;

