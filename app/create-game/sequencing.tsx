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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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

type Difficulty = "easy" | "medium" | "hard";

interface SequencingRule {
	type: "ordering" | "adjacency" | "fixed" | "separation";
	entity1?: string;
	entity2?: string;
	position?: number;
	minDistance?: number;
	description: string;
}

const CreateSequencingPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [entities, setEntities] = useState<string[]>(["A", "B", "C", "D"]);
	const [rules, setRules] = useState<SequencingRule[]>([]);
	const [solution, setSolution] = useState<(string | null)[]>(
		new Array(4).fill(null)
	);

	const getNumSlots = (): number => {
		switch (difficulty) {
			case "easy":
				return 4;
			case "medium":
				return 6;
			case "hard":
				return 8;
			default:
				return 4;
		}
	};

	React.useEffect(() => {
		const numSlots = getNumSlots();
		// Adjust entities to match numSlots
		if (entities.length !== numSlots) {
			const newEntities: string[] = [];
			for (let i = 0; i < numSlots; i++) {
				newEntities.push(String.fromCharCode(65 + i)); // A, B, C, D...
			}
			setEntities(newEntities);
			setRules([]);
			setSolution(new Array(numSlots).fill(null));
		}
	}, [difficulty]);

	const handleEntitySelect = (entity: string) => {
		// Find first empty position
		const emptyIndex = solution.findIndex((e) => e === null);
		if (emptyIndex !== -1) {
			const newSolution = [...solution];
			newSolution[emptyIndex] = entity;
			setSolution(newSolution);
		}
	};

	const handleClearPosition = (position: number) => {
		const newSolution = [...solution];
		newSolution[position] = null;
		setSolution(newSolution);
	};

	const getMinRules = (): number => Math.floor(entities.length / 2);
	const getMaxRules = (): number => entities.length - 1;

	const handleAddRule = () => {
		setRules([
			...rules,
			{
				type: "ordering",
				description: "",
			},
		]);
	};

	const handleRuleChange = (index: number, field: keyof SequencingRule, value: any) => {
		const newRules = [...rules];
		newRules[index] = { ...newRules[index], [field]: value };
		setRules(newRules);
	};

	const handleRemoveRule = (index: number) => {
		setRules(rules.filter((_, i) => i !== index));
	};

	const validateSequencing = (): boolean => {
		// Check solution is complete
		if (solution.some((e) => e === null)) {
			Alert.alert("Validation Error", "Please fill all positions in the solution order.");
			return false;
		}

		// Check all entities are used exactly once
		const usedEntities = new Set(solution.filter((e) => e !== null));
		if (usedEntities.size !== entities.length) {
			Alert.alert("Validation Error", "All entities must be used exactly once in the solution.");
			return false;
		}

		// Check rules count
		const minRules = getMinRules();
		const maxRules = getMaxRules();
		if (rules.length < minRules || rules.length > maxRules) {
			Alert.alert(
				"Validation Error",
				`You must have between ${minRules} and ${maxRules} rules for ${entities.length} entities.`
			);
			return false;
		}

		// Check each rule is filled
		for (let i = 0; i < rules.length; i++) {
			if (!rules[i].description.trim()) {
				Alert.alert("Validation Error", `Please fill in description for rule ${i + 1}.`);
				return false;
			}
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

		if (!validateSequencing()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			// Convert solution to array of indices
			const solutionIndices = (solution as string[]).map((entity) => {
				const index = entities.findIndex((e) => e === entity);
				if (index === -1) {
					throw new Error(`Entity ${entity} not found in entities list`);
				}
				return index;
			});

			await saveGameToFirestore(
				"sequencing",
				difficulty,
				{
					numSlots: getNumSlots(),
					entities,
					rules,
					solution: solutionIndices,
				},
				user.uid,
				username
			);
			Alert.alert("Success", "Your Sequencing game has been created successfully!", [
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
				<Text style={styles.headerTitle}>Create Sequencing</Text>
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
					<Text style={styles.sectionTitle}>Create Sequencing Game</Text>
					<Text style={styles.description}>
						Create a logic puzzle where players must order entities based on rules.
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
											difficulty === diff &&
												styles.selectorButtonTextActive,
										]}
									>
										{diff.charAt(0).toUpperCase() + diff.slice(1)}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<Text style={styles.helperText}>
							{getNumSlots()} entities | Rules: {getMinRules()}-{getMaxRules()}
						</Text>
					</View>

					{/* Solution Order */}
					<View style={styles.orderContainer}>
						<Text style={styles.label}>Solution Order ({getNumSlots()} positions)</Text>
						<View style={styles.orderRow}>
							{solution.map((entity, index) => (
								<TouchableOpacity
									key={index}
									style={[
										styles.orderPosition,
										entity && styles.orderPositionFilled,
									]}
									onPress={() => handleClearPosition(index)}
								>
									{entity ? (
										<Text style={styles.orderText}>{entity}</Text>
									) : (
										<Ionicons
											name="add-circle-outline"
											size={24}
											color={Colors.text.disabled}
										/>
									)}
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Entity Selection */}
					<View style={styles.entityContainer}>
						<Text style={styles.label}>Select Entities</Text>
						<View style={styles.entityGrid}>
							{entities.map((entity) => {
								const isUsed = solution.includes(entity);
								return (
									<TouchableOpacity
										key={entity}
										style={[
											styles.entityButton,
											isUsed && styles.entityButtonUsed,
										]}
										onPress={() => handleEntitySelect(entity)}
										disabled={isUsed}
									>
										<Text
											style={[
												styles.entityText,
												isUsed && styles.entityTextUsed,
											]}
										>
											{entity}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{/* Rules */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Text style={styles.label}>
								Rules ({rules.length} / {getMinRules()}-{getMaxRules()})
							</Text>
							<TouchableOpacity
								style={styles.addButton}
								onPress={handleAddRule}
							>
								<Ionicons name="add" size={20} color={Colors.accent} />
								<Text style={styles.addButtonText}>Add Rule</Text>
							</TouchableOpacity>
						</View>
						{rules.map((rule, index) => (
							<View key={index} style={styles.ruleContainer}>
								<View style={styles.ruleHeader}>
									<Text style={styles.ruleNumber}>Rule {index + 1}</Text>
									<TouchableOpacity
										onPress={() => handleRemoveRule(index)}
									>
										<Ionicons
											name="close-circle"
											size={24}
											color={Colors.text.secondary}
										/>
									</TouchableOpacity>
								</View>
								<Text style={styles.smallLabel}>Type</Text>
								<View style={styles.selectorRow}>
									{(["ordering", "adjacency", "fixed", "separation"] as const).map(
										(type) => (
											<TouchableOpacity
												key={type}
												style={[
													styles.ruleTypeButton,
													rule.type === type && styles.ruleTypeButtonActive,
												]}
												onPress={() => handleRuleChange(index, "type", type)}
											>
												<Text
													style={[
														styles.ruleTypeButtonText,
														rule.type === type &&
															styles.ruleTypeButtonTextActive,
													]}
												>
													{type}
												</Text>
											</TouchableOpacity>
										)
									)}
								</View>
								{(rule.type === "ordering" ||
									rule.type === "adjacency" ||
									rule.type === "separation") && (
									<>
										<Text style={styles.smallLabel}>Entity 1</Text>
										<TextInput
											style={styles.input}
											placeholder="e.g., A"
											value={rule.entity1 || ""}
											onChangeText={(text) =>
												handleRuleChange(index, "entity1", text.toUpperCase())
											}
										/>
										<Text style={styles.smallLabel}>Entity 2</Text>
										<TextInput
											style={styles.input}
											placeholder="e.g., B"
											value={rule.entity2 || ""}
											onChangeText={(text) =>
												handleRuleChange(index, "entity2", text.toUpperCase())
											}
										/>
									</>
								)}
								{rule.type === "fixed" && (
									<>
										<Text style={styles.smallLabel}>Entity</Text>
										<TextInput
											style={styles.input}
											placeholder="e.g., A"
											value={rule.entity1 || ""}
											onChangeText={(text) =>
												handleRuleChange(index, "entity1", text.toUpperCase())
											}
										/>
										<Text style={styles.smallLabel}>Position (0-based)</Text>
										<TextInput
											style={styles.input}
											placeholder="e.g., 0"
											value={rule.position?.toString() || ""}
											onChangeText={(text) =>
												handleRuleChange(
													index,
													"position",
													text ? parseInt(text, 10) : undefined
												)
											}
											keyboardType="numeric"
										/>
									</>
								)}
								{rule.type === "separation" && (
									<>
										<Text style={styles.smallLabel}>Min Distance</Text>
										<TextInput
											style={styles.input}
											placeholder="e.g., 2"
											value={rule.minDistance?.toString() || ""}
											onChangeText={(text) =>
												handleRuleChange(
													index,
													"minDistance",
													text ? parseInt(text, 10) : undefined
												)
											}
											keyboardType="numeric"
										/>
									</>
								)}
								<Text style={styles.smallLabel}>Description</Text>
								<TextInput
									style={[styles.input, styles.textArea]}
									placeholder="e.g., A must come before B"
									value={rule.description}
									onChangeText={(text) =>
										handleRuleChange(index, "description", text)
									}
									multiline
									numberOfLines={2}
								/>
							</View>
						))}
					</View>

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
	smallLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		marginBottom: Spacing.xs,
		marginTop: Spacing.sm,
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
	section: {
		marginBottom: Spacing.lg,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	addButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		padding: Spacing.xs,
	},
	addButtonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.accent,
		fontWeight: Typography.fontWeight.medium,
	},
	ruleContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.md,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	ruleHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	ruleNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
	},
	ruleTypeButton: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.sm,
		padding: Spacing.xs,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	ruleTypeButtonActive: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	ruleTypeButtonText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	ruleTypeButtonTextActive: {
		color: Colors.accent,
	},
	input: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		marginBottom: Spacing.md,
		...Shadows.light,
	},
	textArea: {
		minHeight: 60,
		textAlignVertical: "top",
	},
	orderContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	orderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: Spacing.md,
		paddingHorizontal: Spacing.xs,
	},
	orderPosition: {
		width:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.xs * 2) /
			8.5,
		height:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.xs * 2) /
			8.5,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		backgroundColor: Colors.background.secondary,
		alignItems: "center",
		justifyContent: "center",
	},
	orderPositionFilled: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	orderText: {
		fontSize: 20,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	entityContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	entityGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginTop: Spacing.md,
	},
	entityButton: {
		width:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.sm * 6) /
			4,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.lg,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	entityButtonUsed: {
		opacity: 0.4,
		backgroundColor: Colors.text.disabled + "20",
	},
	entityText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	entityTextUsed: {
		color: Colors.text.disabled,
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

export default CreateSequencingPage;

