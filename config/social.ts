// Social features: follow/unfollow, fetch followers/following, creator profiles
import { db } from "./firebase";

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
		console.log(`[followUser] START: ${currentUid} -> ${targetUid}`);
		
		if (currentUid === targetUid) {
			throw new Error("Cannot follow yourself");
		}

		const firestore = require("@react-native-firebase/firestore").default;

		// Get current user's data for notification
		const currentUserRef = db.collection("users").doc(currentUid);
		const currentUserDoc = await currentUserRef.get();
		const currentUserData = currentUserDoc.data();
		const currentUserExists = typeof currentUserDoc.exists === 'function' 
			? currentUserDoc.exists() 
			: currentUserDoc.exists;
		console.log(`[followUser] Current user doc exists: ${currentUserExists}`);
		console.log(`[followUser] Current user data:`, JSON.stringify(currentUserData, null, 2));

		// Use batch to ensure atomicity
		const batch = db.batch();

		// Add to current user's following list
		const currentUserFollowingRef = db
			.collection("users")
			.doc(currentUid)
			.collection("following")
			.doc(targetUid);
		console.log(`[followUser] Following ref path: users/${currentUid}/following/${targetUid}`);

		// Add to target user's followers list
		const targetUserFollowersRef = db
			.collection("users")
			.doc(targetUid)
			.collection("followers")
			.doc(currentUid);
		console.log(`[followUser] Followers ref path: users/${targetUid}/followers/${currentUid}`);

		// Check if already following
		const currentFollowingDoc = await currentUserFollowingRef.get();
		const alreadyExists = typeof currentFollowingDoc.exists === 'function' 
			? currentFollowingDoc.exists() 
			: currentFollowingDoc.exists;
		console.log(`[followUser] Already following check: ${alreadyExists}`);
		if (alreadyExists) {
			// Already following, return silently (not an error)
			console.log(`[followUser] User ${currentUid} is already following ${targetUid}`);
			return;
		}

		// Add follow relationships
		console.log(`[followUser] Adding follow relationships to batch...`);
		batch.set(currentUserFollowingRef, {
			followedAt: firestore.FieldValue.serverTimestamp(),
		});
		console.log(`[followUser] Added to batch: following relationship`);

		batch.set(targetUserFollowersRef, {
			followedAt: firestore.FieldValue.serverTimestamp(),
		});
		console.log(`[followUser] Added to batch: followers relationship`);

		// Create notification for target user
		const notificationRef = db
			.collection("users")
			.doc(targetUid)
			.collection("notifications")
			.doc(); // Auto-generated ID
		console.log(`[followUser] Notification ref path: users/${targetUid}/notifications/${notificationRef.id}`);

		batch.set(notificationRef, {
			type: "follow",
			fromUserId: currentUid,
			fromUsername: currentUserData?.username || "",
			fromProfilePicture: currentUserData?.profilePicture || null,
			createdAt: firestore.FieldValue.serverTimestamp(),
			read: false,
		});
		console.log(`[followUser] Added to batch: notification`);

		// Update follower/following counts
		// currentUserRef already defined above, reuse it
		const targetUserRef = db.collection("users").doc(targetUid);

		// Get target user document to check counts (currentUserDoc already fetched above)
		const targetUserDoc = await targetUserRef.get();
		
		// Update current user's followingCount (reuse currentUserDoc from above)
		const currentFollowingCount = currentUserDoc.data()?.followingCount;
		console.log(`[followUser] Current user followingCount: ${currentFollowingCount}`);
		if (currentFollowingCount === undefined || currentFollowingCount === null) {
			console.log(`[followUser] Initializing current user followingCount to 1`);
			batch.set(currentUserRef, {
				followingCount: 1,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}, { merge: true });
		} else {
			console.log(`[followUser] Incrementing current user followingCount`);
			batch.update(currentUserRef, {
				followingCount: firestore.FieldValue.increment(1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}

		// Update target user's followerCount
		const targetFollowerCount = targetUserDoc.data()?.followerCount;
		const targetUnreadCount = targetUserDoc.data()?.unreadNotificationCount ?? 0;
		console.log(`[followUser] Target user followerCount: ${targetFollowerCount}, unreadCount: ${targetUnreadCount}`);
		
		if (targetFollowerCount === undefined || targetFollowerCount === null) {
			console.log(`[followUser] Initializing target user followerCount to 1`);
			batch.set(targetUserRef, {
				followerCount: 1,
				unreadNotificationCount: targetUnreadCount + 1,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}, { merge: true });
		} else {
			console.log(`[followUser] Incrementing target user followerCount`);
			batch.update(targetUserRef, {
				followerCount: firestore.FieldValue.increment(1),
				unreadNotificationCount: firestore.FieldValue.increment(1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}

		console.log(`[followUser] Committing batch...`);
		await batch.commit();
		console.log(`[followUser] Batch committed successfully!`);
		console.log(`[followUser] User ${currentUid} followed ${targetUid}`);
		
		// Verify the follow relationship was created
		console.log(`[followUser] Verifying follow relationship...`);
		const verifyFollowingDoc = await currentUserFollowingRef.get();
		const followingExists = typeof verifyFollowingDoc.exists === 'function' 
			? verifyFollowingDoc.exists() 
			: verifyFollowingDoc.exists;
		console.log(`[followUser] Verification - following doc exists: ${followingExists}`);
		if (followingExists) {
			console.log(`[followUser] Verification - following doc data:`, JSON.stringify(verifyFollowingDoc.data(), null, 2));
		}
		
		const verifyFollowersDoc = await targetUserFollowersRef.get();
		const followersExists = typeof verifyFollowersDoc.exists === 'function' 
			? verifyFollowersDoc.exists() 
			: verifyFollowersDoc.exists;
		console.log(`[followUser] Verification - followers doc exists: ${followersExists}`);
		if (followersExists) {
			console.log(`[followUser] Verification - followers doc data:`, JSON.stringify(verifyFollowersDoc.data(), null, 2));
		}
		
		if (!followingExists) {
			console.error(`[followUser] ERROR: Follow relationship not created for ${currentUid} -> ${targetUid}`);
			console.error(`[followUser] Following path: users/${currentUid}/following/${targetUid}`);
			throw new Error("Failed to create follow relationship");
		}
		
		if (!followersExists) {
			console.error(`[followUser] ERROR: Follower relationship not created for ${targetUid} <- ${currentUid}`);
			console.error(`[followUser] Followers path: users/${targetUid}/followers/${currentUid}`);
			throw new Error("Failed to create follower relationship");
		}
		
		console.log(`[followUser] SUCCESS: Both relationships verified for ${currentUid} <-> ${targetUid}`);
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
		const isCurrentlyFollowing = typeof currentFollowingDoc.exists === 'function' 
			? currentFollowingDoc.exists() 
			: currentFollowingDoc.exists;
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
			batch.set(currentUserRef, {
				followingCount: 0,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}, { merge: true });
		}

		if (targetFollowerCount > 0) {
			batch.update(targetUserRef, {
				followerCount: firestore.FieldValue.increment(-1),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			batch.set(targetUserRef, {
				followerCount: 0,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}, { merge: true });
		}

		await batch.commit();
		console.log(`[unfollowUser] User ${currentUid} unfollowed ${targetUid}`);
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

		console.log(`[isFollowing] Checking: users/${currentUid}/following/${targetUid}`);
		const doc = await followingRef.get();
		
		// Check if document exists - handle both property and method cases
		const exists = typeof doc.exists === 'function' ? doc.exists() : doc.exists;
		console.log(`[isFollowing] Document exists (type: ${typeof doc.exists}): ${exists}`);
		console.log(`[isFollowing] Document snapshot:`, doc);
		
		if (exists) {
			const data = doc.data();
			console.log(`[isFollowing] Document data:`, JSON.stringify(data, null, 2));
		} else {
			console.log(`[isFollowing] Document does not exist at path: users/${currentUid}/following/${targetUid}`);
		}
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
				const exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
				if (exists) {
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
				const exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
				if (exists) {
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

		const exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
		if (!exists) {
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
		if (!notificationDoc.exists) {
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
export const markAllNotificationsAsRead = async (uid: string): Promise<void> => {
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
export const getUnreadNotificationCount = async (uid: string): Promise<number> => {
	try {
		const userDoc = await db.collection("users").doc(uid).get();
		const exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
		if (!exists) {
			return 0;
		}

		const data = userDoc.data();
		return data?.unreadNotificationCount || 0;
	} catch (error: any) {
		console.error("[getUnreadNotificationCount] Error:", error);
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
		if (!notificationDoc.exists) {
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

