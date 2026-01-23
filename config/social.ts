// Social features: follow/unfollow, fetch followers/following, creator profiles
import { db, docExists } from "./firebase";

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
	type: string;
	fromUserId: string;
	fromUsername: string;
	fromProfilePicture?: string | null;
	createdAt: any;
	read: boolean;
}

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
	} catch (error: any) {
		console.error("[unfollowUser] Error:", error);
		throw error;
	}
};

// Check if current user follows target
export const isFollowing = async (
	currentUid: string,
	targetUid: string
): Promise<boolean> => {
	try {
		const followingRef = db
			.collection("users")
			.doc(currentUid)
			.collection("following")
			.doc(targetUid);

		const doc = await followingRef.get();

		// Check if document exists - handle both property and method cases
		const exists = docExists(doc);
		return !!exists;
	} catch (error: any) {
		console.error("[isFollowing] Error:", error);
		console.error("[isFollowing] Error code:", error?.code);
		console.error("[isFollowing] Error message:", error?.message);
		console.error("[isFollowing] Error stack:", error?.stack);
		return false;
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

// Replace fetchLikedGames (lines 484-577) with this corrected version:
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

		const gameIds = likedSnapshot.docs.map((doc) => doc.id);

		// Group games by gameType and difficulty for better organization
		const gameGroups = new Map<string, { gameType: string; difficulty: string; docIds: string[]; originalIds: string[] }>();

		gameIds.forEach((gameId) => {
			const parts = gameId.split("_");
			if (parts.length >= 3) {
				const gameType = parts[0];
				const difficulty = parts[1];
				const docId = parts.slice(2).join("_");
				const key = `${gameType}_${difficulty}`;

				if (!gameGroups.has(key)) {
					gameGroups.set(key, { gameType, difficulty, docIds: [], originalIds: [] });
				}
				const group = gameGroups.get(key)!;
				group.docIds.push(docId);
				group.originalIds.push(gameId); // Store full puzzleId
			}
		});

		// Fetch all games in parallel by group
		const fetchPromises = Array.from(gameGroups.entries()).map(async ([key, group]) => {
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

					if (gameDoc.exists) {
						const gameData = gameDoc.data();
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
			return results.filter((g): g is GameSummary & { originalGameId: string } => g !== null);
		});

		const allGames = await Promise.all(fetchPromises);
		const flatGames = allGames.flat();

		// Create a map for quick lookup by original gameId
		const gameMap = new Map<string, GameSummary & { originalGameId: string }>();
		flatGames.forEach(g => {
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

		// 2. Fetch created games from followed users
		// Firestore 'in' query is limited to 10, so we batch if needed
		const allGames: any[] = [];

		for (let i = 0; i < followedUids.length; i += 10) {
			const batchUids = followedUids.slice(i, i + 10);

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

		await gameRef.set(
			{
				stats: {
					commentCount: firestore.FieldValue.increment(1),
				},
			},
			{ merge: true }
		);
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

		if (likedBy.includes(userId)) {
			// Already liked, do nothing
			return;
		}

		// Add user to likedBy and increment likes
		await commentRef.update({
			likedBy: firestore.FieldValue.arrayUnion(userId),
			likes: firestore.FieldValue.increment(1),
		});
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

		if (!likedBy.includes(userId)) {
			// Not liked, do nothing
			return;
		}

		// Remove user from likedBy and decrement likes
		await commentRef.update({
			likedBy: firestore.FieldValue.arrayRemove(userId),
			likes: firestore.FieldValue.increment(-1),
		});
	} catch (error: any) {
		console.error("[unlikeGameComment] Error:", error);
		throw error;
	}
};

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
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		await gameRef.set(
			{
				stats: {
					likeCount: firestore.FieldValue.increment(1),
				},
			},
			{ merge: true }
		);
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
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(actualGameId);

		await gameRef.set(
			{
				stats: {
					likeCount: firestore.FieldValue.increment(-1),
				},
			},
			{ merge: true }
		);
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
		console.error("[checkGameLiked] Error:", error);
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
