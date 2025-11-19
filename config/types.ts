// Puzzle types
export type PuzzleType =
	| "wordle"
	| "quickMath"
	| "riddle"
	| "wordChain"
	| "alias"
	| "zip";

export interface Puzzle {
	id: string;
	type: PuzzleType;
	data:
		| WordleData
		| QuickMathData
		| RiddleData
		| WordChainData
		| AliasData
		| ZipData;
	difficulty: number;
	createdAt: string;
}

export interface WordleData {
	answer: string; // From Firestore 'qna' field
	hints?: string[];
}

export interface QuickMathData {
	// From Firestore 'questions' and 'answers' arrays
	problems: string[]; // e.g., ["3 + 5", "2 - 4", "234 + 1"]
	answers: string[]; // e.g., ["8", "2", "235"]
	// Optional time limit for the full set
	timeLimitSeconds?: number;
}

export interface RiddleData {
	prompt: string; // From Firestore 'question' field
	answer: string; // From Firestore 'answer' field - can be comma-separated for multiple valid answers
	hint?: string;
}

export interface WordChainData {
	startWord: string; // From Firestore 'startWord' field
	endWord: string; // From Firestore 'endWord' field
	validWords: string[]; // From Firestore 'validWords' array - all valid intermediate words
	minSteps: number; // Minimum steps required
	hint?: string;
}

export interface AliasData {
	definitions: string[]; // Array of cryptic definitions (3-5 items)
	answer: string; // The single word that fits all definitions
	hint?: string;
}

export interface ZipData {
	rows: number;
	cols: number;
	cells: Array<{ pos: number; number: number }>; // Numbered cells with positions
	solution: number[]; // Array of positions in order (the correct path)
}

// Game result types
export interface GameResult {
	puzzleId: string;
	completed: boolean;
	timeTaken: number; // in seconds
	attempts?: number; // for wordle/riddle
	mistakes?: number; // for quickMath - number of incorrect submissions
	accuracy?: number; // for quick math score percentage
	completedAt: string;
	answerRevealed?: boolean; // true if user used "Show Answer" feature
}

// User data types
export interface UserProfile {
	uid: string;
	username?: string;
	email?: string;
	avatar?: string;
	puzzlesSolved: number;
	averageSolveTime: number;
	currentStreak: number;
	lastActive: string;
	createdAt: string;
}

// Game state types
export interface GameState {
	currentPuzzleIndex: number;
	solvedPuzzles: string[];
	skippedPuzzles: string[];
}

// Filter types
export type PuzzleFilter = "all" | "words" | "numbers" | "logic";

// Puzzle completion stats
export interface PuzzleCompletion {
	puzzleId: string;
	userId: string;
	username?: string;
	timeTaken: number; // in seconds
	attempts?: number; // for wordle/riddle - number of tries
	mistakes?: number; // for quickMath - number of incorrect answers before getting all correct
	completedAt: string;
}

export interface PuzzleStats {
	totalCompletions: number;
	averageTime: number;
	fastestTime: number;
	bestAttempts?: number; // for wordle/riddle - lowest number of tries
}
