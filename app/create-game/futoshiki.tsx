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

const CreateFutoshikiPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [selectedCell, setSelectedCell] = useState<{
		row: number;
		col: number;
	} | null>(null);
	const [inequalityMode, setInequalityMode] = useState<"<" | ">" | null>(null);
	const [inequalities, setInequalities] = useState<
		Array<{
			row1: number;
			col1: number;
			row2: number;
			col2: number;
			operator: "<" | ">";
		}>
	>([]);
	const [givens, setGivens] = useState<Set<string>>(new Set());

	// Grid size based on difficulty - fixed sizes
	const getGridSize = (): number => {
		switch (difficulty) {
			case "easy":
				return 5;
			case "medium":
				return 6;
			case "hard":
				return 7;
			default:
				return 5;
		}
	};

	const size = getGridSize();
	const [grid, setGrid] = useState<(number | null)[][]>(
		Array(size)
			.fill(null)
			.map(() => Array(size).fill(null))
	);

	React.useEffect(() => {
		// Reset grid when difficulty changes
		const newSize = getGridSize();
		setGrid(
			Array(newSize)
				.fill(null)
				.map(() => Array(newSize).fill(null))
		);
		setInequalities([]);
		setSelectedCell(null);
		setInequalityMode(null);
		setStep(1);
		setGivens(new Set());
	}, [difficulty]);

	const getInequality = (
		row1: number,
		col1: number,
		row2: number,
		col2: number
	): "<" | ">" | null => {
		const ineq = inequalities.find(
			(i) =>
				(i.row1 === row1 &&
					i.col1 === col1 &&
					i.row2 === row2 &&
					i.col2 === col2) ||
				(i.row1 === row2 &&
					i.col1 === col2 &&
					i.row2 === row1 &&
					i.col2 === col1)
		);
		if (!ineq) return null;
		// If reversed, flip the operator
		if (ineq.row1 === row2 && ineq.col1 === col2) {
			return ineq.operator === "<" ? ">" : "<";
		}
		return ineq.operator;
	};

	const handleCellPress = (row: number, col: number) => {
		if (step === 1) {
			// Step 1: Fill grid
				setSelectedCell({ row, col });
		} else if (step === 3) {
			// Step 3: Toggle givens
			const key = `${row},${col}`;
			const newGivens = new Set(givens);
			if (newGivens.has(key)) {
				newGivens.delete(key);
		} else {
				newGivens.add(key);
			}
			setGivens(newGivens);
		}
	};

	const handleInequalitySpacePress = (
		row: number,
		col: number,
		direction: "right" | "down"
	) => {
		if (direction === "right" && col < size - 1) {
			const existing = getInequality(row, col, row, col + 1);
			if (existing === "<") {
				// Toggle to >
				const newInequalities = inequalities.filter(
					(i) =>
						!(
							(i.row1 === row &&
								i.col1 === col &&
								i.row2 === row &&
								i.col2 === col + 1) ||
							(i.row1 === row &&
								i.col1 === col + 1 &&
								i.row2 === row &&
								i.col2 === col)
						)
				);
				newInequalities.push({
					row1: row,
					col1: col,
					row2: row,
					col2: col + 1,
					operator: ">",
				});
				setInequalities(newInequalities);
			} else if (existing === ">") {
				// Remove
				setInequalities(
					inequalities.filter(
						(i) =>
							!(
								(i.row1 === row &&
									i.col1 === col &&
									i.row2 === row &&
									i.col2 === col + 1) ||
								(i.row1 === row &&
									i.col1 === col + 1 &&
									i.row2 === row &&
									i.col2 === col)
							)
					)
				);
			} else {
				// Add <
				setInequalities([
					...inequalities,
					{
						row1: row,
						col1: col,
						row2: row,
						col2: col + 1,
						operator: "<",
					},
				]);
			}
		} else if (direction === "down" && row < size - 1) {
			const existing = getInequality(row, col, row + 1, col);
			if (existing === "<") {
				// Toggle to >
				const newInequalities = inequalities.filter(
					(i) =>
						!(
							(i.row1 === row &&
								i.col1 === col &&
								i.row2 === row + 1 &&
								i.col2 === col) ||
							(i.row1 === row + 1 &&
								i.col1 === col &&
								i.row2 === row &&
								i.col2 === col)
						)
				);
				newInequalities.push({
					row1: row,
					col1: col,
					row2: row + 1,
					col2: col,
					operator: ">",
				});
				setInequalities(newInequalities);
			} else if (existing === ">") {
				// Remove
				setInequalities(
					inequalities.filter(
						(i) =>
							!(
								(i.row1 === row &&
									i.col1 === col &&
									i.row2 === row + 1 &&
									i.col2 === col) ||
								(i.row1 === row + 1 &&
									i.col1 === col &&
									i.row2 === row &&
									i.col2 === col)
							)
					)
				);
			} else {
				// Add <
				setInequalities([
					...inequalities,
					{
						row1: row,
						col1: col,
						row2: row + 1,
						col2: col,
						operator: "<",
					},
				]);
			}
		}
	};

	const handleNumberSelect = (num: number) => {
		if (selectedCell) {
			const newGrid = [...grid];
			newGrid[selectedCell.row] = [...newGrid[selectedCell.row]];
			// If same number, clear it; otherwise set it
			if (newGrid[selectedCell.row][selectedCell.col] === num) {
				newGrid[selectedCell.row][selectedCell.col] = null;
			} else {
				newGrid[selectedCell.row][selectedCell.col] = num;
			}
			setGrid(newGrid);
		}
	};

	const handleClearCell = () => {
		if (selectedCell) {
			const newGrid = [...grid];
			newGrid[selectedCell.row] = [...newGrid[selectedCell.row]];
			newGrid[selectedCell.row][selectedCell.col] = null;
			setGrid(newGrid);
		}
	};

	const validateStep1 = (): boolean => {
		// Check all cells are filled
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				if (grid[row][col] === null) {
					Alert.alert(
						"Validation Error",
						`Please fill all cells. Missing value at row ${row + 1}, column ${
							col + 1
						}.`
					);
					return false;
				}
			}
		}

		// Validate rows (each row must contain 1 to size exactly once)
		for (let row = 0; row < size; row++) {
			const values = grid[row].filter((v) => v !== null) as number[];
			const unique = new Set(values);
			if (unique.size !== size) {
				Alert.alert("Validation Error", `Row ${row + 1} has duplicate values.`);
				return false;
			}
			const sorted = [...values].sort((a, b) => a - b);
			const expected = Array.from({ length: size }, (_, i) => i + 1);
			if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
				Alert.alert(
					"Validation Error",
					`Row ${row + 1} must contain numbers 1 to ${size}.`
				);
				return false;
			}
		}

		// Validate columns
		for (let col = 0; col < size; col++) {
			const values: number[] = [];
			for (let row = 0; row < size; row++) {
				if (grid[row][col] !== null) {
					values.push(grid[row][col]!);
				}
			}
			const unique = new Set(values);
			if (unique.size !== size) {
				Alert.alert(
					"Validation Error",
					`Column ${col + 1} has duplicate values.`
				);
				return false;
			}
		}

		return true;
	};

	const validateStep2 = (): boolean => {
		// Validate inequalities
		for (let i = 0; i < inequalities.length; i++) {
			const ineq = inequalities[i];
			const val1 = grid[ineq.row1][ineq.col1];
			const val2 = grid[ineq.row2][ineq.col2];
			if (val1 === null || val2 === null) continue;
			if (ineq.operator === "<" && val1 >= val2) {
				Alert.alert(
					"Validation Error",
					`Inequality ${i + 1} is invalid: ${val1} at (${ineq.row1 + 1},${
						ineq.col1 + 1
					}) must be less than ${val2} at (${ineq.row2 + 1},${ineq.col2 + 1}).`
				);
				return false;
			}
			if (ineq.operator === ">" && val1 <= val2) {
				Alert.alert(
					"Validation Error",
					`Inequality ${i + 1} is invalid: ${val1} at (${ineq.row1 + 1},${
						ineq.col1 + 1
					}) must be greater than ${val2} at (${ineq.row2 + 1},${
						ineq.col2 + 1
					}).`
				);
				return false;
			}
		}

		if (inequalities.length === 0) {
			Alert.alert(
				"Validation Error",
				"Please add at least one inequality sign."
			);
			return false;
		}

		return true;
	};

	const validateStep3 = (): boolean => {
		if (givens.size === 0) {
			Alert.alert(
				"Validation Error",
				"Please select at least one cell to be given (revealed)."
			);
			return false;
		}

		return true;
	};

	const handleNextStep = () => {
		if (step === 1) {
			if (validateStep1()) {
				setStep(2);
				setSelectedCell(null);
			}
		} else if (step === 2) {
			if (validateStep2()) {
				setStep(3);
			}
		}
	};

	const handlePreviousStep = () => {
		if (step === 2) {
			setStep(1);
		} else if (step === 3) {
			setStep(2);
		}
	};

	const getGivensArray = (): Array<{
		row: number;
		col: number;
		value: number;
	}> => {
		const givensArray: Array<{ row: number; col: number; value: number }> = [];
		givens.forEach((key) => {
			const [row, col] = key.split(",").map(Number);
			givensArray.push({
				row,
				col,
				value: grid[row][col]!,
			});
		});
		return givensArray;
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateStep3()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Flatten grid to 1D array
			const flatGrid: number[] = [];
			for (let row = 0; row < size; row++) {
				for (let col = 0; col < size; col++) {
					flatGrid.push(grid[row][col]!);
				}
			}

			// Get givens from selected cells
			const givensArray = getGivensArray();

			await saveGameToFirestore(
				"futoshiki",
				difficulty,
				{
					size,
					grid: flatGrid,
					givens: givensArray,
					inequalities,
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Futoshiki game has been created successfully!",
				[
				{
					text: "OK",
					onPress: () => router.back(),
				},
				]
			);
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

	// Calculate cell size with uniform gaps between cells (horizontal = vertical)
	const maxGridWidth = SCREEN_WIDTH - Spacing.xl * 2;
	const gapRatio = 0.45; // 45% of cell width for both directions
	const cellSize = Math.floor(maxGridWidth / (size + (size - 1) * gapRatio));
	const cellSizeClamped = Math.min(cellSize, 80);

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
				<Text style={styles.headerTitle}>Create Futoshiki</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Create Futoshiki Game</Text>
				<Text style={styles.description}>
					{step === 1 &&
						"Step 1: Fill the grid with numbers. Each row and column must contain 1 to " +
							size +
							" exactly once."}
					{step === 2 &&
						"Step 2: Tap the spaces between cells to add inequality signs. Tap once for <, twice for >, three times to remove."}
					{step === 3 &&
						"Step 3: Tap cells to mark them as givens (revealed to players)."}
				</Text>

				{/* Step Indicator */}
				<View style={styles.stepIndicator}>
					<View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
					<View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
					<View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
					<View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
					<View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
				</View>

				{/* Difficulty Selector */}
				{step === 1 && (
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
							Grid size: {size}x{size}
					</Text>
				</View>
				)}

				{/* Grid */}
				<View style={styles.gridContainer}>
					<Text style={styles.label}>
						{step === 1 && `Complete Solution (${size}x${size})`}
						{step === 2 && `Add Inequalities`}
						{step === 3 && `Select Givens (${givens.size} selected)`}
					</Text>
					<View style={styles.grid}>
						{grid.map((row, rowIndex) => (
							<React.Fragment key={rowIndex}>
								<View style={styles.gridRow}>
								{row.map((cell, colIndex) => {
									const isSelected =
										selectedCell?.row === rowIndex &&
										selectedCell?.col === colIndex;
										const isGiven = givens.has(`${rowIndex},${colIndex}`);
										const rightIneq =
											colIndex < size - 1
												? getInequality(
														rowIndex,
														colIndex,
														rowIndex,
														colIndex + 1
												  )
										: null;
									return (
										<React.Fragment key={colIndex}>
											<TouchableOpacity
												style={[
													styles.cell,
													{
															width: cellSizeClamped,
															height: cellSizeClamped,
															backgroundColor: isGiven
																? "#4CAF5020"
																: isSelected
															? Colors.accent + "20"
															: Colors.background.secondary,
															borderColor: isGiven
																? "#4CAF50"
																: isSelected
															? Colors.accent
															: "#E5E5E5",
													},
												]}
												onPress={() => handleCellPress(rowIndex, colIndex)}
												activeOpacity={0.7}
													disabled={step === 2}
											>
												<Text
													style={[
														styles.cellText,
															(isSelected || isGiven) &&
																styles.cellTextSelected,
													]}
												>
													{cell !== null ? cell.toString() : ""}
												</Text>
											</TouchableOpacity>
											{colIndex < size - 1 && (
												<TouchableOpacity
													style={[
														styles.inequalitySpace,
															step === 2 && styles.inequalitySpaceActive,
														{
																width: cellSizeClamped * gapRatio,
																height: cellSizeClamped,
														},
													]}
													onPress={() =>
															handleInequalitySpacePress(
																rowIndex,
																colIndex,
																"right"
															)
													}
													activeOpacity={0.7}
														disabled={step !== 2}
												>
														<Text
															style={[
																styles.inequalityText,
																step !== 2 && styles.inequalityTextDisabled,
															]}
														>
															{rightIneq || (step === 2 ? "·" : " ")}
													</Text>
												</TouchableOpacity>
											)}
										</React.Fragment>
									);
								})}
							</View>

								{rowIndex < size - 1 && (
									<View style={styles.gridRow}>
									{row.map((_, colIndex) => {
										const downIneq = getInequality(
											rowIndex,
											colIndex,
											rowIndex + 1,
											colIndex
										);
										return (
												<React.Fragment key={`down-${rowIndex}-${colIndex}`}>
												<View
													style={[
														styles.inequalitySpace,
															step === 2 && styles.inequalitySpaceActive,
														{
																width: cellSizeClamped,
																height: cellSizeClamped * gapRatio,
														},
													]}
												>
													<TouchableOpacity
														style={styles.inequalitySpaceTouchable}
														onPress={() =>
																handleInequalitySpacePress(
																	rowIndex,
																	colIndex,
																	"down"
																)
														}
														activeOpacity={0.7}
															disabled={step !== 2}
													>
															<Text
																style={[
																	styles.inequalityTextVertical,
																	step !== 2 && styles.inequalityTextDisabled,
																]}
															>
																{downIneq || (step === 2 ? "·" : " ")}
														</Text>
													</TouchableOpacity>
												</View>
												{colIndex < size - 1 && (
													<View
														style={[
															styles.inequalitySpace,
															{
																	width: cellSizeClamped * gapRatio,
																	height: cellSizeClamped * gapRatio,
															},
														]}
													/>
												)}
											</React.Fragment>
										);
									})}
								</View>
								)}
							</React.Fragment>
						))}
					</View>
				</View>

				{/* Number Pad */}
				{selectedCell && step === 1 && (
					<View style={styles.numberPadContainer}>
						<Text style={styles.label}>Select Number</Text>
						<View style={styles.numberPad}>
							{Array.from({ length: size }, (_, i) => i + 1).map((num) => (
								<TouchableOpacity
									key={num}
									style={[
										styles.numberButton,
										grid[selectedCell.row][selectedCell.col] === num &&
											styles.numberButtonActive,
									]}
									onPress={() => handleNumberSelect(num)}
								>
									<Text
										style={[
											styles.numberButtonText,
											grid[selectedCell.row][selectedCell.col] === num &&
												styles.numberButtonTextActive,
										]}
									>
										{num}
									</Text>
								</TouchableOpacity>
							))}
							<TouchableOpacity
								style={[styles.numberButton, styles.clearButton]}
								onPress={handleClearCell}
							>
								<Ionicons name="close" size={20} color={Colors.text.primary} />
							</TouchableOpacity>
						</View>
					</View>
				)}

				{/* Navigation Buttons */}
				<View style={styles.navigationContainer}>
					{/* Previous Button */}
					{step > 1 && (
						<TouchableOpacity
							style={styles.previousButton}
							onPress={handlePreviousStep}
						>
							<Ionicons
								name="arrow-back"
								size={20}
								color={Colors.text.primary}
							/>
							<Text style={styles.previousButtonText}>Previous</Text>
						</TouchableOpacity>
					)}

					{/* Next Step Button */}
					{step < 3 && (
						<TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
							<Text style={styles.nextButtonText}>
								{step === 1 ? "Next: Add Inequalities" : "Next: Select Givens"}
							</Text>
							<Ionicons
								name="arrow-forward"
								size={20}
								color={Colors.text.primary}
							/>
						</TouchableOpacity>
					)}
				</View>

				{/* Submit Button */}
				{step === 3 && (
				<TouchableOpacity
					style={[
						styles.submitButton,
						loading && styles.submitButtonDisabled,
					]}
					onPress={handleSubmit}
					disabled={loading}
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
				)}
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
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	grid: {
		flexDirection: "column",
		alignItems: "center",
		marginTop: Spacing.md,
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
		borderWidth: 2,
		...Shadows.light,
	},
	cellText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	cellTextSelected: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	inequalitySpace: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.primary,
		display: "flex",
	},
	inequalitySpaceActive: {
		backgroundColor: Colors.accent + "10",
		borderRadius: BorderRadius.sm,
	},
	inequalitySpaceTouchable: {
		width: "100%",
		height: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	inequalityText: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		textAlign: "center",
		textAlignVertical: "center",
		lineHeight: Typography.fontSize.h1,
	},
	inequalityTextVertical: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		textAlign: "center",
		textAlignVertical: "center",
		lineHeight: Typography.fontSize.h1,
		width: "100%",
		transform: [{ rotate: "90deg" }],
	},
	inequalityTextDisabled: {
		opacity: 0.5,
	},
	stepIndicator: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	stepDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: "#E5E5E5",
		borderWidth: 2,
		borderColor: "#E5E5E5",
	},
	stepDotActive: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
	},
	stepLine: {
		width: 40,
		height: 2,
		backgroundColor: "#E5E5E5",
	},
	stepLineActive: {
		backgroundColor: Colors.accent,
	},
	navigationContainer: {
		flexDirection: "row",
		gap: Spacing.md,
		marginTop: Spacing.xl,
	},
	previousButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: Colors.border || "#E5E5E5",
	},
	previousButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	nextButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		gap: Spacing.sm,
		...Shadows.heavy,
	},
	nextButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
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
		gap: Spacing.md,
		marginTop: Spacing.md,
		justifyContent: "center",
		paddingHorizontal: Spacing.xs,
	},
	numberButton: {
		width:
			(SCREEN_WIDTH -
				Layout.margin * 2 -
				Spacing.md * 2 -
				Spacing.md * 5 -
				Spacing.xs * 2) /
			6,
		height: 56,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: "#E5E5E5",
		...Shadows.light,
	},
	numberButtonActive: {
		backgroundColor: Colors.accent,
		borderColor: Colors.accent,
		...Shadows.medium,
	},
	numberButtonText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	numberButtonTextActive: {
		color: "#FFFFFF",
	},
	clearButton: {
		backgroundColor: Colors.text.secondary + "15",
		borderColor: Colors.text.secondary + "30",
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

export default CreateFutoshikiPage;
