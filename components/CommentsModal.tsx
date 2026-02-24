import React, { useState, useEffect, useRef } from "react";
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
	Animated,
	Alert,
} from "react-native";
import LeoProfanity from "leo-profanity";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import { getCurrentUser, getUserData } from "../config/auth";
import auth from "@react-native-firebase/auth";
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
	onCommentAdded?: () => void; // Callback when a comment is successfully added
}

const CommentsModal: React.FC<CommentsModalProps> = ({
	visible,
	gameId,
	onClose,
	onCommentAdded,
}) => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const currentUser = getCurrentUser();
	const [comments, setComments] = useState<GameComment[]>([]);
	const [newComment, setNewComment] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [reportModalVisible, setReportModalVisible] = useState(false);
	const [selectedComment, setSelectedComment] = useState<GameComment | null>(null);
	const [reporting, setReporting] = useState(false);
	// Animation refs for each comment's like button (TikTok-style pulse)
	const likeAnimationsRef = useRef<Map<string, Animated.Value>>(new Map());

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;
		LeoProfanity.add(["fag", "faggot", "retard", "nigga", "nigger"])
		if (visible) {
			loadComments();
			unsubscribe = setupListener();
		} else {
			setComments([]);
			setNewComment("");
			setReportModalVisible(false);
			setSelectedComment(null);
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
			// Error loading comments
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
				// Listener error
			}
		);

		return unsubscribe;
	};

	const handleSubmitComment = async () => {
		if (!currentUser || !newComment.trim()) {
			return;
		}

		// Check user's strike count - must be less than 10 to comment
		try {
			const userData = await getUserData(currentUser.uid);
			const strikeCount = userData?.strikeCount || 0;
			
			if (strikeCount >= 10) {
				Alert.alert(
					"Commenting Disabled",
					"You have reached the maximum number of strikes. Commenting has been disabled for your account.",
					[{ text: "OK" }]
				);
				return;
			}
		} catch (error) {
			// If we can't fetch user data, allow the comment (fail open)
			// This prevents blocking users due to network issues
		}

		// Check for bad words using leo-profanity
		const commentText = newComment.trim();
		
		try {
			// Simple check with leo-profanity
			const hasProfanity = LeoProfanity.check(commentText);
			
			if (hasProfanity) {
				Alert.alert(
					"Invalid Comment",
					"Your comment contains inappropriate language. Please revise your message.",
					[{ text: "OK" }]
				);
				return;
			}
		} catch (error) {
			// If there's an error with profanity checking, block the comment to be safe
			Alert.alert(
				"Error",
				"Unable to validate comment. Please try again.",
				[{ text: "OK" }]
			);
			return;
		}

		setSubmitting(true);
		try {
			await addGameComment(gameId, currentUser.uid, commentText);
			setNewComment("");
			// Notify parent that a comment was added (for optimistic UI updates)
			if (onCommentAdded) {
				onCommentAdded();
			}
		} catch (error) {
			// Error submitting comment
		} finally {
			setSubmitting(false);
		}
	};

	const handleLikeComment = (commentId: string) => {
		if (!currentUser) return;

		const comment = comments.find((c) => c.id === commentId);
		if (!comment) return;

		// Get or create animation ref for this comment
		if (!likeAnimationsRef.current.has(commentId)) {
			likeAnimationsRef.current.set(commentId, new Animated.Value(1));
		}
		const pulseAnim = likeAnimationsRef.current.get(commentId)!;

		// Optimistic update - update UI immediately, process in background
		const wasLiked = comment.likedBy?.includes(currentUser.uid) || false;
		const newLikedState = !wasLiked;
		const currentLikeCount = comment.likes || 0;
		const newLikeCount = wasLiked
			? Math.max(0, currentLikeCount - 1)
			: currentLikeCount + 1;

		// TikTok-style haptic feedback and pulse animation (only on like, not unlike)
		if (!wasLiked) {
			// Haptic feedback for like - medium impact for satisfying feel
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

			// TikTok-style pulse animation - quick bounce, heart doesn't stay big for more than 0.5s
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 1.4,
					duration: 150, // Quick scale up in 150ms
					useNativeDriver: true,
				}),
				Animated.timing(pulseAnim, {
					toValue: 1,
					duration: 300, // Scale back down in 300ms (total < 500ms)
					useNativeDriver: true,
				}),
			]).start();
		}

		// Update UI instantly (optimistic update)
		setComments((prevComments) =>
			prevComments.map((c) => {
				if (c.id === commentId) {
					const updatedLikedBy = wasLiked
						? (c.likedBy || []).filter((uid) => uid !== currentUser.uid)
						: [...(c.likedBy || []), currentUser.uid];
					return {
						...c,
						likes: newLikeCount,
						likedBy: updatedLikedBy,
					};
				}
				return c;
			})
		);

		// Process in background (fire and forget)
		if (wasLiked) {
			unlikeGameComment(gameId, commentId, currentUser.uid).catch((error) => {
				// On error, revert optimistic update
				setComments((prevComments) =>
					prevComments.map((c) => {
						if (c.id === commentId) {
							return {
								...c,
								likes: currentLikeCount,
								likedBy: [...(c.likedBy || []), currentUser.uid],
							};
						}
						return c;
					})
				);
			});
		} else {
			likeGameComment(gameId, commentId, currentUser.uid).catch((error) => {
				// On error, revert optimistic update
				setComments((prevComments) =>
					prevComments.map((c) => {
						if (c.id === commentId) {
							const revertedLikedBy = (c.likedBy || []).filter(
								(uid) => uid !== currentUser.uid
							);
							return {
								...c,
								likes: currentLikeCount,
								likedBy: revertedLikedBy,
							};
						}
						return c;
					})
				);
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

	const handleProfilePress = (username: string) => {
		if (username) {
			onClose(); // Close the modal before navigating
			router.push(`/user/${username}`);
		}
	};

	const handleCommentLongPress = (comment: GameComment) => {
		setSelectedComment(comment);
		setReportModalVisible(true);
	};

	const handleReportComment = async (reason: string) => {
		if (!currentUser || !selectedComment) return;

		setReporting(true);
		try {
			// Get auth token
			const currentAuthUser = auth().currentUser;
			if (!currentAuthUser) {
				Alert.alert("Error", "You must be logged in to report comments.");
				return;
			}

			const idToken = await currentAuthUser.getIdToken();

			// Parse gameId to extract gameType, difficulty, and actualGameId
			const parsed = parsePuzzleId(gameId);
			if (!parsed) {
				throw new Error("Invalid gameId format");
			}

			const { gameType, difficulty, gameId: actualGameId } = parsed;

			// Build comment ID in format: {gameType}_{difficulty}_{gameId}_{commentId}
			const commentId = `${gameType}_${difficulty}_${actualGameId}_${selectedComment.id}`;

			// Call analyze_comment function immediately (don't wait for reason selection)
			const analyzeUrl = "https://us-central1-gear-ff009.cloudfunctions.net/analyze_comment";
			const analyzeResponse = await fetch(analyzeUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					data: {
						text: selectedComment.text,
						userId: selectedComment.userId,
						commentId: commentId,
					},
				}),
			});

			if (!analyzeResponse.ok) {
				throw new Error(`HTTP error! status: ${analyzeResponse.status}`);
			}

			const analyzeResult = await analyzeResponse.json();
			const analysisResult = analyzeResult.result || analyzeResult;

			// Save report to Firestore under the reporting user's reports subcollection
			const firestore = require("@react-native-firebase/firestore").default;
			const reportRef = db
				.collection("users")
				.doc(currentUser.uid)
				.collection("reports")
				.doc();

			await reportRef.set({
				commentId: commentId,
				commentText: selectedComment.text,
				commentUserId: selectedComment.userId,
				commentUsername: selectedComment.username,
				reason: reason,
				analysisResult: analysisResult,
				reportedAt: firestore.FieldValue.serverTimestamp(),
			});

			Alert.alert("Success", "Comment reported successfully.");
			setReportModalVisible(false);
			setSelectedComment(null);
		} catch (error: any) {
			Alert.alert("Error", "Failed to report comment. Please try again.");
		} finally {
			setReporting(false);
		}
	};

	const renderComment = ({ item }: { item: GameComment }) => {
		const isLiked =
			currentUser && (item.likedBy?.includes(currentUser.uid) || false);

		// Get or create animation ref for this comment
		if (!likeAnimationsRef.current.has(item.id)) {
			likeAnimationsRef.current.set(item.id, new Animated.Value(1));
		}
		const pulseAnim = likeAnimationsRef.current.get(item.id)!;

		return (
			<TouchableOpacity
				style={styles.commentItem}
				onLongPress={() => handleCommentLongPress(item)}
				delayLongPress={750}
				activeOpacity={0.7}
			>
				<View style={styles.commentHeader}>
					<TouchableOpacity
						onPress={() => handleProfilePress(item.username)}
						activeOpacity={0.7}
					>
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
					</TouchableOpacity>
					<View style={styles.commentContent}>
						<TouchableOpacity
							onPress={() => handleProfilePress(item.username)}
							activeOpacity={0.7}
						>
							<Text style={styles.commentUsername}>{item.username}</Text>
						</TouchableOpacity>
						<Text style={styles.commentText}>{item.text}</Text>
						<View style={styles.commentFooter}>
							<Text style={styles.commentTime}>
								{formatTimestamp(item.createdAt)}
							</Text>
							<TouchableOpacity
								style={styles.commentLikeButton}
								onPress={() => handleLikeComment(item.id)}
								activeOpacity={0.7}
							>
								<Animated.View
									style={{
										transform: [{ scale: pulseAnim }],
									}}
								>
									<Ionicons
										name={isLiked ? "heart" : "heart-outline"}
										size={16}
										color={isLiked ? Colors.accent : Colors.text.secondary}
									/>
								</Animated.View>
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
			</TouchableOpacity>
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

			{/* Report Modal */}
			<Modal
				visible={reportModalVisible}
				transparent={true}
				animationType="fade"
				onRequestClose={() => {
					if (!reporting) {
						setReportModalVisible(false);
						setSelectedComment(null);
					}
				}}
			>
				<View style={styles.reportModalOverlay}>
					<View style={styles.reportModalContent}>
						<Text style={styles.reportModalTitle}>Report Comment</Text>
						<Text style={styles.reportModalSubtitle}>
							Why are you reporting this comment?
						</Text>

						{reporting ? (
							<View style={styles.reportLoadingContainer}>
								<ActivityIndicator size="large" color={Colors.accent} />
								<Text style={styles.reportLoadingText}>
									Analyzing comment...
								</Text>
							</View>
						) : (
							<View style={styles.reportReasonsContainer}>
								{[
									"Inappropriate content",
									"Spam",
									"Harassment",
									"False information",
									"Other",
								].map((reason) => (
									<TouchableOpacity
										key={reason}
										style={styles.reportReasonButton}
										onPress={() => handleReportComment(reason)}
										activeOpacity={0.7}
									>
										<Text style={styles.reportReasonText}>{reason}</Text>
									</TouchableOpacity>
								))}
							</View>
						)}

						{!reporting && (
							<TouchableOpacity
								style={styles.reportCancelButton}
								onPress={() => {
									setReportModalVisible(false);
									setSelectedComment(null);
								}}
								activeOpacity={0.7}
							>
								<Text style={styles.reportCancelText}>Cancel</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>
			</Modal>
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
		paddingTop: Spacing.sm,
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
	reportModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	reportModalContent: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.xl,
		width: "85%",
		maxWidth: 400,
		...Shadows.heavy,
	},
	reportModalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
		textAlign: "center",
	},
	reportModalSubtitle: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.lg,
		textAlign: "center",
	},
	reportLoadingContainer: {
		alignItems: "center",
		padding: Spacing.xl,
	},
	reportLoadingText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	reportReasonsContainer: {
		gap: Spacing.sm,
	},
	reportReasonButton: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "20",
	},
	reportReasonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
	},
	reportCancelButton: {
		marginTop: Spacing.lg,
		padding: Spacing.md,
	},
	reportCancelText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
	},
});

export default CommentsModal;

