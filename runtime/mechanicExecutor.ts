/**
 * Mechanic Executor — pre-built game logic operators.
 *
 * All functions are pure: same inputs always produce same outputs.
 * No eval(), no external calls, no side effects.
 * Safe to call from the rule engine on every player action.
 */

// ─── Result types ─────────────────────────────────────────────────────────────

export type LetterResult = "correct" | "present" | "absent";

export interface WordleFeedbackResult {
	letters: LetterResult[];
	isCorrect: boolean;
}

export interface CodebreakerFeedbackResult {
	/** Correct color in correct position */
	exact: number;
	/** Correct color in wrong position */
	present: number;
	isCorrect: boolean;
}

export interface GroupMatchResult {
	/** The matched groupId, or null if no match */
	groupId: string | null;
	isCorrect: boolean;
}

// ─── 1. EXACT_MATCH ──────────────────────────────────────────────────────────
/**
 * Returns true when the player's input matches the expected answer.
 * Case-insensitive and trims whitespace by default.
 */
export function exactMatch(
	input: string,
	answer: string,
	caseSensitive = false
): boolean {
	const a = input.trim();
	const b = answer.trim();
	return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
}

// ─── 2. MATH_EVAL ────────────────────────────────────────────────────────────
/**
 * Safely evaluates simple arithmetic expressions.
 * Supports: integers, decimals, +, -, *, /
 * Does NOT use eval(). Returns null for invalid expressions.
 *
 * Examples:
 *   mathEval("3 + 5")   → 8
 *   mathEval("10 / 2")  → 5
 *   mathEval("234 + 1") → 235
 */
export function mathEval(expression: string): number | null {
	const tokens = expression.trim().split(/\s+/);

	// Simple binary: "num op num"
	if (tokens.length === 3) {
		const a = parseFloat(tokens[0]);
		const op = tokens[1];
		const b = parseFloat(tokens[2]);
		if (isNaN(a) || isNaN(b)) return null;
		switch (op) {
			case "+": return a + b;
			case "-": return a - b;
			case "*": return a * b;
			case "/": return b !== 0 ? a / b : null;
			default: return null;
		}
	}

	// Multi-token expression: left-to-right with no precedence
	// e.g. "2 + 3 + 4" → 9   (not suitable for mixed * and +)
	if (tokens.length >= 3 && tokens.length % 2 === 1) {
		let result = parseFloat(tokens[0]);
		if (isNaN(result)) return null;
		for (let i = 1; i < tokens.length; i += 2) {
			const op = tokens[i];
			const next = parseFloat(tokens[i + 1]);
			if (isNaN(next)) return null;
			switch (op) {
				case "+": result += next; break;
				case "-": result -= next; break;
				case "*": result *= next; break;
				case "/":
					if (next === 0) return null;
					result /= next;
					break;
				default: return null;
			}
		}
		return result;
	}

	return null;
}

// ─── 3. LETTER_POSITIONS ─────────────────────────────────────────────────────
/**
 * Returns all 0-indexed positions where `letter` appears in `word`.
 * Case-insensitive.
 *
 * Example:
 *   letterPositions("L", "HELLO") → [2, 3]
 */
export function letterPositions(letter: string, word: string): number[] {
	const l = letter.toUpperCase();
	const w = word.toUpperCase();
	const positions: number[] = [];
	for (let i = 0; i < w.length; i++) {
		if (w[i] === l) positions.push(i);
	}
	return positions;
}

// ─── 4. CONTAINS_LETTER ──────────────────────────────────────────────────────
/**
 * Returns true if the word contains the letter (case-insensitive).
 */
export function containsLetter(word: string, letter: string): boolean {
	return word.toUpperCase().includes(letter.toUpperCase());
}

// ─── 5. WORDLE_FEEDBACK ──────────────────────────────────────────────────────
/**
 * Produces Wordle-style feedback for a guess against a secret word.
 *
 * Rules (matching official Wordle behaviour):
 *   "correct" — right letter, right position (green)
 *   "present" — right letter, wrong position (yellow) — only if that letter
 *               still has unmatched occurrences in the word
 *   "absent"  — letter not in word, or already accounted for (gray)
 *
 * Example:
 *   wordleFeedback("CRANE", "CARES")
 *   → ["correct","present","present","absent","present"]
 */
export function wordleFeedback(
	guess: string,
	word: string
): WordleFeedbackResult {
	const g = guess.toUpperCase().split("");
	const w = word.toUpperCase().split("");
	const results: LetterResult[] = new Array(g.length).fill("absent");

	// Track which word positions are still available for "present" matching
	const available = [...w];

	// Pass 1: mark "correct" first
	for (let i = 0; i < g.length; i++) {
		if (g[i] === w[i]) {
			results[i] = "correct";
			available[i] = ""; // consumed
		}
	}

	// Pass 2: mark "present"
	for (let i = 0; i < g.length; i++) {
		if (results[i] === "correct") continue;
		const idx = available.indexOf(g[i]);
		if (idx !== -1) {
			results[i] = "present";
			available[idx] = ""; // consumed
		}
	}

	const isCorrect = results.every((r) => r === "correct");
	return { letters: results, isCorrect };
}

// ─── 6. SEQUENCE_CHECK ───────────────────────────────────────────────────────
/**
 * Returns true when the player's arrangement matches the solution exactly.
 * Both arrays contain item indices.
 *
 * Example:
 *   sequenceCheck([2, 0, 1], [2, 0, 1]) → true
 *   sequenceCheck([0, 1, 2], [2, 0, 1]) → false
 */
export function sequenceCheck(
	arrangement: number[],
	solution: number[]
): boolean {
	if (arrangement.length !== solution.length) return false;
	return arrangement.every((v, i) => v === solution[i]);
}

// ─── 7. GROUP_MATCH ──────────────────────────────────────────────────────────
/**
 * Checks whether a set of selected item IDs belongs entirely to one group.
 * Returns the matched groupId on success, null otherwise.
 *
 * Example:
 *   items = [{ id: "a", groupId: "g1" }, { id: "b", groupId: "g1" }, ...]
 *   groupMatch(["a","b"], items, 2) → { groupId: "g1", isCorrect: true }
 */
export function groupMatch(
	selectedIds: string[],
	items: Array<{ id: string; groupId: string }>,
	groupSize: number
): GroupMatchResult {
	if (selectedIds.length !== groupSize) {
		return { groupId: null, isCorrect: false };
	}
	const selected = items.filter((item) => selectedIds.includes(item.id));
	if (selected.length !== groupSize) {
		return { groupId: null, isCorrect: false };
	}
	const firstGroup = selected[0].groupId;
	const allSameGroup = selected.every((item) => item.groupId === firstGroup);
	return {
		groupId: allSameGroup ? firstGroup : null,
		isCorrect: allSameGroup,
	};
}

// ─── 8. PATH_CHECK ───────────────────────────────────────────────────────────
/**
 * Returns true when the player's tapped path matches the solution exactly.
 * Both are arrays of grid positions.
 *
 * Example:
 *   pathCheck([0, 1, 4, 5], [0, 1, 4, 5]) → true
 */
export function pathCheck(path: number[], solution: number[]): boolean {
	if (path.length !== solution.length) return false;
	return path.every((v, i) => v === solution[i]);
}

// ─── 9. ALL_CELLS_CORRECT ────────────────────────────────────────────────────
/**
 * Returns true when every cell in the player's grid matches the solution.
 * `playerGrid` is a flat 1D array (row-major order).
 * `solution` is a flat 1D array of the correct values.
 * Cells with value 0 in the solution are ignored (empty/placeholder cells).
 *
 * Example (3×3):
 *   allCellsCorrect([1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9]) → true
 */
export function allCellsCorrect(
	playerGrid: number[],
	solution: number[]
): boolean {
	if (playerGrid.length !== solution.length) return false;
	return solution.every(
		(val, i) => val === 0 || playerGrid[i] === val
	);
}

// ─── 10. CODEBREAKER_FEEDBACK ────────────────────────────────────────────────
/**
 * Returns exact (right color, right position) and present (right color,
 * wrong position) counts — classic Mastermind / CodeBreaker scoring.
 *
 * Example:
 *   secretCode = ["red","blue","green","yellow"]
 *   guess      = ["red","green","blue","yellow"]
 *   → { exact: 2, present: 2, isCorrect: false }
 */
export function codebreakerFeedback(
	guess: string[],
	secretCode: string[]
): CodebreakerFeedbackResult {
	if (guess.length !== secretCode.length) {
		return { exact: 0, present: 0, isCorrect: false };
	}

	let exact = 0;
	const remainingSecret: string[] = [];
	const remainingGuess: string[] = [];

	// Pass 1: exact matches
	for (let i = 0; i < guess.length; i++) {
		if (guess[i] === secretCode[i]) {
			exact++;
		} else {
			remainingSecret.push(secretCode[i]);
			remainingGuess.push(guess[i]);
		}
	}

	// Pass 2: present matches
	let present = 0;
	const pool = [...remainingSecret];
	for (const color of remainingGuess) {
		const idx = pool.indexOf(color);
		if (idx !== -1) {
			present++;
			pool[idx] = ""; // consumed
		}
	}

	const isCorrect = exact === guess.length;
	return { exact, present, isCorrect };
}

// ─── 11. ANAGRAM_CHECK ───────────────────────────────────────────────────────
/**
 * Returns true when `input` is an anagram of `target`
 * (same letters, any order, case-insensitive).
 *
 * Example:
 *   anagramCheck("LISTEN", "SILENT") → true
 *   anagramCheck("HELLO",  "WORLD")  → false
 */
export function anagramCheck(input: string, target: string): boolean {
	const sort = (s: string) =>
		s.toUpperCase().replace(/\s/g, "").split("").sort().join("");
	return sort(input) === sort(target);
}

// ─── Sanity tests (run once during development, remove before ship) ───────────
/**
 * Call runMechanicSanityTests() from a dev screen or the app entry point
 * to verify every mechanic behaves as expected.
 */
export function runMechanicSanityTests(): void {
	const pass = (label: string, result: boolean) => {
		if (!result) console.error(`[mechanic] FAIL: ${label}`);
		else console.log(`[mechanic] PASS: ${label}`);
	};

	// EXACT_MATCH
	pass("exactMatch basic", exactMatch("hello", "Hello"));
	pass("exactMatch trim", exactMatch("  yes  ", "yes"));
	pass("exactMatch case-sensitive fail", !exactMatch("A", "a", true));

	// MATH_EVAL
	pass("mathEval add", mathEval("3 + 5") === 8);
	pass("mathEval subtract", mathEval("10 - 4") === 6);
	pass("mathEval multiply", mathEval("3 * 7") === 21);
	pass("mathEval divide", mathEval("10 / 2") === 5);
	pass("mathEval multi-token", mathEval("2 + 3 + 4") === 9);
	pass("mathEval invalid returns null", mathEval("abc") === null);

	// LETTER_POSITIONS
	pass("letterPositions found", JSON.stringify(letterPositions("L", "HELLO")) === "[2,3]");
	pass("letterPositions not found", letterPositions("Z", "HELLO").length === 0);

	// CONTAINS_LETTER
	pass("containsLetter true", containsLetter("ELEPHANT", "E"));
	pass("containsLetter false", !containsLetter("CAT", "Z"));

	// WORDLE_FEEDBACK
	const wf = wordleFeedback("CRANE", "CARES");
	pass("wordleFeedback correct first letter", wf.letters[0] === "correct");
	pass("wordleFeedback not solved", !wf.isCorrect);
	const wf2 = wordleFeedback("CARES", "CARES");
	pass("wordleFeedback all correct", wf2.isCorrect);

	// SEQUENCE_CHECK
	pass("sequenceCheck match", sequenceCheck([2, 0, 1], [2, 0, 1]));
	pass("sequenceCheck no match", !sequenceCheck([0, 1, 2], [2, 0, 1]));

	// GROUP_MATCH
	const items = [
		{ id: "a", groupId: "g1" }, { id: "b", groupId: "g1" },
		{ id: "c", groupId: "g2" }, { id: "d", groupId: "g2" },
	];
	pass("groupMatch correct", groupMatch(["a", "b"], items, 2).isCorrect);
	pass("groupMatch wrong", !groupMatch(["a", "c"], items, 2).isCorrect);

	// PATH_CHECK
	pass("pathCheck match", pathCheck([0, 1, 4, 5], [0, 1, 4, 5]));
	pass("pathCheck no match", !pathCheck([0, 1, 2, 3], [0, 1, 4, 5]));

	// ALL_CELLS_CORRECT
	pass("allCellsCorrect match", allCellsCorrect([1, 2, 3], [1, 2, 3]));
	// 0 in the SOLUTION means "don't care" (blank/placeholder cell)
	pass("allCellsCorrect skip zeros in solution", allCellsCorrect([1, 9, 3], [1, 0, 3]));
	pass("allCellsCorrect mismatch", !allCellsCorrect([1, 9, 3], [1, 2, 3]));

	// CODEBREAKER_FEEDBACK
	const cb = codebreakerFeedback(
		["red", "green", "blue", "yellow"],
		["red", "blue", "green", "yellow"]
	);
	pass("codebreakerFeedback exact=2", cb.exact === 2);
	pass("codebreakerFeedback present=2", cb.present === 2);
	pass("codebreakerFeedback not solved", !cb.isCorrect);
	const cb2 = codebreakerFeedback(["red", "blue", "green", "yellow"], ["red", "blue", "green", "yellow"]);
	pass("codebreakerFeedback solved", cb2.isCorrect);

	// ANAGRAM_CHECK
	pass("anagramCheck match", anagramCheck("LISTEN", "SILENT"));
	pass("anagramCheck no match", !anagramCheck("HELLO", "WORLD"));

	console.log("[mechanic] All sanity tests complete.");
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW SCENE KIND MECHANICS
// ─────────────────────────────────────────────────────────────────────────────

// ─── CROSSWORD ────────────────────────────────────────────────────────────────

/**
 * Checks whether a player's letter at a crossword cell matches the answer.
 */
export function crosswordCellCorrect(
	input: string,
	expected: string
): boolean {
	return input.trim().toUpperCase() === expected.trim().toUpperCase();
}

/**
 * Returns true when every non-black cell in the player grid matches the solution.
 * playerGrid is a flat Record<"row_col", string>.
 */
export function crosswordComplete(
	playerGrid: Record<string, string>,
	solution: Array<{ row: number; col: number; answer: string }>
): boolean {
	return solution.every(
		(cell) =>
			(playerGrid[`${cell.row}_${cell.col}`] ?? "").toUpperCase() ===
			cell.answer.toUpperCase()
	);
}

// ─── WORD SEARCH ─────────────────────────────────────────────────────────────

/**
 * Checks whether a sequence of tapped cells matches any valid solution path
 * for the given word (direction-agnostic — path order must match).
 */
export function wordSearchPathValid(
	tappedCells: Array<{ row: number; col: number }>,
	solutions: Array<{ word: string; cells: Array<{ row: number; col: number }> }>
): { found: boolean; word: string | null } {
	for (const sol of solutions) {
		if (sol.cells.length !== tappedCells.length) continue;
		const forward = sol.cells.every(
			(c, i) => c.row === tappedCells[i].row && c.col === tappedCells[i].col
		);
		const backward = sol.cells.every(
			(c, i) =>
				c.row === tappedCells[tappedCells.length - 1 - i].row &&
				c.col === tappedCells[tappedCells.length - 1 - i].col
		);
		if (forward || backward) return { found: true, word: sol.word };
	}
	return { found: false, word: null };
}

// ─── MAZE ─────────────────────────────────────────────────────────────────────

/**
 * Returns true if moving from `current` in `direction` is allowed
 * (i.e. the wall in that direction is absent).
 */
export type Direction = "top" | "right" | "bottom" | "left";

export function mazeMoveAllowed(
	current: { row: number; col: number },
	direction: Direction,
	cells: Array<{
		row: number;
		col: number;
		walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
	}>
): boolean {
	const cell = cells.find(
		(c) => c.row === current.row && c.col === current.col
	);
	if (!cell) return false;
	return !cell.walls[direction];
}

/**
 * Returns the next position after moving in the given direction.
 */
export function mazeNextPosition(
	current: { row: number; col: number },
	direction: Direction
): { row: number; col: number } {
	switch (direction) {
		case "top":    return { row: current.row - 1, col: current.col };
		case "bottom": return { row: current.row + 1, col: current.col };
		case "left":   return { row: current.row, col: current.col - 1 };
		case "right":  return { row: current.row, col: current.col + 1 };
	}
}

// ─── SPELLING BEE ─────────────────────────────────────────────────────────────

/**
 * Returns true if the word is valid:
 * - contains the center letter
 * - uses only the provided letters (center + outer)
 * - is at least 4 characters long
 * - is in the valid word list
 */
export function spellingBeeWordValid(
	word: string,
	centerLetter: string,
	outerLetters: string[],
	validWords: string[]
): { valid: boolean; reason?: string } {
	const upper = word.toUpperCase();
	const allowed = new Set([centerLetter.toUpperCase(), ...outerLetters.map((l) => l.toUpperCase())]);

	if (upper.length < 4)
		return { valid: false, reason: "Too short" };
	if (!upper.includes(centerLetter.toUpperCase()))
		return { valid: false, reason: "Must use center letter" };
	if ([...upper].some((ch) => !allowed.has(ch)))
		return { valid: false, reason: "Invalid letters used" };
	if (!validWords.map((w) => w.toUpperCase()).includes(upper))
		return { valid: false, reason: "Not a valid word" };

	return { valid: true };
}

// ─── LETTER GRID (Boggle-style) ───────────────────────────────────────────────

/**
 * Returns true if every consecutive pair of cells in the path is adjacent
 * (horizontally, vertically, or diagonally) and no cell is reused.
 */
export function letterGridPathAdjacent(
	path: Array<{ row: number; col: number }>
): boolean {
	const seen = new Set<string>();
	for (let i = 0; i < path.length; i++) {
		const key = `${path[i].row}_${path[i].col}`;
		if (seen.has(key)) return false;
		seen.add(key);
		if (i > 0) {
			const dr = Math.abs(path[i].row - path[i - 1].row);
			const dc = Math.abs(path[i].col - path[i - 1].col);
			if (dr > 1 || dc > 1) return false;
		}
	}
	return true;
}

/**
 * Extracts the word formed by reading letters along a path from a 2D grid.
 */
export function letterGridPathWord(
	path: Array<{ row: number; col: number }>,
	grid: string[][]
): string {
	return path.map((p) => grid[p.row]?.[p.col] ?? "").join("").toUpperCase();
}

// ─── NONOGRAM ────────────────────────────────────────────────────────────────

/**
 * Computes the clue groups for a row/column of filled cells.
 * e.g. [true, true, false, true] → [2, 1]
 */
export function nonogramComputeClue(cells: boolean[]): number[] {
	const groups: number[] = [];
	let count = 0;
	for (const filled of cells) {
		if (filled) {
			count++;
		} else if (count > 0) {
			groups.push(count);
			count = 0;
		}
	}
	if (count > 0) groups.push(count);
	return groups;
}

/**
 * Returns true if the player's filled rows/cols match all clues.
 * playerGrid is a flat boolean array indexed [row * cols + col].
 */
export function nonogramComplete(
	playerGrid: boolean[],
	rows: number,
	cols: number,
	rowClues: number[][],
	colClues: number[][]
): boolean {
	for (let r = 0; r < rows; r++) {
		const rowCells = Array.from({ length: cols }, (_, c) => playerGrid[r * cols + c]);
		const computed = nonogramComputeClue(rowCells);
		if (JSON.stringify(computed) !== JSON.stringify(rowClues[r])) return false;
	}
	for (let c = 0; c < cols; c++) {
		const colCells = Array.from({ length: rows }, (_, r) => playerGrid[r * cols + c]);
		const computed = nonogramComputeClue(colCells);
		if (JSON.stringify(computed) !== JSON.stringify(colClues[c])) return false;
	}
	return true;
}

// ─── FLOW ────────────────────────────────────────────────────────────────────

/**
 * Returns true when all flow paths are complete:
 * - each path connects both dots of its color
 * - all cells in the grid are covered
 */
export function flowComplete(
	playerPaths: Array<{ id: string; path: Array<{ row: number; col: number }> }>,
	dots: Array<{ id: string; row: number; col: number }>,
	rows: number,
	cols: number
): boolean {
	const totalCells = rows * cols;
	const coveredCells = new Set<string>();

	for (const pp of playerPaths) {
		if (pp.path.length < 2) return false;
		const dotsForId = dots.filter((d) => d.id === pp.id);
		if (dotsForId.length !== 2) return false;

		const start = pp.path[0];
		const end = pp.path[pp.path.length - 1];
		const [d1, d2] = dotsForId;

		const connectsEndpoints =
			(start.row === d1.row && start.col === d1.col &&
				end.row === d2.row && end.col === d2.col) ||
			(start.row === d2.row && start.col === d2.col &&
				end.row === d1.row && end.col === d1.col);

		if (!connectsEndpoints) return false;
		pp.path.forEach((p) => coveredCells.add(`${p.row}_${p.col}`));
	}

	return coveredCells.size === totalCells;
}

// ─── SLIDING PUZZLE ───────────────────────────────────────────────────────────

/**
 * Returns the new flat tile array after sliding the tile adjacent to the
 * empty space in the given direction, or null if the move is invalid.
 */
export function slidingPuzzleMove(
	grid: number[],
	size: number,
	direction: Direction
): number[] | null {
	const emptyIdx = grid.indexOf(0);
	if (emptyIdx === -1) return null;

	const emptyRow = Math.floor(emptyIdx / size);
	const emptyCol = emptyIdx % size;

	let targetRow = emptyRow;
	let targetCol = emptyCol;

	// The tile that moves INTO the empty space comes from the opposite direction
	switch (direction) {
		case "top":    targetRow = emptyRow + 1; break;
		case "bottom": targetRow = emptyRow - 1; break;
		case "left":   targetCol = emptyCol + 1; break;
		case "right":  targetCol = emptyCol - 1; break;
	}

	if (targetRow < 0 || targetRow >= size || targetCol < 0 || targetCol >= size)
		return null;

	const targetIdx = targetRow * size + targetCol;
	const next = [...grid];
	[next[emptyIdx], next[targetIdx]] = [next[targetIdx], next[emptyIdx]];
	return next;
}

/**
 * Returns true when tiles are in solved order: [1, 2, ..., n-1, 0].
 */
export function slidingPuzzleSolved(grid: number[]): boolean {
	for (let i = 0; i < grid.length - 1; i++) {
		if (grid[i] !== i + 1) return false;
	}
	return grid[grid.length - 1] === 0;
}

// ─── MINESWEEPER ──────────────────────────────────────────────────────────────

/**
 * Pre-computes adjacency numbers for the full board.
 * Returns a flat array where each value is the mine count for that cell
 * (or -1 if the cell itself is a mine).
 */
export function minesweeperBuildBoard(
	rows: number,
	cols: number,
	mines: Array<{ row: number; col: number }>
): number[] {
	const mineSet = new Set(mines.map((m) => `${m.row}_${m.col}`));
	const board: number[] = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (mineSet.has(`${r}_${c}`)) {
				board.push(-1);
				continue;
			}
			let count = 0;
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					if (dr === 0 && dc === 0) continue;
					if (mineSet.has(`${r + dr}_${c + dc}`)) count++;
				}
			}
			board.push(count);
		}
	}
	return board;
}

/**
 * Returns true when all non-mine cells are revealed.
 */
export function minesweeperWon(
	revealed: boolean[],
	board: number[]
): boolean {
	return board.every((val, i) => val === -1 || revealed[i]);
}

// ─── MERGE GRID (2048-style) ──────────────────────────────────────────────────

/**
 * Slides and merges a single row to the left.
 * Returns the new row and the score earned from merges.
 */
function mergeRow(row: number[]): { row: number[]; score: number } {
	const filtered = row.filter((v) => v !== 0);
	let score = 0;
	const merged: number[] = [];
	let i = 0;
	while (i < filtered.length) {
		if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
			const val = filtered[i] * 2;
			merged.push(val);
			score += val;
			i += 2;
		} else {
			merged.push(filtered[i]);
			i++;
		}
	}
	while (merged.length < row.length) merged.push(0);
	return { row: merged, score };
}

/**
 * Applies a swipe move to a 2D merge grid.
 * Returns the new grid and score gained, or null if nothing moved.
 */
export function mergeGridSwipe(
	grid: number[][],
	direction: "left" | "right" | "up" | "down"
): { grid: number[][]; score: number } | null {
	const size = grid.length;
	let totalScore = 0;
	const newGrid = grid.map((r) => [...r]);

	const rotateRight = (g: number[][]): number[][] =>
		g[0].map((_, c) => g.map((row) => row[c]).reverse());
	const rotateLeft = (g: number[][]): number[][] =>
		g[0].map((_, c) => g.map((row) => row[row.length - 1 - c]));

	let working = newGrid;
	if (direction === "right") working = working.map((r) => [...r].reverse());
	if (direction === "up")    working = rotateLeft(working);
	if (direction === "down")  working = rotateRight(working);

	const result = working.map((row) => {
		const { row: merged, score } = mergeRow(row);
		totalScore += score;
		return merged;
	});

	if (direction === "right") result.forEach((r, i) => { result[i] = r.reverse(); });
	if (direction === "up")    { const r = rotateRight(result); result.forEach((_, i) => { result[i] = r[i]; }); }
	if (direction === "down")  { const r = rotateLeft(result);  result.forEach((_, i) => { result[i] = r[i]; }); }

	const changed = result.some((row, r) => row.some((v, c) => v !== grid[r][c]));
	if (!changed) return null;

	return { grid: result, score: totalScore };
}
