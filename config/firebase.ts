// React Native Firebase - Configuration is handled by GoogleService-Info.plist (iOS) and google-services.json (Android)
// No need for manual config object - it's automatically loaded from native config files

// IMPORTANT: Import app module FIRST to ensure Firebase is initialized before Firestore
// This ensures the native Firebase app is created before we try to use Firestore
import "@react-native-firebase/app";
import firestore from "@react-native-firebase/firestore";

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
}

export const fetchGamesFromFirestore = async (
	gameType: "quickMath" | "wordle" | "riddle",
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
	gameType: "quickMath" | "wordle" | "riddle"
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
	gameType: "quickMath" | "wordle" | "riddle",
	difficulty: "easy" | "medium" | "hard",
	gameData: {
		questions?: string[];
		answers?: string[];
		qna?: string;
		question?: string;
		answer?: string;
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
