/**
 * testGames.ts — Phase 3 simulator test configs.
 * Covers all 13 scene kinds.
 */

import type { CustomPuzzleGame } from "../config/customPuzzleGame";

// ─── 1. Simple MCQ ────────────────────────────────────────────────────────────
export const simpleMCQ: CustomPuzzleGame = {
	id: "test-simple-mcq",
	meta: { title: "Capital Cities", description: "Name the capital of France.", difficulty: 1 },
	variables: [],
	startSceneId: "q1",
	scenes: [
		{
			id: "q1",
			content: {
				kind: "MCQ",
				question: "What is the capital of France?",
				choices: [
					{ id: "a", label: "Paris" },
					{ id: "b", label: "Berlin" },
					{ id: "c", label: "Madrid" },
					{ id: "d", label: "Rome" },
				],
				correctId: "a",
			},
		},
	],
	rules: [],
};

// ─── 2. Lives-based MCQ ───────────────────────────────────────────────────────
export const livesMCQ: CustomPuzzleGame = {
	id: "test-lives-mcq",
	meta: { title: "Science Quiz (3 lives)", description: "Three questions. You have 3 lives.", difficulty: 2 },
	variables: [{ id: "lives", name: "Lives", type: "number", initial: 3 }],
	startSceneId: "q1",
	scenes: [
		{
			id: "q1",
			content: {
				kind: "MCQ",
				question: "What is H₂O?",
				choices: [
					{ id: "a", label: "Water" },
					{ id: "b", label: "Oxygen" },
				],
				correctId: "a",
			},
		},
		{
			id: "q2",
			content: {
				kind: "MCQ",
				question: "How many bones in an adult human body?",
				choices: [
					{ id: "a", label: "206" },
					{ id: "b", label: "300" },
				],
				correctId: "a",
			},
		},
		{
			id: "q3",
			content: {
				kind: "MCQ",
				question: "Speed of light (approx)?",
				choices: [
					{ id: "a", label: "300,000 km/s" },
					{ id: "b", label: "150,000 km/s" },
				],
				correctId: "a",
			},
		},
	],
	rules: [
		{
			id: "r-wrong-dec",
			on: "WRONG",
			then: [{ type: "DEC_VAR", variableId: "lives", amount: 1 }],
		},
		{
			id: "r-no-lives",
			on: "WRONG",
			if: [{ variableId: "lives", op: "lte", value: 0 }],
			then: [{ type: "LOSE" }],
		},
	],
};

// ─── 3. Multi-round quiz (INFO + TEXT_INPUT) ─────────────────────────────────
export const multiRoundQuiz: CustomPuzzleGame = {
	id: "test-multi-round",
	meta: { title: "Word Round Quiz", description: "Read the clue, type the answer.", difficulty: 2 },
	variables: [{ id: "score", name: "Score", type: "number", initial: 0 }],
	startSceneId: "clue1",
	scenes: [
		{
			id: "clue1",
			content: { kind: "INFO", text: "The largest planet in our solar system.", subtext: "Round 1", continueLabel: "Answer →" },
		},
		{
			id: "ans1",
			content: { kind: "TEXT_INPUT", prompt: "Name the largest planet:", answer: "Jupiter", caseSensitive: false },
		},
		{
			id: "clue2",
			content: { kind: "INFO", text: "The chemical symbol for Gold.", subtext: "Round 2", continueLabel: "Answer →" },
		},
		{
			id: "ans2",
			content: { kind: "TEXT_INPUT", prompt: "What is the symbol for Gold?", answer: "Au", caseSensitive: false },
		},
	],
	rules: [
		{
			id: "r-correct-score",
			on: "CORRECT",
			then: [{ type: "INC_VAR", variableId: "score", amount: 1 }],
		},
	],
};

// ─── 4. WORD_GUESS (Hangman) ──────────────────────────────────────────────────
export const hangman: CustomPuzzleGame = {
	id: "test-hangman",
	meta: { title: "Hangman", description: "Guess the hidden word, one letter at a time.", difficulty: 2 },
	variables: [],
	startSceneId: "hang1",
	scenes: [
		{
			id: "hang1",
			content: {
				kind: "WORD_GUESS",
				word: "PLANET",
				hint: "Something that orbits a star",
				maxWrongGuesses: 6,
			},
		},
	],
	rules: [],
};

// ─── 5. WORDLE ────────────────────────────────────────────────────────────────
export const wordleGame: CustomPuzzleGame = {
	id: "test-wordle",
	meta: { title: "Wordle", description: "Guess the 5-letter word in 6 tries.", difficulty: 2 },
	variables: [],
	startSceneId: "w1",
	scenes: [
		{
			id: "w1",
			content: {
				kind: "WORDLE",
				word: "CRANE",
				wordLength: 5,
				maxAttempts: 6,
				hint: "A type of bird (or construction machine)",
			},
		},
	],
	rules: [],
};

// ─── 6. MCQ_MULTI ─────────────────────────────────────────────────────────────
export const mcqMultiGame: CustomPuzzleGame = {
	id: "test-mcq-multi",
	meta: { title: "Geography Blitz", description: "5 quick questions, 1 point each.", difficulty: 1 },
	variables: [{ id: "score", name: "Score", type: "number", initial: 0 }],
	startSceneId: "round1",
	scenes: [
		{
			id: "round1",
			content: {
				kind: "MCQ_MULTI",
				pointsPerCorrect: 1,
				questions: [
					{
						question: "Which country has the most natural lakes?",
						choices: [{ id: "a", label: "Canada" }, { id: "b", label: "Russia" }, { id: "c", label: "USA" }],
						correctId: "a",
					},
					{
						question: "What is the longest river in the world?",
						choices: [{ id: "a", label: "Amazon" }, { id: "b", label: "Nile" }, { id: "c", label: "Yangtze" }],
						correctId: "b",
					},
					{
						question: "Which desert is the largest?",
						choices: [{ id: "a", label: "Sahara" }, { id: "b", label: "Gobi" }, { id: "c", label: "Antarctic" }],
						correctId: "c",
					},
				],
			},
		},
	],
	rules: [
		{
			id: "r-correct",
			on: "CORRECT",
			then: [{ type: "INC_VAR", variableId: "score", amount: 1 }],
		},
	],
};

// ─── 7. TEXT_INPUT_MULTI ─────────────────────────────────────────────────────
export const textInputMultiGame: CustomPuzzleGame = {
	id: "test-text-multi",
	meta: { title: "Quick Math", description: "Solve 3 arithmetic problems.", difficulty: 2 },
	variables: [{ id: "score", name: "Score", type: "number", initial: 0 }],
	startSceneId: "math1",
	scenes: [
		{
			id: "math1",
			content: {
				kind: "TEXT_INPUT_MULTI",
				pointsPerCorrect: 1,
				rounds: [
					{ prompt: "7 + 8 = ?", answer: "15" },
					{ prompt: "12 × 3 = ?", answer: "36" },
					{ prompt: "100 ÷ 4 = ?", answer: "25" },
				],
			},
		},
	],
	rules: [
		{
			id: "r-correct",
			on: "CORRECT",
			then: [{ type: "INC_VAR", variableId: "score", amount: 1 }],
		},
	],
};

// ─── 8. SEQUENCE ──────────────────────────────────────────────────────────────
export const sequenceGame: CustomPuzzleGame = {
	id: "test-sequence",
	meta: { title: "Order the Planets", description: "Arrange planets by distance from the sun.", difficulty: 2 },
	variables: [],
	startSceneId: "seq1",
	scenes: [
		{
			id: "seq1",
			content: {
				kind: "SEQUENCE",
				items: ["Jupiter", "Mercury", "Earth", "Mars"],
				solution: [1, 2, 3, 0],
				hint: "Closest to furthest from the Sun",
				rules: ["Mercury is closest to the Sun", "Jupiter is furthest"],
			},
		},
	],
	rules: [],
};

// ─── 9. CATEGORY (Connections style) ─────────────────────────────────────────
export const categoryGame: CustomPuzzleGame = {
	id: "test-category",
	meta: { title: "Connections", description: "Group 8 items into 2 categories of 4.", difficulty: 2 },
	variables: [],
	startSceneId: "cat1",
	scenes: [
		{
			id: "cat1",
			content: {
				kind: "CATEGORY",
				groups: [
					{ id: "fruit", label: "Fruits", color: "#f59e0b" },
					{ id: "planet", label: "Planets", color: "#3b82f6" },
				],
				items: [
					{ id: "i1", label: "Apple", groupId: "fruit" },
					{ id: "i2", label: "Mars", groupId: "planet" },
					{ id: "i3", label: "Banana", groupId: "fruit" },
					{ id: "i4", label: "Venus", groupId: "planet" },
					{ id: "i5", label: "Mango", groupId: "fruit" },
					{ id: "i6", label: "Saturn", groupId: "planet" },
					{ id: "i7", label: "Grape", groupId: "fruit" },
					{ id: "i8", label: "Jupiter", groupId: "planet" },
				],
				maxWrongGuesses: 3,
			},
		},
	],
	rules: [],
};

// ─── 10. NUMBER_GRID (3×3 Magic Square) ──────────────────────────────────────
export const numberGridGame: CustomPuzzleGame = {
	id: "test-number-grid",
	meta: { title: "Magic Square", description: "Fill the grid so every row, column and diagonal sums to 15.", difficulty: 3 },
	variables: [],
	startSceneId: "grid1",
	scenes: [
		{
			id: "grid1",
			content: {
				kind: "NUMBER_GRID",
				size: 3,
				gridType: "magic_square",
				magicConstant: 15,
				// solution: 2 7 6 / 9 5 1 / 4 3 8
				solution: [2, 7, 6, 9, 5, 1, 4, 3, 8],
				// Give the centre cell (index 4 = value 5)
				givens: [{ row: 1, col: 1, value: 5 }],
			},
		},
	],
	rules: [],
};

// ─── 11. PATH ────────────────────────────────────────────────────────────────
export const pathGame: CustomPuzzleGame = {
	id: "test-path",
	meta: { title: "Trail Finder", description: "Tap cells 1 → 2 → 3 → 4 in order.", difficulty: 1 },
	variables: [],
	startSceneId: "path1",
	scenes: [
		{
			id: "path1",
			content: {
				kind: "PATH",
				rows: 3,
				cols: 3,
				cells: [
					{ pos: 0, value: 1 },
					{ pos: 1, value: "" },
					{ pos: 2, value: "" },
					{ pos: 3, value: "" },
					{ pos: 4, value: 2 },
					{ pos: 5, value: "" },
					{ pos: 6, value: "" },
					{ pos: 7, value: 3 },
					{ pos: 8, value: 4 },
				],
				solution: [0, 4, 7, 8],
				givens: [
					{ pos: 0, value: 1 },
					{ pos: 8, value: 4 },
				],
			},
		},
	],
	rules: [],
};

// ─── 12. CODEBREAKER ─────────────────────────────────────────────────────────
export const codebreakerGame: CustomPuzzleGame = {
	id: "test-codebreaker",
	meta: { title: "CodeBreaker", description: "Crack the 4-color code in 6 guesses.", difficulty: 2 },
	variables: [],
	startSceneId: "cb1",
	scenes: [
		{
			id: "cb1",
			content: {
				kind: "CODEBREAKER",
				secretCode: ["red", "blue", "green", "yellow"],
				options: ["red", "blue", "green", "yellow", "purple", "orange"],
				maxGuesses: 6,
			},
		},
	],
	rules: [],
};

// ─── 13. MEMORY ───────────────────────────────────────────────────────────────
export const memoryGame: CustomPuzzleGame = {
	id: "test-memory",
	meta: { title: "Memory Match", description: "Find all matching pairs.", difficulty: 1 },
	variables: [],
	startSceneId: "mem1",
	scenes: [
		{
			id: "mem1",
			content: {
				kind: "MEMORY",
				cols: 4,
				pairs: [
					{ id: "a1", value: "🐶", matchId: "a2" },
					{ id: "a2", value: "🐶", matchId: "a1" },
					{ id: "b1", value: "🐱", matchId: "b2" },
					{ id: "b2", value: "🐱", matchId: "b1" },
					{ id: "c1", value: "🐸", matchId: "c2" },
					{ id: "c2", value: "🐸", matchId: "c1" },
					{ id: "d1", value: "🦊", matchId: "d2" },
					{ id: "d2", value: "🦊", matchId: "d1" },
				],
			},
		},
	],
	rules: [],
};

// ─── All test games ───────────────────────────────────────────────────────────
export const ALL_TEST_GAMES: CustomPuzzleGame[] = [
	simpleMCQ,
	livesMCQ,
	multiRoundQuiz,
	hangman,
	wordleGame,
	mcqMultiGame,
	textInputMultiGame,
	sequenceGame,
	categoryGame,
	numberGridGame,
	pathGame,
	codebreakerGame,
	memoryGame,
];
