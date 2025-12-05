import { PuzzleType } from "./types";

export interface GameInstruction {
	instructions: string[];
	example: string;
}

export const gameInstructions: Record<PuzzleType, GameInstruction> = {
	wordle: {
		instructions: [
			"Guess the hidden word in 5 attempts",
			"Each guess must be a valid word of the correct length",
			"After each guess, tiles change color:",
			"• Green = correct letter in correct position",
			"• Yellow = correct letter in wrong position",
			"• Gray = letter not in the word",
		],
		example:
			"Example: If the word is 'BRAIN' and you guess 'TRAIN', T and R are gray, A and I are yellow, and N is green.",
	},
	quickMath: {
		instructions: [
			"Solve math problems as quickly as possible",
			"Enter the answer for each problem",
			"All problems must be answered correctly to complete",
			"Work through problems in order",
		],
		example:
			"Example: '3 + 5 = ?' Answer: 8. '12 - 4 = ?' Answer: 8. Complete all problems to finish.",
	},
	riddle: {
		instructions: [
			"Read the riddle carefully",
			"Select the correct answer from the multiple choice options",
			"Think about wordplay, logic, and common knowledge",
			"Only one answer is correct",
		],
		example:
			"Example: 'I speak without a mouth and hear without ears. What am I?' Answer: An echo.",
	},
	wordChain: {
		instructions: [
			"Transform the start word into the end word",
			"Change one letter at a time",
			"Each intermediate word must be in the valid words list",
			"Find the shortest path possible",
		],
		example:
			"Example: CAT → BAT → BIT → BOT → COT. Each step changes one letter to form a valid word.",
	},
	alias: {
		instructions: [
			"Read all the cryptic definitions",
			"Find the single word that fits all definitions",
			"Think about words with multiple meanings",
			"All definitions point to the same answer",
		],
		example:
			"Example: Definitions: 'A fruit', 'A color', 'A company'. Answer: Apple (fruit, color, company).",
	},
	zip: {
		instructions: [
			"Connect numbered cells to form a continuous path",
			"Start from the lowest number and end at the highest",
			"Move horizontally or vertically (not diagonally)",
			"Each cell must be visited exactly once",
		],
		example:
			"Example: Start at 1, connect to 2, then 3, 4, 5... until you reach the highest number in a continuous path.",
	},
	futoshiki: {
		instructions: [
			"Fill the grid with numbers 1 to N (where N is grid size)",
			"Each row and column must contain all numbers 1 to N",
			"Respect the inequality signs (< and >) between cells",
			"Some numbers are given to help you start",
		],
		example:
			"Example: In a 4x4 grid, if cell (1,1) > cell (1,2), and cell (1,1) = 3, then cell (1,2) must be 1 or 2.",
	},
	magicSquare: {
		instructions: [
			"Fill the grid so each row, column, and diagonal sums to the magic constant",
			"Use numbers 1 to N² (where N is grid size)",
			"Each number can only be used once",
			"Some numbers are given to help you start",
		],
		example:
			"Example: In a 3x3 magic square, all rows, columns, and diagonals sum to 15. Numbers 1-9 are used exactly once.",
	},
	hidato: {
		instructions: [
			"Fill the grid with consecutive numbers",
			"Start from the given start number and end at the given end number",
			"Numbers must be adjacent (horizontally, vertically, or diagonally)",
			"Some numbers are given to help you find the path",
		],
		example:
			"Example: Start at 1, place 2 adjacent to it, then 3 adjacent to 2, continuing until you reach the end number.",
	},
	sudoku: {
		instructions: [
			"Fill the 9x9 grid with digits 1-9",
			"Each row must contain all digits 1-9",
			"Each column must contain all digits 1-9",
			"Each 3x3 box must contain all digits 1-9",
		],
		example:
			"Example: If a row has 1, 2, 3, 4, 5, 6, 7, 8, then the missing number is 9. Apply this logic to rows, columns, and boxes.",
	},
	trivia: {
		instructions: [
			"Answer multiple choice questions correctly",
			"Read each question carefully",
			"Select the best answer from the options",
			"Score is based on correct answers",
		],
		example:
			"Example: 'What is the capital of France?' Options: London, Berlin, Paris, Madrid. Answer: Paris.",
	},
	mastermind: {
		instructions: [
			"Guess the secret color code",
			"Select colors for each position in your guess",
			"After submitting, you'll see feedback:",
			"• Black peg = correct color in correct position",
			"• White peg = correct color in wrong position",
			"• No peg = color not in code",
			"Use feedback to refine your guesses",
		],
		example:
			"Example: If secret code is [Red, Blue, Green, Yellow] and you guess [Red, Green, Blue, Yellow], you get 2 black pegs (Red and Yellow in correct positions) and 2 white pegs (Blue and Green are in code but wrong positions).",
	},
	sequencing: {
		instructions: [
			"Place entities in the correct order based on rules",
			"Read all rules carefully",
			"Each rule gives you a constraint about entity positions",
			"All rules must be satisfied in the final arrangement",
		],
		example:
			"Example: Rule: 'Alice is before Bob' means Alice comes before Bob in the sequence. Rule: 'Bob is 2nd' means Bob is in position 2. Combine all rules to find the correct order.",
	},
};

export const getDifficultyLabel = (difficulty: number): string => {
	switch (difficulty) {
		case 1:
			return "Easy";
		case 2:
			return "Medium";
		case 3:
			return "Hard";
		default:
			return "Unknown";
	}
};

export const getDifficultyColor = (difficulty: number): string => {
	switch (difficulty) {
		case 1:
			return "#4CAF50"; // Green
		case 2:
			return "#FFD54F"; // Yellow/Orange
		case 3:
			return "#FF5252"; // Red
		default:
			return "#B0B0B0"; // Gray
	}
};


