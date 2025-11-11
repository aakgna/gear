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
