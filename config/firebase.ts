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

// Helper to check document existence - handles both property and method access
// for compatibility with different React Native Firebase versions
export const docExists = (doc: any): boolean => {
	if (typeof doc.exists === "function") {
		return doc.exists() === true;
	}
	return doc.exists === true;
};

// Helper function to fetch games from Firestore
export interface FirestoreGame {
	id: string;
	username?: string;
	uid?: string;
	// QuickMath structure
	questions?: string[];
	answers?: string[];
	// WordForm structure
	qna?: string;
	// Riddle structure
	question?: string;
	answer?: string;
	choices?: string[]; // MCQ choices (includes correct answer, shuffled)
	// WordChain structure
	startWord?: string;
	endWord?: string;
	validWords?: string[];
	minSteps?: number;
	// Inference structure
	definitions?: string[];
	// Maze structure
	rows?: number;
	cols?: number;
	cells?: Array<{ pos: number; number: number }>;
	solution?: number[];
	// Futoshiki structure
	size?: number;
	grid?: number[];
	givens?: Array<{ row: number; col: number; value: number }>;
	inequalities?: Array<{
		row1: number;
		col1: number;
		row2: number;
		col2: number;
		operator: "<" | ">";
	}>;
	// Magic Square structure
	magicConstant?: number;
	// TrailFinder structure
	startNum?: number;
	endNum?: number;
	path?: Array<{ row: number; col: number; value?: number }>;
	// Sudoku structure (grid is already defined above for Futoshiki/MagicSquare)
	hint?: string;
	// Trivia structure - reuses questions field name but with different type
	// questions?: Array<{ question: string; answer: string; choices: string[] }>;
	// CodeBreaker structure
	secretCode?: string[]; // Array of 6 color names
	maxGuesses?: number; // Max attempts allowed
	// Sequencing structure
	theme?: "people" | "appointments" | "runners";
	numSlots?: number;
	entities?: string[];
	rules?: Array<{
		type: string;
		entity1?: string;
		entity2?: string;
		position?: number;
		minDistance?: number;
		description: string;
	}>;
	// Note: solution field is shared by Maze and Sequencing (both use number[])
	// Hangman structure
	word?: string;
}

// Game History Entry interface
export interface GameHistoryEntry {
	gameId: string;
	action: "completed" | "skipped" | "attempted";
	timestamp: Date;
	timeTaken?: number;
	attempts?: number;
	difficulty?: string;
	category?: string;
	migrated?: boolean;
	answerRevealed?: boolean; // true if user used "Show Answer" feature
	completionCount?: number; // Number of times this game has been completed by the user
}

export const fetchGamesFromFirestore = async (
	gameType:
		| "quickMath"
		| "wordform"
		| "riddle"
		| "trivia"
		| "codebreaker"
		| "sequencing"
		| "wordChain"
		| "inference"
		| "maze"
		| "futoshiki"
		| "magicSquare"
		| "trailfinder"
		| "sudoku",
	difficulty: "easy" | "medium" | "hard"
): Promise<FirestoreGame[]> => {
	try {
		const gamesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty);
		const snapshot = await gamesRef.get();

		if (snapshot.empty) {
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
	gameType:
		| "quickMath"
		| "wordform"
		| "riddle"
		| "wordChain"
		| "inference"
		| "maze"
		| "futoshiki"
		| "magicSquare"
		| "trailfinder"
		| "sudoku"
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
	gameType:
		| "quickMath"
		| "wordform"
		| "riddle"
		| "wordChain"
		| "inference"
		| "maze"
		| "futoshiki"
		| "magicSquare"
		| "trailfinder"
		| "sudoku"
		| "trivia"
		| "codebreaker"
		| "sequencing"
		| "hangman",
	difficulty: "easy" | "medium" | "hard",
	gameData: {
		questions?: string[];
		answers?: string[];
		qna?: string;
		question?: string;
		answer?: string | string[];
		startWord?: string;
		endWord?: string;
		validWords?: string[];
		minSteps?: number;
		definitions?: string[];
		rows?: number;
		cols?: number;
		cells?: Array<{ pos: number; number: number }>;
		solution?: number[];
		size?: number;
		grid?: number[];
		givens?: Array<{ row: number; col: number; value: number }>;
		inequalities?: Array<{
			row1: number;
			col1: number;
			row2: number;
			col2: number;
			operator: "<" | ">";
		}>;
		magicConstant?: number;
		startNum?: number;
		endNum?: number;
		path?: Array<{ row: number; col: number; value?: number }>;
		hint?: string;
		choices?: string[];
		secretCode?: string[];
		maxGuesses?: number;
		theme?: "people" | "appointments" | "runners";
		numSlots?: number;
		entities?: string[];
		rules?: Array<{
			type: string;
			entity1?: string;
			entity2?: string;
			position?: number;
			minDistance?: number;
			description: string;
		}>;
	},
	userId: string,
	username?: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Check if user has too many game strikes (cannot create games if > 7)
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();
		const userData = userDoc.data();
		const gameStrikeCount = userData?.gameStrikeCount || 0;
		
		if (gameStrikeCount > 7) {
			throw new Error("You have too many strikes. Game creation has been disabled for your account.");
		}

		// Save to games/{gameType}/{difficulty}/{gameId}
		// Structure: games (collection) -> gameType (doc) -> difficulty (subcollection) -> gameId (doc)
		// This matches the structure of regular games, so user-created games appear in the same place
		const userGamesRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty);

		// Add metadata including difficulty
		const gameDoc: any = {
			...gameData,
			difficulty,
			createdBy: userId,
			uid: userId,
			createdAt: firestore.FieldValue.serverTimestamp(),
			approved: false, // Games need approval before appearing in main feed
		};

		// Add username if provided
		if (username) {
			gameDoc.username = username;
		}

		const docRef = await userGamesRef.add(gameDoc);

		// Also save to creator's createdGames subcollection
		const createdGameRef = db
			.collection("users")
			.doc(userId)
			.collection("createdGames")
			.doc(docRef.id);

		await createdGameRef.set({
			gameId: docRef.id,
			gameType,
			difficulty,
			createdAt: firestore.FieldValue.serverTimestamp(),
			playCount: 0,
		});

		// Increment user's createdGamesCount
		// Reuse userRef from earlier check
		await userRef.update({
			createdGamesCount: firestore.FieldValue.increment(1),
			updatedAt: firestore.FieldValue.serverTimestamp(),
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

		const docRef = await gameIdeasRef.add(ideaDoc);
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
export const parsePuzzleId = (
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
	} else if (gameType === "magicsquare") {
		gameType = "magicSquare";
	}
	// wordform, riddle, inference, maze, and futoshiki are already correct

	return { gameType, difficulty, gameId };
};

// Save puzzle completion to Firestore - updates stats directly in game document
export const savePuzzleCompletion = async (
	puzzleId: string,
	userId: string,
	timeTaken: number,
	attempts?: number, // for wordform/riddle/wordChain/trivia
	mistakes?: number, // for quickMath/trivia
	answerRevealed?: boolean, // true if user used "Show Answer" feature
	higherIsBetter?: boolean // true for trivia (higher score is better), false for wordform (fewer tries is better)
): Promise<void> => {
	// Skip stats update if answer was revealed
	// Game is still marked as completed in user's history, but doesn't affect leaderboard
	if (answerRevealed) {
		return;
	}

	// Validate and sanitize timeTaken before using it
	// This prevents NaN from propagating into time-related stats
	const sanitizedTimeTaken = 
		typeof timeTaken === "number" && 
		isFinite(timeTaken) && 
		timeTaken >= 0
			? timeTaken
			: 0;

	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Parse puzzleId to get game document path
		const parsed = parsePuzzleId(puzzleId);
		if (!parsed) {
			console.warn(`Invalid puzzleId format: ${puzzleId}`);
			return;
		}

		const { gameType, difficulty, gameId } = parsed;

		const gameRef = db
			.collection("games")
			.doc(gameType)
			.collection(difficulty)
			.doc(gameId);

		// Use transaction to atomically update stats
		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gameRef);

			if (!docExists(gameDoc)) {
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
			// IMPORTANT: Preserve likeCount and commentCount - they should only be changed by like/comment operations
			const newStats: Record<string, number | null> = {
				totalCompletions: currentStats.totalCompletions + 1,
				sumTime: currentStats.sumTime + sanitizedTimeTaken,
			};

			// Preserve likeCount and commentCount if they exist
			if (typeof existingStats.likeCount === "number" && existingStats.likeCount >= 0) {
				newStats.likeCount = existingStats.likeCount;
			}
			if (typeof existingStats.commentCount === "number" && existingStats.commentCount >= 0) {
				newStats.commentCount = existingStats.commentCount;
			}

			// Handle fastestTime (best time)
			// Don't set fastestTime if timeTaken is 0 (invalid/error case)
			if (sanitizedTimeTaken > 0) {
				if (currentStats.fastestTime === null) {
					newStats.fastestTime = sanitizedTimeTaken;
				} else {
					newStats.fastestTime = Math.min(sanitizedTimeTaken, currentStats.fastestTime);
				}
			} else {
				// Preserve existing fastestTime if timeTaken is 0
				if (currentStats.fastestTime !== null) {
					newStats.fastestTime = currentStats.fastestTime;
				}
			}

			// Update attempts stats if provided
			// For WordForm/Riddle/etc: LOWEST number is best (fewest tries)
			// For Trivia: HIGHEST number is best (most correct answers)
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
					// Use Math.max for trivia (higher is better), Math.min for others (lower is better)
					if (higherIsBetter) {
						newStats.bestAttempts = Math.max(
							attempts,
							currentStats.bestAttempts
						);
					} else {
						newStats.bestAttempts = Math.min(
							attempts,
							currentStats.bestAttempts
						);
					}
				}
			} else {
				// Preserve existing value
				newStats.bestAttempts = currentStats.bestAttempts;
			}

			// Update the document
			transaction.update(gameRef, { stats: newStats });
		});
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

			if (!docExists(gameDoc)) {
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

			// Update entire stats object (Firestore doesn't support dot notation in transactions)
			const updatedStats = {
				...existingStats,
				skipped: newSkipped,
			};
			transaction.update(gameRef, {
				stats: updatedStats,
			});

			finalCount = newSkipped;
		});
	} catch (error: any) {
		console.error("[trackGameSkipped] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Track when a game is attempted globally (at game document level)
export const trackGameAttempted = async (puzzleId: string): Promise<void> => {
	try {
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

			if (!docExists(gameDoc)) {
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

			// Update entire stats object (Firestore doesn't support dot notation in transactions)
			const updatedStats = {
				...existingStats,
				attempted: newAttempted,
			};
			transaction.update(gameRef, {
				stats: updatedStats,
			});

			finalCount = newAttempted;
		});
	} catch (error: any) {
		console.error("[trackGameAttempted] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Track when a game is completed globally (at game document level)
// This increments the completed count in stats
export const trackGameCompleted = async (puzzleId: string): Promise<void> => {
	try {
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

			if (!docExists(gameDoc)) {
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

			// Update entire stats object (Firestore doesn't support dot notation in transactions)
			const updatedStats = {
				...existingStats,
				completed: newCompleted,
			};
			transaction.update(gameRef, {
				stats: updatedStats,
			});

			finalCount = newCompleted;
		});
	} catch (error: any) {
		console.error("[trackGameCompleted] Error:", error);
		// Don't throw - this is non-critical tracking
	}
};

// Decrement skipped count when a user comes back and attempts a previously skipped game
export const decrementGameSkipped = async (puzzleId: string): Promise<void> => {
	try {
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

			if (!docExists(gameDoc)) {
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

			// Update entire stats object (Firestore doesn't support dot notation in transactions)
			const updatedStats = {
				...existingStats,
				skipped: newSkipped,
			};
			transaction.update(gameRef, {
				stats: updatedStats,
			});

			oldCount = currentSkipped;
			newCount = newSkipped;
		});
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

		if (!docExists(gameDoc)) {
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

// ============================================================================
// GAME HISTORY SUBCOLLECTION FUNCTIONS
// ============================================================================

// Helper to parse gameId and extract metadata
const parseGameIdForHistory = (
	gameId: string
): { category: string; difficulty: string } | null => {
	const parts = gameId.split("_");
	if (parts.length >= 2) {
		return {
			category: parts[0], // wordform, riddle, quickmath, wordchain
			difficulty: parts[1], // easy, medium, hard
		};
	}
	return null;
};

// Add activity to user's game history
export const addGameHistory = async (
	userId: string,
	gameId: string,
	action: "completed" | "skipped" | "attempted",
	metadata: {
		timeTaken?: number;
		attempts?: number;
		timestamp?: Date;
		migrated?: boolean;
	} = {}
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const historyRef = db
			.collection("users")
			.doc(userId)
			.collection("gameHistory")
			.doc(gameId);

		const parsed = parseGameIdForHistory(gameId);

		// Use transaction to ensure atomicity when updating completionCount
		if (action === "completed") {
			await db.runTransaction(async (transaction) => {
				const existingDoc = await transaction.get(historyRef);
				const existingData = docExists(existingDoc) ? existingDoc.data() : null;

				const historyData: any = {
					gameId,
					action,
					timestamp: metadata.timestamp
						? firestore.Timestamp.fromDate(metadata.timestamp)
						: firestore.FieldValue.serverTimestamp(),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				};

				if (parsed) {
					historyData.category = parsed.category;
					historyData.difficulty = parsed.difficulty;
				}

				if (metadata.timeTaken !== undefined) {
					historyData.timeTaken = metadata.timeTaken;
				}

				if (metadata.attempts !== undefined) {
					historyData.attempts = metadata.attempts;
				}

				if (metadata.migrated) {
					historyData.migrated = true;
				}

				// Handle completionCount: increment if completing again, set to 1 if first completion
				// Also check if this completion was just processed (within last 5 seconds) to prevent duplicates
				const now = metadata.timestamp
					? metadata.timestamp.getTime()
					: Date.now();
				let lastUpdate = 0;
				if (existingData?.updatedAt) {
					// Handle Firestore Timestamp
					if (typeof existingData.updatedAt.toMillis === "function") {
						lastUpdate = existingData.updatedAt.toMillis();
					} else if (typeof existingData.updatedAt.getTime === "function") {
						lastUpdate = existingData.updatedAt.getTime();
					} else if (typeof existingData.updatedAt === "number") {
						lastUpdate = existingData.updatedAt;
					}
				}
				const timeSinceLastUpdate = now - lastUpdate;
				const isRecentUpdate =
					timeSinceLastUpdate < 5000 && timeSinceLastUpdate >= 0; // 5 seconds

				if (
					existingData &&
					existingData.completionCount !== undefined &&
					existingData.completionCount > 0
				) {
					// Already completed before
					if (isRecentUpdate && existingData.action === "completed") {
						// Very recent completion, likely a duplicate call - don't increment
						historyData.completionCount = existingData.completionCount;
					} else {
						// Increment count
						historyData.completionCount = existingData.completionCount + 1;
					}
				} else {
					// First completion
					historyData.completionCount = 1;
				}

				transaction.set(historyRef, historyData, { merge: true });
			});
		} else {
			// For non-completed actions, use regular set with merge
			const existingDoc = await historyRef.get();
			const existingData = docExists(existingDoc) ? existingDoc.data() : null;

			const historyData: any = {
				gameId,
				action,
				timestamp: metadata.timestamp
					? firestore.Timestamp.fromDate(metadata.timestamp)
					: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			};

			if (parsed) {
				historyData.category = parsed.category;
				historyData.difficulty = parsed.difficulty;
			}

			if (metadata.timeTaken !== undefined) {
				historyData.timeTaken = metadata.timeTaken;
			}

			if (metadata.attempts !== undefined) {
				historyData.attempts = metadata.attempts;
			}

			if (metadata.migrated) {
				historyData.migrated = true;
			}

			// Preserve existing completionCount when action is not "completed"
			if (existingData && existingData.completionCount !== undefined) {
				historyData.completionCount = existingData.completionCount;
			}

			await historyRef.set(historyData, { merge: true });
		}
	} catch (error) {
		console.error("[addGameHistory] Error:", error);
		throw error;
	}
};

// Check if specific game has history entry
export const checkGameHistory = async (
	userId: string,
	gameId: string,
	action?: "completed" | "skipped" | "attempted"
): Promise<boolean> => {
	try {
		const historyRef = db
			.collection("users")
			.doc(userId)
			.collection("gameHistory")
			.doc(gameId);

		const doc = await historyRef.get();

		if (!docExists(doc)) {
			return false;
		}

		if (action) {
			const data = doc.data();
			return data?.action === action;
		}

		return true;
	} catch (error) {
		console.error("[checkGameHistory] Error:", error);
		return false;
	}
};

// Fetch recent game history with time window
export const fetchGameHistory = async (
	userId: string,
	options: {
		action?: "completed" | "skipped" | "attempted";
		daysBack?: number;
		limit?: number;
	} = {}
): Promise<GameHistoryEntry[]> => {
	try {
		let query = db
			.collection("users")
			.doc(userId)
			.collection("gameHistory") as any;

		// Filter by action if specified
		if (options.action) {
			query = query.where("action", "==", options.action);
		}

		// Filter by time if specified
		if (options.daysBack) {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
			query = query.where("timestamp", ">=", cutoffDate);
		}

		// WORKAROUND: Only order by timestamp if NOT filtering by action
		// (to avoid composite index requirement)
		// When we need both action filter + sorting, we'll sort in memory
		const needsMemorySort = options.action !== undefined;

		if (!needsMemorySort) {
			query = query.orderBy("timestamp", "desc");
		}

		// Limit if specified (apply before sorting for efficiency)
		if (options.limit && !needsMemorySort) {
			query = query.limit(options.limit);
		}

		const snapshot = await query.get();

		const history: GameHistoryEntry[] = [];
		snapshot.forEach((doc: any) => {
			const data = doc.data();
			history.push({
				gameId: data.gameId,
				action: data.action,
				timestamp: data.timestamp?.toDate() || new Date(),
				timeTaken: data.timeTaken,
				attempts: data.attempts,
				difficulty: data.difficulty,
				category: data.category,
				migrated: data.migrated,
				completionCount: data.completionCount,
			});
		});

		// Sort in memory if needed (when we filtered by action)
		if (needsMemorySort) {
			history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

			// Apply limit after sorting
			if (options.limit) {
				return history.slice(0, options.limit);
			}
		}

		return history;
	} catch (error) {
		console.error("[fetchGameHistory] Error:", error);
		return [];
	}
};

// Batch check multiple games at once (for feed filtering)
export const batchCheckGameHistory = async (
	userId: string,
	gameIds: string[],
	action: "completed" | "skipped"
): Promise<Set<string>> => {
	try {
		const matchingIds = new Set<string>();

		// Firestore 'in' queries are limited to 10 items, so we need to batch
		const batchSize = 10;
		for (let i = 0; i < gameIds.length; i += batchSize) {
			const batch = gameIds.slice(i, i + batchSize);

			const snapshot = await db
				.collection("users")
				.doc(userId)
				.collection("gameHistory")
				.where("gameId", "in", batch)
				.where("action", "==", action)
				.get();

			snapshot.forEach((doc: any) => {
				const data = doc.data();
				if (data.gameId) {
					matchingIds.add(data.gameId);
				}
			});
		}

		return matchingIds;
	} catch (error) {
		console.error("[batchCheckGameHistory] Error:", error);
		return new Set();
	}
};

// Get all completed game IDs from gameHistory (for filtering recommendations)
export const getAllCompletedGameIds = async (
	userId: string
): Promise<Set<string>> => {
	try {
		const completedHistory = await fetchGameHistory(userId, {
			action: "completed",
		});
		return new Set(completedHistory.map((entry) => entry.gameId));
	} catch (error) {
		console.error("[getAllCompletedGameIds] Error:", error);
		return new Set();
	}
};

// Get all game IDs from gameHistory (completed, skipped, attempted)
export const getAllGameHistoryIds = async (
	userId: string
): Promise<Set<string>> => {
	try {
		const allHistory = await fetchGameHistory(userId);
		return new Set(allHistory.map((entry) => entry.gameId));
	} catch (error) {
		console.error("[getAllGameHistoryIds] Error:", error);
		return new Set();
	}
};

// Fetch multiple games by their IDs
export const fetchGamesByIds = async (
	gameIds: string[]
): Promise<FirestoreGame[]> => {
	try {
		const games: FirestoreGame[] = [];
		const gameMap = new Map<string, string[]>();

		// Group by gameType and difficulty for efficient fetching
		gameIds.forEach((gameId) => {
			const parsed = parsePuzzleId(gameId);
			if (parsed) {
				const key = `${parsed.gameType}_${parsed.difficulty}`;
				if (!gameMap.has(key)) {
					gameMap.set(key, []);
				}
				gameMap.get(key)!.push(parsed.gameId);
			}
		});

		// Fetch games in parallel for better performance
		const fetchPromises: Promise<void>[] = [];

		for (const [key, ids] of gameMap.entries()) {
			const [gameType, difficulty] = key.split("_");
			const gamesRef = db
				.collection("games")
				.doc(gameType)
				.collection(difficulty);

			// Fetch all games in this group in parallel
			for (const gameId of ids) {
				const fetchPromise = gamesRef
					.doc(gameId)
					.get()
					.then((doc) => {
						if (docExists(doc)) {
							const gameData = doc.data();
							games.push({
								id: `${gameType}_${difficulty}_${gameId}`,
								...gameData,
							} as FirestoreGame);
						}
					})
					.catch((error) => {
						console.warn(`[fetchGamesByIds] Failed to fetch ${gameId}:`, error);
					});

				fetchPromises.push(fetchPromise);
			}
		}

		// Wait for all fetches to complete in parallel
		await Promise.all(fetchPromises);

		// Preserve original order
		const gameMapById = new Map(games.map((g) => [g.id, g]));
		return gameIds
			.map((id) => gameMapById.get(id))
			.filter((g) => g !== undefined) as FirestoreGame[];
	} catch (error) {
		console.error("[fetchGamesByIds] Error:", error);
		return [];
	}
};

// Update existing history entry (for skip → attempt transition)
export const updateGameHistory = async (
	userId: string,
	gameId: string,
	updates: Partial<{ action: string; timestamp: Date }>
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const historyRef = db
			.collection("users")
			.doc(userId)
			.collection("gameHistory")
			.doc(gameId);

		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		if (updates.action) {
			updateData.action = updates.action;
		}

		if (updates.timestamp) {
			updateData.timestamp = firestore.Timestamp.fromDate(updates.timestamp);
		}

		await historyRef.update(updateData);
	} catch (error) {
		console.error("[updateGameHistory] Error:", error);
		throw error;
	}
};

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

// One-time migration from arrays to gameHistory subcollection
export const migrateUserArraysToHistory = async (
	userId: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// Import getUserData to check user document
		const { getUserData } = require("./auth");
		const userDoc = await getUserData(userId);

		if (!userDoc) {
			return;
		}

		// Check if already migrated
		if (userDoc._historyMigrated) {
			return;
		}

		let migratedCount = 0;

		// Migrate completed games if they exist
		const completedGames = (userDoc as any).completedGames || [];
		if (completedGames.length > 0) {
			for (const gameId of completedGames) {
				try {
					await addGameHistory(userId, gameId, "completed", {
						timestamp: userDoc.createdAt?.toDate
							? userDoc.createdAt.toDate()
							: new Date(),
						migrated: true,
					});
					migratedCount++;
				} catch (error) {
					console.error(
						`[Migration] Error migrating completed game ${gameId}:`,
						error
					);
				}
			}
		}

		// Migrate skipped games if they exist
		const skippedGames = (userDoc as any).skippedGames || [];
		if (skippedGames.length > 0) {
			for (const gameId of skippedGames) {
				try {
					await addGameHistory(userId, gameId, "skipped", {
						timestamp: userDoc.createdAt?.toDate
							? userDoc.createdAt.toDate()
							: new Date(),
						migrated: true,
					});
					migratedCount++;
				} catch (error) {
					console.error(
						`[Migration] Error migrating skipped game ${gameId}:`,
						error
					);
				}
			}
		}

		// Mark as migrated
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			_historyMigrated: true,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error(`[Migration] Error migrating user ${userId}:`, error);
		// Don't throw - allow app to continue even if migration fails
	}
};
