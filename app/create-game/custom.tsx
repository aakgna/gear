/**
 * app/create-game/custom.tsx
 * Custom Puzzle Game creator — 5-step scene-graph builder.
 * Steps: Info → Scenes → Rules → Preview → Publish
 */

import React, { useState, useCallback, useMemo } from "react";
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
	Modal,
	Switch,
	SafeAreaView,
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
import { saveGameToFirestore } from "../../config/firebase";
import { getCurrentUser, getUserData } from "../../config/auth";
import { GamePlayer } from "../../runtime/GamePlayer";
import MinimalHeader from "../../components/MinimalHeader";
import type {
	CustomPuzzleGame,
	GameScene,
	GameVariable,
	GameRule,
	SceneContent,
	SceneKind,
} from "../../config/customPuzzleGame";

const { width: SW } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────

function uid() {
	return Math.random().toString(36).slice(2, 9);
}

const STEPS = ["Info", "Scenes", "Rules", "Preview", "Publish"] as const;

const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
	1: "Easy",
	2: "Medium",
	3: "Hard",
};

const SCENE_KIND_OPTIONS: Array<{
	kind: SceneKind;
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
	desc: string;
}> = [
	{ kind: "MCQ",              label: "Multiple Choice",   icon: "radio-button-on-outline",   desc: "Question with 2–4 answer choices" },
	{ kind: "INFO",             label: "Info Card",         icon: "information-circle-outline", desc: "Display text, player taps to continue" },
	{ kind: "TEXT_INPUT",       label: "Text Answer",       icon: "create-outline",             desc: "Player types the correct answer" },
	{ kind: "WORD_GUESS",       label: "Word Guess",        icon: "text-outline",               desc: "Guess letters one at a time (hangman)" },
	{ kind: "WORDLE",           label: "Wordle",            icon: "grid-outline",               desc: "Guess word with colour feedback" },
	{ kind: "SEQUENCE",         label: "Sequence",          icon: "reorder-four-outline",       desc: "Put items in the correct order" },
	{ kind: "MEMORY",           label: "Memory Match",      icon: "copy-outline",               desc: "Flip cards to match pairs" },
	{ kind: "MCQ_MULTI",        label: "Quiz (Multi-Q)",    icon: "list-outline",               desc: "Several MCQ questions in one scene" },
	{ kind: "TEXT_INPUT_MULTI", label: "Multi Text",        icon: "pencil-outline",             desc: "Multiple typed-answer rounds" },
	{ kind: "CATEGORY",         label: "Connections",       icon: "apps-outline",               desc: "Sort items into labelled categories" },
	{ kind: "CODEBREAKER",      label: "CodeBreaker",       icon: "color-palette-outline",      desc: "Crack the hidden colour sequence" },
	{ kind: "NUMBER_GRID",      label: "Number Grid",       icon: "calculator-outline",         desc: "Fill a number grid (magic square etc.)" },
];

const SCENE_KIND_LABELS: Record<SceneKind, string> = {
	MCQ: "Multiple Choice",
	MCQ_MULTI: "Quiz (Multi-Q)",
	TEXT_INPUT: "Text Answer",
	TEXT_INPUT_MULTI: "Multi Text",
	WORD_GUESS: "Word Guess",
	WORDLE: "Wordle",
	SEQUENCE: "Sequence",
	CATEGORY: "Connections",
	NUMBER_GRID: "Number Grid",
	PATH: "Path",
	CODEBREAKER: "CodeBreaker",
	MEMORY: "Memory Match",
	INFO: "Info Card",
};

const CB_COLORS = [
	"red","blue","green","yellow","purple","orange","white","black","pink","brown",
] as const;

const CB_EMOJI: Record<string, string> = {
	red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡", orange: "🟠",
	purple: "🟣", white: "⚪", black: "⚫", pink: "💗", brown: "🟤",
};

const GROUP_COLORS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#ec4899"];

function defaultContent(kind: SceneKind): SceneContent {
	switch (kind) {
		case "MCQ":
			return { kind, question: "", choices: [{ id: "a", label: "" }, { id: "b", label: "" }], correctId: "a" };
		case "MCQ_MULTI":
			return { kind, questions: [{ question: "", choices: [{ id: "a", label: "" }, { id: "b", label: "" }], correctId: "a" }], pointsPerCorrect: 1 };
		case "TEXT_INPUT":
			return { kind, prompt: "", answer: "", caseSensitive: false };
		case "TEXT_INPUT_MULTI":
			return { kind, rounds: [{ prompt: "", answer: "" }], pointsPerCorrect: 1 };
		case "WORD_GUESS":
			return { kind, word: "", maxWrongGuesses: 6 };
		case "WORDLE":
			return { kind, word: "", wordLength: 5, maxAttempts: 6 };
		case "SEQUENCE":
			return { kind, items: ["", "", ""], solution: [0, 1, 2] };
		case "CATEGORY":
			return { kind, groups: [{ id: "g1", label: "", color: "#f59e0b" }, { id: "g2", label: "", color: "#3b82f6" }], items: [] };
		case "NUMBER_GRID":
			return { kind, size: 3, gridType: "free", solution: Array(9).fill(0), givens: [] };
		case "PATH":
			return { kind, rows: 3, cols: 3, cells: [], solution: [] };
		case "CODEBREAKER":
			return { kind, secretCode: ["red", "blue", "green", "yellow"], options: ["red", "blue", "green", "yellow", "purple", "orange"], maxGuesses: 6 };
		case "MEMORY": {
			const id = uid();
			return { kind, pairs: [{ id: `${id}a`, value: "🐶", matchId: `${id}b` }, { id: `${id}b`, value: "🐶", matchId: `${id}a` }], cols: 4 };
		}
		case "INFO":
			return { kind, text: "", continueLabel: "Continue" };
	}
}

function getScenePreview(content: SceneContent): string {
	switch (content.kind) {
		case "MCQ":              return content.question || "(no question)";
		case "MCQ_MULTI":        return `${content.questions.length} question${content.questions.length !== 1 ? "s" : ""}`;
		case "TEXT_INPUT":       return content.prompt || "(no prompt)";
		case "TEXT_INPUT_MULTI": return `${content.rounds.length} round${content.rounds.length !== 1 ? "s" : ""}`;
		case "INFO":             return content.text || "(no text)";
		case "WORD_GUESS":       return content.word ? `Word: ${content.word}` : "(no word set)";
		case "WORDLE":           return content.word ? `Word: ${content.word}` : "(no word set)";
		case "SEQUENCE":         return `${content.items.length} items`;
		case "CATEGORY":         return `${content.groups.length} groups, ${content.items.length} items`;
		case "NUMBER_GRID":      return `${content.size}×${content.size} ${content.gridType}`;
		case "PATH":             return `${content.rows}×${content.cols} path grid`;
		case "CODEBREAKER":      return `Code: ${content.secretCode.join(", ")}`;
		case "MEMORY":           return `${content.pairs.length / 2} pair${content.pairs.length / 2 !== 1 ? "s" : ""}`;
		default:                 return "";
	}
}

// ─── Shared form primitives ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={fc.field}>
			<Text style={fc.label}>{label}</Text>
			{children}
		</View>
	);
}

function FInput(props: React.ComponentProps<typeof TextInput>) {
	return (
		<TextInput
			style={fc.input}
			placeholderTextColor={Colors.text.inactive}
			{...props}
		/>
	);
}

function PillRow<T extends string>({
	options,
	value,
	onSelect,
}: {
	options: Array<{ value: T; label: string }>;
	value: T;
	onSelect: (v: T) => void;
}) {
	return (
		<View style={{ flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" }}>
			{options.map((o) => (
				<TouchableOpacity
					key={o.value}
					style={[fc.pill, value === o.value && fc.pillActive]}
					onPress={() => onSelect(o.value)}
				>
					<Text style={[fc.pillText, value === o.value && fc.pillTextActive]}>{o.label}</Text>
				</TouchableOpacity>
			))}
		</View>
	);
}

// ─── Scene editors ────────────────────────────────────────────────────────────

function MCQEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "MCQ" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	const updateChoice = (idx: number, label: string) =>
		u({ choices: content.choices.map((c, i) => (i === idx ? { ...c, label } : c)) });
	const addChoice = () => {
		if (content.choices.length >= 4) return;
		const ids = ["a", "b", "c", "d"];
		u({ choices: [...content.choices, { id: ids[content.choices.length], label: "" }] });
	};
	const removeChoice = (idx: number) => {
		if (content.choices.length <= 2) return;
		const choices = content.choices.filter((_, i) => i !== idx);
		const correctId = choices.some((c) => c.id === content.correctId) ? content.correctId : choices[0].id;
		u({ choices, correctId });
	};

	return (
		<>
			<Field label="Question *">
				<FInput placeholder="Enter your question…" value={content.question} onChangeText={(t) => u({ question: t })} multiline />
			</Field>
			<Field label="Choices (tap circle to mark correct)">
				{content.choices.map((c, i) => (
					<View key={c.id} style={fc.row}>
						<TouchableOpacity
							style={[fc.radio, content.correctId === c.id && fc.radioActive]}
							onPress={() => u({ correctId: c.id })}
						>
							{content.correctId === c.id && <View style={fc.radioDot} />}
						</TouchableOpacity>
						<TextInput
							style={[fc.input, { flex: 1, marginBottom: 0 }]}
							placeholder={`Choice ${String.fromCharCode(65 + i)}`}
							placeholderTextColor={Colors.text.inactive}
							value={c.label}
							onChangeText={(t) => updateChoice(i, t)}
						/>
						{content.choices.length > 2 && (
							<TouchableOpacity onPress={() => removeChoice(i)} style={{ padding: 6 }}>
								<Ionicons name="close-circle" size={20} color={Colors.text.inactive} />
							</TouchableOpacity>
						)}
					</View>
				))}
				{content.choices.length < 4 && (
					<TouchableOpacity style={fc.addBtn} onPress={addChoice}>
						<Ionicons name="add" size={16} color={Colors.accent} />
						<Text style={fc.addBtnText}>Add choice</Text>
					</TouchableOpacity>
				)}
			</Field>
			<Field label="Hint (optional)">
				<FInput placeholder="Shown after a wrong answer" value={content.hint ?? ""} onChangeText={(t) => u({ hint: t || undefined })} />
			</Field>
		</>
	);
}

function InfoEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "INFO" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	return (
		<>
			<Field label="Main Text *">
				<FInput placeholder="What should the player read?" value={content.text} onChangeText={(t) => u({ text: t })} multiline />
			</Field>
			<Field label="Subtext (optional)">
				<FInput placeholder="e.g. Round 1 of 3" value={content.subtext ?? ""} onChangeText={(t) => u({ subtext: t || undefined })} />
			</Field>
			<Field label="Continue Button Label">
				<FInput placeholder="Continue" value={content.continueLabel ?? ""} onChangeText={(t) => u({ continueLabel: t || "Continue" })} />
			</Field>
		</>
	);
}

function TextInputEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "TEXT_INPUT" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	return (
		<>
			<Field label="Prompt *">
				<FInput placeholder="e.g. What is 2 + 2?" value={content.prompt} onChangeText={(t) => u({ prompt: t })} />
			</Field>
			<Field label="Correct Answer *">
				<FInput placeholder="e.g. 4" value={content.answer} onChangeText={(t) => u({ answer: t })} />
			</Field>
			<Field label="Hint (optional)">
				<FInput placeholder="Shown after a wrong answer" value={content.hint ?? ""} onChangeText={(t) => u({ hint: t || undefined })} />
			</Field>
			<View style={[fc.row, { justifyContent: "space-between" }]}>
				<Text style={fc.label}>Case Sensitive</Text>
				<Switch
					value={content.caseSensitive ?? false}
					onValueChange={(v) => u({ caseSensitive: v })}
					trackColor={{ true: Colors.accent, false: Colors.borders.subtle }}
					thumbColor={Colors.background.primary}
				/>
			</View>
		</>
	);
}

function WordGuessEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "WORD_GUESS" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	return (
		<>
			<Field label="Secret Word * (uppercase letters only)">
				<FInput
					placeholder="e.g. PLANET"
					value={content.word}
					onChangeText={(t) => u({ word: t.toUpperCase().replace(/[^A-Z]/g, "") })}
					autoCapitalize="characters"
				/>
			</Field>
			<Field label="Category Hint (optional)">
				<FInput placeholder="e.g. Something in space" value={content.hint ?? ""} onChangeText={(t) => u({ hint: t || undefined })} />
			</Field>
			<Field label="Max Wrong Guesses">
				<PillRow
					options={[{ value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }, { value: "8", label: "8" }]}
					value={String(content.maxWrongGuesses)}
					onSelect={(v) => u({ maxWrongGuesses: Number(v) })}
				/>
			</Field>
		</>
	);
}

function WordleEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "WORDLE" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	return (
		<>
			<Field label="Word Length">
				<PillRow
					options={[{ value: "4", label: "4 letters" }, { value: "5", label: "5 letters" }, { value: "6", label: "6 letters" }]}
					value={String(content.wordLength)}
					onSelect={(v) => u({ wordLength: Number(v), word: "" })}
				/>
			</Field>
			<Field label={`Secret Word * (${content.wordLength} uppercase letters)`}>
				<FInput
					placeholder={`e.g. ${"CRANE".slice(0, content.wordLength)}`}
					value={content.word}
					onChangeText={(t) => u({ word: t.toUpperCase().replace(/[^A-Z]/g, "").slice(0, content.wordLength) })}
					autoCapitalize="characters"
					maxLength={content.wordLength}
				/>
			</Field>
			<Field label="Max Attempts">
				<PillRow
					options={[{ value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }]}
					value={String(content.maxAttempts)}
					onSelect={(v) => u({ maxAttempts: Number(v) })}
				/>
			</Field>
			<Field label="Hint (optional)">
				<FInput placeholder="Category or clue" value={content.hint ?? ""} onChangeText={(t) => u({ hint: t || undefined })} />
			</Field>
		</>
	);
}

function SequenceEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "SEQUENCE" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });

	const setItem = (i: number, val: string) =>
		u({ items: content.items.map((x, j) => (j === i ? val : x)) });

	const addItem = () => {
		const items = [...content.items, ""];
		u({ items, solution: [...content.solution, items.length - 1] });
	};

	const removeItem = (i: number) => {
		if (content.items.length <= 2) return;
		const items = content.items.filter((_, j) => j !== i);
		const solution = content.solution
			.filter((s) => s !== i)
			.map((s) => (s > i ? s - 1 : s));
		u({ items, solution });
	};

	// Correct order: solution[pos] = index into items[]
	// UI: show ordered list with move up/down
	const moveInOrder = (pos: number, dir: -1 | 1) => {
		const next = pos + dir;
		if (next < 0 || next >= content.solution.length) return;
		const solution = [...content.solution];
		[solution[pos], solution[next]] = [solution[next], solution[pos]];
		u({ solution });
	};

	return (
		<>
			<Field label="Items (enter each one)">
				{content.items.map((item, i) => (
					<View key={i} style={fc.row}>
						<Text style={{ color: Colors.text.secondary, width: 20, fontSize: Typography.fontSize.small }}>{i + 1}.</Text>
						<TextInput
							style={[fc.input, { flex: 1, marginBottom: 0 }]}
							placeholder={`Item ${i + 1}`}
							placeholderTextColor={Colors.text.inactive}
							value={item}
							onChangeText={(t) => setItem(i, t)}
						/>
						{content.items.length > 2 && (
							<TouchableOpacity onPress={() => removeItem(i)} style={{ padding: 6 }}>
								<Ionicons name="close-circle" size={20} color={Colors.text.inactive} />
							</TouchableOpacity>
						)}
					</View>
				))}
				{content.items.length < 8 && (
					<TouchableOpacity style={fc.addBtn} onPress={addItem}>
						<Ionicons name="add" size={16} color={Colors.accent} />
						<Text style={fc.addBtnText}>Add item</Text>
					</TouchableOpacity>
				)}
			</Field>
			<Field label="Correct Order (use ↑↓ to arrange)">
				{content.solution.map((itemIdx, pos) => (
					<View key={pos} style={fc.row}>
						<Text style={{ color: Colors.text.inactive, width: 24, fontSize: Typography.fontSize.small }}>#{pos + 1}</Text>
						<Text style={[fc.input, { flex: 1, marginBottom: 0, paddingVertical: Spacing.sm }]}>
							{content.items[itemIdx] || `Item ${itemIdx + 1}`}
						</Text>
						<View style={{ flexDirection: "row", gap: 2 }}>
							<TouchableOpacity disabled={pos === 0} onPress={() => moveInOrder(pos, -1)} style={{ padding: 6 }}>
								<Ionicons name="chevron-up" size={18} color={pos === 0 ? Colors.text.inactive : Colors.accent} />
							</TouchableOpacity>
							<TouchableOpacity disabled={pos === content.solution.length - 1} onPress={() => moveInOrder(pos, 1)} style={{ padding: 6 }}>
								<Ionicons name="chevron-down" size={18} color={pos === content.solution.length - 1 ? Colors.text.inactive : Colors.accent} />
							</TouchableOpacity>
						</View>
					</View>
				))}
			</Field>
			<Field label="Hint (optional)">
				<FInput placeholder="e.g. Order by size, smallest first" value={content.hint ?? ""} onChangeText={(t) => u({ hint: t || undefined })} />
			</Field>
		</>
	);
}

function MemoryEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "MEMORY" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	const pairCount = content.pairs.length / 2;
	const pairValues = content.pairs.filter((_, i) => i % 2 === 0).map((p) => p.value);

	const updatePairValue = (pairIdx: number, val: string) => {
		const pairs = [...content.pairs];
		pairs[pairIdx * 2] = { ...pairs[pairIdx * 2], value: val };
		pairs[pairIdx * 2 + 1] = { ...pairs[pairIdx * 2 + 1], value: val };
		u({ pairs });
	};
	const addPair = () => {
		if (pairCount >= 8) return;
		const id = uid();
		u({ pairs: [...content.pairs, { id: `${id}a`, value: "⭐", matchId: `${id}b` }, { id: `${id}b`, value: "⭐", matchId: `${id}a` }] });
	};
	const removePair = (pairIdx: number) => {
		if (pairCount <= 2) return;
		u({ pairs: content.pairs.filter((_, i) => Math.floor(i / 2) !== pairIdx) });
	};

	return (
		<>
			<Field label="Pairs (emoji or short text — each appears twice)">
				{pairValues.map((val, i) => (
					<View key={i} style={fc.row}>
						<TextInput
							style={[fc.input, { flex: 1, marginBottom: 0 }]}
							placeholder="🎯 or word"
							placeholderTextColor={Colors.text.inactive}
							value={val}
							onChangeText={(t) => updatePairValue(i, t)}
						/>
						{pairCount > 2 && (
							<TouchableOpacity onPress={() => removePair(i)} style={{ padding: 6 }}>
								<Ionicons name="close-circle" size={20} color={Colors.text.inactive} />
							</TouchableOpacity>
						)}
					</View>
				))}
				{pairCount < 8 && (
					<TouchableOpacity style={fc.addBtn} onPress={addPair}>
						<Ionicons name="add" size={16} color={Colors.accent} />
						<Text style={fc.addBtnText}>Add pair</Text>
					</TouchableOpacity>
				)}
			</Field>
			<Field label="Grid Columns">
				<PillRow
					options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]}
					value={String(content.cols)}
					onSelect={(v) => u({ cols: Number(v) as 2 | 3 | 4 })}
				/>
			</Field>
		</>
	);
}

function MCQMultiEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "MCQ_MULTI" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });

	const addQuestion = () =>
		u({ questions: [...content.questions, { question: "", choices: [{ id: "a", label: "" }, { id: "b", label: "" }], correctId: "a" }] });

	const removeQuestion = (qi: number) => {
		if (content.questions.length <= 1) return;
		u({ questions: content.questions.filter((_, i) => i !== qi) });
	};

	const updateQuestion = (qi: number, question: string) =>
		u({ questions: content.questions.map((q, i) => (i === qi ? { ...q, question } : q)) });

	const updateChoice = (qi: number, ci: number, label: string) =>
		u({
			questions: content.questions.map((q, i) =>
				i === qi ? { ...q, choices: q.choices.map((c, j) => (j === ci ? { ...c, label } : c)) } : q
			),
		});

	const setCorrect = (qi: number, correctId: string) =>
		u({ questions: content.questions.map((q, i) => (i === qi ? { ...q, correctId } : q)) });

	return (
		<>
			{content.questions.map((q, qi) => (
				<View key={qi} style={fc.subCard}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
						<Text style={fc.subCardTitle}>Question {qi + 1}</Text>
						{content.questions.length > 1 && (
							<TouchableOpacity onPress={() => removeQuestion(qi)}>
								<Ionicons name="trash-outline" size={18} color={Colors.game.incorrect} />
							</TouchableOpacity>
						)}
					</View>
					<TextInput
						style={fc.input}
						placeholder="Question text"
						placeholderTextColor={Colors.text.inactive}
						value={q.question}
						onChangeText={(t) => updateQuestion(qi, t)}
					/>
					{q.choices.map((c, ci) => (
						<View key={c.id} style={fc.row}>
							<TouchableOpacity
								style={[fc.radio, q.correctId === c.id && fc.radioActive]}
								onPress={() => setCorrect(qi, c.id)}
							>
								{q.correctId === c.id && <View style={fc.radioDot} />}
							</TouchableOpacity>
							<TextInput
								style={[fc.input, { flex: 1, marginBottom: 0 }]}
								placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
								placeholderTextColor={Colors.text.inactive}
								value={c.label}
								onChangeText={(t) => updateChoice(qi, ci, t)}
							/>
						</View>
					))}
				</View>
			))}
			{content.questions.length < 10 && (
				<TouchableOpacity style={fc.addBtn} onPress={addQuestion}>
					<Ionicons name="add" size={16} color={Colors.accent} />
					<Text style={fc.addBtnText}>Add question</Text>
				</TouchableOpacity>
			)}
		</>
	);
}

function TextInputMultiEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "TEXT_INPUT_MULTI" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	const addRound = () => u({ rounds: [...content.rounds, { prompt: "", answer: "" }] });
	const removeRound = (i: number) => {
		if (content.rounds.length <= 1) return;
		u({ rounds: content.rounds.filter((_, j) => j !== i) });
	};
	const updateRound = (i: number, field: "prompt" | "answer", val: string) =>
		u({ rounds: content.rounds.map((r, j) => (j === i ? { ...r, [field]: val } : r)) });

	return (
		<>
			{content.rounds.map((r, i) => (
				<View key={i} style={fc.subCard}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
						<Text style={fc.subCardTitle}>Round {i + 1}</Text>
						{content.rounds.length > 1 && (
							<TouchableOpacity onPress={() => removeRound(i)}>
								<Ionicons name="trash-outline" size={18} color={Colors.game.incorrect} />
							</TouchableOpacity>
						)}
					</View>
					<TextInput style={fc.input} placeholder="Prompt" placeholderTextColor={Colors.text.inactive} value={r.prompt} onChangeText={(t) => updateRound(i, "prompt", t)} />
					<TextInput style={[fc.input, { marginBottom: 0 }]} placeholder="Correct answer" placeholderTextColor={Colors.text.inactive} value={r.answer} onChangeText={(t) => updateRound(i, "answer", t)} />
				</View>
			))}
			{content.rounds.length < 20 && (
				<TouchableOpacity style={fc.addBtn} onPress={addRound}>
					<Ionicons name="add" size={16} color={Colors.accent} />
					<Text style={fc.addBtnText}>Add round</Text>
				</TouchableOpacity>
			)}
		</>
	);
}

function CategoryEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "CATEGORY" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });

	const updateGroupLabel = (i: number, label: string) =>
		u({ groups: content.groups.map((g, j) => (j === i ? { ...g, label } : g)) });

	const addGroup = () => {
		if (content.groups.length >= 4) return;
		const id = `g${uid()}`;
		const color = GROUP_COLORS[content.groups.length] ?? "#888";
		u({ groups: [...content.groups, { id, label: "", color }] });
	};
	const removeGroup = (i: number) => {
		if (content.groups.length <= 2) return;
		const gid = content.groups[i].id;
		u({ groups: content.groups.filter((_, j) => j !== i), items: content.items.filter((it) => it.groupId !== gid) });
	};

	const addItem = (groupId: string) => {
		u({ items: [...content.items, { id: uid(), label: "", groupId }] });
	};
	const removeItem = (id: string) => u({ items: content.items.filter((it) => it.id !== id) });
	const updateItem = (id: string, label: string) =>
		u({ items: content.items.map((it) => (it.id === id ? { ...it, label } : it)) });

	return (
		<>
			<Field label="Categories">
				{content.groups.map((g, i) => (
					<View key={g.id} style={{ marginBottom: Spacing.md }}>
						<View style={fc.row}>
							<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: g.color, marginRight: Spacing.sm }} />
							<TextInput
								style={[fc.input, { flex: 1, marginBottom: 0 }]}
								placeholder={`Category ${i + 1} name`}
								placeholderTextColor={Colors.text.inactive}
								value={g.label}
								onChangeText={(t) => updateGroupLabel(i, t)}
							/>
							{content.groups.length > 2 && (
								<TouchableOpacity onPress={() => removeGroup(i)} style={{ padding: 6 }}>
									<Ionicons name="close-circle" size={20} color={Colors.text.inactive} />
								</TouchableOpacity>
							)}
						</View>
						<View style={{ marginLeft: Spacing.lg, marginTop: Spacing.xs }}>
							{content.items.filter((it) => it.groupId === g.id).map((it) => (
								<View key={it.id} style={[fc.row, { marginTop: Spacing.xs }]}>
									<TextInput
										style={[fc.input, { flex: 1, marginBottom: 0 }]}
										placeholder="Item label"
										placeholderTextColor={Colors.text.inactive}
										value={it.label}
										onChangeText={(t) => updateItem(it.id, t)}
									/>
									<TouchableOpacity onPress={() => removeItem(it.id)} style={{ padding: 6 }}>
										<Ionicons name="close-circle" size={20} color={Colors.text.inactive} />
									</TouchableOpacity>
								</View>
							))}
							<TouchableOpacity style={[fc.addBtn, { marginTop: Spacing.xs }]} onPress={() => addItem(g.id)}>
								<Ionicons name="add" size={14} color={Colors.accent} />
								<Text style={[fc.addBtnText, { fontSize: Typography.fontSize.caption }]}>
									Add item to "{g.label || `Category ${i + 1}`}"
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				))}
				{content.groups.length < 4 && (
					<TouchableOpacity style={fc.addBtn} onPress={addGroup}>
						<Ionicons name="add" size={16} color={Colors.accent} />
						<Text style={fc.addBtnText}>Add category</Text>
					</TouchableOpacity>
				)}
			</Field>
		</>
	);
}

function CodebreakerEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "CODEBREAKER" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });

	const toggleColor = (color: string) => {
		const included = content.options.includes(color);
		const options = included ? content.options.filter((c) => c !== color) : [...content.options, color];
		if (options.length < content.secretCode.length) return;
		const secretCode = content.secretCode.map((c) => (options.includes(c) ? c : options[0]));
		u({ options, secretCode });
	};

	const setCodeSlot = (idx: number, color: string) =>
		u({ secretCode: content.secretCode.map((c, i) => (i === idx ? color : c)) });

	const setCodeLength = (len: number) =>
		u({ secretCode: Array.from({ length: len }, (_, i) => content.secretCode[i] ?? content.options[0] ?? "red") });

	return (
		<>
			<Field label="Available Colors">
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
					{CB_COLORS.map((c) => (
						<TouchableOpacity
							key={c}
							onPress={() => toggleColor(c)}
							style={[
								{ padding: 4, borderRadius: BorderRadius.sm, borderWidth: 2.5 },
								content.options.includes(c) ? { borderColor: Colors.accent } : { borderColor: "transparent" },
							]}
						>
							<Text style={{ fontSize: 26 }}>{CB_EMOJI[c]}</Text>
						</TouchableOpacity>
					))}
				</View>
			</Field>
			<Field label="Code Length">
				<PillRow
					options={[{ value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }]}
					value={String(content.secretCode.length)}
					onSelect={(v) => setCodeLength(Number(v))}
				/>
			</Field>
			<Field label="Secret Code (tap to set each slot)">
				<View style={{ flexDirection: "row", gap: Spacing.md, flexWrap: "wrap" }}>
					{content.secretCode.map((c, idx) => (
						<View key={idx}>
							<Text style={{ textAlign: "center", fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: 4 }}>
								#{idx + 1}
							</Text>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
								{content.options.map((opt) => (
									<TouchableOpacity
										key={opt}
										onPress={() => setCodeSlot(idx, opt)}
										style={[
											{ borderRadius: 6, borderWidth: 2.5 },
											c === opt ? { borderColor: Colors.accent } : { borderColor: "transparent" },
										]}
									>
										<Text style={{ fontSize: 22 }}>{CB_EMOJI[opt]}</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>
					))}
				</View>
			</Field>
			<Field label="Max Guesses">
				<PillRow
					options={[{ value: "4", label: "4" }, { value: "6", label: "6" }, { value: "8", label: "8" }, { value: "10", label: "10" }]}
					value={String(content.maxGuesses)}
					onSelect={(v) => u({ maxGuesses: Number(v) })}
				/>
			</Field>
		</>
	);
}

function NumberGridEditor({
	content,
	onChange,
}: {
	content: Extract<SceneContent, { kind: "NUMBER_GRID" }>;
	onChange: (c: SceneContent) => void;
}) {
	const u = (p: Partial<typeof content>) => onChange({ ...content, ...p });
	const total = content.size * content.size;

	const setSolutionCell = (idx: number, val: string) => {
		const num = parseInt(val) || 0;
		const solution = content.solution.map((v, i) => (i === idx ? num : v));
		const givens = content.givens.map((g) => {
			const gIdx = g.row * content.size + g.col;
			return gIdx === idx ? { ...g, value: num } : g;
		});
		u({ solution, givens });
	};

	const toggleGiven = (row: number, col: number) => {
		const exists = content.givens.some((g) => g.row === row && g.col === col);
		const value = content.solution[row * content.size + col];
		const givens = exists
			? content.givens.filter((g) => !(g.row === row && g.col === col))
			: [...content.givens, { row, col, value }];
		u({ givens });
	};

	const cellSize = Math.min(52, Math.floor((SW - Spacing.md * 2 - 32) / content.size));

	return (
		<>
			<Field label="Grid Size">
				<PillRow
					options={[{ value: "3", label: "3×3" }, { value: "4", label: "4×4" }, { value: "5", label: "5×5" }]}
					value={String(content.size)}
					onSelect={(v) => {
						const size = Number(v);
						u({ size, solution: Array(size * size).fill(0), givens: [] });
					}}
				/>
			</Field>
			<Field label="Grid Type">
				<PillRow
					options={[
						{ value: "free", label: "Free" },
						{ value: "magic_square", label: "Magic Square" },
						{ value: "futoshiki", label: "Futoshiki" },
					]}
					value={content.gridType}
					onSelect={(v) => u({ gridType: v as typeof content.gridType })}
				/>
			</Field>
			{content.gridType === "magic_square" && (
				<Field label="Magic Constant (e.g. 15 for 3×3)">
					<FInput
						placeholder="15"
						value={content.magicConstant ? String(content.magicConstant) : ""}
						onChangeText={(t) => u({ magicConstant: parseInt(t) || undefined })}
						keyboardType="numeric"
					/>
				</Field>
			)}
			<Field label="Solution cells (fill values, tap label to mark as pre-revealed)">
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
					{Array.from({ length: total }).map((_, idx) => {
						const row = Math.floor(idx / content.size);
						const col = idx % content.size;
						const isGiven = content.givens.some((g) => g.row === row && g.col === col);
						return (
							<View key={idx} style={{ alignItems: "center" }}>
								<TextInput
									style={{
										width: cellSize,
										height: cellSize,
										borderWidth: 1.5,
										borderColor: isGiven ? Colors.accent : Colors.borders.subtle,
										borderRadius: BorderRadius.sm,
										backgroundColor: isGiven ? Colors.accent + "22" : Colors.background.tertiary,
										textAlign: "center",
										fontSize: Typography.fontSize.body,
										color: Colors.text.primary,
									}}
									value={content.solution[idx] ? String(content.solution[idx]) : ""}
									onChangeText={(t) => setSolutionCell(idx, t)}
									keyboardType="numeric"
									maxLength={2}
								/>
								<TouchableOpacity onPress={() => toggleGiven(row, col)} style={{ marginTop: 3 }}>
									<Text style={{ fontSize: 9, color: isGiven ? Colors.accent : Colors.text.inactive }}>
										{isGiven ? "given ✓" : "given?"}
									</Text>
								</TouchableOpacity>
							</View>
						);
					})}
				</View>
			</Field>
		</>
	);
}

function SceneEditor({
	content,
	onChange,
}: {
	content: SceneContent;
	onChange: (c: SceneContent) => void;
}) {
	switch (content.kind) {
		case "MCQ":              return <MCQEditor content={content} onChange={onChange} />;
		case "MCQ_MULTI":        return <MCQMultiEditor content={content} onChange={onChange} />;
		case "TEXT_INPUT":       return <TextInputEditor content={content} onChange={onChange} />;
		case "TEXT_INPUT_MULTI": return <TextInputMultiEditor content={content} onChange={onChange} />;
		case "INFO":             return <InfoEditor content={content} onChange={onChange} />;
		case "WORD_GUESS":       return <WordGuessEditor content={content} onChange={onChange} />;
		case "WORDLE":           return <WordleEditor content={content} onChange={onChange} />;
		case "SEQUENCE":         return <SequenceEditor content={content} onChange={onChange} />;
		case "MEMORY":           return <MemoryEditor content={content} onChange={onChange} />;
		case "CATEGORY":         return <CategoryEditor content={content} onChange={onChange} />;
		case "CODEBREAKER":      return <CodebreakerEditor content={content} onChange={onChange} />;
		case "NUMBER_GRID":      return <NumberGridEditor content={content} onChange={onChange} />;
		case "PATH":
			return (
				<View style={{ padding: Spacing.md }}>
					<Text style={{ color: Colors.text.secondary, fontSize: Typography.fontSize.caption, lineHeight: 20 }}>
						PATH scenes require a custom row/column grid with numbered cells. This is an advanced type — set up your rows, cols, cells, and solution array in the data layer.
					</Text>
				</View>
			);
		default:
			return null;
	}
}

// ─── Main creator component ───────────────────────────────────────────────────

export default function CreateCustomGame() {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	// ── Navigation ─────────────────────────────────────────────────────────
	const [step, setStep] = useState(0);

	// ── Step 0: Info ───────────────────────────────────────────────────────
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);

	// ── Step 1: Scenes ─────────────────────────────────────────────────────
	const [scenes, setScenes] = useState<GameScene[]>([]);
	const [showKindPicker, setShowKindPicker] = useState(false);
	const [editingScene, setEditingScene] = useState<{ idx: number; content: SceneContent } | null>(null);

	// ── Step 2: Rules ──────────────────────────────────────────────────────
	const [hasScore, setHasScore] = useState(false);
	const [hasLives, setHasLives] = useState(false);
	const [livesCount, setLivesCount] = useState(3);
	const [hasTimer, setHasTimer] = useState(false);
	const [timerSeconds, setTimerSeconds] = useState(60);

	// ── Step 4: Publish ────────────────────────────────────────────────────
	const [loading, setLoading] = useState(false);

	// ── Derived game object ────────────────────────────────────────────────
	const variables = useMemo<GameVariable[]>(() => {
		const v: GameVariable[] = [];
		if (hasScore) v.push({ id: "score", name: "Score", type: "number", initial: 0 });
		if (hasLives) v.push({ id: "lives", name: "Lives", type: "number", initial: livesCount });
		return v;
	}, [hasScore, hasLives, livesCount]);

	const rules = useMemo<GameRule[]>(() => {
		const r: GameRule[] = [];
		if (hasScore) r.push({ id: "score-correct", on: "CORRECT", then: [{ type: "INC_VAR", variableId: "score", amount: 1 }] });
		if (hasLives) {
			r.push({ id: "lives-wrong", on: "WRONG", then: [{ type: "DEC_VAR", variableId: "lives", amount: 1 }] });
			r.push({ id: "lives-lose", on: "WRONG", if: [{ variableId: "lives", op: "lte", value: 0 }], then: [{ type: "LOSE" }] });
		}
		return r;
	}, [hasScore, hasLives]);

	const game = useMemo<CustomPuzzleGame>(
		() => ({
			id: `custom-${uid()}`,
			meta: { title: title.trim() || "Untitled", description: description.trim() || undefined, difficulty },
			variables,
			scenes,
			rules,
			startSceneId: scenes[0]?.id ?? "",
			systems: hasTimer ? { timer: { seconds: timerSeconds } } : undefined,
		}),
		[title, description, difficulty, variables, scenes, rules, hasTimer, timerSeconds]
	);

	// ── Scene helpers ──────────────────────────────────────────────────────
	const addScene = useCallback(
		(kind: SceneKind) => {
			const id = `s-${uid()}`;
			const content = defaultContent(kind);
			setScenes((prev) => [...prev, { id, content }]);
			setShowKindPicker(false);
			setEditingScene({ idx: scenes.length, content });
		},
		[scenes.length]
	);

	const openEditor = (idx: number) => setEditingScene({ idx, content: scenes[idx].content });

	const saveEditorScene = () => {
		if (!editingScene) return;
		setScenes((prev) => prev.map((s, i) => (i === editingScene.idx ? { ...s, content: editingScene.content } : s)));
		setEditingScene(null);
	};

	const deleteScene = (idx: number) => {
		Alert.alert("Remove Scene", "Delete this scene?", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Delete", style: "destructive", onPress: () => setScenes((prev) => prev.filter((_, i) => i !== idx)) },
		]);
	};

	const moveScene = (idx: number, dir: -1 | 1) => {
		const next = idx + dir;
		if (next < 0 || next >= scenes.length) return;
		setScenes((prev) => {
			const arr = [...prev];
			[arr[idx], arr[next]] = [arr[next], arr[idx]];
			return arr;
		});
	};

	// ── Validation ─────────────────────────────────────────────────────────
	const canProceed = (() => {
		if (step === 0) return title.trim().length > 0;
		if (step === 1) return scenes.length > 0;
		return true;
	})();

	// ── Publish ────────────────────────────────────────────────────────────
	const handlePublish = async () => {
		const user = getCurrentUser();
		if (!user) { Alert.alert("Not signed in", "Please sign in to publish."); return; }
		setLoading(true);
		try {
			const userData = await getUserData(user.uid);
			const difficultyLabel = difficulty === 1 ? "easy" : difficulty === 2 ? "medium" : "hard";
			await saveGameToFirestore("custom", difficultyLabel, { game } as any, user.uid, userData?.username);
			Alert.alert("Submitted!", "Your game has been submitted for review. It usually appears within 24–48 hours.", [
				{ text: "OK", onPress: () => router.back() },
			]);
		} catch (e: any) {
			Alert.alert("Error", e?.message ?? "Failed to save. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	// ── Step renderers ─────────────────────────────────────────────────────
	const renderInfo = () => (
		<View style={s.stepContent}>
			<Field label="Game Title *">
				<FInput placeholder="e.g. Capital Cities Quiz" value={title} onChangeText={setTitle} />
			</Field>
			<Field label="Description (optional)">
				<FInput
					placeholder="Describe your game in one sentence…"
					value={description}
					onChangeText={setDescription}
					multiline
					style={[fc.input, { minHeight: 72 }]}
				/>
			</Field>
			<Field label="Difficulty">
				<PillRow
					options={[{ value: "1", label: "Easy" }, { value: "2", label: "Medium" }, { value: "3", label: "Hard" }]}
					value={String(difficulty)}
					onSelect={(v) => setDifficulty(Number(v) as 1 | 2 | 3)}
				/>
			</Field>
		</View>
	);

	const renderScenes = () => (
		<View style={s.stepContent}>
			{scenes.length === 0 && (
				<View style={s.emptyState}>
					<Ionicons name="layers-outline" size={44} color={Colors.text.inactive} />
					<Text style={s.emptyTitle}>No scenes yet</Text>
					<Text style={s.emptySub}>Scenes are the stages of your game. Add your first one below.</Text>
				</View>
			)}
			{scenes.map((scene, idx) => (
				<View key={scene.id} style={s.sceneCard}>
					<View style={s.sceneRow}>
						<View style={[s.sceneBadge, { backgroundColor: Colors.accent + "22" }]}>
							<Text style={[s.sceneBadgeText, { color: Colors.accent }]}>{idx + 1}</Text>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={s.sceneKind}>{SCENE_KIND_LABELS[scene.content.kind]}</Text>
							<Text style={s.scenePreview} numberOfLines={1}>
								{getScenePreview(scene.content)}
							</Text>
						</View>
						<View style={{ flexDirection: "row", gap: 2 }}>
							<TouchableOpacity disabled={idx === 0} onPress={() => moveScene(idx, -1)} style={s.iconBtn}>
								<Ionicons name="chevron-up" size={18} color={idx === 0 ? Colors.text.inactive : Colors.text.secondary} />
							</TouchableOpacity>
							<TouchableOpacity disabled={idx === scenes.length - 1} onPress={() => moveScene(idx, 1)} style={s.iconBtn}>
								<Ionicons name="chevron-down" size={18} color={idx === scenes.length - 1 ? Colors.text.inactive : Colors.text.secondary} />
							</TouchableOpacity>
							<TouchableOpacity onPress={() => openEditor(idx)} style={s.iconBtn}>
								<Ionicons name="create-outline" size={18} color={Colors.accent} />
							</TouchableOpacity>
							<TouchableOpacity onPress={() => deleteScene(idx)} style={s.iconBtn}>
								<Ionicons name="trash-outline" size={18} color={Colors.game.incorrect} />
							</TouchableOpacity>
						</View>
					</View>
				</View>
			))}
			<TouchableOpacity style={s.addSceneBtn} onPress={() => setShowKindPicker(true)}>
				<Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
				<Text style={s.addSceneBtnText}>Add Scene</Text>
			</TouchableOpacity>
		</View>
	);

	const renderRules = () => (
		<View style={s.stepContent}>
			<Text style={s.sectionNote}>
				Add optional variables and rules. The game automatically advances through scenes and wins when all are complete — no extra rule needed.
			</Text>

			<View style={s.ruleCard}>
				<View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
					<Text style={{ fontSize: 20, marginRight: Spacing.sm }}>⭐</Text>
					<Text style={s.ruleCardTitle}>Score</Text>
				</View>
				<Text style={s.ruleCardSub}>Adds +1 for every correct answer.</Text>
				<View style={s.toggleRow}>
					<Text style={s.toggleLabel}>Enable Score</Text>
					<Switch value={hasScore} onValueChange={setHasScore} trackColor={{ true: Colors.accent, false: Colors.borders.subtle }} thumbColor={Colors.background.primary} />
				</View>
			</View>

			<View style={s.ruleCard}>
				<View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
					<Text style={{ fontSize: 20, marginRight: Spacing.sm }}>❤️</Text>
					<Text style={s.ruleCardTitle}>Lives</Text>
				</View>
				<Text style={s.ruleCardSub}>Player loses a life on each wrong answer; game over at zero.</Text>
				<View style={s.toggleRow}>
					<Text style={s.toggleLabel}>Enable Lives</Text>
					<Switch value={hasLives} onValueChange={setHasLives} trackColor={{ true: Colors.accent, false: Colors.borders.subtle }} thumbColor={Colors.background.primary} />
				</View>
				{hasLives && (
					<View style={[s.toggleRow, { marginTop: Spacing.sm }]}>
						<Text style={s.toggleLabel}>Starting Lives</Text>
						<PillRow
							options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "5", label: "5" }]}
							value={String(livesCount)}
							onSelect={(v) => setLivesCount(Number(v))}
						/>
					</View>
				)}
			</View>

			<View style={s.ruleCard}>
				<View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
					<Text style={{ fontSize: 20, marginRight: Spacing.sm }}>⏱️</Text>
					<Text style={s.ruleCardTitle}>Timer</Text>
				</View>
				<Text style={s.ruleCardSub}>Countdown timer displayed during play.</Text>
				<View style={s.toggleRow}>
					<Text style={s.toggleLabel}>Enable Timer</Text>
					<Switch value={hasTimer} onValueChange={setHasTimer} trackColor={{ true: Colors.accent, false: Colors.borders.subtle }} thumbColor={Colors.background.primary} />
				</View>
				{hasTimer && (
					<View style={[s.toggleRow, { marginTop: Spacing.sm }]}>
						<Text style={s.toggleLabel}>Duration</Text>
						<PillRow
							options={[{ value: "30", label: "30s" }, { value: "60", label: "1m" }, { value: "120", label: "2m" }, { value: "300", label: "5m" }]}
							value={String(timerSeconds)}
							onSelect={(v) => setTimerSeconds(Number(v))}
						/>
					</View>
				)}
			</View>
		</View>
	);

	const renderPreview = () => (
		<View style={{ flex: 1, minHeight: 400 }}>
			{scenes.length === 0 ? (
				<View style={s.emptyState}>
					<Ionicons name="play-circle-outline" size={44} color={Colors.text.inactive} />
					<Text style={s.emptyTitle}>Nothing to preview</Text>
					<Text style={s.emptySub}>Go back to Scenes and add at least one scene.</Text>
				</View>
			) : (
				<GamePlayer
					key={`preview-${scenes.map((s) => s.id).join("-")}`}
					game={{ ...game, id: `preview-${Date.now()}` }}
					puzzleId="preview"
					isActive
					onComplete={() => {}}
				/>
			)}
		</View>
	);

	const renderPublish = () => (
		<View style={s.stepContent}>
			<View style={s.summaryCard}>
				<Text style={s.summaryTitle}>{title || "Untitled"}</Text>
				{description ? <Text style={s.summarySub}>{description}</Text> : null}
				<View style={s.summaryMeta}>
					<View style={s.metaPill}>
						<Ionicons name="layers-outline" size={13} color={Colors.text.secondary} />
						<Text style={s.metaText}>{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</Text>
					</View>
					<View style={s.metaPill}>
						<Ionicons name="speedometer-outline" size={13} color={Colors.text.secondary} />
						<Text style={s.metaText}>{DIFFICULTY_LABELS[difficulty]}</Text>
					</View>
					{hasScore && (
						<View style={s.metaPill}>
							<Ionicons name="star-outline" size={13} color={Colors.text.secondary} />
							<Text style={s.metaText}>Score</Text>
						</View>
					)}
					{hasLives && (
						<View style={s.metaPill}>
							<Ionicons name="heart-outline" size={13} color={Colors.text.secondary} />
							<Text style={s.metaText}>{livesCount} Lives</Text>
						</View>
					)}
					{hasTimer && (
						<View style={s.metaPill}>
							<Ionicons name="timer-outline" size={13} color={Colors.text.secondary} />
							<Text style={s.metaText}>{timerSeconds}s</Text>
						</View>
					)}
				</View>
			</View>

			<View style={s.infoBox}>
				<Ionicons name="information-circle-outline" size={18} color={Colors.text.secondary} />
				<Text style={s.infoBoxText}>
					Your game will be submitted for review before appearing in the public feed. This usually takes 24–48 hours.
				</Text>
			</View>

			<TouchableOpacity
				style={[s.publishBtn, loading && { opacity: 0.55 }]}
				onPress={handlePublish}
				disabled={loading}
				activeOpacity={0.85}
			>
				{loading ? (
					<ActivityIndicator color={Colors.text.primary} />
				) : (
					<>
						<Ionicons name="rocket-outline" size={20} color={Colors.text.primary} />
						<Text style={s.publishBtnText}>Publish Game</Text>
					</>
				)}
			</TouchableOpacity>
		</View>
	);

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<View style={{ flex: 1, backgroundColor: Colors.background.secondary }}>
			<StatusBar style="dark" />
			<MinimalHeader title="Create Custom Game" />

			{/* Step indicator */}
			<View style={s.stepBar}>
				{STEPS.map((label, i) => (
					<TouchableOpacity
						key={label}
						style={s.stepItem}
						onPress={() => { if (i < step) setStep(i); }}
						disabled={i >= step}
					>
						<View style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]}>
							{i < step
								? <Ionicons name="checkmark" size={12} color="#fff" />
								: <Text style={[s.stepNum, i === step && { color: Colors.text.primary }]}>{i + 1}</Text>
							}
						</View>
						<Text style={[s.stepLabel, i === step && s.stepLabelActive]} numberOfLines={1}>{label}</Text>
					</TouchableOpacity>
				))}
			</View>

			{/* Content */}
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={insets.top + 100}
			>
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={[s.scrollContent, step === 3 && { flexGrow: 1, paddingBottom: 0 }]}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{step === 0 && renderInfo()}
					{step === 1 && renderScenes()}
					{step === 2 && renderRules()}
					{step === 3 && renderPreview()}
					{step === 4 && renderPublish()}
				</ScrollView>

				{/* Navigation bar (hidden on preview step) */}
				{step !== 3 && (
					<View style={[s.navBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm }]}>
						{step > 0 && (
							<TouchableOpacity style={s.backBtn} onPress={() => setStep((p) => p - 1)}>
								<Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
								<Text style={s.backBtnText}>Back</Text>
							</TouchableOpacity>
						)}
						{step < STEPS.length - 1 && (
							<TouchableOpacity
								style={[s.nextBtn, !canProceed && { opacity: 0.4 }]}
								onPress={() => canProceed && setStep((p) => p + 1)}
								disabled={!canProceed}
							>
								<Text style={s.nextBtnText}>{step === STEPS.length - 2 ? "Review & Publish" : "Next"}</Text>
								<Ionicons name="chevron-forward" size={18} color={Colors.text.primary} />
							</TouchableOpacity>
						)}
					</View>
				)}

				{/* Preview step: just a "Back" button */}
				{step === 3 && (
					<View style={[s.navBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm }]}>
						<TouchableOpacity style={s.backBtn} onPress={() => setStep((p) => p - 1)}>
							<Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
							<Text style={s.backBtnText}>Back</Text>
						</TouchableOpacity>
						<TouchableOpacity style={s.nextBtn} onPress={() => setStep((p) => p + 1)}>
							<Text style={s.nextBtnText}>Next</Text>
							<Ionicons name="chevron-forward" size={18} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>
				)}
			</KeyboardAvoidingView>

			{/* ── Scene kind picker modal ─────────────────────────────────────────── */}
			<Modal
				visible={showKindPicker}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setShowKindPicker(false)}
			>
				<SafeAreaView style={{ flex: 1, backgroundColor: Colors.background.secondary }}>
					<View style={s.modalHeader}>
						<Text style={s.modalTitle}>Choose Scene Type</Text>
						<TouchableOpacity onPress={() => setShowKindPicker(false)} style={{ padding: 4 }}>
							<Ionicons name="close" size={22} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>
					<ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40, gap: Spacing.sm }}>
						{SCENE_KIND_OPTIONS.map((sk) => (
							<TouchableOpacity key={sk.kind} style={s.kindCard} onPress={() => addScene(sk.kind)} activeOpacity={0.75}>
								<View style={s.kindIcon}>
									<Ionicons name={sk.icon} size={22} color={Colors.accent} />
								</View>
								<View style={{ flex: 1 }}>
									<Text style={s.kindLabel}>{sk.label}</Text>
									<Text style={s.kindDesc}>{sk.desc}</Text>
								</View>
								<Ionicons name="chevron-forward" size={16} color={Colors.text.inactive} />
							</TouchableOpacity>
						))}
					</ScrollView>
				</SafeAreaView>
			</Modal>

			{/* ── Scene editor modal ──────────────────────────────────────────────── */}
			<Modal
				visible={!!editingScene}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setEditingScene(null)}
			>
				<SafeAreaView style={{ flex: 1, backgroundColor: Colors.background.secondary }}>
					<View style={s.modalHeader}>
						<Text style={s.modalTitle}>
							{editingScene ? SCENE_KIND_LABELS[editingScene.content.kind] : ""}
						</Text>
						<TouchableOpacity onPress={() => setEditingScene(null)} style={{ padding: 4 }}>
							<Ionicons name="close" size={22} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>
					<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
						<ScrollView
							contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120, gap: Spacing.md }}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
						>
							{editingScene && (
								<SceneEditor
									content={editingScene.content}
									onChange={(c) => setEditingScene((prev) => (prev ? { ...prev, content: c } : null))}
								/>
							)}
						</ScrollView>
					</KeyboardAvoidingView>
					<View style={[s.navBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm }]}>
						<TouchableOpacity style={s.nextBtn} onPress={saveEditorScene}>
							<Ionicons name="checkmark" size={18} color={Colors.text.primary} />
							<Text style={s.nextBtnText}>Save Scene</Text>
						</TouchableOpacity>
					</View>
				</SafeAreaView>
			</Modal>
		</View>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
	scrollContent: { padding: Spacing.md, paddingBottom: 40 },

	// Step bar
	stepBar: {
		flexDirection: "row",
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.sm,
		paddingBottom: Spacing.sm,
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
		...Shadows.light,
	},
	stepItem: { flex: 1, alignItems: "center", gap: Spacing.xxs },
	stepDot: {
		width: 24, height: 24, borderRadius: 12,
		backgroundColor: Colors.background.tertiary,
		borderWidth: 1.5, borderColor: Colors.borders.subtle,
		alignItems: "center", justifyContent: "center",
	},
	stepDotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
	stepDotDone: { backgroundColor: Colors.game.correct, borderColor: Colors.game.correct },
	stepNum: { fontSize: 11, fontWeight: Typography.fontWeight.bold, color: Colors.text.secondary },
	stepLabel: { fontSize: 9, color: Colors.text.secondary, textAlign: "center" },
	stepLabelActive: { color: Colors.text.primary, fontWeight: Typography.fontWeight.semiBold },

	// Nav bar
	navBar: {
		flexDirection: "row",
		justifyContent: "flex-end",
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.sm,
		backgroundColor: Colors.background.primary,
		borderTopWidth: 1,
		borderTopColor: Colors.borders.subtle,
		gap: Spacing.sm,
		...Shadows.light,
	},
	backBtn: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		gap: 4,
		marginRight: "auto",
	},
	backBtnText: { fontSize: Typography.fontSize.body, color: Colors.text.secondary, fontWeight: Typography.fontWeight.semiBold },
	nextBtn: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.accent,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		gap: 6,
		...Shadows.medium,
	},
	nextBtnText: { fontSize: Typography.fontSize.body, color: Colors.text.primary, fontWeight: Typography.fontWeight.bold },

	// Step content
	stepContent: { gap: Spacing.md },

	// Scene list
	emptyState: { alignItems: "center", paddingVertical: Spacing.xxl, gap: Spacing.sm },
	emptyTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.secondary },
	emptySub: { fontSize: Typography.fontSize.caption, color: Colors.text.inactive, textAlign: "center", maxWidth: 260 },
	sceneCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.md,
		...Shadows.light,
	},
	sceneRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	sceneBadge: {
		width: 30, height: 30, borderRadius: 15,
		alignItems: "center", justifyContent: "center",
	},
	sceneBadgeText: { fontSize: Typography.fontSize.small, fontWeight: Typography.fontWeight.bold },
	sceneKind: { fontSize: Typography.fontSize.small, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	scenePreview: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 1 },
	iconBtn: { padding: 6 },
	addSceneBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: Colors.accent,
		borderStyle: "dashed",
		gap: Spacing.xs,
		marginTop: Spacing.xs,
	},
	addSceneBtnText: { fontSize: Typography.fontSize.body, color: Colors.accent, fontWeight: Typography.fontWeight.semiBold },

	// Rules step
	sectionNote: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, lineHeight: 20 },
	ruleCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		padding: Spacing.md,
		...Shadows.light,
		gap: Spacing.xs,
	},
	ruleCardTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	ruleCardSub: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.xs },
	toggleLabel: { fontSize: Typography.fontSize.small, color: Colors.text.primary },

	// Publish step
	summaryCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 2,
		borderColor: Colors.accent,
		...Shadows.medium,
		gap: Spacing.xs,
	},
	summaryTitle: { fontSize: Typography.fontSize.h3, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	summarySub: { fontSize: Typography.fontSize.body, color: Colors.text.secondary },
	summaryMeta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.xs },
	metaPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.background.secondary, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.pill },
	metaText: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	infoBox: {
		flexDirection: "row",
		gap: Spacing.sm,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
	},
	infoBoxText: { flex: 1, fontSize: Typography.fontSize.caption, color: Colors.text.secondary, lineHeight: 20 },
	publishBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.sm,
		...Shadows.medium,
	},
	publishBtnText: { fontSize: Typography.fontSize.h3, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },

	// Modals
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
	},
	modalTitle: { fontSize: Typography.fontSize.h3, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	kindCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		gap: Spacing.md,
		...Shadows.light,
	},
	kindIcon: {
		width: 44, height: 44, borderRadius: BorderRadius.md,
		backgroundColor: Colors.accent + "15",
		alignItems: "center", justifyContent: "center",
	},
	kindLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	kindDesc: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
});

// Form component styles (shared across all scene editors)
const fc = StyleSheet.create({
	field: { gap: Spacing.xs },
	label: { fontSize: Typography.fontSize.small, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	input: {
		backgroundColor: Colors.background.primary,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		minHeight: 44,
		marginBottom: Spacing.xs,
	},
	row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
	pill: {
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: BorderRadius.pill,
		borderWidth: 1.5,
		borderColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
	},
	pillActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + "18" },
	pillText: { fontSize: Typography.fontSize.small, color: Colors.text.secondary },
	pillTextActive: { color: Colors.accent, fontWeight: Typography.fontWeight.semiBold },
	radio: {
		width: 22, height: 22, borderRadius: 11,
		borderWidth: 2, borderColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
		alignItems: "center", justifyContent: "center",
	},
	radioActive: { borderColor: Colors.game.correct },
	radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.game.correct },
	addBtn: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		gap: 4,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: Colors.accent,
		borderStyle: "dashed",
		marginTop: Spacing.xs,
	},
	addBtnText: { fontSize: Typography.fontSize.small, color: Colors.accent },
	subCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
		marginBottom: Spacing.xs,
	},
	subCardTitle: { fontSize: Typography.fontSize.small, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
});
