// Puzzle types
export type PuzzleType =
	| "wordle"
	| "quickMath"
	| "riddle"
	| "wordChain"
	| "alias"
	| "zip"
	| "futoshiki"
	| "magicSquare"
	| "hidato"
	| "sudoku"
	| "trivia"
	| "mastermind"
	| "sequencing";

export interface Puzzle {
	id: string;
	type: PuzzleType;
	data:
		| WordleData
		| QuickMathData
		| RiddleData
		| WordChainData
		| AliasData
		| ZipData
		| FutoshikiData
		| MagicSquareData
		| HidatoData
		| SudokuData
		| TriviaData
		| MastermindData
		| SequencingData;
	difficulty: number;
	createdAt: string;
	username?: string;
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
	answer: string; // From Firestore 'answer' field - the correct answer
	choices: string[]; // MCQ choices (includes correct answer, shuffled)
	hint?: string;
}

export interface WordChainData {
	startWord: string; // From Firestore 'startWord' field
	endWord: string; // From Firestore 'endWord' field
	answer: string[]; // From Firestore 'answer' array - the specific sequence of words from start to end
	minSteps: number; // Minimum steps required
	hint?: string;
}

export interface AliasData {
	definitions: string[]; // Array of cryptic definitions (3-5 items)
	answer: string; // The single word that fits all definitions
	choices: string[]; // MCQ choices (includes correct answer, shuffled)
	hint?: string;
}

export interface ZipData {
	rows: number;
	cols: number;
	cells: Array<{ pos: number; number: number }>; // Numbered cells with positions
	solution: number[]; // Array of positions in order (the correct path)
}

export interface FutoshikiData {
	size: number;
	grid: number[]; // 1D array (flattened 2D grid)
	givens: Array<{ row: number; col: number; value: number }>;
	inequalities: Array<{
		row1: number;
		col1: number;
		row2: number;
		col2: number;
		operator: "<" | ">";
	}>;
}

export interface MagicSquareData {
	size: number;
	grid: number[]; // Flattened 1D array of solution
	magicConstant: number;
	givens: Array<{ row: number; col: number; value: number }>;
}

export interface HidatoData {
	rows: number;
	cols: number;
	startNum: number;
	endNum: number;
	path: Array<{ row: number; col: number; value?: number }>; // Solution path positions (value is optional, can be calculated)
	givens: Array<{ row: number; col: number; value: number }>;
}

export interface SudokuData {
	grid: number[]; // Flattened 1D array of complete solution (81 numbers)
	givens: Array<{ row: number; col: number; value: number }>;
}

export interface TriviaQuestion {
	question: string; // The question text
	answer: string; // The correct answer
	choices: string[]; // Array of 4 choices (includes correct answer, shuffled)
}

export interface TriviaData {
	questions: TriviaQuestion[]; // Array of questions (3 for easy, 4 for medium, 5 for hard)
}

export interface MastermindData {
	secretCode: string[]; // Array of 6 color names
	maxGuesses: number; // Max attempts allowed (12 for easy, 10 for medium, 8 for hard)
}

export interface SequencingRule {
	type: "ordering" | "adjacency" | "fixed" | "separation";
	entity1?: string; // For ordering, adjacency, separation
	entity2?: string; // For ordering, adjacency, separation
	position?: number; // For fixed position rules
	minDistance?: number; // For separation rules
	description: string; // Human-readable rule description
}

export interface SequencingData {
	theme: "people" | "appointments" | "runners";
	numSlots: number; // 4-8 based on difficulty
	entities: string[]; // Entity names (e.g., ["Person A", "Person B", ...] or ["Monday", "Tuesday", ...])
	rules: SequencingRule[];
	solution: number[]; // Array of entity indices in correct order (0-based)
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
