import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	FlatList,
	Dimensions,
	Image,
	RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
	getGameColor,
} from "../../constants/DesignSystem";
import {
	getUserByUsername,
	fetchUserProfile,
	fetchCreatedGames,
	fetchFollowers,
	fetchFollowing,
	followUser,
	unfollowUser,
	isFollowing,
	UserPublicProfile,
	GameSummary,
} from "../../config/social";
import { getCurrentUser } from "../../config/auth";
import { fetchGameHistory, GameHistoryEntry } from "../../config/firebase";
import { PuzzleType } from "../../config/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOTTOM_NAV_HEIGHT = 70;

type TabType = "created" | "completed" | "attempted";

const formatGameType = (type: string): string => {
	const formatted = type
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	const specialCases: Record<string, string> = {
		quickMath: "Quick Math",
		wordChain: "Word Chain",
		magicSquare: "Magic Square",
	};

	return specialCases[type] || formatted;
};

const getGameIcon = (gameType: string): keyof typeof Ionicons.glyphMap => {
	const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
		wordle: "text-outline",
		riddle: "help-circle-outline",
		quickMath: "calculator-outline",
		alias: "book-outline",
		wordChain: "link-outline",
		trivia: "trophy-outline",
		mastermind: "color-palette-outline",
		sequencing: "list-outline",
		sudoku: "grid-outline",
		futoshiki: "code-working-outline",
		hidato: "navigate-outline",
		zip: "git-branch-outline",
		magicSquare: "square-outline",
	};
	return iconMap[gameType] || "game-controller-outline";
};

const formatTime = (seconds: number): string => {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
};

const CreatorProfileScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { username } = useLocalSearchParams<{ username: string }>();
	const [profile, setProfile] = useState<UserPublicProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<TabType>("created");
	const [createdGames, setCreatedGames] = useState<GameSummary[]>([]);
	const [completedGames, setCompletedGames] = useState<GameHistoryEntry[]>([]);
	const [attemptedGames, setAttemptedGames] = useState<GameHistoryEntry[]>([]);
	const [isFollowingUser, setIsFollowingUser] = useState(false);
	const [isOwnProfile, setIsOwnProfile] = useState(false);
	const [loadingFollow, setLoadingFollow] = useState(false);
	const [loadingGames, setLoadingGames] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	// Cache flags to track which tabs have been loaded
	const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set());
	const currentUser = getCurrentUser();

	useEffect(() => {
		loadProfile();
		// Reset loaded tabs when username changes
		setLoadedTabs(new Set());
	}, [username]);

	const loadProfile = async () => {
		if (!username) return;

		setLoading(true);
		try {
			// Try to get user by username
			let userProfile = await getUserByUsername(username);

			if (!userProfile) {
				// If not found, show error
				console.error("User not found");
				setLoading(false);
				return;
			}

			setProfile(userProfile);
			setIsOwnProfile(currentUser?.uid === userProfile.uid);

			// Check if current user follows this profile
			if (currentUser && !isOwnProfile) {
				const following = await isFollowing(currentUser.uid, userProfile.uid);
				setIsFollowingUser(following);
			} else if (isOwnProfile) {
				// Reset following state for own profile
				setIsFollowingUser(false);
			}

			// Load initial tab (created) on first load
			if (activeTab === "created" && !loadedTabs.has("created")) {
				await loadTabData("created", false);
			}
		} catch (error) {
			console.error("Error loading profile:", error);
		} finally {
			setLoading(false);
		}
	};

	const loadTabData = async (tab: TabType, forceReload = false) => {
		if (!profile) return;

		// If tab is already loaded and not forcing reload, skip
		if (!forceReload && loadedTabs.has(tab)) {
			return;
		}

		setLoadingGames(true);
		try {
			if (tab === "created") {
				const games = await fetchCreatedGames(profile.uid, 50);
				setCreatedGames(games);
			} else if (tab === "completed") {
				const history = await fetchGameHistory(profile.uid, {
					action: "completed",
					limit: 50,
				});
				setCompletedGames(history);
			} else if (tab === "attempted") {
				// Fetch both attempted and skipped
				const attempted = await fetchGameHistory(profile.uid, {
					action: "attempted",
					limit: 50,
				});
				const skipped = await fetchGameHistory(profile.uid, {
					action: "skipped",
					limit: 50,
				});
				// Combine and sort by timestamp
				const combined = [...attempted, ...skipped].sort(
					(a, b) => b.timestamp.getTime() - a.timestamp.getTime()
				);
				setAttemptedGames(combined.slice(0, 50));
			}
			// Mark tab as loaded
			setLoadedTabs((prev) => new Set(prev).add(tab));
		} catch (error) {
			console.error("Error loading tab data:", error);
		} finally {
			setLoadingGames(false);
		}
	};

	// Load tab data when tab changes (only if not already loaded)
	useEffect(() => {
		if (profile && !loadedTabs.has(activeTab)) {
			loadTabData(activeTab, false);
		}
	}, [activeTab, profile]);

	const handleRefresh = async () => {
		setRefreshing(true);
		// Reload profile
		await loadProfile();
		// Force reload current tab
		await loadTabData(activeTab, true);
		setRefreshing(false);
	};

	const handleFollow = async () => {
		if (!currentUser || !profile || isOwnProfile) return;

		setLoadingFollow(true);
		try {
			if (isFollowingUser) {
				await unfollowUser(currentUser.uid, profile.uid);
				setIsFollowingUser(false);
				// Update follower count immediately
				setProfile({
					...profile,
					followerCount: Math.max(0, (profile.followerCount || 0) - 1),
				});
				// Refresh profile data to get accurate counts
				await loadProfile();
			} else {
				// Check if already following before attempting
				const alreadyFollowing = await isFollowing(currentUser.uid, profile.uid);
				if (alreadyFollowing) {
					setIsFollowingUser(true);
					return;
				}
				await followUser(currentUser.uid, profile.uid);
				
				// Small delay to ensure Firestore has propagated the change
				await new Promise(resolve => setTimeout(resolve, 500));
				
				// Verify the follow was successful
				const verifyFollowing = await isFollowing(currentUser.uid, profile.uid);
				if (!verifyFollowing) {
					console.error("[handleFollow] Follow action completed but relationship not found - retrying check");
					// Retry once more after a longer delay
					await new Promise(resolve => setTimeout(resolve, 1000));
					const retryFollowing = await isFollowing(currentUser.uid, profile.uid);
					if (!retryFollowing) {
						console.error("[handleFollow] Follow relationship still not found after retry");
						console.error(`[handleFollow] Checking Firestore path: users/${currentUser.uid}/following/${profile.uid}`);
					}
					setIsFollowingUser(retryFollowing);
				} else {
					setIsFollowingUser(true);
				}
				
				// Update follower count immediately
				setProfile({
					...profile,
					followerCount: (profile.followerCount || 0) + 1,
				});
				// Refresh profile data to get accurate counts
				await loadProfile();
			}
		} catch (error: any) {
			console.error("Error following/unfollowing:", error);
			// Don't show error to user for "already following" - it's handled gracefully
			if (error.message && error.message.includes("Already following")) {
				setIsFollowingUser(true);
			}
		} finally {
			setLoadingFollow(false);
		}
	};

	const handleGamePress = (game: GameSummary | GameHistoryEntry) => {
		const gameId = game.gameId;

		// Check if gameId is already a full puzzleId (format: gameType_difficulty_actualId)
		// GameHistoryEntry stores the full puzzleId, while GameSummary stores just the document ID
		const parts = gameId.split("_");
		let puzzleId: string;

		if (parts.length >= 3) {
			// Already a full puzzleId (GameHistoryEntry case)
			puzzleId = gameId;
		} else {
			// Need to construct puzzleId (GameSummary case)
			const gameType = "gameType" in game ? game.gameType : game.category || "";
			const difficulty =
				"difficulty" in game ? game.difficulty : game.difficulty || "";
			puzzleId = `${gameType}_${difficulty}_${gameId}`;
		}

		// Use href format for Expo Router dynamic routes
		router.push({
			pathname: "/play-game/[gameId]",
			params: { gameId: puzzleId },
		} as any);
	};

	const renderGameCard = (
		item: GameSummary | GameHistoryEntry,
		index: number
	) => {
		const gameType =
			"gameType" in item ? item.gameType : item.category || "wordle";
		const gameColor = getGameColor(gameType as PuzzleType);
		const cardWidth = (SCREEN_WIDTH - Layout.margin * 2 - Spacing.sm * 2) / 3;

		return (
			<TouchableOpacity
				key={index}
				style={[styles.gameCard, { width: cardWidth, borderColor: gameColor }]}
				onPress={() => handleGamePress(item)}
				activeOpacity={0.7}
			>
				<View style={[styles.gameIconContainer, { backgroundColor: gameColor + "20" }]}>
					<Ionicons
						name={getGameIcon(gameType)}
						size={32}
						color={gameColor}
					/>
				</View>
				<Text style={styles.gameTypeText} numberOfLines={1}>
					{formatGameType(gameType)}
				</Text>
				{"playCount" in item && item.playCount > 0 && (
					<Text style={styles.playCountText}>{item.playCount} plays</Text>
				)}
			</TouchableOpacity>
		);
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Profile</Text>
					<View style={styles.headerSpacer} />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			</View>
		);
	}

	if (!profile) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Profile</Text>
					<View style={styles.headerSpacer} />
				</View>
				<View style={styles.loadingContainer}>
					<Text style={styles.errorText}>User not found</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>{profile.username}</Text>
				<TouchableOpacity style={styles.menuButton}>
					<Ionicons name="ellipsis-horizontal" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={{
					paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
				}}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={handleRefresh}
						tintColor={Colors.accent}
						colors={[Colors.accent]}
					/>
				}
			>
				{/* Profile Header */}
				<View style={styles.profileHeader}>
					<View style={styles.avatarContainer}>
						{profile.profilePicture ? (
							<Image
								source={{ uri: profile.profilePicture }}
								style={styles.avatar}
							/>
						) : (
							<Ionicons name="person-circle" size={100} color={Colors.accent} />
						)}
					</View>

					<Text style={styles.usernameText}>{profile.username}</Text>

					{/* Stats Row 1 - Following, Followers, Games Created */}
					<View style={styles.statsRow}>
						<TouchableOpacity
							style={styles.statItem}
							onPress={() =>
								router.push(
									`/followers-following?type=following&userId=${profile.uid}&username=${profile.username || ""}`
								)
							}
						>
							<Text style={styles.statNumber}>
								{profile.followingCount || 0}
							</Text>
							<Text style={styles.statLabel}>Following</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.statItem}
							onPress={() =>
								router.push(
									`/followers-following?type=followers&userId=${profile.uid}&username=${profile.username || ""}`
								)
							}
						>
							<Text style={styles.statNumber}>
								{profile.followerCount || 0}
							</Text>
							<Text style={styles.statLabel}>Followers</Text>
						</TouchableOpacity>
						<View style={styles.statItem}>
							<Text style={styles.statNumber}>
								{profile.createdGamesCount || 0}
							</Text>
							<Text style={styles.statLabel}>Games</Text>
						</View>
					</View>

					{/* Stats Row 2 - Completed, Streak, Avg Time */}
					<View style={styles.statsRow}>
						<View style={styles.statItem}>
							<Text style={styles.statNumber}>
								{profile.totalGamesPlayed || 0}
							</Text>
							<Text style={styles.statLabel}>Completed</Text>
						</View>
						<View style={styles.statItem}>
							<Text style={styles.statNumber}>
								{profile.streakCount || 0}
							</Text>
							<Text style={styles.statLabel}>Streak</Text>
						</View>
						<View style={styles.statItem}>
							<Text style={styles.statNumber}>
								{formatTime(profile.averageTimePerGame || 0)}
							</Text>
							<Text style={styles.statLabel}>Avg Time</Text>
						</View>
					</View>

					{/* Follow/Edit Button */}
					{isOwnProfile ? (
						<TouchableOpacity
							style={styles.editButton}
							onPress={() => router.push("/profile")}
						>
							<Text style={styles.editButtonText}>Edit Profile</Text>
						</TouchableOpacity>
					) : (
						<TouchableOpacity
							style={[
								styles.followButton,
								isFollowingUser && styles.followingButton,
							]}
							onPress={handleFollow}
							disabled={loadingFollow}
						>
							{loadingFollow ? (
								<ActivityIndicator
									size="small"
									color={isFollowingUser ? Colors.text.primary : Colors.text.white}
								/>
							) : (
								<Text
									style={[
										styles.followButtonText,
										isFollowingUser && styles.followingButtonText,
									]}
								>
									{isFollowingUser ? "Following" : "Follow"}
								</Text>
							)}
						</TouchableOpacity>
					)}

					{/* Bio */}
					{profile.bio && (
						<Text style={styles.bioText}>{profile.bio}</Text>
					)}
				</View>

				{/* Tabs */}
				<View style={styles.tabContainer}>
					<TouchableOpacity
						style={[styles.tab, activeTab === "created" && styles.activeTab]}
						onPress={() => setActiveTab("created")}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "created" && styles.activeTabText,
							]}
						>
							Created
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === "completed" && styles.activeTab]}
						onPress={() => setActiveTab("completed")}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "completed" && styles.activeTabText,
							]}
						>
							Completed
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === "attempted" && styles.activeTab]}
						onPress={() => setActiveTab("attempted")}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "attempted" && styles.activeTabText,
							]}
						>
							Attempted
						</Text>
					</TouchableOpacity>
				</View>

				{/* Game Grid */}
				{loadingGames ? (
					<View style={styles.loadingGamesContainer}>
						<ActivityIndicator size="small" color={Colors.accent} />
					</View>
				) : (
					<View style={styles.gameGrid}>
						{activeTab === "created" &&
							createdGames.map((game, index) => renderGameCard(game, index))}
						{activeTab === "completed" &&
							completedGames.map((game, index) => renderGameCard(game, index))}
						{activeTab === "attempted" &&
							attemptedGames.map((game, index) => renderGameCard(game, index))}
					</View>
				)}

				{/* Empty State */}
				{!loadingGames &&
					((activeTab === "created" && createdGames.length === 0) ||
						(activeTab === "completed" && completedGames.length === 0) ||
						(activeTab === "attempted" && attemptedGames.length === 0)) && (
						<View style={styles.emptyState}>
							<Ionicons
								name="game-controller-outline"
								size={48}
								color={Colors.text.secondary}
							/>
							<Text style={styles.emptyStateText}>
								No {activeTab} games yet
							</Text>
						</View>
					)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	headerSpacer: {
		width: 40,
	},
	menuButton: {
		padding: Spacing.xs,
	},
	content: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	errorText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
	},
	profileHeader: {
		alignItems: "center",
		paddingVertical: Spacing.xl,
		backgroundColor: Colors.background.primary,
		marginBottom: Spacing.md,
	},
	avatarContainer: {
		marginBottom: Spacing.md,
	},
	avatar: {
		width: 100,
		height: 100,
		borderRadius: 50,
	},
	usernameText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
	},
	statsRow: {
		flexDirection: "row",
		justifyContent: "space-around",
		width: "100%",
		paddingHorizontal: Layout.margin,
		marginBottom: Spacing.lg,
	},
	statItem: {
		alignItems: "center",
	},
	statNumber: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	statLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	followButton: {
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.md,
		minWidth: 120,
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	followingButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary,
	},
	followButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.white,
	},
	followingButtonText: {
		color: Colors.text.primary,
	},
	editButton: {
		backgroundColor: Colors.background.secondary,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.xl,
		borderRadius: BorderRadius.md,
		minWidth: 120,
		alignItems: "center",
		marginBottom: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.text.secondary,
	},
	editButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	bioText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		paddingHorizontal: Layout.margin,
	},
	tabContainer: {
		flexDirection: "row",
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		marginBottom: Spacing.md,
	},
	tab: {
		flex: 1,
		paddingVertical: Spacing.md,
		alignItems: "center",
		borderBottomWidth: 2,
		borderBottomColor: "transparent",
	},
	activeTab: {
		borderBottomColor: Colors.accent,
	},
	tabText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	activeTabText: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	gameGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		paddingHorizontal: Layout.margin,
		justifyContent: "space-between",
	},
	gameCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.sm,
		alignItems: "center",
		borderWidth: 2,
		...Shadows.light,
	},
	gameIconContainer: {
		width: 60,
		height: 60,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	gameTypeText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
	},
	playCountText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	loadingGamesContainer: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyState: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyStateText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
});

export default CreatorProfileScreen;

