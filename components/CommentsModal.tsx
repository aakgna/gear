import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	FlatList,
	Modal,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
	Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import {
	fetchGameComments,
	addGameComment,
	likeGameComment,
	unlikeGameComment,
	getBlockedUsers,
	GameComment,
} from "../config/social";
import { db } from "../config/firebase";
import { parsePuzzleId } from "../config/firebase";
import { getCachedBlockedUsers } from "../config/blockedUsersCache";

interface CommentsModalProps {
	visible: boolean;
	gameId: string;
	onClose: () => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
	visible,
	gameId,
	onClose,
}) => {
	const insets = useSafeAreaInsets();
	const currentUser = getCurrentUser();
	const [comments, setComments] = useState<GameComment[]>([]);
	const [newComment, setNewComment] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [likingComments, setLikingComments] = useState<Set<string>>(new Set());

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		if (visible) {
			loadComments();
			unsubscribe = setupListener();
		} else {
			setComments([]);
			setNewComment("");
		}

		return () => {
			// Cleanup listener when component unmounts or modal closes
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [visible, gameId]);

	const loadComments = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			const fetchedComments = await fetchGameComments(gameId, 100);
			// Filter out comments from blocked users (using cache)
			const blockedSet = await getCachedBlockedUsers(currentUser.uid);
			const filteredComments = fetchedComments.filter(
				(comment) => !blockedSet.has(comment.userId)
			);
			setComments(filteredComments);
		} catch (error) {
			console.error("[CommentsModal] Error loading comments:", error);
		} finally {
			setLoading(false);
		}
	};

	const setupListener = (): (() => void) | undefined => {
		const parsed = parsePuzzleId(gameId);
		if (!parsed) return undefined;

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const commentsRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("comments")
			.orderBy("createdAt", "desc")
			.limit(100);

		// Set up real-time listener
		const unsubscribe = commentsRef.onSnapshot(
			async (snapshot) => {
				const updatedComments: GameComment[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data();
					updatedComments.push({
						id: doc.id,
						userId: data.userId,
						username: data.username || "",
						profilePicture: data.profilePicture || null,
						text: data.text,
						createdAt: data.createdAt?.toDate() || new Date(),
						likes: data.likes || 0,
						likedBy: data.likedBy || [],
					});
				});
				// Filter out comments from blocked users (using cache)
				if (currentUser) {
					const blockedSet = await getCachedBlockedUsers(currentUser.uid);
					const filteredComments = updatedComments.filter(
						(comment) => !blockedSet.has(comment.userId)
					);
					setComments(filteredComments.reverse()); // Show oldest first
				} else {
					setComments(updatedComments.reverse()); // Show oldest first
				}
			},
			(error) => {
				console.error("[CommentsModal] Listener error:", error);
			}
		);

		return unsubscribe;
	};

	const handleSubmitComment = async () => {
		if (!currentUser || !newComment.trim()) return;

		setSubmitting(true);
		try {
			await addGameComment(gameId, currentUser.uid, newComment.trim());
			setNewComment("");
		} catch (error) {
			console.error("[CommentsModal] Error submitting comment:", error);
		} finally {
			setSubmitting(false);
		}
	};

	const handleLikeComment = async (commentId: string) => {
		if (!currentUser) return;

		if (likingComments.has(commentId)) return;
		setLikingComments((prev) => new Set(prev).add(commentId));

		try {
			const comment = comments.find((c) => c.id === commentId);
			if (!comment) return;

			const isLiked = comment.likedBy?.includes(currentUser.uid) || false;

			if (isLiked) {
				await unlikeGameComment(gameId, commentId, currentUser.uid);
			} else {
				await likeGameComment(gameId, commentId, currentUser.uid);
			}
		} catch (error) {
			console.error("[CommentsModal] Error liking comment:", error);
		} finally {
			setLikingComments((prev) => {
				const next = new Set(prev);
				next.delete(commentId);
				return next;
			});
		}
	};

	const formatTimestamp = (timestamp: Date): string => {
		const now = new Date();
		const diffMs = now.getTime() - timestamp.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return timestamp.toLocaleDateString();
	};

	const renderComment = ({ item }: { item: GameComment }) => {
		const isLiked =
			currentUser && (item.likedBy?.includes(currentUser.uid) || false);
		const isLiking = likingComments.has(item.id);

		return (
			<View style={styles.commentItem}>
				<View style={styles.commentHeader}>
					{item.profilePicture ? (
						<Image
							source={{ uri: item.profilePicture }}
							style={styles.commentAvatar}
						/>
					) : (
						<Ionicons
							name="person-circle"
							size={32}
							color={Colors.text.secondary}
						/>
					)}
					<View style={styles.commentContent}>
						<Text style={styles.commentUsername}>{item.username}</Text>
						<Text style={styles.commentText}>{item.text}</Text>
						<View style={styles.commentFooter}>
							<Text style={styles.commentTime}>
								{formatTimestamp(item.createdAt)}
							</Text>
							<TouchableOpacity
								style={styles.commentLikeButton}
								onPress={() => handleLikeComment(item.id)}
								disabled={isLiking}
							>
								{isLiking ? (
									<ActivityIndicator size="small" color={Colors.accent} />
								) : (
									<Ionicons
										name={isLiked ? "heart" : "heart-outline"}
										size={16}
										color={isLiked ? Colors.accent : Colors.text.secondary}
									/>
								)}
								{item.likes > 0 && (
									<Text
										style={[
											styles.commentLikeCount,
											{ color: isLiked ? Colors.accent : Colors.text.secondary },
										]}
									>
										{item.likes}
									</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</View>
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={true}
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				style={styles.modalContainer}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<View style={styles.modalContent}>
					{/* Header */}
					<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
						<Text style={styles.headerTitle}>Comments</Text>
						<TouchableOpacity onPress={onClose} style={styles.closeButton}>
							<Ionicons name="close" size={24} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>

					{/* Comments List */}
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={Colors.accent} />
						</View>
					) : (
						<FlatList
							data={comments}
							renderItem={renderComment}
							keyExtractor={(item) => item.id}
							contentContainerStyle={styles.commentsList}
							ListEmptyComponent={
								<View style={styles.emptyContainer}>
									<Text style={styles.emptyText}>No comments yet</Text>
									<Text style={styles.emptySubtext}>
										Be the first to comment!
									</Text>
								</View>
							}
						/>
					)}

					{/* Input Area */}
					{currentUser && (
						<View
							style={[
								styles.inputContainer,
								{ paddingBottom: insets.bottom + Spacing.sm },
							]}
						>
							<TextInput
								style={styles.input}
								placeholder="Add a comment..."
								placeholderTextColor={Colors.text.secondary}
								value={newComment}
								onChangeText={setNewComment}
								multiline
								maxLength={500}
							/>
							<TouchableOpacity
								style={[
									styles.sendButton,
									(!newComment.trim() || submitting) && styles.sendButtonDisabled,
								]}
								onPress={handleSubmitComment}
								disabled={!newComment.trim() || submitting}
							>
								{submitting ? (
									<ActivityIndicator size="small" color={Colors.text.white} />
								) : (
									<Ionicons name="send" size={20} color={Colors.text.white} />
								)}
							</TouchableOpacity>
						</View>
					)}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	modalContent: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		marginTop: "20%",
		borderTopLeftRadius: BorderRadius.xl,
		borderTopRightRadius: BorderRadius.xl,
		...Shadows.heavy,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	commentsList: {
		padding: Layout.margin,
	},
	commentItem: {
		marginBottom: Spacing.lg,
	},
	commentHeader: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	commentAvatar: {
		width: 32,
		height: 32,
		borderRadius: 16,
	},
	commentContent: {
		flex: 1,
	},
	commentUsername: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xxs,
	},
	commentText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	commentFooter: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	commentTime: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
	},
	commentLikeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xxs,
	},
	commentLikeCount: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.medium,
	},
	emptyContainer: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	emptySubtext: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	inputContainer: {
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: Layout.margin,
		paddingTop: Spacing.md,
		borderTopWidth: 1,
		borderTopColor: "#E5E5E5",
		gap: Spacing.sm,
	},
	input: {
		flex: 1,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		maxHeight: 100,
	},
	sendButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
	},
	sendButtonDisabled: {
		opacity: 0.5,
	},
});

export default CommentsModal;

