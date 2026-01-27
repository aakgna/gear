import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	RefreshControl,
	Image,
	TextInput,
	Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../components/MinimalHeader";
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
	fetchConversations,
	markConversationRead,
	getMutualFollowers,
	createConversation,
	getConversationId,
} from "../config/messaging";
import { Conversation } from "../config/types";
import {
	fetchUserProfile,
	UserPublicProfile,
	UserSummary,
	isUserBlocked,
	isBlockedByUser,
} from "../config/social";
import { useSessionEndRefresh } from "../utils/sessionRefresh";
import { getCachedBlockedUsersAll } from "../config/blockedUsersCache";

const BOTTOM_NAV_HEIGHT = 70;

const formatTimestamp = (timestamp: Date): string => {
	const now = new Date();
	const diffMs = now.getTime() - timestamp.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h`;
	if (diffDays < 7) return `${diffDays}d`;

	return timestamp.toLocaleDateString();
};

const InboxScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const currentUser = getCurrentUser();
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loading, setLoading] = useState(true);

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);
	const [refreshing, setRefreshing] = useState(false);
	const [participantProfiles, setParticipantProfiles] = useState<
		Record<string, UserPublicProfile>
	>({});
	const [searchQuery, setSearchQuery] = useState("");
	const [showNewChatModal, setShowNewChatModal] = useState(false);
	const [mutualFollowers, setMutualFollowers] = useState<UserSummary[]>([]);
	const [loadingMutualFollowers, setLoadingMutualFollowers] = useState(false);
	const [creatingChat, setCreatingChat] = useState<string | null>(null);
	const [filteredConversations, setFilteredConversations] = useState<
		Conversation[]
	>([]);

	useEffect(() => {
		if (currentUser) {
			loadConversations();
		}
	}, []); // Only load once on mount, like feed and profile pages

	// Refresh conversations when screen comes into focus (e.g., returning from chat)
	useFocusEffect(
		useCallback(() => {
			if (currentUser) {
				loadConversations();
			}
		}, [currentUser])
	);

	const loadConversations = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			// Fetch conversations without waiting for unread count calculation (fast version)
			const convos = await fetchConversations(currentUser.uid, false);

			// Show conversations immediately - don't wait for profiles
			setConversations(convos);
			setLoading(false); // Set loading to false immediately after conversations load

			// Load participant profiles in background and update as they come in
			const profiles: Record<string, UserPublicProfile> = {};
			const uniqueParticipantIds = new Set<string>();

			convos.forEach((conv) => {
				conv.participants.forEach((participantId) => {
					if (participantId !== currentUser.uid) {
						uniqueParticipantIds.add(participantId);
					}
				});
			});

			// Load profiles in parallel and update state as they arrive
			const profilePromises = Array.from(uniqueParticipantIds).map(
				async (participantId) => {
					try {
						const profile = await fetchUserProfile(participantId);
						if (profile) {
							profiles[participantId] = profile;
							// Update state incrementally for better UX
							setParticipantProfiles((prev) => ({
								...prev,
								[participantId]: profile,
							}));
						}
					} catch (error) {
						console.error(
							`[InboxScreen] Error loading profile for ${participantId}:`,
							error
						);
					}
				}
			);

			// Wait for all profiles but don't block UI
			await Promise.all(profilePromises);

			// Trigger accurate unread count calculation in background
			// This will update conversations with accurate counts without blocking
			fetchConversations(currentUser.uid, true)
				.then((updatedConvos) => {
					setConversations(updatedConvos);
				})
				.catch((err) => {
					console.error("[InboxScreen] Error updating unread counts:", err);
				});
		} catch (error) {
			console.error("[InboxScreen] Error loading conversations:", error);
			setLoading(false);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		await loadConversations();
		setRefreshing(false);
	};

	const getOtherParticipant = useCallback(
		(conversation: Conversation): string | null => {
			if (!currentUser) return null;
			const other = conversation.participants.find(
				(id: string) => id !== currentUser.uid
			);
			return other || null;
		},
		[currentUser]
	);

	const handleConversationPress = (conversation: Conversation) => {
		if (!currentUser) return;

		// Get other participant's profile for instant display
		const otherParticipantId = getOtherParticipant(conversation);
		const otherParticipant = otherParticipantId
			? participantProfiles[otherParticipantId]
			: null;

		// Mark as read in background (fire and forget - don't block navigation!)
		markConversationRead(conversation.id, currentUser.uid).catch((err) =>
			console.error("[InboxScreen] Error marking as read:", err)
		);

		// Navigate immediately with participant data for instant display
		router.push({
			pathname: `/chat/${conversation.id}`,
			params: {
				username: otherParticipant?.username || "",
				profilePicture: otherParticipant?.profilePicture || "",
				participantId: otherParticipantId || "",
			},
		});
	};

	// Filter conversations based on search query and blocked users
	// OPTIMIZED: Uses cached blocked users instead of N+1 queries
	useEffect(() => {
		const filterConversations = async () => {
			if (!currentUser) {
				setFilteredConversations(conversations);
				return;
			}

			// Get blocked users from cache (fast, single call)
			const { blocked, blockedBy } = await getCachedBlockedUsersAll(
				currentUser.uid
			);

			// Filter out conversations with blocked users (local filtering)
			const filteredByBlock = conversations.filter((conv) => {
				const otherParticipantId = getOtherParticipant(conv);
				return (
					otherParticipantId &&
					!blocked.has(otherParticipantId) &&
					!blockedBy.has(otherParticipantId)
				);
			});

			if (!searchQuery.trim()) {
				setFilteredConversations(filteredByBlock);
				return;
			}

			const query = searchQuery.toLowerCase().trim();
			const filtered = filteredByBlock.filter((conv) => {
				const otherParticipantId = getOtherParticipant(conv);
				const otherParticipant = otherParticipantId
					? participantProfiles[otherParticipantId]
					: null;
				const username = otherParticipant?.username || "";
				return username.toLowerCase().includes(query);
			});
			setFilteredConversations(filtered);
		};

		filterConversations();
	}, [
		conversations,
		searchQuery,
		participantProfiles,
		getOtherParticipant,
		currentUser,
	]);

	const handleNewChatPress = async () => {
		if (!currentUser) return;

		setShowNewChatModal(true);
		setLoadingMutualFollowers(true);
		setMutualFollowers([]); // Clear previous results
		try {
			console.log("[InboxScreen] Loading mutual followers...");
			const followers = await getMutualFollowers(currentUser.uid);
			console.log("[InboxScreen] Found mutual followers:", followers.length);

			// Get IDs of users we already have conversations with
			const existingConversationUserIds = new Set<string>();
			conversations.forEach((conv) => {
				const otherId = getOtherParticipant(conv);
				if (otherId) {
					existingConversationUserIds.add(otherId);
				}
			});

			// Filter out mutual followers who already have conversations
			const availableFollowers = followers.filter(
				(follower) => !existingConversationUserIds.has(follower.uid)
			);

			console.log(
				"[InboxScreen] Available followers (after filtering):",
				availableFollowers.length
			);
			setMutualFollowers(availableFollowers);
		} catch (error) {
			console.error("[InboxScreen] Error loading mutual followers:", error);
			setMutualFollowers([]);
		} finally {
			setLoadingMutualFollowers(false);
		}
	};

	const handleSelectMutualFollower = async (recipientId: string) => {
		if (!currentUser || creatingChat) return;

		setCreatingChat(recipientId);
		try {
			// Check if conversation already exists
			let conversationId = await getConversationId(
				currentUser.uid,
				recipientId
			);

			// If it doesn't exist, create it
			if (!conversationId) {
				conversationId = await createConversation(currentUser.uid, recipientId);
			}

			// Close modal and navigate to chat
			setShowNewChatModal(false);
			setSearchQuery(""); // Clear search
			router.push(`/chat/${conversationId}`);
		} catch (error) {
			console.error("[InboxScreen] Error creating/opening chat:", error);
		} finally {
			setCreatingChat(null);
		}
	};

	const renderConversation = useCallback(
		({ item }: { item: Conversation }) => {
			const otherParticipantId = getOtherParticipant(item);
			const otherParticipant = otherParticipantId
				? participantProfiles[otherParticipantId]
				: null;

			const isFromMe = item.lastMessage?.senderId === currentUser?.uid;
			const unreadCount = item.unreadCount || 0;

			return (
				<TouchableOpacity
					style={styles.conversationItem}
					onPress={() => handleConversationPress(item)}
					activeOpacity={0.7}
				>
					<View style={styles.conversationContent}>
						{otherParticipant?.profilePicture ? (
							<Image
								source={{ uri: otherParticipant.profilePicture }}
								style={styles.avatar}
							/>
						) : (
							<Ionicons name="person-circle" size={56} color={Colors.accent} />
						)}
						<View style={styles.conversationDetails}>
							<View style={styles.conversationHeader}>
								<Text style={styles.username}>
									{otherParticipant?.username || "user"}
								</Text>
								{item.lastMessage && (
									<Text style={styles.timestamp}>
										{formatTimestamp(item.lastMessage.timestamp)}
									</Text>
								)}
							</View>
							{item.lastMessage && (
								<View style={styles.messagePreview}>
									<Text
										style={[
											styles.messageText,
											unreadCount > 0 && styles.messageTextUnread,
										]}
										numberOfLines={1}
									>
										{isFromMe && "You: "}
										{item.lastMessage.text}
									</Text>
									{unreadCount > 0 && (
										<View style={styles.unreadBadge}>
											<Text style={styles.unreadBadgeText}>{unreadCount}</Text>
										</View>
									)}
								</View>
							)}
						</View>
					</View>
				</TouchableOpacity>
			);
		},
		[currentUser, participantProfiles]
	);

	if (!currentUser) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<MinimalHeader title="Inbox" />
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>Please sign in to view messages</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			<MinimalHeader
				title="Inbox"
				rightAction={
					<TouchableOpacity onPress={handleNewChatPress}>
						<Ionicons
							name="add-circle-outline"
							size={28}
							color={Colors.accent}
						/>
					</TouchableOpacity>
				}
			/>

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
						placeholder="Search conversations..."
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

			{/* Conversations List */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			) : (
				<FlatList
					data={filteredConversations}
					renderItem={renderConversation}
					keyExtractor={(item) => item.id}
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
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							tintColor={Colors.accent}
							colors={[Colors.accent]}
						/>
					}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Ionicons
								name={
									searchQuery.trim() ? "search-outline" : "chatbubbles-outline"
								}
								size={64}
								color={Colors.text.secondary}
							/>
							<Text style={styles.emptyText}>
								{searchQuery.trim()
									? "No conversations found"
									: "No messages yet"}
							</Text>
							{!searchQuery.trim() && (
								<Text style={styles.emptySubtext}>
									Share games with mutual followers to start conversations
								</Text>
							)}
						</View>
					}
				/>
			)}

			{/* New Chat Modal */}
			<Modal
				visible={showNewChatModal}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setShowNewChatModal(false)}
			>
				<View style={[styles.modalContainer, { paddingTop: insets.top }]}>
					<StatusBar style="dark" />
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>New Chat</Text>
						<TouchableOpacity
							onPress={() => setShowNewChatModal(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={28} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>

					{loadingMutualFollowers ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={Colors.accent} />
						</View>
					) : mutualFollowers.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Ionicons
								name="people-outline"
								size={64}
								color={Colors.text.secondary}
							/>
							<Text style={styles.emptyText}>No mutual followers</Text>
							<Text style={styles.emptySubtext}>
								Follow users who follow you back to start chatting
							</Text>
						</View>
					) : (
						<FlatList
							data={mutualFollowers}
							keyExtractor={(item) => item.uid}
							renderItem={({ item }) => {
								const isCreating = creatingChat === item.uid;
								return (
									<TouchableOpacity
										style={styles.mutualFollowerItem}
										onPress={() => handleSelectMutualFollower(item.uid)}
										disabled={isCreating}
									>
										{item.profilePicture ? (
											<Image
												source={{ uri: item.profilePicture }}
												style={styles.avatar}
											/>
										) : (
											<Ionicons name="person-circle" size={50} color={Colors.accent} />
										)}
										<Text style={styles.username}>{item.username}</Text>
										{isCreating ? (
											<ActivityIndicator size="small" color={Colors.accent} />
										) : (
											<Ionicons
												name="chevron-forward"
												size={20}
												color={Colors.text.secondary}
											/>
										)}
									</TouchableOpacity>
								);
							}}
							contentContainerStyle={{
								paddingBottom: insets.bottom + Spacing.lg,
							}}
						/>
					)}
				</View>
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
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		...Shadows.light,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	headerTitle: {
		flex: 1,
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	conversationItem: {
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
	},
	conversationContent: {
		flexDirection: "row",
		padding: Layout.margin,
		gap: Spacing.md,
	},
	avatar: {
		width: 56,
		height: 56,
		borderRadius: 28,
	},
	conversationDetails: {
		flex: 1,
		justifyContent: "center",
	},
	conversationHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.xs,
	},
	username: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	timestamp: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
	},
	messagePreview: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	messageText: {
		flex: 1,
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	messageTextUnread: {
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	unreadBadge: {
		backgroundColor: Colors.accent,
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 6,
		marginLeft: Spacing.sm,
	},
	unreadBadgeText: {
		color: Colors.text.white,
		fontSize: 11,
		fontWeight: Typography.fontWeight.bold,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginTop: Spacing.md,
		marginBottom: Spacing.xs,
	},
	emptySubtext: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
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
	modalContainer: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Layout.margin,
		paddingVertical: Spacing.md,
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
	},
	modalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	mutualFollowerItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		padding: Layout.margin,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		gap: Spacing.md,
	},
});

export default InboxScreen;
