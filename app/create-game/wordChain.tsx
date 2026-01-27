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
import words from "an-array-of-english-words";

type Difficulty = "easy" | "medium" | "hard";

const CreateWordChainPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");
	const [loading, setLoading] = useState(false);

	// Get word length based on difficulty
	const getWordLength = (): number => {
		switch (difficulty) {
			case "easy":
				return 3;
			case "medium":
				return 4;
			case "hard":
				return 5;
			default:
				return 3;
		}
	};

	const wordLength = getWordLength();
	// Total inputs = 2 + (n-1) where n is word length
	const totalInputs = 2 + (wordLength - 1);

	// Initialize chain words array with empty strings
	const [chainWords, setChainWords] = useState<string[]>(
		Array(totalInputs).fill("")
	);

	// Update chain words array when difficulty changes
	React.useEffect(() => {
		const newTotalInputs = 2 + (getWordLength() - 1);
		setChainWords(Array(newTotalInputs).fill(""));
	}, [difficulty]);

	const handleWordChange = (index: number, text: string) => {
		const sanitized = text
			.toUpperCase()
			.replace(/[^A-Z]/g, "")
			.slice(0, wordLength);
		const newChainWords = [...chainWords];
		newChainWords[index] = sanitized;
		setChainWords(newChainWords);
	};

	const validateWordChain = (): boolean => {
		// Check all words are filled
		for (let i = 0; i < chainWords.length; i++) {
			if (!chainWords[i].trim()) {
				Alert.alert(
					"Validation Error",
					`Please enter word ${i + 1} in the chain.`
				);
				return false;
			}
			if (chainWords[i].length !== wordLength) {
				Alert.alert(
					"Validation Error",
					`All words must be ${wordLength} letters long.`
				);
				return false;
			}
		}

		// Validate all words are in the dictionary
		for (let i = 0; i < chainWords.length; i++) {
			const word = chainWords[i].toLowerCase();
			if (!words.includes(word)) {
				const wordLabel =
					i === 0
						? "Start word"
						: i === chainWords.length - 1
						? "End word"
						: `Chain word ${i}`;
				Alert.alert(
					"Validation Error",
					`${wordLabel} "${chainWords[i]}" is not a valid English word.`
				);
				return false;
			}
		}

		// Validate each word differs by exactly one letter from the previous
		for (let i = 1; i < chainWords.length; i++) {
			const prevWord = chainWords[i - 1];
			const currWord = chainWords[i];
			let differences = 0;

			for (let j = 0; j < wordLength; j++) {
				if (prevWord[j] !== currWord[j]) {
					differences++;
				}
			}

			if (differences !== 1) {
				Alert.alert(
					"Validation Error",
					`Word ${
						i + 1
					} (${currWord}) must differ by exactly one letter from word ${i} (${prevWord}).`
				);
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

		if (!validateWordChain()) return;

		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const username = userData?.username;

			const startWord = chainWords[0];
			const endWord = chainWords[chainWords.length - 1];
			const middleWords = chainWords.slice(1, -1);

			await saveGameToFirestore(
				"wordChain",
				difficulty,
				{
					startWord: startWord,
					endWord: endWord,
					answer: middleWords,
					minSteps: middleWords.length,
				},
				user.uid,
				username
			);
			Alert.alert(
				"Success",
				"Your Word Chain game has been created successfully!",
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

	const getWordLabel = (index: number): string => {
		if (index === 0) return "Start Word";
		if (index === chainWords.length - 1) return "End Word";
		return `Chain Word ${index}`;
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
				<Text style={styles.headerTitle}>Create Word Chain</Text>
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
					<Text style={styles.sectionTitle}>Create Word Chain Game</Text>
					<Text style={styles.description}>
						Create a word chain where each word differs by exactly one letter
						from the previous word.
					</Text>

					{/* Difficulty */}
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
								? `3-letter words, ${totalInputs} total words`
								: difficulty === "medium"
								? `4-letter words, ${totalInputs} total words`
								: `5-letter words, ${totalInputs} total words`}
						</Text>
					</View>

					{/* Word Chain Inputs */}
					<View style={styles.chainContainer}>
						<Text style={styles.label}>Word Chain</Text>
						<Text style={styles.helperText}>
							Each word must differ by exactly one letter from the word above it
						</Text>
						{chainWords.map((word, index) => (
							<View key={index} style={styles.wordInputContainer}>
								<View style={styles.wordLabelContainer}>
									<Text
										style={[
											styles.wordLabel,
											index === 0 && styles.startWordLabel,
											index === chainWords.length - 1 && styles.endWordLabel,
										]}
									>
										{getWordLabel(index)}
									</Text>
								</View>
								<TextInput
									style={
										[
											styles.input,
											styles.wordInput,
											index === 0 && styles.startWordInput,
											index === chainWords.length - 1 && styles.endWordInput,
										] as any
									}
									placeholder={`${wordLength} letters...`}
									placeholderTextColor={Colors.text.disabled}
									value={word}
									onChangeText={(text) => handleWordChange(index, text)}
									autoCapitalize="characters"
									maxLength={wordLength}
								/>
								{index < chainWords.length - 1 && (
									<View style={styles.arrowContainer}>
										<Ionicons
											name="arrow-down"
											size={20}
											color={Colors.text.secondary}
										/>
									</View>
								)}
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
	input: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		marginBottom: Spacing.md,
		...Shadows.light,
	},
	helperText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
		marginBottom: Spacing.sm,
	},
	chainContainer: {
		marginBottom: Spacing.lg,
	},
	wordInputContainer: {
		marginBottom: Spacing.xs,
	},
	wordLabelContainer: {
		marginBottom: Spacing.xs,
	},
	wordLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},
	startWordLabel: {
		color: Colors.game.correct,
		fontWeight: Typography.fontWeight.bold,
		fontSize: Typography.fontSize.body,
	},
	endWordLabel: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
		fontSize: Typography.fontSize.body,
	},
	wordInput: {
		marginBottom: 0,
		textAlign: "center" as "center",
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold as any,
		letterSpacing: 2,
	},
	startWordInput: {
		borderColor: Colors.game.correct,
		borderWidth: 2,
		backgroundColor: Colors.game.correct + "10",
	},
	endWordInput: {
		borderColor: Colors.accent,
		borderWidth: 2,
		backgroundColor: Colors.accent + "10",
	},
	arrowContainer: {
		alignItems: "center",
		paddingVertical: Spacing.xs,
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

export default CreateWordChainPage;
