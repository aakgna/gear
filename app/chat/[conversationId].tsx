import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
	Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../../components/MinimalHeader";
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
import { getCurrentUser } from "../../config/auth";
import {
	fetchMessages,
	sendMessage,
	markConversationRead,
	Message,
} from "../../config/messaging";
import { fetchUserProfile, UserPublicProfile } from "../../config/social";
import { db } from "../../config/firebase";
import { PuzzleType } from "../../config/types";
import { useSessionEndRefresh } from "../../utils/sessionRefresh";

const BOTTOM_NAV_HEIGHT = 70;

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

const ChatScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ conversationId: string }>();
	const conversationId = params.conversationId;
	const currentUser = getCurrentUser();

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);
	const flatListRef = useRef<FlatList>(null);

	const [messages, setMessages] = useState<Message[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [otherParticipant, setOtherParticipant] =
		useState<UserPublicProfile | null>(null);

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		if (conversationId && currentUser) {
			loadMessages();
			unsubscribe = setupListener();
			loadOtherParticipant();
			markAsRead();
		}

		return () => {
			// Cleanup listener
			if (unsubscribe) {
				unsubscribe();
			}
			// Mark as read when exiting the chat
			if (conversationId && currentUser) {
				markAsRead();
			}
		};
	}, [conversationId, currentUser]);

	const loadMessages = async () => {
		if (!conversationId) return;

		setLoading(true);
		try {
			const fetchedMessages = await fetchMessages(conversationId, 100);
			setMessages(fetchedMessages);
		} catch (error) {
			console.error("[ChatScreen] Error loading messages:", error);
		} finally {
			setLoading(false);
		}
	};

	const setupListener = (): (() => void) | undefined => {
		if (!conversationId) return undefined;

		const messagesRef = db
			.collection("conversations")
			.doc(conversationId)
			.collection("messages")
			.orderBy("createdAt", "desc")
			.limit(100);

		const unsubscribe = messagesRef.onSnapshot(
			(snapshot) => {
				const updatedMessages: Message[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data();
					updatedMessages.push({
						id: doc.id,
						senderId: data.senderId,
						senderUsername: data.senderUsername || "",
						senderProfilePicture: data.senderProfilePicture || null,
						text: data.text,
						gameShare: data.gameShare || null,
						createdAt: data.createdAt?.toDate() || new Date(),
						read: data.read || false,
					});
				});
				setMessages(updatedMessages.reverse());
				markAsRead();
			},
			(error) => {
				console.error("[ChatScreen] Listener error:", error);
			}
		);

		return unsubscribe;
	};

	const loadOtherParticipant = async () => {
		if (!conversationId || !currentUser) return;

		try {
			const conversationDoc = await db
				.collection("conversations")
				.doc(conversationId)
				.get();

			const conversationData = conversationDoc.data();
			const participants = conversationData?.participants || [];
			const otherId = participants.find((id: string) => id !== currentUser.uid);

			if (otherId) {
				const profile = await fetchUserProfile(otherId);
				if (profile) {
					setOtherParticipant(profile);
				}
			}
		} catch (error) {
			console.error("[ChatScreen] Error loading participant:", error);
		}
	};

	const markAsRead = async () => {
		if (!conversationId || !currentUser) return;

		try {
			await markConversationRead(conversationId, currentUser.uid);
		} catch (error) {
			console.error("[ChatScreen] Error marking as read:", error);
		}
	};

	const handleSendMessage = async () => {
		if (!conversationId || !currentUser || !newMessage.trim() || sending)
			return;

		setSending(true);
		try {
			await sendMessage(conversationId, currentUser.uid, newMessage.trim());
			setNewMessage("");
		} catch (error) {
			console.error("[ChatScreen] Error sending message:", error);
		} finally {
			setSending(false);
		}
	};

	const handleGameSharePress = useCallback(
		(gameShare: any) => {
			// Navigate to play the game
			const gameId = `${gameShare.gameType}_${gameShare.difficulty}_${gameShare.gameId}`;
			router.push(`/play-game/${encodeURIComponent(gameId)}`);
		},
		[router]
	);

	const renderMessage = useCallback(
		({ item }: { item: Message }) => {
			const isFromMe = item.senderId === currentUser?.uid;

			return (
				<View
					style={[
						styles.messageContainer,
						isFromMe ? styles.messageFromMe : styles.messageFromOther,
					]}
				>
					{!isFromMe && (
						<View style={styles.avatarContainer}>
							{item.senderProfilePicture ? (
								<Image
									source={{ uri: item.senderProfilePicture }}
									style={styles.messageAvatar}
								/>
							) : (
								<Ionicons
									name="person-circle"
									size={32}
									color={Colors.text.secondary}
								/>
							)}
						</View>
					)}
					<View
						style={[
							styles.messageBubble,
							isFromMe
								? styles.messageBubbleFromMe
								: styles.messageBubbleFromOther,
						]}
					>
						{item.gameShare ? (
							<TouchableOpacity
								onPress={() => handleGameSharePress(item.gameShare)}
								activeOpacity={0.7}
							>
								<View
									style={[
										styles.gameShareCard,
										{
											borderColor:
												getGameColor(item.gameShare.gameType as PuzzleType) ||
												Colors.accent,
										},
									]}
								>
									<Ionicons
										name="game-controller-outline"
										size={24}
										color={
											getGameColor(item.gameShare.gameType as PuzzleType) ||
											Colors.accent
										}
									/>
									<View style={styles.gameShareInfo}>
										<Text style={styles.gameShareTitle}>
											{formatGameType(item.gameShare.gameType)}
										</Text>
										<Text style={styles.gameShareDifficulty}>
											{item.gameShare.difficulty}
										</Text>
									</View>
									<Ionicons
										name="play-circle"
										size={24}
										color={Colors.accent}
									/>
								</View>
							</TouchableOpacity>
						) : (
							<Text
								style={[
									styles.messageText,
									isFromMe
										? styles.messageTextFromMe
										: styles.messageTextFromOther,
								]}
							>
								{item.text}
							</Text>
						)}
						<Text style={styles.messageTime}>
							{formatTimestamp(item.createdAt)}
						</Text>
					</View>
				</View>
			);
		},
		[currentUser, handleGameSharePress]
	);

	if (!currentUser || !conversationId) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={styles.header}>
					<Text style={styles.headerTitle}>Chat</Text>
				</View>
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
		>
			<StatusBar style="dark" />

			<MinimalHeader
				title={otherParticipant?.username || "user"}
				rightAction={
					otherParticipant?.profilePicture ? (
						<Image
							source={{ uri: otherParticipant.profilePicture }}
							style={styles.headerAvatar}
						/>
					) : (
						<Ionicons
							name="person-circle"
							size={28}
							color={Colors.text.secondary}
						/>
					)
				}
			/>

			{/* Messages List */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			) : (
				<FlatList
					ref={flatListRef}
					data={messages}
					renderItem={renderMessage}
					keyExtractor={(item) => item.id}
					// inverted
					windowSize={5}
					initialNumToRender={10}
					maxToRenderPerBatch={5}
					updateCellsBatchingPeriod={50}
					removeClippedSubviews={true}
					contentContainerStyle={[
						styles.messagesList,
						{
							paddingBottom:
								BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.md + 60,
						},
					]}
					onContentSizeChange={() => {
						flatListRef.current?.scrollToEnd({ animated: true });
					}}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>No messages yet</Text>
							<Text style={styles.emptySubtext}>Start the conversation!</Text>
						</View>
					}
				/>
			)}

			{/* Input Area */}
			<View
				style={[
					styles.inputContainer,
					{ paddingBottom: insets.bottom + Spacing.sm },
				]}
			>
				<TextInput
					style={styles.input}
					placeholder="Type a message..."
					placeholderTextColor={Colors.text.secondary}
					value={newMessage}
					onChangeText={setNewMessage}
					multiline
					maxLength={1000}
				/>
				<TouchableOpacity
					style={[
						styles.sendButton,
						(!newMessage.trim() || sending) && styles.sendButtonDisabled,
					]}
					onPress={handleSendMessage}
					disabled={!newMessage.trim() || sending}
				>
					<LinearGradient
						colors={Gradients.button}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={StyleSheet.absoluteFill}
					>
						{sending ? (
							<ActivityIndicator size="small" color={Colors.text.white} />
						) : (
							<Ionicons name="send" size={20} color={Colors.text.white} />
						)}
					</LinearGradient>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	headerAvatar: {
		width: 28,
		height: 28,
		borderRadius: 14,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	messagesList: {
		padding: Layout.margin,
	},
	messageContainer: {
		flexDirection: "row",
		marginBottom: Spacing.md,
		alignItems: "flex-end",
	},
	messageFromMe: {
		justifyContent: "flex-end",
	},
	messageFromOther: {
		justifyContent: "flex-start",
	},
	avatarContainer: {
		marginRight: Spacing.xs,
	},
	messageAvatar: {
		width: 32,
		height: 32,
		borderRadius: 16,
	},
	messageBubble: {
		maxWidth: "75%",
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	messageBubbleFromMe: {
		backgroundColor: Colors.accent,
		borderBottomRightRadius: 8,
	},
	messageBubbleFromOther: {
		backgroundColor: Colors.background.primary,
		borderBottomLeftRadius: 8,
		borderWidth: 0,
		...Shadows.light,
	},
	messageText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		marginBottom: Spacing.xxs,
	},
	messageTextFromMe: {
		color: Colors.text.white,
	},
	messageTextFromOther: {
		color: Colors.text.primary,
	},
	messageTime: {
		fontSize: Typography.fontSize.xxs || 10,
		color: Colors.text.secondary,
		marginTop: Spacing.xxs,
	},
	gameShareCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		backgroundColor: Colors.background.primary,
		marginBottom: Spacing.xxs,
	},
	gameShareInfo: {
		flex: 1,
	},
	gameShareTitle: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xxs,
	},
	gameShareDifficulty: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
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
		backgroundColor: Colors.background.primary,
		borderTopWidth: 0.5,
		borderTopColor: Colors.border,
		gap: Spacing.sm,
	},
	input: {
		flex: 1,
		borderRadius: BorderRadius.lg,
		borderWidth: 1,
		borderColor: Colors.border,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		maxHeight: 100,
		backgroundColor: Colors.background.secondary,
	},
	sendButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 2,
		overflow: "hidden",
	},
	sendButtonDisabled: {
		opacity: 0.5,
	},
});

export default ChatScreen;
