/**
 * dev-game-test.tsx — Phase 3 simulator test screen.
 * Remove before shipping.
 */

import React, { useState } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	SafeAreaView,
	ScrollView,
} from "react-native";
import { GamePlayer } from "../runtime/GamePlayer";
import { ALL_TEST_GAMES } from "../runtime/testGames";
import type { CustomPuzzleGame } from "../config/customPuzzleGame";
import type { GameResult } from "../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const TESTS: Array<{ label: string; game: CustomPuzzleGame }> = ALL_TEST_GAMES.map(
	(g, i) => ({ label: `${i + 1}. ${g.meta.title}`, game: g })
);

export default function DevGameTest() {
	const [selected, setSelected] = useState<CustomPuzzleGame | null>(null);
	const [result, setResult] = useState<GameResult | null>(null);

	// ── Game playing view ──────────────────────────────────────────────────
	if (selected) {
		return (
			<SafeAreaView style={styles.full}>
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => { setSelected(null); setResult(null); }}
						style={styles.back}
					>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.headerTitle} numberOfLines={1}>{selected.meta.title}</Text>
				</View>

				{result ? (
					<View style={styles.resultBox}>
						<Text style={styles.resultEmoji}>{result.completed ? "🎉" : "😞"}</Text>
						<Text style={styles.resultLabel}>
							{result.completed ? "Complete!" : "Game over"}
						</Text>
						<Text style={styles.resultDetail}>
							Time: {result.timeTaken.toFixed(1)}s
						</Text>
						<TouchableOpacity style={styles.retryBtn} onPress={() => setResult(null)}>
							<Text style={styles.retryText}>Play again</Text>
						</TouchableOpacity>
					</View>
				) : (
					<GamePlayer
						key={selected.id + "-" + Date.now()}
						game={selected}
						puzzleId={selected.id}
						isActive
						onComplete={(r) => setResult(r)}
					/>
				)}
			</SafeAreaView>
		);
	}

	// ── Game picker view ───────────────────────────────────────────────────
	return (
		<SafeAreaView style={styles.full}>
			<View style={styles.listHeader}>
				<Text style={styles.title}>Engine Test</Text>
				<Text style={styles.subtitle}>All 13 scene kinds — tap to play</Text>
			</View>

			<ScrollView
				contentContainerStyle={styles.listContent}
				showsVerticalScrollIndicator={false}
			>
				{TESTS.map(({ label, game }) => (
					<TouchableOpacity
						key={game.id}
						style={styles.card}
						onPress={() => { setSelected(game); setResult(null); }}
						activeOpacity={0.75}
					>
						<View style={styles.cardRow}>
							<Text style={styles.cardLabel}>{label}</Text>
							<Text style={styles.cardArrow}>›</Text>
						</View>
						{game.meta.description ? (
							<Text style={styles.cardSub}>{game.meta.description}</Text>
						) : null}
					</TouchableOpacity>
				))}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	full: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	// ── Picker ──
	listHeader: {
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	subtitle: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: 2,
	},
	listContent: {
		padding: Spacing.md,
		paddingBottom: 40,
		gap: Spacing.sm,
	},
	card: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.md,
		...Shadows.light,
	},
	cardRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	cardLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		flex: 1,
	},
	cardArrow: {
		fontSize: 20,
		color: Colors.text.inactive,
		marginLeft: Spacing.sm,
	},
	cardSub: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: 4,
	},
	// ── Game header ──
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
		...Shadows.light,
	},
	back: { marginRight: Spacing.sm, padding: 4 },
	backText: {
		fontSize: Typography.fontSize.body,
		color: Colors.accent,
		fontWeight: Typography.fontWeight.semiBold,
	},
	headerTitle: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		flex: 1,
	},
	// ── Result ──
	resultBox: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
		backgroundColor: Colors.background.secondary,
	},
	resultEmoji: { fontSize: 64, marginBottom: Spacing.md },
	resultLabel: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	resultDetail: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		marginTop: Spacing.sm,
	},
	retryBtn: {
		marginTop: Spacing.lg,
		backgroundColor: Colors.accent,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		...Shadows.medium,
	},
	retryText: {
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
		fontSize: Typography.fontSize.body,
	},
});
