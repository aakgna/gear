/**
 * Game definition types for the dynamic (custom) game runtime.
 * Additive: used only for type "custom" puzzles. Safe to remove if reverting.
 */

export type BoardKind = "none" | "grid" | "freeform" | "list";

export interface NoneBoardDefinition {
	kind: "none";
}

export interface GridBoardDefinition {
	kind: "grid";
	rows: number;
	cols: number;
	cellSize: number;
	/** 4 or 8 direction adjacency */
	adjacency?: "4" | "8";
}

export interface FreeformBoardDefinition {
	kind: "freeform";
	width: number;
	height: number;
	collisionMode?: "none" | "basic";
}

export interface ListBoardDefinition {
	kind: "list";
	numSlots: number;
	dragReorder?: boolean;
	orientation?: "vertical" | "horizontal";
}

export type BoardDefinition =
	| NoneBoardDefinition
	| GridBoardDefinition
	| FreeformBoardDefinition
	| ListBoardDefinition;

export type RuntimeEventType =
	| "GAME_START"
	| "TIMER_TICK"
	| "OBJECT_TAP"
	| "OBJECT_DROP"
	| "SUBMIT"
	| "INPUT_SUBMIT"
	| "ROUND_START"
	| "ROUND_END"
	| "SCORE_CHANGE";

export interface RuntimeEvent {
	type: RuntimeEventType;
	objectId?: string;
	payload?: { dtMs?: number; value?: string };
}

export type ValueRef =
	| { from: "object"; path: string }
	| { from: "state"; path: string }
	| { from: "const"; value: unknown };

export type Condition =
	| { op: "always" }
	| { op: "eq"; a: ValueRef; b: ValueRef }
	| { op: "not"; cond: Condition };

export type Action =
	| { type: "ADD_SCORE"; amount: number }
	| { type: "END_GAME"; result: "win" | "lose" }
	| { type: "SET_STATE"; key: string; value: unknown };

export interface Rule {
	event: RuntimeEventType;
	if?: Condition;
	then: Action[];
}

/** Creator-defined "How to play" instructions (shown in help modal when playing) */
export interface GameInstructions {
	instructions: string[];
	example?: string;
}

export interface GameDefinition {
	id: string;
	title: string;
	description?: string;
	board: BoardDefinition;
	systems: {
		timer?: { seconds: number };
		score?: { start: number; target?: number };
	};
	rules: Rule[];
	/** Creator-defined how to play; shown in GameHeader help when present */
	instructions?: GameInstructions;
	/** Content payload: e.g. { prompt, choices } for MCQ, or words/grid data */
	content?: {
		prompt?: string;
		choices?: Array<{ id: string; label: string }>;
		correctAnswerId?: string;
		[key: string]: unknown;
	};
	/** Win condition type ids from creator (e.g. score, solve_board, survive_timer) */
	winConditions?: string[];
	/** Lose condition type ids from creator (e.g. time_out, lives_zero) */
	loseConditions?: string[];
}
