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
import { GameResult, ZipData } from "../../config/types";
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

interface ZipGameProps {
	inputData: ZipData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

const ZipGame: React.FC<ZipGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70; // Height of bottom navigation bar
	const gameColor = getGameColor("zip"); // Get game-specific emerald color (#10B981)
	const { rows, cols, cells, solution } = inputData;
	const totalCells = rows * cols;
	const [userPath, setUserPath] = useState<number[]>([]);
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

	// Create a map of position -> number for quick lookup
	const numberMap = new Map<number, number>();
	cells.forEach((cell) => {
		numberMap.set(cell.pos, cell.number);
	});

	// Create a map of number -> position
	const positionMap = new Map<number, number>();
	cells.forEach((cell) => {
		positionMap.set(cell.number, cell.pos);
	});

	const puzzleSignature = `${rows}-${cols}-${cells
		.map((c) => `${c.pos}:${c.number}`)
		.join(",")}`;

	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setCompleted(false);
			setUserPath([]);
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

	// Check if two positions are adjacent
	const areAdjacent = (pos1: number, pos2: number): boolean => {
		const row1 = Math.floor(pos1 / cols);
		const col1 = pos1 % cols;
		const row2 = Math.floor(pos2 / cols);
		const col2 = pos2 % cols;

		// Horizontal adjacency
		if (row1 === row2 && Math.abs(col1 - col2) === 1) {
			return true;
		}
		// Vertical adjacency
		if (col1 === col2 && Math.abs(row1 - row2) === 1) {
			return true;
		}
		return false;
	};

	// Validate the path algorithmically (without using solution)
	const validatePath = (path: number[]): boolean => {
		// 1. Check all cells are filled
		if (path.length !== totalCells) {
			return false;
		}

		// 2. Check path doesn't cross itself (each position appears exactly once)
		const pathSet = new Set(path);
		if (pathSet.size !== path.length) {
			return false;
		}

		// 3. Check all numbers are in ascending order along the path
		// Extract numbers from the path in the order they appear
		const numbersInPath: number[] = [];
		for (const pos of path) {
			const number = numberMap.get(pos);
			if (number !== undefined) {
				numbersInPath.push(number);
			}
		}

		// Check if numbers are in ascending order (1, 2, 3, ...)
		if (numbersInPath.length === 0) {
			return false; // Must have at least one number
		}

		// Verify numbers are strictly ascending
		for (let i = 1; i < numbersInPath.length; i++) {
			if (numbersInPath[i] <= numbersInPath[i - 1]) {
				return false;
			}
		}

		// Verify we have all numbers from 1 to max (no gaps)
		const maxNumber = Math.max(...numbersInPath);
		const expectedNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
		const actualNumbers = [...new Set(numbersInPath)].sort((a, b) => a - b);

		if (actualNumbers.length !== expectedNumbers.length) {
			return false;
		}

		for (let i = 0; i < expectedNumbers.length; i++) {
			if (actualNumbers[i] !== expectedNumbers[i]) {
				return false;
			}
		}

		return true;
	};

	const handleCellPress = (pos: number) => {
		if (completed || answerRevealed) return;

		// Track first interaction
		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) {
				onAttempt(puzzleId);
			}
		}

		const number = numberMap.get(pos);
		const newPath = [...userPath];

		// If path is empty, must start with number 1
		if (newPath.length === 0) {
			if (number === 1) {
				setUserPath([pos]);
				setFeedback(null);
			} else {
				setFeedback("Start with the cell numbered 1");
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
			return;
		}

		// If cell is already in path, remove it and everything after (undo)
		const existingIndex = newPath.indexOf(pos);
		if (existingIndex !== -1) {
			setUserPath(newPath.slice(0, existingIndex));
			setFeedback(null);
			return;
		}

		// Get the last position in path
		const lastPos = newPath[newPath.length - 1];

		// Check if the new cell is adjacent
		if (!areAdjacent(lastPos, pos)) {
			setFeedback("Cells must be adjacent");
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
			return;
		}

		// If the cell has a number, check it's the next in sequence
		// Find the highest number already in the path (not just the last cell)
		if (number !== undefined) {
			let maxNumberInPath = 0;
			for (const pathPos of newPath) {
				const pathNumber = numberMap.get(pathPos);
				if (pathNumber !== undefined && pathNumber > maxNumberInPath) {
					maxNumberInPath = pathNumber;
				}
			}
			const expectedNumber = maxNumberInPath + 1;

			if (number !== expectedNumber) {
				setFeedback(`Next number should be ${expectedNumber}`);
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
				return;
			}
		}

		// Add cell to path
		const updatedPath = [...newPath, pos];
		setUserPath(updatedPath);
		setFeedback(null);

		// Check if path is complete and validate
		if (updatedPath.length === totalCells) {
			const isValid = validatePath(updatedPath);
			const newAttempts = attempts + 1;
			setAttempts(newAttempts);

			if (isValid) {
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
					puzzleId: puzzleId || `zip_${Date.now()}`,
					completed: true,
					timeTaken,
					attempts: newAttempts,
					completedAt: new Date().toISOString(),
				});
			} else {
				setFeedback("Path is invalid. Try again.");
				setUserPath([]);
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
		}
	};

	const handleShowAnswer = () => {
		if (completed || answerRevealed) return;

		setAnswerRevealed(true);
		setCompleted(true);
		setUserPath(solution);
		setFeedback("Answer revealed!");

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}
		setElapsedTime(timeTaken);

		onComplete({
			puzzleId: puzzleId || `zip_${Date.now()}`,
			completed: true,
			timeTaken,
			attempts: attempts + 1,
			completedAt: new Date().toISOString(),
			answerRevealed: true,
		});
	};

	const handleClear = () => {
		if (completed || answerRevealed) return;
		setUserPath([]);
		setFeedback(null);
	};

	// Calculate cell size based on grid dimensions
	const gridPadding = Spacing.xl * 2;
	const availableWidth = SCREEN_WIDTH - gridPadding;
	const cellMargin = 2; // Margin between cells
	const cellSize = Math.floor(
		(availableWidth - (cols - 1) * cellMargin * 2) / cols
	);

	const getCellStyle = (pos: number) => {
		const number = numberMap.get(pos);
		const isInPath = userPath.includes(pos);
		const pathIndex = userPath.indexOf(pos);
		const isStart = pathIndex === 0;
		const isEnd = pathIndex === userPath.length - 1 && userPath.length > 0;
		const isRevealed = answerRevealed;
		const isCompleted = completed && !answerRevealed;

		// If game is completed correctly, all cells turn green
		if (isCompleted) {
			return [styles.cell, styles.cellCompleted];
		}
		if (isRevealed) {
			return [styles.cell, styles.cellRevealed];
		}
		if (isInPath) {
			if (isStart) {
				return [styles.cell, styles.cellInPath, styles.cellStart];
			}
			if (isEnd) {
				return [styles.cell, styles.cellInPath, styles.cellEnd];
			}
			return [styles.cell, styles.cellInPath];
		}
		return [styles.cell, styles.cellEmpty];
	};

	const renderCell = (pos: number) => {
		const number = numberMap.get(pos);
		const isInPath = userPath.includes(pos);
		const pathIndex = userPath.indexOf(pos);
		const isCompleted = completed && !answerRevealed;

		return (
			<TouchableOpacity
				key={pos}
				style={[getCellStyle(pos), { width: cellSize, height: cellSize }]}
				onPress={() => handleCellPress(pos)}
				disabled={completed && !answerRevealed}
				activeOpacity={0.7}
			>
				{number !== undefined && (
					<Text
						style={[
							styles.cellNumber,
							isInPath && styles.cellNumberInPath,
							isCompleted && styles.cellNumberCompleted,
						]}
					>
						{number}
					</Text>
				)}
				{isInPath && pathIndex >= 0 && (
					<View
						style={[
							styles.pathIndicator,
							isCompleted && styles.pathIndicatorCompleted,
						]}
					>
						<Text
							style={[
								styles.pathIndicatorText,
								isCompleted && styles.pathIndicatorTextCompleted,
							]}
						>
							{pathIndex + 1}
						</Text>
					</View>
				)}
			</TouchableOpacity>
		);
	};

	const renderRow = (rowIndex: number) => {
		return (
			<View key={rowIndex} style={styles.gridRow}>
				{Array.from({ length: cols }, (_, colIndex) => {
					const pos = rowIndex * cols + colIndex;
					return renderCell(pos);
				})}
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<GameHeader
				title="Zip"
				elapsedTime={elapsedTime}
				showDifficulty={false}
			/>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg },
				]}
				showsVerticalScrollIndicator={false}
			>
				<Animated.View
					style={[
						styles.gridContainer,
						{
							transform: [
								{ translateX: shakeAnimation },
								{ scale: successScale },
							],
						},
					]}
				>
					<View style={styles.grid}>
						{Array.from({ length: rows }, (_, i) => renderRow(i))}
					</View>
				</Animated.View>

				<View style={styles.controls}>
					<TouchableOpacity
						style={[styles.button, styles.clearButton]}
						onPress={handleClear}
						disabled={completed || userPath.length === 0}
						activeOpacity={0.7}
					>
						<Text style={styles.buttonText}>Clear</Text>
					</TouchableOpacity>

					{!completed && !answerRevealed && (
						<TouchableOpacity
							style={[styles.button, styles.showAnswerButton]}
							onPress={handleShowAnswer}
							activeOpacity={0.7}
						>
							<Text style={styles.buttonText}>Show Answer</Text>
						</TouchableOpacity>
					)}

					{completed && (
						<TouchableOpacity
							style={[styles.button, styles.statsButton]}
							onPress={onShowStats}
							activeOpacity={0.7}
						>
							<Text style={styles.buttonText}>View Stats</Text>
						</TouchableOpacity>
					)}
				</View>

				{feedback && (
					<View
						style={[
							styles.feedbackContainer,
							feedback === "Correct!" && styles.feedbackContainerSuccess,
						]}
					>
						<Text
							style={[
								styles.feedback,
								feedback === "Correct!" && styles.feedbackSuccess,
							]}
						>
							{feedback}
						</Text>
					</View>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary,
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
		backgroundColor: "#10B98115", // Game-specific emerald with opacity
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#10B98140",
		...Shadows.light,
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: "#10B981", // Game-specific emerald
		fontFamily: Typography.fontFamily.monospace,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
	},
	gridContainer: {
		marginTop: Spacing.xl,
		marginBottom: Spacing.xl,
		alignItems: "center",
	},
	grid: {
		flexDirection: "column",
		alignItems: "center",
	},
	gridRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
	cell: {
		aspectRatio: 1,
		borderWidth: 2,
		borderRadius: BorderRadius.md,
		justifyContent: "center",
		alignItems: "center",
		margin: Spacing.xs / 4,
		...Shadows.light,
	},
	cellEmpty: {
		backgroundColor: Colors.background.tertiary,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	cellInPath: {
		backgroundColor: "#10B98140", // Game-specific emerald with opacity
		borderColor: "#10B981", // Game-specific emerald
	},
	cellStart: {
		backgroundColor: Colors.game.correct + "40",
		borderColor: Colors.game.correct,
	},
	cellEnd: {
		backgroundColor: "#10B98160", // Game-specific emerald with opacity
		borderColor: "#10B981", // Game-specific emerald
	},
	cellRevealed: {
		backgroundColor: "#10B98120", // Game-specific emerald with opacity
		borderColor: "#10B98160",
	},
	cellCompleted: {
		backgroundColor: Colors.game.correct + "40",
		borderColor: Colors.game.correct,
	},
	cellNumber: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	cellNumberInPath: {
		color: "#10B981", // Game-specific emerald
		fontWeight: Typography.fontWeight.bold,
	},
	cellNumberCompleted: {
		color: Colors.text.white,
	},
	pathIndicator: {
		position: "absolute",
		top: Spacing.xs,
		right: Spacing.xs,
		backgroundColor: "#10B981", // Game-specific emerald
		borderRadius: BorderRadius.sm,
		minWidth: 15,
		height: 15,
		paddingHorizontal: Spacing.xs,
		justifyContent: "center",
		alignItems: "center",
	},
	pathIndicatorCompleted: {
		backgroundColor: Colors.text.white,
		borderWidth: 1,
		borderColor: Colors.game.correct,
	},
	pathIndicatorText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	pathIndicatorTextCompleted: {
		color: Colors.game.correct,
	},
	controls: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.md,
		marginTop: Spacing.lg,
		marginBottom: Spacing.md,
	},
	button: {
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.lg,
		minWidth: 120,
		alignItems: "center",
		justifyContent: "center",
	},
	clearButton: {
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
	},
	showAnswerButton: {
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "40",
	},
	statsButton: {
		backgroundColor: "#10B981", // Game-specific emerald
		...Shadows.medium,
	},
	buttonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	feedbackContainer: {
		marginTop: Spacing.lg,
		padding: Spacing.lg,
		backgroundColor: Colors.error + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.error + "40",
	},
	feedbackContainerSuccess: {
		backgroundColor: Colors.game.correct + "15",
		borderColor: Colors.game.correct + "40",
	},
	feedback: {
		fontSize: Typography.fontSize.body,
		color: Colors.error,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
	},
	feedbackSuccess: {
		color: Colors.game.correct,
	},
});

export default ZipGame;
