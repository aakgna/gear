import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
} from "react-native";
import { SudokuData, GameResult } from "../../config/types";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 40) / 3;

interface SudokuGameProps {
	inputData: SudokuData;
	onComplete: (result: GameResult) => void;
}

const SudokuGame: React.FC<SudokuGameProps> = ({ inputData, onComplete }) => {
	const [grid, setGrid] = useState<number[][]>(
		inputData.grid.map((row) => [...row])
	);
	const [selectedCell, setSelectedCell] = useState<{
		row: number;
		col: number;
	} | null>(null);
	const [startTime] = useState(Date.now());
	const [isComplete, setIsComplete] = useState(false);

	const solution = inputData.solution;
	const gridSize = grid.length;

	const isValidMove = (row: number, col: number, num: number): boolean => {
		// Check row
		for (let c = 0; c < gridSize; c++) {
			if (c !== col && grid[row][c] === num) return false;
		}

		// Check column
		for (let r = 0; r < gridSize; r++) {
			if (r !== row && grid[r][col] === num) return false;
		}

		// Check subgrid (3x3 for 3x3 grid, 4x4 for 4x4 grid)
		const subgridSize = Math.sqrt(gridSize);
		const subgridRow = Math.floor(row / subgridSize) * subgridSize;
		const subgridCol = Math.floor(col / subgridSize) * subgridSize;

		for (let r = subgridRow; r < subgridRow + subgridSize; r++) {
			for (let c = subgridCol; c < subgridCol + subgridSize; c++) {
				if ((r !== row || c !== col) && grid[r][c] === num) return false;
			}
		}

		return true;
	};

	const handleCellPress = (row: number, col: number) => {
		// Don't allow editing pre-filled cells
		if (inputData.grid[row][col] !== 0) return;
		setSelectedCell({ row, col });
	};

	const handleNumberPress = (num: number) => {
		if (!selectedCell) return;

		const { row, col } = selectedCell;

		// Clear cell if pressing the same number
		if (grid[row][col] === num) {
			const newGrid = grid.map((r) => [...r]);
			newGrid[row][col] = 0;
			setGrid(newGrid);
			return;
		}

		// Check if move is valid
		if (isValidMove(row, col, num)) {
			const newGrid = grid.map((r) => [...r]);
			newGrid[row][col] = num;
			setGrid(newGrid);

			// Check if puzzle is complete
			checkCompletion(newGrid);
		}
	};

	const checkCompletion = (currentGrid: number[][]) => {
		// Check if all cells are filled
		const isFilled = currentGrid.every((row) =>
			row.every((cell) => cell !== 0)
		);

		if (!isFilled) return;

		// Check if solution matches
		const isCorrect = currentGrid.every((row, rowIndex) =>
			row.every((cell, colIndex) => cell === solution[rowIndex][colIndex])
		);

		if (isCorrect) {
			setIsComplete(true);
			const timeTaken = Math.floor((Date.now() - startTime) / 1000);
			const accuracy = 100; // For now, assume 100% accuracy if solved

			onComplete({
				puzzleId: `sudoku_${Date.now()}`,
				completed: true,
				timeTaken,
				accuracy,
				completedAt: new Date().toISOString(),
			});
		}
	};

	const getCellStyle = (row: number, col: number) => {
		const isSelected = selectedCell?.row === row && selectedCell?.col === col;
		const isPrefilled = inputData.grid[row][col] !== 0;
		const isCorrect =
			grid[row][col] === solution[row][col] && grid[row][col] !== 0;
		const isIncorrect =
			grid[row][col] !== 0 && grid[row][col] !== solution[row][col];

		let backgroundColor = "#ffffff";
		if (isSelected) backgroundColor = "#e3f2fd";
		if (isIncorrect) backgroundColor = "#ffebee";
		if (isCorrect && !isPrefilled) backgroundColor = "#e8f5e8";

		return [styles.cell, { backgroundColor }];
	};

	const renderNumberPad = () => {
		const numbers = Array.from({ length: gridSize }, (_, i) => i + 1);

		return (
			<View style={styles.numberPad}>
				<Text style={styles.numberPadTitle}>Select Number:</Text>
				<View style={styles.numberGrid}>
					{numbers.map((num) => (
						<TouchableOpacity
							key={num}
							style={styles.numberButton}
							onPress={() => handleNumberPress(num)}
						>
							<Text style={styles.numberButtonText}>{num}</Text>
						</TouchableOpacity>
					))}
				</View>
				{selectedCell && (
					<TouchableOpacity
						style={[styles.numberButton, styles.clearButton]}
						onPress={() =>
							handleNumberPress(grid[selectedCell.row][selectedCell.col])
						}
					>
						<Text style={styles.clearButtonText}>Clear</Text>
					</TouchableOpacity>
				)}
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sudoku</Text>

			{/* Grid */}
			<View style={styles.grid}>
				{grid.map((row, rowIndex) => (
					<View key={rowIndex} style={styles.row}>
						{row.map((cell, colIndex) => (
							<TouchableOpacity
								key={colIndex}
								style={getCellStyle(rowIndex, colIndex)}
								onPress={() => handleCellPress(rowIndex, colIndex)}
							>
								<Text
									style={[
										styles.cellText,
										inputData.grid[rowIndex][colIndex] !== 0 &&
											styles.prefilledText,
									]}
								>
									{cell !== 0 ? cell : ""}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				))}
			</View>

			{/* Number Pad */}
			{renderNumberPad()}

			{/* Completion Status */}
			{isComplete && (
				<View style={styles.status}>
					<Text style={styles.statusText}>🎉 Puzzle Complete!</Text>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		alignItems: "center",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		color: "#212121",
	},
	grid: {
		marginBottom: 20,
	},
	row: {
		flexDirection: "row",
	},
	cell: {
		width: GRID_SIZE,
		height: GRID_SIZE,
		borderWidth: 1,
		borderColor: "#d3d6da",
		alignItems: "center",
		justifyContent: "center",
	},
	cellText: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#212121",
	},
	prefilledText: {
		color: "#1e88e5",
	},
	numberPad: {
		alignItems: "center",
		marginTop: 20,
	},
	numberPadTitle: {
		fontSize: 16,
		marginBottom: 10,
		color: "#212121",
	},
	numberGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		maxWidth: width - 40,
	},
	numberButton: {
		width: 50,
		height: 50,
		backgroundColor: "#1e88e5",
		borderRadius: 25,
		alignItems: "center",
		justifyContent: "center",
		margin: 5,
	},
	numberButtonText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#ffffff",
	},
	clearButton: {
		backgroundColor: "#f44336",
	},
	clearButtonText: {
		color: "#ffffff",
	},
	status: {
		marginTop: 20,
		padding: 15,
		backgroundColor: "#f5f7fa",
		borderRadius: 8,
		alignItems: "center",
	},
	statusText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#212121",
	},
});

export default SudokuGame;
