/**
 * GamePlayer — scene graph runtime.
 *
 * Manages: variable state, current scene, win/lose status, timer.
 * Rule engine fires on every scene event and drives all transitions.
 * SceneRenderer handles all UI — GamePlayer only manages state.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type {
	CustomPuzzleGame,
	GameRule,
	RuleCondition,
	RuleEvent,
} from "../config/customPuzzleGame";
import type { GameResult } from "../config/types";
import { SceneRenderer } from "./sceneRenderer";

// ─── Rule engine ──────────────────────────────────────────────────────────────

function checkCondition(
	cond: RuleCondition,
	vars: Record<string, unknown>
): boolean {
	const val = vars[cond.variableId] as number;
	const v = cond.value as number;
	switch (cond.op) {
		case "eq":  return vars[cond.variableId] === cond.value;
		case "neq": return vars[cond.variableId] !== cond.value;
		case "gt":  return val > v;
		case "gte": return val >= v;
		case "lt":  return val < v;
		case "lte": return val <= v;
		default:    return false;
	}
}

function applyRules(
	rules: GameRule[],
	event: RuleEvent,
	sceneId: string,
	vars: Record<string, unknown>
): {
	vars: Record<string, unknown>;
	goto?: string;
	ended?: "win" | "lose";
} {
	let v = { ...vars };
	let goto: string | undefined;
	let ended: "win" | "lose" | undefined;

	for (const rule of rules) {
		if (rule.on !== event) continue;
		if (rule.sceneId && rule.sceneId !== sceneId) continue;
		if (rule.if && !rule.if.every((c) => checkCondition(c, v))) continue;

		for (const action of rule.then) {
			switch (action.type) {
				case "SET_VAR":
					v = { ...v, [action.variableId]: action.value };
					break;
				case "INC_VAR":
					v = { ...v, [action.variableId]: ((v[action.variableId] as number) ?? 0) + action.amount };
					break;
				case "DEC_VAR":
					v = { ...v, [action.variableId]: ((v[action.variableId] as number) ?? 0) - action.amount };
					break;
				case "APPEND_VAR": {
					const arr = Array.isArray(v[action.variableId]) ? (v[action.variableId] as unknown[]) : [];
					v = { ...v, [action.variableId]: [...arr, action.value] };
					break;
				}
				case "GO_TO":
					goto = action.sceneId;
					break;
				case "WIN":
					ended = "win";
					break;
				case "LOSE":
					ended = "lose";
					break;
			}
		}
	}

	return { vars: v, goto, ended };
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface EngineState {
	vars: Record<string, unknown>;
	sceneId: string;
	status: "playing" | "win" | "lose";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GamePlayerProps {
	/** New engine: pass a CustomPuzzleGame */
	game?: CustomPuzzleGame;
	/** Legacy: pass the old definition object — renders a fallback UI */
	definition?: unknown;
	puzzleId?: string;
	onComplete?: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GamePlayer({
	game,
	definition,
	puzzleId = "",
	onComplete,
	onAttempt,
	startTime,
	isActive = true,
	initialCompletedResult,
}: GamePlayerProps) {
	// ── Fallback for legacy definition prop ──────────────────────────────────
	if (!game) {
		return (
			<View style={styles.container}>
				<Text style={styles.legacyText}>
					This game was created with an older version and cannot be played.
				</Text>
			</View>
		);
	}

	// ── Already completed ────────────────────────────────────────────────────
	if (initialCompletedResult) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{game.meta.title}</Text>
				<Text style={styles.completedLabel}>
					{initialCompletedResult.completed ? "✓  Completed" : "Result saved"}
				</Text>
			</View>
		);
	}

	return <GameEngine
		game={game}
		puzzleId={puzzleId}
		onComplete={onComplete}
		onAttempt={onAttempt}
		startTime={startTime}
		isActive={isActive}
	/>;
}

// ─── Engine (inner component — only rendered when game is valid) ───────────────

function GameEngine({
	game,
	puzzleId,
	onComplete,
	onAttempt,
	startTime,
	isActive,
}: Required<Pick<GamePlayerProps, "game" | "puzzleId" | "isActive">> &
	Pick<GamePlayerProps, "onComplete" | "onAttempt" | "startTime">) {

	const startTimeRef = useRef(startTime ?? Date.now() / 1000);
	const completedRef = useRef(false);
	const prevSceneRef = useRef<string | null>(null);

	// Initialise state from game definition
	const [state, setState] = useState<EngineState>(() => ({
		vars: Object.fromEntries(game.variables.map((v) => [v.id, v.initial])),
		sceneId: game.startSceneId,
		status: "playing",
	}));

	// Timer
	const timerDef = game.systems?.timer;
	const [timeLeft, setTimeLeft] = useState<number | null>(
		timerDef ? timerDef.seconds : null
	);

	// ── dispatch: runs the rule engine on an event ──────────────────────────
	const dispatch = useCallback(
		(event: "CORRECT" | "WRONG" | "WIN" | "LOSE" | "CONTINUE" | "GAME_START" | "SCENE_ENTER" | "TIMER_END") => {
			setState((prev) => {
				if (prev.status !== "playing") return prev;

				// Map scene-level outcomes to rule events
				const ruleEvent: RuleEvent =
					event === "WIN" || event === "LOSE" || event === "CONTINUE"
						? "SCENE_COMPLETE"
						: event;

				const result = applyRules(game.rules, ruleEvent, prev.sceneId, prev.vars);

				// Scene-level LOSE overrides everything
				if (event === "LOSE") {
					return { ...prev, vars: result.vars, status: "lose" };
				}

				// Rule engine result takes priority
				if (result.ended) {
					return { vars: result.vars, sceneId: prev.sceneId, status: result.ended };
				}
				if (result.goto) {
					return { vars: result.vars, sceneId: result.goto, status: "playing" };
				}

				// Default: SCENE_COMPLETE advances to next scene or wins
				if (event === "WIN" || event === "CONTINUE") {
					const idx = game.scenes.findIndex((s) => s.id === prev.sceneId);
					const next = game.scenes[idx + 1];
					if (next) {
						return { vars: result.vars, sceneId: next.id, status: "playing" };
					}
					return { vars: result.vars, sceneId: prev.sceneId, status: "win" };
				}

				return { vars: result.vars, sceneId: prev.sceneId, status: "playing" };
			});
		},
		[game.rules, game.scenes]
	);

	// ── onComplete when game ends ────────────────────────────────────────────
	useEffect(() => {
		if (state.status === "playing") return;
		if (completedRef.current) return;
		completedRef.current = true;
		const timeTaken = Date.now() / 1000 - startTimeRef.current;
		onComplete?.({
			puzzleId,
			completed: state.status === "win",
			timeTaken,
			completedAt: new Date().toISOString(),
		});
	}, [state.status]);

	// ── GAME_START on mount ──────────────────────────────────────────────────
	useEffect(() => {
		if (!isActive) return;
		onAttempt?.(puzzleId);
		dispatch("GAME_START");
	}, []);

	// ── SCENE_ENTER on scene change ──────────────────────────────────────────
	useEffect(() => {
		if (prevSceneRef.current === state.sceneId) return;
		if (prevSceneRef.current !== null) {
			dispatch("SCENE_ENTER");
			if (timerDef?.perScene && timerDef.seconds) {
				setTimeLeft(timerDef.seconds);
			}
		}
		prevSceneRef.current = state.sceneId;
	}, [state.sceneId]);

	// ── Timer countdown ──────────────────────────────────────────────────────
	useEffect(() => {
		if (!timerDef || !isActive || state.status !== "playing") return;
		if (timeLeft === null || timeLeft <= 0) {
			if (timeLeft === 0) dispatch("TIMER_END");
			return;
		}
		const id = setInterval(
			() => setTimeLeft((t) => (t !== null && t > 0 ? t - 1 : 0)),
			1000
		);
		return () => clearInterval(id);
	}, [timeLeft, isActive, state.status]);

	// ── Render ────────────────────────────────────────────────────────────────
	const currentScene = game.scenes.find((s) => s.id === state.sceneId);

	if (state.status === "win") {
		return (
			<View style={styles.resultContainer}>
				<Text style={styles.resultEmoji}>🎉</Text>
				<Text style={styles.resultTitle}>You won!</Text>
				{state.vars.score != null && (
					<Text style={styles.resultScore}>Score: {String(state.vars.score)}</Text>
				)}
			</View>
		);
	}

	if (state.status === "lose") {
		return (
			<View style={styles.resultContainer}>
				<Text style={styles.resultEmoji}>😞</Text>
				<Text style={styles.resultTitle}>Game over</Text>
				{state.vars.score != null && (
					<Text style={styles.resultScore}>Score: {String(state.vars.score)}</Text>
				)}
			</View>
		);
	}

	if (!currentScene) {
		return (
			<View style={styles.container}>
				<Text style={styles.errorText}>Scene not found: {state.sceneId}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{/* Timer bar */}
			{timeLeft !== null && timerDef && (
				<TimerBar timeLeft={timeLeft} total={timerDef.seconds} />
			)}

			{/* Variable HUD: lives and score if defined */}
			<VariableHUD vars={state.vars} />

			{/* The scene */}
			<SceneRenderer
				scene={currentScene}
				variables={state.vars}
				onCorrect={() => dispatch("CORRECT")}
				onWrong={() => dispatch("WRONG")}
				onSceneWin={() => dispatch("WIN")}
				onSceneLose={() => dispatch("LOSE")}
				onContinue={() => dispatch("CONTINUE")}
				isActive={isActive && state.status === "playing"}
			/>
		</View>
	);
}

// ─── HUD helpers ──────────────────────────────────────────────────────────────

function VariableHUD({ vars }: { vars: Record<string, unknown> }) {
	const entries = Object.entries(vars).filter(
		([k]) => k === "score" || k === "lives" || k === "round"
	);
	if (entries.length === 0) return null;
	return (
		<View style={styles.hud}>
			{entries.map(([k, v]) => (
				<Text key={k} style={styles.hudItem}>
					{k}: {String(v)}
				</Text>
			))}
		</View>
	);
}

function TimerBar({ timeLeft, total }: { timeLeft: number; total: number }) {
	const pct = Math.max(0, timeLeft / total);
	const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
	return (
		<View style={styles.timerTrack}>
			<View style={[styles.timerFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
			<Text style={styles.timerText}>{timeLeft}s</Text>
		</View>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16 },
	legacyText: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 40 },
	title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
	completedLabel: { fontSize: 14, color: "#6b7280", marginTop: 12 },
	errorText: { fontSize: 14, color: "#ef4444", textAlign: "center", marginTop: 40 },
	resultContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
	resultEmoji: { fontSize: 56, marginBottom: 16 },
	resultTitle: { fontSize: 28, fontWeight: "700", color: "#111827" },
	resultScore: { fontSize: 18, color: "#6b7280", marginTop: 8 },
	hud: { flexDirection: "row", gap: 16, paddingVertical: 8, paddingHorizontal: 4 },
	hudItem: { fontSize: 14, fontWeight: "600", color: "#374151", textTransform: "capitalize" },
	timerTrack: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 8, overflow: "hidden", position: "relative" },
	timerFill: { height: "100%", borderRadius: 3 },
	timerText: { position: "absolute", right: 4, top: -10, fontSize: 11, color: "#6b7280" },
});
