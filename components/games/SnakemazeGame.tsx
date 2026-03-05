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
import { GameResult, MazeData } from "../../config/types";
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

interface StaticMazeGameProps {
  inputData: MazeData;
  onComplete: (result: GameResult) => void;
  onAttempt?: (puzzleId: string) => void;
  startTime?: number;
  puzzleId?: string;
  onShowStats?: () => void;
  isActive?: boolean;
  initialCompletedResult?: GameResult | null;
}

const StaticMazeGameEnhanced: React.FC<StaticMazeGameProps> = ({
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
  const gameColor = getGameColor("maze");

  // Defensive access
  const rows = Number.isFinite(inputData.rows) ? inputData.rows : 4;
  const cols = Number.isFinite(inputData.cols) ? inputData.cols : 4;
  const cells = Array.isArray(inputData.cells) ? inputData.cells : [];
  const providedWalls = Array.isArray((inputData as any).walls)
    ? (inputData as any).walls
    : [];
  const providedSolution = Array.isArray((inputData as any).solution)
    ? (inputData as any).solution
    : [];
  const startCoord =
    inputData.start && typeof (inputData.start as any).row === "number"
      ? (inputData.start as any)
      : undefined;
  const endCoord =
    inputData.end && typeof (inputData.end as any).row === "number"
      ? (inputData.end as any)
      : undefined;

  // helpers
  const posFrom = (r: number, c: number) => r * cols + c;
  const rcFrom = (pos: number) => ({ row: Math.floor(pos / cols), col: pos % cols });

  const safeCoord = (coord: any, fallbackRow: number, fallbackCol: number) => {
    if (
      coord &&
      typeof coord.row === "number" &&
      typeof coord.col === "number" &&
      coord.row >= 0 &&
      coord.col >= 0 &&
      coord.row < rows &&
      coord.col < cols
    ) {
      return { row: coord.row, col: coord.col };
    }
    return { row: fallbackRow, col: fallbackCol };
  };
  const defaultStart = safeCoord(startCoord, 0, 0);
  const defaultEnd = safeCoord(endCoord, rows - 1, cols - 1);
  const startPos = posFrom(defaultStart.row, defaultStart.col);
  const endPos = posFrom(defaultEnd.row, defaultEnd.col);

  const totalCells = rows * cols;

  // Required state
  const [userPath, setUserPath] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const puzzleIdRef = useRef<string>("");
  const hasAttemptedRef = useRef(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  // Build wall set
  const wallSet = useRef<Set<string>>(new Set());
  const [solutionPath, setSolutionPath] = useState<number[]>(
    Array.isArray(providedSolution) && providedSolution.length > 0
      ? [...providedSolution]
      : []
  );

  const addWall = (a: number, b: number, s: Set<string>) => {
    if (Number.isFinite(a) && Number.isFinite(b)) {
      s.add(`${a}-${b}`);
      s.add(`${b}-${a}`);
    }
  };

  // Build walls and ensure deterministic static maze based on provided data
  useEffect(() => {
    // If walls provided, use them (static)
    if (providedWalls && providedWalls.length > 0) {
      const s = new Set<string>();
      for (const w of providedWalls) {
        if (
          w &&
          typeof (w as any).a === "number" &&
          typeof (w as any).b === "number" &&
          (w as any).a >= 0 &&
          (w as any).b >= 0 &&
          (w as any).a < totalCells &&
          (w as any).b < totalCells
        ) {
          addWall((w as any).a, (w as any).b, s);
        }
      }
      wallSet.current = s;

      // If a solution was explicitly provided, keep it (static)
      if (!solutionPath || solutionPath.length === 0) {
        // Try to compute a valid path deterministically if none given
        const sol = findPathBFS(startPos, endPos, s);
        if (sol.length > 0) setSolutionPath(sol);
        else setSolutionPath([]);
      }
    } else if (providedSolution && providedSolution.length > 0) {
      // If only a solution is provided, carve a single route among walls
      const fullWalls = new Set<string>();
      // Start with a grid of walls between all adjacent cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pos = posFrom(r, c);
          if (c + 1 < cols) addWall(pos, posFrom(r, c + 1), fullWalls);
          if (r + 1 < rows) addWall(pos, posFrom(r + 1, c), fullWalls);
        }
      }
      // Remove walls along providedSolution path to create that route
      for (let i = 0; i < providedSolution.length - 1; i++) {
        const a = providedSolution[i];
        const b = providedSolution[i + 1];
        const ar = Math.floor(a / cols),
          ac = a % cols;
        const br = Math.floor(b / cols),
          bc = b % cols;
        const validAdj =
          (ar === br && Math.abs(ac - bc) === 1) ||
          (ac === bc && Math.abs(ar - br) === 1);
        if (validAdj) {
          fullWalls.delete(`${a}-${b}`);
          fullWalls.delete(`${b}-${a}`);
        }
      }
      wallSet.current = fullWalls;
      setSolutionPath([...providedSolution]);
    } else {
      // No walls & no provided solution -> fully open grid (multiple paths)
      wallSet.current = new Set<string>();
      const sol = findPathBFS(startPos, endPos, wallSet.current);
      if (sol.length > 0) setSolutionPath(sol);
      else setSolutionPath([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, JSON.stringify(providedWalls), JSON.stringify(providedSolution)]);

  // puzzleSignature per spec
  const puzzleSignature = `${rows}-${cols}-${cells
    .map((c) => `${c.pos}:${c.number}`)
    .join(",")}`;

  // Timer & lifecycle pattern (per spec)
  useEffect(() => {
    if (puzzleIdRef.current !== puzzleSignature) {
      puzzleIdRef.current = puzzleSignature;

      // Restore from initialCompletedResult if provided
      if (
        initialCompletedResult &&
        initialCompletedResult.completed &&
        !initialCompletedResult.answerRevealed
      ) {
        setCompleted(true);
        setAnswerRevealed(false);
        setElapsedTime(initialCompletedResult.timeTaken);
        setAttempts(initialCompletedResult.attempts || 0);
        if (Array.isArray(solutionPath) && solutionPath.length > 0) {
          // If there is a restorable path, but we DO NOT reveal solution by default,
          // restore the user's path to the solution so the feed shows completed state.
          setUserPath([...solutionPath]);
        } else {
          setUserPath([]);
        }
        setFeedback(null);
        hasAttemptedRef.current = true;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setStartTime(undefined);
      } else {
        setElapsedTime(0);
        setCompleted(false);
        setAnswerRevealed(false);
        setUserPath([]);
        setAttempts(0);
        setFeedback(null);
        hasAttemptedRef.current = false;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
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
      }
    } else if (!propStartTime && startTime !== undefined) {
      setStartTime(undefined);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleSignature, propStartTime, startTime, initialCompletedResult, JSON.stringify(solutionPath)]);

  // Timer tick effect
  useEffect(() => {
    if (!startTime) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    if (completed || answerRevealed) {
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
  }, [completed, startTime, isActive]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // adjacency (4-directional)
  const areAdjacent = (pos1: number, pos2: number): boolean => {
    if (pos1 == null || pos2 == null) return false;
    const r1 = Math.floor(pos1 / cols);
    const c1 = pos1 % cols;
    const r2 = Math.floor(pos2 / cols);
    const c2 = pos2 % cols;

    if (r1 === r2 && Math.abs(c1 - c2) === 1) return true;
    if (c1 === c2 && Math.abs(r1 - r2) === 1) return true;
    return false;
  };

  const hasWallBetween = (a: number, b: number): boolean => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return wallSet.current.has(`${a}-${b}`);
  };

  // BFS pathfinder (uses wallSet to avoid blocked edges)
  function findPathBFS(start: number, goal: number, wallSetLocal: Set<string>) {
    const q: number[] = [];
    const prev = new Array<number | null>(totalCells).fill(null);
    const seen = new Array<boolean>(totalCells).fill(false);
    q.push(start);
    seen[start] = true;

    while (q.length > 0) {
      const cur = q.shift() as number;
      if (cur === goal) break;

      const { row, col } = rcFrom(cur);
      const neighbors: number[] = [];
      if (col + 1 < cols) neighbors.push(posFrom(row, col + 1));
      if (col - 1 >= 0) neighbors.push(posFrom(row, col - 1));
      if (row + 1 < rows) neighbors.push(posFrom(row + 1, col));
      if (row - 1 >= 0) neighbors.push(posFrom(row - 1, col));

      for (const nb of neighbors) {
        if (wallSetLocal.has(`${cur}-${nb}`)) continue;
        if (seen[nb]) continue;
        seen[nb] = true;
        prev[nb] = cur;
        q.push(nb);
      }
    }

    if (!seen[goal]) return [];
    const path: number[] = [];
    let cur: number | null = goal;
    while (cur !== null) {
      path.push(cur);
      const p = prev[cur];
      if (p === null) break;
      cur = p;
    }
    return path.reverse();
  }

  const handleCellPress = (pos: number) => {
    if (completed || answerRevealed) return;

    // Track first interaction
    if (!hasAttemptedRef.current && puzzleId) {
      hasAttemptedRef.current = true;
      if (onAttempt) onAttempt(puzzleId);
    }

    setFeedback(null);

    // If pos already in path -> undo to that index (inclusive)
    const existingIndex = userPath.indexOf(pos);
    if (existingIndex !== -1) {
      setUserPath(userPath.slice(0, existingIndex + 1));
      return;
    }

    // If starting fresh must click start cell
    if (userPath.length === 0) {
      if (pos !== startPos) {
        setFeedback("Tap the start cell to begin");
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 5,
            duration: Animation.duration.fast,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -5,
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
      setUserPath([pos]);
      return;
    }

    // Must be adjacent to last cell
    const lastPos = userPath[userPath.length - 1];
    if (!areAdjacent(lastPos, pos)) {
      setFeedback("Must move to an adjacent cell");
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 5,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -5,
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

    // Cannot move if a wall exists between lastPos and pos
    if (hasWallBetween(lastPos, pos)) {
      setFeedback("That path is blocked by a wall");
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 5,
          duration: Animation.duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -5,
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

    // Prevent revisiting a cell (except undo above)
    if (userPath.includes(pos)) {
      setFeedback("Cannot revisit a cell");
      return;
    }

    const newPath = [...userPath, pos];
    setUserPath(newPath);

    // If this move hits the end cell -> success (highlight only the path the user drew)
    if (pos === endPos) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      setElapsedTime(timeTaken);
      setCompleted(true);
      setAttempts((a) => a + 1);

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

      // Note: do not reveal the stored solution; we report completion and leave the user's path highlighted.
      onComplete({
        puzzleId: puzzleId || `maze_${Date.now()}`,
        completed: true,
        timeTaken,
        attempts: attempts + 1,
        completedAt: new Date().toISOString(),
      });
    }
  };

  const handleShowAnswer = () => {
    if (completed || answerRevealed) return;

    // Reveal the stored solution (explicit reveal)
    let sol = solutionPath && solutionPath.length > 0 ? solutionPath : [];
    if (!sol || sol.length === 0) {
      sol = findPathBFS(startPos, endPos, wallSet.current);
    }
    if (!sol || sol.length === 0) {
      setFeedback("No solution available to reveal");
      return;
    }

    setAnswerRevealed(true);
    setUserPath([...sol]); // reveal the solution path visually

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    setElapsedTime(timeTaken);
    setCompleted(true);

    onComplete({
      puzzleId: puzzleId || `maze_${Date.now()}`,
      completed: true,
      timeTaken,
      attempts: attempts + 1,
      completedAt: new Date().toISOString(),
      answerRevealed: true,
    });
  };

  const handleClear = () => {
    if (completed || answerRevealed) return;
    setUserPath([]);
    setFeedback(null);
  };

  // Layout: neck-to-neck cells (no gaps)
  const gridPadding = Spacing.xl * 1.2;
  const availableWidth = Math.max(260, SCREEN_WIDTH - gridPadding);
  const cellSize = Math.floor(availableWidth / Math.max(cols, 4));
  const clampedCellSize = Math.min(cellSize, 64);

  // Render cell without numbers; walls shown via thicker borders
  const renderCell = (r: number, c: number) => {
    const pos = posFrom(r, c);
    const inUserPath = userPath.includes(pos);
    const isStart = pos === startPos;
    const isEnd = pos === endPos;

    const topNeighbor = r - 1 >= 0 ? posFrom(r - 1, c) : null;
    const rightNeighbor = c + 1 < cols ? posFrom(r, c + 1) : null;
    const bottomNeighbor = r + 1 < rows ? posFrom(r + 1, c) : null;
    const leftNeighbor = c - 1 >= 0 ? posFrom(r, c - 1) : null;

    const wallTop = topNeighbor !== null && hasWallBetween(pos, topNeighbor);
    const wallRight = rightNeighbor !== null && hasWallBetween(pos, rightNeighbor);
    const wallBottom = bottomNeighbor !== null && hasWallBetween(pos, bottomNeighbor);
    const wallLeft = leftNeighbor !== null && hasWallBetween(pos, leftNeighbor);

    // Border widths: walls thick, open thin - creates maze look with cells neck-to-neck
    const borderStyles: any = {
      borderTopWidth: wallTop ? 4 : 1,
      borderRightWidth: wallRight ? 4 : 1,
      borderBottomWidth: wallBottom ? 4 : 1,
      borderLeftWidth: wallLeft ? 4 : 1,
      borderTopColor: wallTop ? "#222" : "#E5E5E5",
      borderRightColor: wallRight ? "#222" : "#E5E5E5",
      borderBottomColor: wallBottom ? "#222" : "#E5E5E5",
      borderLeftColor: wallLeft ? "#222" : "#E5E5E5",
    };

    const baseStyle: any = [
      styles.cell,
      {
        width: clampedCellSize,
        height: clampedCellSize,
        borderRadius: 6,
      },
      borderStyles,
    ];

    // Visual states
    // - If completed & not answerRevealed => highlight only user's path
    // - If answerRevealed => highlight solution path (userPath has been set to solution)
    // - During play => highlight userPath progressively
    if (inUserPath && (!completed || (completed && !answerRevealed))) {
      baseStyle.push(styles.cellInPath);
    }

    // On successful completion (user reached end), only highlight the user's path (green)
    if (completed && !answerRevealed) {
      if (inUserPath) {
        baseStyle.push(styles.cellSuccess);
      } else {
        baseStyle.push(styles.cellDim);
      }
    }

    // If answer revealed, highlight solution path distinctly
    if (answerRevealed) {
      if (inUserPath) {
        baseStyle.push(styles.cellSolution);
      } else {
        baseStyle.push(styles.cellDim);
      }
    }

    return (
      <TouchableOpacity
        key={`cell-${r}-${c}`}
        style={baseStyle}
        onPress={() => handleCellPress(pos)}
        activeOpacity={0.9}
        disabled={completed && !answerRevealed}
      >
        {/* Start/End subtle badges */}
        {isStart && (
          <View style={[styles.cornerBadge, styles.startBadge]}>
            <Text style={styles.badgeText}>S</Text>
          </View>
        )}
        {isEnd && (
          <View style={[styles.cornerBadge, styles.endBadge]}>
            <Text style={[styles.badgeText, styles.endBadgeText]}>E</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // bottom padding
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
          { transform: [{ translateX: shakeAnimation }, { scale: successScale }] },
        ]}
      >
        <GameHeader
          title="Maze"
          elapsedTime={elapsedTime}
          showDifficulty={false}
          gameType="maze"
          puzzleId={puzzleId}
        />

        {/* Grid */}
        <View style={styles.gridContainer}>
          <View
            style={[
              styles.grid,
              {
                width: clampedCellSize * cols,
                height: clampedCellSize * rows,
              },
            ]}
          >
            {Array.from({ length: rows }, (_, r) => (
              <View key={`row-${r}`} style={styles.gridRow}>
                {Array.from({ length: cols }, (_, c) => renderCell(r, c))}
              </View>
            ))}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.clearButton,
              userPath.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleClear}
            disabled={userPath.length === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.showAnswerBtn]}
            onPress={handleShowAnswer}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: "#fff" }]}>Show Answer</Text>
          </TouchableOpacity>
        </View>

        {/* Feedback */}
        {feedback && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* Completion stats & View Stats button */}
        {completed && (
          <View style={styles.completionBlock}>
            <Text style={styles.completionText}>Maze Complete</Text>
            <Text style={styles.completionMeta}>
              Time: {formatTime(elapsedTime)} • Attempts: {attempts}
            </Text>

            {onShowStats && (
              <TouchableOpacity
                style={[
                  styles.viewStatsButton,
                  { backgroundColor: gameColor },
                ]}
                onPress={onShowStats}
                activeOpacity={0.7}
              >
                <Text style={styles.viewStatsButtonText}>
                  View Stats ({formatTime(elapsedTime)}, {attempts} tries)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Hint */}
        {!completed && (
          <View style={styles.hintRow}>
            <Text style={styles.hintText}>
              Start (S): row {Math.floor(startPos / cols) + 1}, col {(startPos % cols) + 1}
            </Text>
            <Text style={styles.hintText}>
              End (E): row {Math.floor(endPos / cols) + 1}, col {(endPos % cols) + 1}
            </Text>
          </View>
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
    alignItems: "center",
  },
  gameContainer: {
    width: "100%",
    alignItems: "center",
  },
  gridContainer: {
    marginVertical: Spacing.lg,
    overflow: "hidden",
    width: "100%",
    alignItems: "center",
  },
  grid: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: Colors.background.primary + "05",
    borderRadius: BorderRadius.md,
    padding: 0,
  },
  gridRow: {
    flexDirection: "row",
  },
  // Cells neck-to-neck: no margins; walls are shown via borders
  cell: {
    backgroundColor: Colors.background.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.light,
  },
  // subtle corner badge for start/end
  cornerBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#fff",
    ...Shadows.light,
  },
  startBadge: {
    backgroundColor: "#E8FFF3",
  },
  endBadge: {
    backgroundColor: "#EEF7FF",
    left: undefined,
    right: 6,
  },
  badgeText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  endBadgeText: {
    color: "#111",
  },
  inPathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    opacity: 0.95,
  },
  cellInPath: {
    // progressive highlight while drawing
    backgroundColor: "#10B98110",
  },
  cellSuccess: {
    // final success color for user-drawn path
    backgroundColor: Colors.game.correct + "90",
  },
  cellSolution: {
    // solution reveal
    backgroundColor: "#F59E0B70",
  },
  cellDim: {
    // dim non-path cells after completion or reveal
    backgroundColor: Colors.background.primary,
    opacity: 0.45,
  },
  controls: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
    width: "100%",
    justifyContent: "space-between",
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  clearButton: {
    backgroundColor: Colors.background.tertiary,
  },
  showAnswerBtn: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  buttonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
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
  completionBlock: {
    marginTop: Spacing.lg,
    width: "100%",
    alignItems: "center",
  },
  completionText: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.game.correct,
  },
  completionMeta: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    marginVertical: Spacing.sm,
  },
  viewStatsButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
    ...Shadows.medium,
  },
  viewStatsButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.white,
  },
  hintRow: {
    marginTop: Spacing.md,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hintText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
  },
});

export default StaticMazeGameEnhanced;