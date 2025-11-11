import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useGameStore } from "../stores/gameStore";
import { getCurrentUser, getUserData, signOut, UserData } from "../config/auth";
import { Puzzle } from "../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";

const ProfileScreen = () => {
	const router = useRouter();
	const { userProfile, isAuthenticated, resetProgress } = useGameStore();
	const [userData, setUserData] = useState<UserData | null>(null);
	const [loading, setLoading] = useState(true);
	const [showHistory, setShowHistory] = useState(false);
	const [historyPuzzles, setHistoryPuzzles] = useState<Puzzle[]>([]);

	useEffect(() => {
		loadUserData();
	}, []);

	const loadUserData = async () => {
		const user = getCurrentUser();
		if (user) {
			const data = await getUserData(user.uid);
			setUserData(data);
			if (data?.completedGames) {
				// Load puzzle details for completed games
				await loadHistoryPuzzles(data.completedGames);
			}
		}
		setLoading(false);
	};

	const loadHistoryPuzzles = async (completedGameIds: string[]) => {
		// For now, we'll just show the IDs
		// In a full implementation, you'd fetch the puzzle details from Firestore
		// For simplicity, creating placeholder puzzles
		const puzzles: Puzzle[] = completedGameIds.map((id) => ({
			id,
			type: id.includes("wordle")
				? "wordle"
				: id.includes("quickmath")
				? "quickMath"
				: "riddle",
			data: {} as any,
			difficulty: 1,
			createdAt: new Date().toISOString(),
		}));
		setHistoryPuzzles(puzzles);
	};

	const handleLogout = async () => {
		Alert.alert("Logout", "Are you sure you want to logout?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				style: "destructive",
				onPress: async () => {
					try {
						await signOut();
						resetProgress();
						router.replace("/signin");
					} catch (error) {
						Alert.alert("Error", "Failed to sign out. Please try again.");
					}
				},
			},
		]);
	};

	const handleViewHistory = () => {
		setShowHistory(!showHistory);
	};

	const formatTime = (seconds: number) => {
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />

			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.accent} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Profile</Text>
				<View style={{ width: 24 }} /> {/* Spacer for centering */}
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* User Info */}
				<View style={styles.userSection}>
					<View style={styles.avatarContainer}>
						<Ionicons name="person-circle" size={80} color={Colors.accent} />
					</View>

					<Text style={styles.username}>
						{userData?.username || userProfile?.username || "Username"}
					</Text>
				</View>

				{/* Stats Grid */}
				<View style={styles.statsGrid}>
					<View style={styles.statCard}>
						<Text style={styles.statNumber}>
							{userData?.totalGamesPlayed || 0}
						</Text>
						<Text style={styles.statLabel}>Games Played</Text>
					</View>

					<View style={styles.statCard}>
						<Text style={styles.statNumber}>
							{formatTime(userData?.averageTimePerGame || 0)}
						</Text>
						<Text style={styles.statLabel}>Avg Time</Text>
					</View>

					<View style={styles.statCard}>
						<Text style={styles.statNumber}>{userData?.streakCount || 0}</Text>
						<Text style={styles.statLabel}>Current Streak</Text>
					</View>
				</View>

				{/* Achievement Badges */}
				<View style={styles.achievementsSection}>
					<Text style={styles.sectionTitle}>Achievements</Text>

					<View style={styles.badgesContainer}>
						{(userData?.totalGamesPlayed || 0) >= 1 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>🎯</Text>
								<Text style={styles.badgeText}>First Game</Text>
							</View>
						)}

						{(userData?.totalGamesPlayed || 0) >= 5 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>🔥</Text>
								<Text style={styles.badgeText}>Game Master</Text>
							</View>
						)}

						{(userData?.streakCount || 0) >= 3 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>⚡</Text>
								<Text style={styles.badgeText}>Speed Demon</Text>
							</View>
						)}

						{(userData?.totalGamesPlayed || 0) >= 10 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>🧠</Text>
								<Text style={styles.badgeText}>Brain Trainer</Text>
							</View>
						)}
					</View>
				</View>

				{/* History Section */}
				{showHistory && (
					<View style={styles.historySection}>
						<Text style={styles.sectionTitle}>
							Completed Games ({String(userData?.completedGames?.length || 0)})
						</Text>
						{loading ? (
							<ActivityIndicator size="small" color={Colors.accent} />
						) : historyPuzzles.length > 0 ? (
							<FlatList
								data={historyPuzzles}
								keyExtractor={(item) => item.id}
								renderItem={({ item }) => (
									<View style={styles.historyItem}>
										<Text style={styles.historyItemText}>
											{item.type} - {item.id}
										</Text>
									</View>
								)}
								scrollEnabled={false}
							/>
						) : (
							<Text style={styles.emptyHistoryText}>
								No completed games yet. Start playing to see your history!
							</Text>
						)}
					</View>
				)}

				{/* Action Buttons */}
				<View style={styles.actionsSection}>
					<TouchableOpacity
						style={styles.actionButton}
						onPress={handleViewHistory}
					>
						<Ionicons
							name={showHistory ? "chevron-up" : "time-outline"}
							size={24}
							color={Colors.accent}
						/>
						<Text style={styles.actionButtonText}>
							{showHistory ? "Hide History" : "View History"}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
						<Ionicons name="log-out-outline" size={24} color={Colors.error} />
						<Text style={[styles.actionButtonText, styles.logoutText]}>
							Logout
						</Text>
					</TouchableOpacity>
				</View>

				{/* App Info */}
				<View style={styles.appInfoSection}>
					<Text style={styles.appVersion}>Gear v1.0.0</Text>
					<Text style={styles.appDescription}>
						Short-form brain training for logic puzzles
					</Text>
				</View>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Layout.margin,
		paddingTop: 50,
		paddingBottom: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.medium,
	},
	backButton: {
		padding: Spacing.xs,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.3)",
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	content: {
		flex: 1,
		paddingHorizontal: Layout.margin,
	},
	userSection: {
		alignItems: "center",
		paddingVertical: Spacing.xl,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.xl,
		marginTop: Spacing.lg,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.medium,
	},
	avatarContainer: {
		marginBottom: Spacing.md,
	},
	username: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	email: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
	},
	statsGrid: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
	},
	statCard: {
		flex: 1,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginHorizontal: Spacing.xs,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.2)",
		...Shadows.light,
	},
	statNumber: {
		fontSize: 32,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.xs,
	},
	statLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
	},
	achievementsSection: {
		marginBottom: Spacing.xl,
	},
	sectionTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
	},
	badgesContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
	badge: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.md,
		width: "48%",
		alignItems: "center",
		marginBottom: Spacing.sm,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	badgeEmoji: {
		fontSize: 32,
		marginBottom: Spacing.xs,
	},
	badgeText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
	},
	actionsSection: {
		marginBottom: Spacing.xl,
	},
	actionButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.sm,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	actionButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
		marginLeft: Spacing.md,
	},
	logoutText: {
		color: Colors.error,
	},
	appInfoSection: {
		alignItems: "center",
		paddingVertical: Spacing.xl,
		marginBottom: Spacing.xxl,
	},
	appVersion: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	appDescription: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
	},
	historySection: {
		marginBottom: Spacing.xl,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	historyItem: {
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	historyItemText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.primary,
	},
	emptyHistoryText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
		paddingVertical: Spacing.lg,
	},
});

export default ProfileScreen;
