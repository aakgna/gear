// Direct messaging system for mutual followers
import { db } from "./firebase";
import {
	UserSummary,
	fetchFollowing,
	isUserBlocked,
	isBlockedByUser,
} from "./social";
import { GameShare, Message, Conversation } from "./types";
import { getCachedBlockedUsersAll } from "./blockedUsersCache";

// Get mutual followers (users who follow each other)
// OPTIMIZED: Uses cached blocked users and single query for followers
export const getMutualFollowers = async (
	userId: string
): Promise<UserSummary[]> => {
	try {
		// 1. Get blocked users from cache (single call, cached for 5 minutes)
		const { blocked, blockedBy } = await getCachedBlockedUsersAll(userId);

		// 2. Get users current user follows
		const following = await fetchFollowing(userId, 1000);

		// 3. Get users who follow current user (single query)
		const followersSnapshot = await db
			.collection("users")
			.doc(userId)
			.collection("followers")
			.get();
		const followerIds = new Set(followersSnapshot.docs.map((doc) => doc.id));

		// 4. Filter locally - no more N+1 queries!
		const mutualFollowers = following.filter(
			(user) =>
				followerIds.has(user.uid) &&
				!blocked.has(user.uid) &&
				!blockedBy.has(user.uid)
		);

		return mutualFollowers;
	} catch (error) {
		console.error("[getMutualFollowers] Error:", error);
		return [];
	}
};

// Create or get conversation ID between two users
export const getConversationId = async (
	userId1: string,
	userId2: string
): Promise<string | null> => {
	try {
		// Sort user IDs for consistency
		const participants = [userId1, userId2].sort();

		// Check if conversation already exists
		const user1ConversationsRef = db
			.collection("users")
			.doc(userId1)
			.collection("conversations");

		const snapshot = await user1ConversationsRef
			.where("participants", "==", participants)
			.limit(1)
			.get();

		if (!snapshot.empty) {
			return snapshot.docs[0].id;
		}

		return null;
	} catch (error) {
		console.error("[getConversationId] Error:", error);
		return null;
	}
};

// Create a new conversation between two users
export const createConversation = async (
	userId1: string,
	userId2: string
): Promise<string> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const participants = [userId1, userId2].sort();

		// Check if conversation already exists
		const existingId = await getConversationId(userId1, userId2);
		if (existingId) {
			return existingId;
		}

		// Create conversation document
		const conversationData = {
			participants,
			createdAt: firestore.FieldValue.serverTimestamp(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
			lastRead: {
				[userId1]: firestore.FieldValue.serverTimestamp(),
				[userId2]: firestore.FieldValue.serverTimestamp(),
			},
		};

		// Create in conversations collection
		const conversationRef = db.collection("conversations").doc();
		await conversationRef.set(conversationData);

		// Also add to both users' conversations subcollection
		const user1ConversationsRef = db
			.collection("users")
			.doc(userId1)
			.collection("conversations")
			.doc(conversationRef.id);
		const user2ConversationsRef = db
			.collection("users")
			.doc(userId2)
			.collection("conversations")
			.doc(conversationRef.id);

		await Promise.all([
			user1ConversationsRef.set(conversationData),
			user2ConversationsRef.set(conversationData),
		]);

		return conversationRef.id;
	} catch (error) {
		console.error("[createConversation] Error:", error);
		throw error;
	}
};

// Send a message in a conversation
export const sendMessage = async (
	conversationId: string,
	senderId: string,
	text: string,
	gameShare?: GameShare
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Get sender's user data
		const senderDoc = await db.collection("users").doc(senderId).get();
		const senderData = senderDoc.data();

		// Create message
		const messageData: any = {
			senderId,
			senderUsername: senderData?.username || "",
			senderProfilePicture: senderData?.profilePicture || null,
			text,
			read: false,
			createdAt: firestore.FieldValue.serverTimestamp(),
		};

		if (gameShare) {
			messageData.gameShare = gameShare;
		}

		// Add message to conversation
		const messageRef = db
			.collection("conversations")
			.doc(conversationId)
			.collection("messages")
			.doc();

		await messageRef.set(messageData);

		// Update conversation's lastMessage and updatedAt
		const conversationRef = db.collection("conversations").doc(conversationId);
		const conversationDoc = await conversationRef.get();
		const conversationData = conversationDoc.data();

		if (conversationData) {
			const participants = conversationData.participants || [];
			const lastRead = conversationData.lastRead || {};
			// Mark as unread for recipient(s)
			participants.forEach((participantId: string) => {
				if (participantId !== senderId) {
					lastRead[participantId] = null; // null means unread
				}
			});

			await conversationRef.update({
				lastMessage: {
					text,
					senderId,
					timestamp: firestore.FieldValue.serverTimestamp(),
				},
				updatedAt: firestore.FieldValue.serverTimestamp(),
				lastRead,
			});

			// Also update in users' conversations subcollections
			await Promise.all(
				participants.map(async (participantId: string) => {
					const userConversationRef = db
						.collection("users")
						.doc(participantId)
						.collection("conversations")
						.doc(conversationId);

					await userConversationRef.update({
						lastMessage: {
							text,
							senderId,
							timestamp: firestore.FieldValue.serverTimestamp(),
						},
						updatedAt: firestore.FieldValue.serverTimestamp(),
						lastRead,
					});
				})
			);
		}
	} catch (error) {
		console.error("[sendMessage] Error:", error);
		throw error;
	}
};

// Fetch all conversations for a user
export const fetchConversations = async (
	userId: string,
	calculateUnreadCounts: boolean = false
): Promise<Conversation[]> => {
	try {
		const conversationsRef = db
			.collection("users")
			.doc(userId)
			.collection("conversations");

		const snapshot = await conversationsRef
			.orderBy("updatedAt", "desc")
			.limit(100)
			.get();

		const conversations: Conversation[] = [];
		snapshot.forEach((doc) => {
			const data = doc.data();
			const lastRead = data.lastRead || {};
			const lastReadTime = lastRead[userId];
			const lastMessage = data.lastMessage;

			// Quick unread count estimate: if last message is from someone else and
			// lastRead is before lastMessage timestamp, likely unread
			let unreadCount = 0;
			if (lastMessage && lastMessage.senderId !== userId) {
				const lastReadTimestamp = lastReadTime?.toMillis?.() || 0;
				const lastMessageTimestamp = lastMessage.timestamp?.toMillis?.() || 0;
				if (lastReadTimestamp < lastMessageTimestamp) {
					// Likely has unread messages - set to 1 as estimate
					unreadCount = 1;
				}
			}

			conversations.push({
				id: doc.id,
				participants: data.participants || [],
				lastMessage: lastMessage
					? {
							text: lastMessage.text,
							senderId: lastMessage.senderId,
							timestamp: lastMessage.timestamp?.toDate() || new Date(),
					  }
					: undefined,
				lastRead: lastRead,
				createdAt: data.createdAt?.toDate() || new Date(),
				updatedAt: data.updatedAt?.toDate() || new Date(),
				unreadCount,
			});
		});

		// Optionally calculate accurate unread counts (slower, but more accurate)
		// This is deferred to avoid blocking the initial render
		if (calculateUnreadCounts && conversations.length > 0) {
			// Calculate accurate unread counts - await to ensure they're updated before returning
			await Promise.all(
				conversations.map(async (conv) => {
					try {
						const lastReadTime = conv.lastRead?.[userId];
						const messagesSnapshot = await db
							.collection("conversations")
							.doc(conv.id)
							.collection("messages")
							.orderBy("createdAt", "desc")
							.limit(50)
							.get();

						// Check if the last message from the other person is read
						let lastMessageFromOther: any = null;
						messagesSnapshot.forEach((doc) => {
							const data = doc.data();
							if (data.senderId !== userId && !lastMessageFromOther) {
								lastMessageFromOther = { id: doc.id, ...data };
							}
						});

						// If the last message from the other person is read, unreadCount = 0
						if (lastMessageFromOther && lastMessageFromOther.read === true) {
							conv.unreadCount = 0;
							return;
						}

						let unreadCount = 0;
						messagesSnapshot.forEach((doc) => {
							const data = doc.data();
							// Only count messages from other users that are not marked as read
							// The read field is the source of truth
							if (data.senderId !== userId && data.read !== true) {
								unreadCount++;
							}
						});

						conv.unreadCount = unreadCount;
					} catch (err) {
						console.error("[fetchConversations] Error counting unread:", err);
						conv.unreadCount = 0;
					}
				})
			);
		}

		return conversations;
	} catch (error) {
		console.error("[fetchConversations] Error:", error);
		return [];
	}
};

// Fetch messages for a conversation
export const fetchMessages = async (
	conversationId: string,
	limit: number = 50
): Promise<Message[]> => {
	try {
		const messagesRef = db
			.collection("conversations")
			.doc(conversationId)
			.collection("messages");

		const snapshot = await messagesRef
			.orderBy("createdAt", "desc")
			.limit(limit)
			.get();

		const messages: Message[] = [];
		snapshot.forEach((doc) => {
			const data = doc.data();
			messages.push({
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

		// Reverse to show oldest first
		return messages.reverse();
	} catch (error) {
		console.error("[fetchMessages] Error:", error);
		return [];
	}
};

// Mark conversation as read
export const markConversationRead = async (
	conversationId: string,
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const now = firestore.FieldValue.serverTimestamp();

		// Update main conversation
		const conversationRef = db.collection("conversations").doc(conversationId);
		const conversationDoc = await conversationRef.get();
		const conversationData = conversationDoc.data();

		if (conversationData) {
			const lastRead = conversationData.lastRead || {};
			lastRead[userId] = now;

			await conversationRef.update({
				lastRead,
			});

			// Update in users' conversations subcollections
			const participants = conversationData.participants || [];
			await Promise.all(
				participants.map(async (participantId: string) => {
					const userConversationRef = db
						.collection("users")
						.doc(participantId)
						.collection("conversations")
						.doc(conversationId);

					await userConversationRef.update({
						lastRead,
					});
				})
			);

			// Mark all messages as read - avoid composite index queries
			const messagesSnapshot = await db
				.collection("conversations")
				.doc(conversationId)
				.collection("messages")
				.orderBy("createdAt", "desc")
				.limit(100)
				.get();

			const batch = db.batch();
			let batchHasUpdates = false;
			messagesSnapshot.forEach((doc) => {
				const data = doc.data();
				// Mark all messages from other users as read
				if (data.senderId !== userId) {
					console.log("Marking message as read:", data.senderId);
					batch.update(doc.ref, { read: true });
					batchHasUpdates = true;
				}
			});

			if (batchHasUpdates) {
				await batch.commit();
			}
		}
	} catch (error) {
		console.error("[markConversationRead] Error:", error);
		throw error;
	}
};

// Delete a conversation between two users
export const deleteConversation = async (
	conversationId: string,
	userId1: string,
	userId2: string
): Promise<void> => {
	try {
		// Get conversation data to find participants
		const conversationRef = db.collection("conversations").doc(conversationId);
		const conversationDoc = await conversationRef.get();
		const conversationData = conversationDoc.data();

		if (!conversationData) {
			// Conversation doesn't exist, nothing to delete
			return;
		}

		const participants = conversationData.participants || [userId1, userId2];

		// Delete all messages in the conversation
		const messagesRef = db
			.collection("conversations")
			.doc(conversationId)
			.collection("messages");

		// Get all messages and delete in batches
		let lastDoc: any = null;
		const BATCH_SIZE = 500; // Firestore batch limit is 500

		while (true) {
			let query = messagesRef.orderBy("createdAt", "desc").limit(BATCH_SIZE);
			if (lastDoc) {
				query = query.startAfter(lastDoc);
			}

			const snapshot = await query.get();
			if (snapshot.empty) {
				break;
			}

			const batch = db.batch();
			snapshot.forEach((doc) => {
				batch.delete(doc.ref);
			});
			await batch.commit();

			if (snapshot.size < BATCH_SIZE) {
				break;
			}
			lastDoc = snapshot.docs[snapshot.docs.length - 1];
		}

		// Delete from main conversations collection
		await conversationRef.delete();

		// Delete from both users' conversations subcollections
		await Promise.all(
			participants.map(async (participantId: string) => {
				const userConversationRef = db
					.collection("users")
					.doc(participantId)
					.collection("conversations")
					.doc(conversationId);

				await userConversationRef.delete();
			})
		);
	} catch (error) {
		console.error("[deleteConversation] Error:", error);
		throw error;
	}
};

// Share a game to DM
export const shareGameToDM = async (
	gameId: string,
	senderId: string,
	recipientId: string
): Promise<void> => {
	try {
		// Parse gameId to extract gameType and difficulty
		const parts = gameId.split("_");
		if (parts.length < 3) {
			throw new Error("Invalid gameId format");
		}

		const gameType = parts[0];
		const difficulty = parts[1];
		const actualGameId = parts.slice(2).join("_");

		const gameShare: GameShare = {
			gameId: actualGameId,
			gameType,
			difficulty,
		};

		// Get or create conversation
		let conversationId = await getConversationId(senderId, recipientId);
		if (!conversationId) {
			conversationId = await createConversation(senderId, recipientId);
		}

		// Send message with game share
		await sendMessage(
			conversationId,
			senderId,
			"Check out this game!",
			gameShare
		);
	} catch (error) {
		console.error("[shareGameToDM] Error:", error);
		throw error;
	}
};
