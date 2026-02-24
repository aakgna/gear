/**
 * Custom Puzzle Game — full engine type definitions.
 *
 * A CustomPuzzleGame is composed of:
 *   variables  — named values that persist throughout the game (score, lives, etc.)
 *   scenes     — discrete states, each with a typed content kind
 *   rules      — when/if/then logic that drives transitions and state changes
 *   systems    — optional global systems (timer)
 *
 * The "kind" field on each scene is the discriminant. The runtime reads the kind
 * and knows exactly how to render, accept input, and evaluate correctness for
 * that scene — no arbitrary code execution, all behaviour is pre-built.
 */

// ─── Variables ────────────────────────────────────────────────────────────────

export type VariableType = "number" | "boolean" | "string" | "number[]" | "string[]";

export interface GameVariable {
	/** Unique id referenced in rules, e.g. "lives", "score", "round" */
	id: string;
	/** Human-readable label shown in creator and optionally in-game */
	name: string;
	type: VariableType;
	initial: number | boolean | string | number[] | string[];
}

// ─── Scene kinds ──────────────────────────────────────────────────────────────
// Each kind bundles display + input + mechanic into one coherent unit.
// Adding a new kind = add one type here + one renderer in sceneRenderer.tsx.

/** Single question with 2–4 tappable choices. Riddle / Inference style. */
export interface MCQScene {
	kind: "MCQ";
	question: string;
	choices: Array<{ id: string; label: string }>;
	correctId: string;
	hint?: string;
}

/** Multiple MCQ questions played one at a time. Trivia style. */
export interface MCQMultiScene {
	kind: "MCQ_MULTI";
	questions: Array<{
		question: string;
		choices: Array<{ id: string; label: string }>;
		correctId: string;
		hint?: string;
	}>;
	pointsPerCorrect: number;
}

/** Text prompt + free-text answer. WordForm style. */
export interface TextInputScene {
	kind: "TEXT_INPUT";
	prompt: string;
	answer: string;
	hint?: string;
	caseSensitive?: boolean;
}

/** Multiple text-input rounds played in sequence. QuickMath style. */
export interface TextInputMultiScene {
	kind: "TEXT_INPUT_MULTI";
	rounds: Array<{
		prompt: string;
		answer: string;
		hint?: string;
	}>;
	pointsPerCorrect: number;
	timeLimitSeconds?: number;
}

/** Guess letters one at a time to reveal a hidden word. Hangman style. */
export interface WordGuessScene {
	kind: "WORD_GUESS";
	/** Secret word in uppercase, letters only */
	word: string;
	/** Category hint shown above the slots, e.g. "Animal" */
	hint?: string;
	maxWrongGuesses: number;
}

/** Guess a word in N attempts with green / yellow / gray feedback. Wordle style. */
export interface WordleScene {
	kind: "WORDLE";
	/** Secret word in uppercase */
	word: string;
	wordLength: number;
	maxAttempts: number;
	hint?: string;
}

/** Drag items into the correct order. Sequencing style. */
export interface SequenceScene {
	kind: "SEQUENCE";
	items: string[];
	/** Correct order expressed as indices into items[], e.g. [2,0,1] */
	solution: number[];
	/** Optional clue rules shown to the player, e.g. "A comes before B" */
	rules?: string[];
	hint?: string;
}

/** Group items into labelled categories. Connections style. */
export interface CategoryScene {
	kind: "CATEGORY";
	items: Array<{ id: string; label: string; groupId: string }>;
	groups: Array<{ id: string; label: string; color?: string }>;
	/** How many wrong submissions allowed before game over (omit = unlimited) */
	maxWrongGuesses?: number;
}

/** Fill a number grid according to constraints. Sudoku / MagicSquare / Futoshiki style. */
export interface NumberGridScene {
	kind: "NUMBER_GRID";
	size: number;
	solution: number[];
	givens: Array<{ row: number; col: number; value: number }>;
	/** Inequality constraints between adjacent cells (Futoshiki) */
	inequalities?: Array<{
		row1: number;
		col1: number;
		row2: number;
		col2: number;
		operator: "<" | ">";
	}>;
	/** Drives extra validation in the mechanic (e.g. magic constant check) */
	gridType: "free" | "magic_square" | "futoshiki" | "sudoku";
	/** Magic constant for magic_square grids */
	magicConstant?: number;
}

/** Tap cells to trace a numbered path through a grid. Maze / TrailFinder style. */
export interface PathScene {
	kind: "PATH";
	rows: number;
	cols: number;
	cells: Array<{ pos: number; value: number | string }>;
	/** Correct path as ordered array of grid positions */
	solution: number[];
	givens?: Array<{ pos: number; value: number | string }>;
}

/** Guess a hidden sequence with exact / present feedback. CodeBreaker style. */
export interface CodeBreakerScene {
	kind: "CODEBREAKER";
	secretCode: string[];
	/** All available options the player can choose from */
	options: string[];
	maxGuesses: number;
}

/** Flip cards to find matching pairs. Memory style. */
export interface MemoryScene {
	kind: "MEMORY";
	pairs: Array<{ id: string; value: string; matchId: string }>;
	cols: number;
}

/** Display-only scene. Player reads and taps to continue. */
export interface InfoScene {
	kind: "INFO";
	text: string;
	subtext?: string;
	continueLabel?: string;
}

// ─── Visual theme presets for board-based scenes ──────────────────────────────
// Applied by the renderer — no custom art needed, just coordinated palettes.
export type BoardTheme =
	| "cornfield"
	| "dungeon"
	| "space"
	| "underwater"
	| "forest"
	| "neon"
	| "minimal";

// ─── New scene kinds ──────────────────────────────────────────────────────────

/** Classic black/white grid with numbered across + down clues. Crossword style. */
export interface CrosswordScene {
	kind: "CROSSWORD";
	rows: number;
	cols: number;
	/** Flat array of cells. black:true = blocked cell. */
	cells: Array<{
		row: number;
		col: number;
		black: boolean;
		number?: number;
		answer?: string; // single letter at this cell
	}>;
	clues: {
		across: Array<{ number: number; clue: string; answer: string; row: number; col: number }>;
		down:   Array<{ number: number; clue: string; answer: string; row: number; col: number }>;
	};
	hint?: string;
}

/** Letter grid with a word list to find by dragging. Word Search style. */
export interface WordSearchScene {
	kind: "WORD_SEARCH";
	rows: number;
	cols: number;
	/** 2D grid of uppercase letters */
	grid: string[][];
	words: string[];
	/** Each word's cell path for validation */
	solutions: Array<{
		word: string;
		cells: Array<{ row: number; col: number }>;
	}>;
	hint?: string;
}

/** Grid with wall data — actual maze with paths, start/end, optional theme. */
export interface MazeScene {
	kind: "MAZE";
	rows: number;
	cols: number;
	/** For each cell, which sides have walls */
	cells: Array<{
		row: number;
		col: number;
		walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
	}>;
	start: { row: number; col: number };
	end:   { row: number; col: number };
	theme?: BoardTheme;
	hint?: string;
}

/** Hexagonal letter arrangement — tap letters to build words. Spelling Bee style. */
export interface SpellingBeeScene {
	kind: "SPELLING_BEE";
	centerLetter: string;
	outerLetters: string[]; // exactly 6
	validWords: string[];
	/** Minimum number of words needed to win */
	wordsToWin: number;
	hint?: string;
}

/** Rectangular letter grid — connect adjacent letters to form words. Boggle/Strands style. */
export interface LetterGridScene {
	kind: "LETTER_GRID";
	rows: number;
	cols: number;
	grid: string[][];
	words: string[];
	solutions: Array<{
		word: string;
		cells: Array<{ row: number; col: number }>;
	}>;
	hint?: string;
}

/** Grid with row/col number clues — fill cells to reveal a picture. Picross/Nonogram style. */
export interface NonogramScene {
	kind: "NONOGRAM";
	rows: number;
	cols: number;
	/** Clue groups per row, e.g. [[3],[1,1],[5]] */
	rowClues: number[][];
	colClues: number[][];
	/** Flat solution array — true = filled, indexed [row * cols + col] */
	solution: boolean[];
	theme?: BoardTheme;
	hint?: string;
}

/** Colored dots on a grid — draw paths to connect matching pairs. Flow Free style. */
export interface FlowScene {
	kind: "FLOW";
	rows: number;
	cols: number;
	dots: Array<{ id: string; color: string; row: number; col: number }>;
	/** Solution paths per color pair */
	solution: Array<{
		id: string;
		path: Array<{ row: number; col: number }>;
	}>;
	theme?: BoardTheme;
	hint?: string;
}

/** Numbered tiles on a grid — slide into the empty space to solve. 15-Puzzle style. */
export interface SlidingPuzzleScene {
	kind: "SLIDING_PUZZLE";
	/** 3 = 8-puzzle (3x3), 4 = 15-puzzle (4x4) */
	size: number;
	/** Flat array of tile values. 0 = empty space. */
	initial: number[];
	theme?: BoardTheme;
	hint?: string;
}

/** Category deduction table — mark yes/no for each combination using clues. Logic Grid style. */
export interface LogicGridScene {
	kind: "LOGIC_GRID";
	/** e.g. [{id:"people", label:"People", items:["Alice","Bob","Carol"]}, ...] */
	categories: Array<{ id: string; label: string; items: string[] }>;
	clues: string[];
	/** Flat solution map: entity → {categoryId: value} for each non-primary category */
	solution: Array<Record<string, string>>;
	hint?: string;
}

/** Hidden grid — reveal cells, avoid mines, flag suspects. Minesweeper style. */
export interface MinesweeperScene {
	kind: "MINESWEEPER";
	rows: number;
	cols: number;
	mines: Array<{ row: number; col: number }>;
	hint?: string;
}

/** Numbered tiles — swipe to merge matching values. 2048 style. */
export interface MergeGridScene {
	kind: "MERGE_GRID";
	size: number; // usually 4
	/** Initial tile layout — flat array, 0 = empty */
	initial: number[];
	/** Score/tile value the player needs to reach to win */
	target: number;
	theme?: BoardTheme;
	hint?: string;
}

export type SceneContent =
	| MCQScene
	| MCQMultiScene
	| TextInputScene
	| TextInputMultiScene
	| WordGuessScene
	| WordleScene
	| SequenceScene
	| CategoryScene
	| NumberGridScene
	| PathScene
	| CodeBreakerScene
	| MemoryScene
	| InfoScene
	| CrosswordScene
	| WordSearchScene
	| MazeScene
	| SpellingBeeScene
	| LetterGridScene
	| NonogramScene
	| FlowScene
	| SlidingPuzzleScene
	| LogicGridScene
	| MinesweeperScene
	| MergeGridScene;

export interface GameScene {
	id: string;
	content: SceneContent;
}

// ─── Rules ────────────────────────────────────────────────────────────────────

/**
 * Events the rule engine listens for.
 *
 * GAME_START      fires once when the game is first loaded
 * SCENE_ENTER     fires each time a scene becomes active
 * CORRECT         player answered / solved correctly in the current scene
 * WRONG           player answered / solved incorrectly
 * SCENE_COMPLETE  the scene has been fully resolved (all rounds done, board filled, etc.)
 * TIMER_END       the global or per-scene timer expired
 * VARIABLE_CHANGE a variable value changed (use with an if-condition to react)
 */
export type RuleEvent =
	| "GAME_START"
	| "SCENE_ENTER"
	| "CORRECT"
	| "WRONG"
	| "SCENE_COMPLETE"
	| "TIMER_END"
	| "VARIABLE_CHANGE";

export type ConditionOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

/** A single condition. Multiple conditions in a rule are evaluated as AND. */
export interface RuleCondition {
	variableId: string;
	op: ConditionOp;
	value: number | string | boolean;
}

export type RuleAction =
	| { type: "SET_VAR"; variableId: string; value: number | string | boolean }
	| { type: "INC_VAR"; variableId: string; amount: number }
	| { type: "DEC_VAR"; variableId: string; amount: number }
	| { type: "APPEND_VAR"; variableId: string; value: number | string }
	| { type: "GO_TO"; sceneId: string }
	| { type: "WIN" }
	| { type: "LOSE" };

export interface GameRule {
	id: string;
	/** The event that triggers evaluation of this rule */
	on: RuleEvent;
	/** Scope this rule to one scene. Omit to apply in any scene. */
	sceneId?: string;
	/** All conditions must pass (AND). Omit to always fire on the event. */
	if?: RuleCondition[];
	then: RuleAction[];
}

// ─── Systems ──────────────────────────────────────────────────────────────────

export interface GameSystems {
	timer?: {
		/** Total seconds for the game or per-scene countdown */
		seconds: number;
		/** true = reset timer each time a new scene is entered */
		perScene?: boolean;
	};
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface GameMeta {
	title: string;
	description?: string;
	tags?: string[];
	/** 1 = easy, 2 = medium, 3 = hard */
	difficulty: 1 | 2 | 3;
	instructions?: string[];
}

// ─── Root type ────────────────────────────────────────────────────────────────

export interface CustomPuzzleGame {
	id: string;
	meta: GameMeta;
	variables: GameVariable[];
	scenes: GameScene[];
	rules: GameRule[];
	startSceneId: string;
	systems?: GameSystems;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All scene kind strings — useful for type guards and creator dropdowns */
export const SCENE_KINDS = [
	"MCQ",
	"MCQ_MULTI",
	"TEXT_INPUT",
	"TEXT_INPUT_MULTI",
	"WORD_GUESS",
	"WORDLE",
	"SEQUENCE",
	"CATEGORY",
	"NUMBER_GRID",
	"PATH",
	"CODEBREAKER",
	"MEMORY",
	"INFO",
	"CROSSWORD",
	"WORD_SEARCH",
	"MAZE",
	"SPELLING_BEE",
	"LETTER_GRID",
	"NONOGRAM",
	"FLOW",
	"SLIDING_PUZZLE",
	"LOGIC_GRID",
	"MINESWEEPER",
	"MERGE_GRID",
] as const;

export type SceneKind = (typeof SCENE_KINDS)[number];

/** Narrow a SceneContent to a specific kind */
export function isSceneKind<K extends SceneKind>(
	content: SceneContent,
	kind: K
): content is Extract<SceneContent, { kind: K }> {
	return content.kind === kind;
}
