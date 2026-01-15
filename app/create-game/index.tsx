import React, { useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionEndRefresh } from "../../utils/sessionRefresh";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../../components/MinimalHeader";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
	Gradients,
} from "../../constants/DesignSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Game Type Button Component with animation
const GameTypeButton: React.FC<{
	game: { type: GameType; name: string; icon: keyof typeof Ionicons.glyphMap };
	onPress: () => void;
	index: number;
}> = ({ game, onPress, index }) => {
	const scaleAnim = useRef(new Animated.Value(1)).current;

	const handlePress = () => {
		Animated.sequence([
			Animated.spring(scaleAnim, {
				toValue: 0.95,
				useNativeDriver: true,
				tension: 300,
				friction: 10,
			}),
			Animated.spring(scaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 300,
				friction: 10,
			}),
		]).start();
		onPress();
	};

	return (
		<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
			<TouchableOpacity
				style={styles.gameTypeButton}
				onPress={handlePress}
				activeOpacity={0.8}
			>
				<View style={styles.gameIconWrapper}>
					<Ionicons name={game.icon} size={28} color={Colors.accent} />
				</View>
				<Text style={styles.gameTypeText}>{game.name}</Text>
			</TouchableOpacity>
		</Animated.View>
	);
};

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
	| "zip";

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
];

const CreateGameIndex = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);

	const handleGameTypeSelect = (gameType: GameType) => {
		router.push(`/create-game/${gameType}`);
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			<MinimalHeader title="Create Game" />

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.sectionTitle}>Choose Game Type</Text>
				<View style={styles.gameTypeContainer}>
					{gameTypes.map((game, index) => (
						<GameTypeButton
							key={game.type}
							game={game}
							onPress={() => handleGameTypeSelect(game.type)}
							index={index}
							/>
					))}
				</View>

				<View style={styles.infoNote}>
					<Ionicons
						name="information-circle-outline"
						size={18}
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
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
		gap: Spacing.sm,
	},
	gameTypeButton: {
		width: (SCREEN_WIDTH - Layout.margin * 2 - Spacing.sm * 2) / 3,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 0,
		...Shadows.light,
		minHeight: 100,
	},
	gameIconWrapper: {
		width: 56,
		height: 56,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.accent + "15",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	gameTypeText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		textAlign: "center",
	},
	infoNote: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		borderWidth: 0,
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

