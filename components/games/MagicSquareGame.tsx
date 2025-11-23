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
import { GameResult, MagicSquareData } from "../../config/types";
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

interface MagicSquareGameProps {
	inputData: MagicSquareData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
}

const MagicSquareGame: React.FC<MagicSquareGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
}) => {
	const { size, grid, magicConstant, givens } = inputData;

	// Reconstruct 2D grid from 1D array
	const reconstructGrid = (flatGrid: number[], size: number): number[][] => {
		const grid2D: number[][] = [];
		for (let row = 0; row < size; row++) {
			grid2D[row] = [];
			for (let col = 0; col < size; col++) {
				grid2D[row][col] = flatGrid[row * size + col];
			}
		}
		return grid2D;
	};

	const solutionGrid = reconstructGrid(grid, size);

	// Initialize user grid with givens
	const initializeUserGrid = (): (number | null)[][] => {
		const userGrid: (number | null)[][] = [];
		for (let row = 0; row < size; row++) {
			userGrid[row] = [];
			for (let col = 0; col < size; col++) {
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

	const puzzleSignature = `${size}-${magicConstant}-${givens
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
			hasAttemptedRef.current = false;
		}
	}, [puzzleSignature, propStartTime]);

	useEffect(() => {
		if (completed || answerRevealed) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			return;
		}

		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [startTime, completed, answerRevealed]);

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

	const validatePuzzle = (): { valid: boolean; errors: string[] } => {
		const errors: string[] = [];

		// Check all cells are filled
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				if (userGrid[row][col] === null) {
					errors.push("All cells must be filled");
					return { valid: false, errors };
				}
			}
		}

		// Check each row sums to magic constant
		for (let row = 0; row < size; row++) {
			const rowSum = userGrid[row].reduce((sum, val) => sum + (val || 0), 0);
			if (rowSum !== magicConstant) {
				errors.push(`Row ${row + 1} sums to ${rowSum}, not ${magicConstant}`);
			}
		}

		// Check each column sums to magic constant
		for (let col = 0; col < size; col++) {
			let colSum = 0;
			for (let row = 0; row < size; row++) {
				colSum += userGrid[row][col] || 0;
			}
			if (colSum !== magicConstant) {
				errors.push(`Column ${col + 1} sums to ${colSum}, not ${magicConstant}`);
			}
		}

		// Check main diagonal (top-left to bottom-right)
		let mainDiagSum = 0;
		for (let i = 0; i < size; i++) {
			mainDiagSum += userGrid[i][i] || 0;
		}
		if (mainDiagSum !== magicConstant) {
			errors.push(`Main diagonal sums to ${mainDiagSum}, not ${magicConstant}`);
		}

		// Check anti-diagonal (top-right to bottom-left)
		let antiDiagSum = 0;
		for (let i = 0; i < size; i++) {
			antiDiagSum += userGrid[i][size - 1 - i] || 0;
		}
		if (antiDiagSum !== magicConstant) {
			errors.push(`Anti-diagonal sums to ${antiDiagSum}, not ${magicConstant}`);
		}

		// Check all numbers 1 through N² appear exactly once
		const allNumbers: number[] = [];
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				const val = userGrid[row][col];
				if (val !== null) {
					allNumbers.push(val);
				}
			}
		}
		const expectedNumbers = Array.from({ length: size * size }, (_, i) => i + 1);
		const sorted = [...allNumbers].sort((a, b) => a - b);
		if (JSON.stringify(sorted) !== JSON.stringify(expectedNumbers)) {
			errors.push("All numbers 1 through " + size * size + " must appear exactly once");
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
				puzzleId: puzzleId || `magicSquare_${Date.now()}`,
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
				puzzleId: puzzleId || `magicSquare_${Date.now()}`,
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
			puzzleId: puzzleId || `magicSquare_${Date.now()}`,
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
	const cellSize = Math.floor((maxGridWidth - (size - 1) * 8) / size);
	const cellSizeClamped = Math.min(cellSize, 80);

	const renderCell = (row: number, col: number) => {
		const value = getCellValue(row, col);
		const isGivenCell = isGiven(row, col);
		const isSelected =
			selectedCell?.row === row && selectedCell?.col === col;
		const isCompleted = completed;
		const isRevealed = answerRevealed;

		return (
			<TouchableOpacity
				key={`cell-${row}-${col}`}
				style={[
					styles.cell,
					{
						width: cellSizeClamped,
						height: cellSizeClamped,
					},
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
					<Text style={styles.title}>Magic Square</Text>
					<View style={styles.timerBadge}>
						<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
					</View>
				</View>

				{/* Magic Constant Display */}
				<View style={styles.magicConstantContainer}>
					<Text style={styles.magicConstantLabel}>Magic Constant:</Text>
					<Text style={styles.magicConstantValue}>{magicConstant}</Text>
				</View>

				{/* Grid */}
				<View style={styles.gridContainer}>
					{Array.from({ length: size }, (_, row) => (
						<View key={row} style={styles.gridRow}>
							{Array.from({ length: size }, (_, col) => renderCell(row, col))}
						</View>
					))}
				</View>

				{/* Number Input Buttons */}
				{!completed && !answerRevealed && (
					<View style={styles.numberInputContainer}>
						{Array.from({ length: size * size }, (_, i) => i + 1).map((num) => (
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
	magicConstantContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.md,
		gap: Spacing.sm,
	},
	magicConstantLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	magicConstantValue: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
	},
	gridContainer: {
		marginBottom: Spacing.xl,
	},
	gridRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
	},
	cell: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.2)",
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	cellGiven: {
		backgroundColor: Colors.background.secondary,
		borderColor: Colors.text.secondary + "40",
	},
	cellSelected: {
		borderColor: Colors.accent,
		borderWidth: 3,
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
	cellText: {
		fontSize: 24,
		fontWeight: Typography.fontWeight.semiBold,
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
		maxWidth: SCREEN_WIDTH - Spacing.xl * 2,
	},
	numberButton: {
		width: 50,
		height: 50,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.accent,
		alignItems: "center",
		justifyContent: "center",
		opacity: 0.5,
	},
	numberButtonActive: {
		opacity: 1,
		backgroundColor: Colors.accent + "20",
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
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
		justifyContent: "center",
	},
	clearButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
	},
	checkButton: {
		backgroundColor: Colors.accent,
		...Shadows.medium,
	},
	showAnswerButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
	},
	actionButtonDisabled: {
		opacity: 0.5,
	},
	actionButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	feedbackContainer: {
		backgroundColor: Colors.background.tertiary,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		marginTop: Spacing.md,
		alignItems: "center",
	},
	feedbackText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
	},
});

export default MagicSquareGame;

