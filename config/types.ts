// Puzzle types
export type PuzzleType = "wordle" | "quickMath" | "riddle";

export interface Puzzle {
	id: string;
	type: PuzzleType;
	data: WordleData | QuickMathData | RiddleData;
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

// Game result types
export interface GameResult {
	puzzleId: string;
	completed: boolean;
	timeTaken: number; // in seconds
	attempts?: number; // for wordle/riddle
	accuracy?: number; // for quick math score percentage
	completedAt: string;
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
