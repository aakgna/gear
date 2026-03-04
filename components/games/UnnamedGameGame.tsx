import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameResult, HangmanData } from "../../config/types";
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

const { width } = Dimensions.get("window");
const BOTTOM_NAV_HEIGHT = 70;

interface HangmanGameProps {
  inputData: HangmanData;
  onComplete: (result: GameResult) => void;
  onAttempt?: (puzzleId: string) => void;
  startTime?: number;
  puzzleId?: string;
  onShowStats?: () => void;
  isActive?: boolean;
  initialCompletedResult?: GameResult | null;
}

const ALPHABET_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const HangmanGame: React.FC<HangmanGameProps> = ({
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
  const gameColor = getGameColor("hangman");
  const maxWrongGuesses = 6;

  // Defensive access
  const normalizedAnswerInitial = (
    (inputData && inputData.answer) ||
    "HANGMAN"
  )
    .toString()
    .toUpperCase();
  const hintText = inputData?.hint || "";

  // puzzle signature pattern
  const puzzleSignature = `${(inputData?.answer || "").toString().toUpperCase()}-${(
    inputData?.hint || ""
  ).toString()}`;

  // refs & timer
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const puzzleIdRef = useRef<string>("");
  const hasAttemptedRef = useRef(false);
  const answerRef = useRef<string>(normalizedAnswerInitial);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  // state
  const [answer, setAnswer] = useState<string>(normalizedAnswerInitial);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<number>(0);
  const [hiddenWord, setHiddenWord] = useState<string>("");
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
  const [elapsedTime, setElapsedTime] = useState(0);

  // keep answerRef in sync
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  // masking helper
  const maskWithGuesses = (ans: string, used: string[]) => {
    const letters = ans.split("");
    return letters
      .map((ch) => {
        if (/[^A-Z]/i.test(ch)) {
          return ch;
        }
        return used.includes(ch.toUpperCase()) ? ch.toUpperCase() : "_";
      })
      .join(" ");
  };

  // puzzle-change effect + restore logic (exact pattern)
  useEffect(() => {
    if (puzzleIdRef.current !== puzzleSignature) {
      puzzleIdRef.current = puzzleSignature;

      const normalizedAnswer = (
        (inputData && inputData.answer) ||
        "HANGMAN"
      )
        .toString()
        .toUpperCase();

      if (initialCompletedResult?.completed) {
        // Restore from initialCompletedResult
        let restoredGuesses: string[] = [];
        if (Array.isArray(initialCompletedResult.attempts)) {
          restoredGuesses = (initialCompletedResult.attempts as any[])
            .map(String)
            .map((s) => s.toUpperCase())
            .filter((c) => c.length === 1 && /[A-Z]/.test(c));
        } else {
          restoredGuesses = [];
        }

        setAnswer(normalizedAnswer);
        answerRef.current = normalizedAnswer;
        setGuessedLetters(restoredGuesses);
        setWrongGuesses(initialCompletedResult.mistakes || 0);
        setElapsedTime(initialCompletedResult.timeTaken || 0);

        if ((initialCompletedResult as any).answerRevealed) {
          setHiddenWord(normalizedAnswer.split("").join(" "));
          setGameLost(true);
          setGameWon(false);
        } else {
          const masked = maskWithGuesses(normalizedAnswer, restoredGuesses);
          setHiddenWord(masked);
          // mark completed (restored) as won for non-revealed completed result
          setGameWon(true);
          setGameLost(false);
        }

        hasAttemptedRef.current = true;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setStartTime(undefined);
      } else {
        // New puzzle setup
        setAnswer(normalizedAnswer);
        answerRef.current = normalizedAnswer;
        setGuessedLetters([]);
        setWrongGuesses(0);
        setHiddenWord(maskWithGuesses(normalizedAnswer, []));
        setGameWon(false);
        setGameLost(false);
        setElapsedTime(0);
        hasAttemptedRef.current = false;

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        if (propStartTime) {
          setStartTime(propStartTime);
        } else {
          setStartTime(undefined);
        }
      }
    } else if (propStartTime && startTime !== propStartTime) {
      const newElapsed = Math.floor((Date.now() - propStartTime) / 1000);
      setElapsedTime(newElapsed);
      setStartTime(propStartTime);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    } else if (!propStartTime && startTime !== undefined) {
      setStartTime(undefined);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleSignature, inputData?.answer, inputData?.hint, initialCompletedResult]);

  // timer tick effect (exact pattern)
  useEffect(() => {
    if (!startTime) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    if (gameWon || gameLost) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    if (!isActive) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
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
  }, [gameWon, gameLost, startTime, isActive]);

  // immediate letter handling - ensure synchronous update for visual immediacy
  const handleLetterPress = (letterRaw: string) => {
    const letter = letterRaw.toUpperCase();
    if (gameWon || gameLost) return;

    // ignore if already guessed
    if (guessedLetters.includes(letter)) return;

    // track first interaction
    if (!hasAttemptedRef.current) {
      hasAttemptedRef.current = true;
      if (puzzleId && onAttempt) {
        onAttempt(puzzleId);
      }
      if (!startTime) {
        const now = Date.now();
        setStartTime(now);
      }
    }

    const newGuesses = [...guessedLetters, letter];
    const isCorrect = answerRef.current.split("").some((c) => c.toUpperCase() === letter);
    const newWrongCount = wrongGuesses + (isCorrect ? 0 : 1);

    // Synchronously update state so UI reflects immediately
    setGuessedLetters(newGuesses);
    setWrongGuesses(newWrongCount);

    const newHidden = maskWithGuesses(answerRef.current, newGuesses);
    setHiddenWord(newHidden);

    // Win condition
    if (!newHidden.includes("_")) {
      setGameWon(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : elapsedTime;
      setElapsedTime(timeTaken);

      Animated.sequence([
        Animated.timing(successScale, {
          toValue: 1.08,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(successScale, {
          toValue: 1,
          duration: Animation.duration.normal,
          useNativeDriver: true,
        }),
      ]).start();

      onComplete({
        puzzleId: puzzleId || `hangman_${Date.now()}`,
        completed: true,
        timeTaken,
        attempts: newGuesses.length,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Lose condition
    if (newWrongCount >= maxWrongGuesses) {
      setGameLost(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : elapsedTime;
      setElapsedTime(timeTaken);

      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 8,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -8,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();

      onComplete({
        puzzleId: puzzleId || `hangman_${Date.now()}`,
        completed: true,
        timeTaken,
        attempts: newGuesses.length,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // small shake for wrong guess
    if (!isCorrect) {
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 6,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -6,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const resetGame = () => {
    const normalizedAnswer = (
      (inputData && inputData.answer) ||
      "HANGMAN"
    )
      .toString()
      .toUpperCase();
    setAnswer(normalizedAnswer);
    answerRef.current = normalizedAnswer;
    setGuessedLetters([]);
    setWrongGuesses(0);
    setHiddenWord(maskWithGuesses(normalizedAnswer, []));
    setGameWon(false);
    setGameLost(false);
    setElapsedTime(0);
    hasAttemptedRef.current = false;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (propStartTime) {
      setStartTime(propStartTime);
    } else {
      setStartTime(undefined);
    }
  };

  // Render hangman scaffold (classic)
  const renderHangman = () => {
    return (
      <View style={styles.scaffoldContainer}>
        <View style={styles.base} />
        <View style={styles.pole} />
        <View style={styles.beam} />
        <View style={styles.rope} />
        {wrongGuesses >= 1 && <View style={styles.head} />}
        {wrongGuesses >= 2 && <View style={styles.body} />}
        {wrongGuesses >= 3 && <View style={styles.armLeft} />}
        {wrongGuesses >= 4 && <View style={styles.armRight} />}
        {wrongGuesses >= 5 && <View style={styles.legLeft} />}
        {wrongGuesses >= 6 && <View style={styles.legRight} />}
      </View>
    );
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  // key style helper
  const getKeyStyle = (key: string) => {
    const wasGuessed = guessedLetters.includes(key);
    if (wasGuessed) {
      const correct = answerRef.current.split("").some((c) => c.toUpperCase() === key);
      return [
        styles.key,
        wasGuessed && (correct ? styles.keyCorrect : styles.keyDisabled),
      ];
    }
    return [styles.key];
  };

  // Keyboard layout fix:
  // - constrain keyboard width to screen width minus horizontal padding
  // - compute per-row key width so keys don't overflow
  const HORIZONTAL_PADDING = Spacing.xl || 20;
  const keyboardWidth = Math.max(260, width - HORIZONTAL_PADDING * 2);
  const rowGap = 8;

  // bottom padding
  const bottomPadding = BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <GameHeader
        title="Hangman"
        elapsedTime={elapsedTime}
        showDifficulty={false}
        gameType="hangman"
        puzzleId={puzzleId}
      />

      <Animated.View
        style={[
          styles.hangmanContainer,
          { transform: [{ translateX: shakeAnimation }, { scale: successScale }] },
        ]}
      >
        {renderHangman()}
      </Animated.View>

      {/* Hint */}
      {hintText ? (
        <View style={styles.hintContainer}>
          <Text style={styles.hintLabel}>Hint</Text>
          <Text style={styles.hintText}>{hintText}</Text>
        </View>
      ) : null}

      {/* Hidden word */}
      <Text style={styles.hiddenWord}>{hiddenWord}</Text>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={styles.attemptsContainer}>
          <Text style={styles.attemptsLabel}>Guessed:</Text>
          <Text style={styles.attempts}>
            {guessedLetters.length > 0 ? guessedLetters.join(", ") : "—"}
          </Text>
        </View>

        <View style={styles.wrongGuessesContainer}>
          <Text style={styles.wrongGuessesLabel}>
            Wrong: {wrongGuesses}/{maxWrongGuesses}
          </Text>
        </View>
      </View>

      {/* Keyboard wrapper - constrained width and centered */}
      <View style={[styles.keyboardWrapper, { width: keyboardWidth }]}>
        {ALPHABET_ROWS.map((row, rowIndex) => {
          // compute key width so keys fit exactly within keyboardWidth with small gaps
          const totalGap = rowGap * (row.length - 1);
          const keyWidth = Math.floor((keyboardWidth - totalGap) / row.length);

          return (
            <View key={rowIndex} style={[styles.keyboardRow, { marginBottom: 10 }]}>
              {row.map((key) => {
                const disabled = guessedLetters.includes(key) || gameWon || gameLost;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      ...getKeyStyle(key),
                      disabled ? styles.keyDisabledButton : styles.keyEnabledButton,
                      { width: keyWidth, marginRight: row.indexOf(key) < row.length - 1 ? rowGap : 0 },
                    ]}
                    onPress={() => handleLetterPress(key)}
                    disabled={disabled}
                    activeOpacity={disabled ? 1 : 0.7}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        disabled && styles.keyTextDisabled,
                        guessedLetters.includes(key) &&
                          answerRef.current.split("").some((c) => c.toUpperCase() === key) &&
                          styles.keyTextCorrect,
                      ]}
                    >
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Completion summary + View Stats */}
      {(gameWon || gameLost) && (
        <View style={styles.completionSummary}>
          <Text style={styles.completionText}>{gameWon ? "You won! 🎉" : "You lost ☹️"}</Text>
          <Text style={styles.completionMeta}>
            Time: {formatTime(elapsedTime)} • Attempts: {guessedLetters.length}
          </Text>

          {/* View Stats - shown when completed and prop provided */}
          {(gameWon || gameLost) && onShowStats && (
            <TouchableOpacity
              style={[styles.viewStatsButton, { backgroundColor: gameColor || "#F97316", borderRadius: BorderRadius.lg }]}
              onPress={() => {
                if (onShowStats) onShowStats();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewStatsButtonText}>
                View Stats ({formatTime(elapsedTime)}, {guessedLetters.length}{" "}
                {guessedLetters.length === 1 ? "try" : "tries"})
              </Text>
            </TouchableOpacity>
          )}

          {gameLost && (
            <View style={styles.correctAnswerContainer}>
              <Text style={styles.correctAnswerLabel}>The correct word was:</Text>
              <Text style={styles.correctAnswerText}>{answer}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetGame} activeOpacity={0.7}>
            <Text style={styles.resetButtonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: "center",
  },
  hangmanContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.md,
    minHeight: 160,
    justifyContent: "center",
  },
  scaffoldContainer: {
    width: Math.min(320, width - Spacing.xl * 2),
    height: 220,
    position: "relative",
  },
  base: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
    height: 8,
    backgroundColor: "#663E1A",
    borderRadius: 4,
  },
  pole: {
    position: "absolute",
    bottom: 8,
    left: 44,
    width: 8,
    top: 0,
    backgroundColor: "#663E1A",
  },
  beam: {
    position: "absolute",
    top: 0,
    left: 44,
    width: 120,
    height: 8,
    backgroundColor: "#663E1A",
  },
  rope: {
    position: "absolute",
    top: 8,
    left: 160,
    width: 2,
    height: 32,
    backgroundColor: "#222",
  },
  head: {
    position: "absolute",
    top: 44,
    left: 148,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: Colors.text.primary,
    backgroundColor: Colors.background.primary,
  },
  body: {
    position: "absolute",
    top: 84,
    left: 166,
    width: 2,
    height: 48,
    backgroundColor: Colors.text.primary,
  },
  armLeft: {
    position: "absolute",
    top: 96,
    left: 138,
    width: 34,
    height: 3,
    backgroundColor: Colors.text.primary,
    transform: [{ rotate: "-30deg" }],
  },
  armRight: {
    position: "absolute",
    top: 96,
    left: 166,
    width: 34,
    height: 3,
    backgroundColor: Colors.text.primary,
    transform: [{ rotate: "30deg" }],
  },
  legLeft: {
    position: "absolute",
    top: 128,
    left: 152,
    width: 3,
    height: 40,
    backgroundColor: Colors.text.primary,
    transform: [{ rotate: "30deg" }],
  },
  legRight: {
    position: "absolute",
    top: 128,
    left: 170,
    width: 3,
    height: 40,
    backgroundColor: Colors.text.primary,
    transform: [{ rotate: "-30deg" }],
  },

  hintContainer: {
    width: "100%",
    backgroundColor: "#F59E0B10",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#F59E0B30",
  },
  hintLabel: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.bold,
    color: "#F59E0B",
    marginBottom: Spacing.xs,
  },
  hintText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.secondary,
  },

  hiddenWord: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginVertical: Spacing.md,
    textAlign: "center",
    letterSpacing: 4,
  },

  infoRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  attemptsContainer: {
    flex: 1,
  },
  attemptsLabel: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  attempts: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.primary,
  },
  wrongGuessesContainer: {
    alignItems: "flex-end",
    flex: 0,
  },
  wrongGuessesLabel: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.semiBold,
  },

  // KEYBOARD STYLES
  keyboardWrapper: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  keyboardRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  key: {
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.light,
  },
  keyEnabledButton: {
    opacity: 1,
  },
  keyDisabledButton: {
    opacity: 0.45,
  },
  keyText: {
    fontSize: 14,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  keyTextDisabled: {
    color: Colors.text.secondary,
  },
  keyTextCorrect: {
    color: Colors.text.white,
    fontWeight: Typography.fontWeight.bold,
  },
  keyCorrect: {
    backgroundColor: Colors.game.correct,
  },
  keyDisabled: {
    backgroundColor: Colors.background.secondary,
  },

  completionSummary: {
    width: "100%",
    marginTop: Spacing.lg,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  completionText: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  completionMeta: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },

  viewStatsButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...Shadows.medium,
    width: "100%",
  },
  viewStatsButtonText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.white,
    fontWeight: Typography.fontWeight.bold,
  },

  correctAnswerContainer: {
    marginTop: Spacing.md,
    alignItems: "center",
  },
  correctAnswerLabel: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
  },
  correctAnswerText: {
    fontSize: Typography.fontSize.h2,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
    marginVertical: Spacing.sm,
    letterSpacing: 2,
  },

  resetButton: {
    marginTop: Spacing.md,
    backgroundColor: "#3B82F6",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: Colors.text.white,
    fontWeight: Typography.fontWeight.bold,
  },
});

export default HangmanGame;