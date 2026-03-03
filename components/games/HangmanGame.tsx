import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HangmanData, GameResult } from "../../config/types";
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
  const BOTTOM_NAV_HEIGHT = 70;
  const gameColor = getGameColor("wordform"); // reuse wordform color for hangman

  // Defensive access
  const answer = (inputData.answer || "").toUpperCase();
  const hint = inputData.hint || "";
  const theme = inputData.theme || (hint ? hint : "General");
  const wordLength = answer.length;
  const maxWrongGuesses = 6; // classic hangman body parts
  const validWordLength = wordLength === 7; // require 7 letters as requested

  // Required state vars per patterns
  const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const puzzleIdRef = useRef<string>("");
  const hasAttemptedRef = useRef(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  // Hangman specific state
  const [guessedLetters, setGuessedLetters] = useState<Record<string, boolean>>(
    {}
  );
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Keyboard layout
  const keyboardRows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  // Layout constants to ensure keyboard fits on screen
  const H_PADDING = Spacing.md * 2;
  const KEY_GAP = 6;
  const KEY_MIN = 28;
  const KEY_MAX = 46;

  const getKeyWidthForRow = (rowLength: number) => {
    const availableWidth = SCREEN_WIDTH - H_PADDING;
    const totalGaps = KEY_GAP * (rowLength - 1);
    const raw = Math.floor((availableWidth - totalGaps) / rowLength);
    return Math.max(KEY_MIN, Math.min(KEY_MAX, raw));
  };

  // puzzleSignature for timer/reset logic
  const puzzleSignature = `${(inputData.answer || "").toUpperCase()}`;

  // Puzzle-change effect (timer + restore)
  useEffect(() => {
    if (puzzleIdRef.current !== puzzleSignature) {
      puzzleIdRef.current = puzzleSignature;
      if (
        initialCompletedResult?.completed &&
        !initialCompletedResult.answerRevealed
      ) {
        // restore completed state
        setGameWon(true);
        setGameLost(false);
        setAnswerRevealed(false);
        setElapsedTime(initialCompletedResult.timeTaken);
        setAttempts(initialCompletedResult.attempts || 0);
        hasAttemptedRef.current = true;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setStartTime(undefined);
      } else {
        setElapsedTime(0);
        setGameWon(false);
        setGameLost(false);
        setAnswerRevealed(false);
        setGuessedLetters({});
        setWrongGuesses(0);
        setAttempts(0);
        hasAttemptedRef.current = false;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setStartTime(propStartTime ?? undefined);
      }
    } else if (propStartTime && startTime !== propStartTime) {
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
    if (!startTime || gameWon || gameLost || !isActive) {
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
  }, [gameWon, gameLost, startTime, isActive]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return `${m}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const isLetterGuessed = (letter: string) => !!guessedLetters[letter];

  // Return array of single-character display placeholders and guarantee single line
  const revealCurrentProgress = () => {
    const chars = answer.split("");
    return chars.map((ch) => {
      if (ch === " ") return " ";
      if (guessedLetters[ch]) return ch;
      return "_";
    });
  };

  const checkWinCondition = (updatedGuesses: Record<string, boolean>) => {
    for (const ch of answer.split("")) {
      if (ch === " ") continue;
      if (!updatedGuesses[ch]) return false;
    }
    return true;
  };

  const handleGuess = (letter: string) => {
    if (gameWon || gameLost || !validWordLength) return;
    letter = letter.toUpperCase();

    if (isLetterGuessed(letter)) {
      // already guessed - small shake feedback
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
      return;
    }

    // Track first interaction for onAttempt
    if (!hasAttemptedRef.current && puzzleId) {
      hasAttemptedRef.current = true;
      if (onAttempt) onAttempt(puzzleId);
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const newGuessed = { ...guessedLetters, [letter]: true };
    setGuessedLetters(newGuessed);

    if (answer.includes(letter)) {
      const won = checkWinCondition(newGuessed);
      if (won) {
        const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setElapsedTime(timeTaken);
        setGameWon(true);
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
          attempts: newAttempts,
          completedAt: new Date().toISOString(),
        });
      } else {
        // small positive animation
        Animated.sequence([
          Animated.timing(successScale, {
            toValue: 1.03,
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
    } else {
      // wrong guess
      const newWrong = wrongGuesses + 1;
      setWrongGuesses(newWrong);

      // shake
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

      if (newWrong >= maxWrongGuesses) {
        const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setElapsedTime(timeTaken);
        setGameLost(true);
        onComplete({
          puzzleId: puzzleId || `hangman_${Date.now()}`,
          completed: true,
          timeTaken,
          attempts: newAttempts,
          completedAt: new Date().toISOString(),
        });
      }
    }
  };

  const handleShowAnswer = () => {
    if (gameWon || gameLost || answerRevealed) return;
    setAnswerRevealed(true);
    setGameLost(true);
    // Stop timer
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setElapsedTime(timeTaken);

    onComplete({
      puzzleId: puzzleId || `hangman_${Date.now()}`,
      completed: true,
      timeTaken,
      attempts: attempts,
      completedAt: new Date().toISOString(),
      answerRevealed: true,
    });
  };

  // Hangman drawing component (gallows + body parts)
  const HangmanFigure: React.FC<{ size?: number; parts: number }> = ({ size = 160, parts }) => {
    const poleWidth = Math.max(6, Math.round(size * 0.04));
    const beamHeight = Math.max(6, Math.round(size * 0.03));
    const headSize = Math.round(size * 0.18);
    const bodyHeight = Math.round(size * 0.22);
    const limbLength = Math.round(size * 0.16);
    const ropeHeight = Math.round(size * 0.07);

    return (
      <View style={[styles.figureOuter, { width: size }]}>
        {/* Gallows */}
        <View style={[styles.gallowsBase, { height: poleWidth, width: size * 0.6 }]} />
        <View style={[styles.gallowsPole, { left: size * 0.12, width: poleWidth }]} />
        <View style={[styles.gallowsBeam, { left: size * 0.12, width: size * 0.44, height: beamHeight }]} />
        <View style={[styles.gallowsRope, { left: size * 0.12 + size * 0.44 - beamHeight, height: ropeHeight }]} />

        {/* Head */}
        {parts >= 1 && (
          <View
            style={[
              styles.head,
              {
                width: headSize,
                height: headSize,
                borderRadius: headSize / 2,
                left: size * 0.12 + size * 0.44 - headSize / 2 - beamHeight,
                top: ropeHeight + 4,
                borderColor: "#000",
              },
            ]}
          />
        )}

        {/* Body */}
        {parts >= 2 && (
          <View
            style={[
              styles.body,
              {
                width: Math.max(6, Math.round(poleWidth)),
                height: bodyHeight,
                left: size * 0.12 + size * 0.44 - Math.max(6, Math.round(poleWidth)) / 2 - beamHeight,
                top: ropeHeight + headSize + 4,
                backgroundColor: "#000",
              },
            ]}
          />
        )}

        {/* Left Arm */}
        {parts >= 3 && (
          <View
            style={[
              styles.limb,
              {
                width: limbLength,
                height: Math.max(6, Math.round(poleWidth * 0.9)),
                left: size * 0.12 + size * 0.44 - Math.max(6, Math.round(poleWidth)) / 2 - beamHeight - limbLength + 8,
                top: ropeHeight + headSize + 10,
                transform: [{ rotate: "-30deg" }],
                backgroundColor: "#000",
              },
            ]}
          />
        )}

        {/* Right Arm */}
        {parts >= 4 && (
          <View
            style={[
              styles.limb,
              {
                width: limbLength,
                height: Math.max(6, Math.round(poleWidth * 0.9)),
                left: size * 0.12 + size * 0.44 - Math.max(6, Math.round(poleWidth)) / 2 - beamHeight + Math.round(Math.max(6, Math.round(poleWidth)) / 2),
                top: ropeHeight + headSize + 10,
                transform: [{ rotate: "30deg" }],
                backgroundColor: "#000",
              },
            ]}
          />
        )}

        {/* Left Leg */}
        {parts >= 5 && (
          <View
            style={[
              styles.limb,
              {
                width: limbLength,
                height: Math.max(6, Math.round(poleWidth * 0.95)),
                left: size * 0.12 + size * 0.44 - Math.max(6, Math.round(poleWidth)) / 2 - beamHeight - limbLength / 2 + 6,
                top: ropeHeight + headSize + bodyHeight - 4,
                transform: [{ rotate: "40deg" }],
                backgroundColor: "#000",
              },
            ]}
          />
        )}

        {/* Right Leg */}
        {parts >= 6 && (
          <View
            style={[
              styles.limb,
              {
                width: limbLength,
                height: Math.max(6, Math.round(poleWidth * 0.95)),
                left: size * 0.12 + size * 0.44 - Math.max(6, Math.round(poleWidth)) / 2 - beamHeight + Math.round(Math.max(6, Math.round(poleWidth)) / 2),
                top: ropeHeight + headSize + bodyHeight - 4,
                transform: [{ rotate: "-40deg" }],
                backgroundColor: "#000",
              },
            ]}
          />
        )}
      </View>
    );
  };

  const progress = revealCurrentProgress();

  // Calculate letter box size so all boxes fit on a single line within padding and not overflow black borders
  const horizontalPaddingTotal = Spacing.md * 2 + 24; // small safety margin
  const gapBetweenBoxes = 12;
  const maxTotalWidth = SCREEN_WIDTH - horizontalPaddingTotal;
  const calculatedBoxSize = Math.floor(
    (maxTotalWidth - gapBetweenBoxes * (wordLength - 1)) / wordLength
  );
  const LETTER_BOX_SIZE = Math.max(36, Math.min(72, calculatedBoxSize));

  // keyboard bottom margin to avoid overlap with safe area
  const keyboardBottomMargin = Math.max(Spacing.md, insets.bottom + 8);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <GameHeader
        title="Hangman"
        elapsedTime={elapsedTime}
        showDifficulty={false}
        gameType="wordform"
        puzzleId={puzzleId}
      />

      {/* Theme badge */}
      <View style={styles.themeBadge}>
        <Text style={styles.themeText}>Theme: {theme}</Text>
      </View>

      {!validWordLength && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Word must be exactly 7 letters. Current: {wordLength}
          </Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.boardContainer,
          { transform: [{ translateX: shakeAnimation }, { scale: successScale }] },
        ]}
      >
        {/* Hangman figure - sized to fit well on screen */}
        <HangmanFigure size={Math.min(220, Math.floor(SCREEN_WIDTH * 0.6))} parts={wrongGuesses} />

        {/* Word - single-line, boxes sized to always fit the screen */}
        <View style={styles.wordRowWrapper}>
          <View style={styles.wordRow}>
            {progress.map((ch, idx) => (
              <View
                key={idx}
                style={[
                  styles.letterBox,
                  {
                    width: LETTER_BOX_SIZE,
                    height: Math.max(56, Math.floor(LETTER_BOX_SIZE * 1.1)),
                    marginHorizontal: gapBetweenBoxes / 2,
                  },
                ]}
              >
                <Text style={styles.letterText}>
                  {answerRevealed ? (answer[idx] || "") : ch}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Only show Wrong counter (as requested) */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            Wrong: {wrongGuesses}/{maxWrongGuesses}
          </Text>
        </View>

        {/* Keyboard - ensured to fit horizontally by computing key widths */}
        {!gameWon && !gameLost && validWordLength && (
          <View style={[styles.keyboard, { marginBottom: keyboardBottomMargin }]}>
            {keyboardRows.map((row, rIdx) => {
              const keyWidth = getKeyWidthForRow(row.length);
              return (
                <View key={rIdx} style={styles.keyboardRow}>
                  {row.map((key) => {
                    const disabled = isLetterGuessed(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.key,
                          {
                            width: keyWidth,
                            minWidth: keyWidth,
                            marginHorizontal: KEY_GAP / 2,
                            paddingVertical: 8,
                          },
                          disabled && styles.keyDisabled,
                        ]}
                        onPress={() => handleGuess(key)}
                        disabled={disabled}
                        activeOpacity={disabled ? 1 : 0.7}
                      >
                        <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>
                          {key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* Reveal / Show Answer */}
        {!gameWon && !gameLost && (
          <TouchableOpacity
            style={styles.showAnswerButton}
            onPress={handleShowAnswer}
            activeOpacity={0.7}
          >
            <Text style={styles.showAnswerText}>Show Answer</Text>
          </TouchableOpacity>
        )}

        {(gameWon || gameLost || answerRevealed) && onShowStats && (
          <TouchableOpacity
            style={[styles.viewStatsButton, { backgroundColor: gameColor }]}
            onPress={onShowStats}
            activeOpacity={0.7}
          >
            <Text style={styles.viewStatsButtonText}>View Stats</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: "transparent",
  },
  themeBadge: {
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: "#00000022",
    ...Shadows.light,
  },
  themeText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  errorContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.error + "15",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + "40",
  },
  errorText: {
    color: Colors.error,
    textAlign: "center",
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semiBold,
  },
  boardContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  figureOuter: {
    height: 220,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    marginBottom: Spacing.md,
    position: "relative",
  },
  gallowsBase: {
    position: "absolute",
    bottom: 0,
    left: 0,
    backgroundColor: "#222",
    borderRadius: 2,
  },
  gallowsPole: {
    position: "absolute",
    bottom: 10,
    height: 160,
    backgroundColor: "#222",
    borderRadius: 2,
  },
  gallowsBeam: {
    position: "absolute",
    top: 0,
    height: 8,
    backgroundColor: "#222",
    borderRadius: 2,
  },
  gallowsRope: {
    position: "absolute",
    top: 8,
    width: 2,
    backgroundColor: "#222",
    borderRadius: 1,
  },
  head: {
    position: "absolute",
    borderWidth: 3,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    position: "absolute",
  },
  limb: {
    position: "absolute",
    borderRadius: 2,
  },
  // Wrapper to ensure the letter row stays centered and doesn't overflow
  wordRowWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
  },
  letterBox: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: "#00000026", // subtle darker border to respect user's "black borders"
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.light,
  },
  letterText: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  infoText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.semiBold,
  },
  keyboard: {
    width: "100%",
    marginTop: Spacing.md,
    alignItems: "center",
    flexShrink: 0,
  },
  keyboardRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
    alignItems: "center",
    flexWrap: "nowrap",
    width: "100%",
  },
  key: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1.2,
    borderColor: "#E5E5E5",
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.light,
    minHeight: 40,
  },
  keyText: {
    fontSize: 14,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  keyDisabled: {
    backgroundColor: Colors.background.tertiary,
    opacity: 0.6,
  },
  keyTextDisabled: {
    color: Colors.text.secondary,
  },
  showAnswerButton: {
    marginTop: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  showAnswerText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.caption,
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
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.white,
  },
});

export default HangmanGame;