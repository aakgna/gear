// Social features: follow/unfollow, fetch followers/following, creator profiles
import { db, docExists } from "./firebase";
import { invalidateBlockedUsersCache } from "./blockedUsersCache";
import auth from "@react-native-firebase/auth";

export interface UserSummary {
	uid: string;
	username?: string;
	email?: string;
	followerCount?: number;
	followingCount?: number;
	createdGamesCount?: number;
	bio?: string;
	profilePicture?: string;
	// Stats fields
	totalGamesPlayed?: number;
	streakCount?: number;
	averageTimePerGame?: number;
}

export interface UserPublicProfile extends UserSummary {
	createdAt?: any;
	updatedAt?: any;
}

export interface GameSummary {
	gameId: string;
	gameType: string;
	difficulty: string;
	createdAt: any;
	playCount: number;
	title?: string;
}

export interface Notification {
	id: string;
	type: "follow" | "game_like" | "comment_like";
	fromUserId: string;
	fromUsername: string;
	fromProfilePicture?: string | null;
	createdAt: any;
	read: boolean;
	// New fields for grouping
	gameId?: string;        // For game_like and comment_like
	commentId?: string;     // For comment_like only
	gameType?: string;       // For navigation
	difficulty?: string;     // For navigation
	likeCount?: number;      // Aggregated count for grouped notifications
	// For grouped notifications - array of user IDs who performed the action
	fromUserIds?: string[];  // All users who liked (for grouping)
}

// ============================================================================
// NOTIFICATION HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a unique key for grouping notifications
 * - Game likes: gameId
 * - Comment likes: gameId + "_" + commentId
 * - Follow: null (no grouping)
 */
const getNotificationGroupKey = (
	type: "follow" | "game_like" | "comment_like",
	gameId?: string,
	commentId?: string
): string | null => {
	if (type === "follow") {
		return null;
	}
	if (type === "game_like" && gameId) {
		return gameId;
	}
	if (type === "comment_like" && gameId && commentId) {
		return `${gameId}_${commentId}`;
	}
	return null;
};

/**
 * Creates or updates a grouped notification
 * If a notification with the same group key exists, updates it
 * Otherwise, creates a new notification
 */
const createOrUpdateGroupedNotification = async (
	recipientUid: string,
	type: "game_like" | "comment_like",
	fromUserId: string,
	fromUsername: string,
	fromProfilePicture: string | null | undefined,
	gameId: string,
	gameType?: string,
	difficulty?: string,
	commentId?: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const groupKey = getNotificationGroupKey(type, gameId, commentId);
		
		if (!groupKey) {
			throw new Error("Invalid group key for notification type");
		}

		// Query for existing notification with same group key
		const notificationsRef = db
			.collection("users")
			.doc(recipientUid)
			.collection("notifications");

		// For game_like, query by gameId
		// For comment_like, query by gameId and commentId
		let query = notificationsRef.where("type", "==", type);
		
		if (type === "game_like") {
			query = query.where("gameId", "==", gameId);
		} else if (type === "comment_like") {
			query = query.where("gameId", "==", gameId).where("commentId", "==", commentId);
		}

		const existingSnapshot = await query.get();

		if (!existingSnapshot.empty) {
			// Update existing notification
			const existingDoc = existingSnapshot.docs[0];
			const existingData = existingDoc.data();
			const existingFromUserIds = existingData?.fromUserIds || [];
			const existingLikeCount = existingData?.likeCount || 1;

			// Check if user already in the group
			if (existingFromUserIds.includes(fromUserId)) {
				// User already liked, no need to update
				return;
			}

			// Add user to the group and increment count
			const batch = db.batch();
			batch.update(existingDoc.ref, {
				fromUserIds: firestore.FieldValue.arrayUnion(fromUserId),
				likeCount: firestore.FieldValue.increment(1),
				createdAt: firestore.FieldValue.serverTimestamp(), // Update timestamp to most recent
				// Update primary user info if this is the most recent like
				fromUserId: fromUserId,
				fromUsername: fromUsername,
				fromProfilePicture: fromProfilePicture,
			});

			// Update unread count if notification was read (new like makes it unread again)
			const userRef = db.collection("users").doc(recipientUid);
			const userDoc = await userRef.get();
			if (docExists(userDoc)) {
				const wasRead = existingData?.read || false;
				if (wasRead) {
					// Mark as unread and increment count
					batch.update(existingDoc.ref, {
						read: false,
					});
					batch.update(userRef, {
						unreadNotificationCount: firestore.FieldValue.increment(1),
						updatedAt: firestore.FieldValue.serverTimestamp(),
					});
				}
			}

			await batch.commit();
		} else {
			// Create new notification
			const notificationRef = notificationsRef.doc();
			const batch = db.batch();

			const notificationData: any = {
				type,
				fromUserId,
				fromUsername,
				fromProfilePicture: fromProfilePicture || null,
				createdAt: firestore.FieldValue.serverTimestamp(),
				read: false,
				gameId,
				gameType,
				difficulty,
				likeCount: 1,
				fromUserIds: [fromUserId],
			};

			if (commentId) {
				notificationData.commentId = commentId;
			}

			batch.set(notificationRef, notificationData);

			// Increment unread count
			const userRef = db.collection("users").doc(recipientUid);
			const userDoc = await userRef.get();
			if (docExists(userDoc)) {
				const currentUnreadCount = userDoc.data()?.unreadNotificationCount ?? 0;
				batch.update(userRef, {
					unreadNotificationCount: firestore.FieldValue.increment(1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			} else {
				batch.set(
					userRef,
					{
						unreadNotificationCount: 1,
						updatedAt: firestore.FieldValue.serverTimestamp(),
					},
					{ merge: true }
				);
			}

			await batch.commit();
		}
	} catch (error: any) {
		console.error("[createOrUpdateGroupedNotification] Error:", error);
		throw error;
	}
};

// Follow a user (creates bidirectional relationship)
export const followUser = async (
	currentUid: string,
	targetUid: string
): Promise<void> => {
	try {
		if (currentUid === targetUid) {
			throw new Error("Cannot follow yourself");
		}

		const firestore = require("@react-native-firebase/firestore").default;

		// Get current user's data for notification
		const currentUserRef = db.collection("users").doc(currentUid);
		const currentUserDoc = await currentUserRef.get();
		const currentUserData = currentUserDoc.data();
		const currentUserExists = docExists(currentUserDoc);

		// Use batch to ensure atomicity
		const batch = db.batch();

		// Add to current user's following list
		const currentUserFollowingRef = db
			.collection("users")
			.doc(currentUid)
			.collection("following")
			.doc(targetUid);

		// Add to target user's followers list
		const targetUserFollowersRef = db
			.collection("users")
			.doc(targetUid)
			.collection("followers")
			.doc(currentUid);

		// Check if already following
		const currentFollowingDoc = await currentUserFollowingRef.get();
		const alreadyExists = docExists(currentFollowingDoc);
		if (alreadyExists) {
			// Already following, return silently (not an error)
			return;
		}

		// Add follow relationships
		batch.set(currentUserFollowingRef, {
			followedAt: firestore.FieldValue.serverTimestamp(),
		});

		batch.set(targetUserFollowersRef, {
			followedAt: firestore.FieldValue.serverTimestamp(),
		});

		// Create notification for target user
		const notificationRef = db
			.collection("users")
			.doc(targetUid)
			.collection("notifications")
			.doc(); // Auto-generated ID

		batch.set(notificationRef, {
			type: "follow",
			fromUserId: currentUid,
			fromUsername: currentUserData?.username || "",
			fromProfilePicture: currentUserData?.profilePicture || null,
			createdAt: firestore.FieldValue.serverTimestamp(),
			read: false,
		});

		// Update follower/following counts
		// currentUserRef already defined above, reuse it
		const targetUserRef = db.collection("users").doc(targetUid);

		// Get target user document to check counts (currentUserDoc already fetched above)
		const targetUserDoc = await targetUserRef.get();

		// Update current user's followingCount (reuse currentUserDoc from above)
		const currentFollowingCount = currentUserDoc.data()?.followingCount;
		if (currentFollowingCount === undefined || currentFollowingCount === null) {
			batch.set(
				currentUserRef,
				{
					followingCount: 1,
					updatedAt: firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true }
			);
		} else {
			batch.update(currentUserRef, {
				followingCount: firestore.FieldValue.increment(1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}

		// Update target user's followerCount
		const targetFollowerCount = targetUserDoc.data()?.followerCount;
		const targetUnreadCount =
			targetUserDoc.data()?.unreadNotificationCount ?? 0;

		if (targetFollowerCount === undefined || targetFollowerCount === null) {
			batch.set(
				targetUserRef,
				{
					followerCount: 1,
					unreadNotificationCount: targetUnreadCount + 1,
					updatedAt: firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true }
			);
		} else {
			batch.update(targetUserRef, {
				followerCount: firestore.FieldValue.increment(1),
				unreadNotificationCount: firestore.FieldValue.increment(1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}

		await batch.commit();

		// Verify the follow relationship was created
		const verifyFollowingDoc = await currentUserFollowingRef.get();
		const followingExists = docExists(verifyFollowingDoc);

		const verifyFollowersDoc = await targetUserFollowersRef.get();
		const followersExists = docExists(verifyFollowersDoc);

		if (!followingExists) {
			console.error(
				`[followUser] ERROR: Follow relationship not created for ${currentUid} -> ${targetUid}`
			);
			console.error(
				`[followUser] Following path: users/${currentUid}/following/${targetUid}`
			);
			throw new Error("Failed to create follow relationship");
		}

		if (!followersExists) {
			console.error(
				`[followUser] ERROR: Follower relationship not created for ${targetUid} <- ${currentUid}`
			);
			console.error(
				`[followUser] Followers path: users/${targetUid}/followers/${currentUid}`
			);
			throw new Error("Failed to create follower relationship");
		}
		
		// Invalidate following cache
		invalidateFollowingCache(currentUid, targetUid);

		// Send push notification to target user via Firebase Cloud Function
		try {
			const currentAuthUser = auth().currentUser;
			if (currentAuthUser) {
				const idToken = await currentAuthUser.getIdToken(true); // Force refresh token
				const username = currentUserData?.username || "Someone";

				// Call Firebase Cloud Function to send push notification
				const notificationUrl =
					"https://us-central1-gear-ff009.cloudfunctions.net/send_notification_to_user";
				const response = await fetch(notificationUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						data: {
							userId: targetUid,
							title: "New Follower",
							body: `${username} started following you`,
						},
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
				}

				const result = await response.json();
				if (!result?.result?.success && !result?.success) {
					console.log(
						"[followUser] Push notification not sent (user may not have FCM token):",
						result
					);
				}
			}
		} catch (pushError) {
			// Don't fail the follow operation if push notification fails
			console.error("[followUser] Error sending push notification:", pushError);
		}
	} catch (error: any) {
		console.error("[followUser] Error:", error);
		// Log more details about the error
		if (error.code) {
			console.error("[followUser] Error code:", error.code);
		}
		if (error.message) {
			console.error("[followUser] Error message:", error.message);
		}
		throw error;
	}
};

// Unfollow a user
export const unfollowUser = async (
	currentUid: string,
	targetUid: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Use batch to ensure atomicity
		const batch = db.batch();

		// Remove from current user's following list
		const currentUserFollowingRef = db
			.collection("users")
			.doc(currentUid)
			.collection("following")
			.doc(targetUid);

		// Remove from target user's followers list
		const targetUserFollowersRef = db
			.collection("users")
			.doc(targetUid)
			.collection("followers")
			.doc(currentUid);

		// Check if following
		const currentFollowingDoc = await currentUserFollowingRef.get();
		const isCurrentlyFollowing = docExists(currentFollowingDoc);
		if (!isCurrentlyFollowing) {
			throw new Error("Not following this user");
		}

		// Remove follow relationships
		batch.delete(currentUserFollowingRef);
		batch.delete(targetUserFollowersRef);

		// Update follower/following counts
		const currentUserRef = db.collection("users").doc(currentUid);
		const targetUserRef = db.collection("users").doc(targetUid);

		// Ensure counts exist and are valid before decrementing
		const currentUserDoc = await currentUserRef.get();
		const targetUserDoc = await targetUserRef.get();

		const currentFollowingCount = currentUserDoc.data()?.followingCount ?? 0;
		const targetFollowerCount = targetUserDoc.data()?.followerCount ?? 0;

		if (currentFollowingCount > 0) {
			batch.update(currentUserRef, {
				followingCount: firestore.FieldValue.increment(-1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			batch.set(
				currentUserRef,
				{
					followingCount: 0,
					updatedAt: firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true }
			);
		}

		if (targetFollowerCount > 0) {
			batch.update(targetUserRef, {
				followerCount: firestore.FieldValue.increment(-1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			batch.set(
				targetUserRef,
				{
					followerCount: 0,
					updatedAt: firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true }
			);
		}

		await batch.commit();
		
		// Invalidate following cache
		invalidateFollowingCache(currentUid, targetUid);
	} catch (error: any) {
		console.error("[unfollowUser] Error:", error);
		throw error;
	}
};

// Simple in-memory cache for following status
interface FollowingCacheEntry {
	isFollowing: boolean;
	timestamp: number;
}
const followingStatusCache = new Map<string, FollowingCacheEntry>();
const FOLLOWING_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Check if current user follows target (with caching)
export const isFollowing = async (
	currentUid: string,
	targetUid: string
): Promise<boolean> => {
	const cacheKey = `${currentUid}_${targetUid}`;
	const cached = followingStatusCache.get(cacheKey);
	
	// Return cached value if still valid
	if (cached && Date.now() - cached.timestamp < FOLLOWING_CACHE_TTL) {
		return cached.isFollowing;
	}
	
	try {
		const followingRef = db
			.collection("users")
			.doc(currentUid)
			.collection("following")
			.doc(targetUid);

		const doc = await followingRef.get();

		// Check if document exists - handle both property and method cases
		const exists = docExists(doc);
		const result = !!exists;
		
		// Cache the result
		followingStatusCache.set(cacheKey, {
			isFollowing: result,
			timestamp: Date.now(),
		});
		
		return result;
	} catch (error: any) {
		// Silent error for transient Firestore issues
		if (error?.code === "firestore/unavailable") {
			console.log("[isFollowing] Firestore temporarily unavailable");
		} else {
			console.error("[isFollowing] Error:", error);
		}
		return false;
	}
};

// Invalidate following cache when follow/unfollow happens
export const invalidateFollowingCache = (
	currentUid: string,
	targetUid: string
): void => {
	const cacheKey = `${currentUid}_${targetUid}`;
	followingStatusCache.delete(cacheKey);
};

// Batch check following status for multiple users (efficient for notifications)
export const batchCheckFollowing = async (
	currentUid: string,
	targetUids: string[]
): Promise<Record<string, boolean>> => {
	const results: Record<string, boolean> = {};
	const uncachedUids: string[] = [];
	
	// Check cache first
	for (const targetUid of targetUids) {
		const cacheKey = `${currentUid}_${targetUid}`;
		const cached = followingStatusCache.get(cacheKey);
		
		if (cached && Date.now() - cached.timestamp < FOLLOWING_CACHE_TTL) {
			results[targetUid] = cached.isFollowing;
		} else {
			uncachedUids.push(targetUid);
		}
	}
	
	// Fetch uncached statuses in parallel
	if (uncachedUids.length > 0) {
		const promises = uncachedUids.map(async (targetUid) => {
			const isFollowingUser = await isFollowing(currentUid, targetUid);
			return { targetUid, isFollowingUser };
		});
		
		const fetchedResults = await Promise.all(promises);
		fetchedResults.forEach(({ targetUid, isFollowingUser }) => {
			results[targetUid] = isFollowingUser;
		});
	}
	
	return results;
};

// ============================================================================
// BLOCKING FUNCTIONS
// ============================================================================

// Block a user
export const blockUser = async (
	blockerId: string,
	blockedId: string
): Promise<void> => {
	try {
		if (blockerId === blockedId) {
			throw new Error("Cannot block yourself");
		}

		const firestore = require("@react-native-firebase/firestore").default;

		// Use batch to ensure atomicity
		const batch = db.batch();

		// Add to blocker's blocked subcollection
		const blockerBlockedRef = db
			.collection("users")
			.doc(blockerId)
			.collection("blocked")
			.doc(blockedId);

		// Add to blocked user's blockedBy subcollection
		const blockedBlockedByRef = db
			.collection("users")
			.doc(blockedId)
			.collection("blockedBy")
			.doc(blockerId);

		// Check if already blocked
		const existingBlockDoc = await blockerBlockedRef.get();
		if (docExists(existingBlockDoc)) {
			// Already blocked, return silently
			return;
		}

		// Add block relationships
		batch.set(blockerBlockedRef, {
			blockedAt: firestore.FieldValue.serverTimestamp(),
		});

		batch.set(blockedBlockedByRef, {
			blockedAt: firestore.FieldValue.serverTimestamp(),
		});

		// Unfollow each other if following (bidirectional)
		const blockerFollowingRef = db
			.collection("users")
			.doc(blockerId)
			.collection("following")
			.doc(blockedId);

		const blockedFollowingRef = db
			.collection("users")
			.doc(blockedId)
			.collection("following")
			.doc(blockerId);

		const blockerFollowersRef = db
			.collection("users")
			.doc(blockerId)
			.collection("followers")
			.doc(blockedId);

		const blockedFollowersRef = db
			.collection("users")
			.doc(blockedId)
			.collection("followers")
			.doc(blockerId);

		// Check and remove follow relationships
		const blockerFollowingDoc = await blockerFollowingRef.get();
		const blockedFollowingDoc = await blockedFollowingRef.get();

		if (docExists(blockerFollowingDoc)) {
			batch.delete(blockerFollowingRef);
			batch.delete(blockedFollowersRef);
		}

		if (docExists(blockedFollowingDoc)) {
			batch.delete(blockedFollowingRef);
			batch.delete(blockerFollowersRef);
		}

		// Update follower/following counts if relationships existed
		const blockerUserRef = db.collection("users").doc(blockerId);
		const blockedUserRef = db.collection("users").doc(blockedId);

		if (docExists(blockerFollowingDoc)) {
			const blockerUserDoc = await blockerUserRef.get();
			const blockerFollowingCount = blockerUserDoc.data()?.followingCount ?? 0;
			if (blockerFollowingCount > 0) {
				batch.update(blockerUserRef, {
					followingCount: firestore.FieldValue.increment(-1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}

			const blockedUserDoc = await blockedUserRef.get();
			const blockedFollowerCount = blockedUserDoc.data()?.followerCount ?? 0;
			if (blockedFollowerCount > 0) {
				batch.update(blockedUserRef, {
					followerCount: firestore.FieldValue.increment(-1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}
		}

		if (docExists(blockedFollowingDoc)) {
			const blockedUserDoc = await blockedUserRef.get();
			const blockedFollowingCount = blockedUserDoc.data()?.followingCount ?? 0;
			if (blockedFollowingCount > 0) {
				batch.update(blockedUserRef, {
					followingCount: firestore.FieldValue.increment(-1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}

			const blockerUserDoc = await blockerUserRef.get();
			const blockerFollowerCount = blockerUserDoc.data()?.followerCount ?? 0;
			if (blockerFollowerCount > 0) {
				batch.update(blockerUserRef, {
					followerCount: firestore.FieldValue.increment(-1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}
		}

		await batch.commit();

		// Invalidate blocked users cache since we just blocked someone
		invalidateBlockedUsersCache();

		// Delete conversation if it exists
		// Use require to avoid circular dependency issues
		const messagingModule = require("./messaging");
		const conversationId = await messagingModule.getConversationId(
			blockerId,
			blockedId
		);
		if (conversationId) {
			try {
				await messagingModule.deleteConversation(
					conversationId,
					blockerId,
					blockedId
				);
			} catch (convError) {
				console.error("[blockUser] Error deleting conversation:", convError);
				// Don't throw - blocking should succeed even if conversation deletion fails
			}
		}
	} catch (error: any) {
		console.error("[blockUser] Error:", error);
		throw error;
	}
};

// Unblock a user
export const unblockUser = async (
	unblockerId: string,
	unblockedId: string
): Promise<void> => {
	try {
		if (unblockerId === unblockedId) {
			throw new Error("Cannot unblock yourself");
		}

		const firestore = require("@react-native-firebase/firestore").default;

		// Use batch to ensure atomicity
		const batch = db.batch();

		// Remove from unblocker's blocked subcollection
		const blockerBlockedRef = db
			.collection("users")
			.doc(unblockerId)
			.collection("blocked")
			.doc(unblockedId);

		// Remove from unblocked user's blockedBy subcollection
		const unblockedBlockedByRef = db
			.collection("users")
			.doc(unblockedId)
			.collection("blockedBy")
			.doc(unblockerId);

		// Check if blocked
		const existingBlockDoc = await blockerBlockedRef.get();
		if (!docExists(existingBlockDoc)) {
			// Not blocked, return silently
			return;
		}

		// Remove block relationships
		batch.delete(blockerBlockedRef);
		batch.delete(unblockedBlockedByRef);

		await batch.commit();

		// Invalidate blocked users cache since we just unblocked someone
		invalidateBlockedUsersCache();
	} catch (error: any) {
		console.error("[unblockUser] Error:", error);
		throw error;
	}
};

// Check if a user has blocked another user
export const isUserBlocked = async (
	userId: string,
	targetUserId: string
): Promise<boolean> => {
	try {
		const blockedRef = db
			.collection("users")
			.doc(userId)
			.collection("blocked")
			.doc(targetUserId);

		const doc = await blockedRef.get();
		return docExists(doc);
	} catch (error: any) {
		console.error("[isUserBlocked] Error:", error);
		return false;
	}
};

// Check if a user is blocked by another user
export const isBlockedByUser = async (
	userId: string,
	targetUserId: string
): Promise<boolean> => {
	try {
		const blockedByRef = db
			.collection("users")
			.doc(userId)
			.collection("blockedBy")
			.doc(targetUserId);

		const doc = await blockedByRef.get();
		return docExists(doc);
	} catch (error: any) {
		console.error("[isBlockedByUser] Error:", error);
		return false;
	}
};

// Get list of users blocked by a user
export const getBlockedUsers = async (userId: string): Promise<string[]> => {
	try {
		const blockedRef = db.collection("users").doc(userId).collection("blocked");

		const snapshot = await blockedRef.get();
		const blockedIds: string[] = [];
		snapshot.forEach((doc) => {
			blockedIds.push(doc.id);
		});
		return blockedIds;
	} catch (error: any) {
		console.error("[getBlockedUsers] Error:", error);
		return [];
	}
};

// Get list of users who blocked a user
export const getBlockedByUsers = async (userId: string): Promise<string[]> => {
	try {
		const blockedByRef = db
			.collection("users")
			.doc(userId)
			.collection("blockedBy");

		const snapshot = await blockedByRef.get();
		const blockedByIds: string[] = [];
		snapshot.forEach((doc) => {
			blockedByIds.push(doc.id);
		});
		return blockedByIds;
	} catch (error: any) {
		console.error("[getBlockedByUsers] Error:", error);
		return [];
	}
};

// Fetch followers list with pagination
export const fetchFollowers = async (
	uid: string,
	limit: number = 20,
	lastDoc?: any
): Promise<UserSummary[]> => {
	try {
		let query = db
			.collection("users")
			.doc(uid)
			.collection("followers")
			.orderBy("followedAt", "desc")
			.limit(limit);

		if (lastDoc) {
			query = query.startAfter(lastDoc);
		}

		const snapshot = await query.get();

		if (snapshot.empty) {
			return [];
		}

		// Fetch user details for each follower
		const followerUids = snapshot.docs.map((doc) => doc.id);
		const users: UserSummary[] = [];

		// Batch fetch user documents (Firestore 'in' query limited to 10)
		for (let i = 0; i < followerUids.length; i += 10) {
			const batch = followerUids.slice(i, i + 10);
			const userDocs = await Promise.all(
				batch.map((followerUid) =>
					db.collection("users").doc(followerUid).get()
				)
			);

			userDocs.forEach((userDoc) => {
				if (docExists(userDoc)) {
					const data = userDoc.data();
					users.push({
						uid: userDoc.id,
						username: data?.username,
						email: data?.email,
						followerCount: data?.followerCount || 0,
						followingCount: data?.followingCount || 0,
						createdGamesCount: data?.createdGamesCount || 0,
						bio: data?.bio,
						profilePicture: data?.profilePicture,
						totalGamesPlayed: data?.totalGamesPlayed || 0,
						streakCount: data?.streakCount || 0,
						averageTimePerGame: data?.averageTimePerGame || 0,
					});
				}
			});
		}

		return users;
	} catch (error: any) {
		console.error("[fetchFollowers] Error:", error);
		return [];
	}
};

// Fetch following list with pagination
export const fetchFollowing = async (
	uid: string,
	limit: number = 20,
	lastDoc?: any
): Promise<UserSummary[]> => {
	try {
		let query = db
			.collection("users")
			.doc(uid)
			.collection("following")
			.orderBy("followedAt", "desc")
			.limit(limit);

		if (lastDoc) {
			query = query.startAfter(lastDoc);
		}

		const snapshot = await query.get();

		if (snapshot.empty) {
			return [];
		}

		// Fetch user details for each followed user
		const followedUids = snapshot.docs.map((doc) => doc.id);
		const users: UserSummary[] = [];

		// Batch fetch user documents (Firestore 'in' query limited to 10)
		for (let i = 0; i < followedUids.length; i += 10) {
			const batch = followedUids.slice(i, i + 10);
			const userDocs = await Promise.all(
				batch.map((followedUid) =>
					db.collection("users").doc(followedUid).get()
				)
			);

			userDocs.forEach((userDoc) => {
				if (docExists(userDoc)) {
					const data = userDoc.data();
					users.push({
						uid: userDoc.id,
						username: data?.username,
						email: data?.email,
						followerCount: data?.followerCount || 0,
						followingCount: data?.followingCount || 0,
						createdGamesCount: data?.createdGamesCount || 0,
						bio: data?.bio,
						profilePicture: data?.profilePicture,
						totalGamesPlayed: data?.totalGamesPlayed || 0,
						streakCount: data?.streakCount || 0,
						averageTimePerGame: data?.averageTimePerGame || 0,
					});
				}
			});
		}

		return users;
	} catch (error: any) {
		console.error("[fetchFollowing] Error:", error);
		return [];
	}
};

// Fetch user's created games
export const fetchCreatedGames = async (
	uid: string,
	limit: number = 20,
	lastDoc?: any
): Promise<GameSummary[]> => {
	try {
		let query = db
			.collection("users")
			.doc(uid)
			.collection("createdGames")
			.orderBy("createdAt", "desc")
			.limit(limit);

		if (lastDoc) {
			query = query.startAfter(lastDoc);
		}

		const snapshot = await query.get();

		if (snapshot.empty) {
			return [];
		}

		const games: GameSummary[] = [];
		snapshot.forEach((doc) => {
			const data = doc.data();
			// Skip games where visible is false
			if (data?.visible === false) {
				return;
			}
			games.push({
				gameId: doc.id,
				gameType: data?.gameType || "",
				difficulty: data?.difficulty || "",
				createdAt: data?.createdAt,
				playCount: data?.playCount || 0,
				title: data?.title,
			});
		});

		return games;
	} catch (error: any) {
		console.error("[fetchCreatedGames] Error:", error);
		return [];
	}
};

// Fetch user's liked games (optimized to minimize reads with parallel fetching)
export const fetchLikedGames = async (
	uid: string,
	limit: number = 50
): Promise<GameSummary[]> => {
	try {
		const likedSnapshot = await db
			.collection("users")
			.doc(uid)
			.collection("liked")
			.orderBy("createdAt", "desc")
			.limit(limit)
			.get();

		if (likedSnapshot.empty) {
			return [];
		}

		// Filter out games where visible is false in the liked subcollection
		const gameIds = likedSnapshot.docs
			.filter((doc) => {
				const data = doc.data();
				return data?.visible !== false;
			})
			.map((doc) => doc.id);

		// Group games by gameType and difficulty for better organization
		const gameGroups = new Map<
			string,
			{
				gameType: string;
				difficulty: string;
				docIds: string[];
				originalIds: string[];
			}
		>();

		gameIds.forEach((gameId) => {
			const parts = gameId.split("_");
			if (parts.length >= 3) {
				const gameType = parts[0];
				const difficulty = parts[1];
				const docId = parts.slice(2).join("_");
				const key = `${gameType}_${difficulty}`;

				if (!gameGroups.has(key)) {
					gameGroups.set(key, {
						gameType,
						difficulty,
						docIds: [],
						originalIds: [],
					});
				}
				const group = gameGroups.get(key)!;
				group.docIds.push(docId);
				group.originalIds.push(gameId); // Store full puzzleId
			}
		});

		// Fetch all games in parallel by group
		const fetchPromises = Array.from(gameGroups.entries()).map(
			async ([key, group]) => {
				const { gameType, difficulty, docIds, originalIds } = group;

				// Fetch all games in this group in parallel
				const gamePromises = docIds.map(async (docId, index) => {
					try {
						const gameDoc = await db
							.collection("games")
							.doc(gameType)
							.collection(difficulty)
							.doc(docId)
							.get();

						if (docExists(gameDoc)) {
							const gameData = gameDoc.data();
							// Skip games where visible is false
							if (gameData?.visible === false) {
								return null;
							}
							return {
								gameId: originalIds[index], // Return FULL puzzleId (gameType_difficulty_docId) to match fetchCreatedGames
								gameType: gameType as any,
								difficulty: difficulty as any,
								createdAt: gameData?.createdAt,
								playCount: gameData?.stats?.played || 0,
								title: gameData?.title,
								originalGameId: originalIds[index], // Keep for sorting
							};
						}
						return null;
					} catch (error) {
						console.error(`[fetchLikedGames] Error fetching ${docId}:`, error);
						return null;
					}
				});

				const results = await Promise.all(gamePromises);
				return results.filter(
					(g): g is NonNullable<typeof g> => g !== null
				) as (GameSummary & { originalGameId: string })[];
			}
		);

		const allGames = await Promise.all(fetchPromises);
		const flatGames = allGames.flat();

		// Create a map for quick lookup by original gameId
		const gameMap = new Map<string, GameSummary & { originalGameId: string }>();
		flatGames.forEach((g) => {
			gameMap.set(g.originalGameId, g);
		});

		// Return games in the same order as liked (by createdAt desc)
		const orderedGames: GameSummary[] = [];
		for (const id of gameIds) {
			const game = gameMap.get(id);
			if (game) {
				// Remove originalGameId before returning (it was only for internal sorting)
				const { originalGameId, ...gameSummary } = game;
				orderedGames.push(gameSummary);
			}
		}

		return orderedGames;
	} catch (error: any) {
		console.error("[fetchLikedGames] Error:", error);
		return [];
	}
};

// Get user by username (for profile routing)
export const getUserByUsername = async (
	username: string
): Promise<UserPublicProfile | null> => {
	try {
		const lowerUsername = username.toLowerCase();

		// Query users collection directly for username
		const usersSnapshot = await db
			.collection("users")
			.where("username", "==", lowerUsername)
			.limit(1)
			.get();

		if (usersSnapshot.empty) {
			return null;
		}

		const userDoc = usersSnapshot.docs[0];
		const data = userDoc.data();

		return {
			uid: userDoc.id,
			username: data?.username,
			email: data?.email,
			followerCount: data?.followerCount || 0,
			followingCount: data?.followingCount || 0,
			createdGamesCount: data?.createdGamesCount || 0,
			bio: data?.bio,
			profilePicture: data?.profilePicture,
			totalGamesPlayed: data?.totalGamesPlayed || 0,
			streakCount: data?.streakCount || 0,
			averageTimePerGame: data?.averageTimePerGame || 0,
			createdAt: data?.createdAt,
			updatedAt: data?.updatedAt,
		};
	} catch (error: any) {
		console.error("[getUserByUsername] Error:", error);
		return null;
	}
};

// Search users by username prefix (starts with)
export const searchUsersByUsername = async (
	query: string,
	limit: number = 20,
	currentUserId?: string
): Promise<UserPublicProfile[]> => {
	try {
		const lowerQuery = query.toLowerCase().trim();

		if (!lowerQuery) {
			return [];
		}

		// Use Firestore range query for "starts with" search
		// >= query and < query + "\uf8ff" (highest Unicode character)
		const usersSnapshot = await db
			.collection("users")
			.where("username", ">=", lowerQuery)
			.where("username", "<", lowerQuery + "\uf8ff")
			.limit(limit)
			.get();

		const users: UserPublicProfile[] = [];
		usersSnapshot.forEach((doc) => {
			const data = doc.data();
			users.push({
				uid: doc.id,
				username: data?.username,
				email: data?.email,
				followerCount: data?.followerCount || 0,
				followingCount: data?.followingCount || 0,
				createdGamesCount: data?.createdGamesCount || 0,
				bio: data?.bio,
				profilePicture: data?.profilePicture,
				totalGamesPlayed: data?.totalGamesPlayed || 0,
				streakCount: data?.streakCount || 0,
				averageTimePerGame: data?.averageTimePerGame || 0,
				createdAt: data?.createdAt,
				updatedAt: data?.updatedAt,
			});
		});

		// Filter out blocked users if currentUserId is provided
		if (currentUserId) {
			const blockedUserIds = await getBlockedUsers(currentUserId);
			const blockedByUserIds = await getBlockedByUsers(currentUserId);
			const blockedSet = new Set([...blockedUserIds, ...blockedByUserIds]);
			return users.filter((user) => !blockedSet.has(user.uid));
		}

		return users;
	} catch (error: any) {
		console.error("[searchUsersByUsername] Error:", error);
		return [];
	}
};

// Fetch user's public profile by UID
export const fetchUserProfile = async (
	uid: string
): Promise<UserPublicProfile | null> => {
	try {
		const userDoc = await db.collection("users").doc(uid).get();

		if (!docExists(userDoc)) {
			return null;
		}

		const data = userDoc.data();

		return {
			uid: userDoc.id,
			username: data?.username,
			email: data?.email,
			followerCount: data?.followerCount || 0,
			followingCount: data?.followingCount || 0,
			createdGamesCount: data?.createdGamesCount || 0,
			bio: data?.bio,
			profilePicture: data?.profilePicture,
			totalGamesPlayed: data?.totalGamesPlayed || 0,
			streakCount: data?.streakCount || 0,
			averageTimePerGame: data?.averageTimePerGame || 0,
			createdAt: data?.createdAt,
			updatedAt: data?.updatedAt,
		};
	} catch (error: any) {
		console.error("[fetchUserProfile] Error:", error);
		return null;
	}
};

// Fetch following feed games
export const fetchFollowingFeed = async (
	userId: string,
	limit: number = 15
): Promise<any[]> => {
	try {
		// 1. Get list of users this person follows
		const followingSnapshot = await db
			.collection("users")
			.doc(userId)
			.collection("following")
			.get();

		const followedUids = followingSnapshot.docs.map((doc) => doc.id);

		if (followedUids.length === 0) {
			return [];
		}

		// 1.5. Get blocked users and filter them out
		const blockedUserIds = await getBlockedUsers(userId);
		const blockedSet = new Set(blockedUserIds);
		const nonBlockedFollowedUids = followedUids.filter(
			(uid) => !blockedSet.has(uid)
		);

		if (nonBlockedFollowedUids.length === 0) {
			return [];
		}

		// 2. Fetch created games from followed users
		// Firestore 'in' query is limited to 10, so we batch if needed
		const allGames: any[] = [];

		for (let i = 0; i < nonBlockedFollowedUids.length; i += 10) {
			const batchUids = nonBlockedFollowedUids.slice(i, i + 10);

			// For each followed user, fetch their created games
			for (const uid of batchUids) {
				const createdGamesSnapshot = await db
					.collection("users")
					.doc(uid)
					.collection("createdGames")
					.orderBy("createdAt", "desc")
					.limit(10)
					.get();

				createdGamesSnapshot.forEach((doc) => {
					const gameData = doc.data();
					allGames.push({
						gameId: doc.id,
						gameType: gameData?.gameType,
						difficulty: gameData?.difficulty,
						createdAt: gameData?.createdAt,
						createdBy: uid,
						playCount: gameData?.playCount || 0,
					});
				});
			}
		}

		// 3. Sort by createdAt (earliest to latest, TikTok-style) and limit
		allGames.sort((a, b) => {
			const aTime = a.createdAt?.toMillis?.() || 0;
			const bTime = b.createdAt?.toMillis?.() || 0;
			return aTime - bTime;
		});

		return allGames.slice(0, limit);
	} catch (error: any) {
		console.error("[fetchFollowingFeed] Error:", error);
		return [];
	}
};

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

// Fetch notifications for a user
export const fetchNotifications = async (
	uid: string,
	limit: number = 50
): Promise<Notification[]> => {
	try {
		const snapshot = await db
			.collection("users")
			.doc(uid)
			.collection("notifications")
			.orderBy("createdAt", "desc")
			.limit(limit)
			.get();

		if (snapshot.empty) {
			return [];
		}

		return snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		})) as Notification[];
	} catch (error: any) {
		console.error("[fetchNotifications] Error:", error);
		return [];
	}
};

// Mark a notification as read
export const markNotificationAsRead = async (
	uid: string,
	notificationId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const notificationRef = db
			.collection("users")
			.doc(uid)
			.collection("notifications")
			.doc(notificationId);

		const notificationDoc = await notificationRef.get();
		if (!docExists(notificationDoc)) {
			throw new Error("Notification not found");
		}

		const notificationData = notificationDoc.data();
		if (notificationData?.read) {
			// Already read, no need to update
			return;
		}

		// Update notification and decrement unread count
		const batch = db.batch();
		batch.update(notificationRef, {
			read: true,
		});

		const userRef = db.collection("users").doc(uid);
		batch.update(userRef, {
			unreadNotificationCount: firestore.FieldValue.increment(-1),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

		await batch.commit();
	} catch (error: any) {
		console.error("[markNotificationAsRead] Error:", error);
		throw error;
	}
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (
	uid: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const snapshot = await db
			.collection("users")
			.doc(uid)
			.collection("notifications")
			.where("read", "==", false)
			.get();

		if (snapshot.empty) {
			return;
		}

		const batch = db.batch();
		const unreadCount = snapshot.docs.length;

		snapshot.docs.forEach((doc) => {
			batch.update(doc.ref, {
				read: true,
			});
		});

		// Update unread count
		const userRef = db.collection("users").doc(uid);
		batch.update(userRef, {
			unreadNotificationCount: firestore.FieldValue.increment(-unreadCount),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

		await batch.commit();
	} catch (error: any) {
		console.error("[markAllNotificationsAsRead] Error:", error);
		throw error;
	}
};

// Get unread notification count
// This function recalculates the count from actual notifications to ensure accuracy
export const getUnreadNotificationCount = async (
	uid: string
): Promise<number> => {
	try {
		// Recalculate from actual notifications to ensure accuracy
		const snapshot = await db
			.collection("users")
			.doc(uid)
			.collection("notifications")
			.where("read", "==", false)
			.get();

		const actualCount = snapshot.size;

		// Update the cached count field to keep it in sync
		const userRef = db.collection("users").doc(uid);
		const userDoc = await userRef.get();
		if (docExists(userDoc)) {
			const cachedCount = userDoc.data()?.unreadNotificationCount || 0;
			if (cachedCount !== actualCount) {
				await userRef.update({
					unreadNotificationCount: actualCount,
					updatedAt:
						require("@react-native-firebase/firestore").default.FieldValue.serverTimestamp(),
				});
			}
		}

		return actualCount;
	} catch (error: any) {
		console.error("[getUnreadNotificationCount] Error:", error);
		// Fallback to cached count if query fails
		try {
			const userDoc = await db.collection("users").doc(uid).get();
			if (docExists(userDoc)) {
				const data = userDoc.data();
				return data?.unreadNotificationCount || 0;
			}
		} catch (fallbackError) {
			console.error(
				"[getUnreadNotificationCount] Fallback error:",
				fallbackError
			);
		}
		return 0;
	}
};

// Delete a notification
export const deleteNotification = async (
	uid: string,
	notificationId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const notificationRef = db
			.collection("users")
			.doc(uid)
			.collection("notifications")
			.doc(notificationId);

		const notificationDoc = await notificationRef.get();
		if (!docExists(notificationDoc)) {
			throw new Error("Notification not found");
		}

		const notificationData = notificationDoc.data();
		const wasUnread = !notificationData?.read;

		// Delete notification and update unread count if needed
		const batch = db.batch();
		batch.delete(notificationRef);

		if (wasUnread) {
			const userRef = db.collection("users").doc(uid);
			batch.update(userRef, {
				unreadNotificationCount: firestore.FieldValue.increment(-1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}

		await batch.commit();
	} catch (error: any) {
		console.error("[deleteNotification] Error:", error);
		throw error;
	}
};

// ============================================================================
// GAME COMMENTS FUNCTIONS
// ============================================================================

import { GameComment } from "./types";
export { GameComment };
import { parsePuzzleId } from "./firebase";

// Add a comment to a game
export const addGameComment = async (
	gameId: string,
	userId: string,
	text: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			throw new Error("Invalid gameId format");
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		// Get user data
		const userDoc = await db.collection("users").doc(userId).get();
		const userData = userDoc.data();

		// Add comment
		const commentsRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("comments");

		await commentsRef.add({
			userId,
			username: userData?.username || "",
			profilePicture: userData?.profilePicture || null,
			text: text.trim(),
			createdAt: firestore.FieldValue.serverTimestamp(),
			likes: 0,
			likedBy: [],
		});

		// Increment comment count using FieldValue.increment for atomicity
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		const gameDoc = await gameRef.get();
		const gameData = gameDoc.data();
		const creatorId = gameData?.createdBy || gameData?.uid;

		await gameRef.set(
			{
				stats: {
					commentCount: firestore.FieldValue.increment(1),
				},
			},
			{ merge: true }
		);

		// Send push notification to game creator (skip if user is commenting on their own game)
		if (creatorId && creatorId !== userId) {
			try {
				const currentAuthUser = auth().currentUser;
				if (currentAuthUser) {
					const idToken = await currentAuthUser.getIdToken(true); // Force refresh token

				// Get game title from gameData, or create a default title
				const gameTitle = gameData?.title || `${gameType} ${difficulty}`;
				const username = userData?.username || "Someone";

				// Call Firebase Cloud Function to send push notification
				const notificationUrl =
					"https://us-central1-gear-ff009.cloudfunctions.net/send_notification_to_user";
				const response = await fetch(notificationUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						data: {
							userId: creatorId,
							title: "New Comment",
							body: `${username} commented on your game: "${gameTitle}"`,
						},
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
				}

				const result = await response.json();
				if (!result?.result?.success && !result?.success) {
					console.log(
						"[addGameComment] Push notification not sent (user may not have FCM token):",
						result
					);
				}
				}
			} catch (notifError) {
				// Don't fail the comment operation if notification fails
				console.error("[addGameComment] Error sending push notification:", notifError);
			}
		}

		// Invalidate cache since count changed
		invalidateSocialDataCache(gameId, userId);
	} catch (error: any) {
		console.error("[addGameComment] Error:", error);
		throw error;
	}
};

// Fetch comments for a game
export const fetchGameComments = async (
	gameId: string,
	limit: number = 50
): Promise<GameComment[]> => {
	try {
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			return [];
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const commentsRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("comments");

		const snapshot = await commentsRef
			.orderBy("createdAt", "desc")
			.limit(limit)
			.get();

		const comments: GameComment[] = [];
		snapshot.forEach((doc) => {
			const data = doc.data();
			comments.push({
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

		return comments.reverse(); // Show oldest first
	} catch (error: any) {
		console.error("[fetchGameComments] Error:", error);
		return [];
	}
};

// Like a comment
export const likeGameComment = async (
	gameId: string,
	commentId: string,
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			throw new Error("Invalid gameId format");
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const commentRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("comments")
			.doc(commentId);

		const commentDoc = await commentRef.get();
		if (!docExists(commentDoc)) {
			throw new Error("Comment not found");
		}

		const commentData = commentDoc.data();
		const likedBy = commentData?.likedBy || [];
		const commentAuthorId = commentData?.userId;

		if (likedBy.includes(userId)) {
			// Already liked, do nothing
			return;
		}

		// Add user to likedBy and increment likes
		await commentRef.update({
			likedBy: firestore.FieldValue.arrayUnion(userId),
			likes: firestore.FieldValue.increment(1),
		});

		// Create in-app notification and send push notification to comment author (skip if user is liking their own comment)
		if (commentAuthorId && commentAuthorId !== userId) {
			try {
				// Get user data for notification
				const userDoc = await db.collection("users").doc(userId).get();
				const userData = userDoc.data();

				// Create/update in-app Firestore notification (for notifications screen)
				await createOrUpdateGroupedNotification(
					commentAuthorId,
					"comment_like",
					userId,
					userData?.username || "",
					userData?.profilePicture || null,
					gameId,
					gameType,
					difficulty,
					commentId
				);

				// Send push notification via Firebase Cloud Function
				const currentAuthUser = auth().currentUser;
				if (currentAuthUser) {
					try {
						const idToken = await currentAuthUser.getIdToken(true); // Force refresh token

						// Get game data to get game title
						const gameRef = db
							.collection("games")
							.doc(gameType)
							.collection(difficulty)
							.doc(actualGameId);
						const gameDoc = await gameRef.get();
						const gameData = gameDoc.data();

						// Get game title from gameData, or create a default title
						const gameTitle = gameData?.title || `${gameType} ${difficulty}`;
						const username = userData?.username || "Someone";

						// Call Firebase Cloud Function to send push notification
						const notificationUrl =
							"https://us-central1-gear-ff009.cloudfunctions.net/send_notification_to_user";
						const response = await fetch(notificationUrl, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${idToken}`,
							},
							body: JSON.stringify({
								data: {
									userId: commentAuthorId,
									title: "Comment Liked",
									body: `${username} liked your comment on "${gameTitle}"`,
								},
							}),
						});

						if (!response.ok) {
							const errorText = await response.text();
							throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
						}

						const result = await response.json();
						if (!result?.result?.success && !result?.success) {
							console.log(
								"[likeGameComment] Push notification not sent (user may not have FCM token):",
								result
							);
						}
					} catch (pushError) {
						// Don't fail if push notification fails
						console.error("[likeGameComment] Error sending push notification:", pushError);
					}
				}
			} catch (notifError) {
				// Don't fail the like operation if notification fails
				console.error("[likeGameComment] Error creating notification:", notifError);
			}
		}
	} catch (error: any) {
		console.error("[likeGameComment] Error:", error);
		throw error;
	}
};

// Unlike a comment
export const unlikeGameComment = async (
	gameId: string,
	commentId: string,
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			throw new Error("Invalid gameId format");
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const commentRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("comments")
			.doc(commentId);

		const commentDoc = await commentRef.get();
		if (!docExists(commentDoc)) {
			throw new Error("Comment not found");
		}

		const commentData = commentDoc.data();
		const likedBy = commentData?.likedBy || [];
		const commentAuthorId = commentData?.userId;

		if (!likedBy.includes(userId)) {
			// Not liked, do nothing
			return;
		}

		// Remove user from likedBy and decrement likes
		await commentRef.update({
			likedBy: firestore.FieldValue.arrayRemove(userId),
			likes: firestore.FieldValue.increment(-1),
		});

		// Update notification for comment author (remove user from group or delete if count reaches 0)
		if (commentAuthorId && commentAuthorId !== userId) {
			try {
				const notificationsRef = db
					.collection("users")
					.doc(commentAuthorId)
					.collection("notifications");

				// Find notification for this comment like
				const notificationSnapshot = await notificationsRef
					.where("type", "==", "comment_like")
					.where("gameId", "==", gameId)
					.where("commentId", "==", commentId)
					.get();

				if (!notificationSnapshot.empty) {
					const notificationDoc = notificationSnapshot.docs[0];
					const notificationData = notificationDoc.data();
					const fromUserIds = notificationData?.fromUserIds || [];
					const likeCount = notificationData?.likeCount || 1;

					// Remove user from the group
					if (fromUserIds.includes(userId)) {
						const newFromUserIds = fromUserIds.filter((id: string) => id !== userId);
						const newLikeCount = Math.max(0, likeCount - 1);

						if (newLikeCount === 0 || newFromUserIds.length === 0) {
							// Delete notification if no one liked anymore
							const wasUnread = !notificationData?.read;
							await notificationDoc.ref.delete();

							// Update unread count if needed
							if (wasUnread) {
								const userRef = db.collection("users").doc(commentAuthorId);
								await userRef.update({
									unreadNotificationCount: firestore.FieldValue.increment(-1),
									updatedAt: firestore.FieldValue.serverTimestamp(),
								});
							}
						} else {
							// Update notification with new count and user list
							// If the removed user was the primary user, update to the most recent user
							const batch = db.batch();
							const updateData: any = {
								fromUserIds: newFromUserIds,
								likeCount: newLikeCount,
							};

							// If we removed the primary user, set a new primary user (most recent)
							if (notificationData?.fromUserId === userId && newFromUserIds.length > 0) {
								// Get the most recent user's data
								const mostRecentUserId = newFromUserIds[newFromUserIds.length - 1];
								const mostRecentUserDoc = await db
									.collection("users")
									.doc(mostRecentUserId)
									.get();
								const mostRecentUserData = mostRecentUserDoc.data();

								updateData.fromUserId = mostRecentUserId;
								updateData.fromUsername = mostRecentUserData?.username || "";
								updateData.fromProfilePicture = mostRecentUserData?.profilePicture || null;
							}

							batch.update(notificationDoc.ref, updateData);
							await batch.commit();
						}
					}
				}
			} catch (notifError) {
				// Don't fail the unlike operation if notification update fails
				console.error("[unlikeGameComment] Error updating notification:", notifError);
			}
		}
	} catch (error: any) {
		console.error("[unlikeGameComment] Error:", error);
		throw error;
	}
};

// ============================================================================
// SOCIAL DATA PREFETCH CACHE
// ============================================================================

// Cache for social data (like counts, comment counts) to reduce latency
interface SocialDataCache {
	likeCount: number;
	commentCount: number;
	timestamp: number;
}

const socialDataCache = new Map<string, SocialDataCache>();
const SOCIAL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Extended cache for follow/like status
interface ExtendedSocialDataCache extends SocialDataCache {
	isLiked?: boolean;
	isFollowing?: boolean;
	userId?: string;
	creatorId?: string;
}

const extendedSocialDataCache = new Map<string, ExtendedSocialDataCache>();

/**
 * Prefetch social data for a game to reduce perceived latency
 * Call this when a game starts, so data is ready when user completes it
 * @param gameId Game ID (full puzzle ID)
 * @param creatorId Optional creator ID for prefetching follow status
 * @param userId Current user ID for prefetching like/follow status
 */
export async function prefetchGameSocialData(
	gameId: string,
	creatorId?: string,
	userId?: string
): Promise<void> {
	try {
		// Fetch ALL data in parallel (counts + status)
		const promises: Promise<any>[] = [
			getGameLikeCount(gameId).catch(() => 0),
			getGameCommentCount(gameId).catch(() => 0),
		];

		// Add like status if we have userId
		if (userId) {
			promises.push(checkGameLiked(gameId, userId).catch(() => false));
		}

		// Add follow status if we have both userId and creatorId (and they're different)
		if (userId && creatorId && userId !== creatorId) {
			promises.push(isFollowing(userId, creatorId).catch(() => false));
		}

		const results = await Promise.all(promises);
		const likeCount = results[0];
		const commentCount = results[1];
		const isLikedValue = userId ? results[2] : undefined;
		const isFollowingValue = userId && creatorId && userId !== creatorId ? results[3] : undefined;

		// Cache counts (for backwards compatibility)
		socialDataCache.set(gameId, {
			likeCount,
			commentCount,
			timestamp: Date.now(),
		});

		// Cache extended data (with status)
		if (userId) {
			extendedSocialDataCache.set(`${gameId}_${userId}_${creatorId || ""}`, {
				likeCount,
				commentCount,
				timestamp: Date.now(),
				isLiked: isLikedValue,
				isFollowing: isFollowingValue,
				userId,
				creatorId,
			});
		}
	} catch (error) {
		// Silent failure - prefetching is optional
		console.log("[prefetchGameSocialData] Silent error:", error);
	}
}

/**
 * Get cached extended social data (includes like/follow status)
 * @param gameId Game ID
 * @param userId Current user ID
 * @param creatorId Creator ID (optional)
 * @returns Cached data or null
 */
export function getCachedExtendedSocialData(
	gameId: string,
	userId: string,
	creatorId?: string
): {
	likeCount: number;
	commentCount: number;
	isLiked: boolean;
	isFollowing: boolean | undefined;
} | null {
	const cacheKey = `${gameId}_${userId}_${creatorId || ""}`;
	const cached = extendedSocialDataCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < SOCIAL_CACHE_TTL) {
		return {
			likeCount: cached.likeCount,
			commentCount: cached.commentCount,
			isLiked: cached.isLiked ?? false,
			isFollowing: cached.isFollowing,
		};
	}
	return null;
}

/**
 * Get cached social data or return null if not cached
 * @param gameId Game ID (full puzzle ID)
 * @returns Cached data or null
 */
export function getCachedSocialData(
	gameId: string
): { likeCount: number; commentCount: number } | null {
	const cached = socialDataCache.get(gameId);
	if (cached && Date.now() - cached.timestamp < SOCIAL_CACHE_TTL) {
		return { likeCount: cached.likeCount, commentCount: cached.commentCount };
	}
	return null;
}

/**
 * Invalidate social data cache for a game
 * Call this when like/comment counts change
 * @param gameId Game ID (full puzzle ID)
 * @param userId Optional user ID to invalidate extended cache
 * @param creatorId Optional creator ID to invalidate extended cache
 */
export function invalidateSocialDataCache(
	gameId: string,
	userId?: string,
	creatorId?: string
): void {
	socialDataCache.delete(gameId);
	// Invalidate extended cache if userId provided
	if (userId) {
		const cacheKey = `${gameId}_${userId}_${creatorId || ""}`;
		extendedSocialDataCache.delete(cacheKey);
		// Also delete any other entries for this gameId (in case creatorId changed)
		for (const key of extendedSocialDataCache.keys()) {
			if (key.startsWith(`${gameId}_${userId}_`)) {
				extendedSocialDataCache.delete(key);
			}
		}
	}
}

// ============================================================================
// GAME LIKES FUNCTIONS
// ============================================================================

// Like a game
export const likeGame = async (
	gameId: string,
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			throw new Error("Invalid gameId format");
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const likesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("likes")
			.doc(userId);

		const likeDoc = await likesRef.get();
		if (docExists(likeDoc)) {
			// Already liked
			return;
		}

		// Fetch game document to get creator ID
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		const gameDoc = await gameRef.get();
		if (!docExists(gameDoc)) {
			throw new Error("Game not found");
		}

		const gameData = gameDoc.data();
		const creatorId = gameData?.createdBy || gameData?.uid;

		// Get user data for notification
		const userDoc = await db.collection("users").doc(userId).get();
		const userData = userDoc.data();

		// Add like document
		await likesRef.set({
			createdAt: firestore.FieldValue.serverTimestamp(),
		});

		// Add gameId to user's liked subcollection
		const userLikedRef = db
			.collection("users")
			.doc(userId)
			.collection("liked")
			.doc(gameId);

		await userLikedRef.set({
			createdAt: firestore.FieldValue.serverTimestamp(),
		});

		// Increment like count in game stats using FieldValue.increment for atomicity
		await gameRef.set(
			{
				stats: {
					likeCount: firestore.FieldValue.increment(1),
				},
			},
			{ merge: true }
		);

		// Create in-app notification and send push notification to creator (skip if user is liking their own game)
		if (creatorId && creatorId !== userId) {
			try {
				// Create/update in-app Firestore notification (for notifications screen)
				await createOrUpdateGroupedNotification(
					creatorId,
					"game_like",
					userId,
					userData?.username || "",
					userData?.profilePicture || null,
					gameId,
					gameType,
					difficulty
				);

				// Send push notification via Firebase Cloud Function
				const currentAuthUser = auth().currentUser;
				if (currentAuthUser) {
					try {
						const idToken = await currentAuthUser.getIdToken(true); // Force refresh token

						// Get game title from gameData, or create a default title
						const gameTitle = gameData?.title || `${gameType} ${difficulty}`;
						const username = userData?.username || "Someone";

						// Call Firebase Cloud Function to send push notification
						const notificationUrl =
							"https://us-central1-gear-ff009.cloudfunctions.net/send_notification_to_user";
						const response = await fetch(notificationUrl, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${idToken}`,
							},
							body: JSON.stringify({
								data: {
									userId: creatorId,
									title: "Game Liked",
									body: `${username} liked your game: ${gameTitle}`,
								},
							}),
						});

						if (!response.ok) {
							const errorText = await response.text();
							throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
						}

						const result = await response.json();
						if (!result?.result?.success && !result?.success) {
							console.log(
								"[likeGame] Push notification not sent (user may not have FCM token):",
								result
							);
						}
					} catch (pushError) {
						// Don't fail if push notification fails
						console.error("[likeGame] Error sending push notification:", pushError);
					}
				}
			} catch (notifError) {
				// Don't fail the like operation if notification fails
				console.error("[likeGame] Error creating notification:", notifError);
			}
		}

		// Invalidate cache since count and like status changed
		invalidateSocialDataCache(gameId, userId);
		// Update extended cache to reflect new like status
		const cacheKey = `${gameId}_${userId}_`;
		for (const key of extendedSocialDataCache.keys()) {
			if (key.startsWith(cacheKey)) {
				const cached = extendedSocialDataCache.get(key);
				if (cached) {
					cached.isLiked = true;
					cached.likeCount = (cached.likeCount || 0) + 1;
				}
			}
		}
	} catch (error: any) {
		console.error("[likeGame] Error:", error);
		throw error;
	}
};

// Unlike a game
export const unlikeGame = async (
	gameId: string,
	userId: string
): Promise<void> => {
	try {
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			throw new Error("Invalid gameId format");
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const likesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("likes")
			.doc(userId);

		const likeDoc = await likesRef.get();
		if (!docExists(likeDoc)) {
			// Not liked
			return;
		}

		// Fetch game document to get creator ID
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		const gameDoc = await gameRef.get();
		const gameData = gameDoc.data();
		const creatorId = gameData?.createdBy || gameData?.uid;

		// Remove like
		await likesRef.delete();

		// Remove gameId from user's liked subcollection
		const userLikedRef = db
			.collection("users")
			.doc(userId)
			.collection("liked")
			.doc(gameId);

		await userLikedRef.delete();

		// Decrement like count in game stats using FieldValue.increment for atomicity
		const firestore = require("@react-native-firebase/firestore").default;
		await gameRef.set(
			{
				stats: {
					likeCount: firestore.FieldValue.increment(-1),
				},
			},
			{ merge: true }
		);

		// Update notification for creator (remove user from group or delete if count reaches 0)
		if (creatorId && creatorId !== userId) {
			try {
				const notificationsRef = db
					.collection("users")
					.doc(creatorId)
					.collection("notifications");

				// Find notification for this game like
				const notificationSnapshot = await notificationsRef
					.where("type", "==", "game_like")
					.where("gameId", "==", gameId)
					.get();

				if (!notificationSnapshot.empty) {
					const notificationDoc = notificationSnapshot.docs[0];
					const notificationData = notificationDoc.data();
					const fromUserIds = notificationData?.fromUserIds || [];
					const likeCount = notificationData?.likeCount || 1;

					// Remove user from the group
					if (fromUserIds.includes(userId)) {
						const newFromUserIds = fromUserIds.filter((id: string) => id !== userId);
						const newLikeCount = Math.max(0, likeCount - 1);

						if (newLikeCount === 0 || newFromUserIds.length === 0) {
							// Delete notification if no one liked anymore
							const wasUnread = !notificationData?.read;
							await notificationDoc.ref.delete();

							// Update unread count if needed
							if (wasUnread) {
								const userRef = db.collection("users").doc(creatorId);
								await userRef.update({
									unreadNotificationCount: firestore.FieldValue.increment(-1),
									updatedAt: firestore.FieldValue.serverTimestamp(),
								});
							}
						} else {
							// Update notification with new count and user list
							// If the removed user was the primary user, update to the most recent user
							const batch = db.batch();
							const updateData: any = {
								fromUserIds: newFromUserIds,
								likeCount: newLikeCount,
							};

							// If we removed the primary user, set a new primary user (most recent)
							if (notificationData?.fromUserId === userId && newFromUserIds.length > 0) {
								// Get the most recent user's data
								const mostRecentUserId = newFromUserIds[newFromUserIds.length - 1];
								const mostRecentUserDoc = await db
									.collection("users")
									.doc(mostRecentUserId)
									.get();
								const mostRecentUserData = mostRecentUserDoc.data();

								updateData.fromUserId = mostRecentUserId;
								updateData.fromUsername = mostRecentUserData?.username || "";
								updateData.fromProfilePicture = mostRecentUserData?.profilePicture || null;
							}

							batch.update(notificationDoc.ref, updateData);
							await batch.commit();
						}
					}
				}
			} catch (notifError) {
				// Don't fail the unlike operation if notification update fails
				console.error("[unlikeGame] Error updating notification:", notifError);
			}
		}

		// Invalidate cache since count and like status changed
		invalidateSocialDataCache(gameId, userId);
		// Update extended cache to reflect new like status
		const cacheKey = `${gameId}_${userId}_`;
		for (const key of extendedSocialDataCache.keys()) {
			if (key.startsWith(cacheKey)) {
				const cached = extendedSocialDataCache.get(key);
				if (cached) {
					cached.isLiked = false;
					cached.likeCount = Math.max(0, (cached.likeCount || 0) - 1);
				}
			}
		}
	} catch (error: any) {
		console.error("[unlikeGame] Error:", error);
		throw error;
	}
};

// Check if a game is liked by a user
export const checkGameLiked = async (
	gameId: string,
	userId: string
): Promise<boolean> => {
	try {
		const parsed = parsePuzzleId(gameId);
		if (!parsed) return false;

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		const likeRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId)
			.collection("likes")
			.doc(userId);

		const likeDoc = await likeRef.get();
		return docExists(likeDoc);
	} catch (error: any) {
		// Silent error for transient Firestore issues
		// Component will default to "not liked" state
		if (error?.code === "firestore/unavailable") {
			console.log("[checkGameLiked] Firestore temporarily unavailable");
		} else {
			console.error("[checkGameLiked] Error:", error);
		}
		return false;
	}
};

// Get like count for a game
export const getGameLikeCount = async (gameId: string): Promise<number> => {
	try {
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			return 0;
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		// Read from stats field first (more efficient)
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		const gameDoc = await gameRef.get();
		if (docExists(gameDoc)) {
			const gameData = gameDoc.data();
			const likeCount = gameData?.stats?.likeCount;
			if (typeof likeCount === "number" && likeCount >= 0) {
				return likeCount;
			}
		}

		// Fallback: count likes collection and update stats
		const likesRef = gameRef.collection("likes");
		const snapshot = await likesRef.get();
		const count = snapshot.size;

		// Update stats for next time
		const firestore = require("@react-native-firebase/firestore").default;
		await gameRef.set({ stats: { likeCount: count } }, { merge: true });

		return count;
	} catch (error: any) {
		console.error("[getGameLikeCount] Error:", error);
		return 0;
	}
};

// Get comment count for a game
export const getGameCommentCount = async (gameId: string): Promise<number> => {
	try {
		const parsed = parsePuzzleId(gameId);

		if (!parsed) {
			return 0;
		}

		const { gameType, difficulty, gameId: actualGameId } = parsed;

		// Read from stats field first (more efficient)
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		const gameDoc = await gameRef.get();
		if (docExists(gameDoc)) {
			const gameData = gameDoc.data();
			const commentCount = gameData?.stats?.commentCount;
			if (typeof commentCount === "number" && commentCount >= 0) {
				return commentCount;
			}
		}

		// Fallback: count comments collection and update stats
		const commentsRef = gameRef.collection("comments");
		const snapshot = await commentsRef.get();
		const count = snapshot.size;

		// Update stats for next time
		const firestore = require("@react-native-firebase/firestore").default;
		await gameRef.set({ stats: { commentCount: count } }, { merge: true });

		return count;
	} catch (error: any) {
		console.error("[getGameCommentCount] Error:", error);
		return 0;
	}
};
