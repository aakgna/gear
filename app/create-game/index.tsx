import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type GameType =
	| "wordle"
	| "riddle"
	| "quickMath"
	| "alias"
	| "wordChain"
	| "trivia"
	| "mastermind"
	| "sequencing"
	| "sudoku"
	| "futoshiki"
	| "hidato"
	| "zip"
	| "gameIdea";

const gameTypes: Array<{
	type: GameType;
	name: string;
	icon: keyof typeof Ionicons.glyphMap;
}> = [
	{ type: "wordle", name: "Wordle", icon: "text-outline" },
	{ type: "riddle", name: "Riddle", icon: "help-circle-outline" },
	{ type: "quickMath", name: "Quick Math", icon: "calculator-outline" },
	{ type: "alias", name: "Alias", icon: "book-outline" },
	{ type: "wordChain", name: "Word Chain", icon: "link-outline" },
	{ type: "trivia", name: "Trivia", icon: "trophy-outline" },
	{ type: "mastermind", name: "Mastermind", icon: "color-palette-outline" },
	{ type: "sequencing", name: "Sequencing", icon: "list-outline" },
	{ type: "sudoku", name: "Sudoku", icon: "grid-outline" },
	{ type: "futoshiki", name: "Futoshiki", icon: "code-working-outline" },
	{ type: "hidato", name: "Hidato", icon: "navigate-outline" },
	{ type: "zip", name: "Zip", icon: "git-branch-outline" },
	{ type: "gameIdea", name: "Own Game", icon: "bulb-outline" },
];

const CreateGameIndex = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	const handleGameTypeSelect = (gameType: GameType) => {
		if (gameType === "gameIdea") {
			router.push("/create-game/game-idea");
		} else {
			router.push(`/create-game/${gameType}`);
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
				<Text style={styles.headerTitle}>Create Game</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Choose Game Type</Text>
				<View style={styles.gameTypeContainer}>
					{gameTypes.map((game) => (
						<TouchableOpacity
							key={game.type}
							style={styles.gameTypeButton}
							onPress={() => handleGameTypeSelect(game.type)}
							activeOpacity={0.7}
						>
							<Ionicons
								name={game.icon}
								size={32}
								color={Colors.accent}
							/>
							<Text style={styles.gameTypeText}>{game.name}</Text>
						</TouchableOpacity>
					))}
				</View>

				<View style={styles.infoNote}>
					<Ionicons
						name="information-circle-outline"
						size={20}
						color={Colors.text.secondary}
					/>
					<Text style={styles.infoNoteText}>
						Select a game type to create your own puzzle. For grid-based games,
						enter the complete solution, then choose difficulty to determine
						how many cells to reveal.
					</Text>
				</View>
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
		marginBottom: Spacing.lg,
	},
	gameTypeContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "flex-start",
		gap: Spacing.md,
		marginBottom: Spacing.xl,
	},
	gameTypeButton: {
		width: (SCREEN_WIDTH - Layout.margin * 2 - Spacing.md * 2) / 3,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		alignItems: "center",
		borderWidth: 2,
		borderColor: "#E5E5E5",
		...Shadows.light,
	},
	gameTypeText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		marginTop: Spacing.sm,
	},
	infoNote: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		gap: Spacing.sm,
	},
	infoNoteText: {
		flex: 1,
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		lineHeight: Typography.fontSize.caption * Typography.lineHeight.normal,
	},
});

export { CreateGameIndex as CreateGameScreen };
export default CreateGameIndex;

