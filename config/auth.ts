// Authentication service using React Native Firebase
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { db } from "./firebase";

export interface CategoryStats {
	completed: number;
	attempted: number; // User started interacting with the game
	skipped: number; // User skipped without interacting
	avgTime: number;
}

export interface UserData {
	email: string;
	username?: string;
	createdAt: any; // Firestore timestamp
	updatedAt: any; // Firestore timestamp
	_historyMigrated?: boolean; // Flag for migration from arrays to gameHistory
	// Stats fields
	totalGamesPlayed?: number;
	totalPlayTime?: number; // in seconds
	averageTimePerGame?: number;
	streakCount?: number;
	lastPlayedAt?: any; // Firestore timestamp
	statsByCategory?: {
		[category: string]: {
			attempted?: number; // Total attempted across all difficulties
			skipped?: number; // Total skipped across all difficulties
			easy?: CategoryStats;
			medium?: CategoryStats;
			hard?: CategoryStats;
		};
	};
	precomputedRecommendations?: {
		gameIds: string[]; // Array of game IDs (50 games)
		computedAt?: any; // Firestore timestamp
	};
	// Social fields
	followerCount?: number;
	followingCount?: number;
	createdGamesCount?: number;
	bio?: string;
	profilePicture?: string;
	unreadNotificationCount?: number;
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
				totalGamesPlayed: 0,
				totalPlayTime: 0,
				averageTimePerGame: 0,
				streakCount: 0,
				statsByCategory: {},
				followerCount: 0,
				followingCount: 0,
				createdGamesCount: 0,
				unreadNotificationCount: 0,
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			// Existing user - update email if changed and ensure counts are initialized
			const updateData: any = {
				email: firebaseUser.email || "",
				updatedAt: firestore.FieldValue.serverTimestamp(),
			};

			const existingData = userDoc.data();
			// Initialize counts if they don't exist
			if (existingData?.followerCount === undefined) {
				updateData.followerCount = 0;
			}
			if (existingData?.followingCount === undefined) {
				updateData.followingCount = 0;
			}
			if (existingData?.createdGamesCount === undefined) {
				updateData.createdGamesCount = 0;
			}
			if (existingData?.unreadNotificationCount === undefined) {
				updateData.unreadNotificationCount = 0;
			}

			await userRef.update(updateData);
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

// Helper to parse game ID and extract category and difficulty
// Extended to support all game types
const parseGameId = (
	gameId: string
): {
	category: string | null;
	difficulty: "easy" | "medium" | "hard" | null;
} => {
	const parts = gameId.split("_");
	if (parts.length < 3) return { category: null, difficulty: null };

	const categoryPart = parts[0].toLowerCase();
	const difficultyPart = parts[1];

	// Map all possible game types
	const categoryMap: Record<string, string> = {
		wordle: "wordle",
		riddle: "riddle",
		quickmath: "quickMath",
		wordchain: "wordChain",
		trivia: "trivia",
		mastermind: "mastermind",
		sequencing: "sequencing",
		alias: "alias",
		zip: "zip",
		futoshiki: "futoshiki",
		magicsquare: "magicSquare",
		hidato: "hidato",
		sudoku: "sudoku",
	};

	const category = categoryMap[categoryPart] || null;

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

// Helper function to calculate category totals from difficulty stats
const calculateCategoryTotals = (
	categoryData: {
		easy?: CategoryStats;
		medium?: CategoryStats;
		hard?: CategoryStats;
	}
): { attempted: number; skipped: number } => {
	let totalAttempted = 0;
	let totalSkipped = 0;

	["easy", "medium", "hard"].forEach((diff) => {
		const diffStats = categoryData[diff as "easy" | "medium" | "hard"];
		if (diffStats) {
			totalAttempted +=
				typeof diffStats.attempted === "number" &&
				isFinite(diffStats.attempted)
					? diffStats.attempted
					: 0;
			totalSkipped +=
				typeof diffStats.skipped === "number" &&
				isFinite(diffStats.skipped)
					? diffStats.skipped
					: 0;
		}
	});

	return { attempted: totalAttempted, skipped: totalSkipped };
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
		// Sanitize to ensure they are numbers (handle corrupted data)
		const currentTotalGames =
			typeof userData.totalGamesPlayed === "number" &&
			isFinite(userData.totalGamesPlayed)
				? userData.totalGamesPlayed
				: 0;
		const currentTotalTime =
			typeof userData.totalPlayTime === "number" &&
			isFinite(userData.totalPlayTime)
				? userData.totalPlayTime
				: 0;

		// Calculate new totals
		// Ensure timeTaken is a valid number
		const sanitizedTimeTaken =
			typeof timeTaken === "number" && isFinite(timeTaken) && timeTaken >= 0
				? timeTaken
				: 0;

		const newTotalGames = currentTotalGames + 1;
		const newTotalTime = Number(currentTotalTime) + Number(sanitizedTimeTaken);
		const newAverageTime =
			newTotalGames > 0 ? Math.round(newTotalTime / newTotalGames) : 0;

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

		// Update stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			const catCompleted = currentCatStats.completed + 1;
			const catTotalTime =
				currentCatStats.completed * currentCatStats.avgTime + timeTaken;
			const catAvgTime = Math.round(catTotalTime / catCompleted);

			// Sanitize attempted and skipped to avoid NaN
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed: catCompleted,
					attempted: attempted, // Preserve attempted value
					skipped: skipped, // Preserve skipped value
					avgTime: catAvgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		// Explicitly ensure all numeric values are numbers (not strings)
		const updateData: any = {
			totalGamesPlayed: Number(newTotalGames),
			totalPlayTime: Number(newTotalTime),
			averageTimePerGame: Number(newAverageTime),
			streakCount: Number(newStreak),
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

		// Final safety check: ensure totalPlayTime is a number before updating
		if (
			typeof updateData.totalPlayTime !== "number" ||
			!isFinite(updateData.totalPlayTime)
		) {
			console.error(
				`[updateUserStats] Invalid totalPlayTime value: ${
					updateData.totalPlayTime
				}, type: ${typeof updateData.totalPlayTime}. Resetting to 0.`
			);
			updateData.totalPlayTime = 0;
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
	timeTaken?: number, // in seconds
	answerRevealed?: boolean // true if user used "Show Answer" feature
) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection (always add to history)
		await addGameHistory(userId, gameId, "completed", {
			timeTaken,
			timestamp: new Date(),
			answerRevealed,
		});

		// Update stats only if answer was not revealed
		if (timeTaken !== undefined && !answerRevealed) {
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

		// Update skipped stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const catSkipped = skipped + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted, // Preserve attempted value
					skipped: catSkipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
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

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error("Error updating skipped stats:", error);
	}
};

// Update user's skipped games
export const addSkippedGame = async (userId: string, gameId: string) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection
		await addGameHistory(userId, gameId, "skipped", {
			timestamp: new Date(),
		});

		// Update skipped stats by category and difficulty
		await updateSkippedStats(userId, gameId);
	} catch (error) {
		console.error("Error adding skipped game:", error);
	}
};

// Move a game from skipped to attempted (when user comes back and attempts a previously skipped game)
export const moveFromSkippedToAttempted = async (
	userId: string,
	gameId: string
): Promise<boolean> => {
	try {
		const { checkGameHistory, updateGameHistory } = require("./firebase");

		// Check if this game was previously skipped using gameHistory
		const wasSkipped = await checkGameHistory(userId, gameId, "skipped");

		if (!wasSkipped) {
			return false;
		}

		// Update gameHistory document to change action from "skipped" to "attempted"
		await updateGameHistory(userId, gameId, {
			action: "attempted",
			timestamp: new Date(),
		});

		// Decrement skipped stats
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error(
				"[moveFromSkippedToAttempted] User document does not exist"
			);
			return true; // Still return true since we updated the history
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;

			// Decrement skipped, increment attempted
			const newSkipped = Math.max(0, skipped - 1);
			const newAttempted = attempted + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted: newAttempted,
					skipped: newSkipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);

		return true;
	} catch (error) {
		console.error("[moveFromSkippedToAttempted] Error:", error);
		return false;
	}
};

// Update attempted stats when user first interacts with a game
const updateAttemptedStats = async (userId: string, gameId: string) => {
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

		// Update attempted stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;
			const catAttempted = attempted + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted: catAttempted,
					skipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error(
			"[updateAttemptedStats] Error updating attempted stats:",
			error
		);
	}
};

// Track when user first interacts with a game (types/clicks)
export const addAttemptedGame = async (userId: string, gameId: string) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection
		await addGameHistory(userId, gameId, "attempted", {
			timestamp: new Date(),
		});

		// Update attempted stats by category and difficulty
		await updateAttemptedStats(userId, gameId);
	} catch (error) {
		console.error("Error adding attempted game:", error);
	}
};

// Check if username is available
export const checkUsernameAvailability = async (
	username: string
): Promise<boolean> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const lowerUsername = username.toLowerCase();
		const usernameRef = db.collection("usernames").doc(lowerUsername);

		// Check if document exists - handle both property and method cases
		const doc = await usernameRef.get();
		const exists = typeof doc.exists === "function" ? doc.exists() : doc.exists;

		return !exists; // Username is available if document doesn't exist
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

		// Use a transaction to ensure atomicity
		const usernameRef = db.collection("usernames").doc(lowerUsername);
		const userRef = db.collection("users").doc(userId);

		await db.runTransaction(async (transaction) => {
			// Check if username is already taken - handle both property and method cases
			const usernameDoc = await transaction.get(usernameRef);
			const exists =
				typeof usernameDoc.exists === "function"
					? usernameDoc.exists()
					: usernameDoc.exists;
			if (exists) {
				throw new Error("Username is already taken");
			}

			// Create username document with username as document ID
			transaction.set(usernameRef, {
				userId: userId,
				username: lowerUsername,
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});

			// Update user document with username
			transaction.update(userRef, {
				username: lowerUsername,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		});
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

		// 3. Delete username document if it exists
		if (username) {
			const lowerUsername = username.toLowerCase();
			const usernameRef = db.collection("usernames").doc(lowerUsername);
			await usernameRef.delete();
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
