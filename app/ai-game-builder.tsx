/**
 * app/ai-game-builder.tsx
 *
 * AI Game Builder — describe any game in plain language and the AI generates
 * a full CustomPuzzleGame JSON that the existing GamePlayer renders instantly.
 *
 * Phase 1: Generation + local preview only.
 * Phase 2 (later): Publish to Firestore once API key is wired in.
 *
 * ─── TO WIRE UP THE CLAUDE API ────────────────────────────────────────────────
 * Search for "TODO: CLAUDE API" in this file. Replace the stub with a real
 * fetch() call to https://api.anthropic.com/v1/messages using your API key.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BorderRadius,
	Colors,
	Shadows,
	Spacing,
	Typography,
} from "../constants/DesignSystem";
import { GamePlayer } from "../runtime/GamePlayer";
import type { CustomPuzzleGame } from "../config/customPuzzleGame";
import type { GameResult } from "../config/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "ai" | "system";

interface ChatMessage {
	id: string;
	role: Role;
	text: string;
	game?: CustomPuzzleGame;
	loading?: boolean;
}

// ─── Claude API config ────────────────────────────────────────────────────────
// Key lives in .env (gitignored) as EXPO_PUBLIC_CLAUDE_API_KEY
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? "";
const CLAUDE_MODEL   = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are GameBuilderAI for a mobile puzzle app. Output ONLY a raw JSON object — no markdown fences, no explanation, no text before or after. Just the JSON.

━━━ ROOT SCHEMA ━━━
{
  "id": "game_<random7chars>",
  "meta": { "title": "...", "description": "...", "difficulty": 1|2|3, "tags": ["..."], "instructions": ["..."] },
  "variables": [],
  "scenes": [ { "id": "s1", "content": { "kind": "...", ...fields } } ],
  "rules": [ { "id": "r1", "on": "SCENE_COMPLETE", "then": [{ "type": "WIN" }] } ],
  "startSceneId": "s1"
}

CRITICAL: startSceneId MUST equal scenes[0].id. Always include a WIN rule. difficulty: 1=easy 2=medium 3=hard.

━━━ RULE ACTIONS ━━━
{"type":"WIN"} {"type":"LOSE"} {"type":"GO_TO","sceneId":"s2"} {"type":"INC_VAR","variableId":"score","amount":10}

━━━ EXISTING GAMES — DISAMBIGUATION ━━━
The app already has 12 dedicated standalone games that users can create separately:

  WordForm      — type the correct word or answer (text input)
  Riddle        — single multiple-choice question with 2–4 options
  Quick Math    — rapid-fire math questions, type the answer
  Inference     — read a passage, pick the correct inference (multiple choice)
  Word Chain    — connect words where each starts with the last letter of the previous
  Trivia        — multiple-choice quiz with several questions
  CodeBreaker   — guess a hidden colour/symbol sequence with exact/present feedback
  Sequencing    — drag items into the correct order
  Sudoku        — fill a number grid so every row, col, and box has unique digits
  Futoshiki     — number grid with greater-than/less-than inequality constraints
  TrailFinder   — tap numbered cells on a grid in order to trace a path (1→2→3…)
  Maze          — tap numbered cells on a grid in order to trace a path (same mechanic as TrailFinder, different presentation)

When the user's request could refer to one of these existing games, respond with a SHORT
plain-text clarifying question — NOT JSON. Ask whether they mean the existing game or
something genuinely new. If they confirm they want the existing game, tell them to go to
Create > [Game Name] in the app. If they want something different, ask for specifics,
then generate the JSON once you understand.

Do NOT blindly block words — use judgement. Only ask when there is genuine ambiguity.

Examples of how to respond:
- User: "make me a maze"
  → "The app already has a Maze game where players tap numbered cells in sequence to
     trace a path through a grid. Did you mean that, or something different — like a
     wall-navigation maze where you move a character from start to exit? If it's
     something new, describe the theme and what the player does."
- User: "I want trivia questions about movies"
  → "There's already a Trivia game in the app for quiz-style questions. Were you thinking
     of that, or something different — like a Connections puzzle grouped by movie themes?"
- User: "create a sudoku"
  → "Sudoku is already available as a standalone game — you can make one from the Create
     screen. Were you thinking of a different number puzzle, like a Nonogram or Logic Grid?"
- User: "make a wall navigation maze through a cornfield"
  → Generate JSON immediately using MAZE kind — clearly not the existing Maze game.
- User: "make a haunted house maze where you find the exit"
  → Generate JSON immediately using MAZE kind — clearly a wall-navigation maze, not the existing game.

━━━ AVAILABLE SCENE KINDS ━━━
Use only these 16 kinds. Do NOT use MCQ, MCQ_MULTI, TEXT_INPUT, TEXT_INPUT_MULTI,
SEQUENCE, CODEBREAKER, NUMBER_GRID, or PATH — those are standalone games already in the app.
MAZE is allowed — it is wall-navigation (start → exit), which is different from the existing
Maze/TrailFinder games (which are numbered-cell path tracing).

INFO  { kind:"INFO", text:"...", subtext?:"...", continueLabel?:"Continue" }

WORD_GUESS (Hangman)  { kind:"WORD_GUESS", word:"UPPERCASE", hint?"Category hint", maxWrongGuesses:6 }

WORDLE  { kind:"WORDLE", word:"CRANE", wordLength:5, maxAttempts:6, hint? }
  ⚠ word.length MUST equal wordLength. word MUST be uppercase.

MEMORY  { kind:"MEMORY", pairs:[{id:"p1a",value:"🐶",matchId:"dog"},{id:"p1b",value:"🐶",matchId:"dog"},...], cols:4 }
  ⚠ each matchId appears exactly twice. Total cards = pairs.length, must be even.

CATEGORY (Connections)  { kind:"CATEGORY", items:[{id:"i1",label:"Cat",groupId:"g1"},...], groups:[{id:"g1",label:"Mammals",color?:"#3B82F6"},...], maxWrongGuesses?:4 }
  ⚠ every item's groupId must match a group id. Best with 4 groups x 4 items = 16 items total.

CROSSWORD  { kind:"CROSSWORD", rows:5, cols:5, cells:[{row:0,col:0,black:false,number:1,answer:"C"},{row:0,col:1,black:false,answer:"A"},...,{row:1,col:0,black:true}], clues:{across:[{number:1,clue:"...",answer:"CAT",row:0,col:0}],down:[{number:1,clue:"...",answer:"CAR",row:0,col:0}]}, hint? }
  ⚠ cells.length = rows*cols. answer = one uppercase letter. black:true cells have no answer. Keep grid 5x5 or smaller.

WORD_SEARCH  { kind:"WORD_SEARCH", rows:6, cols:6, grid:[["C","A","T","X","Y","Z"],["D","O","G","A","B","C"],...], words:["CAT","DOG"], solutions:[{word:"CAT",cells:[{row:0,col:0},{row:0,col:1},{row:0,col:2}]},...], hint? }
  ⚠ grid must be rows arrays each containing cols uppercase letters. Words MUST exist in the grid at their solution cells.

SPELLING_BEE  { kind:"SPELLING_BEE", centerLetter:"A", outerLetters:["B","C","D","E","F","G"], validWords:["BEAD","CAFE",...], wordsToWin:5, hint? }
  ⚠ outerLetters.length = 6 exactly. centerLetter NOT in outerLetters. Every validWord must use only the 7 letters and contain centerLetter.

LETTER_GRID (Boggle/Strands)  { kind:"LETTER_GRID", rows:4, cols:4, grid:[["C","A","T","S"],["D","O","G","E"],...], words:["CATS","DOG"], solutions:[{word:"CATS",cells:[{row:0,col:0},{row:0,col:1},{row:0,col:2},{row:0,col:3}]},...], hint? }
  ⚠ solution cells must be adjacent (incl. diagonal). Words must exist in grid at those cells.

NONOGRAM (Picross)  { kind:"NONOGRAM", rows:5, cols:5, rowClues:[[2],[1,1],[3],[1],[2]], colClues:[[1],[2],[2],[1],[1]], solution:[true,true,false,false,false,...], theme?, hint? }
  ⚠ solution.length = rows*cols (row-major). Clues must exactly match the solution.

FLOW (Flow Free)  { kind:"FLOW", rows:5, cols:5, dots:[{id:"red",color:"#EF4444",row:0,col:0},{id:"red",color:"#EF4444",row:4,col:4},{id:"blue",color:"#3B82F6",row:0,col:4},{id:"blue",color:"#3B82F6",row:4,col:0}], solution:[{id:"red",path:[{row:0,col:0},{row:1,col:0},...,{row:4,col:4}]},{id:"blue",path:[...]}], theme?, hint? }
  ⚠ each color id appears exactly twice in dots[]. All grid cells must be covered by paths.

SLIDING_PUZZLE  { kind:"SLIDING_PUZZLE", size:3, initial:[1,2,3,4,5,6,7,8,0], theme?, hint? }
  ⚠ size=3 = 9 tiles. initial.length=size*size. 0=empty. Keep initial close to solved. Solved state: [1,2,3,4,5,6,7,8,0].

LOGIC_GRID  { kind:"LOGIC_GRID", categories:[{id:"people",label:"People",items:["Alice","Bob","Carol"]},{id:"pets",label:"Pets",items:["Cat","Dog","Fish"]}], clues:["Alice does not own the Cat","Bob owns the Dog"], solution:[{"people":"Alice","pets":"Fish"},{"people":"Bob","pets":"Dog"},{"people":"Carol","pets":"Cat"}], hint? }
  ⚠ solution.length = number of items per category.

MINESWEEPER  { kind:"MINESWEEPER", rows:8, cols:8, mines:[{row:0,col:3},{row:2,col:5},...], hint? }
  ⚠ place 8-12 mines. No duplicate positions. All within bounds.

MERGE_GRID (2048)  { kind:"MERGE_GRID", size:4, initial:[2,0,2,0,0,4,0,2,2,0,0,4,0,2,4,0], target:64, theme?, hint? }
  ⚠ initial.length=size*size. At least 4 non-zero tiles. target must be reachable.

MAZE (wall navigation)  { kind:"MAZE", rows:5, cols:5, cells:[{row:0,col:0,walls:{top:true,left:true,bottom:false,right:false}},...], start:{row:0,col:0}, end:{row:4,col:4}, theme?, hint? }
  ⚠ cells.length=rows*cols. Outer border cells must have walls:true on their outer sides.
  ⚠ Wall consistency: if cell A has right:false, its right neighbour must have left:false.
  ⚠ A traversable path from start to end must exist. This is NOT the numbered-cell path game.

Board themes (optional on MAZE, NONOGRAM, FLOW, SLIDING_PUZZLE, MERGE_GRID):
"cornfield"|"dungeon"|"space"|"underwater"|"forest"|"neon"|"minimal"

━━━ MULTI-SCENE RULE PATTERN ━━━
Scene s1 → s2 → WIN:
  {"id":"r1","on":"SCENE_COMPLETE","sceneId":"s1","then":[{"type":"GO_TO","sceneId":"s2"}]},
  {"id":"r2","on":"SCENE_COMPLETE","sceneId":"s2","then":[{"type":"WIN"}]}

━━━ EXAMPLES ━━━

Example 1 — WORDLE:
{"id":"game_wd1","meta":{"title":"Animal Wordle","difficulty":1},"variables":[],"scenes":[{"id":"s1","content":{"kind":"WORDLE","word":"CRANE","wordLength":5,"maxAttempts":6,"hint":"A tall wading bird"}}],"rules":[{"id":"r1","on":"SCENE_COMPLETE","then":[{"type":"WIN"}]}],"startSceneId":"s1"}

Example 2 — CATEGORY (Connections):
{"id":"game_cat1","meta":{"title":"Animal Kingdom","description":"Sort animals into their groups","difficulty":2},"variables":[],"scenes":[{"id":"s1","content":{"kind":"CATEGORY","maxWrongGuesses":4,"groups":[{"id":"g1","label":"Big Cats","color":"#EF4444"},{"id":"g2","label":"Birds of Prey","color":"#3B82F6"},{"id":"g3","label":"Fish","color":"#10B981"},{"id":"g4","label":"Reptiles","color":"#8B5CF6"}],"items":[{"id":"i1","label":"Lion","groupId":"g1"},{"id":"i2","label":"Tiger","groupId":"g1"},{"id":"i3","label":"Leopard","groupId":"g1"},{"id":"i4","label":"Cheetah","groupId":"g1"},{"id":"i5","label":"Eagle","groupId":"g2"},{"id":"i6","label":"Hawk","groupId":"g2"},{"id":"i7","label":"Falcon","groupId":"g2"},{"id":"i8","label":"Owl","groupId":"g2"},{"id":"i9","label":"Salmon","groupId":"g3"},{"id":"i10","label":"Tuna","groupId":"g3"},{"id":"i11","label":"Cod","groupId":"g3"},{"id":"i12","label":"Bass","groupId":"g3"},{"id":"i13","label":"Iguana","groupId":"g4"},{"id":"i14","label":"Gecko","groupId":"g4"},{"id":"i15","label":"Chameleon","groupId":"g4"},{"id":"i16","label":"Skink","groupId":"g4"}]}}],"rules":[{"id":"r1","on":"SCENE_COMPLETE","then":[{"type":"WIN"}]}],"startSceneId":"s1"}

Example 3 — MEMORY (emoji pairs):
{"id":"game_mem1","meta":{"title":"Emoji Match","difficulty":1},"variables":[],"scenes":[{"id":"s1","content":{"kind":"MEMORY","cols":4,"pairs":[{"id":"p1a","value":"🐶","matchId":"dog"},{"id":"p1b","value":"🐶","matchId":"dog"},{"id":"p2a","value":"🐱","matchId":"cat"},{"id":"p2b","value":"🐱","matchId":"cat"},{"id":"p3a","value":"🐭","matchId":"mouse"},{"id":"p3b","value":"🐭","matchId":"mouse"},{"id":"p4a","value":"🐹","matchId":"hamster"},{"id":"p4b","value":"🐹","matchId":"hamster"},{"id":"p5a","value":"🐰","matchId":"rabbit"},{"id":"p5b","value":"🐰","matchId":"rabbit"},{"id":"p6a","value":"🦊","matchId":"fox"},{"id":"p6b","value":"🦊","matchId":"fox"},{"id":"p7a","value":"🐻","matchId":"bear"},{"id":"p7b","value":"🐻","matchId":"bear"},{"id":"p8a","value":"🐼","matchId":"panda"},{"id":"p8b","value":"🐼","matchId":"panda"}]}}],"rules":[{"id":"r1","on":"SCENE_COMPLETE","then":[{"type":"WIN"}]}],"startSceneId":"s1"}

Output JSON when you have enough information to build a game.
Output plain conversational text when asking a clarifying question.
Never mix both in one response. No markdown fences around JSON.`;

// ─── Quick-prompt chips ───────────────────────────────────────────────────────
// Each chip pre-fills the input with a concrete starter description.
// Users can edit the text before sending or just hit Send immediately.

const QUICK_PROMPTS: Array<{ label: string; emoji: string; prompt: string }> = [
	{ label: "Wordle",        emoji: "🟩", prompt: "Create a Wordle game with a 5-letter word about animals" },
	{ label: "Crossword",     emoji: "✏️",  prompt: "Build a small 5×5 crossword puzzle about countries" },
	{ label: "Word Search",   emoji: "🔍", prompt: "Create a word search grid with 6 ocean animals hidden inside" },
	{ label: "Spelling Bee",  emoji: "🐝", prompt: "Make a Spelling Bee puzzle where S is the center letter" },
	{ label: "Nonogram",      emoji: "🖼️",  prompt: "Create a 5×5 Nonogram (Picross) puzzle that draws a heart shape" },
	{ label: "Memory",        emoji: "🃏", prompt: "Build a memory card matching game with 8 emoji pairs" },
	{ label: "Connections",   emoji: "🔗", prompt: "Create a Connections puzzle grouping 12 animals by habitat" },
	{ label: "Flow Free",     emoji: "〰️", prompt: "Make a Flow Free puzzle on a 5×5 grid with 4 color pairs" },
	{ label: "Minesweeper",   emoji: "💣", prompt: "Create a Minesweeper game on an 8×8 grid with 10 mines" },
	{ label: "Logic Grid",    emoji: "🧩", prompt: "Build a logic grid deduction puzzle with 3 people and 3 pets" },
	{ label: "2048",          emoji: "🔀", prompt: "Make a 2048-style merge grid puzzle with a target of 64" },
	{ label: "Hangman",       emoji: "🎯", prompt: "Create a word-guess hangman game with a vegetables theme" },
	{ label: "Letter Grid",   emoji: "🔠", prompt: "Build a Boggle-style letter grid with 6 hidden words about space" },
	{ label: "Sliding Puzzle",emoji: "🧩", prompt: "Make a 3×3 sliding tile puzzle with a dungeon theme" },
	{ label: "Wall Maze",     emoji: "🌽", prompt: "Build a wall-navigation maze through a cornfield from start to exit" },
];

// ─── Claude API ───────────────────────────────────────────────────────────────
// Returns raw text — may be a JSON game or a plain-text clarifying question.

async function getAIResponse(
	userMessage: string,
	conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": CLAUDE_API_KEY,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: CLAUDE_MODEL,
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			messages: [
				...conversationHistory,
				{ role: "user", content: userMessage },
			],
		}),
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		throw new Error((err as any)?.error?.message ?? `API error ${response.status}`);
	}

	const data = await response.json();
	return data.content[0].text as string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIGameBuilder() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const listRef = useRef<FlatList>(null);
	const inputRef = useRef<TextInput>(null);

	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: "welcome",
			role: "ai",
			text: "Describe the game you want to make. Tell me the theme, what the player has to do, and how hard it should be. I'll build it for you.",
		},
	]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [previewGame, setPreviewGame] = useState<CustomPuzzleGame | null>(null);
	const [conversationHistory, setConversationHistory] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);

	const uid = () => Math.random().toString(36).slice(2, 9);

	const scrollToBottom = () => {
		setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
	};

	const handleSend = async () => {
		const text = input.trim();
		if (!text || loading) return;

		setInput("");
		setLoading(true);

		const userMsg: ChatMessage = { id: uid(), role: "user", text };
		const loadingMsg: ChatMessage = { id: uid(), role: "ai", text: "", loading: true };

		setMessages((prev) => [...prev, userMsg, loadingMsg]);
		scrollToBottom();

		const newHistory: Array<{ role: "user" | "assistant"; content: string }> = [
			...conversationHistory,
			{ role: "user", content: text },
		];

		try {
			const rawText = await getAIResponse(text, newHistory);
			const cleaned = rawText
				.replace(/^```(?:json)?\s*/i, "")
				.replace(/\s*```$/, "")
				.trim();

			let game: CustomPuzzleGame | undefined;
			let aiResponse: string;

			try {
				// Try to parse as a game — Claude returns JSON when it has enough info
				game = JSON.parse(cleaned) as CustomPuzzleGame;
				aiResponse =
					`Here's your game: **${game.meta.title}**\n` +
					`${game.scenes.length} scene${game.scenes.length !== 1 ? "s" : ""} · ` +
					`${["Easy", "Medium", "Hard"][game.meta.difficulty - 1]} difficulty` +
					(game.meta.description ? `\n\n${game.meta.description}` : "");
			} catch {
				// Claude returned a clarifying question or plain text — show as chat bubble
				game = undefined;
				aiResponse = rawText;
			}

			setConversationHistory([
				...newHistory,
				{ role: "assistant", content: rawText },
			]);

			setMessages((prev) =>
				prev.map((m) =>
					m.loading
						? { ...m, loading: false, text: aiResponse, game }
						: m
				)
			);
		} catch (err) {
			setMessages((prev) =>
				prev.map((m) =>
					m.loading
						? {
								...m,
								loading: false,
								text: "Something went wrong. Please try again.",
							}
						: m
				)
			);
		} finally {
			setLoading(false);
			scrollToBottom();
		}
	};

	// ── Preview ───────────────────────────────────────────────────────────────

	if (previewGame) {
		return (
			<SafeAreaView style={s.full}>
				<View style={s.previewHeader}>
					<TouchableOpacity onPress={() => setPreviewGame(null)} style={s.backBtn}>
						<Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
						<Text style={s.backText}>Back to Chat</Text>
					</TouchableOpacity>
					<Text style={s.previewTitle} numberOfLines={1}>{previewGame.meta.title}</Text>
				</View>
				<GamePlayer
					game={previewGame}
					onComplete={(result: GameResult) => {
						setPreviewGame(null);
						Alert.alert(
							result.completed ? "Completed!" : "Game Over",
							result.completed
								? `You finished in ${result.timeTaken}s`
								: "Better luck next time!",
							[{ text: "OK" }]
						);
					}}
				/>
			</SafeAreaView>
		);
	}

	// ── Chat ──────────────────────────────────────────────────────────────────

	return (
		<SafeAreaView style={s.full}>
			{/* Header */}
			<View style={s.header}>
				<TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
					<Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<View style={s.headerTitle}>
					<Text style={s.headerTitleText}>AI Game Builder</Text>
					<Text style={s.headerSubtitle}>Describe any game — I'll build it</Text>
				</View>
				<View style={{ width: 40 }} />
			</View>

			<KeyboardAvoidingView
				style={s.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={insets.top + 60}
			>
				{/* Messages */}
				<FlatList
					ref={listRef}
					data={messages}
					keyExtractor={(m) => m.id}
					contentContainerStyle={s.messageList}
					onContentSizeChange={scrollToBottom}
					renderItem={({ item: msg }) => (
						<View
							style={[
								s.bubble,
								msg.role === "user" ? s.bubbleUser : s.bubbleAI,
							]}
						>
							{msg.loading ? (
								<ActivityIndicator color={Colors.text.secondary} />
							) : (
								<>
									<Text
										style={[
											s.bubbleText,
											msg.role === "user" && s.bubbleTextUser,
										]}
									>
										{msg.text}
									</Text>
									{msg.game && (
										<GameCard
											game={msg.game}
											onPreview={() => setPreviewGame(msg.game!)}
											onRegenerate={() => {
												const lastUserMsg = [...messages]
													.reverse()
													.find((m) => m.role === "user");
												if (lastUserMsg) {
													setInput(lastUserMsg.text);
													inputRef.current?.focus();
												}
											}}
										/>
									)}
								</>
							)}
						</View>
					)}
				/>

				{/* Quick-prompt chips */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={s.chipRow}
					contentContainerStyle={s.chipRowContent}
					keyboardShouldPersistTaps="handled"
				>
					{QUICK_PROMPTS.map((item) => (
						<TouchableOpacity
							key={item.label}
							style={s.chip}
							onPress={() => setInput(item.prompt)}
							activeOpacity={0.7}
						>
							<Text style={s.chipEmoji}>{item.emoji}</Text>
							<Text style={s.chipLabel}>{item.label}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>

				{/* Input bar */}
				<View style={[s.inputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
					<TextInput
						ref={inputRef}
						style={s.input}
						value={input}
						onChangeText={setInput}
						placeholder="Describe your game..."
						placeholderTextColor={Colors.text.inactive}
						multiline
						maxLength={500}
						onSubmitEditing={handleSend}
						returnKeyType="send"
					/>
					<TouchableOpacity
						style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
						onPress={handleSend}
						disabled={!input.trim() || loading}
					>
						{loading ? (
							<ActivityIndicator color={Colors.text.primary} size="small" />
						) : (
							<Ionicons name="send" size={18} color={Colors.text.primary} />
						)}
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

// ─── Game Card ────────────────────────────────────────────────────────────────

function GameCard({
	game,
	onPreview,
	onRegenerate,
}: {
	game: CustomPuzzleGame;
	onPreview: () => void;
	onRegenerate: () => void;
}) {
	const diffLabel = ["Easy", "Medium", "Hard"][game.meta.difficulty - 1] ?? "Medium";
	const sceneCount = game.scenes.length;
	const kinds = [...new Set(game.scenes.map((s) => s.content.kind))];

	return (
		<View style={s.card}>
			<View style={s.cardHeader}>
				<Ionicons name="sparkles" size={16} color={Colors.accent} />
				<Text style={s.cardTitle} numberOfLines={1}>{game.meta.title}</Text>
			</View>
			<Text style={s.cardMeta}>
				{sceneCount} scene{sceneCount !== 1 ? "s" : ""} · {diffLabel}
			</Text>
			<Text style={s.cardKinds} numberOfLines={1}>
				{kinds.join(" · ")}
			</Text>
			<View style={s.cardActions}>
				<TouchableOpacity style={s.cardPreviewBtn} onPress={onPreview}>
					<Ionicons name="play" size={14} color={Colors.text.primary} />
					<Text style={s.cardPreviewText}>Preview</Text>
				</TouchableOpacity>
				<TouchableOpacity style={s.cardRegenBtn} onPress={onRegenerate}>
					<Ionicons name="refresh" size={14} color={Colors.text.secondary} />
					<Text style={s.cardRegenText}>Regenerate</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
	full: { flex: 1, backgroundColor: Colors.background.primary },
	flex: { flex: 1 },

	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
	},
	backBtn: { flexDirection: "row", alignItems: "center", width: 40 },
	backText: { fontSize: Typography.fontSize.body, color: Colors.text.primary, marginLeft: 2 },
	headerTitle: { flex: 1, alignItems: "center" },
	headerTitleText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	headerSubtitle: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		marginTop: 2,
	},

	messageList: { padding: Spacing.md, gap: Spacing.sm },
	bubble: {
		maxWidth: "85%",
		borderRadius: BorderRadius.lg,
		padding: Spacing.md,
		...Shadows.light,
	},
	bubbleAI: {
		alignSelf: "flex-start",
		backgroundColor: Colors.background.secondary,
		borderBottomLeftRadius: 4,
	},
	bubbleUser: {
		alignSelf: "flex-end",
		backgroundColor: Colors.accent,
		borderBottomRightRadius: 4,
	},
	bubbleText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: 22,
	},
	bubbleTextUser: { color: Colors.text.primary },

	card: {
		marginTop: Spacing.sm,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
		...Shadows.light,
	},
	cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
	cardTitle: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	cardMeta: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		marginBottom: 2,
	},
	cardKinds: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.inactive,
		marginBottom: Spacing.sm,
	},
	cardActions: { flexDirection: "row", gap: Spacing.sm },
	cardPreviewBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.sm,
		paddingVertical: Spacing.sm,
		...Shadows.light,
	},
	cardPreviewText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	cardRegenBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.sm,
		paddingVertical: Spacing.sm,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
	},
	cardRegenText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.secondary,
	},

	chipRow: {
		borderTopWidth: 1,
		borderTopColor: Colors.borders.subtle,
		backgroundColor: Colors.background.primary,
		flexGrow: 0,
	},
	chipRowContent: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		gap: Spacing.xs,
		flexDirection: "row",
		alignItems: "center",
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.pill,
		paddingVertical: 6,
		paddingHorizontal: Spacing.sm,
		borderWidth: 1,
		borderColor: Colors.borders.subtle,
	},
	chipEmoji: {
		fontSize: 13,
	},
	chipLabel: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},

	inputBar: {
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.sm,
		backgroundColor: Colors.background.primary,
		gap: Spacing.sm,
	},
	input: {
		flex: 1,
		minHeight: 44,
		maxHeight: 120,
		borderWidth: 1.5,
		borderColor: Colors.borders.primary,
		borderRadius: BorderRadius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		backgroundColor: Colors.background.secondary,
	},
	sendBtn: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: Colors.accent,
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},
	sendBtnDisabled: { opacity: 0.4 },

	previewHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borders.subtle,
	},
	previewTitle: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		marginRight: 40,
	},
});
