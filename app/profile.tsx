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
import {
	getCurrentUser,
	getUserData,
	signOut,
	deleteAccount,
	UserData,
} from "../config/auth";
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
	const [showStats, setShowStats] = useState(false);
	const [historyPuzzles, setHistoryPuzzles] = useState<Puzzle[]>([]);
	const [deletingAccount, setDeletingAccount] = useState(false);

	useEffect(() => {
		loadUserData();
	}, []);

	const loadUserData = async () => {
		const user = getCurrentUser();
		if (user) {
			const data = await getUserData(user.uid);
			setUserData(data);

			// Fetch completed games from gameHistory
			const { fetchGameHistory } = require("../config/firebase");
			const completedHistory = await fetchGameHistory(user.uid, {
				action: "completed",
				limit: 50, // Start with recent 50
			});
			const completedGameIds = completedHistory.map((entry) => entry.gameId);

			if (completedGameIds.length > 0) {
				// Load puzzle details for completed games
				await loadHistoryPuzzles(completedGameIds);
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
				: id.includes("wordchain")
				? "wordChain"
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

	const handleViewStats = () => {
		setShowStats(!showStats);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete Account",
			"Are you sure you want to delete your account? This action cannot be undone. All your data, including game history and statistics, will be permanently deleted.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						// Double confirmation
						Alert.alert(
							"Final Confirmation",
							"This will permanently delete your account and all data. Are you absolutely sure?",
							[
								{ text: "Cancel", style: "cancel" },
								{
									text: "Yes, Delete",
									style: "destructive",
									onPress: async () => {
										setDeletingAccount(true);
										try {
											const user = getCurrentUser();
											if (!user) {
												Alert.alert(
													"Error",
													"No user found. Please sign in again."
												);
												return;
											}

											await deleteAccount(user.uid, userData?.username);
											resetProgress();
											Alert.alert(
												"Account Deleted",
												"Your account has been successfully deleted.",
												[
													{
														text: "OK",
														onPress: () => router.replace("/signin"),
													},
												]
											);
										} catch (error: any) {
											console.error("Error deleting account:", error);
											Alert.alert(
												"Error",
												error.message ||
													"Failed to delete account. Please try again."
											);
										} finally {
											setDeletingAccount(false);
										}
									},
								},
							]
						);
					},
				},
			]
		);
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
				<TouchableOpacity
					style={styles.createGameButton}
					onPress={() => router.push("/create-game")}
					activeOpacity={0.7}
				>
					<Ionicons name="add-circle" size={20} color={Colors.accent} />
					<Text style={styles.createGameButtonText}>Create Game</Text>
				</TouchableOpacity>
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
							{String(userData?.totalGamesPlayed || 0)}
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
						<Text style={styles.statNumber}>
							{String(userData?.streakCount || 0)}
						</Text>
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

				{/* Gaming Stats Section */}
				{showStats && (
					<View style={styles.statsSection}>
						<Text style={styles.sectionTitle}>Gaming Statistics</Text>

						{/* Category Stats */}
						{userData?.statsByCategory &&
						Object.keys(userData.statsByCategory).length > 0 ? (
							<View style={styles.statsSubsection}>
								<Text style={styles.subsectionTitle}>By Category</Text>
								{userData.statsByCategory.wordle && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Wordle:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByCategory.wordle.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByCategory.wordle.avgTime)} avg
										</Text>
									</View>
								)}
								{userData.statsByCategory.riddle && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Riddle:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByCategory.riddle.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByCategory.riddle.avgTime)} avg
										</Text>
									</View>
								)}
								{userData.statsByCategory.wordChain && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Word Chain:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByCategory.wordChain.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByCategory.wordChain.avgTime)} avg
										</Text>
									</View>
								)}
								{userData.statsByCategory.quickMath && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Quick Math:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByCategory.quickMath.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByCategory.quickMath.avgTime)}{" "}
											avg
										</Text>
									</View>
								)}
							</View>
						) : null}

						{/* Difficulty Stats */}
						{userData?.statsByDifficulty &&
						Object.keys(userData.statsByDifficulty).length > 0 ? (
							<View style={styles.statsSubsection}>
								<Text style={styles.subsectionTitle}>By Difficulty</Text>
								{userData.statsByDifficulty.easy && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Easy:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByDifficulty.easy.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByDifficulty.easy.avgTime)} avg
										</Text>
									</View>
								)}
								{userData.statsByDifficulty.medium && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Medium:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByDifficulty.medium.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByDifficulty.medium.avgTime)}{" "}
											avg
										</Text>
									</View>
								)}
								{userData.statsByDifficulty.hard && (
									<View style={styles.statRow}>
										<Text style={styles.statRowLabel}>Hard:</Text>
										<Text style={styles.statRowValue}>
											{String(userData.statsByDifficulty.hard.completed)}{" "}
											completed •{" "}
											{formatTime(userData.statsByDifficulty.hard.avgTime)} avg
										</Text>
									</View>
								)}
							</View>
						) : null}

						{(!userData?.statsByCategory ||
							Object.keys(userData.statsByCategory).length === 0) &&
						(!userData?.statsByDifficulty ||
							Object.keys(userData.statsByDifficulty).length === 0) ? (
							<Text style={styles.emptyStatsText}>
								No detailed statistics yet. Complete more games to see your
								stats!
							</Text>
						) : null}
					</View>
				)}

				{/* Action Buttons */}
				<View style={styles.actionsSection}>
					<TouchableOpacity
						style={styles.actionButton}
						onPress={handleViewStats}
					>
						<Ionicons
							name={showStats ? "chevron-up" : "stats-chart-outline"}
							size={24}
							color={Colors.accent}
						/>
						<Text style={styles.actionButtonText}>
							{showStats ? "Hide Gaming Stats" : "View Gaming Stats"}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
						<Ionicons name="log-out-outline" size={24} color={Colors.error} />
						<Text style={[styles.actionButtonText, styles.logoutText]}>
							Logout
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.actionButton, styles.deleteButton]}
						onPress={handleDeleteAccount}
						disabled={deletingAccount}
					>
						{deletingAccount ? (
							<ActivityIndicator size="small" color={Colors.error} />
						) : (
							<Ionicons name="trash-outline" size={24} color={Colors.error} />
						)}
						<Text style={[styles.actionButtonText, styles.deleteText]}>
							{deletingAccount ? "Deleting..." : "Delete Account"}
						</Text>
					</TouchableOpacity>
				</View>

				{/* App Info */}
				<View style={styles.appInfoSection}>
					<Text style={styles.appVersion}>ThinkTok v1.0.0</Text>
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
	createGameButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.tertiary,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "rgba(124, 77, 255, 0.3)",
	},
	createGameButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
		marginLeft: Spacing.xs,
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
	statsSection: {
		marginBottom: Spacing.xl,
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		...Shadows.light,
	},
	statsSubsection: {
		marginBottom: Spacing.lg,
	},
	subsectionTitle: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	statRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.05)",
	},
	statRowLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		flex: 1,
	},
	statRowValue: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		flex: 2,
		textAlign: "right",
	},
	emptyStatsText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
		paddingVertical: Spacing.lg,
	},
	deleteButton: {
		opacity: 0.9,
	},
	deleteText: {
		color: Colors.error,
	},
});

export default ProfileScreen;
