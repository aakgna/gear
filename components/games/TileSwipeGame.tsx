import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Animated,
	ScrollView,
	Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameResult, SequencingData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	getGameColor,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SwipeSwapWordsProps {
	inputData: SequencingData; // We expect (inputData as any).words: string[]
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
	initialCompletedResult?: GameResult | null;
}

const SwipeSwapWordsGame: React.FC<SwipeSwapWordsProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
	initialCompletedResult,
}) => {
	const insets = useSafeAreaInsets();
	const BOTTOM_NAV_HEIGHT = 70;
	const gameColor = getGameColor("sequencing");

	// Defensive access to words array (we expect inputData.words)
	const words: string[] = (inputData as any).words || [];
	const numRows = words?.length ?? 0;

	// Required state variables
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [attempts, setAttempts] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);
	const shakeAnimation = useRef(new Animated.Value(0)).current;
	const successScale = useRef(new Animated.Value(1)).current;

	// Game-specific state
	const [arrangements, setArrangements] = useState<string[][]>(() =>
		(words || []).map((w) => shuffleToArray((w || "").toUpperCase()))
	);
	const [rowStatus, setRowStatus] = useState<("empty" | "invalid" | "correct")[]>(
		() => new Array(numRows).fill("empty")
	);
	const [completed, setCompleted] = useState(false);

	// Selection state to allow swapping any two letters (tap to select, tap another to swap)
	const [selectedTile, setSelectedTile] = useState<{
		row: number;
		idx: number;
	} | null>(null);

	// For swipe-based multi-index swaps, measure row container widths to estimate tile width
	const tileWidthRefs = useRef<Record<number, number>>({});

	// Puzzle signature (based on words)
	const puzzleSignature = (words || []).join(",");

	// Timer / puzzle-change effect (pattern)
	useEffect(() => {
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;

			if (initialCompletedResult?.completed && !initialCompletedResult?.answerRevealed) {
				// Restore completed state
				setCompleted(true);
				setElapsedTime(initialCompletedResult.timeTaken);
				setAttempts(initialCompletedResult.attempts || 0);
				// Restore arrangements to correct words
				setArrangements((words || []).map((w) => (w || "").toUpperCase().split("")));
				setRowStatus(new Array(numRows).fill("correct"));
				hasAttemptedRef.current = true;
				if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
				setStartTime(undefined);
			} else {
				// Fresh puzzle setup
				setElapsedTime(0);
				setCompleted(false);
				setAttempts(0);
				setArrangements((words || []).map((w) => shuffleToArray((w || "").toUpperCase())));
				setRowStatus(new Array(numRows).fill("empty"));
				hasAttemptedRef.current = false;
				if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
				setStartTime(propStartTime ?? undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			// startTime prop changed - update to maintain continuity
			setElapsedTime(Math.floor((Date.now() - propStartTime) / 1000));
			setStartTime(propStartTime);
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [puzzleSignature, propStartTime, startTime, initialCompletedResult]);

	// Timer tick effect (pattern)
	useEffect(() => {
		if (!startTime || completed || !isActive) {
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
			return;
		}
		if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);
		return () => {
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		};
	}, [completed, startTime, isActive]);

	// Format time helper (required pattern)
	const formatTime = (seconds: number): string => {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		return `${m}:${(seconds % 60).toString().padStart(2, "0")}`;
	};

	// Utility: shuffle string into array; ensure not equal to original if possible
	function shuffleToArray(word: string): string[] {
		const letters = (word || "").split("");
		if (letters.length <= 1) return letters;
		let shuffled = [...letters];
		let attemptsLocal = 0;
		do {
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
			attemptsLocal++;
			// avoid infinite loop for words with repeated letters
			if (attemptsLocal > 10) break;
		} while (shuffled.join("") === letters.join(""));
		return shuffled;
	}

	// Swap any two indices in a row
	const swapInRow = (rowIdx: number, i: number, j: number) => {
		if (completed) return;
		const row = arrangements[rowIdx] ? [...arrangements[rowIdx]] : [];
		if (i < 0 || j < 0 || i >= row.length || j >= row.length) return;
		// perform swap
		[row[i], row[j]] = [row[j], row[i]];
		const newArr = [...arrangements];
		newArr[rowIdx] = row;
		setArrangements(newArr);

		// Track attempts as user interacted
		setAttempts((a) => a + 1);
		if (!hasAttemptedRef.current && puzzleId) {
			hasAttemptedRef.current = true;
			if (onAttempt) onAttempt(puzzleId);
		}

		// Validate this row
		validateRow(rowIdx, row);
	};

	// Validate a single row against target word
	const validateRow = (rowIdx: number, rowArr?: string[]) => {
		const target = ((words && words[rowIdx]) || "").toUpperCase();
		const current = (rowArr || arrangements[rowIdx] || []).join("");
		const status = current === target ? "correct" : "empty";
		const newStatus = [...rowStatus];
		newStatus[rowIdx] = status as any;
		setRowStatus(newStatus);

		// If just turned correct, animate
		if (status === "correct") {
			Animated.sequence([
				Animated.timing(successScale, {
					toValue: 1.05,
					duration: Animation.duration.fast,
					useNativeDriver: true,
				}),
				Animated.timing(successScale, {
					toValue: 1,
					duration: Animation.duration.normal,
					useNativeDriver: true,
				}),
			]).start();
		}

		// Check overall completion
		const allCorrect = newStatus.every((s) => s === "correct");
		if (allCorrect && !completed) {
			// Stop timer and mark completed
			const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
			setElapsedTime(timeTaken);
			setCompleted(true);
			onComplete({
				puzzleId: puzzleId || `swapeswap_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts + 1,
				completedAt: new Date().toISOString(),
			});
		}
	};

	// Handle taps for selection/swap behavior
	const handleTileTap = (rowIdx: number, idx: number) => {
		if (completed) return;

		// If nothing selected, select this tile
		if (!selectedTile) {
			setSelectedTile({ row: rowIdx, idx });
			return;
		}

		// If a tile is already selected
		if (selectedTile.row === rowIdx) {
			// same row -> swap
			if (selectedTile.idx === idx) {
				// tapped same tile -> deselect
				setSelectedTile(null);
				return;
			}
			swapInRow(rowIdx, selectedTile.idx, idx);
			setSelectedTile(null);
			return;
		}

		// Different row selected -> change selection to this tile
		setSelectedTile({ row: rowIdx, idx });
	};

	// Tile responder: handle swipe (multi-index swap) or small movement -> treat as tap
	const startXRefs = useRef<Record<string, number | undefined>>({});
	const handleTileResponderGrant = (rowIdx: number, idx: number, e: any) => {
		startXRefs.current[`${rowIdx}-${idx}`] = e.nativeEvent.pageX;
	};

	const handleTileResponderRelease = (rowIdx: number, idx: number, e: any) => {
		const startX = startXRefs.current[`${rowIdx}-${idx}`];
		const endX = e.nativeEvent.pageX;
		const dx = endX - (startX ?? endX);
		const threshold = 12; // minimal swipe distance to differentiate from tap

		if (Math.abs(dx) <= threshold) {
			// treat as tap
			handleTileTap(rowIdx, idx);
		} else {
			// compute approximate target index based on measured tile width
			const tileWidth = tileWidthRefs.current[rowIdx] || 44;
			const shift = Math.round(dx / tileWidth);
			let targetIdx = idx + shift;
			const rowLen = arrangements[rowIdx]?.length || 1;
			if (targetIdx < 0) targetIdx = 0;
			if (targetIdx >= rowLen) targetIdx = rowLen - 1;
			if (targetIdx === idx) {
				// no effective change, treat as tap (select)
				handleTileTap(rowIdx, idx);
			} else {
				swapInRow(rowIdx, idx, targetIdx);
			}
		}
		startXRefs.current[`${rowIdx}-${idx}`] = undefined;
	};

	// Clear function to reshuffle a row
	const reshuffleRow = (rowIdx: number) => {
		if (completed) return;
		const original = (words[rowIdx] || "").toUpperCase();
		const shuffled = shuffleToArray(original);
		const newArr = [...arrangements];
		newArr[rowIdx] = shuffled;
		setArrangements(newArr);
		setRowStatus((s) => {
			const copy = [...s];
			copy[rowIdx] = "empty";
			return copy;
		});
		setSelectedTile(null);
	};

	// Render helpers
	const renderRow = (rowIdx: number) => {
		const row = arrangements[rowIdx] || [];
		const status = rowStatus[rowIdx] || "empty";
		const isCorrect = status === "correct";

		return (
			<View key={`row-${rowIdx}`} style={styles.wordRow}>
				<View
					style={[
						styles.wordCard,
						isCorrect && styles.wordCardCorrect,
						{ borderColor: isCorrect ? Colors.game.correct : "#E5E5E5" },
					]}
					onLayout={(e) => {
						// Measure container width to estimate tile width for swipe calculations
						const w = e.nativeEvent.layout.width;
						const count = Math.max(1, row.length);
						tileWidthRefs.current[rowIdx] = Math.floor(w / count);
					}}
				>
					<View style={styles.letterRow}>
						{row.map((letter, idx) => {
							const isSelected = selectedTile?.row === rowIdx && selectedTile?.idx === idx;
							return (
								<View
									key={`r${rowIdx}c${idx}`}
									style={[
										styles.tile,
										isCorrect && styles.tileCorrect,
										isSelected && styles.tileSelected,
										{ minWidth: 44, minHeight: 60 },
									]}
									onStartShouldSetResponder={() => true}
									onResponderGrant={(e) => handleTileResponderGrant(rowIdx, idx, e)}
									onResponderRelease={(e) => handleTileResponderRelease(rowIdx, idx, e)}
								>
									<Text
										style={[
											styles.tileText,
											isCorrect && styles.tileTextCorrect,
											isSelected && styles.tileTextSelected,
										]}
									>
										{letter}
									</Text>
								</View>
							);
						})}
					</View>

					<View style={styles.rowControls}>
						<TouchableOpacity
							style={styles.smallButton}
							onPress={() => reshuffleRow(rowIdx)}
							activeOpacity={0.7}
						>
							<Text style={styles.smallButtonText}>↻</Text>
						</TouchableOpacity>

						{/* Removed target word display per request - keep row index as subtle hint */}
						<Text style={styles.rowIndexLabel}>Row {rowIdx + 1}</Text>

						{isCorrect ? (
							<Text style={styles.statusText}>✓</Text>
						) : (
							<TouchableOpacity
								style={styles.checkButton}
								onPress={() => validateRow(rowIdx)}
								activeOpacity={0.7}
							>
								<Text style={styles.checkButtonText}>Check</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>
			</View>
		);
	};

	// Bottom padding for safe area
	const bottomPadding = BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg;

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
			showsVerticalScrollIndicator={false}
		>
			<Animated.View
				style={[
					styles.gameContainer,
					{
						transform: [{ translateX: shakeAnimation }, { scale: successScale }],
					},
				]}
			>
				<GameHeader
					title="Swipe Swap Words"
					elapsedTime={elapsedTime}
					showDifficulty={false}
					gameType="sequencing"
					puzzleId={puzzleId}
				/>

				<View style={styles.instructionsContainer}>
					<Text style={styles.instructions}>
						Tap a letter to select it, then tap another letter in the same row to swap them.
						You can also swipe a letter horizontally to move it multiple positions.
						Form each hidden target word to light the row green.
					</Text>
				</View>

				<View style={styles.rowsContainer}>
					{(arrangements || []).map((_, idx) => renderRow(idx))}
				</View>

				{(completed || false) && onShowStats && (
					<TouchableOpacity
						style={styles.viewStatsButton}
						onPress={onShowStats}
						activeOpacity={0.7}
					>
						<Text style={styles.viewStatsButtonText}>View Stats</Text>
					</TouchableOpacity>
				)}
			</Animated.View>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	contentContainer: {
		padding: Spacing.lg,
	},
	gameContainer: {
		alignItems: "center",
	},
	instructionsContainer: {
		width: "100%",
		marginBottom: Spacing.md,
	},
	instructions: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		textAlign: "center",
	},
	rowsContainer: {
		width: "100%",
		gap: Spacing.md,
	},
	wordRow: {
		width: "100%",
		marginBottom: Spacing.md,
	},
	wordCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.md,
		borderWidth: 2,
		borderColor: "#E5E5E5",
		...Shadows.medium,
	},
	wordCardCorrect: {
		backgroundColor: Colors.game.correct + "20",
		borderColor: Colors.game.correct,
	},
	letterRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.sm,
		flexWrap: "nowrap",
	},
	tile: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.md,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.sm,
		...Shadows.light,
		minWidth: 44,
		minHeight: 60,
	},
	tileSelected: {
		borderColor: "#2563EB", // blue highlight when selected
		borderWidth: 2.5,
		backgroundColor: "#2563EB10",
	},
	tileCorrect: {
		backgroundColor: Colors.game.correct,
		borderColor: Colors.game.correct,
	},
	tileText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: 2,
	},
	tileTextCorrect: {
		color: Colors.text.white,
	},
	tileTextSelected: {
		color: "#0f172a",
		fontWeight: Typography.fontWeight.bold,
	},
	rowControls: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: Spacing.sm,
	},
	smallButton: {
		width: 44,
		height: 36,
		borderRadius: BorderRadius.md,
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		justifyContent: "center",
		alignItems: "center",
		...Shadows.light,
	},
	smallButtonText: {
		fontSize: Typography.fontSize.h3,
	},
	rowIndexLabel: {
		flex: 1,
		textAlign: "center",
		color: Colors.text.secondary,
		fontSize: Typography.fontSize.caption,
	},
	statusText: {
		fontSize: Typography.fontSize.h2,
		color: Colors.game.correct,
		fontWeight: Typography.fontWeight.bold,
	},
	checkButton: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		...Shadows.light,
	},
	checkButtonText: {
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.bold,
	},
	viewStatsButton: {
		marginTop: Spacing.xl,
		backgroundColor: "#8B5CF6", // reuse sequencing color style
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.xl,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		...Shadows.medium,
	},
	viewStatsButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
});

export default SwipeSwapWordsGame;