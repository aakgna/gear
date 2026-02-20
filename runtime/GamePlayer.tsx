/**
 * Custom game player: runs the rule engine, evaluates win/lose, and reports GameResult.
 * Used in feed/play path (GameWrapper) and for create-game preview (onComplete optional).
 */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { GameDefinition } from "../config/gameDefinition";
import { runRules, type RuleContext } from "./ruleRunner";
import type { GameResult } from "../config/types";

export function GamePlayer({
	definition,
	puzzleId = "",
	onComplete,
	onAttempt,
	startTime,
	isActive = true,
	initialCompletedResult,
}: {
	definition: GameDefinition;
	puzzleId?: string;
	onComplete?: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}) {
	const { title, description, board, content, rules, systems } = definition;
	const prompt = content?.prompt ?? "";
	const choices = content?.choices ?? [];
	const scoreStart = systems?.score?.start ?? 0;
	const scoreTarget = systems?.score?.target;
	const winConditions = definition.winConditions ?? [];
	const loseConditions = definition.loseConditions ?? [];

	const [state, setState] = useState<Record<string, unknown>>({
		score: scoreStart,
	});
	const completedRef = useRef(false);
	const startTimeRef = useRef(startTime ?? Date.now() / 1000);

	// If already completed (e.g. from feed), don't run engine again
	if (initialCompletedResult) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{title || "Untitled"}</Text>
				{description ? <Text style={styles.desc}>{description}</Text> : null}
				{prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
				<Text style={styles.completedLabel}>
					{initialCompletedResult.completed ? "Completed" : "Result saved"}
				</Text>
			</View>
		);
	}

	// Emit GAME_START on mount and run rules once
	useEffect(() => {
		if (!isActive || completedRef.current) return;
		const ctx: RuleContext = {
			event: "GAME_START",
			state: { score: scoreStart },
		};
		const result = runRules(rules, ctx);
		setState((prev) => ({ ...prev, ...ctx.state }));
		if (result === "win" || result === "lose") {
			completedRef.current = true;
			const timeTaken = (Date.now() / 1000) - startTimeRef.current;
			onComplete({
				puzzleId,
				completed: result === "win",
				timeTaken,
				completedAt: new Date().toISOString(),
			});
		}
	}, []);

	const handleChoiceTap = (objectId: string) => {
		if (completedRef.current || !isActive) return;
		onAttempt?.(puzzleId);
		setState((prev) => {
			const ctx: RuleContext = {
				event: "OBJECT_TAP",
				objectId,
				state: { ...prev, score: prev.score ?? scoreStart },
			};
			const result = runRules(rules, ctx);
			const nextState = { ...prev, ...ctx.state };
			if (result === "win" || result === "lose") {
				completedRef.current = true;
				const timeTaken = (Date.now() / 1000) - startTimeRef.current;
				onComplete?.({
					puzzleId,
					completed: result === "win",
					timeTaken,
					completedAt: new Date().toISOString(),
				});
			} else {
				// Check win/lose by conditions (e.g. score >= target)
				const score = (nextState.score as number) ?? scoreStart;
				if (scoreTarget != null && score >= scoreTarget && winConditions.length > 0) {
					completedRef.current = true;
					const timeTaken = (Date.now() / 1000) - startTimeRef.current;
					onComplete?.({
						puzzleId,
						completed: true,
						timeTaken,
						completedAt: new Date().toISOString(),
					});
				}
			}
			return nextState;
		});
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{title || "Untitled"}</Text>
			{description ? <Text style={styles.desc}>{description}</Text> : null}

			{board.kind === "grid" && (
				<View style={styles.gridWrap}>
					<Text style={styles.gridLabel}>
						Grid: {board.rows}×{board.cols}
					</Text>
					<View style={[styles.grid, { width: board.cols * 40, flexDirection: "row", flexWrap: "wrap" }]}>
						{Array.from({ length: board.rows * board.cols }).map((_, i) => (
							<View key={i} style={styles.cell} />
						))}
					</View>
				</View>
			)}
			{board.kind === "freeform" && (
				<View style={[styles.freeformPreview, { width: Math.min(board.width, 300), height: Math.min(board.height, 200) }]}>
					<Text style={styles.previewLabel}>Freeform {board.width}×{board.height}px</Text>
				</View>
			)}
			{board.kind === "list" && (
				<View style={styles.listPreview}>
					<Text style={styles.previewLabel}>List: {board.numSlots} slots</Text>
				</View>
			)}

			{systems?.score != null && (
				<Text style={styles.score}>Score: {(state.score as number) ?? scoreStart}</Text>
			)}
			{prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
			{choices.length > 0 && (
				<View style={styles.choices}>
					{choices.map((c) => (
						<TouchableOpacity
							key={c.id}
							style={styles.choice}
							onPress={() => handleChoiceTap(c.id)}
							disabled={completedRef.current}
						>
							<Text style={styles.choiceText}>{c.label}</Text>
						</TouchableOpacity>
					))}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16 },
	title: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
	desc: { fontSize: 14, opacity: 0.8, marginBottom: 12 },
	gridWrap: { marginVertical: 12 },
	gridLabel: { fontSize: 12, marginBottom: 4 },
	grid: { gap: 2 },
	cell: { width: 36, height: 36, backgroundColor: "#e5e7eb", borderRadius: 6, margin: 2 },
	freeformPreview: { backgroundColor: "#f3f4f6", borderRadius: 8, marginVertical: 12, justifyContent: "center", alignItems: "center" },
	listPreview: { backgroundColor: "#f3f4f6", borderRadius: 8, padding: 12, marginVertical: 12 },
	previewLabel: { fontSize: 12, opacity: 0.8 },
	score: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
	prompt: { fontSize: 16, marginTop: 12, marginBottom: 8 },
	choices: { gap: 6 },
	choice: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#f3f4f6", borderRadius: 8 },
	choiceText: { fontSize: 14 },
	completedLabel: { fontSize: 14, marginTop: 12, opacity: 0.8 },
});
