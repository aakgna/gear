import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Animated,
	ScrollView,
	Dimensions,
} from "react-native";
import { GameResult, SudokuData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
} from "../../constants/DesignSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SudokuGameProps {
	inputData: SudokuData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
}

const SudokuGame: React.FC<SudokuGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	const { grid, givens } = inputData;
	const SIZE = 9; // Sudoku is always 9x9

	// Reconstruct 2D grid from 1D array
	const reconstructGrid = (flatGrid: number[]): number[][] => {
		const grid2D: number[][] = [];
		for (let row = 0; row < SIZE; row++) {
			grid2D[row] = [];
			for (let col = 0; col < SIZE; col++) {
				grid2D[row][col] = flatGrid[row * SIZE + col];
			}
		}
		return grid2D;
	};

	const solutionGrid = reconstructGrid(grid);

	// Initialize user grid with givens
	const initializeUserGrid = (): (number | null)[][] => {
		const userGrid: (number | null)[][] = [];
		for (let row = 0; row < SIZE; row++) {
			userGrid[row] = [];
			for (let col = 0; col < SIZE; col++) {
				userGrid[row][col] = null;
			}
		}
		// Fill in givens
		givens.forEach((given) => {
			userGrid[given.row][given.col] = given.value;
		});
		return userGrid;
	};

	const [userGrid, setUserGrid] = useState<(number | null)[][]>(
		initializeUserGrid()
	);
	const [selectedCell, setSelectedCell] = useState<{
		row: number;
		col: number;
	} | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [answerRevealed, setAnswerRevealed] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	const puzzleSignature = `${grid.join(",")}-${givens
		.map((g) => `${g.row},${g.col},${g.value}`)
		.join(",")}`;

	useEffect(() => {
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setCompleted(false);
			setAnswerRevealed(false);
			setUserGrid(initializeUserGrid());
			setSelectedCell(null);
			setFeedback(null);
			setAttempts(0);
			hasAttemptedRef.current = false;
		}
	}, [puzzleSignature, propStartTime]);

	// Timer effect
	useEffect(() => {
		if (!completed && !answerRevealed) {
			timerIntervalRef.current = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
			}, 1000);
		} else {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [completed, answerRevealed, startTime]);

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const isGiven = (row: number, col: number): boolean => {
		return givens.some((g) => g.row === row && g.col === col);
	};

	const getCellValue = (row: number, col: number): number | null => {
		return userGrid[row][col];
	};

	const getBoxNumber = (row: number, col: number): number => {
		return Math.floor(row / 3) * 3 + Math.floor(col / 3);
	};

	const validatePuzzle = (): { valid: boolean; errors: string[] } => {
		const errors: string[] = [];

		// 1. Check all cells are filled
		for (let row = 0; row < SIZE; row++) {
			for (let col = 0; col < SIZE; col++) {
				if (userGrid[row][col] === null) {
					errors.push("All cells must be filled");
					return { valid: false, errors };
				}
			}
		}

		// 2. Check each row contains 1-9 exactly once
		for (let row = 0; row < SIZE; row++) {
			const rowValues = userGrid[row].filter(
				(v) => v !== null
			) as number[];
			const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
			const sorted = [...rowValues].sort((a, b) => a - b);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				errors.push(`Row ${row + 1} is invalid`);
			}
		}

		// 3. Check each column contains 1-9 exactly once
		for (let col = 0; col < SIZE; col++) {
			const colValues: number[] = [];
			for (let row = 0; row < SIZE; row++) {
				if (userGrid[row][col] !== null) {
					colValues.push(userGrid[row][col]!);
				}
			}
			const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
			const sorted = [...colValues].sort((a, b) => a - b);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				errors.push(`Column ${col + 1} is invalid`);
			}
		}

		// 4. Check each 3×3 box contains 1-9 exactly once
		for (let box = 0; box < 9; box++) {
			const boxRow = Math.floor(box / 3) * 3;
			const boxCol = (box % 3) * 3;
			const boxValues: number[] = [];

			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 3; c++) {
					const value = userGrid[boxRow + r][boxCol + c];
					if (value !== null) {
						boxValues.push(value);
					}
				}
			}

			const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
			const sorted = [...boxValues].sort((a, b) => a - b);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				errors.push(`Box ${box + 1} is invalid`);
			}
		}

		// 5. Verify givens match user input
		for (const given of givens) {
			const userValue = userGrid[given.row][given.col];
			if (userValue !== given.value) {
				errors.push(
					`Given at (${given.row}, ${given.col}) should be ${given.value}`
				);
				return { valid: false, errors };
			}
		}

		return { valid: errors.length === 0, errors };
	};

	const checkCompletion = (): boolean => {
		const validation = validatePuzzle();
		return validation.valid;
	};

	const handleCellPress = (row: number, col: number) => {
		if (completed || answerRevealed) return;
		if (isGiven(row, col)) return; // Can't edit givens

		// Track first interaction
		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		setSelectedCell({ row, col });
		setFeedback(null);
	};

	const handleNumberInput = (value: number) => {
		if (completed || answerRevealed || !selectedCell) return;

		const { row, col } = selectedCell;
		if (isGiven(row, col)) return;

		const newGrid = userGrid.map((r) => [...r]);
		newGrid[row][col] = value;
		setUserGrid(newGrid);
		setSelectedCell(null);
		setFeedback(null);

		// Auto-check if puzzle is complete
		if (checkCompletion()) {
			setCompleted(true);
			setFeedback("Correct!");
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			const timeTaken = Math.floor((Date.now() - startTime) / 1000);
			setElapsedTime(timeTaken);

			Animated.sequence([
				Animated.timing(successScale, {
					toValue: 1.1,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(successScale, {
					toValue: 1,
					duration: Animation.duration.normal,
					useNativeDriver: true,
				}),
			]).start();

			onComplete({
				puzzleId: puzzleId || `sudoku_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts,
				completedAt: new Date().toISOString(),
			});
		}
	};

	const handleCheck = () => {
		const validation = validatePuzzle();
		if (validation.valid) {
			setFeedback("Correct! Well done!");
			setCompleted(true);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			const timeTaken = Math.floor((Date.now() - startTime) / 1000);
			setElapsedTime(timeTaken);

			Animated.sequence([
				Animated.timing(successScale, {
					toValue: 1.1,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(successScale, {
					toValue: 1,
					duration: Animation.duration.normal,
					useNativeDriver: true,
				}),
			]).start();

			onComplete({
				puzzleId: puzzleId || `sudoku_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts,
				completedAt: new Date().toISOString(),
			});
		} else {
			setAttempts(attempts + 1);
			setFeedback(validation.errors[0] || "Incorrect. Keep trying!");
			Animated.sequence([
				Animated.timing(shakeAnimation, {
					toValue: 10,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(shakeAnimation, {
					toValue: -10,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(shakeAnimation, {
					toValue: 0,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
			]).start();
		}
	};

	const handleShowAnswer = () => {
		setAnswerRevealed(true);
		setUserGrid(solutionGrid.map((row) => [...row]));
		setCompleted(true);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		setElapsedTime(timeTaken);

		onComplete({
			puzzleId: puzzleId || `sudoku_${Date.now()}`,
			completed: false,
			timeTaken,
			attempts: attempts,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const handleClear = () => {
		if (!selectedCell || completed || answerRevealed) return;
		const { row, col } = selectedCell;
		if (isGiven(row, col)) return;

		const newGrid = userGrid.map((r) => [...r]);
		newGrid[row][col] = null;
		setUserGrid(newGrid);
		setSelectedCell(null);
		setFeedback(null);
	};

	// Calculate cell size based on screen width
	const maxGridWidth = SCREEN_WIDTH - Spacing.xl * 2;
	const cellSize = Math.floor((maxGridWidth - (SIZE - 1) * 2) / SIZE);
	const cellSizeClamped = Math.min(cellSize, 50);

	const renderCell = (row: number, col: number) => {
		const value = getCellValue(row, col);
		const isGivenCell = isGiven(row, col);
		const isSelected =
			selectedCell?.row === row && selectedCell?.col === col;
		const isCompleted = completed;
		const isRevealed = answerRevealed;

		// Determine border widths for 3x3 box separation
		const isBoxLeftEdge = col % 3 === 0;
		const isBoxTopEdge = row % 3 === 0;
		const isBoxRightEdge = col === SIZE - 1;
		const isBoxBottomEdge = row === SIZE - 1;

		// Thicker borders (3px) between boxes, thinner (1px) within boxes
		const borderLeftWidth = isBoxLeftEdge ? 3 : 1;
		const borderTopWidth = isBoxTopEdge ? 3 : 1;
		const borderRightWidth = isBoxRightEdge ? 3 : 1;
		const borderBottomWidth = isBoxBottomEdge ? 3 : 1;

		// Optional: subtle background color for boxes (alternating)
		const boxNumber = getBoxNumber(row, col);
		const isEvenBox = boxNumber % 2 === 0;

		return (
			<TouchableOpacity
				key={`cell-${row}-${col}`}
				style={[
					styles.cell,
					{
						width: cellSizeClamped,
						height: cellSizeClamped,
						borderLeftWidth,
						borderTopWidth,
						borderRightWidth,
						borderBottomWidth,
					},
					isEvenBox && !isGivenCell && styles.cellEvenBox,
					isGivenCell && styles.cellGiven,
					isSelected && styles.cellSelected,
					isCompleted && styles.cellCompleted,
					isRevealed && styles.cellRevealed,
				]}
				onPress={() => handleCellPress(row, col)}
				disabled={completed || answerRevealed || isGivenCell}
			>
				<Text
					style={[
						styles.cellText,
						isGivenCell && styles.cellTextGiven,
						isRevealed && styles.cellTextRevealed,
					]}
				>
					{value !== null ? value : ""}
				</Text>
			</TouchableOpacity>
		);
	};

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.contentContainer}
			showsVerticalScrollIndicator={false}
		>
			<Animated.View
				style={[
					styles.gameContainer,
					{
						transform: [
							{ translateX: shakeAnimation },
							{ scale: successScale },
						],
					},
				]}
			>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.title}>Sudoku</Text>
					<View style={styles.timerBadge}>
						<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
					</View>
				</View>

				{/* Grid */}
				<View style={styles.gridContainer}>
					{Array.from({ length: SIZE }, (_, row) => (
						<View key={row} style={styles.gridRow}>
							{Array.from({ length: SIZE }, (_, col) =>
								renderCell(row, col)
							)}
						</View>
					))}
				</View>

				{/* Number Input Buttons */}
				{!completed && !answerRevealed && (
					<View style={styles.numberInputContainer}>
						{Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
							<TouchableOpacity
								key={num}
								style={[
									styles.numberButton,
									selectedCell && styles.numberButtonActive,
								]}
								onPress={() => handleNumberInput(num)}
								disabled={!selectedCell}
							>
								<Text style={styles.numberButtonText}>{num}</Text>
							</TouchableOpacity>
						))}
					</View>
				)}

				{/* Action Buttons */}
				{!completed && !answerRevealed && (
					<View style={styles.actionButtonsContainer}>
						<TouchableOpacity
							style={[
								styles.actionButton,
								styles.clearButton,
								!selectedCell && styles.actionButtonDisabled,
							]}
							onPress={handleClear}
							disabled={!selectedCell}
						>
							<Text style={styles.actionButtonText}>Clear</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.actionButton, styles.checkButton]}
							onPress={handleCheck}
						>
							<Text style={styles.actionButtonText}>Check</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.actionButton, styles.showAnswerButton]}
							onPress={handleShowAnswer}
						>
							<Text style={styles.actionButtonText}>Show Answer</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Feedback */}
				{feedback && (
					<View style={styles.feedbackContainer}>
						<Text style={styles.feedbackText}>{feedback}</Text>
					</View>
				)}

				{/* View Stats Button - shown when game is completed */}
				{(completed || answerRevealed) && onShowStats && (
					<TouchableOpacity
						style={styles.viewStatsButton}
						onPress={onShowStats}
						activeOpacity={0.7}
					>
						<Text style={styles.viewStatsButtonText}>View Stats</Text>
					</TouchableOpacity>
				)}
			</Animated.View>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
	},
	contentContainer: {
		padding: Spacing.lg,
	},
	gameContainer: {
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.lg,
		marginBottom: Spacing.lg,
	},
	title: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
	},
	timerBadge: {
		backgroundColor: Colors.accent + "20",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	gridContainer: {
		marginBottom: Spacing.xl,
	},
	gridRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	cell: {
		backgroundColor: Colors.background.tertiary,
		borderColor: Colors.text.primary + "40",
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	cellGiven: {
		backgroundColor: "#4CAF5030", // Light green with opacity (30 = ~19% opacity)
		borderColor: Colors.text.secondary + "40",
	},
	cellSelected: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "40",
	},
	cellCompleted: {
		backgroundColor: Colors.game.correct + "40",
		borderColor: Colors.game.correct,
	},
	cellRevealed: {
		backgroundColor: Colors.accent + "20",
		borderColor: Colors.accent + "60",
	},
	cellEvenBox: {
		backgroundColor: Colors.background.tertiary + "80",
	},
	cellText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	cellTextGiven: {
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
	},
	cellTextRevealed: {
		color: Colors.accent,
	},
	numberInputContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.lg,
		paddingHorizontal: Spacing.md,
	},
	numberButton: {
		width: 50,
		height: 50,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: Colors.text.secondary + "40",
		opacity: 0.5,
	},
	numberButtonActive: {
		opacity: 1,
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "20",
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	actionButtonsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.md,
		marginBottom: Spacing.lg,
		flexWrap: "wrap",
	},
	actionButton: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		minWidth: 100,
		alignItems: "center",
		...Shadows.medium,
	},
	clearButton: {
		backgroundColor: Colors.background.secondary,
	},
	checkButton: {
		backgroundColor: Colors.accent,
	},
	showAnswerButton: {
		backgroundColor: Colors.text.secondary,
	},
	actionButtonDisabled: {
		opacity: 0.5,
	},
	actionButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	feedbackContainer: {
		marginTop: Spacing.md,
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		alignItems: "center",
	},
	feedbackText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
	},
	viewStatsButton: {
		marginTop: Spacing.xl,
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},
	viewStatsButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
});

export default SudokuGame;

