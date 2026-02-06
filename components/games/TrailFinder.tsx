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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameResult, TrailFinderData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	ComponentStyles,
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TrailFinderGameProps {
	inputData: TrailFinderData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}

const TrailFinderGame: React.FC<TrailFinderGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
	initialCompletedResult,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const gameColor = getGameColor("trailfinder"); // Get game-specific amber color (#F59E0B)
	const { rows, cols, startNum, endNum, path, givens } = inputData;

	// Create solution grid from path
	const createSolutionGrid = (): (number | null)[][] => {
		const grid: (number | null)[][] = [];
		for (let row = 0; row < rows; row++) {
			grid[row] = [];
			for (let col = 0; col < cols; col++) {
				grid[row][col] = null;
			}
		}
		// Fill solution grid from path
		path.forEach((pos, index) => {
			grid[pos.row][pos.col] = startNum + index;
		});
		return grid;
	};

	const solutionGrid = createSolutionGrid();

	// Initialize user grid with givens
	const initializeUserGrid = (): (number | null)[][] => {
		const userGrid: (number | null)[][] = [];
		for (let row = 0; row < rows; row++) {
			userGrid[row] = [];
			for (let col = 0; col < cols; col++) {
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

	const puzzleSignature = `${rows}-${cols}-${startNum}-${endNum}-${givens
		.map((g) => `${g.row},${g.col},${g.value}`)
		.join(",")}`;

	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			
			// Restore from initialCompletedResult if provided
			if (initialCompletedResult && initialCompletedResult.completed && !initialCompletedResult.answerRevealed) {
				setCompleted(true);
				setAnswerRevealed(false);
				setElapsedTime(initialCompletedResult.timeTaken);
				// Restore user grid from solution grid
				const restoredGrid = solutionGrid.map((row) => [...row]);
				setUserGrid(restoredGrid);
				setSelectedCell(null);
				setFeedback(null);
				hasAttemptedRef.current = true;
				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
					timerIntervalRef.current = null;
				}
				setStartTime(undefined);
			} else {
				setElapsedTime(0);
				setCompleted(false);
				setAnswerRevealed(false);
				setUserGrid(initializeUserGrid());
				setSelectedCell(null);
				setFeedback(null);
				hasAttemptedRef.current = false;
				// Only set startTime if propStartTime is provided
				if (propStartTime) {
					setStartTime(propStartTime);
				} else {
					setStartTime(undefined);
				}
			}
		} else if (propStartTime && startTime !== propStartTime) {
			setStartTime(propStartTime);
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
		}
	}, [puzzleSignature, propStartTime, startTime, initialCompletedResult, solutionGrid]);

	useEffect(() => {
		if (!startTime) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			return;
		}

		if (completed || answerRevealed) {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			return;
		}

		if (!isActive) {
			// Pause timer when game is not active
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
	}, [startTime, completed, answerRevealed, isActive]);

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

	const areAdjacent8Directions = (
		pos1: { row: number; col: number },
		pos2: { row: number; col: number }
	): boolean => {
		const rowDiff = Math.abs(pos1.row - pos2.row);
		const colDiff = Math.abs(pos1.col - pos2.col);
		// Adjacent if: same row/col (4 directions) or diagonal (4 directions)
		return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
	};

	const validatePuzzle = (): { valid: boolean; errors: string[] } => {
		const errors: string[] = [];
		const numRange = endNum - startNum + 1;

		// 1. Check all numbers from startNum to endNum are present
		const numbersFound = new Set<number>();
		const numberPositions = new Map<number, { row: number; col: number }>();

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const value = userGrid[row][col];
				if (value !== null) {
					if (value < startNum || value > endNum) {
						errors.push(
							`Number ${value} is outside range [${startNum}, ${endNum}]`
						);
						return { valid: false, errors };
					}
					if (numbersFound.has(value)) {
						errors.push(`Number ${value} appears twice`);
						return { valid: false, errors };
					}
					numbersFound.add(value);
					numberPositions.set(value, { row, col });
				}
			}
		}

		// 2. Check all numbers in range are present
		for (let num = startNum; num <= endNum; num++) {
			if (!numbersFound.has(num)) {
				errors.push(`Number ${num} is missing`);
				return { valid: false, errors };
			}
		}

		// 3. Verify consecutive numbers are adjacent (8 directions)
		for (let num = startNum + 1; num <= endNum; num++) {
			const pos1 = numberPositions.get(num - 1);
			const pos2 = numberPositions.get(num);

			if (!pos1 || !pos2) {
				errors.push(`Cannot verify adjacency for ${num - 1} and ${num}`);
				return { valid: false, errors };
			}

			if (!areAdjacent8Directions(pos1, pos2)) {
				errors.push(
					`Numbers ${num - 1} and ${num} are not adjacent (8 directions)`
				);
				return { valid: false, errors };
			}
		}

		// 4. Verify givens match user input
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
				puzzleId: puzzleId || `trailfinder_${Date.now()}`,
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
				puzzleId: puzzleId || `trailfinder_${Date.now()}`,
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
			puzzleId: puzzleId || `trailfinder_${Date.now()}`,
			completed: true,
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
	const cellSize = Math.floor((maxGridWidth - (cols - 1) * 8) / cols);
	const cellSizeClamped = Math.min(cellSize, 80);

	const renderCell = (row: number, col: number) => {
		const value = getCellValue(row, col);
		const isGivenCell = isGiven(row, col);
		const isSelected = selectedCell?.row === row && selectedCell?.col === col;
		const isCompleted = completed;
		const isRevealed = answerRevealed;
		const isStart = value === startNum;
		const isEnd = value === endNum;

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
					isStart && styles.cellStart,
					isEnd && styles.cellEnd,
				]}
				onPress={() => handleCellPress(row, col)}
				disabled={completed || answerRevealed || isGivenCell}
			>
				<Text
					style={[
						styles.cellText,
						isGivenCell && styles.cellTextGiven,
						isRevealed && styles.cellTextRevealed,
						isStart && styles.cellTextStart,
						isEnd && styles.cellTextEnd,
					]}
				>
					{value !== null ? value : ""}
				</Text>
			</TouchableOpacity>
		);
	};

	// Calculate bottom padding to account for bottom navigation bar
	const bottomPadding = BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg;

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={[
				styles.contentContainer,
				{ paddingBottom: bottomPadding },
			]}
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
					title="TrailFinder"
					elapsedTime={elapsedTime}
					showDifficulty={false}
					gameType="trailfinder"
					puzzleId={puzzleId}
				/>

				{/* Range Display */}
				<View style={styles.rangeContainer}>
					<Text style={styles.rangeLabel}>
						Fill numbers from {startNum} to {endNum}
					</Text>
				</View>

				{/* Grid */}
				<View style={styles.gridContainer}>
					{Array.from({ length: rows }, (_, row) => (
						<View key={row} style={styles.gridRow}>
							{Array.from({ length: cols }, (_, col) => renderCell(row, col))}
						</View>
					))}
				</View>

				{/* Number Input Buttons */}
				{!completed && !answerRevealed && (
					<View style={styles.numberInputContainer}>
						{Array.from(
							{ length: endNum - startNum + 1 },
							(_, i) => startNum + i
						).map((num) => (
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
					</View>
				)}

				{/* Feedback */}
				{feedback && !completed && !answerRevealed && (
					<View style={styles.feedbackContainer}>
						<Text style={styles.feedbackText}>{feedback}</Text>
					</View>
				)}

				{/* Show Answer Button */}
				{!completed && !answerRevealed && (
					<TouchableOpacity
						style={styles.showAnswerButton}
						onPress={handleShowAnswer}
						activeOpacity={0.7}
					>
						<Text style={styles.showAnswerText}>Show Answer</Text>
					</TouchableOpacity>
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
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
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
		backgroundColor: "#F59E0B15", // Game-specific amber with opacity
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#F59E0B40",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#F59E0B", // Game-specific amber
		fontFamily: Typography.fontFamily.monospace,
	},
	rangeContainer: {
		marginBottom: Spacing.md,
		alignItems: "center",
	},
	rangeLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	gridContainer: {
		marginBottom: Spacing.xl,
	},
	gridRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.sm,
	},
	cell: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 2,
		borderColor: "#E5E5E5",
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
		borderColor: "#F59E0B", // Game-specific amber
		borderWidth: 3,
		backgroundColor: "#F59E0B40",
	},
	cellCompleted: {
		backgroundColor: Colors.game.correct + "40",
		borderColor: Colors.game.correct,
	},
	cellRevealed: {
		backgroundColor: "#F59E0B20", // Game-specific amber with opacity
		borderColor: "#F59E0B60",
	},
	cellStart: {
		borderColor: Colors.game.correct,
		borderWidth: 3,
	},
	cellEnd: {
		borderColor: "#F59E0B", // Game-specific amber
		borderWidth: 3,
	},
	cellText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	cellTextGiven: {
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
	},
	cellTextRevealed: {
		color: "#F59E0B", // Game-specific amber
		fontWeight: Typography.fontWeight.bold,
	},
	cellTextStart: {
		color: Colors.game.correct,
		fontWeight: Typography.fontWeight.bold,
	},
	cellTextEnd: {
		color: "#F59E0B", // Game-specific amber
		fontWeight: Typography.fontWeight.bold,
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
		width: 56,
		height: 56,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		alignItems: "center",
		justifyContent: "center",
		opacity: 0.6,
		...Shadows.light,
	},
	numberButtonActive: {
		opacity: 1,
		backgroundColor: "#F59E0B20", // Game-specific amber with opacity
		borderColor: "#F59E0B", // Game-specific amber
		borderWidth: 2.5,
		...Shadows.medium,
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#F59E0B", // Game-specific amber
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
		backgroundColor: "#F59E0B", // Game-specific amber
		...Shadows.medium,
	},
	showAnswerButton: {
		marginTop: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.xs,
	},
	showAnswerText: {
		color: Colors.text.secondary,
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		textDecorationLine: "underline",
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
	viewStatsButton: {
		marginTop: Spacing.xl,
		backgroundColor: "#F59E0B", // Game-specific amber
		borderRadius: ComponentStyles.button.borderRadius,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
	},
	viewStatsButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
});

export default TrailFinderGame;
