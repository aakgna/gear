export const gameInstructions = {
	wordform: {
		instructions: [
			"Guess the hidden word in 5 tries",
			"Each guess must be a real word with the correct number of letters",
			"After each guess, tiles change color:",
			"• Green = correct letter in the correct spot",
			"• Yellow = correct letter in the wrong spot",
			"• Gray = letter is not in the word",
			"Use the colors to figure out the word",
		],
		example:
			"Example: If the word is 'BRAIN' and you guess 'TRAIN', T and R are gray, A and I are yellow, and N is green.",
	},

	quickMath: {
		instructions: [
			"Solve the math problems one by one",
			"Type the correct answer for each problem",
			"You must answer all problems correctly to finish",
			"Problems must be solved in order",
		],
		example:
			"Example: '3 + 5 = ?' Answer: 8. '12 - 4 = ?' Answer: 8. Complete all problems to finish.",
	},

	riddle: {
		instructions: [
			"Read the riddle carefully",
			"Choose the answer that best fits the riddle",
			"Only one answer is correct",
			"Think about logic, wordplay, or common knowledge",
		],
		example:
			"Example: 'I speak without a mouth and hear without ears. What am I?' Answer: An echo.",
	},

	wordChain: {
		instructions: [
			"Change the start word into the end word",
			"Change only one letter at a time",
			"Every word you use must be a real word",
			"Keep changing letters until you reach the final word",
		],
		example:
			"Example: CAT → BAT → BIT → BOT → COT. Each step changes one letter to form a valid word.",
	},

	inference: {
		instructions: [
			"Read all the clues",
			"Find one word that fits every clue",
			"Each clue describes a different meaning of the same word",
			"When one word matches all clues, you win",
		],
		example:
			"Example: Definitions: 'A fruit', 'A color', 'A company'. Answer: Apple (fruit, color, company).",
	},

	maze: {
		instructions: [
			"Connect the numbered cells in order",
			"Start at the smallest number and go to the largest",
			"Move only up, down, left, or right",
			"Every cell must be used once",
		],
		example:
			"Example: Start at 1, connect to 2, then 3, 4, 5... until you reach the highest number in a continuous path.",
	},

	futoshiki: {
		instructions: [
			"Fill the grid using the numbers shown for the puzzle",
			"Each number can appear only once in each row and column",
			"Follow the < and > signs between cells",
			"Use the given numbers to help fill in the rest",
		],
		example:
			"Example: In a 4x4 grid, if cell (1,1) > cell (1,2), and cell (1,1) = 3, then cell (1,2) must be 1 or 2.",
	},

	magicSquare: {
		instructions: [
			"Fill the grid using all the numbers shown for the puzzle",
			"Each number can only be used once",
			"Every row, column, and diagonal must add up to the same total",
			"Use the given numbers to help complete the grid",
		],
		example:
			"Example: In a 3x3 magic square, all rows, columns, and diagonals sum to 15. Numbers 1-9 are used exactly once.",
	},

	trailfinder: {
		instructions: [
			"Place numbers in order starting from the first number shown",
			"Each number must touch the next one (including diagonals)",
			"Continue placing numbers until you reach the final number",
			"Use the given numbers to find the correct path",
		],
		example:
			"Example: Start at 1, place 2 adjacent to it, then 3 adjacent to 2, continuing until you reach the end number.",
	},

	sudoku: {
		instructions: [
			"Fill the grid using numbers 1 through 9",
			"Each row must contain every number once",
			"Each column must contain every number once",
			"Each 3x3 box must contain every number once",
		],
		example:
			"Example: If a row has 1, 2, 3, 4, 5, 6, 7, 8, then the missing number is 9. Apply this logic to rows, columns, and boxes.",
	},

	trivia: {
		instructions: [
			"Read the question carefully",
			"Select the correct answer from the choices",
			"Your score is based on how many you get right",
		],
		example:
			"Example: 'What is the capital of France?' Options: London, Berlin, Paris, Madrid. Answer: Paris.",
	},

	codebreaker: {
		instructions: [
			"Guess the hidden color code",
			"Choose a color for each position in your guess",
			"Duplicate colors are allowed",
			"After each guess, colors in the correct position will be highlighted",
			"Use the highlights to figure out the full code",
		],
		example:
			"Example: If the secret code is [Red, Blue, Green, Yellow] and you guess [Red, Green, Blue, Yellow], Red and Yellow will be highlighted because they are in the correct positions.",
	},

	sequencing: {
		instructions: [
			"Read all the rules carefully",
			"Each rule tells you how items must be ordered",
			"Arrange the items so all rules are satisfied",
			"When every rule works, the sequence is correct",
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


