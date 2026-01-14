import { Puzzle } from "./types";
import { UserData, CategoryStats } from "./auth";

// Helper to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// Helper to parse Firestore timestamp to Date
function parseFirestoreTimestamp(timestamp: any): Date | null {
	if (!timestamp) return null;
	
	if (timestamp.toDate) {
		return timestamp.toDate();
	} else if (timestamp instanceof Date) {
		return timestamp;
	} else {
		try {
			return new Date(timestamp);
		} catch {
			return null;
		}
	}
}

// Calculate time decay factor with epsilon-style decay
// More played games decay faster than less played games
function calculateTimeDecay(
	lastPlayedAt: any,
	categoryEngagementScore: number,
	daysSinceLastPlay?: number
): number {
	// If no last played date, no decay
	if (!lastPlayedAt) return 1.0;

	// Parse timestamp
	const lastPlayedDate = parseFirestoreTimestamp(lastPlayedAt);
	if (!lastPlayedDate) return 1.0;

	// Calculate days since last play
	const now = new Date();
	const daysSince = daysSinceLastPlay !== undefined 
		? daysSinceLastPlay 
		: Math.floor((now.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24));

	// No decay if less than 7 days
	if (daysSince < 7) return 1.0;

	// Calculate base decay rate (increases with days)
	// After 7 days: 0% decay, after 30 days: ~50% decay, after 90 days: ~80% decay
	const daysOverThreshold = daysSince - 7;
	const baseDecayRate = Math.min(0.8, daysOverThreshold / 100); // Max 80% decay

	// Epsilon-style decay: higher engagement = faster decay
	// Engagement score is 0-1, so we use it as a multiplier
	// High engagement (0.8-1.0) -> decay multiplier of 1.0-1.2
	// Low engagement (0.0-0.3) -> decay multiplier of 0.3-0.5
	const engagementMultiplier = Math.max(0.3, Math.min(1.2, 
		0.3 + (categoryEngagementScore * 0.9)
	));

	// Final decay: more engaged categories decay faster
	// Formula: decay = baseDecayRate * engagementMultiplier
	const totalDecay = baseDecayRate * engagementMultiplier;

	// Return decay factor (1.0 = no decay, 0.0 = complete decay)
	return Math.max(0.2, 1.0 - totalDecay); // Minimum 20% of original score remains
}

// Calculate engagement score for a category (used for both scoring and decay)
function calculateCategoryEngagementScore(
	categoryData: {
		attempted?: number;
		skipped?: number;
		easy?: CategoryStats;
		medium?: CategoryStats;
		hard?: CategoryStats;
	}
): number {
	if (!categoryData) return 0;

	// Aggregate stats across all difficulties
	let totalCompleted = 0;
	let totalAttempted = 0;
	let totalSkipped = 0;

	["easy", "medium", "hard"].forEach((diff) => {
		const diffStats = categoryData[diff as "easy" | "medium" | "hard"];
		if (diffStats) {
			totalCompleted += diffStats.completed || 0;
			totalAttempted += diffStats.attempted || 0;
			totalSkipped += diffStats.skipped || 0;
		}
	});

	// Calculate metrics
	const totalInteractions = totalAttempted + totalSkipped;
	if (totalInteractions === 0) return 0;

	// Completion rate (0-1): how often they complete vs attempt
	const completionRate = totalAttempted > 0 ? totalCompleted / totalAttempted : 0;

	// Skip rate (0-1): lower is better (inverted)
	const skipRate = totalInteractions > 0 ? totalSkipped / totalInteractions : 0;
	const nonSkipRate = 1 - skipRate;

	// Engagement score combines completion rate and non-skip rate
	// Weight: 60% completion rate, 40% non-skip rate
	const engagementScore = completionRate * 0.6 + nonSkipRate * 0.4;

	// Bonus for having played multiple times (shows sustained interest)
	const volumeBonus = Math.min(totalCompleted / 10, 0.2); // Max 20% bonus

	return Math.min(1.0, engagementScore + volumeBonus);
}

// Calculate difficulty preference score
function calculateDifficultyPreference(
	categoryData: {
		attempted?: number;
		skipped?: number;
		easy?: CategoryStats;
		medium?: CategoryStats;
		hard?: CategoryStats;
	},
	difficulty: number
): number {
	if (!categoryData) return 0.5; // Neutral if no data

	const diffKey = difficulty === 1 ? "easy" : difficulty === 2 ? "medium" : "hard";
	const diffStats = categoryData[diffKey];

	if (!diffStats) return 0.3; // Lower score if never played this difficulty

	const attempted = diffStats.attempted || 0;
	const completed = diffStats.completed || 0;
	const skipped = diffStats.skipped || 0;

	if (attempted === 0) return 0.3;

	// Completion rate for this specific difficulty
	const completionRate = completed / attempted;
	
	// Skip rate (inverted - lower skip rate = higher preference)
	const skipRate = (attempted + skipped) > 0 ? skipped / (attempted + skipped) : 0;
	const nonSkipRate = 1 - skipRate;

	// Weighted score
	return completionRate * 0.7 + nonSkipRate * 0.3;
}

// Calculate game recommendation score with time decay
function calculateGameScore(
	game: Puzzle,
	userData: UserData | null,
	completedGameIds: Set<string>
): number {
	if (!userData?.statsByCategory) {
		// New user: give slight preference to easy games
		return game.difficulty === 1 ? 0.6 : 0.4;
	}

	const categoryData = userData.statsByCategory[game.type];
	
	// Base engagement score for this category
	const categoryScore = calculateCategoryEngagementScore(categoryData || {});
	
	// Difficulty preference within this category
	const difficultyScore = calculateDifficultyPreference(
		categoryData || {},
		game.difficulty
	);

	// Calculate time decay factor
	// More engaged categories decay faster when user hasn't played
	const timeDecayFactor = calculateTimeDecay(
		userData.lastPlayedAt,
		categoryScore
	);

	// Penalty if already completed (but don't exclude completely)
	const completionPenalty = completedGameIds.has(game.id) ? 0.3 : 1.0;

	// Diversity bonus: encourage trying new categories
	const categoryPlayCount = categoryData?.attempted || 0;
	const diversityBonus = categoryPlayCount === 0 ? 0.2 : Math.max(0, 0.2 - categoryPlayCount / 50);

	// Exploration bonus: encourage trying categories they've skipped
	const skipCount = categoryData?.skipped || 0;
	const explorationBonus = skipCount > 0 && skipCount < 5 ? 0.1 : 0;

	// Final score formula:
	// 50% category engagement + 30% difficulty match + 10% diversity + 10% exploration
	// Then apply time decay and completion penalty
	const baseScore = 
		categoryScore * 0.5 +
		difficultyScore * 0.3 +
		diversityBonus * 0.1 +
		explorationBonus * 0.1;

	// Apply time decay: reduces score based on inactivity and engagement level
	const decayedScore = baseScore * timeDecayFactor;

	// Apply completion penalty
	return decayedScore * completionPenalty;
}

// Get user's favorite category based on completion stats
// Now aggregates across all difficulties
function getFavoriteCategory(
	statsByCategory?: Record<string, {
		attempted?: number;
		skipped?: number;
		easy?: CategoryStats;
		medium?: CategoryStats;
		hard?: CategoryStats;
	}>
): string {
	if (!statsByCategory || Object.keys(statsByCategory).length === 0) {
		// No history, return random category
		const categories = ["wordle", "riddle", "trivia", "mastermind", "sequencing", "quickMath", "wordChain", "alias", "zip", "futoshiki", "magicSquare", "hidato", "sudoku"];
		return categories[Math.floor(Math.random() * categories.length)];
	}

	// Find category with most completions across all difficulties
	let maxCompletions = 0;
	let favoriteCategory = "quickMath"; // default

	Object.entries(statsByCategory).forEach(([category, categoryData]) => {
		// Sum completions across all difficulties for this category
		let totalCompletions = 0;
		["easy", "medium", "hard"].forEach((diff) => {
			const diffStats = categoryData[diff as "easy" | "medium" | "hard"];
			if (diffStats && typeof diffStats.completed === "number") {
				totalCompletions += diffStats.completed;
			}
		});

		if (totalCompletions > maxCompletions) {
			maxCompletions = totalCompletions;
			favoriteCategory = category;
		}
	});

	return favoriteCategory;
}

// Get user's preferred difficulty based on completion stats
// Now looks at all categories to find most played difficulty
function getPreferredDifficulty(
	statsByCategory?: Record<string, {
		attempted?: number;
		skipped?: number;
		easy?: CategoryStats;
		medium?: CategoryStats;
		hard?: CategoryStats;
	}>
): number {
	if (!statsByCategory || Object.keys(statsByCategory).length === 0) {
		return 1; // Default to easy (1)
	}

	// Aggregate completions by difficulty across all categories
	const difficultyTotals: Record<string, number> = {
		easy: 0,
		medium: 0,
		hard: 0,
	};

	Object.values(statsByCategory).forEach((categoryData) => {
		["easy", "medium", "hard"].forEach((diff) => {
			const diffStats = categoryData[diff as "easy" | "medium" | "hard"];
			if (diffStats && typeof diffStats.completed === "number") {
				difficultyTotals[diff] = (difficultyTotals[diff] || 0) + diffStats.completed;
			}
		});
	});

	// Find difficulty with most completions
	let maxCompletions = 0;
	let preferredDifficulty = 1; // default to easy

	if (difficultyTotals.easy > maxCompletions) {
		maxCompletions = difficultyTotals.easy;
		preferredDifficulty = 1;
	}
	if (difficultyTotals.medium > maxCompletions) {
		maxCompletions = difficultyTotals.medium;
		preferredDifficulty = 2;
	}
	if (difficultyTotals.hard > maxCompletions) {
		maxCompletions = difficultyTotals.hard;
		preferredDifficulty = 3;
	}

	return preferredDifficulty;
}

// Enhanced recommendation function using mathematical scoring with time decay
export function getScoredRecommendations(
	availableGames: Puzzle[],
	userData: UserData | null,
	completedGameIds: Set<string> = new Set(),
	batchSize: number = 15
): Puzzle[] {
	if (availableGames.length === 0) return [];
	if (availableGames.length <= batchSize) {
		return shuffleArray(availableGames);
	}

	// Pre-calculate days since last play for efficiency
	let daysSinceLastPlay: number | undefined = undefined;
	if (userData?.lastPlayedAt) {
		const lastPlayedDate = parseFirestoreTimestamp(userData.lastPlayedAt);
		if (lastPlayedDate) {
			const now = new Date();
			daysSinceLastPlay = Math.floor(
				(now.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24)
			);
		}
	}

	// Calculate score for each game
	const scoredGames = availableGames.map((game) => ({
		game,
		score: calculateGameScore(game, userData, completedGameIds),
	}));

	// Sort by score (highest first)
	scoredGames.sort((a, b) => b.score - a.score);

	// Take top games, but add some randomness to avoid always same order
	const topCount = Math.min(batchSize * 2, scoredGames.length);
	const topGames = scoredGames.slice(0, topCount);

	// Apply soft randomization: shuffle within score ranges
	const scoreRanges: Puzzle[][] = [];
	let currentRange: Puzzle[] = [];
	let lastScore = -1;

	topGames.forEach(({ game, score }) => {
		// Group games with similar scores (within 0.1)
		if (lastScore === -1 || Math.abs(score - lastScore) < 0.1) {
			currentRange.push(game);
		} else {
			if (currentRange.length > 0) {
				scoreRanges.push([...currentRange]);
			}
			currentRange = [game];
		}
		lastScore = score;
	});
	if (currentRange.length > 0) {
		scoreRanges.push(currentRange);
	}

	// Shuffle within each score range, then combine
	const shuffledRanges = scoreRanges.map((range) => shuffleArray(range));
	const finalGames: Puzzle[] = [];
	for (let i = 0; i < Math.max(...shuffledRanges.map(r => r.length)); i++) {
		shuffledRanges.forEach((range) => {
			if (range[i]) finalGames.push(range[i]);
		});
	}

	return finalGames.slice(0, batchSize);
}

// Hybrid recommendation: combines scoring with exploration
export function getHybridRecommendations(
	availableGames: Puzzle[],
	userData: UserData | null,
	completedGameIds: Set<string> = new Set(),
	batchSize: number = 15,
	explorationRatio: number = 0.25 // 25% exploration, 75% personalized
): Puzzle[] {
	if (availableGames.length === 0) return [];
	if (availableGames.length <= batchSize) {
		return shuffleArray(availableGames);
	}

	// Get scored recommendations (personalized with time decay)
	const personalized = getScoredRecommendations(
		availableGames,
		userData,
		completedGameIds,
		Math.floor(batchSize * (1 - explorationRatio))
	);

	// Get exploration games (new categories, not completed)
	const availableForExploration = availableGames.filter(
		(game) => !completedGameIds.has(game.id)
	);
	
	// Find categories user hasn't played much
	const categoryPlayCounts: Record<string, number> = {};
	if (userData?.statsByCategory) {
		Object.entries(userData.statsByCategory).forEach(([cat, data]) => {
			categoryPlayCounts[cat] = data.attempted || 0;
		});
	}

	// Prefer games from categories with low play count
	const explorationGames = availableForExploration
		.map((game) => ({
			game,
			playCount: categoryPlayCounts[game.type] || 0,
		}))
		.sort((a, b) => a.playCount - b.playCount)
		.map((item) => item.game);

	const explorationCount = batchSize - personalized.length;
	const selectedExploration = shuffleArray(explorationGames).slice(0, explorationCount);

	// Combine and shuffle
	return shuffleArray([...personalized, ...selectedExploration]);
}

// Simple, fast recommendation function (backward compatibility)
// 67% preferred games (user's favorite category + difficulty)
// 33% random exploration games (other categories, easy/medium)
// Now uses hybrid recommendations internally
export function getSimpleRecommendations(
	availableGames: Puzzle[],
	userData: UserData | null,
	batchSize: number = 15
): Puzzle[] {
	// Use hybrid recommendations as default (33% exploration)
	return getHybridRecommendations(availableGames, userData, new Set(), batchSize, 0.33);
}

// Interleave games by type for visual variety
// Takes games and arranges them so types alternate: QM → W → WC → R → QM → W ...
export function interleaveGamesByType(games: Puzzle[]): Puzzle[] {

	// Group by type
	const byType: Record<string, Puzzle[]> = {
		quickMath: [],
		wordle: [],
		wordChain: [],
		riddle: [],
		trivia: [],
		mastermind: [],
		sequencing: [],
		alias: [],
		zip: [],
		futoshiki: [],
		magicSquare: [],
		hidato: [],
		sudoku: [],
	};

	games.forEach((game) => {
		if (byType[game.type]) {
			byType[game.type].push(game);
		}
	});

	// Interleave: take 1 from each type in rotation
	const interleaved: Puzzle[] = [];
	const types = ["quickMath", "wordle", "wordChain", "riddle", "trivia", "mastermind", "sequencing", "alias", "zip", "futoshiki", "magicSquare", "hidato", "sudoku"];
	const maxLength = Math.max(...Object.values(byType).map((arr) => arr.length));

	for (let i = 0; i < maxLength; i++) {
		for (const type of types) {
			if (byType[type][i]) {
				interleaved.push(byType[type][i]);
			}
		}
	}

	return interleaved;
}

