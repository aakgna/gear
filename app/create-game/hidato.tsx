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

const CreateHidatoPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState<1 | 2>(1);
	const [path, setPath] = useState<
		Array<{ row: number; col: number; value: number }>
	>([]);
	const [selectedGivens, setSelectedGivens] = useState<Set<string>>(new Set());

	// Grid size based on difficulty - fixed sizes
	const getGridSize = (): { rows: number; cols: number } => {
		switch (difficulty) {
			case "easy":
				return { rows: 5, cols: 5 };
			case "medium":
				return { rows: 6, cols: 6 };
			case "hard":
				return { rows: 7, cols: 7 };
			default:
				return { rows: 5, cols: 5 };
		}
	};

	const { rows, cols } = getGridSize();
	const totalCells = rows * cols;
	const minPathLength = Math.ceil(totalCells / 2);
	const maxPathLength = totalCells;
	const startNum = 1;
	const endNum = startNum + path.length - 1; // End number is determined by path length

	React.useEffect(() => {
		// Reset when difficulty changes
		setPath([]);
		setSelectedGivens(new Set());
		setStep(1);
	}, [difficulty]);

	const getPathValue = (row: number, col: number): number | null => {
		const step = path.find((p) => p.row === row && p.col === col);
		return step ? step.value : null;
	};

	const isPathCell = (row: number, col: number): boolean => {
		return path.some((p) => p.row === row && p.col === col);
	};

	const handleCellPress = (row: number, col: number) => {
		if (step === 1) {
			// Step 1: Building path
			const currentValue = getPathValue(row, col);
			if (currentValue !== null) {
				// Remove this cell and all cells after it
				const index = path.findIndex((p) => p.row === row && p.col === col);
				setPath(path.slice(0, index));
			} else {
				// Check if this cell is adjacent to the last cell in path
				if (path.length === 0) {
					// First cell
					setPath([{ row, col, value: startNum }]);
				} else {
					const lastCell = path[path.length - 1];
					const rowDiff = Math.abs(lastCell.row - row);
					const colDiff = Math.abs(lastCell.col - col);
					// 8-direction adjacency: rowDiff <= 1 && colDiff <= 1 && not same cell
					if (
						rowDiff <= 1 &&
						colDiff <= 1 &&
						!(rowDiff === 0 && colDiff === 0)
					) {
						// Adjacent - add to path
						const nextValue = startNum + path.length;
						if (path.length >= maxPathLength) {
							Alert.alert(
								"Error",
								`Path cannot exceed ${maxPathLength} steps.`
							);
							return;
						}
						setPath([...path, { row, col, value: nextValue }]);
					} else {
						Alert.alert(
							"Error",
							"Each step must be adjacent to the previous step (8 directions: horizontal, vertical, or diagonal)."
						);
					}
				}
			}
		} else if (step === 2) {
			// Step 2: Selecting givens
			const value = getPathValue(row, col);
			if (value === null) return; // Only path cells can be givens

			const key = `${row},${col}`;
			const newGivens = new Set(selectedGivens);
			if (newGivens.has(key)) {
				newGivens.delete(key);
			} else {
				newGivens.add(key);
			}
			setSelectedGivens(newGivens);
		}
	};

	const validateStep1 = (): boolean => {
		// Check if path meets minimum length
		if (path.length < minPathLength) {
			Alert.alert(
				"Path Too Short",
				`Your path must have at least ${minPathLength} steps. Currently has ${path.length}.`
			);
			return false;
		}

		// Validate path is connected (each step is adjacent to next in 8 directions)
		for (let i = 0; i < path.length - 1; i++) {
			const current = path[i];
			const next = path[i + 1];
			const rowDiff = Math.abs(current.row - next.row);
			const colDiff = Math.abs(current.col - next.col);
			// 8-direction adjacency: rowDiff <= 1 && colDiff <= 1 && not same cell
			if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
				// Valid (adjacent in 8 directions)
			} else {
				Alert.alert(
					"Validation Error",
					`Path step ${i + 1} to ${
						i + 2
					} is not adjacent. Each step must be adjacent to the next (8 directions).`
				);
				return false;
			}
		}
		return true;
	};

	const validateStep2 = (): boolean => {
		// Check if at least one given is selected
		if (selectedGivens.size === 0) {
			Alert.alert(
				"No Givens",
				"You must select at least one cell as a given (revealed number)."
			);
			return false;
		}
		return true;
	};

	const handleNextStep = () => {
		if (step === 1) {
			if (!validateStep1()) return;
			setStep(2);
		}
	};

	const handlePreviousStep = () => {
		if (step === 2) {
			setStep(1);
		}
	};

	const handleSubmit = async () => {
		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		if (!validateStep2()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Convert selectedGivens to givens array
			const givens: Array<{ row: number; col: number; value: number }> = [];
			selectedGivens.forEach((key) => {
				const [rowStr, colStr] = key.split(",");
				const row = parseInt(rowStr);
				const col = parseInt(colStr);
				const pathCell = path.find((p) => p.row === row && p.col === col);
				if (pathCell) {
					givens.push(pathCell);
				}
			});

			await saveGameToFirestore(
				"hidato",
				difficulty,
				{
					rows,
					cols,
					startNum,
					endNum,
					path,
					givens,
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Hidato game has been created successfully!",
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

	// Calculate cell size based on grid dimensions - same as Hidato game
	const maxGridWidth = SCREEN_WIDTH - Spacing.xl * 2;
	const cellSize = Math.floor((maxGridWidth - (cols - 1) * 8) / cols);
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
				<Text style={styles.headerTitle}>Create Hidato</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Create Hidato Game</Text>
				<Text style={styles.description}>
					{step === 1
						? `Step 1: Build a path from ${startNum} to your end number. Each step must be adjacent (horizontally, vertically, or diagonally). Minimum ${minPathLength} steps, maximum ${maxPathLength}.`
						: `Step 2: Select which numbers should be given (revealed) to players. Tap path cells to toggle them as givens.`}
				</Text>
				{step === 1 && (
					<Text style={styles.helperText}>
						Current path: {path.length} steps (from {startNum} to{" "}
						{endNum > 0 ? endNum : "?"})
					</Text>
				)}

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
						Grid size: {rows}x{cols}.{" "}
						{difficulty === "easy"
							? "~50% cells revealed"
							: difficulty === "medium"
							? "~35% cells revealed"
							: "~25% cells revealed"}
					</Text>
				</View>

				{/* Grid */}
				<View style={styles.gridContainer}>
					<Text style={styles.label}>
						{step === 1 ? "Build Path" : "Select Givens"}
					</Text>
					<Text style={styles.helperText}>
						{step === 1
							? "Tap cells to add them to the path. Tap a path cell to remove it and all steps after it."
							: "Tap path cells to mark them as givens (revealed numbers). At least one must be selected."}
					</Text>
					<View style={styles.grid}>
						{Array.from({ length: rows }).map((_, rowIndex) => (
							<View key={rowIndex} style={styles.gridRow}>
								{Array.from({ length: cols }).map((_, colIndex) => {
									const value = getPathValue(rowIndex, colIndex);
									const isInPath = isPathCell(rowIndex, colIndex);
									const isStart = value === startNum;
									const isEnd = value === endNum;
									const key = `${rowIndex},${colIndex}`;
									const isGiven = selectedGivens.has(key);
									return (
										<TouchableOpacity
											key={colIndex}
											style={[
												styles.cell,
												{
													width: cellSizeClamped,
													height: cellSizeClamped,
													marginRight: colIndex < cols - 1 ? 8 : 0,
													backgroundColor:
														step === 2 && isGiven
															? Colors.accent + "30"
															: isStart
															? Colors.accent + "30"
															: isEnd
															? Colors.accent + "20"
															: isInPath
															? Colors.background.primary
															: Colors.background.secondary,
													borderColor:
														step === 2 && isGiven
															? Colors.accent
															: isInPath
															? Colors.accent
															: "#E5E5E5",
													borderWidth:
														isInPath || (step === 2 && isGiven) ? 2 : 1,
												},
											]}
											onPress={() => handleCellPress(rowIndex, colIndex)}
											activeOpacity={0.7}
											disabled={step === 2 && !isInPath}
										>
											{value !== null && (
												<Text
													style={[
														styles.cellText,
														(isStart || (step === 2 && isGiven)) &&
															styles.cellTextStart,
														isEnd && styles.cellTextEnd,
													]}
												>
													{value}
												</Text>
											)}
										</TouchableOpacity>
									);
								})}
							</View>
						))}
					</View>
				</View>

				{/* Step 1: Clear and Next Step */}
				{step === 1 && (
					<>
						{path.length > 0 && (
							<TouchableOpacity
								style={styles.clearButton}
								onPress={() => setPath([])}
							>
								<Ionicons
									name="trash-outline"
									size={20}
									color={Colors.text.primary}
								/>
								<Text style={styles.clearButtonText}>Clear Path</Text>
							</TouchableOpacity>
						)}
						{path.length >= minPathLength && (
							<TouchableOpacity
								style={styles.nextStepButton}
								onPress={handleNextStep}
							>
								<Text style={styles.nextStepButtonText}>
									Next Step: Select Givens
								</Text>
								<Ionicons
									name="arrow-forward"
									size={24}
									color={Colors.text.primary}
								/>
							</TouchableOpacity>
						)}
					</>
				)}

				{/* Step 2: Back and Submit */}
				{step === 2 && (
					<>
						<TouchableOpacity
							style={styles.backToPathButton}
							onPress={() => {
								handlePreviousStep();
								setSelectedGivens(new Set());
							}}
						>
							<Ionicons
								name="arrow-back"
								size={20}
								color={Colors.text.primary}
							/>
							<Text style={styles.clearButtonText}>Back to Path</Text>
						</TouchableOpacity>
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
					</>
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
	sliderContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginTop: Spacing.md,
	},
	sliderLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		minWidth: 30,
		textAlign: "center",
	},
	sliderButtonsContainer: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.xs,
		justifyContent: "center",
	},
	sliderButton: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.sm,
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		minWidth: 40,
		alignItems: "center",
	},
	sliderButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	sliderButtonText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	sliderButtonTextActive: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
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
		marginBottom: 8,
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
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	cellTextStart: {
		color: Colors.accent,
		fontSize: Typography.fontSize.h3,
	},
	cellTextEnd: {
		color: Colors.accent,
		fontSize: Typography.fontSize.h3,
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
	nextStepButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.lg,
		gap: Spacing.sm,
		...Shadows.heavy,
	},
	nextStepButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	backToPathButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.text.secondary + "20",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		gap: Spacing.sm,
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

export default CreateHidatoPage;
