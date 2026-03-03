import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameResult } from "../../config/types";
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

interface CrosswordWord {
  id: number;
  word: string; // solution word (uppercase expected)
  clue: string;
  row: number; // 0-based
  col: number; // 0-based
  direction: "across" | "down";
  length: number;
}

interface CrosswordData {
  rows: number;
  cols: number;
  words: CrosswordWord[];
  givens?: { row: number; col: number; letter: string }[]; // optional prefilled letters
  themeHint?: string;
  title?: string;
}

interface CrosswordGameProps {
  inputData: CrosswordData;
  onComplete: (result: GameResult) => void;
  onAttempt?: (puzzleId: string) => void;
  startTime?: number;
  puzzleId?: string;
  onShowStats?: () => void;
  isActive?: boolean;
  initialCompletedResult?: GameResult | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CrosswordGame: React.FC<CrosswordGameProps> = ({
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
  const gameColor = getGameColor("crossword");

  // Defensive access
  const rows = inputData.rows ?? 7;
  const cols = inputData.cols ?? 7;
  const words = inputData.words || [];
  const givens = inputData.givens || [];
  const themeHint = inputData.themeHint || "";
  const title = inputData.title || "Crossword";

  // Initialize empty grid (strings) - "" for empty, letter for filled
  const initializeGrid = (): string[][] => {
    const g: string[][] = [];
    for (let r = 0; r < rows; r++) {
      g[r] = [];
      for (let c = 0; c < cols; c++) {
        g[r][c] = "";
      }
    }
    // Put givens
    for (const gv of givens) {
      if (
        gv.row >= 0 &&
        gv.row < rows &&
        gv.col >= 0 &&
        gv.col < cols &&
        gv.letter
      ) {
        g[gv.row][gv.col] = (gv.letter || "").toUpperCase();
      }
    }
    return g;
  };

  const [userGrid, setUserGrid] = useState<string[][]>(initializeGrid);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Required refs/state per patterns
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const puzzleIdRef = useRef<string>("");
  const hasAttemptedRef = useRef(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  // Input refs per cell for direct typing
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // Build puzzleSignature similar to grid games - include words so change detection works
  const puzzleSignature = `${rows}-${cols}-${words
    .map((w) => `${(w.word || "").toUpperCase()}:${w.row},${w.col},${w.direction}`)
    .join("|")}`;

  // Reset / restore when puzzle changes (pattern)
  useEffect(() => {
    if (puzzleIdRef.current !== puzzleSignature) {
      puzzleIdRef.current = puzzleSignature;

      if (initialCompletedResult?.completed && !initialCompletedResult.answerRevealed) {
        // Restore completed state without revealing answer
        setCompleted(true);
        setAnswerRevealed(false);
        setElapsedTime(initialCompletedResult.timeTaken);
        setAttempts(initialCompletedResult.attempts || 0);

        // Fill grid with solutions (but not flagged as answerRevealed)
        const restored = initializeGrid();
        for (const w of words) {
          const sol = (w.word || "").toUpperCase();
          for (let i = 0; i < w.length; i++) {
            const r = w.direction === "across" ? w.row : w.row + i;
            const c = w.direction === "across" ? w.col + i : w.col;
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              restored[r][c] = sol[i];
            }
          }
        }
        setUserGrid(restored);
        hasAttemptedRef.current = true;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setStartTime(undefined);
      } else {
        // New puzzle: reset grid and states
        setElapsedTime(0);
        setCompleted(false);
        setAnswerRevealed(false);
        setUserGrid(initializeGrid());
        setSelectedCell(null);
        setFeedback(null);
        setAttempts(0);
        hasAttemptedRef.current = false;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setStartTime(propStartTime ?? undefined);
      }
    } else if (propStartTime && startTime !== propStartTime) {
      // startTime prop changed - resume
      setElapsedTime(Math.floor((Date.now() - propStartTime) / 1000));
      setStartTime(propStartTime);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } else if (!propStartTime && startTime !== undefined) {
      setStartTime(undefined);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleSignature, propStartTime, startTime, initialCompletedResult]);

  // Timer tick effect
  useEffect(() => {
    if (!startTime || completed || !isActive) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [completed, startTime, isActive]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return `${m}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  // Utility: check if a cell is part of any word
  const isCellPlayable = (r: number, c: number): boolean => {
    for (const w of words) {
      if (w.direction === "across") {
        if (r === w.row && c >= w.col && c < w.col + w.length) return true;
      } else {
        if (c === w.col && r >= w.row && r < w.row + w.length) return true;
      }
    }
    return false;
  };

  // Utility: find number to display (word id) if a word starts at this cell
  // Note: returns the minimum id of any word that starts at this cell; across & down may share same id if user provided that way.
  const getCellNumber = (r: number, c: number): number | null => {
    const startingWords = words.filter((w) => w.row === r && w.col === c);
    if (startingWords.length === 0) return null;
    return Math.min(...startingWords.map((w) => w.id));
  };

  // Read a word from the grid (user letters)
  const readUserWord = (w: CrosswordWord): string => {
    let out = "";
    for (let i = 0; i < w.length; i++) {
      const r = w.direction === "across" ? w.row : w.row + i;
      const c = w.direction === "across" ? w.col + i : w.col;
      if (userGrid[r] && typeof userGrid[r][c] === "string") {
        out += (userGrid[r][c] || "").toUpperCase();
      } else {
        out += "";
      }
    }
    return out;
  };

  // Determine if a word is currently fully filled (for dynamic crossing-out)
  const isWordFilled = (w: CrosswordWord): boolean => {
    const uw = readUserWord(w) || "";
    if (uw.length !== w.length) return false;
    for (let i = 0; i < uw.length; i++) {
      if (!uw[i] || uw[i].trim() === "") return false;
    }
    return true;
  };

  // Handler when a single cell letter changes
  const handleCellChange = (r: number, c: number, value: string) => {
    if (completed || answerRevealed) return;
    // Only letters allowed
    const letter = (value || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 1);
    setUserGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = letter;
      return next;
    });

    // Mark first attempt
    if (!hasAttemptedRef.current && letter && puzzleId) {
      hasAttemptedRef.current = true;
      if (onAttempt) onAttempt(puzzleId);
    }

    setFeedback(null);
  };

  // Validate the entire puzzle
  const validateAll = () => {
    if (completed || answerRevealed) return;

    // Ensure all playable cells that are part of a word are filled
    for (const w of words) {
      const userWord = readUserWord(w);
      if (userWord.length !== w.length) {
        setFeedback("Please fill in all words before checking.");
        Animated.sequence([
          Animated.timing(shakeAnimation, { toValue: 5, duration: Animation.duration.fast, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: -5, duration: Animation.duration.fast, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: 0, duration: Animation.duration.fast, useNativeDriver: true }),
        ]).start();
        return;
      }
      for (let i = 0; i < userWord.length; i++) {
        if (!userWord[i] || userWord[i].trim() === "") {
          setFeedback("Please fill in all words before checking.");
          Animated.sequence([
            Animated.timing(shakeAnimation, { toValue: 5, duration: Animation.duration.fast, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: -5, duration: Animation.duration.fast, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 0, duration: Animation.duration.fast, useNativeDriver: true }),
          ]).start();
          return;
        }
      }
    }

    // Check correctness
    let allCorrect = true;
    for (const w of words) {
      const userWord = readUserWord(w);
      if (userWord !== (w.word || "").toUpperCase()) {
        allCorrect = false;
      }
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (allCorrect) {
      // Success
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      setElapsedTime(timeTaken);
      setCompleted(true);
      setFeedback("All correct! Well done!");
      Animated.sequence([
        Animated.timing(successScale, { toValue: 1.05, duration: Animation.duration.fast, useNativeDriver: true }),
        Animated.timing(successScale, { toValue: 1, duration: Animation.duration.normal, useNativeDriver: true }),
      ]).start();
      onComplete({
        puzzleId: puzzleId || `crossword_${Date.now()}`,
        completed: true,
        timeTaken,
        attempts: newAttempts,
        completedAt: new Date().toISOString(),
      });
    } else {
      setFeedback("Some words are incorrect. Keep trying.");
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 8, duration: Animation.duration.fast, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -8, duration: Animation.duration.fast, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: Animation.duration.fast, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleShowAnswer = () => {
    if (completed || answerRevealed) return;
    // Fill grid with solutions
    const revealedGrid = initializeGrid();
    for (const w of words) {
      const sol = (w.word || "").toUpperCase();
      for (let i = 0; i < w.length; i++) {
        const r = w.direction === "across" ? w.row : w.row + i;
        const c = w.direction === "across" ? w.col + i : w.col;
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          revealedGrid[r][c] = sol[i];
        }
      }
    }
    setUserGrid(revealedGrid);
    setAnswerRevealed(true);
    setCompleted(true);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    setElapsedTime(timeTaken);
    onComplete({
      puzzleId: puzzleId || `crossword_${Date.now()}`,
      completed: true,
      timeTaken,
      attempts: attempts + 1,
      completedAt: new Date().toISOString(),
      answerRevealed: true,
    });
  };

  // Calculate cell size to keep a tidy grid and a regular look
  const maxWidth = SCREEN_WIDTH - Spacing.xl * 2;
  const cellSize = Math.floor(Math.min(48, (maxWidth - (cols - 1) * 2) / cols));

  // Styles for a blocked (non-playable) cell - lighter so it's not a dark block but clearly out of play
  const isCellBlocked = (r: number, c: number) => !isCellPlayable(r, c);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <GameHeader
        title={title}
        elapsedTime={elapsedTime}
        showDifficulty={false}
        gameType="crossword"
        puzzleId={puzzleId}
      />

      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.gridPreviewContainer,
            { transform: [{ translateX: shakeAnimation }, { scale: successScale }] },
          ]}
        >
          <Text style={styles.hintLabel}>Theme hint:</Text>
          <Text style={styles.hintText}>{themeHint || "Solve the themed words"}</Text>

          <View style={styles.gridWrapper}>
            {Array.from({ length: rows }, (_, r) => (
              <View key={`row-${r}`} style={styles.gridRow}>
                {Array.from({ length: cols }, (_, c) => {
                  const playable = isCellPlayable(r, c);
                  const number = getCellNumber(r, c);
                  const given = givens.find((g) => g.row === r && g.col === c);
                  const letter = (userGrid[r] && userGrid[r][c]) || "";
                  const isStart = number !== null && playable;
                  const blocked = isCellBlocked(r, c);

                  return (
                    <View
                      key={`cell-${r}-${c}`}
                      style={[
                        styles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: blocked
                            ? "#F6F7F8"
                            : Colors.background.primary || "#ffffff",
                          borderColor: "#E5E7EB",
                        },
                      ]}
                    >
                      {/* Number in top-left if word starts here */}
                      {isStart && !blocked && (
                        <View style={styles.cellNumberBadge}>
                          <Text style={[styles.cellNumberText, blocked && { color: "#000000" }]}>
                            {number}
                          </Text>
                        </View>
                      )}

                      {/* Given letter (immutable) */}
                      {blocked ? (
                        // Render a faint indicator for blocked cells (not black)
                        <View style={styles.blockFill} />
                      ) : given ? (
                        <Text style={[styles.cellText, { fontWeight: "900" }]}>
                          {given.letter.toUpperCase()}
                        </Text>
                      ) : !playable ? (
                        // Non-playable but not blocked (shouldn't happen) - invisible placeholder
                        <Text style={styles.cellTextHidden}>{" "}</Text>
                      ) : (
                        // Editable cell (TextInput)
                        <TextInput
                          ref={(ref) => (inputRefs.current[`${r}-${c}`] = ref)}
                          value={letter}
                          onChangeText={(t) => handleCellChange(r, c, t)}
                          editable={!completed && !answerRevealed}
                          style={[styles.cellInput, { width: cellSize, height: cellSize }]}
                          maxLength={1}
                          keyboardType="default"
                          autoCapitalize="characters"
                          underlineColorAndroid="transparent"
                          textAlign="center"
                          placeholder=""
                          placeholderTextColor={Colors.text.disabled}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.wordsContainer}>
          <Text style={styles.sectionTitle}>Clues</Text>

          <View style={styles.cluesBlock}>
            <Text style={styles.clueHeading}>Across</Text>
            {words
              .filter((w) => w.direction === "across")
              .map((w, idx) => {
                const filled = isWordFilled(w);
                return (
                  <View key={`ac-${w.id}-${idx}`} style={styles.clueRow}>
                    <Text style={styles.clueNumber}>{w.id}.</Text>
                    <Text
                      style={[
                        styles.clueText,
                        filled && styles.clueTextFilled,
                      ]}
                    >
                      {w.clue} ({w.length})
                    </Text>
                  </View>
                );
              })}

            <Text style={[styles.clueHeading, { marginTop: Spacing.md }]}>Down</Text>
            {words
              .filter((w) => w.direction === "down")
              .map((w, idx) => {
                const filled = isWordFilled(w);
                return (
                  <View key={`dn-${w.id}-${idx}`} style={styles.clueRow}>
                    <Text style={styles.clueNumber}>{w.id}.</Text>
                    <Text
                      style={[
                        styles.clueText,
                        filled && styles.clueTextFilled,
                      ]}
                    >
                      {w.clue} ({w.length})
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>

        {feedback && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {!completed && !answerRevealed ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: gameColor }]}
            onPress={validateAll}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Check Answers</Text>
          </TouchableOpacity>
        ) : (
          onShowStats && (
            <TouchableOpacity
              style={[styles.viewStatsButton, { backgroundColor: gameColor }]}
              onPress={onShowStats}
              activeOpacity={0.7}
            >
              <Text style={styles.viewStatsButtonText}>View Stats</Text>
            </TouchableOpacity>
          )
        )}

        {!completed && !answerRevealed && (
          <TouchableOpacity
            style={styles.showAnswerButton}
            onPress={handleShowAnswer}
            activeOpacity={0.7}
          >
            <Text style={styles.showAnswerText}>Show Answers</Text>
          </TouchableOpacity>
        )}

        {(completed || answerRevealed) && onShowStats && (
          <TouchableOpacity
            style={[styles.viewStatsButton, { backgroundColor: gameColor }]}
            onPress={onShowStats}
            activeOpacity={0.7}
          >
            <Text style={styles.viewStatsButtonText}>View Stats</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  gridPreviewContainer: {
    marginBottom: Spacing.lg,
  },
  hintLabel: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  hintText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.primary,
    fontStyle: "italic",
    marginBottom: Spacing.md,
  },
  gridWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  gridRow: {
    flexDirection: "row",
  },
  cell: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
    borderRadius: 4,
    ...Shadows.light,
    position: "relative",
    overflow: "hidden",
  },
  blockFill: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  cellNumberBadge: {
    position: "absolute",
    left: 2,
    top: 2,
    zIndex: 2,
  },
  cellNumberText: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  cellText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  cellTextHidden: {
    color: "#000000",
  },
  cellInput: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
    includeFontPadding: false,
    padding: 0,
    margin: 0,
  },
  wordsContainer: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cluesBlock: {
    marginTop: Spacing.xs,
  },
  clueHeading: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  clueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  clueNumber: {
    width: 28,
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.bold,
  },
  clueText: {
    flex: 1,
    fontSize: Typography.fontSize.caption,
    color: Colors.text.primary,
  },
  clueTextFilled: {
    textDecorationLine: "line-through",
    color: Colors.text.secondary,
    opacity: 0.7,
  },
  feedbackContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.error + "15",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + "40",
  },
  feedbackText: {
    fontSize: Typography.fontSize.body,
    color: Colors.error,
    textAlign: "center",
    fontWeight: Typography.fontWeight.semiBold,
  },
  actionButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    ...Shadows.medium,
  },
  actionButtonText: {
    color: Colors.text.white,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
  },
  showAnswerButton: {
    marginTop: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
  },
  showAnswerText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
    textDecorationLine: "underline",
  },
  viewStatsButton: {
    marginTop: Spacing.xl,
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

export default CrosswordGame;