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
	| InfoScene;

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
] as const;

export type SceneKind = (typeof SCENE_KINDS)[number];

/** Narrow a SceneContent to a specific kind */
export function isSceneKind<K extends SceneKind>(
	content: SceneContent,
	kind: K
): content is Extract<SceneContent, { kind: K }> {
	return content.kind === kind;
}
