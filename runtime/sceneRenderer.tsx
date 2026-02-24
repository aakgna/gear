/**
 * SceneRenderer — maps a GameScene's content.kind to the correct UI component.
 * Visually matches the existing 12 game components in components/games/.
 */

import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	GestureResponderEvent,
	PanResponder,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import type {
	GameScene,
	CrosswordScene as CrosswordSceneType,
	WordSearchScene as WordSearchSceneType,
	MazeScene as MazeSceneType,
	SpellingBeeScene as SpellingBeeSceneType,
	LetterGridScene as LetterGridSceneType,
	NonogramScene as NonogramSceneType,
	FlowScene as FlowSceneType,
	SlidingPuzzleScene as SlidingPuzzleSceneType,
	LogicGridScene as LogicGridSceneType,
	MinesweeperScene as MinesweeperSceneType,
	MergeGridScene as MergeGridSceneType,
	BoardTheme,
} from "../config/customPuzzleGame";
import {
	codebreakerFeedback,
	containsLetter,
	crosswordComplete,
	exactMatch,
	flowComplete,
	groupMatch,
	letterGridPathAdjacent,
	letterGridPathWord,
	mazeMoveAllowed,
	mazeNextPosition,
	mergeGridSwipe,
	minesweeperBuildBoard,
	minesweeperWon,
	nonogramComplete,
	sequenceCheck,
	slidingPuzzleMove,
	slidingPuzzleSolved,
	spellingBeeWordValid,
	wordleFeedback,
	wordSearchPathValid,
} from "./mechanicExecutor";
import type { Direction } from "./mechanicExecutor";
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
		case "CROSSWORD":        return <CrosswordSceneRenderer {...props} />;
		case "WORD_SEARCH":      return <WordSearchSceneRenderer {...props} />;
		case "MAZE":             return <MazeSceneRenderer {...props} />;
		case "SPELLING_BEE":     return <SpellingBeeSceneRenderer {...props} />;
		case "LETTER_GRID":      return <LetterGridSceneRenderer {...props} />;
		case "NONOGRAM":         return <NonogramSceneRenderer {...props} />;
		case "FLOW":             return <FlowSceneRenderer {...props} />;
		case "SLIDING_PUZZLE":   return <SlidingPuzzleSceneRenderer {...props} />;
		case "LOGIC_GRID":       return <LogicGridSceneRenderer {...props} />;
		case "MINESWEEPER":      return <MinesweeperSceneRenderer {...props} />;
		case "MERGE_GRID":       return <MergeGridSceneRenderer {...props} />;
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

// ─── Board theme palettes ─────────────────────────────────────────────────────
const BOARD_THEMES: Record<BoardTheme, {
	bg: string; wall: string; path: string; accent: string; text: string;
}> = {
	cornfield:  { bg: "#87CEEB", wall: "#4a7c59", path: "#c8a96e", accent: "#fcd34d", text: "#2d1b00" },
	dungeon:    { bg: "#1a1a2e", wall: "#4a4a6a", path: "#2d2d4a", accent: "#fcd34d", text: "#e0e0e0" },
	space:      { bg: "#0a0a1a", wall: "#2a2a4a", path: "#1a1a3a", accent: "#7c3aed", text: "#c0c0ff" },
	underwater: { bg: "#006994", wall: "#004d6e", path: "#0099cc", accent: "#00d4ff", text: "#ffffff" },
	forest:     { bg: "#87CEEB", wall: "#2d5a27", path: "#4a7c3f", accent: "#fcd34d", text: "#1a0a00" },
	neon:       { bg: "#0a0a0a", wall: "#ff00ff", path: "#1a1a1a", accent: "#00ff00", text: "#ffffff" },
	minimal:    { bg: "#ffffff", wall: "#000000", path: "#f5f5f5", accent: "#000000", text: "#000000" },
};

function getTheme(theme?: BoardTheme) {
	return BOARD_THEMES[theme ?? "minimal"];
}

// ─── CROSSWORD RENDERER ───────────────────────────────────────────────────────

function CrosswordSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onWrong } = props;
	const content = scene.content as CrosswordSceneType;
	const [playerGrid, setPlayerGrid] = React.useState<Record<string, string>>({});
	const [selectedCell, setSelectedCell] = React.useState<{ row: number; col: number } | null>(null);
	const [direction, setDirection] = React.useState<"across" | "down">("across");
	const [checked, setChecked] = React.useState(false);

	const CELL = Math.min(32, Math.floor((SCREEN_WIDTH - 40) / content.cols));

	const solution = content.cells.filter((c) => !c.black && c.answer);

	const handleCellPress = (row: number, col: number) => {
		if (selectedCell?.row === row && selectedCell?.col === col) {
			setDirection((d) => (d === "across" ? "down" : "across"));
		} else {
			setSelectedCell({ row, col });
		}
	};

	const handleInput = (letter: string) => {
		if (!selectedCell) return;
		const key = `${selectedCell.row}_${selectedCell.col}`;
		const val = letter.toUpperCase().slice(0, 1);
		setPlayerGrid((g) => ({ ...g, [key]: val }));
	};

	const handleCheck = () => {
		setChecked(true);
		if (crosswordComplete(playerGrid, solution as any)) {
			onSceneWin();
		} else {
			onWrong();
		}
	};

	return (
		<ScrollView contentContainerStyle={nsh.crosswordOuter} keyboardShouldPersistTaps="handled">
			{content.clues && (
				<View style={nsh.crosswordClueBar}>
					<Text style={nsh.crosswordClueText} numberOfLines={2}>
						{direction === "across"
							? content.clues.across.find((c) =>
									selectedCell &&
									c.row === selectedCell.row &&
									c.col <= selectedCell.col
								)?.clue ?? "Select a cell"
							: content.clues.down.find((c) =>
									selectedCell &&
									c.col === selectedCell.col &&
									c.row <= selectedCell.row
								)?.clue ?? "Select a cell"}
					</Text>
					<Text style={nsh.crosswordDirLabel}>{direction.toUpperCase()}</Text>
				</View>
			)}
			<View style={{ marginBottom: Spacing.md }}>
				{Array.from({ length: content.rows }, (_, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{Array.from({ length: content.cols }, (_, c) => {
							const cellDef = content.cells.find((cell) => cell.row === r && cell.col === c);
							const isBlack = cellDef?.black ?? true;
							const key = `${r}_${c}`;
							const letter = playerGrid[key] ?? "";
							const isSelected = selectedCell?.row === r && selectedCell?.col === c;
							const expectedLetter = cellDef?.answer ?? "";
							const isWrong = checked && letter && letter !== expectedLetter.toUpperCase();
							return (
								<TouchableOpacity
									key={c}
									onPress={() => !isBlack && handleCellPress(r, c)}
									style={[
										nsh.crosswordCell,
										{ width: CELL, height: CELL },
										isBlack ? nsh.crosswordBlack : nsh.crosswordWhite,
										isSelected && nsh.crosswordSelected,
										isWrong && nsh.crosswordWrong,
									]}
									activeOpacity={isBlack ? 1 : 0.7}
								>
									{!isBlack && cellDef?.number && (
										<Text style={[nsh.crosswordNumber, { fontSize: CELL * 0.25 }]}>
											{cellDef.number}
										</Text>
									)}
									{!isBlack && (
										<Text style={[nsh.crosswordLetter, { fontSize: CELL * 0.5 }]}>
											{letter}
										</Text>
									)}
								</TouchableOpacity>
							);
						})}
					</View>
				))}
			</View>
			<TextInput
				style={nsh.crosswordInput}
				value=""
				onChangeText={handleInput}
				autoCapitalize="characters"
				maxLength={1}
				placeholder="Type a letter"
				placeholderTextColor={Colors.text.inactive}
			/>
			{content.hint && <HintStrip text={content.hint} />}
			<TouchableOpacity style={nsh.checkBtn} onPress={handleCheck}>
				<Text style={nsh.checkBtnText}>Check Answers</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

// ─── WORD SEARCH RENDERER ─────────────────────────────────────────────────────

function WordSearchSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin } = props;
	const content = scene.content as WordSearchSceneType;
	const [foundWords, setFoundWords] = React.useState<Set<string>>(new Set());
	const [selectedCells, setSelectedCells] = React.useState<Array<{ row: number; col: number }>>([]);
	const [selecting, setSelecting] = React.useState(false);

	const CELL = Math.min(34, Math.floor((SCREEN_WIDTH - 40) / content.cols));

	const handleCellStart = (row: number, col: number) => {
		setSelecting(true);
		setSelectedCells([{ row, col }]);
	};

	const handleCellEnter = (row: number, col: number) => {
		if (!selecting) return;
		setSelectedCells((prev) => {
			const alreadyIn = prev.find((c) => c.row === row && c.col === col);
			if (alreadyIn) return prev;
			return [...prev, { row, col }];
		});
	};

	const handleCellEnd = () => {
		setSelecting(false);
		const result = wordSearchPathValid(selectedCells, content.solutions);
		if (result.found && result.word && !foundWords.has(result.word)) {
			const next = new Set(foundWords);
			next.add(result.word);
			setFoundWords(next);
			if (next.size === content.words.length) onSceneWin();
		}
		setSelectedCells([]);
	};

	const isSelected = (r: number, c: number) =>
		selectedCells.some((cell) => cell.row === r && cell.col === c);

	const isFound = (r: number, c: number) =>
		content.solutions
			.filter((s) => foundWords.has(s.word))
			.some((s) => s.cells.some((cell) => cell.row === r && cell.col === c));

	return (
		<ScrollView contentContainerStyle={nsh.wsOuter} keyboardShouldPersistTaps="handled">
			<View style={nsh.wsGrid}>
				{content.grid.map((row, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{row.map((letter, c) => (
							<TouchableOpacity
								key={c}
								onPressIn={() => handleCellStart(r, c)}
								onPress={() => handleCellEnter(r, c)}
								onPressOut={handleCellEnd}
								style={[
									nsh.wsCell,
									{ width: CELL, height: CELL },
									isSelected(r, c) && nsh.wsCellSelected,
									isFound(r, c) && nsh.wsCellFound,
								]}
								activeOpacity={0.8}
							>
								<Text style={[nsh.wsLetter, { fontSize: CELL * 0.5 }]}>{letter}</Text>
							</TouchableOpacity>
						))}
					</View>
				))}
			</View>
			<View style={nsh.wsWordList}>
				{content.words.map((word) => (
					<Text
						key={word}
						style={[nsh.wsWord, foundWords.has(word) && nsh.wsWordFound]}
					>
						{word}
					</Text>
				))}
			</View>
		</ScrollView>
	);
}

// ─── MAZE RENDERER ────────────────────────────────────────────────────────────

function MazeSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin } = props;
	const content = scene.content as MazeSceneType;
	const theme = getTheme(content.theme);
	const [pos, setPos] = React.useState(content.start);

	const CELL = Math.min(40, Math.floor((SCREEN_WIDTH - 40) / content.cols));
	const WALL = 2;

	const move = (dir: Direction) => {
		if (!mazeMoveAllowed(pos, dir, content.cells)) return;
		const next = mazeNextPosition(pos, dir);
		setPos(next);
		if (next.row === content.end.row && next.col === content.end.col) onSceneWin();
	};

	return (
		<View style={[nsh.mazeOuter, { backgroundColor: theme.bg }]}>
			<View style={nsh.mazeGrid}>
				{Array.from({ length: content.rows }, (_, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{Array.from({ length: content.cols }, (_, c) => {
							const cellDef = content.cells.find((cell) => cell.row === r && cell.col === c);
							const walls = cellDef?.walls ?? { top: true, right: true, bottom: true, left: true };
							const isPlayer = pos.row === r && pos.col === c;
							const isEnd = content.end.row === r && content.end.col === c;
							const isStart = content.start.row === r && content.start.col === c;
							return (
								<View
									key={c}
									style={[
										{
											width: CELL,
											height: CELL,
											backgroundColor: isEnd ? theme.accent + "40" : theme.path,
											borderTopWidth: walls.top ? WALL : 0,
											borderRightWidth: walls.right ? WALL : 0,
											borderBottomWidth: walls.bottom ? WALL : 0,
											borderLeftWidth: walls.left ? WALL : 0,
											borderColor: theme.wall,
											alignItems: "center",
											justifyContent: "center",
										},
									]}
								>
									{isPlayer && (
										<View style={[nsh.mazePlayer, { backgroundColor: theme.accent }]} />
									)}
									{isEnd && !isPlayer && (
										<Text style={{ fontSize: CELL * 0.45 }}>🏁</Text>
									)}
									{isStart && !isPlayer && (
										<View style={[nsh.mazeStart, { backgroundColor: theme.accent + "60" }]} />
									)}
								</View>
							);
						})}
					</View>
				))}
			</View>
			{content.hint && <HintStrip text={content.hint} />}
			<View style={nsh.mazeDpad}>
				<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => move("top")}>
					<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▲</Text>
				</TouchableOpacity>
				<View style={{ flexDirection: "row" }}>
					<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => move("left")}>
						<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>◀</Text>
					</TouchableOpacity>
					<View style={{ width: 48, height: 48 }} />
					<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => move("right")}>
						<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▶</Text>
					</TouchableOpacity>
				</View>
				<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => move("bottom")}>
					<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▼</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ─── SPELLING BEE RENDERER ────────────────────────────────────────────────────

function SpellingBeeSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onWrong } = props;
	const content = scene.content as SpellingBeeSceneType;
	const [input, setInput] = React.useState("");
	const [foundWords, setFoundWords] = React.useState<string[]>([]);
	const [message, setMessage] = React.useState("");

	const allLetters = [content.centerLetter, ...content.outerLetters];

	const hexPositions = [
		{ top: 0,   left: 56  },
		{ top: 46,  left: 112 },
		{ top: 92,  left: 56  },
		{ top: 92,  left: 0   },
		{ top: 46,  left: -56 },
		{ top: 0,   left: 0   },
	];

	const handleLetter = (letter: string) => setInput((i) => i + letter);
	const handleDelete  = () => setInput((i) => i.slice(0, -1));

	const handleSubmit = () => {
		const result = spellingBeeWordValid(
			input, content.centerLetter, content.outerLetters, content.validWords
		);
		if (!result.valid) {
			setMessage(result.reason ?? "Invalid");
			setTimeout(() => setMessage(""), 1500);
			onWrong();
		} else if (foundWords.includes(input.toUpperCase())) {
			setMessage("Already found!");
			setTimeout(() => setMessage(""), 1500);
		} else {
			const next = [...foundWords, input.toUpperCase()];
			setFoundWords(next);
			setMessage("Nice!");
			setTimeout(() => setMessage(""), 1200);
			setInput("");
			if (next.length >= content.wordsToWin) onSceneWin();
		}
	};

	return (
		<ScrollView contentContainerStyle={nsh.beeOuter}>
			<Text style={nsh.beeInput}>{input || "..."}</Text>
			{message ? <Text style={nsh.beeMessage}>{message}</Text> : null}
			<View style={[nsh.beeHexContainer, { height: 200 }]}>
				<View style={[nsh.beeHex, nsh.beeHexCenter]}>
					<TouchableOpacity onPress={() => handleLetter(content.centerLetter)}>
						<Text style={nsh.beeHexLetter}>{content.centerLetter.toUpperCase()}</Text>
					</TouchableOpacity>
				</View>
				{content.outerLetters.slice(0, 6).map((letter, i) => (
					<View
						key={i}
						style={[
							nsh.beeHex,
							{
								position: "absolute",
								top: hexPositions[i].top,
								left: 60 + hexPositions[i].left,
							},
						]}
					>
						<TouchableOpacity onPress={() => handleLetter(letter)}>
							<Text style={nsh.beeHexLetter}>{letter.toUpperCase()}</Text>
						</TouchableOpacity>
					</View>
				))}
			</View>
			<View style={nsh.beeActions}>
				<TouchableOpacity style={nsh.beeActionBtn} onPress={handleDelete}>
					<Text style={nsh.beeActionText}>Delete</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[nsh.beeActionBtn, nsh.beeSubmitBtn]} onPress={handleSubmit}>
					<Text style={[nsh.beeActionText, { color: Colors.background.primary }]}>Enter</Text>
				</TouchableOpacity>
			</View>
			<Text style={nsh.beeFoundCount}>
				{foundWords.length} / {content.wordsToWin} words found
			</Text>
		</ScrollView>
	);
}

// ─── LETTER GRID RENDERER (Boggle-style) ──────────────────────────────────────

function LetterGridSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin } = props;
	const content = scene.content as LetterGridSceneType;
	const [foundWords, setFoundWords] = React.useState<string[]>([]);
	const [path, setPath] = React.useState<Array<{ row: number; col: number }>>([]);
	const [isDrawing, setIsDrawing] = React.useState(false);

	const CELL = Math.min(60, Math.floor((SCREEN_WIDTH - 40) / content.cols));

	const startPath = (r: number, c: number) => {
		setIsDrawing(true);
		setPath([{ row: r, col: c }]);
	};

	const extendPath = (r: number, c: number) => {
		if (!isDrawing) return;
		setPath((prev) => {
			if (prev.find((p) => p.row === r && p.col === c)) return prev;
			const next = [...prev, { row: r, col: c }];
			if (!letterGridPathAdjacent(next)) return prev;
			return next;
		});
	};

	const endPath = () => {
		setIsDrawing(false);
		if (path.length >= 3) {
			const word = letterGridPathWord(path, content.grid);
			const valid = content.solutions.find((s) => s.word === word);
			if (valid && !foundWords.includes(word)) {
				const next = [...foundWords, word];
				setFoundWords(next);
				if (next.length >= content.words.length) onSceneWin();
			}
		}
		setPath([]);
	};

	const inPath = (r: number, c: number) =>
		path.some((p) => p.row === r && p.col === c);

	const isFoundCell = (r: number, c: number) =>
		content.solutions
			.filter((s) => foundWords.includes(s.word))
			.some((s) => s.cells.some((c2) => c2.row === r && c2.col === c));

	return (
		<View style={nsh.lgOuter}>
			<View style={nsh.lgGrid}>
				{content.grid.map((row, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{row.map((letter, c) => (
							<TouchableOpacity
								key={c}
								onPressIn={() => startPath(r, c)}
								onPress={() => extendPath(r, c)}
								onPressOut={endPath}
								style={[
									nsh.lgCell,
									{ width: CELL, height: CELL, borderRadius: CELL / 2 },
									inPath(r, c) && nsh.lgCellActive,
									isFoundCell(r, c) && nsh.lgCellFound,
								]}
								activeOpacity={0.8}
							>
								<Text style={[nsh.lgLetter, { fontSize: CELL * 0.42 }]}>{letter}</Text>
							</TouchableOpacity>
						))}
					</View>
				))}
			</View>
			<View style={nsh.wsWordList}>
				{content.words.map((word) => (
					<Text
						key={word}
						style={[nsh.wsWord, foundWords.includes(word) && nsh.wsWordFound]}
					>
						{word}
					</Text>
				))}
			</View>
		</View>
	);
}

// ─── NONOGRAM RENDERER ────────────────────────────────────────────────────────

function NonogramSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onWrong } = props;
	const content = scene.content as NonogramSceneType;
	const theme = getTheme(content.theme);
	const [grid, setGrid] = React.useState<boolean[]>(
		Array(content.rows * content.cols).fill(false)
	);

	const CELL = Math.min(28, Math.floor((SCREEN_WIDTH - 60) / content.cols));
	const CLUE_W = Math.max(24, content.rowClues.reduce((m, c) => Math.max(m, c.length), 0) * 14);

	const toggle = (r: number, c: number) => {
		const idx = r * content.cols + c;
		const next = [...grid];
		next[idx] = !next[idx];
		setGrid(next);
		if (nonogramComplete(next, content.rows, content.cols, content.rowClues, content.colClues)) {
			onSceneWin();
		}
	};

	return (
		<ScrollView contentContainerStyle={[nsh.nonoOuter, { backgroundColor: theme.bg }]}>
			<View style={{ flexDirection: "row" }}>
				<View style={{ width: CLUE_W }} />
				{content.colClues.map((clue, c) => (
					<View key={c} style={[nsh.nonoColClue, { width: CELL }]}>
						{clue.map((n, i) => (
							<Text key={i} style={[nsh.nonoClueText, { color: theme.text }]}>{n}</Text>
						))}
					</View>
				))}
			</View>
			{Array.from({ length: content.rows }, (_, r) => (
				<View key={r} style={{ flexDirection: "row", alignItems: "center" }}>
					<View style={[nsh.nonoRowClue, { width: CLUE_W }]}>
						<Text style={[nsh.nonoClueText, { color: theme.text }]}>
							{content.rowClues[r].join(" ")}
						</Text>
					</View>
					{Array.from({ length: content.cols }, (_, c) => {
						const filled = grid[r * content.cols + c];
						return (
							<TouchableOpacity
								key={c}
								onPress={() => toggle(r, c)}
								style={[
									nsh.nonoCell,
									{ width: CELL, height: CELL },
									filled
										? { backgroundColor: theme.wall }
										: { backgroundColor: theme.path, borderColor: theme.wall + "80" },
								]}
							/>
						);
					})}
				</View>
			))}
			{content.hint && <HintStrip text={content.hint} />}
		</ScrollView>
	);
}

// ─── FLOW RENDERER ───────────────────────────────────────────────────────────

function FlowSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin } = props;
	const content = scene.content as FlowSceneType;
	const theme = getTheme(content.theme);
	const [paths, setPaths] = React.useState<Record<string, Array<{ row: number; col: number }>>>({});
	const [drawing, setDrawing] = React.useState<string | null>(null);

	const CELL = Math.min(50, Math.floor((SCREEN_WIDTH - 40) / content.cols));

	const getDotAt = (r: number, c: number) =>
		content.dots.find((d) => d.row === r && d.col === c);

	const getPathColor = (r: number, c: number): string | null => {
		for (const [id, path] of Object.entries(paths)) {
			if (path.some((p) => p.row === r && p.col === c)) {
				return content.dots.find((d) => d.id === id)?.color ?? null;
			}
		}
		return null;
	};

	const handleCellPress = (r: number, c: number) => {
		const dot = getDotAt(r, c);
		if (dot) {
			setDrawing(dot.id);
			setPaths((prev) => ({ ...prev, [dot.id]: [{ row: r, col: c }] }));
		} else if (drawing) {
			setPaths((prev) => {
				const current = prev[drawing] ?? [];
				const next = [...current, { row: r, col: c }];
				const updated = { ...prev, [drawing]: next };
				if (flowComplete(
					Object.entries(updated).map(([id, path]) => ({ id, path })),
					content.dots, content.rows, content.cols
				)) {
					setTimeout(() => onSceneWin(), 200);
				}
				return updated;
			});
		}
	};

	return (
		<View style={[nsh.flowOuter, { backgroundColor: theme.bg }]}>
			{content.hint && <HintStrip text={content.hint} />}
			<View style={nsh.flowGrid}>
				{Array.from({ length: content.rows }, (_, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{Array.from({ length: content.cols }, (_, c) => {
							const dot = getDotAt(r, c);
							const pathColor = getPathColor(r, c);
							return (
								<TouchableOpacity
									key={c}
									onPress={() => handleCellPress(r, c)}
									style={[
										nsh.flowCell,
										{
											width: CELL,
											height: CELL,
											backgroundColor: pathColor ?? theme.path,
											borderColor: theme.wall + "40",
										},
									]}
									activeOpacity={0.8}
								>
									{dot && (
										<View
											style={[
												nsh.flowDot,
												{
													width: CELL * 0.7,
													height: CELL * 0.7,
													borderRadius: CELL * 0.35,
													backgroundColor: dot.color,
												},
											]}
										/>
									)}
								</TouchableOpacity>
							);
						})}
					</View>
				))}
			</View>
			<TouchableOpacity style={nsh.checkBtn} onPress={() => setDrawing(null)}>
				<Text style={nsh.checkBtnText}>Done Drawing</Text>
			</TouchableOpacity>
		</View>
	);
}

// ─── SLIDING PUZZLE RENDERER ──────────────────────────────────────────────────

function SlidingPuzzleSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin } = props;
	const content = scene.content as SlidingPuzzleSceneType;
	const theme = getTheme(content.theme);
	const [grid, setGrid] = React.useState(content.initial);

	const CELL = Math.min(80, Math.floor((SCREEN_WIDTH - 40) / content.size));

	const handleTile = (idx: number) => {
		const emptyIdx = grid.indexOf(0);
		const row = Math.floor(idx / content.size);
		const col = idx % content.size;
		const eRow = Math.floor(emptyIdx / content.size);
		const eCol = emptyIdx % content.size;

		let dir: Direction | null = null;
		if (row === eRow && col === eCol - 1) dir = "right";
		else if (row === eRow && col === eCol + 1) dir = "left";
		else if (row === eRow - 1 && col === eCol) dir = "bottom";
		else if (row === eRow + 1 && col === eCol) dir = "top";

		if (!dir) return;
		const next = slidingPuzzleMove(grid, content.size, dir);
		if (!next) return;
		setGrid(next);
		if (slidingPuzzleSolved(next)) onSceneWin();
	};

	return (
		<View style={[nsh.slideOuter, { backgroundColor: theme.bg }]}>
			{content.hint && <HintStrip text={content.hint} />}
			<View style={nsh.slideGrid}>
				{grid.map((val, idx) => (
					<TouchableOpacity
						key={idx}
						onPress={() => val !== 0 && handleTile(idx)}
						style={[
							nsh.slideTile,
							{
								width: CELL,
								height: CELL,
								margin: 2,
								backgroundColor: val === 0 ? "transparent" : theme.path,
								borderColor: theme.wall,
								borderWidth: val === 0 ? 0 : 1.5,
							},
						]}
						activeOpacity={val === 0 ? 1 : 0.7}
					>
						{val !== 0 && (
							<Text style={[nsh.slideTileText, { color: theme.text, fontSize: CELL * 0.4 }]}>
								{val}
							</Text>
						)}
					</TouchableOpacity>
				))}
			</View>
		</View>
	);
}

// ─── LOGIC GRID RENDERER ─────────────────────────────────────────────────────

function LogicGridSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onWrong } = props;
	const content = scene.content as LogicGridSceneType;
	const primary = content.categories[0];
	const others = content.categories.slice(1);

	type CellState = "empty" | "yes" | "no";
	const [cells, setCells] = React.useState<Record<string, CellState>>({});

	const toggle = (key: string) => {
		setCells((prev) => {
			const cur = prev[key] ?? "empty";
			const next: CellState = cur === "empty" ? "yes" : cur === "yes" ? "no" : "empty";
			return { ...prev, [key]: next };
		});
	};

	const handleCheck = () => {
		let correct = true;
		for (let i = 0; i < primary.items.length; i++) {
			const entity = primary.items[i];
			for (const cat of others) {
				const solRow = content.solution[i];
				const expected = solRow?.[cat.id];
				for (const item of cat.items) {
					const key = `${entity}_${cat.id}_${item}`;
					const state = cells[key] ?? "empty";
					const shouldBeYes = item === expected;
					if (shouldBeYes && state !== "yes") correct = false;
					if (!shouldBeYes && state === "yes") correct = false;
				}
			}
		}
		if (correct) onSceneWin();
		else onWrong();
	};

	return (
		<ScrollView contentContainerStyle={nsh.lgridOuter}>
			{content.clues.map((clue, i) => (
				<View key={i} style={nsh.lgridClue}>
					<Text style={nsh.lgridClueText}>• {clue}</Text>
				</View>
			))}
			{others.map((cat) => (
				<View key={cat.id} style={{ marginBottom: Spacing.md }}>
					<Text style={nsh.lgridCatLabel}>{cat.label}</Text>
					<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
						{primary.items.map((entity) => (
							<View key={entity} style={nsh.lgridRow}>
								<Text style={nsh.lgridEntityLabel}>{entity}</Text>
								{cat.items.map((item) => {
									const key = `${entity}_${cat.id}_${item}`;
									const state = cells[key] ?? "empty";
									return (
										<TouchableOpacity
											key={item}
											style={[
												nsh.lgridCell,
												state === "yes" && nsh.lgridCellYes,
												state === "no" && nsh.lgridCellNo,
											]}
											onPress={() => toggle(key)}
										>
											<Text style={nsh.lgridCellText}>
												{state === "yes" ? "✓" : state === "no" ? "✗" : ""}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						))}
					</View>
					<View style={{ flexDirection: "row", paddingLeft: 80 }}>
						{cat.items.map((item) => (
							<Text key={item} style={nsh.lgridItemLabel} numberOfLines={1}>{item}</Text>
						))}
					</View>
				</View>
			))}
			<TouchableOpacity style={nsh.checkBtn} onPress={handleCheck}>
				<Text style={nsh.checkBtnText}>Check Solution</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

// ─── MINESWEEPER RENDERER ─────────────────────────────────────────────────────

function MinesweeperSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onSceneLose } = props;
	const content = scene.content as MinesweeperSceneType;
	const board = React.useMemo(
		() => minesweeperBuildBoard(content.rows, content.cols, content.mines),
		[content]
	);
	const [revealed, setRevealed] = React.useState<boolean[]>(
		Array(content.rows * content.cols).fill(false)
	);
	const [flagged, setFlagged] = React.useState<boolean[]>(
		Array(content.rows * content.cols).fill(false)
	);
	const [dead, setDead] = React.useState(false);

	const CELL = Math.min(38, Math.floor((SCREEN_WIDTH - 40) / content.cols));

	const reveal = (r: number, c: number) => {
		const idx = r * content.cols + c;
		if (revealed[idx] || flagged[idx] || dead) return;
		if (board[idx] === -1) {
			setDead(true);
			onSceneLose();
			return;
		}
		const next = [...revealed];
		const flood = (ri: number, ci: number) => {
			const i = ri * content.cols + ci;
			if (ri < 0 || ri >= content.rows || ci < 0 || ci >= content.cols) return;
			if (next[i]) return;
			next[i] = true;
			if (board[i] === 0) {
				for (let dr = -1; dr <= 1; dr++)
					for (let dc = -1; dc <= 1; dc++)
						if (dr !== 0 || dc !== 0) flood(ri + dr, ci + dc);
			}
		};
		flood(r, c);
		setRevealed(next);
		if (minesweeperWon(next, board)) onSceneWin();
	};

	const flag = (r: number, c: number) => {
		const idx = r * content.cols + c;
		if (revealed[idx] || dead) return;
		const next = [...flagged];
		next[idx] = !next[idx];
		setFlagged(next);
	};

	const NUM_COLORS = ["", "#3B82F6","#10B981","#EF4444","#7C3AED","#F59E0B","#06B6D4","#000","#6B7280"];

	return (
		<ScrollView contentContainerStyle={nsh.mineOuter}>
			{content.hint && <HintStrip text={content.hint} />}
			{dead && <Text style={nsh.mineDead}>💥 Game Over — tap a safe cell to try again</Text>}
			<View style={nsh.mineGrid}>
				{Array.from({ length: content.rows }, (_, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{Array.from({ length: content.cols }, (_, c) => {
							const idx = r * content.cols + c;
							const isRev = revealed[idx];
							const isFlag = flagged[idx];
							const val = board[idx];
							return (
								<TouchableOpacity
									key={c}
									onPress={() => reveal(r, c)}
									onLongPress={() => flag(r, c)}
									style={[
										nsh.mineCell,
										{ width: CELL, height: CELL },
										isRev ? nsh.mineCellRevealed : nsh.mineCellHidden,
									]}
									activeOpacity={0.7}
								>
									{isFlag && !isRev && <Text style={{ fontSize: CELL * 0.5 }}>🚩</Text>}
									{isRev && val === -1 && <Text style={{ fontSize: CELL * 0.5 }}>💣</Text>}
									{isRev && val > 0 && (
										<Text style={[nsh.mineNum, { color: NUM_COLORS[val], fontSize: CELL * 0.5 }]}>
											{val}
										</Text>
									)}
								</TouchableOpacity>
							);
						})}
					</View>
				))}
			</View>
		</ScrollView>
	);
}

// ─── MERGE GRID RENDERER (2048-style) ────────────────────────────────────────

function MergeGridSceneRenderer(props: SceneRendererProps) {
	const { scene, onSceneWin, onSceneLose } = props;
	const content = scene.content as MergeGridSceneType;
	const theme = getTheme(content.theme);

	const initGrid = (): number[][] => {
		const flat = [...content.initial];
		return Array.from({ length: content.size }, (_, r) =>
			flat.slice(r * content.size, r * content.size + content.size)
		);
	};

	const [grid, setGrid] = React.useState<number[][]>(initGrid);
	const [score, setScore] = React.useState(0);

	const addRandom = (g: number[][]): number[][] => {
		const empty: Array<[number, number]> = [];
		g.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empty.push([r, c]); }));
		if (empty.length === 0) return g;
		const [r, c] = empty[Math.floor(Math.random() * empty.length)];
		const next = g.map((row) => [...row]);
		next[r][c] = Math.random() < 0.9 ? 2 : 4;
		return next;
	};

	const handleSwipe = (dir: "left" | "right" | "up" | "down") => {
		const result = mergeGridSwipe(grid, dir);
		if (!result) return;
		const next = addRandom(result.grid);
		setGrid(next);
		setScore((s) => s + result.score);
		const maxTile = Math.max(...next.flat());
		if (maxTile >= content.target) onSceneWin();
	};

	const CELL = Math.min(72, Math.floor((SCREEN_WIDTH - 40) / content.size));

	const tileColor = (val: number): string => {
		const colors: Record<number, string> = {
			0: theme.path, 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179",
			16: "#f59563", 32: "#f67c5f", 64: "#f65e3b",
			128: "#edcf72", 256: "#edcc61", 512: "#edc850",
			1024: "#edc53f", 2048: "#edc22e",
		};
		return colors[val] ?? theme.accent;
	};

	return (
		<View style={[nsh.mergeOuter, { backgroundColor: theme.bg }]}>
			<Text style={[nsh.mergeScore, { color: theme.text }]}>
				Score: {score}  |  Target: {content.target}
			</Text>
			{content.hint && <HintStrip text={content.hint} />}
			<View style={[nsh.mergeGrid, { backgroundColor: theme.wall }]}>
				{grid.map((row, r) => (
					<View key={r} style={{ flexDirection: "row" }}>
						{row.map((val, c) => (
							<View
								key={c}
								style={[
									nsh.mergeTile,
									{ width: CELL, height: CELL, backgroundColor: tileColor(val) },
								]}
							>
								{val !== 0 && (
									<Text style={[nsh.mergeTileText, { fontSize: val >= 1000 ? CELL * 0.28 : CELL * 0.38 }]}>
										{val}
									</Text>
								)}
							</View>
						))}
					</View>
				))}
			</View>
			<View style={nsh.mergeDpad}>
				<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => handleSwipe("up")}>
					<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▲</Text>
				</TouchableOpacity>
				<View style={{ flexDirection: "row" }}>
					<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => handleSwipe("left")}>
						<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>◀</Text>
					</TouchableOpacity>
					<View style={{ width: 48, height: 48 }} />
					<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => handleSwipe("right")}>
						<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▶</Text>
					</TouchableOpacity>
				</View>
				<TouchableOpacity style={nsh.mazeDpadBtn} onPress={() => handleSwipe("down")}>
					<Text style={[nsh.mazeDpadIcon, { color: theme.accent }]}>▼</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ─── Styles for new renderers ─────────────────────────────────────────────────

const nsh = StyleSheet.create({
	// shared
	checkBtn: {
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.md,
		alignItems: "center",
		marginTop: Spacing.md,
		marginHorizontal: Spacing.md,
		...Shadows.medium,
	},
	checkBtnText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},

	// CROSSWORD
	crosswordOuter: { padding: Spacing.md },
	crosswordClueBar: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.sm,
		padding: Spacing.sm,
		marginBottom: Spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	crosswordClueText: {
		flex: 1,
		fontSize: Typography.fontSize.caption,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
	crosswordDirLabel: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginLeft: Spacing.sm,
	},
	crosswordCell: { borderWidth: 1, borderColor: Colors.borders.primary, alignItems: "center", justifyContent: "center" },
	crosswordBlack: { backgroundColor: Colors.text.primary },
	crosswordWhite: { backgroundColor: Colors.background.primary },
	crosswordSelected: { backgroundColor: Colors.accent + "50" },
	crosswordWrong: { backgroundColor: Colors.error + "40" },
	crosswordNumber: { position: "absolute", top: 1, left: 2, color: Colors.text.secondary, fontWeight: Typography.fontWeight.bold },
	crosswordLetter: { fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	crosswordInput: {
		borderWidth: 1.5,
		borderColor: Colors.borders.primary,
		borderRadius: BorderRadius.sm,
		padding: Spacing.sm,
		fontSize: Typography.fontSize.h2,
		textAlign: "center",
		marginBottom: Spacing.sm,
		backgroundColor: Colors.background.primary,
		color: Colors.text.primary,
	},

	// WORD SEARCH
	wsOuter: { padding: Spacing.md, alignItems: "center" },
	wsGrid: { marginBottom: Spacing.md },
	wsCell: { borderWidth: 0.5, borderColor: Colors.borders.subtle, alignItems: "center", justifyContent: "center" },
	wsCellSelected: { backgroundColor: Colors.accent + "60" },
	wsCellFound: { backgroundColor: Colors.game.correct + "40" },
	wsLetter: { fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	wsWordList: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.sm },
	wsWord: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs, borderRadius: BorderRadius.sm, backgroundColor: Colors.background.secondary },
	wsWordFound: { textDecorationLine: "line-through", color: Colors.game.correct, backgroundColor: Colors.game.correct + "20" },

	// MAZE
	mazeOuter: { flex: 1, alignItems: "center", padding: Spacing.md },
	mazeGrid: { marginVertical: Spacing.md },
	mazePlayer: { width: 16, height: 16, borderRadius: 8 },
	mazeStart: { width: 12, height: 12, borderRadius: 6 },
	mazeDpad: { alignItems: "center", marginTop: Spacing.md },
	mazeDpadBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
	mazeDpadIcon: { fontSize: 28, fontWeight: Typography.fontWeight.bold },

	// SPELLING BEE
	beeOuter: { alignItems: "center", padding: Spacing.lg },
	beeInput: { fontSize: Typography.fontSize.h1, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, letterSpacing: 4, marginBottom: Spacing.sm, minHeight: 44 },
	beeMessage: { fontSize: Typography.fontSize.body, color: Colors.game.correct, fontWeight: Typography.fontWeight.semiBold, marginBottom: Spacing.sm },
	beeHexContainer: { width: 240, position: "relative", marginVertical: Spacing.lg },
	beeHex: { width: 56, height: 56, backgroundColor: Colors.background.secondary, borderRadius: 12, alignItems: "center", justifyContent: "center", ...Shadows.light },
	beeHexCenter: { position: "absolute", top: 46, left: 92, backgroundColor: Colors.accent, ...Shadows.glowAccent },
	beeHexLetter: { fontSize: Typography.fontSize.h3, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	beeActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
	beeActionBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.text.primary },
	beeSubmitBtn: { backgroundColor: Colors.text.primary },
	beeActionText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	beeFoundCount: { marginTop: Spacing.md, fontSize: Typography.fontSize.caption, color: Colors.text.secondary },

	// LETTER GRID
	lgOuter: { flex: 1, alignItems: "center", padding: Spacing.md },
	lgGrid: { marginBottom: Spacing.md },
	lgCell: { borderWidth: 1, borderColor: Colors.borders.subtle, alignItems: "center", justifyContent: "center", margin: 2, backgroundColor: Colors.background.secondary },
	lgCellActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
	lgCellFound: { backgroundColor: Colors.game.correct + "40", borderColor: Colors.game.correct },
	lgLetter: { fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },

	// NONOGRAM
	nonoOuter: { padding: Spacing.md, alignItems: "center" },
	nonoColClue: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 },
	nonoRowClue: { alignItems: "flex-end", justifyContent: "center", paddingRight: 4 },
	nonoClueText: { fontSize: 11, fontWeight: Typography.fontWeight.semiBold },
	nonoCell: { borderWidth: 0.5, margin: 0.5 },

	// FLOW
	flowOuter: { flex: 1, alignItems: "center", padding: Spacing.md },
	flowGrid: { marginVertical: Spacing.md },
	flowCell: { borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
	flowDot: {},

	// SLIDING PUZZLE
	slideOuter: { flex: 1, alignItems: "center", padding: Spacing.lg },
	slideGrid: { flexDirection: "row", flexWrap: "wrap" },
	slideTile: { alignItems: "center", justifyContent: "center", borderRadius: BorderRadius.sm },
	slideTileText: { fontWeight: Typography.fontWeight.bold },

	// LOGIC GRID
	lgridOuter: { padding: Spacing.md },
	lgridClue: { marginBottom: Spacing.xs },
	lgridClueText: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	lgridCatLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.xs },
	lgridRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
	lgridEntityLabel: { width: 72, fontSize: Typography.fontSize.small, color: Colors.text.secondary },
	lgridCell: { width: 36, height: 36, borderWidth: 1, borderColor: Colors.borders.primary, alignItems: "center", justifyContent: "center", marginHorizontal: 1, borderRadius: 4 },
	lgridCellYes: { backgroundColor: Colors.game.correct + "30", borderColor: Colors.game.correct },
	lgridCellNo:  { backgroundColor: Colors.error + "20", borderColor: Colors.error },
	lgridCellText: { fontSize: 16, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	lgridItemLabel: { width: 36, fontSize: 9, textAlign: "center", color: Colors.text.inactive, marginHorizontal: 1 },

	// MINESWEEPER
	mineOuter: { padding: Spacing.md, alignItems: "center" },
	mineGrid: { marginVertical: Spacing.sm },
	mineCell: { borderRadius: 2, alignItems: "center", justifyContent: "center", margin: 1 },
	mineCellHidden: { backgroundColor: Colors.background.secondary, borderWidth: 1.5, borderColor: Colors.borders.primary },
	mineCellRevealed: { backgroundColor: Colors.background.tertiary, borderWidth: 0.5, borderColor: Colors.borders.subtle },
	mineNum: { fontWeight: Typography.fontWeight.bold },
	mineDead: { fontSize: Typography.fontSize.caption, color: Colors.error, textAlign: "center", marginBottom: Spacing.sm },

	// MERGE GRID
	mergeOuter: { flex: 1, alignItems: "center", padding: Spacing.md },
	mergeScore: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, marginBottom: Spacing.sm },
	mergeGrid: { borderRadius: BorderRadius.sm, padding: 4, gap: 4 },
	mergeTile: { margin: 3, borderRadius: 6, alignItems: "center", justifyContent: "center" },
	mergeTileText: { fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	mergeDpad: { alignItems: "center", marginTop: Spacing.md },
});
