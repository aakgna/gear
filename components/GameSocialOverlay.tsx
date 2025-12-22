import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	TouchableOpacity,
	Text,
	Image,
	ActivityIndicator,
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
} from "../config/social";
import { Puzzle } from "../config/types";
import { db, parsePuzzleId, docExists } from "../config/firebase";

interface GameSocialOverlayProps {
	puzzle: Puzzle;
	gameId: string;
	onCommentPress: () => void;
	onSharePress: () => void;
}

const GameSocialOverlay: React.FC<GameSocialOverlayProps> = ({
	puzzle,
	gameId,
	onCommentPress,
	onSharePress,
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

	const creatorId = puzzle.uid;
	const creatorUsername = puzzle.username;
	const creatorProfilePicture = puzzle.profilePicture;

	// Simple fetch on mount - get counts directly from game document
	useEffect(() => {
		if (!currentUser) {
			setLoading(false);
			return;
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

		// Simple one-time fetch
		const loadCounts = async () => {
			try {
				const doc = await gameRef.get();
				if (docExists(doc)) {
					const data = doc.data();
					const stats = data?.stats || {};

					// Get counts from stats field
					let likeCount = 0;
					let commentCount = 0;
					if (typeof stats.likeCount === "number") {
						likeCount = stats.likeCount;
					} else {
						// Fallback: count likes collection
						const likesSnapshot = await gameRef.collection("likes").get();
						likeCount = likesSnapshot.size;
					}
					if (typeof stats.commentCount === "number") {
						commentCount = stats.commentCount;
					} else {
						// Fallback: count comments collection
						const commentsSnapshot = await gameRef.collection("comments").get();
						commentCount = commentsSnapshot.size;
					}

					try {
						setLikeCount(likeCount);
						setCommentCount(commentCount);
					} catch (stateError) {
						console.error("Error setting state:", stateError);
					}
				} else {
					setLikeCount(0);
					setCommentCount(0);
				}
			} catch (error) {
				console.error("[GameSocialOverlay] Error loading counts:", error);
				setLikeCount(0);
				setCommentCount(0);
			} finally {
				setLoading(false);
			}
		};

		// Load follow status and like status
		const loadUserData = async () => {
			try {
				// Load follow status only if we have creatorId and it's not the current user
				if (creatorId && currentUser.uid !== creatorId) {
					const following = await isFollowing(currentUser.uid, creatorId);
					setIsFollowingCreator(following);
				}
				// Always load like status (doesn't require creatorId)
				const liked = await checkGameLiked(gameId, currentUser.uid);
				setIsLiked(liked);
			} catch (error) {
				console.error("[GameSocialOverlay] Error loading user data:", error);
			}
		};
		loadCounts();
		loadUserData();
	}, [gameId, creatorId, currentUser]);

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
				onPress={onSharePress}
				activeOpacity={0.7}
			>
				<Ionicons
					name="share-social-outline"
					size={28}
					color={Colors.text.primary}
				/>
			</TouchableOpacity>
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
});

export default GameSocialOverlay;
