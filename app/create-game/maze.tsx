import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../../constants/DesignSystem";
import { saveGameToFirestore } from "../../config/firebase";
import { getCurrentUser, getUserData } from "../../config/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Difficulty = "easy" | "medium" | "hard";
type Step = "path" | "numbers";

const CreateMazePage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState<Step>("path");
	const [cells, setCells] = useState<Array<{ pos: number; number: number }>>(
		[]
	);
	const [solution, setSolution] = useState<number[]>([]);
	const [selectedCell, setSelectedCell] = useState<number | null>(null);

	// Grid size based on difficulty - made bigger for easier path drawing
	const getGridSize = (): { rows: number; cols: number } => {
		switch (difficulty) {
			case "easy":
				return { rows: 6, cols: 6 };
			case "medium":
				return { rows: 7, cols: 7 };
			case "hard":
				return { rows: 8, cols: 8 };
			default:
				return { rows: 6, cols: 6 };
		}
	};

	const { rows, cols } = getGridSize();

	React.useEffect(() => {
		// Reset when difficulty changes
		setCells([]);
		setSolution([]);
		setSelectedCell(null);
		setStep("path");
	}, [difficulty]);

	const posToRowCol = (pos: number): { row: number; col: number } => {
		return { row: Math.floor(pos / cols), col: pos % cols };
	};

	const rowColToPos = (row: number, col: number): number => {
		return row * cols + col;
	};

	const getCellNumber = (row: number, col: number): number | null => {
		const pos = rowColToPos(row, col);
		const cell = cells.find((c) => c.pos === pos);
		return cell ? cell.number : null;
	};

	const isInPath = (row: number, col: number): boolean => {
		const pos = rowColToPos(row, col);
		return solution.includes(pos);
	};

	const getPathIndex = (row: number, col: number): number | null => {
		const pos = rowColToPos(row, col);
		const index = solution.indexOf(pos);
		return index !== -1 ? index : null;
	};

	// Get the direction arrow for a cell in the path
	const getPathDirection = (row: number, col: number): string | null => {
		const pos = rowColToPos(row, col);
		const index = solution.indexOf(pos);
		if (index === -1 || index === solution.length - 1) {
			return null; // Not in path or is the last cell
		}
		const currentRowCol = posToRowCol(pos);
		const nextPos = solution[index + 1];
		const nextRowCol = posToRowCol(nextPos);

		const rowDiff = nextRowCol.row - currentRowCol.row;
		const colDiff = nextRowCol.col - currentRowCol.col;

		if (rowDiff === -1 && colDiff === 0) return "↑"; // Up
		if (rowDiff === 1 && colDiff === 0) return "↓"; // Down
		if (rowDiff === 0 && colDiff === -1) return "←"; // Left
		if (rowDiff === 0 && colDiff === 1) return "→"; // Right

		return null;
	};

	const handleCellPress = (row: number, col: number) => {
		const pos = rowColToPos(row, col);
		if (step === "path") {
			// Build path
			const existingIndex = solution.indexOf(pos);
			if (existingIndex !== -1) {
				// Remove this position and all after it
				setSolution(solution.slice(0, existingIndex));
				// Also remove numbers from removed cells
				setCells(cells.filter((c) => solution.indexOf(c.pos) < existingIndex));
			} else {
				// Check if this cell is adjacent to the last cell in path
				if (solution.length === 0) {
					// First cell
					setSolution([pos]);
				} else {
					const lastPos = solution[solution.length - 1];
					const lastRowCol = posToRowCol(lastPos);
					const rowDiff = Math.abs(lastRowCol.row - row);
					const colDiff = Math.abs(lastRowCol.col - col);
					if (
						(rowDiff === 1 && colDiff === 0) ||
						(rowDiff === 0 && colDiff === 1)
					) {
						// Adjacent - add to path
						setSolution([...solution, pos]);
					} else {
						Alert.alert(
							"Error",
							"Each step must be adjacent to the previous step (horizontally or vertically only)."
						);
					}
				}
			}
		} else {
			// Number mode - auto-assign next number in sequence
			if (!isInPath(row, col)) {
				Alert.alert("Error", "You can only place numbers on path cells.");
				return;
			}

			// Check if this cell already has a number
			const existingCell = cells.find((c) => c.pos === pos);
			if (existingCell) {
				// Cell already numbered, ask if user wants to remove it and all after
				Alert.alert(
					"Remove Number",
					`This cell has number ${existingCell.number}. Remove it and all numbers after it?`,
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Remove",
							style: "destructive",
							onPress: () => {
								// Remove this number and all higher numbers
								const newCells = cells.filter(
									(c) => c.number < existingCell.number
								);
								setCells(newCells);
							},
						},
					]
				);
				return;
			}

			// Find the path index of this cell
			const currentPathIndex = solution.indexOf(pos);

			// Find the maximum number assigned to cells before this one in the path
			let maxNumberBefore = 0;
			for (let i = 0; i < currentPathIndex; i++) {
				const prevPos = solution[i];
				const prevCell = cells.find((c) => c.pos === prevPos);
				if (prevCell && prevCell.number > maxNumberBefore) {
					maxNumberBefore = prevCell.number;
				}
			}

			// Find the minimum number assigned to cells after this one in the path
			let minNumberAfter = solution.length + 1;
			for (let i = currentPathIndex + 1; i < solution.length; i++) {
				const nextPos = solution[i];
				const nextCell = cells.find((c) => c.pos === nextPos);
				if (nextCell && nextCell.number < minNumberAfter) {
					minNumberAfter = nextCell.number;
				}
			}

			// Assign the next valid number (max before + 1)
			// But ensure it's less than min after (if any exists)
			let nextNumber = maxNumberBefore + 1;

			// Check if this number would violate order with cells after
			if (nextNumber >= minNumberAfter) {
				Alert.alert(
					"Invalid Order",
					"Cannot assign this number. It would violate ascending order along the path. Please number cells in path order."
				);
				return;
			}

			// Don't allow numbering beyond path length
			if (nextNumber > solution.length) {
				Alert.alert("Error", "All path cells are already numbered.");
				return;
			}

			// Add the new number
			const newCells = [...cells, { pos, number: nextNumber }];

			// Final validation
			if (!validateAscendingOrder(newCells)) {
				Alert.alert(
					"Invalid Order",
					"Numbers must be in ascending order along the path from start to end."
				);
				return;
			}

			setCells(newCells);
		}
	};

	const validateAscendingOrder = (
		cellsToValidate: Array<{ pos: number; number: number }>
	): boolean => {
		// Create a map of position to number
		const posToNumber = new Map<number, number>();
		cellsToValidate.forEach((cell) => {
			posToNumber.set(cell.pos, cell.number);
		});

		// Check each consecutive pair in the solution path
		for (let i = 0; i < solution.length - 1; i++) {
			const currentPos = solution[i];
			const nextPos = solution[i + 1];

			const currentNum = posToNumber.get(currentPos);
			const nextNum = posToNumber.get(nextPos);

			// If both positions have numbers, check they're in ascending order
			if (currentNum !== undefined && nextNum !== undefined) {
				if (currentNum >= nextNum) {
					return false;
				}
			}
		}

		return true;
	};

	const handleNextStep = () => {
		// Auto-fill first cell with 1 only
		const firstPos = solution[0];

		// Initialize cells with just the first number
		const newCells = [{ pos: firstPos, number: 1 }];

		setCells(newCells);
		setStep("numbers");
	};

	const handlePreviousStep = () => {
		if (step === "numbers") {
			setStep("path");
		}
	};

	const validateMaze = (): boolean => {
		if (solution.length === 0) {
			Alert.alert("Validation Error", "Please draw a complete path first.");
			return false;
		}
		if (solution.length < MINIMUM_PATH_LENGTH) {
			Alert.alert(
				"Validation Error",
				`Path must be at least ${MINIMUM_PATH_LENGTH} cells long.`
			);
			return false;
		}
		// Validate solution path is connected (only horizontal/vertical)
		for (let i = 0; i < solution.length - 1; i++) {
			const currentPos = solution[i];
			const nextPos = solution[i + 1];
			const currentRowCol = posToRowCol(currentPos);
			const nextRowCol = posToRowCol(nextPos);
			const rowDiff = Math.abs(currentRowCol.row - nextRowCol.row);
			const colDiff = Math.abs(currentRowCol.col - nextRowCol.col);
			if (
				(rowDiff === 1 && colDiff === 0) ||
				(rowDiff === 0 && colDiff === 1)
			) {
				// Valid (adjacent horizontally or vertically)
			} else {
				Alert.alert(
					"Validation Error",
					`Solution step ${i + 1} to ${
						i + 2
					} is not adjacent horizontally or vertically.`
				);
				return false;
			}
		}
		// Validate first cell has number 1
		const firstPos = solution[0];
		const firstCell = cells.find((c) => c.pos === firstPos);
		if (!firstCell || firstCell.number !== 1) {
			Alert.alert(
				"Validation Error",
				"The first cell in the path must have number 1."
			);
			return false;
		}
		// Validate last cell has the last number
		const lastPos = solution[solution.length - 1];
		const lastCell = cells.find((c) => c.pos === lastPos);
		// if (!lastCell || lastCell.number !== solution.length) {
		// 	Alert.alert(
		// 		"Validation Error",
		// 		`The last cell in the path must have number ${solution.length}.`
		// 	);
		// 	return false;
		// }
		// Validate all numbered cells are in the path
		const pathPositions = new Set(solution);
		for (const cell of cells) {
			if (!pathPositions.has(cell.pos)) {
				const rowCol = posToRowCol(cell.pos);
				Alert.alert(
					"Validation Error",
					`Numbered cell at row ${rowCol.row + 1}, column ${
						rowCol.col + 1
					} is not on the path.`
				);
				return false;
			}
		}
		// Validate numbers are in ascending order along the path
		if (!validateAscendingOrder(cells)) {
			Alert.alert(
				"Validation Error",
				"Numbers must be in ascending order along the path from start to end."
			);
			return false;
		}
		return true;
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateZip()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			await saveGameToFirestore(
				"maze",
				difficulty,
				{
					rows,
					cols,
					cells,
					solution,
				},
				user.uid,
				username
			);
			Alert.alert("Success", "Your Maze game has been created successfully!", [
				{
					text: "OK",
					onPress: () => router.back(),
				},
			]);
		} catch (error: any) {
			console.error("Error creating game:", error);
			Alert.alert(
				"Error",
				error.message || "Failed to create game. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	// Calculate cell size based on grid dimensions - same as MazeGame.tsx
	const gridPadding = Spacing.xl * 2;
	const availableWidth = SCREEN_WIDTH - gridPadding;
	const cellMargin = 2; // Margin between cells
	const cellSize = Math.floor(
		(availableWidth - (cols - 1) * cellMargin * 2) / cols
	);

	const MINIMUM_PATH_LENGTH = rows * rows; // Grid size (n for n×n grid)
	const pathComplete = solution.length >= MINIMUM_PATH_LENGTH;

	// Check if first and last cells are filled
	const firstPos = solution.length > 0 ? solution[0] : null;
	const lastPos = solution.length > 0 ? solution[solution.length - 1] : null;
	const firstCellFilled =
		firstPos !== null && cells.some((c) => c.pos === firstPos);
	const lastCellFilled =
		lastPos !== null && cells.some((c) => c.pos === lastPos);
	const requiredCellsFilled = firstCellFilled && lastCellFilled;

	const hasMinimumNumbers = cells.length >= 2;

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Create Maze</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Create Maze Game</Text>
				<Text style={styles.description}>
					Draw a path, then fill the first and last cells with numbers. Cell 1
					is pre-filled. You can optionally number other cells as hints.
				</Text>

				{/* Difficulty Selector */}
				<View style={styles.selectorContainer}>
					<Text style={styles.label}>Difficulty</Text>
					<View style={styles.selectorRow}>
						{(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
							<TouchableOpacity
								key={diff}
								style={[
									styles.selectorButton,
									difficulty === diff && styles.selectorButtonActive,
								]}
								onPress={() => setDifficulty(diff)}
							>
								<Text
									style={[
										styles.selectorButtonText,
										difficulty === diff && styles.selectorButtonTextActive,
									]}
								>
									{diff.charAt(0).toUpperCase() + diff.slice(1)}
								</Text>
							</TouchableOpacity>
						))}
					</View>
					<Text style={styles.helperText}>
						Grid size: {rows}x{cols}
					</Text>
				</View>

				{/* Step Indicator */}
				<View style={styles.stepIndicator}>
					<View style={styles.stepRow}>
						<View
							style={[
								styles.stepCircle,
								step === "path" && styles.stepCircleActive,
							]}
						>
							<Text
								style={[
									styles.stepNumber,
									step === "path" && styles.stepNumberActive,
								]}
							>
								1
							</Text>
						</View>
						<View
							style={[
								styles.stepLine,
								step === "numbers" && styles.stepLineActive,
							]}
						/>
						<View
							style={[
								styles.stepCircle,
								step === "numbers" && styles.stepCircleActive,
							]}
						>
							<Text
								style={[
									styles.stepNumber,
									step === "numbers" && styles.stepNumberActive,
								]}
							>
								2
							</Text>
						</View>
					</View>
					<View style={styles.stepLabels}>
						<Text
							style={[
								styles.stepLabel,
								step === "path" && styles.stepLabelActive,
							]}
						>
							Draw Path
						</Text>
						<Text
							style={[
								styles.stepLabel,
								step === "numbers" && styles.stepLabelActive,
							]}
						>
							Add Numbers
						</Text>
					</View>
				</View>

				{/* Next Step Button - appears when path is complete */}
				{pathComplete && step === "path" && (
					<TouchableOpacity
						style={styles.nextStepButton}
						onPress={handleNextStep}
					>
						<Text style={styles.nextStepButtonText}>
							Next Step: Add Numbers
						</Text>
						<Ionicons
							name="arrow-forward"
							size={20}
							color={Colors.text.primary}
						/>
					</TouchableOpacity>
				)}

				{/* Grid */}
				<View style={styles.gridContainer}>
					<Text style={styles.label}>
						{step === "path" ? "Step 1: Draw Path" : "Step 2: Add Numbers"}
					</Text>
					<Text style={styles.helperText}>
						{step === "path"
							? `Tap cells to build your path. Path length: ${solution.length} cells (minimum ${MINIMUM_PATH_LENGTH} required)`
							: `Tap path cells to auto-number them sequentially. Only first and last cells required. Numbers placed: ${cells.length}`}
					</Text>
					<View style={styles.grid}>
						{Array.from({ length: rows }).map((_, rowIndex) => (
							<View key={rowIndex} style={styles.gridRow}>
								{Array.from({ length: cols }).map((_, colIndex) => {
									const cellNumber = getCellNumber(rowIndex, colIndex);
									const inPath = isInPath(rowIndex, colIndex);
									const pathIndex = getPathIndex(rowIndex, colIndex);
									const pos = rowColToPos(rowIndex, colIndex);
									const isSelected = selectedCell === pos;
									return (
										<TouchableOpacity
											key={colIndex}
											style={[
												styles.cell,
												{
													width: cellSize,
													height: cellSize,
													backgroundColor: isSelected
														? Colors.accent + "30"
														: inPath
														? Colors.accent + "20"
														: Colors.background.tertiary ||
														  Colors.background.secondary,
													borderColor: isSelected
														? Colors.accent
														: inPath
														? Colors.accent
														: "rgba(255, 255, 255, 0.2)",
												},
											]}
											onPress={() => handleCellPress(rowIndex, colIndex)}
											activeOpacity={0.7}
										>
											{/* Number in center (primary) */}
											{cellNumber !== null && (
												<Text style={styles.cellNumberText}>{cellNumber}</Text>
											)}

											{/* Arrow in top-left corner (secondary, smaller) */}
											{inPath && getPathDirection(rowIndex, colIndex) && (
												<View style={styles.pathArrowContainer}>
													<Text style={styles.pathArrowText}>
														{getPathDirection(rowIndex, colIndex)}
													</Text>
												</View>
											)}

											{/* Path sequence in bottom-right corner */}
											{inPath && pathIndex !== null && (
												<View style={styles.pathIndicator}>
													<Text style={styles.pathIndicatorText}>
														{pathIndex + 1}
													</Text>
												</View>
											)}
										</TouchableOpacity>
									);
								})}
							</View>
						))}
					</View>
				</View>

				{/* Instructions for numbering */}
				{step === "numbers" && (
					<View style={styles.instructionContainer}>
						<Text style={styles.instructionText}>
							💡 Tap cells to number them sequentially. Only the first and last
							cells are required. You can add optional hints to other cells.
						</Text>
					</View>
				)}

				{/* Clear Buttons */}
				{step === "path" && solution.length > 0 && (
					<TouchableOpacity
						style={styles.clearButton}
						onPress={() => {
							setSolution([]);
							setCells([]);
							setSelectedCell(null);
						}}
					>
						<Ionicons
							name="trash-outline"
							size={20}
							color={Colors.text.primary}
						/>
						<Text style={styles.clearButtonText}>Clear Path</Text>
					</TouchableOpacity>
				)}
				{step === "numbers" && cells.length > 1 && (
					<TouchableOpacity
						style={styles.clearButton}
						onPress={() => {
							// Keep only the first cell (number 1)
							const firstPos = solution[0];
							const requiredCells = cells.filter((c) => c.pos === firstPos);
							setCells(requiredCells);
							setSelectedCell(null);
						}}
					>
						<Ionicons
							name="trash-outline"
							size={20}
							color={Colors.text.primary}
						/>
						<Text style={styles.clearButtonText}>Clear All Numbers</Text>
					</TouchableOpacity>
				)}

				{/* Back to Path Button - in numbers step */}
				{step === "numbers" && (
					<TouchableOpacity
						style={styles.backToPathButton}
						onPress={() => {
							handlePreviousStep();
							setSelectedCell(null);
						}}
					>
						<Ionicons name="arrow-back" size={20} color={Colors.accent} />
						<Text style={styles.backToPathButtonText}>Back to Edit Path</Text>
					</TouchableOpacity>
				)}

				{/* Progress Indicator */}
				{step === "numbers" && (
					<View style={styles.progressContainer}>
						<Text style={styles.progressText}>
							{requiredCellsFilled
								? `✓ First and last cells filled - Ready to create!`
								: `Fill first and last cells. Numbers placed: ${cells.length}`}
						</Text>
					</View>
				)}

				<TouchableOpacity
					style={[
						styles.submitButton,
						(loading || !requiredCellsFilled || step !== "numbers") &&
							styles.submitButtonDisabled,
					]}
					onPress={handleSubmit}
					disabled={loading || !requiredCellsFilled || step !== "numbers"}
				>
					{loading ? (
						<ActivityIndicator size="small" color={Colors.text.primary} />
					) : (
						<>
							<Ionicons
								name="checkmark-circle"
								size={24}
								color={Colors.text.primary}
							/>
							<Text style={styles.submitButtonText}>Create Game</Text>
						</>
					)}
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		paddingHorizontal: Spacing.md,
		paddingBottom: Spacing.md,
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	headerSpacer: {
		width: 40,
	},
	content: {
		flex: 1,
		paddingHorizontal: Layout.margin,
	},
	scrollContent: {
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	sectionTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
	},
	description: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.lg,
		lineHeight: 20,
	},
	selectorContainer: {
		marginBottom: Spacing.lg,
	},
	label: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
		marginTop: Spacing.md,
	},
	helperText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	selectorRow: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	selectorButton: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	selectorButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	selectorButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	selectorButtonTextActive: {
		color: Colors.accent,
	},
	modeButton: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	modeButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	modeButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	modeButtonTextActive: {
		color: Colors.accent,
	},
	gridContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.xl,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
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
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.md,
		position: "relative",
		borderWidth: 2,
		margin: Spacing.xs / 4,
		...Shadows.light,
	},
	cellNumberText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		zIndex: 1,
	},
	pathIndicator: {
		position: "absolute",
		bottom: 2,
		right: 2,
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.sm,
		minWidth: 15,
		height: 15,
		paddingHorizontal: 4,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	pathIndicatorText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.regular,
		color: Colors.text.white,
	},
	pathArrowContainer: {
		position: "absolute",
		top: 2,
		left: 2,
		backgroundColor: Colors.accent + "CC",
		borderRadius: BorderRadius.sm,
		width: 17,
		height: 17,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	pathArrowText: {
		fontSize: 14,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	numberPadContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	numberPad: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginTop: Spacing.md,
		justifyContent: "center",
	},
	numberButton: {
		width:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.sm * 2) / 5,
		height: 50,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	numberButtonActive: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
	},
	numberButtonDisabled: {
		opacity: 0.3,
		backgroundColor: Colors.background.tertiary,
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	numberButtonTextActive: {
		color: Colors.text.primary,
	},
	numberButtonTextDisabled: {
		color: Colors.text.disabled,
	},
	instructionContainer: {
		backgroundColor: Colors.accent + "10",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: Colors.accent + "30",
	},
	instructionText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: 20,
	},
	stepIndicator: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	stepRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	stepCircle: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.background.secondary,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		alignItems: "center",
		justifyContent: "center",
	},
	stepCircleActive: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
	},
	stepNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},
	stepNumberActive: {
		color: Colors.text.primary,
	},
	stepLine: {
		width: 60,
		height: 2,
		backgroundColor: "#E5E5E5",
		marginHorizontal: Spacing.sm,
	},
	stepLineActive: {
		backgroundColor: Colors.accent,
	},
	stepLabels: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.xs,
	},
	stepLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	stepLabelActive: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	nextStepButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.lg,
		gap: Spacing.sm,
		...Shadows.medium,
	},
	nextStepButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	clearNumberButton: {
		backgroundColor: Colors.text.secondary + "20",
	},
	clearButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.text.secondary + "20",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		gap: Spacing.sm,
	},
	clearButtonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	backToPathButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: Colors.accent,
		gap: Spacing.sm,
	},
	backToPathButtonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.accent,
		fontWeight: Typography.fontWeight.medium,
	},
	progressContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		alignItems: "center",
	},
	progressText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.xl,
		marginBottom: Spacing.xxl,
		...Shadows.heavy,
	},
	submitButtonDisabled: {
		opacity: 0.5,
	},
	submitButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginLeft: Spacing.sm,
	},
});

export default CreateMazePage;
