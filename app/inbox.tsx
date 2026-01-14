import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	RefreshControl,
	Image,
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
import {
	fetchConversations,
	markConversationRead,
	Conversation,
} from "../config/messaging";
import { fetchUserProfile, UserPublicProfile } from "../config/social";
import { useSessionEndRefresh } from "../utils/sessionRefresh";

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

	useEffect(() => {
		if (currentUser) {
			loadConversations();
		}
	}, []); // Only load once on mount, like feed and profile pages

	const loadConversations = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			const convos = await fetchConversations(currentUser.uid);
			setConversations(convos);

			// Load participant profiles
			const profilePromises: Promise<void>[] = [];
			const profiles: Record<string, UserPublicProfile> = {};

			convos.forEach((conv) => {
				conv.participants.forEach((participantId) => {
					if (participantId !== currentUser.uid && !profiles[participantId]) {
						profilePromises.push(
							fetchUserProfile(participantId).then((profile) => {
								if (profile) {
									profiles[participantId] = profile;
								}
							})
						);
					}
				});
			});

			await Promise.all(profilePromises);
			setParticipantProfiles(profiles);
		} catch (error) {
			console.error("[InboxScreen] Error loading conversations:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		await loadConversations();
		setRefreshing(false);
	};

	const handleConversationPress = async (conversation: Conversation) => {
		if (!currentUser) return;

		// Mark as read
		await markConversationRead(conversation.id, currentUser.uid);

		// Navigate to chat
		router.push(`/chat/${conversation.id}`);
	};

	const getOtherParticipant = (conversation: Conversation): string | null => {
		if (!currentUser) return null;
		const other = conversation.participants.find(
			(id) => id !== currentUser.uid
		);
		return other || null;
	};

	const renderConversation = ({ item }: { item: Conversation }) => {
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
						<Ionicons
							name="person-circle"
							size={56}
							color={Colors.text.secondary}
						/>
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
	};

	if (!currentUser) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backButton}
					>
						<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Inbox</Text>
					<View style={styles.backButton} />
				</View>
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>Please sign in to view messages</Text>
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
					onPress={() => router.back()}
					style={styles.backButton}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Inbox</Text>
				<View style={styles.backButton} />
			</View>

			{/* Conversations List */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			) : (
				<FlatList
					data={conversations}
					renderItem={renderConversation}
					keyExtractor={(item) => item.id}
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
								name="chatbubbles-outline"
								size={64}
								color={Colors.text.secondary}
							/>
							<Text style={styles.emptyText}>No messages yet</Text>
							<Text style={styles.emptySubtext}>
								Share games with mutual followers to start conversations
							</Text>
						</View>
					}
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
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
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
});

export default InboxScreen;

