import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../components/MinimalHeader";
import TikTokButton from "../components/TikTokButton";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
	Gradients,
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import {
	getUserByUsername,
	searchUsersByUsername,
	isFollowing,
	followUser,
	UserPublicProfile,
} from "../config/social";
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

	// Debounced search - increased delay for better performance
	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		const timeoutId = setTimeout(() => {
			performSearch(searchQuery.trim());
		}, 500);

		return () => clearTimeout(timeoutId);
	}, [searchQuery, performSearch]);

	// Check following status for results
	useEffect(() => {
		if (searchResults.length > 0 && currentUser) {
			checkFollowingStatus();
		}
	}, [searchResults]);

	const performSearch = useCallback(
		async (query: string) => {
			if (!query || !currentUser) return;

			setLoading(true);
			try {
				// Search by username prefix (starts with)
				const users = await searchUsersByUsername(query, 20, currentUser?.uid);
				setSearchResults(users);
			} catch (error) {
				console.error("Error searching users:", error);
				setSearchResults([]);
			} finally {
				setLoading(false);
			}
		},
		[currentUser]
	);

	const checkFollowingStatus = useCallback(async () => {
		if (!currentUser || searchResults.length === 0) return;

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
	}, [currentUser, searchResults]);

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

	const renderUserCard = useCallback(
		({ item: user }: { item: UserPublicProfile }) => {
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
							<Ionicons name="person-circle" size={50} color={Colors.accent} />
						)}
						<View style={styles.userInfo}>
							<Text style={styles.username}>{user.username}</Text>
							{user.bio && (
								<Text style={styles.bio} numberOfLines={1}>
									{user.bio}
								</Text>
							)}
						</View>
						{!isOwnProfile &&
							(isFollowingUser ? (
								<View style={styles.followingButton}>
									<Text style={styles.followingButtonText}>Following</Text>
								</View>
							) : (
								<TikTokButton
									label="Follow"
									onPress={() => handleFollow(user)}
									variant="primary"
								/>
							))}
					</View>
				</TouchableOpacity>
			);
		},
		[currentUser, followingMap, handleUserPress]
	);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			<MinimalHeader title="Search Friends" />

			{/* Search Bar */}
			<View style={styles.searchContainer}>
				<View style={styles.searchBar}>
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
							<Ionicons
								name="close-circle"
								size={20}
								color={Colors.text.secondary}
							/>
						</TouchableOpacity>
					)}
				</View>
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
					windowSize={5}
					initialNumToRender={10}
					maxToRenderPerBatch={5}
					updateCellsBatchingPeriod={50}
					removeClippedSubviews={true}
					getItemLayout={(data, index) => ({
						length: 80,
						offset: 80 * index,
						index,
					})}
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
	searchContainer: {
		paddingHorizontal: Layout.margin,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.sm,
		backgroundColor: Colors.background.primary,
	},
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		paddingHorizontal: Spacing.md,
		height: 48,
		borderWidth: 0,
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
		borderWidth: 0,
		...Shadows.light,
	},
	userCardContent: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.md,
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
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
	followingButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1.5,
		borderColor: Colors.border,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.md,
		minWidth: 80,
		alignItems: "center",
		justifyContent: "center",
	},
	followingButtonText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},
});

export default SearchFriendsScreen;
