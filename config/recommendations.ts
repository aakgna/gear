import { Puzzle } from "./types";
import { UserData, CategoryStats, DifficultyStats } from "./auth";

// Helper to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// Get user's favorite category based on completion stats
function getFavoriteCategory(
	statsByCategory?: Record<string, CategoryStats>
): string {
	if (!statsByCategory || Object.keys(statsByCategory).length === 0) {
		// No history, return random category
		const categories = ["wordle", "riddle", "quickMath", "wordChain", "alias", "zip", "futoshiki"];
		return categories[Math.floor(Math.random() * categories.length)];
	}

	// Find category with most completions
	let maxCompletions = 0;
	let favoriteCategory = "quickMath"; // default

	Object.entries(statsByCategory).forEach(([category, stats]) => {
		if (stats.completed > maxCompletions) {
			maxCompletions = stats.completed;
			favoriteCategory = category;
		}
	});

	return favoriteCategory;
}

// Get user's preferred difficulty based on completion stats
function getPreferredDifficulty(
	statsByDifficulty?: Record<string, DifficultyStats>
): number {
	if (!statsByDifficulty || Object.keys(statsByDifficulty).length === 0) {
		return 1; // Default to easy (1)
	}

	// Find difficulty with most completions
	let maxCompletions = 0;
	let preferredDifficulty = 1; // default to easy

	Object.entries(statsByDifficulty).forEach(([difficulty, stats]) => {
		if (stats.completed > maxCompletions) {
			maxCompletions = stats.completed;
			// Map difficulty string to number
			if (difficulty === "easy") preferredDifficulty = 1;
			else if (difficulty === "medium") preferredDifficulty = 2;
			else if (difficulty === "hard") preferredDifficulty = 3;
		}
	});

	return preferredDifficulty;
}

// Simple, fast recommendation function
// 67% preferred games (user's favorite category + difficulty)
// 33% random exploration games (other categories, easy/medium)
export function getSimpleRecommendations(
	availableGames: Puzzle[],
	userData: UserData | null,
	batchSize: number = 15
): Puzzle[] {
	console.log(
		`[SimpleRecs] Generating ${batchSize} recommendations from ${availableGames.length} available games`
	);

	// If no games available, return empty
	if (availableGames.length === 0) {
		return [];
	}

	// If not enough games, return all shuffled
	if (availableGames.length <= batchSize) {
		console.log("[SimpleRecs] Not enough games, returning all shuffled");
		return shuffleArray(availableGames);
	}

	// Calculate split: 67% preferred, 33% random
	const preferredCount = Math.floor(batchSize * 0.67);
	const randomCount = batchSize - preferredCount;

	console.log(
		`[SimpleRecs] Target: ${preferredCount} preferred, ${randomCount} random`
	);

	// Determine user preferences
	const favoriteCategory = getFavoriteCategory(userData?.statsByCategory);
	const preferredDifficulty = getPreferredDifficulty(
		userData?.statsByDifficulty
	);

	console.log(
		`[SimpleRecs] User preferences: category=${favoriteCategory}, difficulty=${preferredDifficulty}`
	);

	// === PREFERRED GAMES (67%) ===
	// Filter games matching favorite category
	let preferredGames = availableGames.filter(
		(game) => game.type === favoriteCategory
	);

	// If not enough in preferred category, use all games
	if (preferredGames.length < preferredCount) {
		console.log(
			`[SimpleRecs] Not enough ${favoriteCategory} games (${preferredGames.length}), using all categories`
		);
		preferredGames = availableGames;
	}

	// Within preferred games, create difficulty distribution:
	// 70% at preferred difficulty, 20% medium, 10% easy
	const difficultyBuckets = {
		preferred: preferredGames.filter((g) => g.difficulty === preferredDifficulty),
		medium: preferredGames.filter((g) => g.difficulty === 2),
		easy: preferredGames.filter((g) => g.difficulty === 1),
	};

	const preferredDiffCount = Math.floor(preferredCount * 0.7);
	const mediumCount = Math.floor(preferredCount * 0.2);
	const easyCount = preferredCount - preferredDiffCount - mediumCount;

	const selectedPreferred: Puzzle[] = [];

	// Pick from preferred difficulty
	const shuffledPreferred = shuffleArray(difficultyBuckets.preferred);
	selectedPreferred.push(...shuffledPreferred.slice(0, preferredDiffCount));

	// Pick from medium
	const shuffledMedium = shuffleArray(difficultyBuckets.medium);
	selectedPreferred.push(...shuffledMedium.slice(0, mediumCount));

	// Pick from easy
	const shuffledEasy = shuffleArray(difficultyBuckets.easy);
	selectedPreferred.push(...shuffledEasy.slice(0, easyCount));

	// If we don't have enough, fill remaining from all preferred games
	if (selectedPreferred.length < preferredCount) {
		const remaining = preferredCount - selectedPreferred.length;
		const selectedIds = new Set(selectedPreferred.map((g) => g.id));
		const unselected = shuffleArray(
			preferredGames.filter((g) => !selectedIds.has(g.id))
		);
		selectedPreferred.push(...unselected.slice(0, remaining));
	}

	console.log(`[SimpleRecs] Selected ${selectedPreferred.length} preferred games`);

	// === RANDOM EXPLORATION GAMES (33%) ===
	// Filter games from OTHER categories (not favorite)
	// And only easy/medium difficulty
	let explorationGames = availableGames.filter(
		(game) =>
			game.type !== favoriteCategory && (game.difficulty === 1 || game.difficulty === 2)
	);

	// If not enough exploration games, just use any other category
	if (explorationGames.length < randomCount) {
		explorationGames = availableGames.filter(
			(game) => game.type !== favoriteCategory
		);
	}

	// If still not enough, use any games not already selected
	if (explorationGames.length < randomCount) {
		const selectedIds = new Set(selectedPreferred.map((g) => g.id));
		explorationGames = availableGames.filter((g) => !selectedIds.has(g.id));
	}

	// Shuffle and pick random games
	const selectedRandom = shuffleArray(explorationGames).slice(0, randomCount);

	console.log(`[SimpleRecs] Selected ${selectedRandom.length} random games`);

	// Combine and shuffle final batch
	const finalBatch = shuffleArray([...selectedPreferred, ...selectedRandom]);

	console.log(
		`[SimpleRecs] Final batch: ${finalBatch.length} games (${finalBatch.filter((g) => g.type === favoriteCategory).length} ${favoriteCategory}, ${finalBatch.filter((g) => g.type !== favoriteCategory).length} others)`
	);

	return finalBatch;
}

// Interleave games by type for visual variety
// Takes games and arranges them so types alternate: QM → W → WC → R → QM → W ...
export function interleaveGamesByType(games: Puzzle[]): Puzzle[] {
	console.log(`[Interleave] Processing ${games.length} games`);

	// Group by type
	const byType: Record<string, Puzzle[]> = {
		quickMath: [],
		wordle: [],
		wordChain: [],
		riddle: [],
		alias: [],
		zip: [],
		futoshiki: [],
	};

	games.forEach((game) => {
		if (byType[game.type]) {
			byType[game.type].push(game);
		}
	});

	// Interleave: take 1 from each type in rotation
	const interleaved: Puzzle[] = [];
	const types = ["quickMath", "wordle", "wordChain", "riddle", "alias", "zip", "futoshiki"];
	const maxLength = Math.max(...Object.values(byType).map((arr) => arr.length));

	for (let i = 0; i < maxLength; i++) {
		for (const type of types) {
			if (byType[type][i]) {
				interleaved.push(byType[type][i]);
			}
		}
	}

	console.log(
		`[Interleave] Result: ${interleaved.length} games`,
		`(${byType.quickMath.length} QM, ${byType.wordle.length} W,`,
		`${byType.wordChain.length} WC, ${byType.riddle.length} R, ${byType.alias.length} A, ${byType.zip.length} Z, ${byType.futoshiki.length} F)`
	);

	return interleaved;
}

