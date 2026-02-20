/**
 * Create your own — full GameDefinition form with modals and preview.
 * Exposes: title, description, board, timer & score, rules, instructions (how to play), content, difficulty.
 */

import React, { useState, useCallback, useRef } from "react";
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
	TouchableWithoutFeedback,
	Dimensions,
	Switch,
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
import type { GameDefinition, BoardDefinition, Rule, RuntimeEventType } from "../../config/gameDefinition";
import { GamePlayer } from "../../runtime/GamePlayer";
import MinimalHeader from "../../components/MinimalHeader";

type Difficulty = "easy" | "medium" | "hard";
type BoardKind = "none" | "grid" | "freeform" | "list";

const DEFAULT_TIMER_SECONDS = 60;
const DEFAULT_CELL_SIZE = 56;
const TOTAL_STEPS = 8;
const TAGS = ["Word", "Math", "Logic", "Memory", "Pattern", "Speed", "Deduction", "Visual"];
const PLAY_TIME_OPTIONS = [1, 3, 5, 10, 15];

const OBJECT_TYPES: Array<{ id: string; title: string; desc: string }> = [
	{ id: "tile", title: "Tile", desc: "Grid cell object" },
	{ id: "token", title: "Token", desc: "Movable piece" },
	{ id: "card", title: "Card", desc: "Flip to reveal" },
	{ id: "bubble", title: "Bubble", desc: "Tap target" },
	{ id: "text", title: "Text Label", desc: "Static text" },
	{ id: "input", title: "Input Field", desc: "Player input" },
	{ id: "button", title: "Button", desc: "Action button" },
	{ id: "choice", title: "Choice", desc: "MCQ option" },
];

const RULE_TRIGGERS = ["GAME_START", "TIMER_TICK", "OBJECT_TAP", "OBJECT_DROP", "INPUT_SUBMIT", "ROUND_START", "ROUND_END", "SCORE_CHANGE"] as const;

const WIN_CONDITION_TYPES: Array<{ id: string; label: string }> = [
	{ id: "score", label: "Reach score >= X" },
	{ id: "targets", label: "Complete all targets" },
	{ id: "solve_board", label: "Solve board (all correct)" },
	{ id: "survive_timer", label: "Survive until timer ends" },
	{ id: "rounds", label: "Complete N rounds" },
	{ id: "streak", label: "Achieve streak >= N" },
];
const LOSE_CONDITION_TYPES: Array<{ id: string; label: string }> = [
	{ id: "time_out", label: "Time runs out" },
	{ id: "lives_zero", label: "Lives reach 0" },
	{ id: "mistakes", label: "Mistakes >= N" },
	{ id: "invalid_move", label: "Invalid move ends game" },
];

const CONTENT_PACK_TYPES: Array<{ id: string; title: string; subtitle: string; icon: string }> = [
	{ id: "wordlist", title: "Word List", subtitle: "Words for puzzles", icon: "document-text" },
	{ id: "questionbank", title: "Question Bank", subtitle: "Trivia/riddles", icon: "help-circle" },
	{ id: "numberset", title: "Number Set", subtitle: "Number ranges", icon: "pricetag" },
	{ id: "patternsequence", title: "Pattern Sequence", subtitle: "Memory patterns", icon: "bulb" },
];

const PUBLISH_REQUIRED_LABELS = ["Metadata", "Board", "Objects", "Interactions", "Behavior", "Rules", "Conditions", "Content"];

const CreateCustomPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	// Core
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [prompt, setPrompt] = useState("");
	const [choices, setChoices] = useState<string[]>(["", ""]);
	const [correctIndex, setCorrectIndex] = useState(0);
	const [difficulty, setDifficulty] = useState<Difficulty>("easy");

	// Board
	const [boardKind, setBoardKind] = useState<BoardKind>("none");
	const [gridRows, setGridRows] = useState(3);
	const [gridCols, setGridCols] = useState(3);
	const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE);
	const [freeformWidth, setFreeformWidth] = useState(800);
	const [freeformHeight, setFreeformHeight] = useState(600);
	const [listSlots, setListSlots] = useState(5);
	const [listDragReorder, setListDragReorder] = useState(false);
	const [gridAdjacency, setGridAdjacency] = useState<"4" | "8">("4");
	const [freeformCollisionMode, setFreeformCollisionMode] = useState<"none" | "basic">("basic");
	const [listOrientation, setListOrientation] = useState<"vertical" | "horizontal">("vertical");

	// Timer & score
	const [timerEnabled, setTimerEnabled] = useState(false);
	const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);
	const [scoreStart, setScoreStart] = useState(0);
	const [scoreTarget, setScoreTarget] = useState<number | undefined>(undefined);

	// Instructions (how to play)
	const [instructionLines, setInstructionLines] = useState<string[]>(["", ""]);
	const [instructionExample, setInstructionExample] = useState("");

	// New Game 8-step flow
	const [currentStep, setCurrentStep] = useState(0);
	const [showStepListModal, setShowStepListModal] = useState(false);
	const [playTimeMinutes, setPlayTimeMinutes] = useState(1);
	const playTimeTrackWidth = useRef(0);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [visibility, setVisibility] = useState<"public" | "unlisted" | "draft">("draft");
	const [useChoicesAsObjects, setUseChoicesAsObjects] = useState(true);
	const [selectedObjectTypes, setSelectedObjectTypes] = useState<string[]>([]);
	const [yourObjects, setYourObjects] = useState<Array<{ id: string; type: string; name: string }>>([]);
	const [interactionModes, setInteractionModes] = useState<string[]>([]);
	const [movementPreset, setMovementPreset] = useState<"stationary" | "drift" | "bounce" | "fall">("stationary");
	type SpawnRule = { id: string; trigger: string; count: number; placement: string };
	const [spawnRules, setSpawnRules] = useState<SpawnRule[]>([]);
	type EngineRule = { id: string; trigger: string };
	const [engineRules, setEngineRules] = useState<EngineRule[]>([]);
	const [showTriggerPickerForRuleId, setShowTriggerPickerForRuleId] = useState<string | null>(null);
	type WinLoseCondition = { id: string; type: string };
	const [winConditions, setWinConditions] = useState<WinLoseCondition[]>([]);
	const [loseConditions, setLoseConditions] = useState<WinLoseCondition[]>([]);
	type ContentPack = { id: string; type: string; name: string };
	const [contentPacks, setContentPacks] = useState<ContentPack[]>([]);

	// Modals
	const [showDescriptionModal, setShowDescriptionModal] = useState(false);
	const [showBoardModal, setShowBoardModal] = useState(false);
	const [showTimerScoreModal, setShowTimerScoreModal] = useState(false);
	const [showRulesModal, setShowRulesModal] = useState(false);
	const [showInstructionsModal, setShowInstructionsModal] = useState(false);
	const [showObjectsModal, setShowObjectsModal] = useState(false);
	const [showWinLoseModal, setShowWinLoseModal] = useState(false);
	const [showSpawnRulesModal, setShowSpawnRulesModal] = useState(false);
	const [showContentPackModal, setShowContentPackModal] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [previewScreenMode, setPreviewScreenMode] = useState<"menu" | "play">("menu");
	const [showPublishSettings, setShowPublishSettings] = useState(false);
	const [allowRemixes, setAllowRemixes] = useState(true);
	const [allowComments, setAllowComments] = useState(true);

	const [loading, setLoading] = useState(false);

	const addChoice = () => {
		if (choices.length < 4) setChoices((prev) => [...prev, ""]);
	};
	const removeChoice = (index: number) => {
		if (choices.length <= 2) return;
		setChoices((prev) => prev.filter((_, i) => i !== index));
		if (correctIndex >= choices.length - 1) setCorrectIndex(Math.max(0, correctIndex - 1));
	};
	const setChoice = (index: number, value: string) => {
		setChoices((prev) => {
			const next = [...prev];
			next[index] = value;
			return next;
		});
	};

	const addInstructionLine = () => {
		setInstructionLines((prev) => [...prev, ""]);
	};

	const addSelectedObjectTypes = () => {
		if (selectedObjectTypes.length === 0) return;
		const counts: Record<string, number> = {};
		yourObjects.forEach((o) => {
			counts[o.type] = (counts[o.type] ?? 0) + 1;
		});
		const next: Array<{ id: string; type: string; name: string }> = [];
		selectedObjectTypes.forEach((typeId) => {
			const n = (counts[typeId] ?? 0) + 1;
			counts[typeId] = n;
			const title = OBJECT_TYPES.find((t) => t.id === typeId)?.title ?? typeId;
			next.push({ id: `${typeId}_${n}`, type: typeId, name: `${typeId}_${n}` });
		});
		setYourObjects((prev) => [...prev, ...next]);
		setSelectedObjectTypes([]);
	};

	const removeYourObject = (id: string) => {
		setYourObjects((prev) => prev.filter((o) => o.id !== id));
	};
	const addSpawnRule = () => {
		setSpawnRules((prev) => [...prev, { id: `rule_${Date.now()}`, trigger: "on_start", count: 1, placement: "random location" }]);
		setShowSpawnRulesModal(true);
	};
	const removeSpawnRule = (id: string) => {
		setSpawnRules((prev) => prev.filter((r) => r.id !== id));
	};
	const addEngineRule = () => {
		setEngineRules((prev) => [...prev, { id: `engine_${Date.now()}`, trigger: "GAME_START" }]);
	};
	const removeEngineRule = (id: string) => {
		setEngineRules((prev) => prev.filter((r) => r.id !== id));
		if (showTriggerPickerForRuleId === id) setShowTriggerPickerForRuleId(null);
	};
	const setEngineRuleTrigger = (id: string, trigger: string) => {
		setEngineRules((prev) => prev.map((r) => (r.id === id ? { ...r, trigger } : r)));
		setShowTriggerPickerForRuleId(null);
	};
	const addContentPack = (typeId: string) => {
		const typeLabel = CONTENT_PACK_TYPES.find((t) => t.id === typeId)?.title ?? typeId;
		const base = typeLabel.replace(/\s+/g, "");
		setContentPacks((prev) => {
			const n = prev.filter((p) => p.type === typeId).length + 1;
			return [...prev, { id: `pack_${Date.now()}`, type: typeId, name: `${base}_${n}` }];
		});
	};
	const removeContentPack = (id: string) => {
		setContentPacks((prev) => prev.filter((p) => p.id !== id));
	};
	const addWinCondition = (type: string) => {
		setWinConditions((prev) => [...prev, { id: `win_${Date.now()}`, type }]);
	};
	const removeWinCondition = (id: string) => {
		setWinConditions((prev) => prev.filter((c) => c.id !== id));
	};
	const addLoseCondition = (type: string) => {
		setLoseConditions((prev) => [...prev, { id: `lose_${Date.now()}`, type }]);
	};
	const removeLoseCondition = (id: string) => {
		setLoseConditions((prev) => prev.filter((c) => c.id !== id));
	};
	const removeInstructionLine = (index: number) => {
		if (instructionLines.length <= 1) return;
		setInstructionLines((prev) => prev.filter((_, i) => i !== index));
	};
	const setInstructionLine = (index: number, value: string) => {
		setInstructionLines((prev) => {
			const next = [...prev];
			next[index] = value;
			return next;
		});
	};

	const stepCompleted = [
		!!(title.trim() && description.trim() && instructionLines.some((l) => l.trim())),
		boardKind !== "none" || !!prompt.trim(),
		useChoicesAsObjects || boardKind === "none" || yourObjects.length > 0,
		interactionModes.length >= 1,
		true, // Behavior
		true, // Rules
		winConditions.length >= 1, // Win/Lose: at least one win condition
		!!(prompt.trim() && choices.filter((c) => c.trim()).length >= 2),
	];
	const completedCount = stepCompleted.filter(Boolean).length;

	const buildBoard = (): BoardDefinition => {
		if (boardKind === "grid") {
			return { kind: "grid", rows: gridRows, cols: gridCols, cellSize, adjacency: gridAdjacency };
		}
		if (boardKind === "freeform") {
			return { kind: "freeform", width: freeformWidth, height: freeformHeight, collisionMode: freeformCollisionMode };
		}
		if (boardKind === "list") {
			return { kind: "list", numSlots: listSlots, dragReorder: listDragReorder, orientation: listOrientation };
		}
		return { kind: "none" };
	};

	const buildDefinition = useCallback((): GameDefinition => {
		const choiceList = choices
			.filter((c) => c.trim())
			.map((label, i) => ({ id: `choice_${i}`, label: label.trim() }));
		const correctId = choiceList[correctIndex]?.id ?? choiceList[0]?.id ?? "choice_0";

		const instructions =
			instructionLines.filter((l) => l.trim()).length > 0
				? {
						instructions: instructionLines.map((l) => l.trim()).filter(Boolean),
						example: instructionExample.trim() || undefined,
				  }
				: undefined;

		const tapRules: Rule[] =
			choiceList.length > 0
				? [
						{
							event: "OBJECT_TAP" as RuntimeEventType,
							if: {
								op: "eq" as const,
								a: { from: "object" as const, path: "objectId" },
								b: { from: "const" as const, value: correctId },
							},
							then: [{ type: "END_GAME", result: "win" }],
						},
						{
							event: "OBJECT_TAP" as RuntimeEventType,
							if: {
								op: "not" as const,
								cond: {
									op: "eq" as const,
									a: { from: "object" as const, path: "objectId" },
									b: { from: "const" as const, value: correctId },
								},
							},
							then: [{ type: "END_GAME", result: "lose" }],
						},
				  ]
				: [];

		const engineRuleList: Rule[] = engineRules
			.filter((r) => RULE_TRIGGERS.includes(r.trigger as (typeof RULE_TRIGGERS)[number]))
			.map((r) => ({ event: r.trigger as RuntimeEventType, then: [] }));

		const rules: Rule[] = [...engineRuleList, ...tapRules];

		return {
			id: "",
			title: title.trim() || "Untitled",
			description: description.trim() || undefined,
			board: buildBoard(),
			systems: {
				timer: timerEnabled ? { seconds: timerSeconds } : undefined,
				score: { start: scoreStart, target: scoreTarget },
			},
			rules,
			winConditions: winConditions.length > 0 ? winConditions.map((c) => c.type) : undefined,
			loseConditions: loseConditions.length > 0 ? loseConditions.map((c) => c.type) : undefined,
			instructions,
			content: {
				prompt: prompt.trim(),
				choices: choiceList,
				correctAnswerId: correctId,
			},
		};
	}, [
		title,
		description,
		choices,
		correctIndex,
		instructionLines,
		instructionExample,
		timerEnabled,
		timerSeconds,
		scoreStart,
		scoreTarget,
		boardKind,
		gridRows,
		gridCols,
		cellSize,
		gridAdjacency,
		freeformWidth,
		freeformHeight,
		listSlots,
		listDragReorder,
		listOrientation,
		freeformCollisionMode,
		engineRules,
		winConditions,
		loseConditions,
	]);

	const validate = (): boolean => {
		if (!title.trim()) {
			Alert.alert("Validation Error", "Please enter a title.");
			return false;
		}
		if (!prompt.trim()) {
			Alert.alert("Validation Error", "Please enter the question.");
			return false;
		}
		const filled = choices.filter((c) => c.trim());
		if (filled.length < 2) {
			Alert.alert("Validation Error", "Add at least 2 choices.");
			return false;
		}
		if (!choices[correctIndex]?.trim()) {
			Alert.alert("Validation Error", "Mark the correct answer.");
			return false;
		}
		return true;
	};

	const handlePreview = () => {
		if (!validate()) return;
		setShowPreview(true);
	};

	const handleSubmit = async () => {
		if (!validate()) return;

		const user = getCurrentUser();
		if (!user) {
			Alert.alert("Error", "You must be signed in to create games.");
			router.replace("/signin");
			return;
		}

		const userData = await getUserData(user.uid);
		const username = userData?.username ?? undefined;
		const definition = buildDefinition();

		setLoading(true);
		try {
			await saveGameToFirestore("custom", difficulty, { definition }, user.uid, username);
			Alert.alert("Success", "Your custom game was created and is pending review.", [
				{ text: "OK", onPress: () => router.back() },
			]);
		} catch (e: any) {
			Alert.alert("Error", e.message ?? "Failed to save. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const modalHeight = Math.min(400, Dimensions.get("window").height * 0.85);

	const renderModal = (
		visible: boolean,
		onClose: () => void,
		title: string,
		children: React.ReactNode
	) => (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalOverlay}>
					<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
						<View style={[styles.modalContent, { maxHeight: modalHeight }]}>
							<View style={styles.modalHeader}>
								<Text style={styles.modalTitle}>{title}</Text>
								<TouchableOpacity onPress={onClose} style={styles.modalClose}>
									<Ionicons name="close" size={24} color={Colors.text.primary} />
								</TouchableOpacity>
							</View>
							<ScrollView
								style={styles.modalScroll}
								contentContainerStyle={styles.modalScrollContent}
								showsVerticalScrollIndicator
								keyboardShouldPersistTaps="handled"
								bounces={false}
							>
								{children}
							</ScrollView>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			{/* New Game header: back, title, progress, hamburger, green preview */}
			<View style={[styles.newGameHeader, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity onPress={() => router.back()} style={styles.newGameBack}>
					<Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<View style={styles.newGameHeaderCenter}>
					<Text style={styles.newGameTitle}>New Game</Text>
					<Text style={styles.newGameProgress}>{completedCount}/{TOTAL_STEPS} completed</Text>
					<View style={styles.progressBarTrack}>
						<View style={[styles.progressBarFill, { width: `${(completedCount / TOTAL_STEPS) * 100}%` }]} />
					</View>
				</View>
				<View style={styles.newGameHeaderRight}>
					<TouchableOpacity onPress={() => setShowStepListModal(true)} style={styles.newGameIconBtn}>
						<Ionicons name="menu" size={24} color={Colors.text.primary} />
					</TouchableOpacity>
					<TouchableOpacity onPress={handlePreview} style={styles.previewIconBtn}>
						<Ionicons name="eye-outline" size={22} color="#fff" />
					</TouchableOpacity>
				</View>
			</View>

			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator
				>
					{/* Step 0: Game Information */}
					{currentStep === 0 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Game Information</Text>
							<Text style={styles.gameInfoSubtitle}>Basic details that help players discover your game</Text>

							<Text style={styles.fieldLabel}>Game Title *</Text>
							<TextInput
								style={styles.input}
								placeholder="My Awesome Brain Game"
								placeholderTextColor={Colors.text.disabled}
								value={title}
								onChangeText={(t) => setTitle(t.slice(0, 60))}
								maxLength={60}
							/>
							<View style={styles.charCountRow}>
								<Text style={styles.charCountHint}>Max 60 chars</Text>
								<Text style={styles.charCountValue}>{title.length}/60</Text>
							</View>

							<Text style={styles.fieldLabel}>Short Description *</Text>
							<TextInput
								style={[styles.input, styles.textArea]}
								placeholder="A quick, engaging description..."
								placeholderTextColor={Colors.text.disabled}
								value={description}
								onChangeText={(t) => setDescription(t.slice(0, 200))}
								maxLength={200}
								multiline
							/>
							<View style={styles.charCountRow}>
								<Text style={styles.charCountHint}>Max 200 chars</Text>
								<Text style={styles.charCountValue}>{description.length}/200</Text>
							</View>

							<Text style={styles.fieldLabel}>Instructions *</Text>
							<TextInput
								style={[styles.input, styles.instructionsArea]}
								placeholder="How to play your game..."
								placeholderTextColor={Colors.text.disabled}
								value={instructionLines.join("\n")}
								onChangeText={(t) => setInstructionLines([t.slice(0, 500)])}
								maxLength={500}
								multiline
								textAlignVertical="top"
							/>
							<View style={styles.charCountRow}>
								<Text style={styles.charCountHint}>Max 500 chars</Text>
								<Text style={styles.charCountValue}>{instructionLines.join("\n").length}/500</Text>
							</View>

							<Text style={styles.sectionLabel}>Difficulty</Text>
							<View style={styles.diffRow}>
								{(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
									<TouchableOpacity key={d} style={[styles.diffBtn, difficulty === d && styles.diffBtnSelected]} onPress={() => setDifficulty(d)}>
										<Text style={[styles.diffText, difficulty === d && styles.diffTextSelected]}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
									</TouchableOpacity>
								))}
							</View>

							<View style={styles.sectionSpacer} />
							<View style={styles.sectionLabelRow}>
								<Ionicons name="time-outline" size={18} color={Colors.text.primary} />
								<Text style={styles.sectionLabel}>Play Time</Text>
							</View>
							<View
								style={styles.sliderTrack}
								onLayout={(e) => { playTimeTrackWidth.current = e.nativeEvent.layout.width; }}
								onStartShouldSetResponder={() => true}
								onResponderRelease={(e) => {
									const w = playTimeTrackWidth.current;
									if (w <= 0) return;
									const x = e.nativeEvent.locationX;
									const pct = Math.max(0, Math.min(1, x / w));
									const idx = Math.round(pct * (PLAY_TIME_OPTIONS.length - 1));
									setPlayTimeMinutes(PLAY_TIME_OPTIONS[idx]);
								}}
							>
								<View style={[styles.sliderFill, { width: `${((PLAY_TIME_OPTIONS.indexOf(playTimeMinutes) + 1) / PLAY_TIME_OPTIONS.length) * 100}%` }]} />
								<View style={[styles.sliderThumb, { left: `${(PLAY_TIME_OPTIONS.indexOf(playTimeMinutes) / Math.max(1, PLAY_TIME_OPTIONS.length - 1)) * 100}%` }]} />
							</View>
							<Text style={styles.playTimeValue}>{playTimeMinutes}m</Text>
							<Text style={styles.playTimeAvgLabel}>Avg time</Text>

							<View style={styles.sectionSpacer} />
							<View style={styles.sectionLabelRow}>
								<Ionicons name="pricetag-outline" size={18} color={Colors.text.primary} />
								<Text style={styles.sectionLabel}>Tags</Text>
							</View>
							<Text style={styles.tagsSubtitle}>Select all that apply</Text>
							<View style={styles.tagsRow}>
								{TAGS.map((tag) => (
									<TouchableOpacity
										key={tag}
										style={[styles.tagPill, selectedTags.includes(tag) && styles.tagPillSelected]}
										onPress={() => setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
									>
										<Text style={styles.tagPillText}>{tag}</Text>
									</TouchableOpacity>
								))}
							</View>

							<View style={styles.sectionSpacer} />
							<View style={styles.sectionLabelRow}>
								<Ionicons name="eye-outline" size={18} color={Colors.text.primary} />
								<Text style={styles.sectionLabel}>Visibility</Text>
							</View>
							<View style={styles.visibilityStack}>
								{[
									{ value: "public" as const, label: "Public", sub: "Anyone can find and play" },
									{ value: "unlisted" as const, label: "Unlisted", sub: "Only people with link" },
									{ value: "draft" as const, label: "Draft", sub: "Only you can see" },
								].map((v) => (
									<TouchableOpacity
										key={v.value}
										style={[styles.visibilityPanel, visibility === v.value && styles.visibilityPanelSelected]}
										onPress={() => setVisibility(v.value)}
									>
										<Text style={styles.visibilityLabel}>{v.label}</Text>
										<Text style={styles.visibilitySub}>{v.sub}</Text>
										{visibility === v.value && (
											<View style={styles.visibilityCheck}>
												<Ionicons name="checkmark" size={20} color="#eab308" />
											</View>
										)}
									</TouchableOpacity>
								))}
							</View>

							<View style={styles.moderationBox}>
								<Ionicons name="information-circle" size={22} color="#0ea5e9" />
								<Text style={styles.moderationText}>Content subject to moderation{"\n"}Follow community guidelines</Text>
							</View>
						</View>
					)}

					{/* Step 1: Board Configuration */}
					{currentStep === 1 && (
						<View style={styles.boardConfigSection}>
							<Text style={styles.boardConfigTitle}>Board Configuration</Text>
							<Text style={styles.boardConfigSubtitle}>Choose the layout type that best fits your game mechanics</Text>
							<Text style={styles.boardConfigRequired}>Select Board Type *</Text>
							<View style={styles.boardCardsGrid}>
								{[
									{ kind: "grid" as BoardKind, title: "Grid Board", desc: "Perfect for puzzles, matching games, and grid-based logic", examples: "Sudoku, Match-3, Word Search", icon: "grid-outline" as const },
									{ kind: "freeform" as BoardKind, title: "Freeform Board", desc: "Floating objects with physics, great for action games", examples: "Bubble Pop, Catch & Tap, Reaction Games", icon: "resize-outline" as const },
									{ kind: "none" as BoardKind, title: "Path/Graph Board", desc: "Connected nodes and edges for traversal puzzles", examples: "Maze, Connect the Dots, Flow", icon: "git-branch-outline" as const },
									{ kind: "list" as BoardKind, title: "List/Sequence Board", desc: "Ordered slots for sequencing and memory challenges", examples: "Memory Order, Sequence Builder, Rankings", icon: "list-outline" as const },
								].map((b) => (
									<TouchableOpacity
										key={b.kind}
										style={[styles.boardCard, boardKind === b.kind && styles.boardCardSelected]}
										onPress={() => setBoardKind(b.kind)}
									>
										{boardKind === b.kind && (
											<View style={styles.boardCardCheck}>
												<Ionicons name="checkmark" size={18} color={Colors.accent} />
											</View>
										)}
										<View style={styles.boardCardIconWrap}>
											<Ionicons name={b.icon} size={28} color={Colors.text.secondary} />
										</View>
										<Text style={styles.boardCardTitle}>{b.title}</Text>
										<Text style={styles.boardCardDesc}>{b.desc}</Text>
										<Text style={styles.boardCardExamples}>Examples: {b.examples}</Text>
									</TouchableOpacity>
								))}
							</View>

							{boardKind === "grid" && (
								<View style={styles.inlineSettingsBlock}>
									<Text style={styles.inlineSettingsTitle}>Grid Settings</Text>
									<Text style={styles.newGameLabel}>Rows</Text>
									<TextInput style={styles.input} value={String(gridRows)} onChangeText={(t) => setGridRows(Math.max(1, Math.min(20, parseInt(t, 10) || 3)))} keyboardType="number-pad" />
									<Text style={styles.gridMaxHint}>Max: 20</Text>
									<Text style={styles.newGameLabel}>Columns</Text>
									<TextInput style={styles.input} value={String(gridCols)} onChangeText={(t) => setGridCols(Math.max(1, Math.min(20, parseInt(t, 10) || 3)))} keyboardType="number-pad" />
									<Text style={styles.gridMaxHint}>Max: 20</Text>
									<Text style={styles.newGameLabel}>Adjacency Rule</Text>
									<View style={styles.segmentRow}>
										<TouchableOpacity style={[styles.segmentBtn, gridAdjacency === "4" && styles.segmentBtnSelected]} onPress={() => setGridAdjacency("4")}>
											<Text style={[styles.segmentBtnText, gridAdjacency === "4" && styles.segmentBtnTextSelected]}>4-Way (↑→↓←)</Text>
										</TouchableOpacity>
										<TouchableOpacity style={[styles.segmentBtn, gridAdjacency === "8" && styles.segmentBtnSelected]} onPress={() => setGridAdjacency("8")}>
											<Text style={[styles.segmentBtnText, gridAdjacency === "8" && styles.segmentBtnTextSelected]}>8-Way (+ Diagonals)</Text>
										</TouchableOpacity>
									</View>
									<View style={styles.gridPreviewBox}>
										<Text style={styles.gridPreviewText}>Preview: {gridRows} x {gridCols} grid ({gridRows * gridCols} total cells)</Text>
									</View>
								</View>
							)}

							{boardKind === "freeform" && (
								<View style={styles.inlineSettingsBlock}>
									<Text style={styles.inlineSettingsTitle}>Freeform Settings</Text>
									<Text style={styles.newGameLabel}>Width (px)</Text>
									<TextInput style={styles.input} value={String(freeformWidth)} onChangeText={(t) => setFreeformWidth(Math.max(100, Math.min(1200, parseInt(t, 10) || 300)))} keyboardType="number-pad" />
									<Text style={styles.newGameLabel}>Height (px)</Text>
									<TextInput style={styles.input} value={String(freeformHeight)} onChangeText={(t) => setFreeformHeight(Math.max(100, Math.min(1000, parseInt(t, 10) || 300)))} keyboardType="number-pad" />
									<Text style={styles.newGameLabel}>Collision Mode</Text>
									<View style={styles.segmentRow}>
										<TouchableOpacity style={[styles.segmentBtn, freeformCollisionMode === "none" && styles.segmentBtnSelected]} onPress={() => setFreeformCollisionMode("none")}>
											<Text style={[styles.segmentBtnText, freeformCollisionMode === "none" && styles.segmentBtnTextSelected]}>None</Text>
										</TouchableOpacity>
										<TouchableOpacity style={[styles.segmentBtn, freeformCollisionMode === "basic" && styles.segmentBtnSelected]} onPress={() => setFreeformCollisionMode("basic")}>
											<Text style={[styles.segmentBtnText, freeformCollisionMode === "basic" && styles.segmentBtnTextSelected]}>Basic</Text>
										</TouchableOpacity>
									</View>
								</View>
							)}

							{boardKind === "list" && (
								<View style={styles.inlineSettingsBlock}>
									<Text style={styles.inlineSettingsTitle}>List Settings</Text>
									<Text style={styles.newGameLabel}>Number of Slots</Text>
									<TextInput style={styles.input} value={String(listSlots)} onChangeText={(t) => setListSlots(Math.max(1, Math.min(15, parseInt(t, 10) || 5)))} keyboardType="number-pad" />
									<Text style={styles.gridMaxHint}>Max: 15 slots</Text>
									<Text style={styles.newGameLabel}>Orientation</Text>
									<View style={styles.segmentRow}>
										<TouchableOpacity style={[styles.segmentBtn, listOrientation === "vertical" && styles.segmentBtnSelected]} onPress={() => setListOrientation("vertical")}>
											<Text style={[styles.segmentBtnText, listOrientation === "vertical" && styles.segmentBtnTextSelected]}>Vertical</Text>
										</TouchableOpacity>
										<TouchableOpacity style={[styles.segmentBtn, listOrientation === "horizontal" && styles.segmentBtnSelected]} onPress={() => setListOrientation("horizontal")}>
											<Text style={[styles.segmentBtnText, listOrientation === "horizontal" && styles.segmentBtnTextSelected]}>Horizontal</Text>
										</TouchableOpacity>
									</View>
								</View>
							)}

							<View style={styles.platformLimitsBox}>
								<Ionicons name="resize-outline" size={22} color={Colors.text.secondary} />
								<View style={styles.platformLimitsContent}>
									<Text style={styles.platformLimitsTitle}>Platform Safety Limits</Text>
									<Text style={styles.platformLimitsBullet}>• Max board size: 20x20 grid or 1200x1000px</Text>
									<Text style={styles.platformLimitsBullet}>• Max objects on screen: 200</Text>
								</View>
							</View>
						</View>
					)}

					{/* Step 2: Objects & Assets */}
					{currentStep === 2 && (
						<View style={styles.objectsCard}>
							<Text style={styles.gameInfoTitle}>Objects & Assets</Text>
							<Text style={styles.gameInfoSubtitle}>Define the objects that will appear in your game</Text>

							<Text style={styles.objectsSectionTitle}>Add Object Type</Text>
							<View style={styles.objectTypeGrid}>
								{OBJECT_TYPES.map((ot) => (
									<TouchableOpacity
										key={ot.id}
										style={[styles.objectTypeCard, selectedObjectTypes.includes(ot.id) && styles.objectTypeCardSelected]}
										onPress={() => setSelectedObjectTypes((prev) => (prev.includes(ot.id) ? prev.filter((x) => x !== ot.id) : [...prev, ot.id]))}
									>
										<Text style={styles.objectTypeCardTitle}>{ot.title}</Text>
										<Text style={styles.objectTypeCardDesc}>{ot.desc}</Text>
									</TouchableOpacity>
								))}
							</View>

							<TouchableOpacity
								style={[styles.addObjectTypeBtn, selectedObjectTypes.length === 0 && styles.addObjectTypeBtnDisabled]}
								onPress={addSelectedObjectTypes}
								disabled={selectedObjectTypes.length === 0}
							>
								<Ionicons name="add" size={20} color="#fff" />
								<Text style={styles.addObjectTypeBtnText}>Add Selected Object Type</Text>
							</TouchableOpacity>

							<Text style={[styles.objectsSectionTitle, { marginTop: Spacing.xl }]}>Your Objects ({yourObjects.length})</Text>
							{yourObjects.length === 0 ? (
								<View style={styles.yourObjectsEmpty}>
									<Ionicons name="image-outline" size={56} color={Colors.text.disabled} />
									<Text style={styles.yourObjectsEmptyText}>No objects yet. Add your first object above.</Text>
								</View>
							) : (
								<View style={styles.yourObjectsList}>
									{yourObjects.map((obj) => (
										<View key={obj.id} style={styles.yourObjectCard}>
											<View style={styles.yourObjectCardContent}>
												<Text style={styles.yourObjectCardName}>{obj.name}</Text>
												<Text style={styles.yourObjectCardType}>Type: {OBJECT_TYPES.find((t) => t.id === obj.type)?.title ?? obj.type}</Text>
											</View>
											<TouchableOpacity onPress={() => removeYourObject(obj.id)} style={styles.yourObjectDelete}>
												<Ionicons name="trash-outline" size={22} color={Colors.error} />
											</TouchableOpacity>
										</View>
									))}
								</View>
							)}

							<TouchableOpacity style={styles.rowButton} onPress={() => setShowObjectsModal(true)}>
								<Text style={styles.rowLabel}>Use choices as objects</Text>
								<Text style={styles.rowValue}>{useChoicesAsObjects ? "Yes (choices as tiles/slots)" : "No (empty board)"}</Text>
								<Ionicons name="chevron-forward" size={18} color={Colors.text.secondary} />
							</TouchableOpacity>
						</View>
					)}

					{/* Step 3: Interaction Modes */}
					{currentStep === 3 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Interaction Modes</Text>
							<Text style={styles.gameInfoSubtitle}>Define how players can interact with your game objects</Text>
							<View style={styles.interactionSection}>
								<View style={styles.interactionSectionHeader}>
									<View style={styles.interactionIconWrap}><Ionicons name="hand-left-outline" size={20} color={Colors.text.primary} /></View>
									<Text style={styles.interactionSectionTitle}>Tap Interactions</Text>
								</View>
								<View style={styles.chipRow}>
									{[
										{ id: "tap_select", label: "Tap to select" },
										{ id: "tap_toggle", label: "Tap to toggle states" },
										{ id: "tap_reveal", label: "Tap to reveal (card flip)" },
										{ id: "tap_sequence", label: "Tap sequence input (Simon-style)" },
									].map(({ id, label }) => (
										<TouchableOpacity key={id} style={[styles.interactionChip, interactionModes.includes(id) && styles.chipSelected]} onPress={() => setInteractionModes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}>
											<Text style={styles.chipText}>{label}</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
							<View style={styles.interactionSection}>
								<View style={styles.interactionSectionHeader}>
									<View style={styles.interactionIconWrap}><Ionicons name="move-outline" size={20} color={Colors.text.primary} /></View>
									<Text style={styles.interactionSectionTitle}>Drag Interactions</Text>
								</View>
								<View style={styles.chipRow}>
									{[
										{ id: "drag_place_grid", label: "Drag to place on grid" },
										{ id: "drag_reorder_list", label: "Drag to reorder list" },
										{ id: "drag_swap", label: "Drag to swap positions" },
									].map(({ id, label }) => (
										<TouchableOpacity key={id} style={[styles.interactionChip, interactionModes.includes(id) && styles.chipSelected]} onPress={() => setInteractionModes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}>
											<Text style={styles.chipText}>{label}</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
							<View style={styles.interactionSection}>
								<View style={styles.interactionSectionHeader}>
									<View style={styles.interactionIconWrap}><Ionicons name="keypad-outline" size={20} color={Colors.text.primary} /></View>
									<Text style={styles.interactionSectionTitle}>Type Interactions</Text>
								</View>
								<View style={styles.chipRow}>
									{[
										{ id: "type_text", label: "Text answer input" },
										{ id: "type_numeric", label: "Numeric input" },
										{ id: "type_letter", label: "Letter keyboard (word games)" },
									].map(({ id, label }) => (
										<TouchableOpacity key={id} style={[styles.interactionChip, interactionModes.includes(id) && styles.chipSelected]} onPress={() => setInteractionModes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}>
											<Text style={styles.chipText}>{label}</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
							{interactionModes.length === 0 && (
								<View style={styles.interactionErrorBox}>
									<Text style={styles.interactionErrorText}>Select at least one interaction mode to continue.</Text>
								</View>
							)}
							<TouchableOpacity style={styles.rowButton} onPress={() => setShowTimerScoreModal(true)}>
								<Text style={styles.rowLabel}>Timer, score, lives & rounds</Text>
								<Text style={styles.rowValue}>{timerEnabled ? `${timerSeconds}s` : "No timer"} · Score: {scoreStart}</Text>
								<Ionicons name="chevron-forward" size={18} color={Colors.text.secondary} />
							</TouchableOpacity>
						</View>
					)}

					{/* Step 4: Dynamic Behavior */}
					{currentStep === 4 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Dynamic Behavior</Text>
							<Text style={styles.gameInfoSubtitle}>Configure spawning, movement, and randomization</Text>

							{/* Spawn Rules */}
							<View style={[styles.behaviorSection, styles.behaviorSectionFirst]}>
								<View style={styles.behaviorSectionHeader}>
									<Ionicons name="flash" size={20} color={Colors.text.secondary} />
									<Text style={styles.sectionLabel}>Spawn Rules</Text>
									<View style={{ flex: 1 }} />
									<TouchableOpacity style={styles.addRuleButton} onPress={addSpawnRule} activeOpacity={0.85}>
										<Text style={styles.addRuleButtonText}>+ Add Rule</Text>
									</TouchableOpacity>
								</View>
								{spawnRules.length === 0 ? (
									<View style={styles.spawnRulesEmpty}>
										<View style={styles.spawnRulesEmptyIconWrap}>
											<Ionicons name="flash-outline" size={48} color={Colors.text.disabled} />
										</View>
										<Text style={styles.spawnRulesEmptyText}>No spawn rules yet.</Text>
										<Text style={[styles.spawnRulesEmptyText, styles.spawnRulesEmptyTextSub]}>Objects will be placed manually.</Text>
									</View>
								) : (
									<View style={styles.spawnRulesList}>
										{spawnRules.map((rule, index) => (
											<View key={rule.id} style={styles.spawnRuleCard}>
												<View style={{ flex: 1 }}>
													<Text style={styles.spawnRuleTitle}>Spawn Rule {index + 1}</Text>
													<Text style={styles.spawnRuleDetail}>{rule.trigger} • {rule.count} object(s) • {rule.placement}</Text>
												</View>
												<TouchableOpacity onPress={() => removeSpawnRule(rule.id)} style={styles.spawnRuleRemove}>
													<Ionicons name="close-circle" size={22} color={Colors.text.secondary} />
												</TouchableOpacity>
											</View>
										))}
									</View>
								)}
							</View>

							{/* Movement Preset */}
							<View style={[styles.behaviorSection, styles.behaviorSectionSecond]}>
								<View style={styles.behaviorSectionHeader}>
									<Ionicons name="location" size={20} color={Colors.text.secondary} />
									<Text style={styles.sectionLabel}>Movement Preset</Text>
								</View>
								<View style={styles.movementPresetGrid}>
									{(["stationary", "drift", "bounce", "fall"] as const).map((preset) => (
										<TouchableOpacity
											key={preset}
											style={[styles.movementPresetBtn, movementPreset === preset && styles.movementPresetBtnSelected]}
											onPress={() => setMovementPreset(preset)}
											activeOpacity={0.85}
										>
											<Text style={[styles.movementPresetBtnText, movementPreset === preset && styles.movementPresetBtnTextSelected]}>
												{preset.charAt(0).toUpperCase() + preset.slice(1)}
											</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
						</View>
					)}

					{/* Step 5: Rule Engine */}
					{currentStep === 5 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Rule Engine</Text>
							<Text style={styles.gameInfoSubtitle}>Define game logic with WHEN/IF/THEN rules</Text>

							<View style={styles.ruleEngineInfoBox}>
								<Ionicons name="information-circle" size={22} color="#0ea5e9" />
								<Text style={styles.ruleEngineInfoText}>
									Rules execute in order from top to bottom. Drag to reorder, or use the visual builder to create complex conditions.
								</Text>
							</View>

							<View style={styles.ruleEngineRulesHeader}>
								<Text style={styles.sectionLabel}>Your Rules ({engineRules.length})</Text>
								<TouchableOpacity style={styles.addRuleEngineButton} onPress={addEngineRule} activeOpacity={0.85}>
									<Ionicons name="add" size={20} color={Colors.text.primary} />
									<Text style={styles.addRuleEngineButtonText}>Add Rule</Text>
								</TouchableOpacity>
							</View>

							{engineRules.length === 0 ? (
								<View style={styles.ruleEngineEmpty}>
									<Text style={styles.ruleEngineEmptyText}>No rules yet. Tap "Add Rule" to create one.</Text>
								</View>
							) : (
								<View style={styles.ruleEngineList}>
									{engineRules.map((rule, index) => (
										<View key={rule.id} style={styles.ruleEngineCard}>
											<View style={styles.ruleEngineCardHeader}>
												<View style={styles.ruleEngineCardTitleRow}>
													<View style={styles.ruleEngineCardNumber}>
														<Text style={styles.ruleEngineCardNumberText}>{index + 1}</Text>
													</View>
													<Text style={styles.ruleEngineCardTitle}>Rule {index + 1}</Text>
												</View>
												<TouchableOpacity onPress={() => removeEngineRule(rule.id)} style={styles.ruleEngineCardDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
													<Ionicons name="trash-outline" size={22} color={Colors.error} />
												</TouchableOpacity>
											</View>
											<Text style={styles.ruleEngineCardLabel}>WHEN (Trigger)</Text>
											<TouchableOpacity
												style={styles.ruleEngineTriggerRow}
												onPress={() => setShowTriggerPickerForRuleId(showTriggerPickerForRuleId === rule.id ? null : rule.id)}
												activeOpacity={0.8}
											>
												<Text style={styles.ruleEngineTriggerText}>{rule.trigger}</Text>
												<Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
											</TouchableOpacity>
											{showTriggerPickerForRuleId === rule.id && (
												<View style={styles.ruleEngineTriggerDropdown}>
													{RULE_TRIGGERS.map((t) => (
														<TouchableOpacity
															key={t}
															style={styles.ruleEngineTriggerOption}
															onPress={() => setEngineRuleTrigger(rule.id, t)}
															activeOpacity={0.7}
														>
															{rule.trigger === t && <Ionicons name="checkmark" size={20} color="#22c55e" />}
															<Text style={[styles.ruleEngineTriggerOptionText, rule.trigger === t && styles.ruleEngineTriggerOptionTextSelected]}>{t}</Text>
														</TouchableOpacity>
													))}
												</View>
											)}
											<Text style={styles.ruleEngineCardLabel}>IF (Conditions) - Optional</Text>
											<View style={styles.ruleEnginePlaceholder}>
												<Text style={styles.ruleEnginePlaceholderText}>No conditions set (always execute)</Text>
											</View>
											<Text style={styles.ruleEngineCardLabel}>THEN (Actions)</Text>
											<View style={styles.ruleEnginePlaceholderWarning}>
												<Text style={styles.ruleEnginePlaceholderWarningText}>No actions set (rule does nothing)</Text>
											</View>
										</View>
									))}
								</View>
							)}

							<View style={styles.ruleEngineSummaryBar}>
								<Text style={styles.ruleEngineSummaryText}>{engineRules.length} rule(s) defined</Text>
							</View>
						</View>
					)}

					{/* Step 6: Win & Lose Conditions */}
					{currentStep === 6 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Win & Lose Conditions</Text>
							<Text style={styles.gameInfoSubtitle}>Define how players can win or lose your game</Text>

							<View style={styles.winLoseAlertBox}>
								<Ionicons name="warning" size={24} color="#b91c1c" />
								<View style={styles.winLoseAlertTextBlock}>
									<Text style={styles.winLoseAlertTitle}>At least one win condition is required</Text>
									<Text style={styles.winLoseAlertSub}>Your game must have a clear way for players to succeed</Text>
								</View>
							</View>

							{/* Win Conditions */}
							<View style={styles.winLoseSection}>
								<View style={styles.winLoseSectionHeader}>
									<Ionicons name="trophy" size={22} color="#16a34a" />
									<Text style={styles.sectionLabel}>Win Conditions ({winConditions.length})</Text>
								</View>
								{winConditions.length === 0 ? (
									<View style={styles.winLoseEmptyWin}>
										<Text style={styles.winLoseEmptyWinText}>No win conditions yet - add at least one</Text>
									</View>
								) : (
									<View style={styles.winLoseConditionList}>
										{winConditions.map((c) => {
											const label = WIN_CONDITION_TYPES.find((t) => t.id === c.type)?.label ?? c.type;
											return (
												<View key={c.id} style={styles.winLoseConditionChip}>
													<Text style={styles.winLoseConditionChipText}>{label}</Text>
													<TouchableOpacity onPress={() => removeWinCondition(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
														<Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
													</TouchableOpacity>
												</View>
											);
										})}
									</View>
								)}
								<Text style={styles.winLoseAddLabel}>Add Win Condition</Text>
								<View style={styles.winLoseButtonGrid}>
									{WIN_CONDITION_TYPES.map((t) => (
										<TouchableOpacity key={t.id} style={styles.winLoseAddBtn} onPress={() => addWinCondition(t.id)} activeOpacity={0.85}>
											<Ionicons name="add" size={20} color={Colors.text.secondary} />
											<Text style={styles.winLoseAddBtnText}>{t.label}</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>

							<View style={styles.winLoseDivider} />

							{/* Lose Conditions */}
							<View style={styles.winLoseSection}>
								<View style={styles.winLoseSectionHeader}>
									<Ionicons name="warning" size={20} color="#b91c1c" />
									<Text style={styles.sectionLabel}>Lose Conditions ({loseConditions.length})</Text>
								</View>
								{loseConditions.length === 0 ? (
									<View style={styles.winLoseEmptyLose}>
										<Text style={styles.winLoseEmptyLoseText}>No lose conditions (optional - game can only be won)</Text>
									</View>
								) : (
									<View style={styles.winLoseConditionList}>
										{loseConditions.map((c) => {
											const label = LOSE_CONDITION_TYPES.find((t) => t.id === c.type)?.label ?? c.type;
											return (
												<View key={c.id} style={styles.winLoseConditionChip}>
													<Text style={styles.winLoseConditionChipText}>{label}</Text>
													<TouchableOpacity onPress={() => removeLoseCondition(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
														<Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
													</TouchableOpacity>
												</View>
											);
										})}
									</View>
								)}
								<Text style={styles.winLoseAddLabel}>Add Lose Condition (Optional)</Text>
								<View style={styles.winLoseButtonGrid}>
									{LOSE_CONDITION_TYPES.map((t) => (
										<TouchableOpacity key={t.id} style={styles.winLoseAddBtnTwo} onPress={() => addLoseCondition(t.id)} activeOpacity={0.85}>
											<Ionicons name="add" size={20} color={Colors.text.secondary} />
											<Text style={styles.winLoseAddBtnText}>{t.label}</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
						</View>
					)}

					{/* Step 7: Content Packs */}
					{currentStep === 7 && (
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Content Packs</Text>
							<Text style={styles.gameInfoSubtitle}>Add word lists, questions, and other content for your game</Text>

							<Text style={styles.contentPackAddLabel}>Add Content Pack</Text>
							<View style={styles.contentPackGrid}>
								{CONTENT_PACK_TYPES.map((t) => (
									<TouchableOpacity key={t.id} style={styles.contentPackTypeCard} onPress={() => addContentPack(t.id)} activeOpacity={0.85}>
										<View style={styles.contentPackTypeIconWrap}>
											<Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={28} color="#eab308" />
										</View>
										<Text style={styles.contentPackTypeTitle}>{t.title}</Text>
										<Text style={styles.contentPackTypeSubtitle}>{t.subtitle}</Text>
									</TouchableOpacity>
								))}
							</View>

							<Text style={styles.contentPackYourLabel}>Your Content Packs ({contentPacks.length})</Text>
							{contentPacks.length === 0 ? (
								<View style={styles.contentPackEmpty}>
									<Text style={styles.contentPackEmptyText}>No content packs yet</Text>
								</View>
							) : (
								<View style={styles.contentPackList}>
									{contentPacks.map((p) => (
										<View key={p.id} style={styles.contentPackCard}>
											<View style={styles.contentPackCardContent}>
												<Text style={styles.contentPackCardTitle}>{p.name}</Text>
												<Text style={styles.contentPackCardSubtitle}>Type: {p.type}</Text>
											</View>
											<TouchableOpacity onPress={() => removeContentPack(p.id)} style={styles.contentPackCardRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
												<Ionicons name="close-circle" size={22} color={Colors.text.secondary} />
											</TouchableOpacity>
										</View>
									))}
								</View>
							)}

							<Text style={[styles.newGameLabel, { marginTop: Spacing.xl }]}>Question</Text>
							<TextInput style={[styles.input, styles.textArea]} placeholder="Your question..." placeholderTextColor={Colors.text.disabled} value={prompt} onChangeText={setPrompt} multiline />
							<Text style={styles.newGameLabel}>Choices (tap to mark correct)</Text>
							{choices.map((choice, index) => (
								<View key={index} style={styles.choiceRow}>
									<TouchableOpacity style={[styles.radio, correctIndex === index && styles.radioSelected]} onPress={() => setCorrectIndex(index)}>
										{correctIndex === index && <Ionicons name="checkmark" size={16} color={Colors.text.primary} />}
									</TouchableOpacity>
									<TextInput style={styles.choiceInput} placeholder={`Choice ${index + 1}`} placeholderTextColor={Colors.text.disabled} value={choice} onChangeText={(v) => setChoice(index, v)} />
									{choices.length > 2 && <TouchableOpacity onPress={() => removeChoice(index)} style={styles.removeBtn}><Ionicons name="close-circle" size={24} color={Colors.error} /></TouchableOpacity>}
								</View>
							))}
							{choices.length < 4 && <TouchableOpacity style={styles.addChoice} onPress={addChoice}><Ionicons name="add-circle-outline" size={24} color={Colors.accent} /><Text style={styles.addChoiceText}>Add choice</Text></TouchableOpacity>}
						</View>
					)}

					{/* Step nav: Back / Next or Publish */}
					{currentStep > 0 && currentStep <= 7 && (
						<View style={styles.stepNav}>
							<TouchableOpacity style={styles.stepNavBtn} onPress={() => setCurrentStep((s) => s - 1)}>
								<Ionicons name="chevron-back" size={20} color={Colors.accent} />
								<Text style={styles.stepNavText}>Back</Text>
							</TouchableOpacity>
							<View style={{ flex: 1 }} />
							{currentStep < TOTAL_STEPS - 1 ? (
								<TouchableOpacity
									style={[styles.stepNavBtnPrimary, (currentStep === 3 && interactionModes.length === 0) || (currentStep === 6 && winConditions.length === 0) ? styles.submitDisabled : null]}
									onPress={() => setCurrentStep((s) => s + 1)}
									disabled={(currentStep === 3 && interactionModes.length === 0) || (currentStep === 6 && winConditions.length === 0)}
								>
									<Text style={styles.stepNavTextPrimary}>Next</Text>
									<Ionicons name="chevron-forward" size={20} color="#fff" />
								</TouchableOpacity>
							) : (
								<TouchableOpacity style={[styles.submit, loading && styles.submitDisabled]} onPress={handleSubmit} disabled={loading}>
									{loading ? <ActivityIndicator size="small" color={Colors.text.primary} /> : <><Ionicons name="checkmark-circle" size={24} color={Colors.text.primary} /><Text style={styles.submitText}>Publish</Text></>}
								</TouchableOpacity>
							)}
						</View>
					)}
					{currentStep === 0 && (
						<View style={styles.stepNav}>
							<View style={{ flex: 1 }} />
							<TouchableOpacity style={styles.stepNavBtnPrimary} onPress={() => setCurrentStep(1)}>
								<Text style={styles.stepNavTextPrimary}>Next</Text>
								<Ionicons name="chevron-forward" size={20} color="#fff" />
							</TouchableOpacity>
						</View>
					)}
				</ScrollView>
			</KeyboardAvoidingView>

			{/* Step list modal (hamburger) – left-side overlay, scrollable list */}
			<Modal visible={showStepListModal} transparent animationType="fade">
				<View style={styles.stepListOverlay}>
					<View style={[styles.stepListPanel, { paddingTop: insets.top + Spacing.sm }]} onStartShouldSetResponder={() => true}>
						<View style={styles.stepListHeader}>
							<TouchableOpacity onPress={() => setShowStepListModal(false)} style={styles.stepListHeaderBtn}>
								<Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
							</TouchableOpacity>
							<Text style={styles.newGameTitle}>New Game</Text>
							<View style={styles.stepListHeaderRight}>
								<TouchableOpacity onPress={() => { setShowStepListModal(false); setShowPreview(true); }} style={styles.stepListHeaderBtn}>
									<Ionicons name="eye-outline" size={22} color="#22c55e" />
								</TouchableOpacity>
								<TouchableOpacity onPress={() => setShowStepListModal(false)} style={styles.stepListHeaderBtn}>
									<Ionicons name="close" size={24} color={Colors.text.primary} />
								</TouchableOpacity>
							</View>
						</View>
						<View style={styles.stepListProgressBlock}>
							<Text style={styles.newGameProgress}>{completedCount}/{TOTAL_STEPS} completed</Text>
							<View style={styles.progressBarTrack}><View style={[styles.progressBarFill, { width: `${(completedCount / TOTAL_STEPS) * 100}%` }]} /></View>
						</View>
						<ScrollView
							style={styles.stepListScroll}
							contentContainerStyle={styles.stepListScrollContent}
							showsVerticalScrollIndicator
							keyboardShouldPersistTaps="handled"
							bounces={true}
						>
							{[
								{ key: "info", label: "Game Information", icon: "information-circle-outline" as const, step: 0 },
								{ key: "board", label: "Board", icon: "grid-outline" as const, step: 1 },
								{ key: "objects", label: "Objects", icon: "cube-outline" as const, step: 2 },
								{ key: "interactions", label: "Interactions", icon: "hand-left-outline" as const, step: 3 },
								{ key: "behavior", label: "Behavior", icon: "flash-outline" as const, step: 4 },
								{ key: "rules", label: "Rules", icon: "code-slash-outline" as const, step: 5 },
								{ key: "winlose", label: "Win / Lose", icon: "trophy-outline" as const, step: 6 },
								{ key: "content", label: "Content", icon: "document-text-outline" as const, step: 7 },
								{ key: "preview", label: "Preview & Test", icon: "play-circle-outline" as const, action: "preview" as const },
								{ key: "publish", label: "Publish", icon: "share-social-outline" as const, action: "publish" as const },
							].map((item) => {
								const isStep = "step" in item;
								const stepNum = isStep ? (item as { step: number }).step : undefined;
								const completed = stepNum !== undefined ? stepCompleted[stepNum] : false;
								const isCurrent = stepNum !== undefined && currentStep === stepNum;
								const action = !isStep ? (item as { action: "preview" | "publish" }).action : null;
								const onPress = () => {
									setShowStepListModal(false);
									if (stepNum !== undefined) setCurrentStep(stepNum);
									else if (action === "preview") { setPreviewScreenMode("menu"); setShowPreview(true); }
									else if (action === "publish") setShowPublishSettings(true);
								};
								return (
									<TouchableOpacity key={item.key} style={styles.stepListItem} onPress={onPress}>
										<View style={[styles.stepListIconWrap, !completed && styles.stepListIconRedDot]}>
											<Ionicons name={item.icon} size={22} color={Colors.text.secondary} />
										</View>
										<View style={styles.stepListLabel}>
											<Text style={styles.stepListTitle}>{item.label}</Text>
											<Text style={styles.stepListRequired}>{completed ? "Completed" : "Required"}</Text>
										</View>
										{isCurrent && <Ionicons name="checkmark" size={20} color={Colors.accent} />}
									</TouchableOpacity>
								);
							})}
						</ScrollView>
					</View>
					<TouchableOpacity style={styles.stepListBackdrop} activeOpacity={1} onPress={() => setShowStepListModal(false)} />
				</View>
			</Modal>

			{/* Description modal */}
			{renderModal(
				showDescriptionModal,
				() => setShowDescriptionModal(false),
				"Description (max 200 characters)",
				<>
					<Text style={styles.modalHint}>Optional short description of your game.</Text>
					<TextInput
						style={[styles.input, styles.textArea]}
						placeholder="Describe your game..."
						placeholderTextColor={Colors.text.disabled}
						value={description}
						onChangeText={(t) => setDescription(t.slice(0, 200))}
						maxLength={200}
						multiline
					/>
					<Text style={styles.charHint}>{description.length}/200</Text>
				</>
			)}

			{/* Board modal */}
			{renderModal(
				showBoardModal,
				() => setShowBoardModal(false),
				"Board type",
				<>
					<TouchableOpacity
						style={[styles.optionRow, boardKind === "none" && styles.optionRowSelected]}
						onPress={() => setBoardKind("none")}
					>
						<Text style={styles.optionText}>Question only (no grid)</Text>
						{boardKind === "none" && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.optionRow, boardKind === "grid" && styles.optionRowSelected]}
						onPress={() => setBoardKind("grid")}
					>
						<Text style={styles.optionText}>Grid</Text>
						{boardKind === "grid" && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.optionRow, boardKind === "freeform" && styles.optionRowSelected]}
						onPress={() => setBoardKind("freeform")}
					>
						<Text style={styles.optionText}>Freeform</Text>
						{boardKind === "freeform" && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.optionRow, boardKind === "list" && styles.optionRowSelected]}
						onPress={() => setBoardKind("list")}
					>
						<Text style={styles.optionText}>List / Sequence</Text>
						{boardKind === "list" && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					{boardKind === "grid" && (
						<View style={styles.gridOptions}>
							<Text style={styles.modalLabel}>Rows</Text>
							<TextInput
								style={styles.input}
								value={String(gridRows)}
								onChangeText={(t) => setGridRows(Math.max(1, Math.min(10, parseInt(t, 10) || 1)))}
								keyboardType="number-pad"
							/>
							<Text style={styles.modalLabel}>Cols</Text>
							<TextInput
								style={styles.input}
								value={String(gridCols)}
								onChangeText={(t) => setGridCols(Math.max(1, Math.min(10, parseInt(t, 10) || 1)))}
								keyboardType="number-pad"
							/>
							<Text style={styles.modalLabel}>Cell size (px)</Text>
							<TextInput
								style={styles.input}
								value={String(cellSize)}
								onChangeText={(t) => setCellSize(Math.max(32, Math.min(120, parseInt(t, 10) || DEFAULT_CELL_SIZE)))}
								keyboardType="number-pad"
							/>
						</View>
					)}
				</>
			)}

			{/* Timer & score modal */}
			{renderModal(
				showTimerScoreModal,
				() => setShowTimerScoreModal(false),
				"Timer & score",
				<>
					<TouchableOpacity
						style={[styles.optionRow, !timerEnabled && styles.optionRowSelected]}
						onPress={() => setTimerEnabled(false)}
					>
						<Text style={styles.optionText}>No timer</Text>
						{!timerEnabled && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.optionRow, timerEnabled && styles.optionRowSelected]}
						onPress={() => setTimerEnabled(true)}
					>
						<Text style={styles.optionText}>Use timer</Text>
						{timerEnabled && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					{timerEnabled && (
						<View style={styles.timerOption}>
							<Text style={styles.modalLabel}>Seconds</Text>
							<TextInput
								style={styles.input}
								value={String(timerSeconds)}
								onChangeText={(t) => setTimerSeconds(Math.max(5, Math.min(300, parseInt(t, 10) || DEFAULT_TIMER_SECONDS)))}
								keyboardType="number-pad"
							/>
						</View>
					)}
					<Text style={styles.modalLabel}>Start score</Text>
					<TextInput
						style={styles.input}
						value={String(scoreStart)}
						onChangeText={(t) => setScoreStart(parseInt(t, 10) || 0)}
						keyboardType="number-pad"
					/>
					<Text style={styles.modalLabel}>Target score (optional, leave empty for no target)</Text>
					<TextInput
						style={styles.input}
						placeholder="e.g. 100"
						placeholderTextColor={Colors.text.disabled}
						value={scoreTarget !== undefined ? String(scoreTarget) : ""}
						onChangeText={(t) => setScoreTarget(t === "" ? undefined : Math.max(0, parseInt(t, 10) || 0))}
						keyboardType="number-pad"
					/>
				</>
			)}

			{/* Rules modal (preset only for now) */}
			{renderModal(
				showRulesModal,
				() => setShowRulesModal(false),
				"Rules",
				<>
					<Text style={styles.modalHint}>
						Single correct answer: tapping the correct choice wins; tapping a wrong choice loses. This is the only rule preset for now.
					</Text>
				</>
			)}

			{/* Instructions (how to play) modal */}
			{renderModal(
				showInstructionsModal,
				() => setShowInstructionsModal(false),
				"How to play (instructions)",
				<>
					<Text style={styles.modalHint}>
						These will be shown when players tap the help icon. Add step-by-step instructions and an optional example.
					</Text>
					{instructionLines.map((line, index) => (
						<View key={index} style={styles.instructionRow}>
							<TextInput
								style={[styles.input, styles.flex1]}
								placeholder={`Instruction ${index + 1}`}
								placeholderTextColor={Colors.text.disabled}
								value={line}
								onChangeText={(v) => setInstructionLine(index, v)}
							/>
							{instructionLines.length > 1 && (
								<TouchableOpacity onPress={() => removeInstructionLine(index)}>
									<Ionicons name="close-circle" size={24} color={Colors.error} />
								</TouchableOpacity>
							)}
						</View>
					))}
					<TouchableOpacity style={styles.addChoice} onPress={addInstructionLine}>
						<Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
						<Text style={styles.addChoiceText}>Add line</Text>
					</TouchableOpacity>
					<Text style={styles.modalLabel}>Example (optional)</Text>
					<TextInput
						style={[styles.input, styles.textArea]}
						placeholder="e.g. If the question is '2+2?', the correct choice is 4."
						placeholderTextColor={Colors.text.disabled}
						value={instructionExample}
						onChangeText={setInstructionExample}
						multiline
					/>
				</>
			)}

			{/* Objects modal */}
			{renderModal(
				showObjectsModal,
				() => setShowObjectsModal(false),
				"Objects on board",
				<>
					<Text style={styles.modalHint}>Use your choices as tiles/cards on the board so they appear in preview, or add custom objects later.</Text>
					<TouchableOpacity style={[styles.optionRow, useChoicesAsObjects && styles.optionRowSelected]} onPress={() => setUseChoicesAsObjects(true)}>
						<Text style={styles.optionText}>Use choices as objects (tiles/cards)</Text>
						{useChoicesAsObjects && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
					<TouchableOpacity style={[styles.optionRow, !useChoicesAsObjects && styles.optionRowSelected]} onPress={() => setUseChoicesAsObjects(false)}>
						<Text style={styles.optionText}>No initial objects (empty board)</Text>
						{!useChoicesAsObjects && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
					</TouchableOpacity>
				</>
			)}

			{/* Win / Lose modal */}
			{renderModal(
				showWinLoseModal,
				() => setShowWinLoseModal(false),
				"Win / Lose",
				<>
					<Text style={styles.modalHint}>Configure win and lose conditions. (UI placeholder — wire to definition when backend is ready.)</Text>
				</>
			)}

			{/* Spawn rules modal */}
			{renderModal(
				showSpawnRulesModal,
				() => setShowSpawnRulesModal(false),
				"Spawn rules",
				<>
					<Text style={styles.modalHint}>Spawn objects during the game (e.g. on start, every N seconds). (UI placeholder — wire when backend is ready.)</Text>
				</>
			)}

			{/* Content pack modal */}
			{renderModal(
				showContentPackModal,
				() => setShowContentPackModal(false),
				"Content pack",
				<>
					<Text style={styles.modalHint}>Optional word list or number set for your game content. (UI placeholder — wire when backend is ready.)</Text>
				</>
			)}

			{/* Preview & Testing modal */}
			<Modal visible={showPreview} animationType="slide">
				<View style={styles.previewContainer}>
					<View style={[styles.previewHeader, { paddingTop: insets.top + Spacing.sm }]}>
						<TouchableOpacity
							style={styles.backToEditButton}
							onPress={() => (previewScreenMode === "play" ? setPreviewScreenMode("menu") : setShowPreview(false))}
						>
							<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
							<Text style={styles.backToEditText}>{previewScreenMode === "play" ? "Back" : "Back to edit"}</Text>
						</TouchableOpacity>
					</View>
					{previewScreenMode === "menu" ? (
						<ScrollView style={styles.previewScroll} contentContainerStyle={[styles.previewScrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
							<View style={styles.previewTestingCard}>
								<Text style={styles.gameInfoTitle}>Preview & Testing</Text>
								<Text style={styles.gameInfoSubtitle}>Test your game and ensure everything works correctly.</Text>
								<View style={styles.previewTestingRow}>
									<TouchableOpacity style={styles.previewModeCard} onPress={() => setPreviewScreenMode("play")} activeOpacity={0.85}>
										<View style={styles.previewModeIconWrap}>
											<Ionicons name="play" size={32} color="#ea580c" />
										</View>
										<Text style={styles.previewModeTitle}>Preview Mode</Text>
										<Text style={styles.previewModeSubtitle}>Play your game in real-time</Text>
									</TouchableOpacity>
									<TouchableOpacity style={styles.autoTestCard} onPress={() => Alert.alert("Auto-Test", "Automated validation check — coming soon.")} activeOpacity={0.85}>
										<View style={styles.autoTestIconWrap}>
											<Ionicons name="flash" size={32} color="#2563eb" />
										</View>
										<Text style={styles.autoTestTitle}>Auto-Test</Text>
										<Text style={styles.autoTestSubtitle}>Automated validation check</Text>
									</TouchableOpacity>
								</View>
								<View style={styles.previewDebugBanner}>
									<Ionicons name="settings" size={22} color="#2563eb" />
									<View style={styles.previewDebugTextBlock}>
										<Text style={styles.previewDebugTitle}>Debug Mode Available</Text>
										<Text style={styles.previewDebugSub}>Enable event logs, state variables, and rule execution tracking in preview</Text>
									</View>
								</View>
							</View>
						</ScrollView>
					) : (
						<View style={styles.previewPlayer}>
							<GamePlayer
								definition={buildDefinition()}
								onComplete={() => {}}
								isActive={true}
							/>
						</View>
					)}
				</View>
			</Modal>

			{/* Publish Settings modal */}
			<Modal visible={showPublishSettings} animationType="slide">
				<View style={styles.publishSettingsContainer}>
					<View style={[styles.publishSettingsHeader, { paddingTop: insets.top + Spacing.sm }]}>
						<TouchableOpacity style={styles.backToEditButton} onPress={() => setShowPublishSettings(false)}>
							<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
							<Text style={styles.backToEditText}>Back</Text>
						</TouchableOpacity>
					</View>
					<ScrollView style={styles.publishSettingsScroll} contentContainerStyle={[styles.publishSettingsScrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}>
						<View style={styles.gameInfoCard}>
							<Text style={styles.gameInfoTitle}>Publish Settings</Text>
							<Text style={styles.gameInfoSubtitle}>Review and publish your game to the Kracked community</Text>

							<Text style={styles.publishSectionLabel}>Required Sections</Text>
							{stepCompleted.map((done, i) => (
								<View key={i} style={[styles.publishSectionRow, done ? styles.publishSectionRowOk : styles.publishSectionRowError]}>
									<Text style={[styles.publishSectionRowText, done ? styles.publishSectionRowTextOk : styles.publishSectionRowTextError]}>{PUBLISH_REQUIRED_LABELS[i]}</Text>
									{done ? <Ionicons name="checkmark-circle" size={22} color="#16a34a" /> : <Ionicons name="alert-circle" size={22} color="#b91c1c" />}
								</View>
							))}

							<Text style={[styles.publishSectionLabel, { marginTop: Spacing.xl }]}>Safety Checks</Text>
							<View style={[styles.publishSectionRow, styles.publishSectionRowOk]}>
								<Text style={styles.publishSectionRowTextOk}>No external links</Text>
								<Ionicons name="checkmark-circle" size={22} color="#16a34a" />
							</View>
							<View style={[styles.publishSectionRow, styles.publishSectionRowOk]}>
								<Text style={styles.publishSectionRowTextOk}>Content moderation passed</Text>
								<Ionicons name="checkmark-circle" size={22} color="#16a34a" />
							</View>
							<View style={[styles.publishSectionRow, styles.publishSectionRowOk]}>
								<Text style={styles.publishSectionRowTextOk}>Performance within limits</Text>
								<Ionicons name="checkmark-circle" size={22} color="#16a34a" />
							</View>
							<View style={[styles.publishSectionRow, winConditions.length >= 1 ? styles.publishSectionRowOk : styles.publishSectionRowError]}>
								<Text style={winConditions.length >= 1 ? styles.publishSectionRowTextOk : styles.publishSectionRowTextError}>Has win condition</Text>
								{winConditions.length >= 1 ? <Ionicons name="checkmark-circle" size={22} color="#16a34a" /> : <Ionicons name="alert-circle" size={22} color="#b91c1c" />}
							</View>

							<Text style={[styles.publishSectionLabel, { marginTop: Spacing.xl }]}>Social Features</Text>
							<View style={styles.publishSocialCard}>
								<Ionicons name="sparkles" size={24} color="#ea580c" />
								<View style={styles.publishSocialContent}>
									<Text style={styles.publishSocialTitle}>Allow Remixes</Text>
									<Text style={styles.publishSocialSub}>Let others copy and modify your game (with attribution)</Text>
								</View>
								<Switch value={allowRemixes} onValueChange={setAllowRemixes} trackColor={{ false: Colors.border, true: "#ea580c" }} thumbColor="#fff" />
							</View>
							<View style={styles.publishSocialCard}>
								<Ionicons name="chatbubbles" size={24} color="#ea580c" />
								<View style={styles.publishSocialContent}>
									<Text style={styles.publishSocialTitle}>Allow Comments</Text>
									<Text style={styles.publishSocialSub}>Enable comments and feedback on your game</Text>
								</View>
								<Switch value={allowComments} onValueChange={setAllowComments} trackColor={{ false: Colors.border, true: "#ea580c" }} thumbColor="#fff" />
							</View>

							{(!stepCompleted.every(Boolean) || winConditions.length < 1) && (
								<View style={styles.publishWarningCard}>
									<Ionicons name="warning" size={24} color="#b91c1c" />
									<View style={styles.publishWarningContent}>
										<Text style={styles.publishWarningTitle}>Cannot publish yet</Text>
										<Text style={styles.publishWarningSub}>Complete all required sections and pass safety checks first</Text>
									</View>
								</View>
							)}

							<TouchableOpacity
								style={[styles.publishGameButton, (!stepCompleted.every(Boolean) || winConditions.length < 1) && styles.publishGameButtonDisabled]}
								onPress={() => { if (stepCompleted.every(Boolean) && winConditions.length >= 1) { setShowPublishSettings(false); handleSubmit(); } }}
								disabled={!stepCompleted.every(Boolean) || winConditions.length < 1 || loading}
							>
								<Ionicons name="cloud-upload" size={24} color={stepCompleted.every(Boolean) && winConditions.length >= 1 ? Colors.text.primary : Colors.text.disabled} />
								<Text style={[styles.publishGameButtonText, (!stepCompleted.every(Boolean) || winConditions.length < 1) && styles.publishGameButtonTextDisabled]}>Publish Game</Text>
							</TouchableOpacity>

							<View style={styles.publishInfoCard}>
								<Ionicons name="eye" size={24} color="#2563eb" />
								<View style={styles.publishInfoContent}>
									<Text style={styles.publishInfoTitle}>Your game will appear in the feed</Text>
									<Text style={styles.publishInfoSub}>Players can play, like, comment, and remix your game once published</Text>
								</View>
							</View>
						</View>
					</ScrollView>
				</View>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Colors.background.secondary },
	keyboard: { flex: 1 },
	scroll: { flex: 1 },
	scrollContent: { padding: Layout.margin },
	label: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
		marginTop: Spacing.lg,
	},
	input: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	textArea: { minHeight: 80, textAlignVertical: "top" },
	rowButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		borderWidth: 1,
		borderColor: Colors.border,
		gap: Spacing.sm,
	},
	rowLabel: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, flex: 0 },
	rowValue: { flex: 1, fontSize: Typography.fontSize.body, color: Colors.text.primary },
	choiceRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: Spacing.sm },
	radio: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: Colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	radioSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "40" },
	choiceInput: {
		flex: 1,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	removeBtn: { padding: Spacing.xs },
	addChoice: { flexDirection: "row", alignItems: "center", marginTop: Spacing.sm, gap: Spacing.sm },
	addChoiceText: { fontSize: Typography.fontSize.body, color: Colors.accent, fontWeight: Typography.fontWeight.medium },
	diffRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
	diffBtn: {
		flex: 1,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.primary,
		borderWidth: 1,
		borderColor: Colors.border,
		alignItems: "center",
	},
	diffBtnSelected: { borderColor: "#eab308", backgroundColor: "#fef9c3" },
	diffText: { fontSize: Typography.fontSize.body, color: Colors.text.secondary },
	diffTextSelected: { color: Colors.accent, fontWeight: Typography.fontWeight.semiBold },
	previewButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		padding: Spacing.lg,
		marginTop: Spacing.xl,
		borderRadius: BorderRadius.lg,
		borderWidth: 2,
		borderColor: Colors.accent,
	},
	previewButtonText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.accent },
	submit: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.lg,
		gap: Spacing.sm,
	},
	submitDisabled: { opacity: 0.6 },
	submitText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },

	// Modals
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.lg,
	},
	modalContent: {
		width: "100%",
		maxWidth: 400,
		maxHeight: "80%",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		...Shadows.heavy,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	modalTitle: { fontSize: Typography.fontSize.h3, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	modalClose: { padding: Spacing.xs },
	modalScroll: { maxHeight: 400 },
	modalScrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
	modalHint: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: Spacing.md },
	modalLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.medium, color: Colors.text.primary, marginTop: Spacing.md, marginBottom: Spacing.sm },
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		marginBottom: Spacing.sm,
	},
	optionRowSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "15" },
	optionText: { fontSize: Typography.fontSize.body, color: Colors.text.primary },
	gridOptions: { marginTop: Spacing.md },
	timerOption: { marginTop: Spacing.md },
	instructionRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
	flex1: { flex: 1 },

	// New Game header
	newGameHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Colors.background.primary, borderBottomWidth: 1, borderBottomColor: Colors.border },
	newGameBack: { padding: Spacing.xs },
	newGameHeaderCenter: { flex: 1, marginLeft: Spacing.sm },
	newGameTitle: { fontSize: Typography.fontSize.h2, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	newGameProgress: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	progressBarTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginTop: 4, overflow: "hidden" },
	progressBarFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 3 },
	newGameHeaderRight: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
	newGameIconBtn: { padding: Spacing.sm },
	previewIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },

	// Game Information (step 0)
	gameInfoCard: { marginTop: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.background.primary, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
	gameInfoTitle: { fontSize: Typography.fontSize.h2, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.xs },
	gameInfoSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: Spacing.xl },
	newGameLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary, marginBottom: Spacing.sm },
	fieldLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary, marginBottom: Spacing.sm },
	charHint: { fontSize: Typography.fontSize.small, color: Colors.text.disabled, marginTop: 2, marginBottom: Spacing.sm },
	charCountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: Spacing.lg },
	charCountHint: { fontSize: Typography.fontSize.small, color: Colors.text.disabled },
	charCountValue: { fontSize: Typography.fontSize.small, color: Colors.text.secondary },
	sectionLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
	sectionSpacer: { height: Spacing.xl },
	instructionsArea: { minHeight: 100 },
	playTimeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
	playTimeBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.background.secondary, borderWidth: 1, borderColor: Colors.border },
	playTimeBtnSelected: { borderColor: "#3b82f6", backgroundColor: "#3b82f620" },
	playTimeBtnText: { fontSize: Typography.fontSize.caption, color: Colors.text.primary },
	sliderTrack: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, position: "relative", marginBottom: Spacing.sm },
	sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#3b82f6", borderRadius: 4 },
	sliderThumb: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "#3b82f6", top: -6, marginLeft: -10 },
	playTimeValue: { fontSize: 28, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	playTimeAvgLabel: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2, marginBottom: Spacing.lg },
	tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm },
	tagsSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: Spacing.sm },
	tagPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, backgroundColor: Colors.background.secondary, borderWidth: 1, borderColor: Colors.border },
	tagPillSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "20" },
	tagPillText: { fontSize: Typography.fontSize.caption, color: Colors.text.primary },
	visibilityRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
	visibilityStack: { gap: Spacing.sm, marginBottom: Spacing.sm },
	visibilityCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background.secondary },
	visibilityPanel: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background.secondary },
	visibilityPanelSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "20" },
	visibilityCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "20" },
	visibilityLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	visibilitySub: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	visibilityCheck: { position: "absolute", top: Spacing.sm, right: Spacing.sm },
	moderationBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#0ea5e9", padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.xl, gap: Spacing.sm },
	moderationText: { fontSize: Typography.fontSize.caption, color: "#0ea5e9", flex: 1 },

	// Dynamic Behavior (step 4)
	behaviorSection: { marginTop: Spacing.md },
	behaviorSectionFirst: { marginTop: Spacing.sm },
	behaviorSectionSecond: { marginTop: Spacing.xl },
	behaviorSectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
	addRuleButton: { backgroundColor: "#eab308", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.md, flexShrink: 0 },
	addRuleButtonText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	spawnRulesEmpty: { backgroundColor: Colors.background.secondary, borderRadius: BorderRadius.md, padding: Spacing.xl, alignItems: "center", justifyContent: "center", minHeight: 140, borderWidth: 1, borderColor: Colors.border },
	spawnRulesEmptyIconWrap: { marginBottom: Spacing.sm },
	spawnRulesEmptyText: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	spawnRulesEmptyTextSub: { marginTop: 2 },
	spawnRulesList: { gap: Spacing.sm },
	spawnRuleCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.background.secondary, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
	spawnRuleTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	spawnRuleDetail: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	spawnRuleRemove: { padding: Spacing.xs },
	movementPresetGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
	movementPresetBtn: { flex: 1, minWidth: "47%", minHeight: 48, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.background.secondary, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
	movementPresetBtnSelected: { borderWidth: 2, borderColor: "#eab308", backgroundColor: "#fef9c3" },
	movementPresetBtnText: { fontSize: Typography.fontSize.body, color: Colors.text.secondary },
	movementPresetBtnTextSelected: { color: "#92400e", fontWeight: Typography.fontWeight.semiBold },

	// Rule Engine (step 5)
	ruleEngineInfoBox: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#eff6ff",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.md,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#bfdbfe",
	},
	ruleEngineInfoText: { flex: 1, fontSize: Typography.fontSize.caption, color: "#1e40af", lineHeight: 20 },
	ruleEngineRulesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.xl, marginBottom: Spacing.sm },
	addRuleEngineButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		backgroundColor: "#eab308",
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm + 2,
		borderRadius: BorderRadius.md,
	},
	addRuleEngineButtonText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	ruleEngineEmpty: { paddingVertical: Spacing.xl, alignItems: "center" },
	ruleEngineEmptyText: { fontSize: Typography.fontSize.body, color: Colors.text.secondary },
	ruleEngineList: { gap: Spacing.md },
	ruleEngineCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		borderColor: "#eab308",
		borderLeftWidth: 4,
		padding: Spacing.md,
		...Shadows.light,
	},
	ruleEngineCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
	ruleEngineCardTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	ruleEngineCardNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#eab308", alignItems: "center", justifyContent: "center" },
	ruleEngineCardNumberText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	ruleEngineCardTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	ruleEngineCardDelete: { padding: Spacing.xs },
	ruleEngineCardLabel: { fontSize: Typography.fontSize.caption, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.secondary, marginBottom: Spacing.xs, marginTop: Spacing.sm },
	ruleEngineTriggerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.sm,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	ruleEngineTriggerText: { fontSize: Typography.fontSize.body, color: Colors.text.primary },
	ruleEngineTriggerDropdown: { marginTop: 4, backgroundColor: "#374151", borderRadius: BorderRadius.sm, overflow: "hidden", ...Shadows.medium },
	ruleEngineTriggerOption: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
	ruleEngineTriggerOptionText: { fontSize: Typography.fontSize.body, color: "#fff" },
	ruleEngineTriggerOptionTextSelected: { fontWeight: Typography.fontWeight.semiBold },
	ruleEnginePlaceholder: { backgroundColor: Colors.background.secondary, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
	ruleEnginePlaceholderText: { fontSize: Typography.fontSize.caption, color: Colors.text.disabled },
	ruleEnginePlaceholderWarning: { backgroundColor: "#fef2f2", borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: "#fecaca" },
	ruleEnginePlaceholderWarningText: { fontSize: Typography.fontSize.caption, color: "#b91c1c" },
	ruleEngineSummaryBar: { backgroundColor: "#dcfce7", borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.xl, borderWidth: 1, borderColor: "#86efac" },
	ruleEngineSummaryText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.medium, color: "#166534", textAlign: "center" },

	// Win & Lose Conditions (step 6)
	winLoseAlertBox: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#fef2f2",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.md,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#fecaca",
	},
	winLoseAlertTextBlock: { flex: 1 },
	winLoseAlertTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#b91c1c" },
	winLoseAlertSub: { fontSize: Typography.fontSize.caption, color: "#b91c1c", marginTop: 2 },
	winLoseSection: { marginTop: Spacing.xl },
	winLoseSectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
	winLoseEmptyWin: { backgroundColor: "#fef2f2", borderRadius: BorderRadius.sm, padding: Spacing.md, marginBottom: Spacing.sm },
	winLoseEmptyWinText: { fontSize: Typography.fontSize.caption, color: "#b91c1c" },
	winLoseEmptyLose: { backgroundColor: Colors.background.secondary, borderRadius: BorderRadius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
	winLoseEmptyLoseText: { fontSize: Typography.fontSize.caption, color: Colors.text.disabled },
	winLoseConditionList: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm },
	winLoseConditionChip: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, backgroundColor: Colors.background.secondary, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.pill, borderWidth: 1, borderColor: Colors.border },
	winLoseConditionChipText: { fontSize: Typography.fontSize.caption, color: Colors.text.primary },
	winLoseAddLabel: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: Spacing.sm },
	winLoseButtonGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
	winLoseButtonGridThree: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
	winLoseAddBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		backgroundColor: Colors.background.primary,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		minWidth: "31%",
		flex: 1,
		...Shadows.light,
	},
	winLoseAddBtnTwo: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		backgroundColor: Colors.background.primary,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		minWidth: "47%",
		flex: 1,
		...Shadows.light,
	},
	winLoseAddBtnText: { fontSize: Typography.fontSize.caption, color: Colors.text.primary, flex: 1 },
	winLoseDivider: { height: 1, backgroundColor: Colors.border, marginTop: Spacing.xl, marginBottom: Spacing.sm },

	// Content Packs (step 7)
	contentPackAddLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
	contentPackGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
	contentPackTypeCard: {
		width: "47%",
		minWidth: "47%",
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border,
		...Shadows.light,
	},
	contentPackTypeIconWrap: { marginBottom: Spacing.sm },
	contentPackTypeTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	contentPackTypeSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	contentPackYourLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
	contentPackEmpty: { paddingVertical: Spacing.md },
	contentPackEmptyText: { fontSize: Typography.fontSize.caption, color: Colors.text.disabled },
	contentPackList: { gap: Spacing.sm },
	contentPackCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fef9c3",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: "#eab308",
	},
	contentPackCardContent: { flex: 1 },
	contentPackCardTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	contentPackCardSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	contentPackCardRemove: { padding: Spacing.xs },

	// Objects & Assets (step 2)
	objectsCard: { marginTop: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.background.primary, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.light },
	objectsSectionTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.md },
	objectTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginBottom: Spacing.lg },
	objectTypeCard: {
		width: "47%",
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.background.primary,
	},
	objectTypeCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "12" },
	objectTypeCardTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: 4 },
	objectTypeCardDesc: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	addObjectTypeBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		backgroundColor: "#eab308",
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.md,
		marginBottom: Spacing.xl,
	},
	addObjectTypeBtnDisabled: { opacity: 0.5 },
	addObjectTypeBtnText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#fff" },
	yourObjectsEmpty: {
		padding: Spacing.xxl,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.border,
		borderStyle: "dashed",
		alignItems: "center",
		justifyContent: "center",
		minHeight: 140,
	},
	yourObjectsEmptyText: { fontSize: Typography.fontSize.caption, color: Colors.text.disabled, marginTop: Spacing.md, textAlign: "center" },
	yourObjectsList: { gap: Spacing.sm },
	yourObjectCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.background.primary,
	},
	yourObjectCardContent: { flex: 1 },
	yourObjectCardName: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	yourObjectCardType: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	yourObjectDelete: { padding: Spacing.sm },

	// Board Configuration (step 1)
	boardConfigSection: { marginTop: Spacing.lg },
	boardConfigTitle: { fontSize: Typography.fontSize.h2, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.xs },
	boardConfigSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: Spacing.lg },
	boardConfigRequired: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary, marginBottom: Spacing.md },
	boardCardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginBottom: Spacing.lg },
	boardCard: { width: "47%", backgroundColor: Colors.background.primary, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.light },
	boardCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "15" },
	boardCardCheck: { position: "absolute", top: Spacing.sm, right: Spacing.sm, zIndex: 1 },
	boardCardIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.background.secondary, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
	boardCardTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: 4 },
	boardCardDesc: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: 4 },
	boardCardExamples: { fontSize: 11, color: Colors.text.disabled },
	inlineSettingsBlock: { marginBottom: Spacing.lg },
	inlineSettingsTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.md },
	gridMaxHint: { fontSize: Typography.fontSize.small, color: Colors.text.disabled, marginTop: 2, marginBottom: Spacing.sm },
	segmentRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
	segmentBtn: { flex: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.background.secondary, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
	segmentBtnSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "25" },
	segmentBtnText: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },
	segmentBtnTextSelected: { color: Colors.text.primary, fontWeight: Typography.fontWeight.semiBold },
	gridPreviewBox: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: "#dcfce7" },
	gridPreviewText: { fontSize: Typography.fontSize.body, color: Colors.text.primary },
	platformLimitsBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.accent + "18", padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
	platformLimitsContent: { flex: 1 },
	platformLimitsTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: 4 },
	platformLimitsBullet: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginBottom: 2 },

	// Interaction Modes (step 3)
	interactionSection: { marginTop: Spacing.lg },
	interactionSectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: Spacing.sm },
	interactionIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.accent + "30", alignItems: "center", justifyContent: "center" },
	interactionSectionTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	interactionChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background.secondary },
	interactionErrorBox: { marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: "#fef2f2" },
	interactionErrorText: { fontSize: Typography.fontSize.body, color: Colors.error },
	chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
	chip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background.secondary },
	chipSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + "20" },
	chipText: { fontSize: Typography.fontSize.caption, color: Colors.text.primary },

	// Step nav
	stepNav: { flexDirection: "row", alignItems: "center", marginTop: Spacing.xl, paddingHorizontal: Spacing.md, gap: Spacing.md },
	stepNavBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, padding: Spacing.sm },
	stepNavText: { fontSize: Typography.fontSize.body, color: Colors.accent, fontWeight: Typography.fontWeight.medium },
	stepNavBtnPrimary: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, backgroundColor: "#22c55e", paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
	stepNavTextPrimary: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: "#fff" },

	// Step list modal (left-side overlay)
	stepListOverlay: { flex: 1, flexDirection: "row" },
	stepListBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
	stepListPanel: {
		width: "85%",
		maxWidth: 360,
		height: "100%",
		backgroundColor: Colors.background.primary,
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius: 0,
		...Shadows.heavy,
	},
	stepListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
	stepListHeaderBtn: { padding: Spacing.sm },
	stepListHeaderRight: { flexDirection: "row", alignItems: "center" },
	stepListProgressBlock: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
	stepListScroll: { flex: 1, minHeight: 0 },
	stepListScrollContent: { paddingBottom: Spacing.xxl, paddingTop: Spacing.sm },
	stepListItem: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.md },
	stepListIconWrap: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.background.secondary, alignItems: "center", justifyContent: "center" },
	stepListIconRedDot: { borderWidth: 2, borderColor: Colors.error },
	stepListLabel: { flex: 1 },
	stepListTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	stepListRequired: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary },

	// Preview
	previewContainer: { flex: 1, backgroundColor: Colors.background.secondary },
	previewHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
		backgroundColor: Colors.background.primary,
	},
	backToEditButton: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm },
	backToEditText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.semiBold, color: Colors.text.primary },
	previewPlayer: { flex: 1 },
	previewScroll: { flex: 1 },
	previewScrollContent: { padding: Layout.margin, paddingTop: Spacing.lg },
	previewTestingCard: { backgroundColor: Colors.background.primary, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
	previewTestingRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
	previewModeCard: {
		flex: 1,
		backgroundColor: "#fef9c3",
		borderRadius: BorderRadius.md,
		padding: Spacing.lg,
		borderWidth: 2,
		borderColor: "#eab308",
		alignItems: "center",
		minHeight: 120,
	},
	previewModeIconWrap: { marginBottom: Spacing.sm },
	previewModeTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	previewModeSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 4 },
	autoTestCard: {
		flex: 1,
		backgroundColor: "#dbeafe",
		borderRadius: BorderRadius.md,
		padding: Spacing.lg,
		borderWidth: 2,
		borderColor: "#2563eb",
		alignItems: "center",
		minHeight: 120,
	},
	autoTestIconWrap: { marginBottom: Spacing.sm },
	autoTestTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	autoTestSubtitle: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 4 },
	previewDebugBanner: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#dbeafe",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.xl,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#93c5fd",
	},
	previewDebugTextBlock: { flex: 1 },
	previewDebugTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#1e40af" },
	previewDebugSub: { fontSize: Typography.fontSize.caption, color: "#1e40af", marginTop: 2, lineHeight: 20 },

	// Publish Settings
	publishSettingsContainer: { flex: 1, backgroundColor: Colors.background.secondary },
	publishSettingsHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
		backgroundColor: Colors.background.primary,
	},
	publishSettingsScroll: { flex: 1 },
	publishSettingsScrollContent: { padding: Layout.margin, paddingTop: Spacing.lg },
	publishSectionLabel: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
	publishSectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs },
	publishSectionRowError: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" },
	publishSectionRowOk: { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac" },
	publishSectionRowText: { fontSize: Typography.fontSize.body, color: Colors.text.primary },
	publishSectionRowTextError: { fontSize: Typography.fontSize.body, color: "#b91c1c" },
	publishSectionRowTextOk: { fontSize: Typography.fontSize.body, color: "#166534" },
	publishSocialCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff7ed",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: Spacing.sm,
		borderWidth: 1,
		borderColor: "#fed7aa",
		gap: Spacing.sm,
	},
	publishSocialContent: { flex: 1 },
	publishSocialTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: Colors.text.primary },
	publishSocialSub: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
	publishWarningCard: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#fef2f2",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#fecaca",
	},
	publishWarningContent: { flex: 1 },
	publishWarningTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#b91c1c" },
	publishWarningSub: { fontSize: Typography.fontSize.caption, color: "#b91c1c", marginTop: 2 },
	publishGameButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#dcfce7",
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.xl,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#86efac",
	},
	publishGameButtonDisabled: { opacity: 0.7 },
	publishGameButtonText: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#166534" },
	publishGameButtonTextDisabled: { color: Colors.text.disabled },
	publishInfoCard: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#dbeafe",
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		gap: Spacing.sm,
		borderWidth: 1,
		borderColor: "#93c5fd",
	},
	publishInfoContent: { flex: 1 },
	publishInfoTitle: { fontSize: Typography.fontSize.body, fontWeight: Typography.fontWeight.bold, color: "#1e40af" },
	publishInfoSub: { fontSize: Typography.fontSize.caption, color: Colors.text.secondary, marginTop: 2 },
});

export default CreateCustomPage;
