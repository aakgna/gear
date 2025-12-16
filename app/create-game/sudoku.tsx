import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
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

const SIZE = 9; // Sudoku is always 9x9

const CreateSudokuPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [grid, setGrid] = useState<(number | null)[][]>(
		Array(SIZE)
			.fill(null)
			.map(() => Array(SIZE).fill(null))
	);
	const [selectedCell, setSelectedCell] = useState<{
		row: number;
		col: number;
	} | null>(null);

	const handleCellPress = (row: number, col: number) => {
		setSelectedCell({ row, col });
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

	const validateSudoku = (): boolean => {
		// Check all cells are filled
		for (let row = 0; row < SIZE; row++) {
			for (let col = 0; col < SIZE; col++) {
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

		// Validate rows
		for (let row = 0; row < SIZE; row++) {
			const values = grid[row].filter((v) => v !== null) as number[];
			const unique = new Set(values);
			if (unique.size !== SIZE) {
				Alert.alert("Validation Error", `Row ${row + 1} has duplicate values.`);
				return false;
			}
		}

		// Validate columns
		for (let col = 0; col < SIZE; col++) {
			const values: number[] = [];
			for (let row = 0; row < SIZE; row++) {
				if (grid[row][col] !== null) {
					values.push(grid[row][col]!);
				}
			}
			const unique = new Set(values);
			if (unique.size !== SIZE) {
				Alert.alert(
					"Validation Error",
					`Column ${col + 1} has duplicate values.`
				);
				return false;
			}
		}

		// Validate 3x3 boxes
		for (let boxRow = 0; boxRow < 3; boxRow++) {
			for (let boxCol = 0; boxCol < 3; boxCol++) {
				const values: number[] = [];
				for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
					for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
						if (grid[row][col] !== null) {
							values.push(grid[row][col]!);
						}
					}
				}
				const unique = new Set(values);
				if (unique.size !== SIZE) {
					Alert.alert(
						"Validation Error",
						`Box at row ${boxRow + 1}, column ${
							boxCol + 1
						} has duplicate values.`
					);
					return false;
				}
			}
		}

		return true;
	};

	const generateGivens = (): Array<{
		row: number;
		col: number;
		value: number;
	}> => {
		// Determine number of givens based on difficulty
		let numGivens: number;
		if (difficulty === "easy") {
			numGivens = Math.floor(Math.random() * 9) + 49; // 49-57
		} else if (difficulty === "medium") {
			numGivens = Math.floor(Math.random() * 10) + 32; // 32-41
		} else {
			numGivens = Math.floor(Math.random() * 13) + 20; // 20-32
		}

		// Create list of all positions
		const allPositions: Array<{ row: number; col: number }> = [];
		for (let row = 0; row < SIZE; row++) {
			for (let col = 0; col < SIZE; col++) {
				allPositions.push({ row, col });
			}
		}

		// Randomly select positions to keep as givens
		const shuffled = [...allPositions].sort(() => Math.random() - 0.5);
		const givenPositions = shuffled.slice(0, numGivens);

		// Create givens array
		return givenPositions.map((pos) => ({
			row: pos.row,
			col: pos.col,
			value: grid[pos.row][pos.col]!,
		}));
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateSudoku()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Flatten grid to 1D array
			const flatGrid: number[] = [];
			for (let row = 0; row < SIZE; row++) {
				for (let col = 0; col < SIZE; col++) {
					flatGrid.push(grid[row][col]!);
				}
			}

			// Generate givens based on difficulty
			const givens = generateGivens();

			await saveGameToFirestore(
				"sudoku",
				difficulty,
				{
					grid: flatGrid,
					givens,
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Sudoku game has been created successfully!",
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

	// Calculate cell size based on grid dimensions with tiny gaps
	const cellGap = 1; // Tiny gap so cells don't touch the dividing lines
	const maxGridWidth = SCREEN_WIDTH - Spacing.xl * 2;
	const cellSize = Math.floor((maxGridWidth - cellGap * (SIZE - 1)) / SIZE);
	const cellSizeClamped = Math.min(cellSize, 80);
	const totalGridWidth = cellSizeClamped * SIZE + cellGap * (SIZE - 1);

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
				<Text style={styles.headerTitle}>Create Sudoku</Text>
				<View style={styles.headerSpacer} />
			</View>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<ScrollView
					style={styles.content}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					<Text style={styles.sectionTitle}>Create Sudoku Game</Text>
					<Text style={styles.description}>
						Enter the complete solution. Based on difficulty, some cells will be
						revealed as givens.
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
							{difficulty === "easy"
								? "49-57 cells revealed"
								: difficulty === "medium"
								? "32-41 cells revealed"
								: "20-32 cells revealed"}
						</Text>
					</View>

					{/* Grid */}
					<View style={styles.gridContainer}>
						<Text style={styles.label}>Complete Solution (9x9)</Text>
						<Text style={styles.helperText}>
							Tap a cell to select it, then use the number pad below to fill it.
						</Text>
						<View style={styles.gridOuterBorder}>
							<View style={styles.grid}>
								{grid.map((row, rowIndex) => (
									<View key={rowIndex} style={styles.gridRow}>
										{row.map((cell, colIndex) => {
											const isSelected =
												selectedCell?.row === rowIndex &&
												selectedCell?.col === colIndex;

											return (
												<TouchableOpacity
													key={`${rowIndex}-${colIndex}`}
													style={[
														styles.cell,
														{
															width: cellSizeClamped,
															height: cellSizeClamped,
															backgroundColor: isSelected
																? Colors.accent + "20"
																: Colors.background.secondary,
															borderColor: isSelected
																? Colors.accent
																: "#E5E5E5",
														},
													]}
													onPress={() => handleCellPress(rowIndex, colIndex)}
													activeOpacity={0.7}
												>
													<Text
														style={[
															styles.cellText,
															isSelected && styles.cellTextSelected,
														]}
													>
														{cell !== null ? cell.toString() : ""}
													</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								))}
							</View>
							{/* Horizontal dividing lines */}
							<View
								style={[
									styles.horizontalDivider,
									{
										top: cellSizeClamped * 3 + cellGap * 3 - 1.5,
										width: totalGridWidth,
									},
								]}
							/>
							<View
								style={[
									styles.horizontalDivider,
									{
										top: cellSizeClamped * 6 + cellGap * 6 - 1.5,
										width: totalGridWidth,
									},
								]}
							/>
							{/* Vertical dividing lines */}
							<View
								style={[
									styles.verticalDivider,
									{
										left: cellSizeClamped * 3 + cellGap * 3 - 1.5,
										height: totalGridWidth,
									},
								]}
							/>
							<View
								style={[
									styles.verticalDivider,
									{
										left: cellSizeClamped * 6 + cellGap * 6 - 1.5,
										height: totalGridWidth,
									},
								]}
							/>
						</View>
					</View>

					{/* Number Pad */}
					{selectedCell && (
						<View style={styles.numberPadContainer}>
							<Text style={styles.label}>Select Number</Text>
							<View style={styles.numberPad}>
								{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
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
									<Ionicons
										name="close"
										size={20}
										color={Colors.text.primary}
									/>
								</TouchableOpacity>
							</View>
						</View>
					)}

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
				</ScrollView>
			</KeyboardAvoidingView>
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
		backgroundColor: Colors.background.primary,
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
	keyboardView: {
		flex: 1,
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
	gridContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	gridOuterBorder: {
		borderWidth: 3,
		borderColor: "#000000",
		borderRadius: BorderRadius.sm,
		overflow: "hidden",
		marginTop: Spacing.md,
		alignSelf: "center",
		position: "relative",
	},
	grid: {
		flexDirection: "column",
		alignItems: "center",
		gap: 1,
	},
	horizontalDivider: {
		position: "absolute",
		height: 3,
		backgroundColor: "#000000",
		zIndex: 10,
		pointerEvents: "none",
	},
	verticalDivider: {
		position: "absolute",
		width: 3,
		backgroundColor: "#000000",
		zIndex: 10,
		pointerEvents: "none",
	},
	gridRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 1,
	},
	cell: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
		padding: 2,
		...Shadows.light,
	},
	cellText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
		textAlign: "center",
	},
	cellTextSelected: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
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

export default CreateSudokuPage;
