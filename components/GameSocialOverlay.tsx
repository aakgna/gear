import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	TouchableOpacity,
	Text,
	Image,
	ActivityIndicator,
	Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import {
	isFollowing,
	followUser,
	unfollowUser,
	checkGameLiked,
	likeGame,
	unlikeGame,
	getCachedSocialData,
	getCachedExtendedSocialData,
} from "../config/social";
import { Puzzle } from "../config/types";
import { db, parsePuzzleId, docExists } from "../config/firebase";

import { GameResult } from "../config/types";

interface GameSocialOverlayProps {
	puzzle: Puzzle;
	gameId: string;
	completedResult?: GameResult | null;
	onCommentPress: () => void;
	onSharePress: () => void;
	onShareCompletion?: () => void;
	visible?: boolean; // Controls visibility - component mounts early but can be hidden
	prefetchedData?: {
		likeCount: number;
		commentCount: number;
		isLiked: boolean;
		isFollowing: boolean | undefined;
	} | null; // Data prefetched by GameWrapper - eliminates need to fetch
}

const GameSocialOverlay: React.FC<GameSocialOverlayProps> = ({
	puzzle,
	gameId,
	completedResult,
	onCommentPress,
	onSharePress,
	onShareCompletion,
	visible = true, // Default to visible for backwards compatibility
	prefetchedData, // Data passed from GameWrapper - instant display!
}) => {
	const router = useRouter();
	const currentUser = getCurrentUser();
	const [isFollowingCreator, setIsFollowingCreator] = useState(false);
	const [isLiked, setIsLiked] = useState(false);
	const [likeCount, setLikeCount] = useState(0);
	const [commentCount, setCommentCount] = useState(0);
	const [loadingFollow, setLoadingFollow] = useState(false);
	const [loadingLike, setLoadingLike] = useState(false);
	const [loading, setLoading] = useState(true);
	const [showShareMenu, setShowShareMenu] = useState(false);

	const creatorId = puzzle.uid;
	const creatorUsername = puzzle.username;
	const creatorProfilePicture = puzzle.profilePicture;

	// Use prefetched data if provided (bridges gap from GameWrapper)
	// This eliminates all fetching in this component - instant display!
	useEffect(() => {
		if (prefetchedData) {
			// Data already fetched by GameWrapper - use it immediately!
			setLikeCount(prefetchedData.likeCount);
			setCommentCount(prefetchedData.commentCount);
			setIsLiked(prefetchedData.isLiked);
			if (prefetchedData.isFollowing !== undefined) {
				setIsFollowingCreator(prefetchedData.isFollowing);
			}
			setLoading(false);
			return; // Instant - no fetching needed!
		}
	}, [prefetchedData]); // Update immediately when prefetchedData changes

	// Fallback: Fetch data if not prefetched (backwards compatibility)
	useEffect(() => {
		// Skip if we have prefetched data (handled by effect above)
		if (prefetchedData) {
			return;
		}

		// Fallback: Fetch data if not prefetched (backwards compatibility)
		if (!currentUser) {
			setLoading(false);
			return;
		}

		// Check extended cache first (includes counts + status) - INSTANT if prefetched
		const cachedExtended = getCachedExtendedSocialData(
			gameId,
			currentUser.uid,
			creatorId
		);
		if (cachedExtended) {
			// All data cached - set everything immediately
			setLikeCount(cachedExtended.likeCount);
			setCommentCount(cachedExtended.commentCount);
			setIsLiked(cachedExtended.isLiked);
			if (cachedExtended.isFollowing !== undefined) {
				setIsFollowingCreator(cachedExtended.isFollowing);
			}
			setLoading(false);
			return; // Instant load from cache!
		}

		// Fallback: Check basic cache (counts only)
		const cachedBasic = getCachedSocialData(gameId);
		if (cachedBasic) {
			setLikeCount(cachedBasic.likeCount);
			setCommentCount(cachedBasic.commentCount);
			setLoading(false); // Counts loaded, but still need status
		}

		// Parse gameId to get Firestore path
		const parsed = parsePuzzleId(gameId);
		if (!parsed) {
			console.error("[GameSocialOverlay] Failed to parse gameId:", gameId);
			setLoading(false);
			return;
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		// Fetch ALL data in parallel (not sequential!)
		const fetchAllData = async () => {
			try {
				// Build parallel promises
				const promises: Promise<any>[] = [];

				// Only fetch counts if not cached
				if (!cachedBasic) {
					promises.push(
						(async () => {
							const doc = await gameRef.get();
							if (docExists(doc)) {
								const data = doc.data();
								const stats = data?.stats || {};
								let likeCount = 0;
								let commentCount = 0;
								if (typeof stats.likeCount === "number") {
									likeCount = stats.likeCount;
								} else {
									const likesSnapshot = await gameRef.collection("likes").get();
									likeCount = likesSnapshot.size;
								}
								if (typeof stats.commentCount === "number") {
									commentCount = stats.commentCount;
								} else {
									const commentsSnapshot = await gameRef
										.collection("comments")
										.get();
									commentCount = commentsSnapshot.size;
								}
								return { likeCount, commentCount };
							}
							return { likeCount: 0, commentCount: 0 };
						})()
					);
				}

				// Always fetch like status (if not in extended cache)
				if (!cachedExtended) {
					promises.push(
						checkGameLiked(gameId, currentUser.uid).catch(() => false)
					);
				}

				// Fetch follow status if needed (if not in extended cache)
				if (!cachedExtended && creatorId && currentUser.uid !== creatorId) {
					promises.push(
						isFollowing(currentUser.uid, creatorId).catch(() => false)
					);
				}

				// Execute all fetches in parallel
				const results = await Promise.all(promises);
				let resultIndex = 0;

				// Process counts if fetched
				if (!cachedBasic && results.length > 0) {
					const counts = results[resultIndex++];
					setLikeCount(counts.likeCount);
					setCommentCount(counts.commentCount);
				}

				// Process like status if fetched
				if (!cachedExtended && resultIndex < results.length) {
					setIsLiked(results[resultIndex++]);
				}

				// Process follow status if fetched
				if (
					!cachedExtended &&
					creatorId &&
					currentUser.uid !== creatorId &&
					resultIndex < results.length
				) {
					setIsFollowingCreator(results[resultIndex++]);
				}
			} catch (error) {
				console.error("[GameSocialOverlay] Error loading data:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchAllData();
	}, [gameId, creatorId, currentUser, prefetchedData]); // Include prefetchedData - use it if available

	const handleFollowPress = async () => {
		if (!currentUser || !creatorId || currentUser.uid === creatorId) return;

		setLoadingFollow(true);
		try {
			if (isFollowingCreator) {
				// Unfollow the creator
				await unfollowUser(currentUser.uid, creatorId);
				setIsFollowingCreator(false);
			} else {
				// Follow the creator
				await followUser(currentUser.uid, creatorId);
				setIsFollowingCreator(true);
			}
		} catch (error) {
			console.error("[GameSocialOverlay] Error following/unfollowing:", error);
		} finally {
			setLoadingFollow(false);
		}
	};

	const handleCreatorPress = () => {
		if (creatorUsername) {
			router.push(`/user/${creatorUsername}`);
		} else if (creatorId) {
			router.push(`/user/${creatorId}`);
		}
	};

	const handleLikePress = async () => {
		if (!currentUser) return;

		setLoadingLike(true);
		try {
			if (isLiked) {
				await unlikeGame(gameId, currentUser.uid);
				setIsLiked(false);
				setLikeCount((prev) => Math.max(0, prev - 1));
			} else {
				await likeGame(gameId, currentUser.uid);
				setIsLiked(true);
				setLikeCount((prev) => prev + 1);
			}
		} catch (error) {
			console.error("[GameSocialOverlay] Error liking:", error);
		} finally {
			setLoadingLike(false);
		}
	};

	if (!currentUser) {
		return null;
	}

	// Hide component if not visible (but keep it mounted for prefetching)
	if (!visible) {
		return null;
	}

	// Show component even while loading (with 0 counts) so it appears immediately
	const isOwnGame = currentUser.uid === creatorId;

	return (
		<View style={styles.container}>
			{/* Creator Profile Button - TikTok style, always visible if creatorId exists */}
			{creatorId && (
				<View style={styles.creatorButton}>
					<View style={styles.avatarContainer}>
						{/* Avatar - navigates to profile */}
						<TouchableOpacity
							onPress={handleCreatorPress}
							activeOpacity={0.7}
							style={styles.avatarTouchable}
						>
							{creatorProfilePicture ? (
								<Image
									source={{ uri: creatorProfilePicture }}
									style={styles.avatar}
								/>
							) : (
								<View style={styles.avatarPlaceholder}>
									<Ionicons
										name="person"
										size={28}
										color={Colors.text.secondary}
									/>
								</View>
							)}
						</TouchableOpacity>
						{/* Plus badge - follows/unfollows */}
						{!isOwnGame && (
							<TouchableOpacity
								style={styles.followBadge}
								onPress={handleFollowPress}
								activeOpacity={0.7}
								disabled={loadingFollow}
							>
								{loadingFollow ? (
									<ActivityIndicator size="small" color={Colors.text.white} />
								) : (
									<Ionicons
										name={isFollowingCreator ? "checkmark" : "add"}
										size={14}
										color={Colors.text.white}
									/>
								)}
							</TouchableOpacity>
						)}
					</View>
				</View>
			)}

			{/* Like Button */}
			<TouchableOpacity
				style={styles.actionButton}
				onPress={handleLikePress}
				activeOpacity={0.7}
				disabled={loadingLike}
			>
				{loadingLike ? (
					<ActivityIndicator size="small" color={Colors.accent} />
				) : (
					<Ionicons
						name={isLiked ? "heart" : "heart-outline"}
						size={28}
						color={isLiked ? Colors.accent : Colors.text.primary}
					/>
				)}
				<Text style={styles.actionCount}>{likeCount}</Text>
			</TouchableOpacity>

			{/* Comment Button */}
			<TouchableOpacity
				style={styles.actionButton}
				onPress={onCommentPress}
				activeOpacity={0.7}
			>
				<Ionicons
					name="chatbubble-outline"
					size={28}
					color={Colors.text.primary}
				/>
				<Text style={styles.actionCount}>{commentCount}</Text>
			</TouchableOpacity>

			{/* Share Button */}
			<TouchableOpacity
				style={styles.actionButton}
				onPress={() => setShowShareMenu(true)}
				activeOpacity={0.7}
			>
				<Ionicons
					name="share-social-outline"
					size={28}
					color={Colors.text.primary}
				/>
			</TouchableOpacity>

			{/* Share Menu Modal */}
			<Modal
				visible={showShareMenu}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowShareMenu(false)}
			>
				<TouchableOpacity
					style={styles.shareMenuOverlay}
					activeOpacity={1}
					onPress={() => setShowShareMenu(false)}
				>
					<View style={styles.shareMenuContainer}>
						<TouchableOpacity
							style={styles.shareMenuItem}
							onPress={() => {
								setShowShareMenu(false);
								onSharePress();
							}}
							activeOpacity={0.7}
						>
							<Ionicons
								name="chatbubbles-outline"
								size={24}
								color={Colors.text.primary}
							/>
							<Text style={styles.shareMenuText}>Share to DM</Text>
						</TouchableOpacity>
						{completedResult && onShareCompletion && (
							<TouchableOpacity
								style={styles.shareMenuItem}
								onPress={async () => {
									setShowShareMenu(false);
									console.log("[GameSocialOverlay] Share Result pressed");
									// Wait for modal to fully close before calling Share API
									setTimeout(async () => {
										try {
											await onShareCompletion();
										} catch (error) {
											console.error(
												"[GameSocialOverlay] Error calling onShareCompletion:",
												error
											);
										}
									}, 300); // Small delay to ensure modal is fully closed
								}}
								activeOpacity={0.7}
							>
								<Ionicons
									name="share-outline"
									size={24}
									color={Colors.text.primary}
								/>
								<Text style={styles.shareMenuText}>Share Result</Text>
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
		position: "absolute",
		right: Spacing.md,
		bottom: 120,
		alignItems: "center",
		gap: Spacing.lg,
		zIndex: 10,
	},
	creatorButton: {
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	avatarContainer: {
		position: "relative",
		width: 56,
		height: 56,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarTouchable: {
		width: 52,
		height: 52,
	},
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 26,
		borderWidth: 2,
		borderColor: Colors.background.primary,
	},
	avatarPlaceholder: {
		width: 52,
		height: 52,
		borderRadius: 26,
		backgroundColor: Colors.background.tertiary,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2,
		borderColor: Colors.background.primary,
	},
	followBadge: {
		position: "absolute",
		bottom: -2,
		right: -2,
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2.5,
		borderColor: Colors.background.primary,
	},
	actionButton: {
		alignItems: "center",
		gap: Spacing.xs,
	},
	actionCount: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	shareMenuOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	shareMenuContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.sm,
		minWidth: 200,
		...Shadows.heavy,
	},
	shareMenuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	shareMenuText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
});

export default GameSocialOverlay;
