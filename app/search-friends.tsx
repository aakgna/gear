import React, { useState, useEffect, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	Image,
	FlatList,
} from "react-native";
import { useRouter } from "expo-router";
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
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import { getUserByUsername, isFollowing, followUser, UserPublicProfile } from "../config/social";
import { useSessionEndRefresh } from "../utils/sessionRefresh";

const BOTTOM_NAV_HEIGHT = 70;

const SearchFriendsScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<UserPublicProfile[]>([]);
	const [loading, setLoading] = useState(false);
	const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
	const currentUser = getCurrentUser();

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);

	// Debounced search
	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		const timeoutId = setTimeout(() => {
			performSearch(searchQuery.trim());
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [searchQuery]);

	// Check following status for results
	useEffect(() => {
		if (searchResults.length > 0 && currentUser) {
			checkFollowingStatus();
		}
	}, [searchResults]);

	const performSearch = async (query: string) => {
		if (!query || !currentUser) return;

		setLoading(true);
		try {
			// Search by username (exact match or starts with)
			const user = await getUserByUsername(query);
			if (user) {
				setSearchResults([user]);
			} else {
				setSearchResults([]);
			}
		} catch (error) {
			console.error("Error searching users:", error);
			setSearchResults([]);
		} finally {
			setLoading(false);
		}
	};

	const checkFollowingStatus = async () => {
		if (!currentUser) return;

		const statusMap: Record<string, boolean> = {};
		await Promise.all(
			searchResults.map(async (user) => {
				if (user.uid === currentUser.uid) {
					statusMap[user.uid] = false; // Can't follow yourself
				} else {
					const following = await isFollowing(currentUser.uid, user.uid);
					statusMap[user.uid] = following;
				}
			})
		);
		setFollowingMap(statusMap);
	};

	const handleFollow = async (user: UserPublicProfile) => {
		if (!currentUser || user.uid === currentUser.uid) return;

		try {
			// Check if already following before attempting
			const alreadyFollowing = await isFollowing(currentUser.uid, user.uid);
			if (alreadyFollowing) {
				setFollowingMap((prev) => ({ ...prev, [user.uid]: true }));
				return;
			}
			await followUser(currentUser.uid, user.uid);
			setFollowingMap((prev) => ({ ...prev, [user.uid]: true }));
			// Refresh search results to update counts if needed
			if (searchQuery.trim()) {
				await performSearch(searchQuery.trim());
			}
		} catch (error: any) {
			console.error("Error following user:", error);
			// If already following, update state
			if (error.message && error.message.includes("Already following")) {
				setFollowingMap((prev) => ({ ...prev, [user.uid]: true }));
			}
		}
	};

	const handleUserPress = (username: string) => {
		router.push(`/user/${username}`);
	};

	const renderUserCard = ({ item: user }: { item: UserPublicProfile }) => {
		const isOwnProfile = currentUser?.uid === user.uid;
		const isFollowingUser = followingMap[user.uid] || false;

		return (
			<TouchableOpacity
				style={styles.userCard}
				onPress={() => handleUserPress(user.username || "")}
			>
				<View style={styles.userCardContent}>
					{user.profilePicture ? (
						<Image
							source={{ uri: user.profilePicture }}
							style={styles.avatar}
						/>
					) : (
						<Ionicons
							name="person-circle"
							size={50}
							color={Colors.accent}
						/>
					)}
					<View style={styles.userInfo}>
						<Text style={styles.username}>{user.username}</Text>
						{user.bio && (
							<Text style={styles.bio} numberOfLines={1}>
								{user.bio}
							</Text>
						)}
					</View>
					{!isOwnProfile && (
						<TouchableOpacity
							style={[
								styles.followButton,
								isFollowingUser && styles.followingButton,
							]}
							onPress={(e) => {
								e.stopPropagation();
								if (!isFollowingUser) {
									handleFollow(user);
								}
							}}
							disabled={isFollowingUser}
						>
							<Text
								style={[
									styles.followButtonText,
									isFollowingUser && styles.followingButtonText,
								]}
							>
								{isFollowingUser ? "Following" : "Follow"}
							</Text>
						</TouchableOpacity>
					)}
				</View>
			</TouchableOpacity>
		);
	};

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
				<Text style={styles.headerTitle}>Search Friends</Text>
				<View style={styles.headerSpacer} />
			</View>

			{/* Search Bar */}
			<View style={styles.searchContainer}>
				<Ionicons
					name="search-outline"
					size={20}
					color={Colors.text.secondary}
					style={styles.searchIcon}
				/>
				<TextInput
					style={styles.searchInput}
					placeholder="Search by username..."
					placeholderTextColor={Colors.text.secondary}
					value={searchQuery}
					onChangeText={setSearchQuery}
					autoCapitalize="none"
					autoCorrect={false}
				/>
				{searchQuery.length > 0 && (
					<TouchableOpacity
						onPress={() => setSearchQuery("")}
						style={styles.clearButton}
					>
						<Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
					</TouchableOpacity>
				)}
			</View>

			{/* Results */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			) : searchQuery.trim() === "" ? (
				<View style={styles.emptyState}>
					<Ionicons
						name="search-outline"
						size={64}
						color={Colors.text.secondary}
					/>
					<Text style={styles.emptyStateText}>Start typing to search</Text>
				</View>
			) : searchResults.length === 0 ? (
				<View style={styles.emptyState}>
					<Ionicons
						name="person-outline"
						size={64}
						color={Colors.text.secondary}
					/>
					<Text style={styles.emptyStateText}>No users found</Text>
				</View>
			) : (
				<FlatList
					data={searchResults}
					renderItem={renderUserCard}
					keyExtractor={(item) => item.uid}
					contentContainerStyle={{
						paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
					}}
					showsVerticalScrollIndicator={false}
				/>
			)}
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
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		marginHorizontal: Layout.margin,
		marginTop: Spacing.md,
		marginBottom: Spacing.sm,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		...Shadows.light,
	},
	searchIcon: {
		marginRight: Spacing.sm,
	},
	searchInput: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		paddingVertical: Spacing.sm,
	},
	clearButton: {
		padding: Spacing.xs,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyState: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	emptyStateText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	userCard: {
		backgroundColor: Colors.background.primary,
		marginHorizontal: Layout.margin,
		marginBottom: Spacing.sm,
		borderRadius: BorderRadius.md,
		...Shadows.light,
	},
	userCardContent: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
		marginRight: Spacing.md,
	},
	userInfo: {
		flex: 1,
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
	followButton: {
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.xs,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	followingButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary,
	},
	followButtonText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.white,
	},
	followingButtonText: {
		color: Colors.text.primary,
	},
});

export default SearchFriendsScreen;

