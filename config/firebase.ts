// React Native Firebase - Configuration is handled by GoogleService-Info.plist (iOS) and google-services.json (Android)
// No need for manual config object - it's automatically loaded from native config files

// IMPORTANT: Import app module FIRST to ensure Firebase is initialized before Firestore
// This ensures the native Firebase app is created before we try to use Firestore
import "@react-native-firebase/app";
import firestore from "@react-native-firebase/firestore";
import { PuzzleCompletion, PuzzleStats } from "./types";

// Initialize Firestore - React Native Firebase auto-initializes the default app
// from GoogleService-Info.plist (iOS) and google-services.json (Android)
export const db = firestore();

// Helper function to fetch games from Firestore
export interface FirestoreGame {
	id: string;
	// QuickMath structure
	questions?: string[];
	answers?: string[];
	// Wordle structure
	qna?: string;
	// Riddle structure
	question?: string;
	answer?: string;
	// WordChain structure
	startWord?: string;
	endWord?: string;
	validWords?: string[];
	minSteps?: number;
	hint?: string;
}

export const fetchGamesFromFirestore = async (
	gameType: "quickMath" | "wordle" | "riddle" | "wordChain",
	difficulty: "easy" | "medium" | "hard"
): Promise<FirestoreGame[]> => {
	try {
		const gamesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty);
		const snapshot = await gamesRef.get();

		if (snapshot.empty) {
			console.log(`No ${difficulty} ${gameType} games found in Firestore`);
			return [];
		}

		const games: FirestoreGame[] = [];
		snapshot.forEach((doc) => {
			games.push({
				id: doc.id,
				...doc.data(),
			} as FirestoreGame);
		});

		return games;
	} catch (error: any) {
		console.error(`Error fetching ${gameType} games:`, error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		return [];
	}
};

// Helper to fetch all games for a specific type across all difficulties
export const fetchAllGamesForType = async (
	gameType: "quickMath" | "wordle" | "riddle" | "wordChain"
): Promise<{ difficulty: string; games: FirestoreGame[] }[]> => {
	const difficulties = ["easy", "medium", "hard"];
	const results = await Promise.all(
		difficulties.map(async (diff) => ({
			difficulty: diff,
			games: await fetchGamesFromFirestore(
				gameType,
				diff as "easy" | "medium" | "hard"
			),
		}))
	);
	return results;
};

// Save a user-created game to Firestore
export const saveGameToFirestore = async (
	gameType: "quickMath" | "wordle" | "riddle" | "wordChain",
	difficulty: "easy" | "medium" | "hard",
	gameData: {
		questions?: string[];
		answers?: string[];
		qna?: string;
		question?: string;
		answer?: string;
		startWord?: string;
		endWord?: string;
		validWords?: string[];
		minSteps?: number;
		hint?: string;
	},
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Save to games/{gameType}/{difficulty}/{gameId}
		// Structure: games (collection) -> gameType (doc) -> difficulty (subcollection) -> gameId (doc)
		// This matches the structure of regular games, so user-created games appear in the same place
		const userGamesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty);

		// Add metadata including difficulty
		const gameDoc = {
			...gameData,
			difficulty,
			createdBy: userId,
			createdAt: firestore.FieldValue.serverTimestamp(),
			approved: false, // Games need approval before appearing in main feed
		};

		console.log("Attempting to save game:", {
			gameType,
			difficulty,
			userId,
			gameData,
			path: `games/${gameType}/${difficulty}`,
		});

		const docRef = await userGamesRef.add(gameDoc);

		console.log(`Game saved successfully: ${gameType} - ${difficulty}`, {
			documentId: docRef.id,
			path: docRef.path,
		});
	} catch (error: any) {
		console.error("Error saving game to Firestore:", error);
		console.error("Error details:", {
			code: error?.code,
			message: error?.message,
			stack: error?.stack,
		});
		if (error?.code === "firestore/permission-denied") {
			throw new Error(
				"Permission denied. Please check your Firestore security rules."
			);
		}
		throw new Error(error.message || "Failed to save game. Please try again.");
	}
};

// Save a user-submitted game idea to Firestore
export const saveGameIdeaToFirestore = async (
	idea: string,
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Save to gameAddition collection: gameAddition/{ideaId}
		const gameIdeasRef = db.collection("gameAddition");

		// Add metadata
		const ideaDoc = {
			idea: idea.trim(),
			createdBy: userId,
			createdAt: firestore.FieldValue.serverTimestamp(),
			status: "pending", // pending, reviewed, approved, rejected
		};

		console.log("Attempting to save game idea:", {
			userId,
			ideaLength: idea.trim().length,
			path: "gameAddition",
		});

		const docRef = await gameIdeasRef.add(ideaDoc);

		console.log(`Game idea saved successfully:`, {
			documentId: docRef.id,
			path: docRef.path,
		});
	} catch (error: any) {
		console.error("Error saving game idea to Firestore:", error);
		console.error("Error details:", {
			code: error?.code,
			message: error?.message,
			stack: error?.stack,
		});
		if (error?.code === "firestore/permission-denied") {
			throw new Error(
				"Permission denied. Please check your Firestore security rules."
			);
		}
		throw new Error(
			error.message || "Failed to save game idea. Please try again."
		);
	}
};

// Parse puzzleId to extract gameType, difficulty, and gameId
// Format: {gameType}_{difficulty}_{gameId}
// Note: puzzleId uses lowercase (e.g., "quickmath"), but Firestore uses camelCase (e.g., "quickMath")
const parsePuzzleId = (
	puzzleId: string
): { gameType: string; difficulty: string; gameId: string } | null => {
	const parts = puzzleId.split("_");
	if (parts.length < 3) return null;

	let gameType = parts[0].toLowerCase();
	const difficulty = parts[1];
	const gameId = parts.slice(2).join("_"); // In case gameId has underscores

	// Normalize gameType to match Firestore collection names
	// puzzleId uses lowercase, but Firestore uses camelCase
	if (gameType === "quickmath") {
		gameType = "quickMath";
	} else if (gameType === "wordchain") {
		gameType = "wordChain";
	}
	// wordle and riddle are already correct

	return { gameType, difficulty, gameId };
};

// Save puzzle completion to Firestore - updates stats directly in game document
export const savePuzzleCompletion = async (
	puzzleId: string,
	userId: string,
	timeTaken: number,
	attempts?: number, // for wordle/riddle/wordChain
	mistakes?: number // for quickMath
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Parse puzzleId to get game document path
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`Invalid puzzleId format: ${puzzleId}`);
			return;
		}

		console.log("Parsed puzzle ID:", parsed);

		const { gameType, difficulty, gameId } = parsed;
		console.log(
			`Updating stats for: games/${gameType}/${difficulty}/${gameId}`
		);

		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically update stats
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!gameDoc.exists) {
				console.warn(
					`Game document not found: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			const gameData = gameDoc.data();
			if (!gameData) {
				console.warn(
					`Game document has no data: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			// Get current stats, sanitizing any invalid values
			const existingStats = gameData.stats || {};

			// Helper to sanitize number values (handle Infinity, null, undefined)
			const sanitizeNumber = (val: any, defaultValue: number): number => {
				if (typeof val === "number" && isFinite(val)) return val;
				return defaultValue;
			};

			// Helper to sanitize nullable number values
			const sanitizeNullableNumber = (val: any): number | null => {
				if (val === null) return null;
				if (typeof val === "number" && isFinite(val)) return val;
				return null;
			};

			const currentStats = {
				totalCompletions: sanitizeNumber(existingStats.totalCompletions, 0),
				sumTime: sanitizeNumber(existingStats.sumTime, 0),
				fastestTime: sanitizeNullableNumber(existingStats.fastestTime),
				bestAttempts: sanitizeNullableNumber(existingStats.bestAttempts),
			};

			// Build new stats object with only valid Firestore values
			const newStats: Record<string, number | null> = {
				totalCompletions: currentStats.totalCompletions + 1,
				sumTime: currentStats.sumTime + timeTaken,
			};

			// Handle fastestTime (best time)
			if (currentStats.fastestTime === null) {
				newStats.fastestTime = timeTaken;
			} else {
				newStats.fastestTime = Math.min(timeTaken, currentStats.fastestTime);
			}

			// Update attempts stats if provided (for games like Wordle - number of tries)
			// For bestAttempts, we want the LOWEST number (fewest tries is best)
			if (
				attempts !== undefined &&
				attempts !== null &&
				typeof attempts === "number"
			) {
				if (
					currentStats.bestAttempts === null ||
					currentStats.bestAttempts === undefined
				) {
					newStats.bestAttempts = attempts;
				} else {
					newStats.bestAttempts = Math.min(attempts, currentStats.bestAttempts);
				}
			} else {
				// Preserve existing value
				newStats.bestAttempts = currentStats.bestAttempts;
			}

			// Update the document
			console.log("Updating stats:", JSON.stringify(newStats, null, 2));
			transaction.update(gameRef, { stats: newStats });
		});

		console.log("Stats update transaction completed successfully");
	} catch (error: any) {
		console.error("Error saving puzzle completion:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		// Don't throw - allow game completion to proceed even if stats save fails
	}
};

// Track when a game is skipped globally (at game document level)
export const trackGameSkipped = async (puzzleId: string): Promise<void> => {
	try {
		console.log(`[trackGameSkipped] Tracking skipped for: ${puzzleId}`);
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`[trackGameSkipped] Invalid puzzleId format: ${puzzleId}`);
			return;
		}

		const { gameType, difficulty, gameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically update skipped count
		let finalCount = 0;
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!gameDoc.exists) {
				console.warn(
					`[trackGameSkipped] Game document not found: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			const gameData = gameDoc.data();
			const existingStats = gameData?.stats || {};

			const currentSkipped =
				typeof existingStats.skipped === "number" &&
				isFinite(existingStats.skipped)
					? existingStats.skipped
					: 0;

			// Increment skipped count
			const newSkipped = currentSkipped + 1;
			transaction.update(gameRef, {
				"stats.skipped": newSkipped,
			});

			finalCount = newSkipped;
		});

		console.log(
			`[trackGameSkipped] Successfully updated skipped count to ${finalCount}`
		);
	} catch (error: any) {
		console.error("[trackGameSkipped] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Track when a game is attempted globally (at game document level)
export const trackGameAttempted = async (puzzleId: string): Promise<void> => {
	try {
		console.log(`[trackGameAttempted] Tracking attempted for: ${puzzleId}`);
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`[trackGameAttempted] Invalid puzzleId format: ${puzzleId}`);
			return;
		}

		const { gameType, difficulty, gameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically update attempted count
		let finalCount = 0;
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!gameDoc.exists) {
				console.warn(
					`[trackGameAttempted] Game document not found: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			const gameData = gameDoc.data();
			const existingStats = gameData?.stats || {};

			const currentAttempted =
				typeof existingStats.attempted === "number" &&
				isFinite(existingStats.attempted)
					? existingStats.attempted
					: 0;

			// Increment attempted count
			const newAttempted = currentAttempted + 1;
			transaction.update(gameRef, {
				"stats.attempted": newAttempted,
			});

			finalCount = newAttempted;
		});

		console.log(
			`[trackGameAttempted] Successfully updated attempted count to ${finalCount}`
		);
	} catch (error: any) {
		console.error("[trackGameAttempted] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Track when a game is completed globally (at game document level)
// This increments the completed count in stats
export const trackGameCompleted = async (puzzleId: string): Promise<void> => {
	try {
		console.log(`[trackGameCompleted] Tracking completed for: ${puzzleId}`);
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`[trackGameCompleted] Invalid puzzleId format: ${puzzleId}`);
			return;
		}

		const { gameType, difficulty, gameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically update completed count
		let finalCount = 0;
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!gameDoc.exists) {
				console.warn(
					`[trackGameCompleted] Game document not found: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			const gameData = gameDoc.data();
			const existingStats = gameData?.stats || {};

			const currentCompleted =
				typeof existingStats.completed === "number" &&
				isFinite(existingStats.completed)
					? existingStats.completed
					: 0;

			// Increment completed count
			const newCompleted = currentCompleted + 1;
			transaction.update(gameRef, {
				"stats.completed": newCompleted,
			});

			finalCount = newCompleted;
		});

		console.log(
			`[trackGameCompleted] Successfully updated completed count to ${finalCount}`
		);
	} catch (error: any) {
		console.error("[trackGameCompleted] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Decrement skipped count when a user comes back and attempts a previously skipped game
export const decrementGameSkipped = async (puzzleId: string): Promise<void> => {
	try {
		console.log(`[decrementGameSkipped] Decrementing skipped for: ${puzzleId}`);
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(
				`[decrementGameSkipped] Invalid puzzleId format: ${puzzleId}`
			);
			return;
		}

		const { gameType, difficulty, gameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically decrement skipped count
		let oldCount = 0;
		let newCount = 0;
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!gameDoc.exists) {
				console.warn(
					`[decrementGameSkipped] Game document not found: ${gameType}/${difficulty}/${gameId}`
				);
				return;
			}

			const gameData = gameDoc.data();
			const existingStats = gameData?.stats || {};

			const currentSkipped =
				typeof existingStats.skipped === "number" &&
				isFinite(existingStats.skipped)
					? existingStats.skipped
					: 0;

			// Decrement skipped count (but don't go below 0)
			const newSkipped = Math.max(0, currentSkipped - 1);
			transaction.update(gameRef, {
				"stats.skipped": newSkipped,
			});

			oldCount = currentSkipped;
			newCount = newSkipped;
		});

		console.log(
			`[decrementGameSkipped] Successfully decremented skipped from ${oldCount} to ${newCount}`
		);
	} catch (error: any) {
		console.error("[decrementGameSkipped] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Fetch puzzle completion stats for a specific puzzle - reads from game document
export const fetchPuzzleStats = async (
	puzzleId: string
): Promise<PuzzleStats | null> => {
	try {
		// Parse puzzleId to get game document path
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`Invalid puzzleId format: ${puzzleId}`);
			return null;
		}

		const { gameType, difficulty, gameId } = parsed;
		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		const gameDoc = await gameRef.get();

		if (!gameDoc.exists) {
			return null;
		}

		const gameData = gameDoc.data();
		const statsData = gameData?.stats;

		if (!statsData || statsData.totalCompletions === 0) {
			return null;
		}

		// Calculate stats from aggregated data
		const stats: PuzzleStats = {
			totalCompletions: statsData.totalCompletions || 0,
			averageTime:
				statsData.totalCompletions > 0
					? Math.round((statsData.sumTime || 0) / statsData.totalCompletions)
					: 0,
			fastestTime:
				statsData.fastestTime && statsData.fastestTime > 0
					? statsData.fastestTime
					: 0,
		};

		// Add bestAttempts if available (lowest number of tries)
		if (
			statsData.bestAttempts !== null &&
			statsData.bestAttempts !== undefined
		) {
			stats.bestAttempts = statsData.bestAttempts;
		}

		return stats;
	} catch (error: any) {
		console.error("Error fetching puzzle stats:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		return null;
	}
};
