// Authentication service using React Native Firebase
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { db } from "./firebase";

export interface CategoryStats {
	completed: number;
	avgTime: number;
	skipped?: number;
}

export interface DifficultyStats {
	completed: number;
	avgTime: number;
	skipped?: number;
}

export interface UserData {
	email: string;
	username?: string;
	seenGames: string[];
	completedGames: string[];
	skippedGames: string[];
	createdAt: any; // Firestore timestamp
	updatedAt: any; // Firestore timestamp
	// Stats fields
	totalGamesPlayed?: number;
	totalPlayTime?: number; // in seconds
	averageTimePerGame?: number;
	streakCount?: number;
	lastPlayedAt?: any; // Firestore timestamp
	statsByCategory?: {
		wordle?: CategoryStats;
		riddle?: CategoryStats;
		quickMath?: CategoryStats;
		wordChain?: CategoryStats;
	};
	statsByDifficulty?: {
		easy?: DifficultyStats;
		medium?: DifficultyStats;
		hard?: DifficultyStats;
	};
}

// Configure Google Sign-In (call this once at app startup)
export const configureGoogleSignIn = () => {
	GoogleSignin.configure({
		webClientId:
			"28371093595-lo532pbakpbje0uejblbaltr6gskba2c.apps.googleusercontent.com", // From GoogleService-Info.plist
	});
};

// Sign in with Google
export const signInWithGoogle = async () => {
	try {
		// Configure if not already configured
		configureGoogleSignIn();

		// Check if device supports Google Play Services (Android)
		await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

		// Get user info from Google
		const userInfo = await GoogleSignin.signIn();

		// Check if sign-in was successful and get idToken
		const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

		if (!idToken) {
			throw new Error("No ID token received from Google Sign-In");
		}

		// Create Firebase credential
		const googleCredential = auth.GoogleAuthProvider.credential(idToken);

		// Sign in to Firebase
		const result = await auth().signInWithCredential(googleCredential);

		// Create or update user document in Firestore
		if (result.user) {
			await createOrUpdateUserDocument(result.user);
		}

		return result.user;
	} catch (error: any) {
		console.error("Google Sign-In Error:", error);
		if (error.code === "sign_in_cancelled") {
			throw new Error("Sign in was cancelled");
		}
		throw error;
	}
};

// Sign out
export const signOut = async () => {
	try {
		await auth().signOut();
	} catch (error: any) {
		console.error("Sign Out Error:", error);
		throw error;
	}
};

// Get current user
export const getCurrentUser = () => {
	return auth().currentUser;
};

// Listen to auth state changes
export const onAuthStateChanged = (callback: (user: any) => void) => {
	return auth().onAuthStateChanged(callback);
};

// Create or update user document in Firestore
export const createOrUpdateUserDocument = async (firebaseUser: any) => {
	if (!firebaseUser) return;

	try {
		const userRef = db.collection("users").doc(firebaseUser.uid);
		const userDoc = await userRef.get();

		const firestore = require("@react-native-firebase/firestore").default;

		if (!userDoc.exists()) {
			// New user - create document with initial stats
			await userRef.set({
				email: firebaseUser.email || "",
				seenGames: [],
				completedGames: [],
				skippedGames: [],
				totalGamesPlayed: 0,
				totalPlayTime: 0,
				averageTimePerGame: 0,
				streakCount: 0,
				statsByCategory: {},
				statsByDifficulty: {},
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			// Existing user - update email if changed
			await userRef.update({
				email: firebaseUser.email || "",
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}
	} catch (error: any) {
		console.error("Error creating/updating user document:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		// Don't throw - allow sign-in to proceed even if document creation fails
	}
};

// Get user data from Firestore
export const getUserData = async (userId: string): Promise<UserData | null> => {
	try {
		const userDoc = await db.collection("users").doc(userId).get();
		if (userDoc.exists()) {
			return userDoc.data() as UserData;
		}
		return null;
	} catch (error: any) {
		console.error("Error fetching user data:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		return null;
	}
};

// Helper to check if user data exists
export const hasUserData = (
	userData: UserData | null
): userData is UserData => {
	return userData !== null && userData !== undefined;
};

// Update user's seen games
export const addSeenGame = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			seenGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error adding seen game:", error);
	}
};

// Helper to parse game ID and extract category and difficulty
const parseGameId = (
	gameId: string
): {
	category: "wordle" | "riddle" | "quickMath" | "wordChain" | null;
	difficulty: "easy" | "medium" | "hard" | null;
} => {
	const parts = gameId.split("_");
	if (parts.length < 3) return { category: null, difficulty: null };

	const categoryPart = parts[0];
	const difficultyPart = parts[1];

	let category: "wordle" | "riddle" | "quickMath" | "wordChain" | null = null;
	if (categoryPart === "wordle") category = "wordle";
	else if (categoryPart === "riddle") category = "riddle";
	else if (categoryPart === "quickmath") category = "quickMath";
	else if (categoryPart === "wordchain") category = "wordChain";

	let difficulty: "easy" | "medium" | "hard" | null = null;
	if (
		difficultyPart === "easy" ||
		difficultyPart === "medium" ||
		difficultyPart === "hard"
	) {
		difficulty = difficultyPart;
	}

	return { category, difficulty };
};

// Update user stats when a game is completed
export const updateUserStats = async (
	userId: string,
	gameId: string,
	timeTaken: number // in seconds
) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error("User document does not exist");
			return;
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		// Get current stats or initialize defaults
		const currentTotalGames = userData.totalGamesPlayed || 0;
		const currentTotalTime = userData.totalPlayTime || 0;
		const currentCompletedGames = userData.completedGames || [];

		// Calculate new totals
		const newTotalGames = currentTotalGames + 1;
		const newTotalTime = currentTotalTime + timeTaken;
		const newAverageTime = Math.round(newTotalTime / newTotalGames);

		// Calculate streak
		const now = new Date();
		now.setHours(0, 0, 0, 0); // Set to start of day for comparison

		let lastPlayedDate: Date | null = null;
		if (userData.lastPlayedAt) {
			// Handle Firestore timestamp
			if (userData.lastPlayedAt.toDate) {
				lastPlayedDate = userData.lastPlayedAt.toDate();
			} else if (userData.lastPlayedAt instanceof Date) {
				lastPlayedDate = userData.lastPlayedAt;
			} else {
				// Try to parse as timestamp
				lastPlayedDate = new Date(userData.lastPlayedAt);
			}
			if (lastPlayedDate) {
				lastPlayedDate.setHours(0, 0, 0, 0); // Set to start of day
			}
		}

		let newStreak = userData.streakCount || 0;

		if (lastPlayedDate) {
			const daysSinceLastPlay = Math.floor(
				(now.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24)
			);
			if (daysSinceLastPlay === 0) {
				// Same day, keep streak (don't increment)
				newStreak = userData.streakCount || 1;
			} else if (daysSinceLastPlay === 1) {
				// Consecutive day, increment streak
				newStreak = (userData.streakCount || 0) + 1;
			} else {
				// Streak broken, reset to 1
				newStreak = 1;
			}
		} else {
			// First game, start streak
			newStreak = 1;
		}

		// Update stats by category
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category) {
			const currentCatStats = currentCategoryStats[category] || {
				completed: 0,
				avgTime: 0,
			};
			const catCompleted = currentCatStats.completed + 1;
			const catTotalTime =
				currentCatStats.completed * currentCatStats.avgTime + timeTaken;
			const catAvgTime = Math.round(catTotalTime / catCompleted);

			categoryStatsUpdate[category] = {
				completed: catCompleted,
				avgTime: catAvgTime,
			};
		}

		// Update stats by difficulty
		const currentDifficultyStats = userData.statsByDifficulty || {};
		let difficultyStatsUpdate: any = {};

		if (difficulty) {
			const currentDiffStats = currentDifficultyStats[difficulty] || {
				completed: 0,
				avgTime: 0,
			};
			const diffCompleted = currentDiffStats.completed + 1;
			const diffTotalTime =
				currentDiffStats.completed * currentDiffStats.avgTime + timeTaken;
			const diffAvgTime = Math.round(diffTotalTime / diffCompleted);

			difficultyStatsUpdate[difficulty] = {
				completed: diffCompleted,
				avgTime: diffAvgTime,
			};
		}

		// Prepare update object
		const updateData: any = {
			totalGamesPlayed: newTotalGames,
			totalPlayTime: newTotalTime,
			averageTimePerGame: newAverageTime,
			streakCount: newStreak,
			lastPlayedAt: firestore.FieldValue.serverTimestamp(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Merge difficulty stats
		if (Object.keys(difficultyStatsUpdate).length > 0) {
			updateData["statsByDifficulty"] = {
				...(currentDifficultyStats || {}),
				...difficultyStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error("Error updating user stats:", error);
	}
};

// Update user's completed games and stats
export const addCompletedGame = async (
	userId: string,
	gameId: string,
	timeTaken?: number // in seconds
) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);

		// Add to completed games array
		await userRef.update({
			completedGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

		// Update stats if timeTaken is provided
		if (timeTaken !== undefined) {
			await updateUserStats(userId, gameId, timeTaken);
		}
	} catch (error) {
		console.error("Error adding completed game:", error);
	}
};

// Update skipped stats when a game is skipped
const updateSkippedStats = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error("User document does not exist");
			return;
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		// Update skipped stats by category (using existing statsByCategory structure)
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category) {
			const currentCatStats = currentCategoryStats[category] || {
				completed: 0,
				avgTime: 0,
				skipped: 0,
			};
			const catSkipped = (currentCatStats.skipped || 0) + 1;

			categoryStatsUpdate[category] = {
				...currentCatStats,
				skipped: catSkipped,
			};
		}

		// Update skipped stats by difficulty (using existing statsByDifficulty structure)
		const currentDifficultyStats = userData.statsByDifficulty || {};
		let difficultyStatsUpdate: any = {};

		if (difficulty) {
			const currentDiffStats = currentDifficultyStats[difficulty] || {
				completed: 0,
				avgTime: 0,
				skipped: 0,
			};
			const diffSkipped = (currentDiffStats.skipped || 0) + 1;

			difficultyStatsUpdate[difficulty] = {
				...currentDiffStats,
				skipped: diffSkipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats (preserving completed and avgTime, updating skipped)
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Merge difficulty stats (preserving completed and avgTime, updating skipped)
		if (Object.keys(difficultyStatsUpdate).length > 0) {
			updateData["statsByDifficulty"] = {
				...(currentDifficultyStats || {}),
				...difficultyStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error("Error updating skipped stats:", error);
	}
};

// Update user's skipped games
export const addSkippedGame = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			skippedGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

		// Update skipped stats by category and difficulty
		await updateSkippedStats(userId, gameId);
	} catch (error) {
		console.error("Error adding skipped game:", error);
	}
};

// Check if username is available
export const checkUsernameAvailability = async (
	username: string
): Promise<boolean> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const usernamesRef = db.collection("usernames");

		// Query all documents in usernames collection
		const snapshot = await usernamesRef.get();

		// Check if username exists in any document's names array
		for (const doc of snapshot.docs) {
			const data = doc.data();
			if (data.names && Array.isArray(data.names)) {
				if (data.names.includes(username.toLowerCase())) {
					return false; // Username is taken
				}
			}
		}

		return true; // Username is available
	} catch (error: any) {
		console.error("Error checking username availability:", error);
		throw new Error("Failed to check username availability");
	}
};

// Save username to user document and usernames collection
export const saveUsername = async (
	userId: string,
	username: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const lowerUsername = username.toLowerCase();

		// First, check availability again (double-check)
		const isAvailable = await checkUsernameAvailability(lowerUsername);
		if (!isAvailable) {
			throw new Error("Username is already taken");
		}

		// Update user document with username
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			username: lowerUsername,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

		// Add username to usernames collection
		// Find a document with less than 1000 names (or no count field), or create a new one
		const usernamesRef = db.collection("usernames");

		// Try to find a document with count < 1000
		let snapshot = await usernamesRef.where("count", "<", 1000).limit(1).get();

		// If no document found with count field, get any document
		if (snapshot.empty) {
			snapshot = await usernamesRef.limit(1).get();
		}

		if (!snapshot.empty) {
			// Add to existing document
			const doc = snapshot.docs[0];
			const data = doc.data();
			const currentCount = data.count || data.names?.length || 0;

			// Only add if document has less than 1000 names
			if (currentCount < 1000) {
				await doc.ref.update({
					names: firestore.FieldValue.arrayUnion(lowerUsername),
					count: firestore.FieldValue.increment(1),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			} else {
				// Current document is full, create new one
				const newDocRef = usernamesRef.doc();
				await newDocRef.set({
					names: [lowerUsername],
					count: 1,
					createdAt: firestore.FieldValue.serverTimestamp(),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}
		} else {
			// Create new document
			const newDocRef = usernamesRef.doc();
			await newDocRef.set({
				names: [lowerUsername],
				count: 1,
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		}
	} catch (error: any) {
		console.error("Error saving username:", error);
		if (error.message === "Username is already taken") {
			throw error;
		}
		throw new Error("Failed to save username");
	}
};

// Delete user account (iOS App Store requirement)
export const deleteAccount = async (
	userId: string,
	username?: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// 1. Get current user FIRST (to ensure we have valid reference before any deletions)
		const currentUser = auth().currentUser;
		if (!currentUser) {
			throw new Error("No user currently signed in");
		}

		// 2. Delete user document from Firestore
		const userRef = db.collection("users").doc(userId);
		await userRef.delete();

		// 3. Remove username from usernames collection if it exists
		if (username) {
			const lowerUsername = username.toLowerCase();
			const usernamesRef = db.collection("usernames");
			const snapshot = await usernamesRef.get();

			for (const doc of snapshot.docs) {
				const data = doc.data();
				if (data.names && Array.isArray(data.names)) {
					if (data.names.includes(lowerUsername)) {
						await doc.ref.update({
							names: firestore.FieldValue.arrayRemove(lowerUsername),
							count: firestore.FieldValue.increment(-1),
							updatedAt: firestore.FieldValue.serverTimestamp(),
						});
						break; // Username found and removed, exit loop
					}
				}
			}
		}

		// 4. Delete Firebase Auth account (this automatically signs out the user)
		await currentUser.delete();

		// Note: No need to call signOut() - delete() already signs out the user
	} catch (error: any) {
		console.error("Error deleting account:", error);
		if (error?.code === "auth/requires-recent-login") {
			throw new Error("Please sign in again before deleting your account");
		}
		if (error?.code === "auth/no-current-user") {
			// User was already deleted/signed out, which means deletion succeeded
			// This can happen if delete() completed but signOut() was called after
			return; // Success - user is deleted
		}
		throw new Error(
			error.message || "Failed to delete account. Please try again."
		);
	}
};
