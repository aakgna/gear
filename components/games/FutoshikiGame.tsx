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
import { GameResult, FutoshikiData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface FutoshikiGameProps {
	inputData: FutoshikiData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

const FutoshikiGame: React.FC<FutoshikiGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	const { size, grid, givens, inequalities } = inputData;

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
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [answerRevealed, setAnswerRevealed] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	const puzzleSignature = `${size}-${givens
		.map((g) => `${g.row},${g.col},${g.value}`)
		.join(",")}`;

	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setCompleted(false);
			setUserGrid(initializeUserGrid());
			setSelectedCell(null);
			setAttempts(0);
			setFeedback(null);
			setAnswerRevealed(false);
			hasAttemptedRef.current = false;
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			// Only set startTime if propStartTime is provided
			if (propStartTime) {
				setStartTime(propStartTime);
			} else {
				setStartTime(undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			// startTime prop changed - could be initial start or resume from pause
			// Calculate elapsed time from new startTime to maintain continuity
			const newElapsed = Math.floor((Date.now() - propStartTime) / 1000);
			setElapsedTime(newElapsed);
			setStartTime(propStartTime);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}
	}, [puzzleSignature, propStartTime, startTime]);

	// Timer effect (only if startTime is set and game is active)
	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (completed) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (!isActive) {
			// Pause timer when game is not active
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [completed, startTime, isActive]);

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const isGiven = (row: number, col: number): boolean => {
		return givens.some((g) => g.row === row && g.col === col);
	};

	const getCellValue = (row: number, col: number): number | null => {
		return userGrid[row][col];
	};

	const getInequality = (
		row: number,
		col: number,
		direction: "right" | "down" | "left" | "up"
	): {
		operator: "<" | ">" | "ʌ" | "v";
		cell1: { row: number; col: number };
		cell2: { row: number; col: number };
	} | null => {
		for (const ineq of inequalities) {
			if (direction === "right") {
				if (
					ineq.row1 === row &&
					ineq.col1 === col &&
					ineq.row2 === row &&
					ineq.col2 === col + 1
				) {
					return {
						operator: ineq.operator,
						cell1: { row: ineq.row1, col: ineq.col1 },
						cell2: { row: ineq.row2, col: ineq.col2 },
					};
				}
			} else if (direction === "down") {
				if (
					ineq.row1 === row &&
					ineq.col1 === col &&
					ineq.row2 === row + 1 &&
					ineq.col2 === col
				) {
					// For vertical inequalities:
					// If operator is ">", it means top > bottom, so show "v" (pointing down to the smaller bottom value)
					// If operator is "<", it means top < bottom, so show "ʌ" (pointing up to the smaller top value)
					// This way the arrow points toward the smaller value
					const verticalOperator = ineq.operator === ">" ? "v" : "ʌ";
					return {
						operator: verticalOperator as "<" | ">" | "ʌ" | "v",
						cell1: { row: ineq.row1, col: ineq.col1 },
						cell2: { row: ineq.row2, col: ineq.col2 },
					};
				}
			} else if (direction === "left") {
				if (
					ineq.row1 === row &&
					ineq.col1 === col - 1 &&
					ineq.row2 === row &&
					ineq.col2 === col
				) {
					return {
						operator: ineq.operator === "<" ? ">" : "<",
						cell1: { row: ineq.row2, col: ineq.col2 },
						cell2: { row: ineq.row1, col: ineq.col1 },
					};
				}
			} else if (direction === "up") {
				if (
					ineq.row1 === row - 1 &&
					ineq.col1 === col &&
					ineq.row2 === row &&
					ineq.col2 === col
				) {
					// When looking up, the stored operator is from (row-1) to (row)
					// If operator is ">", it means (row-1) > (row), so top > bottom, show "v" (pointing down to smaller bottom)
					// If operator is "<", it means (row-1) < (row), so top < bottom, show "ʌ" (pointing up to smaller top)
					const verticalOperator = ineq.operator === ">" ? "v" : "ʌ";
					return {
						operator: verticalOperator as "<" | ">" | "ʌ" | "v",
						cell1: { row: ineq.row2, col: ineq.col2 },
						cell2: { row: ineq.row1, col: ineq.col1 },
					};
				}
			}
		}
		return null;
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

		// Check each row contains 1-size exactly once
		for (let row = 0; row < size; row++) {
			const rowValues = userGrid[row].filter((v) => v !== null) as number[];
			const expected = Array.from({ length: size }, (_, i) => i + 1);
			const sorted = [...rowValues].sort((a, b) => a - b);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				errors.push(`Row ${row + 1} is invalid`);
			}
		}

		// Check each column contains 1-size exactly once
		for (let col = 0; col < size; col++) {
			const colValues: number[] = [];
			for (let row = 0; row < size; row++) {
				if (userGrid[row][col] !== null) {
					colValues.push(userGrid[row][col]!);
				}
			}
			const expected = Array.from({ length: size }, (_, i) => i + 1);
			const sorted = [...colValues].sort((a, b) => a - b);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				errors.push(`Column ${col + 1} is invalid`);
			}
		}

		// Check all inequalities are satisfied
		for (const ineq of inequalities) {
			const val1 = userGrid[ineq.row1][ineq.col1];
			const val2 = userGrid[ineq.row2][ineq.col2];
			if (val1 === null || val2 === null) continue;

			if (ineq.operator === "<" && val1 >= val2) {
				errors.push("Inequality constraint violated");
			} else if (ineq.operator === ">" && val1 <= val2) {
				errors.push("Inequality constraint violated");
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
				puzzleId: puzzleId || `futoshiki_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts,
				completedAt: new Date().toISOString(),
			});
		}
	};

	const handleCheck = () => {
		if (completed || answerRevealed) return;

		const validation = validatePuzzle();
		const newAttempts = attempts + 1;
		setAttempts(newAttempts);

		if (validation.valid) {
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
				puzzleId: puzzleId || `futoshiki_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: newAttempts,
				completedAt: new Date().toISOString(),
			});
		} else {
			setFeedback(validation.errors[0] || "Puzzle is incorrect");
			Animated.sequence([
				Animated.timing(shakeAnimation, {
					toValue: 5,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(shakeAnimation, {
					toValue: -5,
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
		if (completed || answerRevealed) return;

		setAnswerRevealed(true);
		setCompleted(true);
		setUserGrid(solutionGrid.map((r) => [...r]));
		setFeedback("Answer revealed!");

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		setElapsedTime(timeTaken);

		onComplete({
			puzzleId: puzzleId || `futoshiki_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts: attempts + 1,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const handleClear = () => {
		if (completed || answerRevealed || !selectedCell) return;
		const { row, col } = selectedCell;
		if (isGiven(row, col)) return;

		const newGrid = userGrid.map((r) => [...r]);
		newGrid[row][col] = null;
		setUserGrid(newGrid);
		setFeedback(null);
	};

	// Calculate cell size based on grid dimensions
	const gridPadding = Spacing.xl * 2;
	const availableWidth = SCREEN_WIDTH - gridPadding;
	const cellMargin = 4;
	const inequalitySize = 20;
	const cellSize = Math.floor(
		(availableWidth - (size - 1) * (cellMargin * 2 + inequalitySize)) / size
	);

	const renderCell = (row: number, col: number) => {
		const value = getCellValue(row, col);
		const isGivenCell = isGiven(row, col);
		const isSelected = selectedCell?.row === row && selectedCell?.col === col;
		const isCompleted = completed && !answerRevealed;
		const isRevealed = answerRevealed;

		const rightInequality = getInequality(row, col, "right");

		return (
			<View key={`${row}-${col}`} style={styles.cellWrapper}>
				<TouchableOpacity
					style={[
						styles.cell,
						{
							width: cellSize,
							height: cellSize,
						},
						isGivenCell && styles.cellGiven,
						isSelected && styles.cellSelected,
						isCompleted && styles.cellCompleted,
						isRevealed && styles.cellRevealed,
					]}
					onPress={() => handleCellPress(row, col)}
					disabled={completed || answerRevealed || isGivenCell}
				>
					<Text style={[styles.cellText, isGivenCell && styles.cellTextGiven]}>
						{value || ""}
					</Text>
				</TouchableOpacity>
				{col < size - 1 && (
					<View
						style={[
							styles.inequalityContainer,
							{ width: inequalitySize, height: cellSize },
						]}
					>
						{rightInequality && (
							<Text style={styles.inequalityText}>
								{rightInequality.operator}
							</Text>
						)}
					</View>
				)}
			</View>
		);
	};

	const renderInequalityRow = (row: number) => {
		return (
			<View key={`ineq-${row}`} style={styles.inequalityRowContainer}>
				{Array.from({ length: size }, (_, col) => {
					const downInequality = getInequality(row, col, "down");
					return (
						<React.Fragment key={col}>
							<View style={[styles.inequalityRow, { width: cellSize }]}>
								{downInequality && (
									<Text style={styles.inequalityTextVertical}>
										{downInequality.operator}
									</Text>
								)}
							</View>
							{col < size - 1 && <View style={{ width: inequalitySize }} />}
						</React.Fragment>
					);
				})}
			</View>
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
				<GameHeader
					title="Futoshiki"
					elapsedTime={elapsedTime}
					showDifficulty={false}
				/>

				{/* Grid */}
				<View style={styles.gridContainer}>
					{Array.from({ length: size }, (_, row) => (
						<React.Fragment key={row}>
							<View style={styles.gridRow}>
								{Array.from({ length: size }, (_, col) => renderCell(row, col))}
							</View>
							{row < size - 1 && renderInequalityRow(row)}
						</React.Fragment>
					))}
				</View>

				{/* Number Input Buttons */}
				{!completed && !answerRevealed && (
					<View style={styles.numberInputContainer}>
						{Array.from({ length: size }, (_, i) => i + 1).map((num) => (
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
		alignItems: "flex-start",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.md,
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
	cellWrapper: {
		flexDirection: "row",
		alignItems: "center",
	},
	inequalityRowContainer: {
		flexDirection: "row",
		alignItems: "center",
		height: 20,
		marginVertical: Spacing.xs / 2,
	},
	inequalityRow: {
		height: 20,
		alignItems: "center",
		justifyContent: "center",
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
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	cellTextGiven: {
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},
	inequalityContainer: {
		alignItems: "center",
		justifyContent: "center",
	},
	inequalityText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	inequalityTextVertical: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: Typography.fontSize.h3,
	},
	numberInputContainer: {
		flexDirection: "row",
		justifyContent: "center",
		flexWrap: "wrap",
		marginBottom: Spacing.lg,
		gap: Spacing.sm,
	},
	numberButton: {
		width: 50,
		height: 50,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
		...Shadows.light,
		opacity: 0.5,
	},
	numberButtonActive: {
		opacity: 1,
		backgroundColor: Colors.accent + "40",
		borderWidth: 2,
		borderColor: Colors.accent,
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	actionButtonsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		flexWrap: "wrap",
		marginBottom: Spacing.lg,
		gap: Spacing.sm,
	},
	actionButton: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		...Shadows.light,
		minWidth: 100,
		alignItems: "center",
		justifyContent: "center",
	},
	actionButtonDisabled: {
		opacity: 0.5,
	},
	clearButton: {
		backgroundColor: Colors.background.tertiary,
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
	actionButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	feedbackContainer: {
		marginTop: Spacing.md,
		padding: Spacing.md,
		backgroundColor: Colors.error + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.error + "40",
		...Shadows.light,
	},
	feedbackText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
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

export default FutoshikiGame;
