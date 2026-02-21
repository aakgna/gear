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
