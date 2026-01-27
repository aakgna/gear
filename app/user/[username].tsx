import React, { useState, useEffect, useRef, useCallback } from "react";
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
	Animated,
	Alert,
	Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Grid2x2Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../../components/MinimalHeader";
import TikTokButton from "../../components/TikTokButton";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
	getGameColor,
	Gradients,
} from "../../constants/DesignSystem";
import {
	getUserByUsername,
	fetchUserProfile,
	fetchCreatedGames,
	fetchLikedGames,
	fetchFollowers,
	fetchFollowing,
	followUser,
	unfollowUser,
	isFollowing,
	blockUser,
	unblockUser,
	isUserBlocked,
	isBlockedByUser,
	UserPublicProfile,
	GameSummary,
} from "../../config/social";
import { getCurrentUser } from "../../config/auth";
import { fetchGameHistory, GameHistoryEntry } from "../../config/firebase";
import { PuzzleType } from "../../config/types";
import { useSessionEndRefresh } from "../../utils/sessionRefresh";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOTTOM_NAV_HEIGHT = 70;

type TabType = "created" | "liked";

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

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);
	const [activeTab, setActiveTab] = useState<TabType>("created");
	const [createdGames, setCreatedGames] = useState<GameSummary[]>([]);
	const [likedGames, setLikedGames] = useState<GameSummary[]>([]);
	const [isFollowingUser, setIsFollowingUser] = useState(false);
	const [isOwnProfile, setIsOwnProfile] = useState(false);
	const [loadingFollow, setLoadingFollow] = useState(false);
	const [loadingGames, setLoadingGames] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [isBlocked, setIsBlocked] = useState(false);
	const [isBlockedBy, setIsBlockedBy] = useState(false);
	const [showBlockMenu, setShowBlockMenu] = useState(false);
	const [loadingBlock, setLoadingBlock] = useState(false);
	// Cache flags to track which tabs have been loaded
	const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set());
	const currentUser = getCurrentUser();

	// Tab indicator animation
	const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const tabIndex = activeTab === "created" ? 0 : 1;
		Animated.spring(tabIndicatorAnim, {
			toValue: tabIndex,
			useNativeDriver: true,
			tension: 100,
			friction: 8,
		}).start();
	}, [activeTab]);

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

			setIsOwnProfile(currentUser?.uid === userProfile.uid);

			// Check blocking status
			if (currentUser && !isOwnProfile) {
				const blocked = await isUserBlocked(currentUser.uid, userProfile.uid);
				const blockedBy = await isBlockedByUser(currentUser.uid, userProfile.uid);
				setIsBlocked(blocked);
				setIsBlockedBy(blockedBy);

				// If blocked by user, don't show profile
				if (blockedBy) {
					setLoading(false);
					return;
				}

				// Check if current user follows this profile
				const following = await isFollowing(currentUser.uid, userProfile.uid);
				setIsFollowingUser(following);
			} else if (isOwnProfile) {
				// Reset following state for own profile
				setIsFollowingUser(false);
				setIsBlocked(false);
				setIsBlockedBy(false);
			}

			setProfile(userProfile);

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
			} else if (tab === "liked") {
				const games = await fetchLikedGames(profile.uid, 50);
				setLikedGames(games);
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

	const handleBlockUser = async () => {
		if (!currentUser || !profile || isOwnProfile || loadingBlock) return;

		Alert.alert(
			"Block User",
			`Are you sure you want to block ${profile.username}? You won't be able to see their content, and they won't be able to see yours.`,
			[
				{
					text: "Cancel",
					style: "cancel",
					onPress: () => setShowBlockMenu(false),
				},
				{
					text: "Block",
					style: "destructive",
					onPress: async () => {
						setLoadingBlock(true);
						try {
							await blockUser(currentUser.uid, profile.uid);
							setShowBlockMenu(false);
							// Navigate back
							router.back();
						} catch (error) {
							console.error("[handleBlockUser] Error:", error);
							Alert.alert("Error", "Failed to block user. Please try again.");
						} finally {
							setLoadingBlock(false);
						}
					},
				},
			]
		);
	};

	const handleUnblockUser = async () => {
		if (!currentUser || !profile || isOwnProfile || loadingBlock) return;

		setLoadingBlock(true);
		try {
			await unblockUser(currentUser.uid, profile.uid);
			setIsBlocked(false);
			setShowBlockMenu(false);
			// Refresh profile to update state
			await loadProfile();
		} catch (error) {
			console.error("[handleUnblockUser] Error:", error);
			Alert.alert("Error", "Failed to unblock user. Please try again.");
		} finally {
			setLoadingBlock(false);
		}
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

	const renderGameCard = useCallback((
		item: GameSummary | GameHistoryEntry,
		index: number
	) => {
		const gameType =
			"gameType" in item ? item.gameType : item.category || "wordle";
		const gameColor = getGameColor(gameType as PuzzleType);
		const cardWidth = (SCREEN_WIDTH - Layout.margin * 2 - Spacing.sm) / 2;

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
	}, [handleGamePress]);

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
					<Text style={styles.errorText}>
						{isBlockedBy ? "Profile unavailable" : "User not found"}
					</Text>
				</View>
			</View>
		);
	}

	// If blocked by user, show unavailable message
	if (isBlockedBy && currentUser && !isOwnProfile) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<MinimalHeader title={profile.username} />
				<View style={styles.loadingContainer}>
					<Text style={styles.errorText}>Profile unavailable</Text>
				</View>
			</View>
		);
	}

	// Block menu button component
	const blockMenuButton = !isOwnProfile && currentUser ? (
		<TouchableOpacity
			style={styles.menuButton}
			onPress={() => setShowBlockMenu(true)}
			activeOpacity={0.7}
		>
			<Ionicons name="ellipsis-horizontal" size={24} color={Colors.text.primary} />
		</TouchableOpacity>
	) : null;

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			<MinimalHeader title={profile.username} rightAction={blockMenuButton} />

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

					{/* Stats Row - Following, Followers, Completed, Streak */}
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
						{/* Divider */}
						<View style={styles.statDivider} />
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
						{/* Divider */}
						<View style={styles.statDivider} />
						<View style={styles.statItem}>
							<Text style={styles.statNumber}>
								{profile.streakCount || 0}
							</Text>
							<Text style={styles.statLabel}>Streak</Text>
						</View>
					</View>

					{/* Follow/Edit Button */}
					<View style={styles.buttonContainer}>
						{isOwnProfile ? (
							<TikTokButton
								label="Edit Profile"
								onPress={() => router.push("/profile")}
								variant="outline"
								fullWidth
							/>
						) : (
							isFollowingUser ? (
								<TikTokButton
									label="Following"
									onPress={handleFollow}
									disabled={loadingFollow}
									variant="secondary"
									fullWidth
								/>
							) : (
								<TikTokButton
									label="Follow"
									onPress={handleFollow}
									disabled={loadingFollow}
									variant="primary"
									fullWidth
								/>
							)
						)}
					</View>

					{/* Bio */}
					{profile.bio && (
						<Text style={styles.bioText}>{profile.bio}</Text>
					)}
				</View>

				{/* Tabs */}
				<View style={styles.tabContainer}>
					<Animated.View
						style={[
							styles.tabIndicator,
							{
								transform: [
									{
										translateX: tabIndicatorAnim.interpolate({
											inputRange: [0, 1],
											outputRange: [0, SCREEN_WIDTH / 2],
										}),
									},
								],
							},
						]}
					>
						<LinearGradient
							colors={Gradients.primary}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={StyleSheet.absoluteFill}
						/>
					</Animated.View>
					<TouchableOpacity
						style={styles.tab}
						onPress={() => setActiveTab("created")}
						activeOpacity={0.7}
					>
						<View style={styles.tabContent}>
							<Grid2x2Plus
								size={24}
								color={
									activeTab === "created"
										? Colors.accent
										: Colors.text.secondary
								}
								style={styles.tabIcon}
							/>
							<Text
								style={[
									styles.tabText,
									activeTab === "created" && styles.activeTabText,
								]}
							>
								Created
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.tab}
						onPress={() => setActiveTab("liked")}
						activeOpacity={0.7}
					>
						<View style={styles.tabContent}>
							<Ionicons
								name={activeTab === "liked" ? "heart" : "heart-outline"}
								size={24}
								color={
									activeTab === "liked"
										? Colors.accent
										: Colors.text.secondary
								}
								style={styles.tabIcon}
							/>
							<Text
								style={[
									styles.tabText,
									activeTab === "liked" && styles.activeTabText,
								]}
							>
								Liked
							</Text>
						</View>
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
						{activeTab === "liked" &&
							likedGames.map((game, index) => renderGameCard(game, index))}
					</View>
				)}

				{/* Empty State */}
				{!loadingGames &&
					((activeTab === "created" && createdGames.length === 0) ||
						(activeTab === "liked" && likedGames.length === 0)) && (
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

			{/* Block Menu Modal */}
			<Modal
				visible={showBlockMenu}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowBlockMenu(false)}
			>
				<TouchableOpacity
					style={styles.menuOverlay}
					activeOpacity={1}
					onPress={() => setShowBlockMenu(false)}
				>
					<View style={styles.menuContainer}>
						{isBlocked ? (
							<TouchableOpacity
								style={styles.menuItem}
								onPress={handleUnblockUser}
								disabled={loadingBlock}
								activeOpacity={0.7}
							>
								<Ionicons
									name="checkmark-circle-outline"
									size={24}
									color={Colors.text.primary}
								/>
								<Text style={styles.menuItemText}>Unblock User</Text>
							</TouchableOpacity>
						) : (
							<TouchableOpacity
								style={[styles.menuItem, styles.menuItemDanger]}
								onPress={handleBlockUser}
								disabled={loadingBlock}
								activeOpacity={0.7}
							>
								<Ionicons
									name="ban-outline"
									size={24}
									color={Colors.error}
								/>
								<Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
									Block User
								</Text>
							</TouchableOpacity>
						)}
					</View>
				</TouchableOpacity>
			</Modal>
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
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	menuOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	menuContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.xs,
		minWidth: 200,
		...Shadows.medium,
	},
	menuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.sm,
	},
	menuItemDanger: {
		// Additional styling for destructive actions
	},
	menuItemText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	menuItemTextDanger: {
		color: Colors.error,
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
		paddingVertical: Spacing.lg,
		backgroundColor: Colors.background.secondary,
		marginBottom: 0,
	},
	buttonContainer: {
		paddingHorizontal: Layout.margin,
		marginTop: Spacing.md,
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
		justifyContent: "center",
		width: "100%",
		paddingHorizontal: Layout.margin,
		marginBottom: Spacing.lg,
		gap: Spacing.lg,
		alignItems: "center",
	},
	statDivider: {
		width: 1,
		height: 30,
		backgroundColor: Colors.border,
		marginHorizontal: Spacing.sm,
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
	bioText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		paddingHorizontal: Layout.margin,
	},
	tabContainer: {
		flexDirection: "row",
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		marginBottom: Spacing.sm,
		position: "relative",
		overflow: "hidden",
		paddingHorizontal: Spacing.md,
		gap: Spacing.md,
	},
	tabContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	tabIcon: {
		marginRight: 0, // Gap handles spacing
	},
	tabIndicator: {
		position: "absolute",
		bottom: 0,
		left: 0,
		width: "50%",
		height: 2,
		zIndex: 1,
	},
	tab: {
		flex: 1,
		paddingVertical: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	tabText: {
		fontSize: Typography.fontSize.caption,
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
		gap: Spacing.sm,
	},
	gameCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: 0,
		alignItems: "center",
		borderWidth: 0,
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