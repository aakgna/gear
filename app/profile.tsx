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

const ProfileScreen = () => {
	const router = useRouter();
	const {
		userProfile,
		isAuthenticated,
		getTotalPuzzlesSolved,
		getAverageSolveTime,
		getCurrentStreak,
		resetProgress,
	} = useGameStore();
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
			<StatusBar style="dark" />

			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color="#1e88e5" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Profile</Text>
				<View style={{ width: 24 }} /> {/* Spacer for centering */}
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* User Info */}
				<View style={styles.userSection}>
					<View style={styles.avatarContainer}>
						<Ionicons name="person-circle" size={80} color="#1e88e5" />
					</View>

					<Text style={styles.username}>
						{userProfile?.username || "Anonymous User"}
					</Text>

					{isAuthenticated && userProfile?.email && (
						<Text style={styles.email}>{userProfile.email}</Text>
					)}
				</View>

				{/* Stats Grid */}
				<View style={styles.statsGrid}>
					<View style={styles.statCard}>
						<Text style={styles.statNumber}>{getTotalPuzzlesSolved()}</Text>
						<Text style={styles.statLabel}>Puzzles Solved</Text>
					</View>

					<View style={styles.statCard}>
						<Text style={styles.statNumber}>
							{formatTime(getAverageSolveTime())}
						</Text>
						<Text style={styles.statLabel}>Avg Time</Text>
					</View>

					<View style={styles.statCard}>
						<Text style={styles.statNumber}>{getCurrentStreak()}</Text>
						<Text style={styles.statLabel}>Current Streak</Text>
					</View>
				</View>

				{/* Achievement Badges */}
				<View style={styles.achievementsSection}>
					<Text style={styles.sectionTitle}>Achievements</Text>

					<View style={styles.badgesContainer}>
						{getTotalPuzzlesSolved() >= 1 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>🎯</Text>
								<Text style={styles.badgeText}>First Puzzle</Text>
							</View>
						)}

						{getTotalPuzzlesSolved() >= 5 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>🔥</Text>
								<Text style={styles.badgeText}>Puzzle Master</Text>
							</View>
						)}

						{getCurrentStreak() >= 3 && (
							<View style={styles.badge}>
								<Text style={styles.badgeEmoji}>⚡</Text>
								<Text style={styles.badgeText}>Speed Demon</Text>
							</View>
						)}

						{getTotalPuzzlesSolved() >= 10 && (
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
							<ActivityIndicator size="small" color="#1e88e5" />
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
							color="#1e88e5"
						/>
						<Text style={styles.actionButtonText}>
							{showHistory ? "Hide History" : "View History"}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
						<Ionicons name="log-out-outline" size={24} color="#f44336" />
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
		backgroundColor: "#f5f7fa",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingTop: 50,
		paddingBottom: 15,
		backgroundColor: "#ffffff",
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	backButton: {
		padding: 5,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#212121",
	},
	content: {
		flex: 1,
		paddingHorizontal: 20,
	},
	userSection: {
		alignItems: "center",
		paddingVertical: 30,
		backgroundColor: "#ffffff",
		borderRadius: 20,
		marginTop: 20,
		marginBottom: 20,
	},
	avatarContainer: {
		marginBottom: 15,
	},
	username: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#212121",
		marginBottom: 5,
	},
	email: {
		fontSize: 16,
		color: "#666",
	},
	statsGrid: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 30,
	},
	statCard: {
		flex: 1,
		backgroundColor: "#ffffff",
		borderRadius: 15,
		padding: 20,
		marginHorizontal: 5,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	statNumber: {
		fontSize: 28,
		fontWeight: "bold",
		color: "#1e88e5",
		marginBottom: 5,
	},
	statLabel: {
		fontSize: 14,
		color: "#666",
		textAlign: "center",
	},
	achievementsSection: {
		marginBottom: 30,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#212121",
		marginBottom: 15,
	},
	badgesContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
	badge: {
		backgroundColor: "#ffffff",
		borderRadius: 15,
		padding: 15,
		width: "48%",
		alignItems: "center",
		marginBottom: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	badgeEmoji: {
		fontSize: 30,
		marginBottom: 8,
	},
	badgeText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#212121",
		textAlign: "center",
	},
	actionsSection: {
		marginBottom: 30,
	},
	actionButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#ffffff",
		borderRadius: 15,
		padding: 20,
		marginBottom: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	actionButtonText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#1e88e5",
		marginLeft: 15,
	},
	logoutText: {
		color: "#f44336",
	},
	appInfoSection: {
		alignItems: "center",
		paddingVertical: 30,
		marginBottom: 50,
	},
	appVersion: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#212121",
		marginBottom: 5,
	},
	appDescription: {
		fontSize: 14,
		color: "#666",
		textAlign: "center",
	},
	historySection: {
		marginBottom: 30,
		backgroundColor: "#ffffff",
		borderRadius: 15,
		padding: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	historyItem: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	historyItemText: {
		fontSize: 14,
		color: "#212121",
	},
	emptyHistoryText: {
		fontSize: 14,
		color: "#666",
		textAlign: "center",
		paddingVertical: 20,
	},
});

export default ProfileScreen;
