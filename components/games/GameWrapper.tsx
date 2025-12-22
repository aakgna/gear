import React, { useEffect, useState, useRef } from "react";
import {
	View,
	StyleSheet,
	Text,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	TouchableOpacity,
	Animated,
	Dimensions,
	Share,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
	Puzzle,
	GameResult,
	PuzzleStats as PuzzleStatsType,
} from "../../config/types";
import WordleGame from "./WordleGame";
import QuickMathGame from "./QuickMathGame";
import RiddleGame from "./RiddleGame";
import TriviaGame from "./TriviaGame";
import MastermindGame from "./MastermindGame";
import SequencingGame from "./SequencingGame";
import WordChainGame from "./WordChainGame";
import AliasGame from "./AliasGame";
import ZipGame from "./ZipGame";
import FutoshikiGame from "./FutoshikiGame";
import MagicSquareGame from "./MagicSquareGame";
import HidatoGame from "./HidatoGame";
import SudokuGame from "./SudokuGame";
import PuzzleStats from "../PuzzleStats";
import GameIntroScreen from "../GameIntroOverlay";
import GameSocialOverlay from "../GameSocialOverlay";
import CommentsModal from "../CommentsModal";
import ShareToDMModal from "../ShareToDMModal";
import { getCurrentUser, addCompletedGame } from "../../config/auth";
import { savePuzzleCompletion, fetchPuzzleStats } from "../../config/firebase";
import {
	Colors,
	Shadows,
	Spacing,
	Typography,
	BorderRadius,
} from "../../constants/DesignSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Global tracker for dismissed intro screens (per puzzle ID)
// This persists across tab switches and component re-renders
const dismissedIntros = new Set<string>();

// Global storage for completed game results (persists across tab switches)
const completedGameResults = new Map<string, GameResult>();

// Confetti particle component
interface ConfettiParticle {
	id: number;
	x: number;
	y: number;
	color: string;
	rotation: number;
	scale: number;
}

const CONFETTI_COLORS = [
	Colors.accent,
	Colors.secondaryAccent,
	Colors.game.correct,
	"#FF6B6B",
	"#4ECDC4",
	"#45B7D1",
	"#96CEB4",
	"#FFEAA7",
];

const createConfettiParticles = (): ConfettiParticle[] => {
	const particles: ConfettiParticle[] = [];
	for (let i = 0; i < 50; i++) {
		particles.push({
			id: i,
			x: Math.random() * SCREEN_WIDTH,
			y: -20 - Math.random() * 100,
			color:
				CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
			rotation: Math.random() * 360,
			scale: 0.5 + Math.random() * 0.5,
		});
	}
	return particles;
};

interface GameWrapperProps {
	puzzle: Puzzle;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	onSkipped?: () => void;
	startTime?: number;
	isActive?: boolean;
	onElapsedTimeUpdate?: (puzzleId: string, elapsedTime: number) => void;
	forceShowIntro?: boolean; // Force show intro regardless of dismissal state
}

const GameWrapper: React.FC<GameWrapperProps> = ({
	puzzle,
	onComplete,
	onAttempt,
	onSkipped,
	startTime,
	isActive = true,
	onElapsedTimeUpdate,
	forceShowIntro = false,
}) => {
	const [showStats, setShowStats] = useState(false);
	const [puzzleStats, setPuzzleStats] = useState<PuzzleStatsType | null>(null);
	const [loadingStats, setLoadingStats] = useState(false);
	const [showCommentsModal, setShowCommentsModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);

	// Check if this puzzle was completed before
	const globalCompletedResult = completedGameResults.get(puzzle.id);
	const [completedResult, setCompletedResult] = useState<GameResult | null>(
		globalCompletedResult || null
	);
	// Track if completion happened in current session (for showing social overlay)
	const [completedInSession, setCompletedInSession] = useState(false);

	// Determine initial state based on game progress
	// If intro was dismissed (game started), start with game shown, not intro
	// If game was completed, don't show intro
	// Unless forceShowIntro is true (when playing from profile page)
	const introDismissed = dismissedIntros.has(puzzle.id);
	const gameWasCompleted = !!globalCompletedResult;
	const [showIntro, setShowIntro] = useState(
		forceShowIntro || (!introDismissed && !gameWasCompleted)
	);
	const [gameStarted, setGameStarted] = useState(
		!forceShowIntro && (introDismissed || gameWasCompleted)
	);
	const [actualStartTime, setActualStartTime] = useState<number | undefined>(
		undefined
	);
	const previousPuzzleIdRef = React.useRef<string>("");
	const previousIsActiveRef = React.useRef<boolean>(isActive);
	const elapsedTimeRef = React.useRef<number>(0);
	const lastActiveTimeRef = React.useRef<number | null>(null);
	const completionProcessedRef = React.useRef<boolean>(false);

	// Animation states
	const [showConfetti, setShowConfetti] = useState(false);
	const [confettiParticles, setConfettiParticles] = useState<
		ConfettiParticle[]
	>([]);
	const failurePulseAnim = useRef(new Animated.Value(0)).current;
	const confettiAnims = useRef<Animated.Value[]>([]).current;

	// Trigger success animation (confetti)
	const triggerSuccessAnimation = () => {
		const particles = createConfettiParticles();
		setConfettiParticles(particles);
		setShowConfetti(true);

		// Create animation values for each particle
		const anims = particles.map(() => new Animated.Value(0));
		confettiAnims.length = 0;
		confettiAnims.push(...anims);

		// Animate all particles
		Animated.parallel(
			anims.map((anim, index) =>
				Animated.timing(anim, {
					toValue: 1,
					duration: 2000 + Math.random() * 1000,
					useNativeDriver: true,
				})
			)
		).start(() => {
			setShowConfetti(false);
			setConfettiParticles([]);
		});
	};

	// Trigger failure animation (red pulse)
	const triggerFailureAnimation = () => {
		Animated.sequence([
			Animated.timing(failurePulseAnim, {
				toValue: 1,
				duration: 150,
				useNativeDriver: false,
			}),
			Animated.timing(failurePulseAnim, {
				toValue: 0,
				duration: 150,
				useNativeDriver: false,
			}),
			Animated.timing(failurePulseAnim, {
				toValue: 0.5,
				duration: 100,
				useNativeDriver: false,
			}),
			Animated.timing(failurePulseAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: false,
			}),
		]).start();
	};

	// Update intro state when puzzle changes
	React.useEffect(() => {
		if (previousPuzzleIdRef.current !== puzzle.id) {
			previousPuzzleIdRef.current = puzzle.id;
			// Reset completion processed flag when puzzle changes
			completionProcessedRef.current = false;
			// Reset session completion flag when puzzle changes
			setCompletedInSession(false);

			// Check if this puzzle has a completed result stored
			const storedResult = completedGameResults.get(puzzle.id);
			if (storedResult) {
				// Game was completed, show the game with stats available
				setCompletedResult(storedResult);
				setShowIntro(false);
				setGameStarted(true);
			} else {
				// Check if intro has been dismissed for this puzzle (game in progress)
				const introDismissed = dismissedIntros.has(puzzle.id);
				setShowIntro(!introDismissed);
				setGameStarted(introDismissed);
				if (!introDismissed) {
					setActualStartTime(undefined);
					elapsedTimeRef.current = 0;
				}
			}
			previousIsActiveRef.current = isActive;
		}
	}, [puzzle.id, isActive]);

	// Track elapsed time changes and report when becoming inactive
	React.useEffect(() => {
		if (
			previousIsActiveRef.current &&
			!isActive &&
			gameStarted &&
			actualStartTime
		) {
			// Game just became inactive - calculate and save elapsed time
			// Calculate elapsed time from actualStartTime (same as game components use)
			const now = Date.now();
			const currentElapsed = Math.floor((now - actualStartTime) / 1000);
			elapsedTimeRef.current = currentElapsed;
			lastActiveTimeRef.current = null;
			if (onElapsedTimeUpdate) {
				onElapsedTimeUpdate(puzzle.id, currentElapsed);
			}
		} else if (
			!previousIsActiveRef.current &&
			isActive &&
			gameStarted &&
			actualStartTime
		) {
			// Game just became active - mark the time it became active
			lastActiveTimeRef.current = Date.now();
		}
		previousIsActiveRef.current = isActive;
	}, [isActive, gameStarted, actualStartTime, puzzle.id, onElapsedTimeUpdate]);

	// Handle play button click
	const handlePlay = () => {
		const now = Date.now();
		// Mark intro as dismissed for this puzzle globally
		dismissedIntros.add(puzzle.id);
		setActualStartTime(now);
		setShowIntro(false);
		setGameStarted(true);
		previousIsActiveRef.current = isActive;
		elapsedTimeRef.current = 0;
		lastActiveTimeRef.current = isActive ? now : null;
	};

	// Update actualStartTime when startTime prop changes (to account for paused time)
	// This happens when the feed recalculates startTime based on saved elapsed time
	React.useEffect(() => {
		if (gameStarted && startTime && startTime !== actualStartTime) {
			// Feed recalculated startTime to account for paused time
			// Update actualStartTime to match, so timer continues from correct point
			setActualStartTime(startTime);
			// Reset elapsedTimeRef to match the saved elapsed time
			// Calculate elapsed time from the new startTime
			if (isActive) {
				lastActiveTimeRef.current = Date.now();
				// Don't reset elapsedTimeRef here - it's already saved in the feed
			}
		}
	}, [startTime, gameStarted, actualStartTime, isActive]);

	// Enhanced onComplete that also tracks completion and prepares stats
	const handleComplete = async (result: GameResult) => {
		// Prevent duplicate processing
		if (completionProcessedRef.current) {
			onComplete(result);
			return;
		}

		const user = getCurrentUser();

		// Trigger appropriate animation based on result
		if (result.completed && !result.answerRevealed) {
			// User won without revealing answer - celebrate!
			// Trigger haptic feedback for success
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			triggerSuccessAnimation();
		} else if (result.answerRevealed) {
			// User gave up or lost - subtle failure feedback
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			triggerFailureAnimation();
		}

		if (user && result.completed) {
			// Mark as processed to prevent duplicate calls
			completionProcessedRef.current = true;

			// Update result with actual puzzle ID
			const updatedResult = {
				...result,
				puzzleId: puzzle.id,
			};

			// Save to user's completed games
			await addCompletedGame(
				user.uid,
				puzzle.id,
				result.timeTaken,
				result.answerRevealed
			);

			// Save puzzle completion to Firestore for stats
			// (skipped if answerRevealed is true)
			// For trivia, higher score is better; for others, fewer attempts is better
			await savePuzzleCompletion(
				puzzle.id,
				user.uid,
				result.timeTaken,
				result.attempts,
				result.mistakes,
				result.answerRevealed,
				puzzle.type === "trivia" // higherIsBetter for trivia
			);

			// Store result for stats display (but don't show yet)
			setCompletedResult(updatedResult);
			// Mark as completed in this session (for social overlay)
			setCompletedInSession(true);

			// Store globally so it persists across tab switches
			completedGameResults.set(puzzle.id, updatedResult);

			// Remove from dismissed intros since it's now completed
			dismissedIntros.delete(puzzle.id);
		}

		// Still call the original onComplete callback
		onComplete(result);
	};

	// Handle showing stats when button is clicked
	const handleShowStats = async () => {
		if (!completedResult) return;

		setLoadingStats(true);
		setShowStats(true);
		const stats = await fetchPuzzleStats(puzzle.id);
		setPuzzleStats(stats);
		setLoadingStats(false);
	};

	// Format time helper
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	// Format game type helper
	const formatGameType = (type: string): string => {
		const formatted = type
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase())
			.trim();

		const specialCases: Record<string, string> = {
			quickMath: "Quick Math",
			wordChain: "Word Chain",
			magicSquare: "Magic Square",
		};

		return specialCases[type] || formatted;
	};

	// Handle share
	const handleShare = async () => {
		if (!completedResult) return;

		try {
			const gameUrl = `thinktok://game/${puzzle.id}`;
			let message = `I just completed ${formatGameType(
				puzzle.type
			)} on ThinkTok!\n\n`;
			message += `Time: ${formatTime(completedResult.timeTaken)}\n`;

			if (completedResult.attempts !== undefined) {
				message += `Tries: ${completedResult.attempts}\n`;
			}

			message += `\nCan you beat my score?\n\n${gameUrl}`;

			await Share.share({
				message,
				url: gameUrl,
			});
		} catch (error: any) {
			console.error("Error sharing:", error);
		}
	};
	const renderGame = () => {
		// Use actualStartTime if game has started, otherwise don't pass startTime
		const gameStartTime = gameStarted ? actualStartTime : undefined;

		switch (puzzle.type) {
			case "wordle":
				return (
					<WordleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "quickMath":
				return (
					<QuickMathGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "riddle":
				return (
					<RiddleGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "trivia":
				return (
					<TriviaGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "mastermind":
				return (
					<MastermindGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "sequencing":
				return (
					<SequencingGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "wordChain":
				return (
					<WordChainGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "alias":
				return (
					<AliasGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "zip":
				return (
					<ZipGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "futoshiki":
				return (
					<FutoshikiGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "magicSquare":
				return (
					<MagicSquareGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "hidato":
				return (
					<HidatoGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			case "sudoku":
				return (
					<SudokuGame
						key={puzzle.id}
						inputData={puzzle.data as any}
						onComplete={handleComplete}
						onAttempt={onAttempt}
						startTime={gameStartTime}
						puzzleId={puzzle.id}
						onShowStats={handleShowStats}
						isActive={isActive && gameStarted}
					/>
				);
			default:
				return (
					<View style={styles.error}>
						<Text>Unknown game type</Text>
					</View>
				);
		}
	};

	// Interpolate failure pulse animation to background color
	const failurePulseColor = failurePulseAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["transparent", "rgba(255, 82, 82, 0.15)"],
	});

	return (
		<Animated.View
			style={[styles.container, { backgroundColor: failurePulseColor }]}
		>
			{/* Confetti Overlay */}
			{showConfetti && (
				<View style={styles.confettiContainer} pointerEvents="none">
					{confettiParticles.map((particle, index) => {
						const anim = confettiAnims[index];
						if (!anim) return null;

						const translateY = anim.interpolate({
							inputRange: [0, 1],
							outputRange: [particle.y, SCREEN_HEIGHT + 50],
						});

						const rotate = anim.interpolate({
							inputRange: [0, 1],
							outputRange: [
								`${particle.rotation}deg`,
								`${particle.rotation + 720}deg`,
							],
						});

						const opacity = anim.interpolate({
							inputRange: [0, 0.8, 1],
							outputRange: [1, 1, 0],
						});

						return (
							<Animated.View
								key={particle.id}
								style={[
									styles.confettiParticle,
									{
										left: particle.x,
										backgroundColor: particle.color,
										transform: [
											{ translateY },
											{ rotate },
											{ scale: particle.scale },
										],
										opacity,
									},
								]}
							/>
						);
					})}
				</View>
			)}

			{/* Game Intro Screen or Game Container */}
			{showIntro ? (
				<View style={styles.gameContainer}>
					<GameIntroScreen
						gameType={puzzle.type}
						difficulty={puzzle.difficulty}
						username={puzzle.username}
						onPlay={handlePlay}
					/>
				</View>
			) : (
				gameStarted && (
					<View
						style={[
							styles.gameContainer,
							showStats && styles.gameContainerWithStats,
						]}
					>
						{renderGame()}
						{/* Social Overlay - only show when game is completed in this session */}
						{completedInSession && completedResult && (
							<GameSocialOverlay
								key={`social-${puzzle.id}`}
								puzzle={puzzle}
								gameId={puzzle.id}
								onCommentPress={() => setShowCommentsModal(true)}
								onSharePress={() => setShowShareModal(true)}
							/>
						)}
					</View>
				)
			)}

			{/* Stats Container - always visible when shown, fixed at bottom */}
			{showStats && completedResult && (
				<View style={styles.statsContainer}>
					<View style={styles.statsHeader}>
						<Text style={styles.statsHeaderText}>Comparison Stats</Text>
						<View style={styles.statsHeaderActions}>
							<TouchableOpacity
								onPress={handleShare}
								style={styles.shareButton}
							>
								<Ionicons
									name="share-outline"
									size={24}
									color={Colors.accent}
								/>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setShowStats(false)}
								style={styles.closeButton}
							>
								<Ionicons name="close" size={24} color={Colors.text.primary} />
							</TouchableOpacity>
						</View>
					</View>
					<ScrollView
						style={styles.statsScrollView}
						contentContainerStyle={styles.statsContent}
						showsVerticalScrollIndicator={true}
					>
						<PuzzleStats
							stats={puzzleStats}
							puzzleType={puzzle.type}
							loading={loadingStats}
							userTime={completedResult.timeTaken}
							userAttempts={completedResult.attempts}
							userMistakes={completedResult.mistakes}
						/>
					</ScrollView>
				</View>
			)}

			{/* Comments Modal */}
			<CommentsModal
				visible={showCommentsModal}
				gameId={puzzle.id}
				onClose={() => setShowCommentsModal(false)}
			/>

			{/* Share to DM Modal */}
			<ShareToDMModal
				visible={showShareModal}
				gameId={puzzle.id}
				onClose={() => setShowShareModal(false)}
			/>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.secondary,
		flexDirection: "column",
		overflow: "hidden",
	},
	gameContainer: {
		flex: 1,
		overflow: "hidden",
	},
	gameContainerWithStats: {
		flex: 0.55, // Takes 55% when stats are shown
	},
	statsContainer: {
		flex: 0.45, // Takes 45% when shown
		backgroundColor: Colors.background.secondary,
		borderTopWidth: 2,
		borderTopColor: Colors.accent,
		...Shadows.heavy,
	},
	statsHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	statsHeaderText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	statsHeaderActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	shareButton: {
		padding: Spacing.xs,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	statsScrollView: {
		flex: 1,
	},
	statsContent: {
		paddingBottom: Spacing.xl,
	},
	error: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
	},
	confettiContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 1000,
		pointerEvents: "none",
	},
	confettiParticle: {
		position: "absolute",
		width: 10,
		height: 10,
		borderRadius: 2,
	},
});

export default GameWrapper;
