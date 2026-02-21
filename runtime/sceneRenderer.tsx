/**
 * SceneRenderer — maps a GameScene's content.kind to the correct UI component.
 * Visually matches the existing 12 game components in components/games/.
 */

import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import type { GameScene } from "../config/customPuzzleGame";
import {
	codebreakerFeedback,
	containsLetter,
	exactMatch,
	groupMatch,
	sequenceCheck,
	wordleFeedback,
} from "./mechanicExecutor";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Game accent color for custom games ───────────────────────────────────────
// Golden accent — matches the app's primary accent throughout
const ACCENT = Colors.accent; // #fcd34d

// ─── Shared props ─────────────────────────────────────────────────────────────

export interface SceneRendererProps {
	scene: GameScene;
	variables: Record<string, unknown>;
	onCorrect: () => void;
	onWrong: () => void;
	onSceneWin: () => void;
	onSceneLose: () => void;
	onContinue: () => void;
	isActive: boolean;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function SceneRenderer(props: SceneRendererProps) {
	const { scene } = props;
	switch (scene.content.kind) {
		case "MCQ":              return <MCQScene {...props} />;
		case "MCQ_MULTI":        return <MCQMultiScene {...props} />;
		case "TEXT_INPUT":       return <TextInputScene {...props} />;
		case "TEXT_INPUT_MULTI": return <TextInputMultiScene {...props} />;
		case "WORD_GUESS":       return <WordGuessScene {...props} />;
		case "WORDLE":           return <WordleScene {...props} />;
		case "SEQUENCE":         return <SequenceScene {...props} />;
		case "CATEGORY":         return <CategoryScene {...props} />;
		case "NUMBER_GRID":      return <NumberGridScene {...props} />;
		case "PATH":             return <PathScene {...props} />;
		case "CODEBREAKER":      return <CodeBreakerScene {...props} />;
		case "MEMORY":           return <MemoryScene {...props} />;
		case "INFO":             return <InfoScene {...props} />;
	}
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

/** Large prompt card — used like promptCard in RiddleGame / TriviaGame */
function PromptCard({ text }: { text: string }) {
	return (
		<View style={sh.promptCard}>
			<Text style={sh.promptText}>{text}</Text>
		</View>
	);
}

/** Orange hint strip — matches hintContainer in RiddleGame */
function HintStrip({ text }: { text: string }) {
	return (
		<View style={sh.hintStrip}>
			<Text style={sh.hintText}>💡 {text}</Text>
		</View>
	);
}

/** Question counter pill — matches GameHeader subtitle */
function CounterPill({ current, total, label }: { current: number; total: number; label?: string }) {
	return (
		<Text style={sh.counterPill}>{label ?? "Question"} {current} / {total}</Text>
	);
}

/** Choice button — matches choiceButton in TriviaGame / RiddleGame / InferenceGame */
function ChoiceBtn({
	label,
	state = "idle",
	onPress,
}: {
	label: string;
	state?: "idle" | "selected" | "correct" | "wrong" | "disabled";
	onPress: () => void;
}) {
	const scale = useRef(new Animated.Value(1)).current;

	const handlePress = () => {
		Animated.sequence([
			Animated.timing(scale, { toValue: 0.97, duration: 70,  useNativeDriver: true }),
			Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
		]).start();
		onPress();
	};

	const containerStyle = [
		sh.choiceBtn,
		state === "selected" && sh.choiceBtnSelected,
		state === "correct"  && sh.choiceBtnCorrect,
		state === "wrong"    && sh.choiceBtnWrong,
		state === "disabled" && sh.choiceBtnDisabled,
	];

	const textStyle = [
		sh.choiceBtnText,
		state === "correct" && sh.choiceBtnTextCorrect,
		state === "wrong"   && sh.choiceBtnTextWrong,
	];

	return (
		<Animated.View style={{ transform: [{ scale }] }}>
			<TouchableOpacity
				style={containerStyle}
				onPress={handlePress}
				disabled={state !== "idle" && state !== "selected"}
				activeOpacity={0.75}
			>
				{state === "correct" && <Text style={sh.choiceBtnIcon}>✓  </Text>}
				{state === "wrong"   && <Text style={sh.choiceBtnIcon}>✗  </Text>}
				<Text style={textStyle}>{label}</Text>
			</TouchableOpacity>
		</Animated.View>
	);
}

/** Primary action button — matches checkButton / submitButton in existing games */
function ActionBtn({
	label,
	onPress,
	disabled,
	color = ACCENT,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	color?: string;
}) {
	return (
		<TouchableOpacity
			style={[sh.actionBtn, { backgroundColor: disabled ? Colors.borders.subtle : color }, disabled && sh.actionBtnDisabled]}
			onPress={onPress}
			disabled={disabled}
			activeOpacity={0.8}
		>
			<Text style={[sh.actionBtnText, disabled && sh.actionBtnTextDisabled]}>{label}</Text>
		</TouchableOpacity>
	);
}

/** Secondary button — matches clearButton in existing games */
function SecondaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
	return (
		<TouchableOpacity
			style={[sh.secondaryBtn, disabled && { opacity: 0.4 }]}
			onPress={onPress}
			disabled={disabled}
			activeOpacity={0.8}
		>
			<Text style={sh.secondaryBtnText}>{label}</Text>
		</TouchableOpacity>
	);
}

/** Number input button — matches numberButton in MagicSquare / Sudoku / Futoshiki / TrailFinder */
function NumBtn({ n, active, onPress }: { n: number; active: boolean; onPress: () => void }) {
	return (
		<TouchableOpacity
			style={[sh.numBtn, active && sh.numBtnActive]}
			onPress={onPress}
			activeOpacity={0.7}
		>
			<Text style={[sh.numBtnText, active && sh.numBtnTextActive]}>{n}</Text>
		</TouchableOpacity>
	);
}

// ─── 1. MCQ ───────────────────────────────────────────────────────────────────

function MCQScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "MCQ") return null;

	const [answered, setAnswered] = useState<string | null>(null);

	const handle = (id: string) => {
		if (!isActive || answered) return;
		setAnswered(id);
		if (id === c.correctId) { onCorrect(); setTimeout(onSceneWin, 700); }
		else                    { onWrong();   setTimeout(onSceneLose, 700); }
	};

	const stateFor = (id: string) => {
		if (!answered)        return "idle";
		if (id === c.correctId) return "correct";
		if (id === answered)  return "wrong";
		return "disabled";
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<PromptCard text={c.question} />
			{c.hint && !answered && <HintStrip text={c.hint} />}
			<View style={sh.choices}>
				{c.choices.map((ch) => (
					<ChoiceBtn key={ch.id} label={ch.label} state={stateFor(ch.id) as any} onPress={() => handle(ch.id)} />
				))}
			</View>
		</ScrollView>
	);
}

// ─── 2. MCQ_MULTI ─────────────────────────────────────────────────────────────

function MCQMultiScene({ scene, onCorrect, onWrong, onSceneWin, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "MCQ_MULTI") return null;

	const [idx, setIdx] = useState(0);
	const [answered, setAnswered] = useState<string | null>(null);
	const q = c.questions[idx];

	const handle = (id: string) => {
		if (!isActive || answered) return;
		setAnswered(id);
		if (id === q.correctId) onCorrect(); else onWrong();
		setTimeout(() => {
			const next = idx + 1;
			if (next >= c.questions.length) onSceneWin();
			else { setIdx(next); setAnswered(null); }
		}, 700);
	};

	const stateFor = (id: string) => {
		if (!answered)          return "idle";
		if (id === q.correctId) return "correct";
		if (id === answered)    return "wrong";
		return "disabled";
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<CounterPill current={idx + 1} total={c.questions.length} />
			<PromptCard text={q.question} />
			{q.hint && !answered && <HintStrip text={q.hint} />}
			<View style={sh.choices}>
				{q.choices.map((ch) => (
					<ChoiceBtn key={ch.id} label={ch.label} state={stateFor(ch.id) as any} onPress={() => handle(ch.id)} />
				))}
			</View>
		</ScrollView>
	);
}

// ─── 3. TEXT_INPUT ────────────────────────────────────────────────────────────

function TextInputScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "TEXT_INPUT") return null;

	const [value, setValue] = useState("");
	const [result, setResult] = useState<"correct" | "wrong" | null>(null);
	const shake = useRef(new Animated.Value(0)).current;

	const handle = () => {
		if (!isActive || result || !value.trim()) return;
		const ok = exactMatch(value, c.answer, c.caseSensitive);
		setResult(ok ? "correct" : "wrong");
		if (ok) { onCorrect(); setTimeout(onSceneWin, 700); }
		else {
			Animated.sequence([
				Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
				Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
				Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
				Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
			]).start();
			onWrong();
			setTimeout(onSceneLose, 700);
		}
	};

	const borderColor = result === "correct" ? Colors.game.correct : result === "wrong" ? Colors.game.incorrect : Colors.borders.primary;
	const bgColor     = result === "correct" ? Colors.game.correct + "15" : result === "wrong" ? Colors.game.incorrect + "15" : Colors.background.primary;

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<PromptCard text={c.prompt} />
			{c.hint && !result && <HintStrip text={c.hint} />}
			<Animated.View style={{ transform: [{ translateX: shake }] }}>
				<TextInput
					style={[sh.textInput, { borderColor, backgroundColor: bgColor }] as any}
					value={value}
					onChangeText={setValue}
					placeholder="Type your answer…"
					placeholderTextColor={Colors.text.inactive}
					editable={!result && isActive}
					onSubmitEditing={handle}
					returnKeyType="done"
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</Animated.View>
			{result === "wrong" && (
				<View style={sh.feedbackError}>
					<Text style={sh.feedbackErrorText}>Answer: {c.answer}</Text>
				</View>
			)}
			<ActionBtn label="Submit" onPress={handle} disabled={!value.trim() || !!result} />
		</ScrollView>
	);
}

// ─── 4. TEXT_INPUT_MULTI ──────────────────────────────────────────────────────

function TextInputMultiScene({ scene, onCorrect, onWrong, onSceneWin, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "TEXT_INPUT_MULTI") return null;

	const [idx, setIdx] = useState(0);
	const [value, setValue] = useState("");
	const [result, setResult] = useState<"correct" | "wrong" | null>(null);
	const round = c.rounds[idx];
	const shake = useRef(new Animated.Value(0)).current;

	const handle = () => {
		if (!isActive || result || !value.trim()) return;
		const ok = exactMatch(value, round.answer);
		setResult(ok ? "correct" : "wrong");
		if (ok) onCorrect();
		else {
			Animated.sequence([
				Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
				Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
				Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
			]).start();
			onWrong();
		}
		setTimeout(() => {
			const next = idx + 1;
			if (next >= c.rounds.length) onSceneWin();
			else { setIdx(next); setValue(""); setResult(null); }
		}, 800);
	};

	const borderColor = result === "correct" ? Colors.game.correct : result === "wrong" ? Colors.game.incorrect : Colors.borders.primary;
	const bgColor     = result === "correct" ? Colors.game.correct + "15" : result === "wrong" ? Colors.game.incorrect + "15" : Colors.background.primary;

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<CounterPill current={idx + 1} total={c.rounds.length} />
			<PromptCard text={round.prompt} />
			{round.hint && !result && <HintStrip text={round.hint} />}
			<Animated.View style={{ transform: [{ translateX: shake }] }}>
				<TextInput
					style={[sh.textInput, { borderColor, backgroundColor: bgColor }] as any}
					value={value}
					onChangeText={setValue}
					placeholder="Type your answer…"
					placeholderTextColor={Colors.text.inactive}
					editable={!result && isActive}
					onSubmitEditing={handle}
					returnKeyType="done"
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</Animated.View>
			<ActionBtn label="Submit" onPress={handle} disabled={!value.trim() || !!result} />
		</ScrollView>
	);
}

// ─── 5. WORD_GUESS (Hangman) ──────────────────────────────────────────────────

const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function WordGuessScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "WORD_GUESS") return null;

	const word = c.word.toUpperCase();
	const [guessed, setGuessed] = useState<Set<string>>(new Set());
	const [wrong, setWrong] = useState(0);
	const [done, setDone] = useState(false);

	const revealed = word.split("").map((l) => (guessed.has(l) ? l : null));
	const allRevealed = revealed.every((l) => l !== null);

	useEffect(() => {
		if (done) return;
		if (allRevealed)             { setDone(true); onSceneWin(); }
		else if (wrong >= c.maxWrongGuesses) { setDone(true); onSceneLose(); }
	}, [guessed, wrong]);

	const tap = (letter: string) => {
		if (!isActive || done || guessed.has(letter)) return;
		setGuessed((p) => new Set([...p, letter]));
		if (containsLetter(word, letter)) onCorrect();
		else { setWrong((w) => w + 1); onWrong(); }
	};

	const livesLeft = c.maxWrongGuesses - wrong;

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			{c.hint && (
				<Text style={gs.hangHint}>{c.hint}</Text>
			)}

			{/* Lives */}
			<View style={gs.livesRow}>
				{Array.from({ length: c.maxWrongGuesses }).map((_, i) => (
					<Text key={i} style={gs.lifeIcon}>{i < livesLeft ? "❤️" : "🖤"}</Text>
				))}
			</View>

			{/* Word slots */}
			<View style={gs.wordRow}>
				{revealed.map((l, i) => (
					<View key={i} style={gs.letterSlot}>
						<Text style={gs.letterText}>{l ?? ""}</Text>
						<View style={[gs.underline, l ? gs.underlineFilled : null]} />
					</View>
				))}
			</View>

			{/* Missed letters */}
			{wrong > 0 && (
				<Text style={gs.missedText}>
					Missed: {[...guessed].filter((l) => !word.includes(l)).join("  ")}
				</Text>
			)}

			{/* QWERTY keyboard — matches WordForm keyboard */}
			{!done && (
				<View style={gs.keyboard}>
					{KB_ROWS.map((row, ri) => (
						<View key={ri} style={gs.kbRow}>
							{row.split("").map((l) => {
								const hit  = guessed.has(l) && containsLetter(word, l);
								const miss = guessed.has(l) && !containsLetter(word, l);
								return (
									<TouchableOpacity
										key={l}
										style={[gs.key, hit && gs.keyHit, miss && gs.keyMiss]}
										onPress={() => tap(l)}
										disabled={guessed.has(l) || done}
										activeOpacity={0.7}
									>
										<Text style={[gs.keyText, (hit || miss) && gs.keyTextUsed]}>{l}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					))}
				</View>
			)}
		</ScrollView>
	);
}

// ─── 6. WORDLE ────────────────────────────────────────────────────────────────

// Matches WordForm tile colors exactly
const WL_CORRECT = "#6aaa64";
const WL_PRESENT = "#c9b458";
const WL_ABSENT  = "#787c7e";

function WordleScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "WORDLE") return null;

	type GuessRow = { letter: string; result: "correct" | "present" | "absent" | "empty" };

	const tileSize = Math.min(56, Math.floor((SCREEN_WIDTH - Spacing.lg * 2 - (c.wordLength - 1) * 4) / c.wordLength));

	const [guesses, setGuesses] = useState<GuessRow[][]>([]);
	const [current, setCurrent] = useState("");
	const [done, setDone] = useState(false);

	const tapKey = (l: string) => {
		if (!isActive || done) return;
		if (l === "⌫") { setCurrent((p) => p.slice(0, -1)); return; }
		if (l === "↵") { handleSubmit(); return; }
		if (current.length < c.wordLength) setCurrent((p) => p + l);
	};

	const handleSubmit = () => {
		if (!isActive || done || current.length !== c.wordLength) return;
		const fb = wordleFeedback(current, c.word);
		const row: GuessRow[] = current.split("").map((letter, i) => ({ letter, result: fb.letters[i] }));
		const next = [...guesses, row];
		setGuesses(next);
		setCurrent("");
		if (fb.isCorrect) { setDone(true); onCorrect(); setTimeout(onSceneWin, 500); }
		else if (next.length >= c.maxAttempts) { setDone(true); onWrong(); setTimeout(onSceneLose, 500); }
		else onWrong();
	};

	// Build keyboard state
	const keyState: Record<string, "correct" | "present" | "absent"> = {};
	guesses.flat().forEach(({ letter, result }) => {
		if (result === "empty") return;
		if (result === "correct" || !keyState[letter]) keyState[letter] = result;
	});

	const tileBg = (r: GuessRow["result"], hasLetter: boolean) => {
		if (r === "correct") return WL_CORRECT;
		if (r === "present") return WL_PRESENT;
		if (r === "absent")  return WL_ABSENT;
		return hasLetter ? Colors.background.primary : Colors.background.tertiary;
	};
	const keyBg = (s?: string) => {
		if (s === "correct") return WL_CORRECT;
		if (s === "present") return WL_PRESENT;
		if (s === "absent")  return WL_ABSENT;
		return Colors.background.tertiary;
	};
	const keyTextColor = (s?: string) => s ? "#fff" : Colors.text.primary;

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			{c.hint && <HintStrip text={c.hint} />}

			{/* Board */}
			<View style={gs.wlBoard}>
				{Array.from({ length: c.maxAttempts }).map((_, ri) => {
					const row = guesses[ri];
					const isCurrent = ri === guesses.length;
					return (
						<View key={ri} style={[gs.wlRow, { gap: 4 }]}>
							{Array.from({ length: c.wordLength }).map((_, ci) => {
								const cell = row?.[ci];
								const letter = cell ? cell.letter : (isCurrent ? current[ci] ?? "" : "");
								const r: GuessRow["result"] = cell ? cell.result : "empty";
								const bg = tileBg(r, letter.length > 0);
								const textCol = r !== "empty" ? "#fff" : Colors.text.primary;
								return (
									<View
										key={ci}
										style={[
											gs.wlTile,
											{ width: tileSize, height: tileSize, backgroundColor: bg,
											  borderColor: letter && r === "empty" ? Colors.borders.primary : bg === Colors.background.tertiary ? Colors.borders.subtle : bg },
										]}
									>
										<Text style={[gs.wlLetter, { color: textCol, fontSize: tileSize * 0.44 }]}>{letter}</Text>
									</View>
								);
							})}
						</View>
					);
				})}
			</View>

			{/* Keyboard */}
			{!done && (
				<View style={gs.wlKeyboard}>
					{KB_ROWS.map((row, ri) => (
						<View key={ri} style={gs.kbRow}>
							{ri === 2 && (
								<TouchableOpacity style={[gs.wlKey, gs.wlKeyWide, { backgroundColor: Colors.background.tertiary }]} onPress={handleSubmit} activeOpacity={0.7}>
									<Text style={[gs.wlKeyText, { color: Colors.text.primary }]}>↵</Text>
								</TouchableOpacity>
							)}
							{row.split("").map((l) => (
								<TouchableOpacity
									key={l}
									style={[gs.wlKey, { backgroundColor: keyBg(keyState[l]) }]}
									onPress={() => tapKey(l)}
									activeOpacity={0.7}
								>
									<Text style={[gs.wlKeyText, { color: keyTextColor(keyState[l]) }]}>{l}</Text>
								</TouchableOpacity>
							))}
							{ri === 2 && (
								<TouchableOpacity style={[gs.wlKey, gs.wlKeyWide, { backgroundColor: Colors.background.tertiary }]} onPress={() => tapKey("⌫")} activeOpacity={0.7}>
									<Text style={[gs.wlKeyText, { color: Colors.text.primary }]}>⌫</Text>
								</TouchableOpacity>
							)}
						</View>
					))}
				</View>
			)}

			{done && !guesses[guesses.length - 1]?.every(g => g.result === "correct") && (
				<View style={sh.feedbackError}>
					<Text style={sh.feedbackErrorText}>The word was: <Text style={{ fontWeight: "700" }}>{c.word}</Text></Text>
				</View>
			)}
		</ScrollView>
	);
}

// ─── 7. SEQUENCE ──────────────────────────────────────────────────────────────

function SequenceScene({ scene, onCorrect, onWrong, onSceneWin, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "SEQUENCE") return null;

	const [order, setOrder] = useState<number[]>(() => c.items.map((_, i) => i));
	const [result, setResult] = useState<"correct" | "wrong" | null>(null);

	const move = (from: number, dir: -1 | 1) => {
		if (!isActive || result) return;
		const to = from + dir;
		if (to < 0 || to >= order.length) return;
		const next = [...order];
		[next[from], next[to]] = [next[to], next[from]];
		setOrder(next);
	};

	const handleSubmit = () => {
		if (!isActive || result) return;
		const ok = sequenceCheck(order, c.solution);
		if (ok) {
			setResult("correct");
			onCorrect();
			setTimeout(onSceneWin, 600);
		} else {
			setResult("wrong");
			onWrong();
			setTimeout(() => setResult(null), 800);
		}
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			{c.hint && <HintStrip text={c.hint} />}
			{c.rules?.map((r, i) => (
				<Text key={i} style={sh.ruleText}>• {r}</Text>
			))}
			<Text style={sh.sectionLabel}>Arrange in the correct order:</Text>
			{order.map((itemIdx, pos) => (
				<View
					key={itemIdx}
					style={[
						gs.seqItem,
						result === "correct" && gs.seqItemCorrect,
						result === "wrong"   && gs.seqItemWrong,
					]}
				>
					<View style={gs.seqBadge}>
						<Text style={gs.seqBadgeText}>{pos + 1}</Text>
					</View>
					<Text style={gs.seqLabel}>{c.items[itemIdx]}</Text>
					{!result && (
						<View style={gs.seqArrows}>
							<TouchableOpacity
								style={[gs.arrowBtn, pos === 0 && { opacity: 0.25 }]}
								onPress={() => move(pos, -1)}
								disabled={pos === 0}
							>
								<Text style={gs.arrowText}>▲</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[gs.arrowBtn, pos === order.length - 1 && { opacity: 0.25 }]}
								onPress={() => move(pos, 1)}
								disabled={pos === order.length - 1}
							>
								<Text style={gs.arrowText}>▼</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			))}
			{!result && <ActionBtn label="Check Order" onPress={handleSubmit} />}
		</ScrollView>
	);
}

// ─── 8. CATEGORY (Connections) ────────────────────────────────────────────────

function CategoryScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "CATEGORY") return null;

	const groupSize = Math.ceil(c.items.length / c.groups.length);
	const [selected, setSelected] = useState<string[]>([]);
	const [solved, setSolved] = useState<string[]>([]);
	const [wrongCount, setWrongCount] = useState(0);
	const [done, setDone] = useState(false);

	const remaining = c.items.filter((item) => !solved.includes(item.groupId));

	const toggle = (id: string) => {
		if (!isActive || done) return;
		setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < groupSize ? [...p, id] : p);
	};

	const handleSubmit = () => {
		if (!isActive || done || selected.length !== groupSize) return;
		const res = groupMatch(selected, c.items, groupSize);
		if (res.isCorrect && res.groupId) {
			const newSolved = [...solved, res.groupId];
			setSolved(newSolved); setSelected([]); onCorrect();
			if (newSolved.length === c.groups.length) { setDone(true); onSceneWin(); }
		} else {
			const nw = wrongCount + 1;
			setWrongCount(nw); setSelected([]); onWrong();
			if (c.maxWrongGuesses && nw >= c.maxWrongGuesses) { setDone(true); onSceneLose(); }
		}
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<View style={gs.catHeaderRow}>
				<Text style={sh.sectionLabel}>Select {groupSize} that belong together</Text>
				{!!c.maxWrongGuesses && (
					<View style={[gs.mistakePill, { borderColor: Colors.game.incorrect + "55" }]}>
						<Text style={gs.mistakeText}>{c.maxWrongGuesses - wrongCount} left</Text>
					</View>
				)}
			</View>

			{/* Solved groups */}
			{solved.map((gid) => {
				const group = c.groups.find((g) => g.id === gid)!;
				const items = c.items.filter((i) => i.groupId === gid);
				const col = group?.color ?? Colors.game.correct;
				return (
					<View key={gid} style={[gs.solvedGroup, { backgroundColor: col + "22", borderColor: col }]}>
						<Text style={[gs.solvedGroupTitle, { color: col }]}>{group?.label}</Text>
						<Text style={gs.solvedGroupItems}>{items.map((i) => i.label).join("  ·  ")}</Text>
					</View>
				);
			})}

			{/* Grid */}
			<View style={gs.catGrid}>
				{remaining.map((item) => (
					<TouchableOpacity
						key={item.id}
						style={[gs.catItem, selected.includes(item.id) && gs.catItemSelected]}
						onPress={() => toggle(item.id)}
						disabled={done}
						activeOpacity={0.75}
					>
						<Text style={[gs.catItemText, selected.includes(item.id) && gs.catItemTextSelected]}>
							{item.label}
						</Text>
					</TouchableOpacity>
				))}
			</View>

			{!done && (
				<ActionBtn
					label={`Submit (${selected.length} / ${groupSize})`}
					onPress={handleSubmit}
					disabled={selected.length !== groupSize}
				/>
			)}
		</ScrollView>
	);
}

// ─── 9. NUMBER_GRID ───────────────────────────────────────────────────────────

function NumberGridScene({ scene, onSceneWin, onWrong, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "NUMBER_GRID") return null;

	const cellSize = Math.min(56, Math.floor((SCREEN_WIDTH - Spacing.lg * 2 - 4) / c.size));
	const total = c.size * c.size;

	const [grid, setGrid] = useState<(number | null)[]>(() => {
		const g: (number | null)[] = Array(total).fill(null);
		c.givens.forEach(({ row, col, value }) => { g[row * c.size + col] = value; });
		return g;
	});
	const [selected, setSelected] = useState<number | null>(null);
	const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

	const isGiven = (idx: number) => c.givens.some(({ row, col }) => row * c.size + col === idx);

	const handleCell = (idx: number) => {
		if (!isActive || isGiven(idx) || flash) return;
		setSelected(idx === selected ? null : idx);
	};

	const handleNum = (n: number) => {
		if (!isActive || selected === null || flash) return;
		setGrid((p) => { const next = [...p]; next[selected] = n; return next; });
	};

	const handleClear = () => {
		if (selected === null || isGiven(selected)) return;
		setGrid((p) => { const next = [...p]; next[selected] = null; return next; });
	};

	const handleCheck = () => {
		if (!isActive || flash) return;
		const playerGrid = grid.map((v) => v ?? 0);
		if (playerGrid.some((v) => v === 0)) return;
		const ok = playerGrid.every((v, i) => c.solution[i] === 0 || v === c.solution[i]);
		setFlash(ok ? "correct" : "wrong");
		if (ok) { setTimeout(onSceneWin, 500); }
		else { onWrong(); setTimeout(() => setFlash(null), 900); }
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			{c.gridType === "magic_square" && c.magicConstant != null && (
				<View style={gs.gridHintRow}>
					<Text style={gs.gridHintLabel}>Magic Constant</Text>
					<Text style={[gs.gridHintVal, { color: ACCENT }]}>{c.magicConstant}</Text>
				</View>
			)}

			{/* Grid — matches MagicSquare / Sudoku grid rendering */}
			<View style={[gs.grid, { width: cellSize * c.size + 4, alignSelf: "center" }]}>
				{grid.map((val, idx) => {
					const given    = isGiven(idx);
					const isSel    = selected === idx;
					const isErr    = flash === "wrong" && !given;
					const isOk     = flash === "correct";
					return (
						<TouchableOpacity
							key={idx}
							style={[
								gs.gridCell,
								{ width: cellSize, height: cellSize },
								given  && gs.gridCellGiven,
								isSel  && gs.gridCellSelected,
								isErr  && gs.gridCellError,
								isOk   && gs.gridCellCorrect,
							]}
							onPress={() => handleCell(idx)}
							disabled={given}
							activeOpacity={0.8}
						>
							<Text style={[gs.gridCellText, given && gs.gridCellTextGiven]}>
								{val ?? ""}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			{/* Number buttons */}
			<View style={gs.numBtns}>
				{Array.from({ length: c.size }, (_, i) => i + 1).map((n) => (
					<NumBtn key={n} n={n} active={selected !== null && !isGiven(selected!)} onPress={() => handleNum(n)} />
				))}
			</View>

			{/* Actions — matches Clear + Check pattern */}
			<View style={gs.gridActions}>
				<SecondaryBtn label="Clear" onPress={handleClear} disabled={selected === null || isGiven(selected ?? -1)} />
				<ActionBtn label="Check" onPress={handleCheck} disabled={grid.some((v) => v === null)} />
			</View>

			{flash === "wrong" && (
				<View style={sh.feedbackError}>
					<Text style={sh.feedbackErrorText}>Not quite — keep trying!</Text>
				</View>
			)}
		</ScrollView>
	);
}

// ─── 10. PATH ─────────────────────────────────────────────────────────────────

function PathScene({ scene, onSceneWin, onWrong, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "PATH") return null;

	const cellSize = Math.min(60, Math.floor((SCREEN_WIDTH - Spacing.lg * 2 - 4) / c.cols));
	const [tapped, setTapped] = useState<number[]>([]);
	const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

	const cellMap = new Map(c.cells.map((cell) => [cell.pos, cell.value]));
	const givenSet = new Set(c.givens?.map((g) => g.pos) ?? []);

	const handleTap = (pos: number) => {
		if (!isActive || flash) return;
		if (tapped.includes(pos)) setTapped((p) => p.slice(0, p.indexOf(pos)));
		else setTapped((p) => [...p, pos]);
	};

	const handleCheck = () => {
		if (!isActive || flash) return;
		const ok = tapped.length === c.solution.length && tapped.every((v, i) => v === c.solution[i]);
		setFlash(ok ? "correct" : "wrong");
		if (ok) { onSceneWin(); }
		else { onWrong(); setTimeout(() => { setFlash(null); setTapped([]); }, 700); }
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<Text style={sh.sectionLabel}>Tap cells in the correct order to trace the path:</Text>

			<View style={[gs.grid, { width: cellSize * c.cols + 4, alignSelf: "center" }]}>
				{Array.from({ length: c.rows * c.cols }).map((_, pos) => {
					const val     = cellMap.get(pos);
					const inPath  = tapped.includes(pos);
					const step    = tapped.indexOf(pos);
					const isStart = givenSet.has(pos) && pos === c.givens?.[0]?.pos;
					const isEnd   = givenSet.has(pos) && pos === c.givens?.[c.givens.length - 1]?.pos;
					return (
						<TouchableOpacity
							key={pos}
							style={[
								gs.gridCell,
								{ width: cellSize, height: cellSize },
								val == null && gs.pathCellEmpty,
								inPath && [gs.pathCellTapped, flash === "correct" && gs.gridCellCorrect, flash === "wrong" && gs.gridCellError],
								isStart && gs.pathCellStart,
								isEnd   && gs.pathCellEnd,
							]}
							onPress={() => val != null ? handleTap(pos) : undefined}
							disabled={val == null}
							activeOpacity={0.75}
						>
							{inPath && step >= 0 && (
								<View style={gs.pathStepBadge}>
									<Text style={gs.pathStepText}>{step + 1}</Text>
								</View>
							)}
							<Text style={[gs.gridCellText, isStart && { color: Colors.game.correct, fontWeight: "700" }, isEnd && { color: ACCENT, fontWeight: "700" }]}>
								{val ?? ""}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			<View style={gs.gridActions}>
				<SecondaryBtn label="Clear" onPress={() => setTapped([])} disabled={tapped.length === 0} />
				<ActionBtn label="Check Path" onPress={handleCheck} disabled={tapped.length === 0} />
			</View>

			{flash === "wrong" && (
				<View style={sh.feedbackError}>
					<Text style={sh.feedbackErrorText}>Not the right path — try again!</Text>
				</View>
			)}
		</ScrollView>
	);
}

// ─── 11. CODEBREAKER ──────────────────────────────────────────────────────────

const CB_EMOJI: Record<string, string> = {
	red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡",
	orange: "🟠", purple: "🟣", white: "⚪", black: "⚫",
	pink: "💗", brown: "🟤",
};
const cbEmoji = (c: string) => CB_EMOJI[c.toLowerCase()] ?? "⭕";

function CodeBreakerScene({ scene, onCorrect, onWrong, onSceneWin, onSceneLose, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "CODEBREAKER") return null;

	type G = { guess: string[]; exact: number; present: number };
	const [guesses, setGuesses] = useState<G[]>([]);
	const [current, setCurrent] = useState<string[]>([]);
	const [done, setDone] = useState(false);

	const tapColor = (color: string) => {
		if (!isActive || done || current.length >= c.secretCode.length) return;
		setCurrent((p) => [...p, color]);
	};
	const removeLast = () => setCurrent((p) => p.slice(0, -1));

	const handleCheck = () => {
		if (!isActive || done || current.length !== c.secretCode.length) return;
		const res = codebreakerFeedback(current, c.secretCode);
		const next = [...guesses, { guess: current, ...res }];
		setGuesses(next); setCurrent([]);
		if (res.isCorrect) { setDone(true); onCorrect(); setTimeout(onSceneWin, 500); }
		else if (next.length >= c.maxGuesses) { setDone(true); onWrong(); setTimeout(onSceneLose, 500); }
		else onWrong();
	};

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<View style={gs.cbHeader}>
				<Text style={sh.sectionLabel}>{c.secretCode.length} colors · {c.maxGuesses} guesses</Text>
				{!done && (
					<View style={gs.cbCountPill}>
						<Text style={gs.cbCountText}>{c.maxGuesses - guesses.length} left</Text>
					</View>
				)}
			</View>

			{/* History rows */}
			{guesses.map((g, i) => (
				<View key={i} style={gs.cbHistoryRow}>
					<View style={gs.cbPegsRow}>
						{g.guess.map((col, j) => (
							<Text key={j} style={gs.cbPegEmoji}>{cbEmoji(col)}</Text>
						))}
					</View>
					<View style={gs.cbFeedback}>
						<View style={[gs.cbFbChip, { borderColor: Colors.game.correct + "66", backgroundColor: Colors.game.correct + "18" }]}>
							<Text style={[gs.cbFbText, { color: Colors.game.correct }]}>⚫ {g.exact}</Text>
						</View>
						<View style={[gs.cbFbChip, { borderColor: Colors.game.present + "66", backgroundColor: Colors.game.present + "18" }]}>
							<Text style={[gs.cbFbText, { color: Colors.text.secondary }]}>⚪ {g.present}</Text>
						</View>
					</View>
				</View>
			))}

			{/* Current guess */}
			{!done && (
				<View style={gs.cbCurrentRow}>
					{Array.from({ length: c.secretCode.length }).map((_, i) => (
						<View key={i} style={[gs.cbCurrentSlot, !current[i] && gs.cbCurrentSlotEmpty]}>
							<Text style={gs.cbPegEmoji}>{current[i] ? cbEmoji(current[i]) : "·"}</Text>
						</View>
					))}
				</View>
			)}

			{/* Palette */}
			{!done && (
				<>
					<View style={gs.cbPalette}>
						{c.options.map((col) => (
							<TouchableOpacity
								key={col}
								style={[gs.cbColorBtn, current.length >= c.secretCode.length && { opacity: 0.35 }]}
								onPress={() => tapColor(col)}
								disabled={current.length >= c.secretCode.length}
								activeOpacity={0.75}
							>
								<Text style={{ fontSize: 30 }}>{cbEmoji(col)}</Text>
							</TouchableOpacity>
						))}
					</View>
					<View style={gs.gridActions}>
						<SecondaryBtn label="⌫ Remove" onPress={removeLast} disabled={current.length === 0} />
						<ActionBtn label="Check" onPress={handleCheck} disabled={current.length !== c.secretCode.length} />
					</View>
				</>
			)}
		</ScrollView>
	);
}

// ─── 12. MEMORY ───────────────────────────────────────────────────────────────

function MemoryScene({ scene, onSceneWin, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "MEMORY") return null;

	const cardSize = Math.min(72, Math.floor((SCREEN_WIDTH - Spacing.lg * 2 - (c.cols - 1) * Spacing.sm) / c.cols));

	// Shuffle once on mount
	const [cards] = useState(() =>
		[...c.pairs, ...c.pairs.map((p) => ({ ...p, id: p.id + "_b" }))]
			.sort(() => Math.random() - 0.5)
	);
	const [flipped, setFlipped]  = useState<string[]>([]);
	const [matched, setMatched]  = useState<Set<string>>(new Set());
	const [locked,  setLocked]   = useState(false);

	const isMatch  = (id: string) => matched.has(id);
	const isFlip   = (id: string) => flipped.includes(id) || isMatch(id);

	const handleFlip = (id: string) => {
		if (!isActive || locked || isFlip(id)) return;
		const next = [...flipped, id];
		setFlipped(next);
		if (next.length === 2) {
			setLocked(true);
			const a = cards.find((x) => x.id === next[0])!;
			const b = cards.find((x) => x.id === next[1])!;
			const ok = a.matchId === b.id || b.matchId === a.id ||
			           a.matchId === b.id.replace("_b", "") || b.matchId === a.id.replace("_b", "");
			setTimeout(() => {
				if (ok) {
					const nm = new Set([...matched, a.id, b.id]);
					setMatched(nm); setFlipped([]); setLocked(false);
					if (nm.size === c.pairs.length * 2) onSceneWin();
				} else { setFlipped([]); setLocked(false); }
			}, 900);
		}
	};

	const found = matched.size / 2;

	return (
		<ScrollView style={sh.bg} contentContainerStyle={sh.container} showsVerticalScrollIndicator={false}>
			<View style={gs.memHeader}>
				<Text style={sh.sectionLabel}>Find all matching pairs</Text>
				<View style={gs.memPill}>
					<Text style={gs.memPillText}>{found} / {c.pairs.length} found</Text>
				</View>
			</View>
			<View style={[gs.memGrid, { width: cardSize * c.cols + (c.cols - 1) * Spacing.sm, alignSelf: "center" }]}>
				{cards.map((card) => {
					const flippedState = isFlip(card.id);
					const matchedState = isMatch(card.id);
					return (
						<TouchableOpacity
							key={card.id}
							style={[
								gs.memCard,
								{ width: cardSize, height: cardSize },
								flippedState && gs.memCardFlipped,
								matchedState && gs.memCardMatched,
							]}
							onPress={() => handleFlip(card.id)}
							disabled={flippedState || locked}
							activeOpacity={0.8}
						>
							<Text style={[gs.memCardText, flippedState && gs.memCardTextFlipped]}>
								{flippedState ? card.value : "?"}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>
		</ScrollView>
	);
}

// ─── 13. INFO ─────────────────────────────────────────────────────────────────

function InfoScene({ scene, onContinue, isActive }: SceneRendererProps) {
	const c = scene.content;
	if (c.kind !== "INFO") return null;

	return (
		<View style={[sh.bg, gs.infoOuter]}>
			<View style={gs.infoCard}>
				{c.subtext && (
					<Text style={gs.infoSubtext}>{c.subtext}</Text>
				)}
				<Text style={gs.infoText}>{c.text}</Text>
			</View>
			<ActionBtn label={c.continueLabel ?? "Continue →"} onPress={onContinue} disabled={!isActive} />
		</View>
	);
}

// ─── Shared styles (sh) ───────────────────────────────────────────────────────

const sh = StyleSheet.create({
	bg: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	container: {
		padding: Spacing.md,
		paddingBottom: 48,
	},
	// Prompt card — like promptCard in RiddleGame / TriviaGame
	promptCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.lg,
		marginBottom: Spacing.md,
		...Shadows.light,
	},
	promptText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: 24,
	},
	// Hint — like hintContainer in RiddleGame (orange tint)
	hintStrip: {
		backgroundColor: ACCENT + "22",
		borderRadius: BorderRadius.sm,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		marginBottom: Spacing.md,
		borderWidth: 1,
		borderColor: ACCENT + "55",
	},
	hintText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontStyle: "italic",
	},
	counterPill: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		marginBottom: Spacing.sm,
	},
	// Choices — matches choiceButton in TriviaGame / InferenceGame
	choices: { gap: Spacing.sm },
	choiceBtn: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.borders.subtle,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		minHeight: 56,
		...Shadows.light,
	},
	choiceBtnSelected: {
		borderColor: ACCENT,
		backgroundColor: ACCENT + "18",
		borderWidth: 2.5,
	},
	choiceBtnCorrect: {
		borderColor: Colors.game.correct,
		backgroundColor: Colors.game.correct + "20",
		borderWidth: 3,
	},
	choiceBtnWrong: {
		borderColor: Colors.game.incorrect,
		backgroundColor: Colors.game.incorrect + "18",
		borderWidth: 3,
	},
	choiceBtnDisabled: {
		opacity: 0.5,
	},
	choiceBtnIcon: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},
	choiceBtnText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		flex: 1,
	},
	choiceBtnTextCorrect: { color: Colors.game.correct, fontWeight: Typography.fontWeight.semiBold },
	choiceBtnTextWrong:   { color: Colors.game.incorrect, fontWeight: Typography.fontWeight.semiBold },
	// Text input — matches answerInput / input style
	textInput: {
		borderWidth: 2,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		backgroundColor: Colors.background.primary,
		marginBottom: Spacing.sm,
		textAlign: "center",
		...Shadows.light,
	},
	// Feedback error — like feedbackContainer in QuickMath
	feedbackError: {
		backgroundColor: Colors.game.incorrect + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.game.incorrect + "40",
		padding: Spacing.sm,
		marginTop: Spacing.sm,
		alignItems: "center",
	},
	feedbackErrorText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.game.incorrect,
	},
	// Action button — like checkButton / submitButton
	actionBtn: {
		borderRadius: BorderRadius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		flex: 1,
		...Shadows.medium,
	},
	actionBtnDisabled: { ...Shadows.light },
	actionBtnText: {
		color: Colors.text.primary,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.3,
	},
	actionBtnTextDisabled: { color: Colors.text.inactive },
	// Secondary button — like clearButton
	secondaryBtn: {
		borderRadius: BorderRadius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.secondary,
		borderWidth: 1.5,
		borderColor: Colors.borders.primary,
		...Shadows.light,
	},
	secondaryBtnText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},
	// Number button — matches numberButton in MagicSquare / Sudoku
	numBtn: {
		width: 50,
		height: 50,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.secondary,
		borderWidth: 2,
		borderColor: Colors.borders.subtle,
		alignItems: "center",
		justifyContent: "center",
		opacity: 0.6,
		...Shadows.light,
	},
	numBtnActive: {
		opacity: 1,
		backgroundColor: ACCENT + "22",
		borderColor: ACCENT,
		borderWidth: 2.5,
	},
	numBtnText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	numBtnTextActive: { color: Colors.text.primary },
	sectionLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: Spacing.sm,
	},
	ruleText: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontStyle: "italic",
		marginBottom: Spacing.xs,
	},
});

// ─── Game-specific styles (gs) ────────────────────────────────────────────────

const gs = StyleSheet.create({
	// ── WORD_GUESS ──────────────────────────────────────────────────────────
	hangHint: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		textAlign: "center",
		marginBottom: Spacing.sm,
	},
	livesRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.md,
	},
	lifeIcon: { fontSize: 22 },
	wordRow: {
		flexDirection: "row",
		justifyContent: "center",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	letterSlot: { alignItems: "center", minWidth: 30 },
	letterText: {
		fontSize: 28,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		minHeight: 36,
		textAlign: "center",
	},
	underline: {
		height: 2.5,
		width: 28,
		backgroundColor: Colors.borders.primary,
		marginTop: 3,
		borderRadius: 1,
	},
	underlineFilled: { backgroundColor: Colors.game.correct },
	missedText: {
		textAlign: "center",
		color: Colors.game.incorrect,
		fontSize: Typography.fontSize.caption,
		marginBottom: Spacing.sm,
		letterSpacing: 2,
		fontWeight: Typography.fontWeight.semiBold,
	},
	// QWERTY keyboard — like WordForm keyboard
	keyboard: { gap: Spacing.xs, marginTop: Spacing.md, alignItems: "center" },
	kbRow: { flexDirection: "row", gap: 5, justifyContent: "center" },
	key: {
		minWidth: 30,
		height: 44,
		paddingHorizontal: 4,
		borderRadius: BorderRadius.sm,
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	keyHit:  { backgroundColor: Colors.game.correct + "33", borderColor: Colors.game.correct },
	keyMiss: { backgroundColor: Colors.borders.primary, borderColor: Colors.borders.primary, opacity: 0.5 },
	keyText: {
		fontSize: 13,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	keyTextUsed: { color: Colors.text.secondary },

	// ── WORDLE ──────────────────────────────────────────────────────────────
	wlBoard: { alignItems: "center", gap: 4, marginBottom: Spacing.md },
	wlRow:   { flexDirection: "row" },
	wlTile: {
		borderWidth: 2,
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	wlLetter: { fontWeight: Typography.fontWeight.bold },
	wlKeyboard: { alignItems: "center", gap: Spacing.xs },
	wlKey: {
		minWidth: 28,
		height: 50,
		paddingHorizontal: 3,
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.light,
	},
	wlKeyWide: { minWidth: 44 },
	wlKeyText: {
		fontSize: 13,
		fontWeight: Typography.fontWeight.semiBold,
	},

	// ── SEQUENCE ────────────────────────────────────────────────────────────
	seqItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.md,
		marginBottom: Spacing.sm,
		gap: Spacing.sm,
		...Shadows.light,
	},
	seqItemCorrect: { borderColor: Colors.game.correct, backgroundColor: Colors.game.correct + "15" },
	seqItemWrong:   { borderColor: Colors.game.incorrect, backgroundColor: Colors.game.incorrect + "15" },
	seqBadge: {
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: ACCENT,
		alignItems: "center",
		justifyContent: "center",
	},
	seqBadgeText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	seqLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		flex: 1,
	},
	seqArrows:  { flexDirection: "row", gap: Spacing.xs },
	arrowBtn: {
		width: 34,
		height: 34,
		borderRadius: BorderRadius.sm,
		backgroundColor: Colors.background.secondary,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		alignItems: "center",
		justifyContent: "center",
	},
	arrowText: {
		fontSize: 13,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.secondary,
	},

	// ── CATEGORY ────────────────────────────────────────────────────────────
	catHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.sm,
	},
	mistakePill: {
		borderRadius: BorderRadius.pill,
		borderWidth: 1,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
		backgroundColor: Colors.game.incorrect + "15",
	},
	mistakeText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.game.incorrect,
	},
	solvedGroup: {
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		padding: Spacing.md,
		marginBottom: Spacing.sm,
	},
	solvedGroupTitle: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: 2,
	},
	solvedGroupItems: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	catGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	catItem: {
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.primary,
		borderWidth: 2,
		borderColor: Colors.borders.subtle,
		...Shadows.light,
	},
	catItemSelected: {
		borderColor: Colors.text.primary,
		borderWidth: 2.5,
		backgroundColor: ACCENT + "25",
	},
	catItemText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
	},
	catItemTextSelected: { color: Colors.text.primary },

	// ── SHARED GRID (Number Grid + Path) ────────────────────────────────────
	gridHintRow: {
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	gridHintLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	gridHintVal: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
	},
	// Grid outer — like grid container in MagicSquare / Sudoku
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		borderWidth: 2,
		borderColor: Colors.borders.primary,
		borderRadius: BorderRadius.sm,
		overflow: "hidden",
		marginBottom: Spacing.md,
	},
	gridCell: {
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.tertiary,
		position: "relative",
	},
	gridCellGiven: {
		backgroundColor: Colors.background.secondary,
	},
	gridCellSelected: {
		borderWidth: 2.5,
		borderColor: ACCENT,
		backgroundColor: ACCENT + "22",
	},
	gridCellCorrect: {
		backgroundColor: Colors.game.correct + "30",
		borderColor: Colors.game.correct,
	},
	gridCellError: {
		backgroundColor: Colors.game.incorrect + "20",
		borderColor: Colors.game.incorrect,
	},
	gridCellText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	gridCellTextGiven: {
		fontWeight: Typography.fontWeight.bold,
	},
	numBtns: {
		flexDirection: "row",
		justifyContent: "center",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	gridActions: {
		flexDirection: "row",
		gap: Spacing.sm,
		marginTop: Spacing.xs,
	},

	// ── PATH ────────────────────────────────────────────────────────────────
	pathCellEmpty: {
		backgroundColor: Colors.background.secondary,
		opacity: 0.4,
	},
	pathCellTapped: {
		backgroundColor: ACCENT + "33",
		borderColor: ACCENT,
		borderWidth: 2,
	},
	pathCellStart: {
		backgroundColor: Colors.game.correct + "33",
		borderColor: Colors.game.correct,
		borderWidth: 2,
	},
	pathCellEnd: {
		backgroundColor: ACCENT + "33",
		borderColor: ACCENT,
		borderWidth: 2,
	},
	pathStepBadge: {
		position: "absolute",
		top: 2,
		right: 2,
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: ACCENT,
		alignItems: "center",
		justifyContent: "center",
	},
	pathStepText: {
		fontSize: 8,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},

	// ── CODEBREAKER ─────────────────────────────────────────────────────────
	cbHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.md,
	},
	cbCountPill: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.pill,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
	},
	cbCountText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},
	cbHistoryRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.sm,
		marginBottom: Spacing.sm,
		gap: Spacing.sm,
		...Shadows.light,
	},
	cbPegsRow:   { flexDirection: "row", gap: 4, flex: 1 },
	cbPegEmoji:  { fontSize: 26 },
	cbFeedback:  { flexDirection: "row", gap: Spacing.xs },
	cbFbChip: {
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
		paddingHorizontal: Spacing.xs,
		paddingVertical: 2,
	},
	cbFbText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
	},
	cbCurrentRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: ACCENT + "15",
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: ACCENT,
		padding: Spacing.sm,
		marginBottom: Spacing.md,
		gap: Spacing.xs,
	},
	cbCurrentSlot: {
		width: 46,
		height: 46,
		borderRadius: BorderRadius.sm,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.primary,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
	},
	cbCurrentSlotEmpty: { backgroundColor: Colors.background.secondary },
	cbPalette: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	cbColorBtn: {
		width: 56,
		height: 56,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.primary,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		...Shadows.light,
	},

	// ── MEMORY ──────────────────────────────────────────────────────────────
	memHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.md,
	},
	memPill: {
		backgroundColor: ACCENT + "22",
		borderRadius: BorderRadius.pill,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
		borderWidth: 1,
		borderColor: ACCENT,
	},
	memPillText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	memGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	memCard: {
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.text.primary,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},
	memCardFlipped: {
		backgroundColor: Colors.background.primary,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
	},
	memCardMatched: {
		backgroundColor: Colors.game.correct + "22",
		borderWidth: 1.5,
		borderColor: Colors.game.correct,
	},
	memCardText: {
		fontSize: 28,
		color: Colors.background.primary,
		fontWeight: Typography.fontWeight.bold,
	},
	memCardTextFlipped: { color: Colors.text.primary },

	// ── INFO ────────────────────────────────────────────────────────────────
	infoOuter: {
		flex: 1,
		justifyContent: "center",
		padding: Spacing.lg,
	},
	infoCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.xl,
		marginBottom: Spacing.xl,
		alignItems: "center",
		...Shadows.medium,
	},
	infoSubtext: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.sm,
	},
	infoText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		lineHeight: 30,
	},
});
