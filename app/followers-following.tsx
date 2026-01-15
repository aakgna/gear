import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	RefreshControl,
	Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import MinimalHeader from "../components/MinimalHeader";
import TikTokButton from "../components/TikTokButton";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import {
	fetchFollowers,
	fetchFollowing,
	followUser,
	unfollowUser,
	isFollowing,
	fetchUserProfile,
	UserSummary,
} from "../config/social";
import { getCurrentUser } from "../config/auth";
import { useSessionEndRefresh } from "../utils/sessionRefresh";

const FollowersFollowingScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{
		type: string;
		userId?: string;
		username?: string;
	}>();
	const { type, userId, username } = params;

	const [users, setUsers] = useState<UserSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
	const [loadingFollow, setLoadingFollow] = useState<Record<string, boolean>>(
		{}
	);

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);
	const [profileUsername, setProfileUsername] = useState<string>("");

	const currentUser = getCurrentUser();
	const currentUid = currentUser?.uid || "";
	// Use provided userId or default to current user
	const targetUserId = userId || currentUid;

	// Determine if we're viewing followers or following
	const isFollowersList = type === "followers";
	const title = isFollowersList ? "Followers" : "Following";

	// Load profile owner's username
	useEffect(() => {
		const loadProfileUsername = async () => {
			if (username) {
				setProfileUsername(username);
			} else if (targetUserId) {
				try {
					const profile = await fetchUserProfile(targetUserId);
					if (profile?.username) {
						setProfileUsername(profile.username);
					}
				} catch (error) {
					console.error(
						"[FollowersFollowing] Error loading profile username:",
						error
					);
				}
			}
		};
		loadProfileUsername();
	}, [targetUserId, username]);

	// Load users list
	const loadUsers = useCallback(
		async (isRefresh = false) => {
			if (!targetUserId) return;

			if (isRefresh) {
				setRefreshing(true);
			} else {
				setLoading(true);
			}

			try {
				let fetchedUsers: UserSummary[] = [];
				if (isFollowersList) {
					fetchedUsers = await fetchFollowers(targetUserId, 100);
				} else {
					fetchedUsers = await fetchFollowing(targetUserId, 100);
				}

				setUsers(fetchedUsers);

				// Check follow status for each user
				const followStatus: Record<string, boolean> = {};
				for (const user of fetchedUsers) {
					if (user.uid !== currentUid) {
						followStatus[user.uid] = await isFollowing(currentUid, user.uid);
					}
				}
				setFollowingMap(followStatus);
			} catch (error) {
				console.error(`[${title}] Error loading users:`, error);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[targetUserId, isFollowersList, title, currentUid]
	);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleFollow = async (targetUid: string) => {
		if (loadingFollow[targetUid]) return;

		setLoadingFollow((prev) => ({ ...prev, [targetUid]: true }));

		try {
			const alreadyFollowing = followingMap[targetUid];
			if (alreadyFollowing) {
				await unfollowUser(currentUid, targetUid);
				setFollowingMap((prev) => ({ ...prev, [targetUid]: false }));
			} else {
				await followUser(currentUid, targetUid);
				setFollowingMap((prev) => ({ ...prev, [targetUid]: true }));
			}
		} catch (error) {
			console.error("[FollowersFollowing] Error toggling follow:", error);
		} finally {
			setLoadingFollow((prev) => {
				const next = { ...prev };
				delete next[targetUid];
				return next;
			});
		}
	};

	const handleUserPress = (user: UserSummary) => {
		if (user.username) {
			router.push(`/user/${user.username}`);
		}
	};

	const renderUserItem = useCallback(
		({ item }: { item: UserSummary }) => {
			const isCurrentUser = item.uid === currentUid;
			const isFollowingUser = followingMap[item.uid] || false;
			const isLoading = loadingFollow[item.uid] || false;

			return (
				<TouchableOpacity
					style={styles.userItem}
					onPress={() => handleUserPress(item)}
					activeOpacity={0.7}
				>
					{/* Profile Picture */}
					<View style={styles.avatarContainer}>
						{item.profilePicture ? (
							<Image
								source={{ uri: item.profilePicture }}
								style={styles.avatar}
							/>
						) : (
							<View style={styles.avatarPlaceholder}>
								<Ionicons
									name="person"
									size={24}
									color={Colors.text.secondary}
								/>
							</View>
						)}
					</View>

					{/* User Info */}
					<View style={styles.userInfo}>
						<Text style={styles.username} numberOfLines={1}>
							{item.username || "Unknown"}
						</Text>
						{item.bio && (
							<Text style={styles.bio} numberOfLines={1}>
								{item.bio}
							</Text>
						)}
					</View>

					{/* Follow Button */}
					{!isCurrentUser &&
						(isFollowingUser ? (
							<TikTokButton
								label="Following"
								onPress={() => handleFollow(item.uid)}
								disabled={isLoading}
								variant="secondary"
							/>
						) : (
							<TikTokButton
								label="Follow"
								onPress={() => handleFollow(item.uid)}
								disabled={isLoading}
								variant="primary"
							/>
						))}
				</TouchableOpacity>
			);
		},
		[currentUid, followingMap, handleFollow, handleUserPress]
	);

	if (loading && !refreshing) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<MinimalHeader
					title={profileUsername ? `${profileUsername}'s ${title}` : title}
				/>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			<MinimalHeader
				title={profileUsername ? `${profileUsername}'s ${title}` : title}
			/>

			{/* Users List */}
			<FlatList
				data={users}
				renderItem={renderUserItem}
				keyExtractor={(item) => item.uid}
				contentContainerStyle={styles.listContent}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => loadUsers(true)}
						tintColor={Colors.accent}
					/>
				}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyText}>
							{isFollowersList
								? "No followers yet"
								: "Not following anyone yet"}
						</Text>
					</View>
				}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	listContent: {
		paddingVertical: Spacing.sm,
	},
	userItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Layout.margin,
		paddingVertical: Spacing.md,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
	},
	avatarContainer: {
		marginRight: Spacing.md,
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: Colors.background.secondary,
	},
	avatarPlaceholder: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: Colors.background.secondary,
		alignItems: "center",
		justifyContent: "center",
	},
	userInfo: {
		flex: 1,
		marginRight: Spacing.md,
	},
	username: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	bio: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyContainer: {
		padding: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
	},
});

export default FollowersFollowingScreen;
