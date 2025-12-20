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

const AVAILABLE_COLORS = [
	{ name: "red", emoji: "🔴" },
	{ name: "blue", emoji: "🔵" },
	{ name: "green", emoji: "🟢" },
	{ name: "yellow", emoji: "🟡" },
	{ name: "orange", emoji: "🟠" },
	{ name: "purple", emoji: "🟣" },
	{ name: "black", emoji: "⚫" },
	{ name: "white", emoji: "⚪" },
	{ name: "brown", emoji: "🟤" },
	{ name: "lightblue", emoji: "🔷" },
	{ name: "pink", emoji: "💗" },
	{ name: "lime", emoji: "🟩" },
];

const CreateMastermindPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);
	const [secretCode, setSecretCode] = useState<(string | null)[]>(
		new Array(6).fill(null)
	);

	const getMaxGuesses = (): number => {
		switch (difficulty) {
			case "easy":
				return 12;
			case "medium":
				return 10;
			case "hard":
				return 8;
			default:
				return 12;
		}
	};

	const getAvailableColors = (): string[] => {
		switch (difficulty) {
			case "easy":
				return ["red", "blue", "green", "yellow", "orange", "purple"];
			case "medium":
				return [
					"red",
					"blue",
					"green",
					"yellow",
					"orange",
					"purple",
					"black",
					"white",
					"brown",
				];
			case "hard":
				return AVAILABLE_COLORS.map((c) => c.name);
			default:
				return ["red", "blue", "green", "yellow", "orange", "purple"];
		}
	};

	const handleColorSelect = (position: number, color: string) => {
		const newCode = [...secretCode];
		newCode[position] = color;
		setSecretCode(newCode);
	};

	const handleClearPosition = (position: number) => {
		const newCode = [...secretCode];
		newCode[position] = null;
		setSecretCode(newCode);
	};

	const validateMastermind = (): boolean => {
		if (secretCode.some((c) => c === null)) {
			Alert.alert(
				"Validation Error",
				"Please fill all 6 positions in the secret code."
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

		if (!validateMastermind()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			await saveGameToFirestore(
				"mastermind",
				difficulty,
				{
					secretCode: secretCode as string[],
					maxGuesses: getMaxGuesses(),
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Mastermind game has been created successfully!",
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

	const availableColors = getAvailableColors();
	const colorEmojiMap: Record<string, string> = {};
	AVAILABLE_COLORS.forEach((c) => {
		colorEmojiMap[c.name] = c.emoji;
	});

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
				<Text style={styles.headerTitle}>Create Mastermind</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Create Mastermind Game</Text>
				<Text style={styles.description}>
					Create a 6-position secret code by selecting colors. Players will try
					to guess your code.
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
								onPress={() => {
									setDifficulty(diff);
									// Reset code when difficulty changes
									setSecretCode(new Array(6).fill(null));
								}}
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
						Max guesses: {getMaxGuesses()} | Available colors:{" "}
						{availableColors.length}
					</Text>
				</View>

				{/* Secret Code Display */}
				<View style={styles.codeContainer}>
					<Text style={styles.label}>Secret Code (6 positions)</Text>
					<View style={styles.codeRow}>
						{secretCode.map((color, index) => (
							<TouchableOpacity
								key={index}
								style={[
									styles.codePosition,
									color && styles.codePositionFilled,
								]}
								onPress={() => handleClearPosition(index)}
							>
								{color ? (
									<Text style={styles.codeEmoji}>
										{colorEmojiMap[color] || "🔴"}
									</Text>
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

				{/* Color Palette */}
				<View style={styles.colorPaletteContainer}>
					<Text style={styles.label}>Select Colors</Text>
					<View style={styles.colorGrid}>
						{availableColors.map((colorName) => {
							const colorInfo = AVAILABLE_COLORS.find(
								(c) => c.name === colorName
							);
							if (!colorInfo) return null;
							return (
								<TouchableOpacity
									key={colorName}
									style={styles.colorButton}
									onPress={() => {
										// Find first empty position
										const emptyIndex = secretCode.findIndex((c) => c === null);
										if (emptyIndex !== -1) {
											handleColorSelect(emptyIndex, colorName);
										}
									}}
								>
									<Text style={styles.colorEmoji}>{colorInfo.emoji}</Text>
									<Text style={styles.colorName}>
										{colorName.charAt(0).toUpperCase() + colorName.slice(1)}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				<TouchableOpacity
					style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},
	selectorButtonTextActive: {
		color: Colors.accent,
	},
	codeContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	codeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: Spacing.md,
		paddingHorizontal: Spacing.xs,
	},
	codePosition: {
		width:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.xs * 2) /
			6.5,
		height:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.xs * 2) /
			6.5,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		backgroundColor: Colors.background.secondary,
		alignItems: "center",
		justifyContent: "center",
	},
	codePositionFilled: {
		borderColor: Colors.accent,
		backgroundColor: Colors.accent + "15",
	},
	codeEmoji: {
		fontSize: 28,
	},
	colorPaletteContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	colorGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginTop: Spacing.md,
	},
	colorButton: {
		width:
			(SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2 - Spacing.sm * 4) / 3,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	colorEmoji: {
		fontSize: 32,
		marginBottom: Spacing.xs,
	},
	colorName: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
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

export default CreateMastermindPage;
