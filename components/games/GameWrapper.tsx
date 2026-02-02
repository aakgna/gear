import React, { useEffect, useState, useRef } from "react";
import {
	View,
	StyleSheet,
	Text,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	TouchableOpacity,
	TouchableWithoutFeedback,
	Animated,
	Dimensions,
	Share,
	ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
	Puzzle,
	GameResult,
	PuzzleStats as PuzzleStatsType,
} from "../../config/types";
import WordFormGame from "./WordForm";
import QuickMathGame from "./QuickMathGame";
import RiddleGame from "./RiddleGame";
import TriviaGame from "./TriviaGame";
import CodeBreakerGame from "./CodeBreaker";
import SequencingGame from "./SequencingGame";
import WordChainGame from "./WordChainGame";
import InferenceGame from "./InferenceGame";
import MazeGame from "./MazeGame";
import FutoshikiGame from "./FutoshikiGame";
import MagicSquareGame from "./MagicSquareGame";
import TrailFinderGame from "./TrailFinder";
import SudokuGame from "./SudokuGame";
import PuzzleStats from "../PuzzleStats";
import GameIntroScreen from "../GameIntroOverlay";
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
import {
	prefetchGameSocialData,
	getCachedExtendedSocialData,
	followUser,
	unfollowUser,
	likeGame,
	unlikeGame,
} from "../../config/social";
import { useRouter } from "expo-router";
import { Image, Modal } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Global tracker for dismissed intro screens (per puzzle ID)
// This persists across tab switches and component re-renders
const dismissedIntros = new Set<string>();

// Global storage for completed game results (persists across tab switches)
const completedGameResults = new Map<string, GameResult>();

export type ShareHandlers = {
	shareExternal: () => void;
	shareInternal: () => void;
	openShareMenu: () => void;
};

interface GameWrapperProps {
	puzzle: Puzzle;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	onSkipped?: () => void;
	onStartGame?: () => void;
	startTime?: number;
	isActive?: boolean;
	onElapsedTimeUpdate?: (puzzleId: string, elapsedTime: number) => void;
	forceShowIntro?: boolean; // Force show intro regardless of dismissal state
	onRegisterShareHandlers?: (handlers: ShareHandlers | null, puzzleId: string) => void;
}

const GameWrapper: React.FC<GameWrapperProps> = ({
	puzzle,
	onComplete,
	onAttempt,
	onSkipped,
	onStartGame,
	startTime,
	isActive = true,
	onElapsedTimeUpdate,
	forceShowIntro = false,
	onRegisterShareHandlers,
}) => {
	const router = useRouter();
	const [showStats, setShowStats] = useState(false);
	const [puzzleStats, setPuzzleStats] = useState<PuzzleStatsType | null>(null);
	const [loadingStats, setLoadingStats] = useState(false);
	const [showCommentsModal, setShowCommentsModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	// Social overlay state - merged directly into GameWrapper for instant display
	const [isFollowingCreator, setIsFollowingCreator] = useState(false);
	const [isLiked, setIsLiked] = useState(false);
	const [likeCount, setLikeCount] = useState(0);
	const [commentCount, setCommentCount] = useState(0);
	const [loadingFollow, setLoadingFollow] = useState(false);
	// Removed loadingLike - optimistic updates, no loading state needed
	const [showShareMenu, setShowShareMenu] = useState(false);
	// Pulse animation for like button (TikTok-style)
	const likePulseAnim = useRef(new Animated.Value(1)).current;

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
	const failurePulseAnim = useRef(new Animated.Value(0)).current;

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
		onStartGame?.();
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

	// Load social data directly in GameWrapper when game starts
	// This eliminates component boundary - data is ready instantly when game completes
	React.useEffect(() => {
		if (gameStarted && puzzle.id) {
			const user = getCurrentUser();
			if (!user) return;

			const creatorId = puzzle.uid;

			// Check cache first (instant if already prefetched)
			const cached = getCachedExtendedSocialData(
				puzzle.id,
				user.uid,
				creatorId
			);
			if (cached) {
				// Cache hit - set state immediately (INSTANT!)
				setLikeCount(cached.likeCount);
				setCommentCount(cached.commentCount);
				setIsLiked(cached.isLiked);
				if (cached.isFollowing !== undefined) {
					setIsFollowingCreator(cached.isFollowing);
				}
			} else {
				// Not cached - prefetch and update state when ready
				prefetchGameSocialData(puzzle.id, creatorId, user.uid)
					.then(() => {
						// After prefetch completes, get from cache and set state
						const freshCached = getCachedExtendedSocialData(
							puzzle.id,
							user.uid,
							creatorId
						);
						if (freshCached) {
							setLikeCount(freshCached.likeCount);
							setCommentCount(freshCached.commentCount);
							setIsLiked(freshCached.isLiked);
							if (freshCached.isFollowing !== undefined) {
								setIsFollowingCreator(freshCached.isFollowing);
							}
						}
					})
					.catch((err) => {
						// Silent error - prefetching is optional
						console.log("[GameWrapper] Prefetch silent error:", err);
					});
			}
		} else {
			// Reset when game changes
			setLikeCount(0);
			setCommentCount(0);
			setIsLiked(false);
			setIsFollowingCreator(false);
		}
	}, [gameStarted, puzzle.id, puzzle.uid]);

	// Enhanced onComplete that also tracks completion and prepares stats
	// OPTIMIZED: Social overlay appears instantly, async operations happen in parallel
	const handleComplete = async (result: GameResult) => {
		// Prevent duplicate processing
		if (completionProcessedRef.current) {
			onComplete(result);
			return;
		}

		const user = getCurrentUser();

		// Trigger appropriate animation/haptics based on result
		// These are non-blocking and run in parallel
		if (result.completed && !result.answerRevealed) {
			// User won without revealing answer - celebrate!
			// Trigger haptic feedback for success (non-blocking)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} else if (result.answerRevealed) {
			// User gave up or lost - subtle failure feedback
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			triggerFailureAnimation(); // Animation runs in parallel, doesn't block
		}

		if (user && result.completed) {
			// Mark as processed to prevent duplicate calls
			completionProcessedRef.current = true;

			// Update result with actual puzzle ID
			const updatedResult = {
				...result,
				puzzleId: puzzle.id,
			};

			// INSTANT: Set state immediately so social overlay appears right away
			// Don't wait for async operations!
			setCompletedResult(updatedResult);
			setCompletedInSession(true); // This triggers social overlay to appear INSTANTLY

			// Store globally so it persists across tab switches
			completedGameResults.set(puzzle.id, updatedResult);

			// Remove from dismissed intros since it's now completed
			dismissedIntros.delete(puzzle.id);

			// Run async operations in background (fire and forget)
			// These don't block the UI - social overlay is already showing!
			Promise.all([
				addCompletedGame(
					user.uid,
					puzzle.id,
					result.timeTaken,
					result.answerRevealed
				).catch((err) =>
					console.error("[GameWrapper] Error adding completed game:", err)
				),
				savePuzzleCompletion(
					puzzle.id,
					user.uid,
					result.timeTaken,
					result.attempts,
					result.mistakes,
					result.answerRevealed,
					puzzle.type === "trivia" // higherIsBetter for trivia
				).catch((err) =>
					console.error("[GameWrapper] Error saving puzzle completion:", err)
				),
			]).catch((err) =>
				console.error("[GameWrapper] Error in background operations:", err)
			);
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
			wordform: "WordForm",
			trailfinder: "TrailFinder",
			maze: "Maze",
			codebreaker: "CodeBreaker",
			inference: "Inference",
		};

		return specialCases[type] || formatted;
	};

	// Social overlay handlers - merged directly into GameWrapper
	const handleFollowPress = async () => {
		const user = getCurrentUser();
		const creatorId = puzzle.uid;
		if (!user || !creatorId || user.uid === creatorId) return;

		setLoadingFollow(true);
		try {
			if (isFollowingCreator) {
				await unfollowUser(user.uid, creatorId);
				setIsFollowingCreator(false);
			} else {
				await followUser(user.uid, creatorId);
				setIsFollowingCreator(true);
			}
		} catch (error) {
			console.error("[GameWrapper] Error following/unfollowing:", error);
		} finally {
			setLoadingFollow(false);
		}
	};

	const handleCreatorPress = () => {
		if (puzzle.username) {
			router.push(`/user/${puzzle.username}`);
		} else if (puzzle.uid) {
			router.push(`/user/${puzzle.uid}`);
		}
	};

	const handleLikePress = () => {
		const user = getCurrentUser();
		if (!user) return;

		// Optimistic update - update UI immediately, process in background
		const wasLiked = isLiked;
		const newLikedState = !wasLiked;
		const currentLikeCount = likeCount;
		const newLikeCount = wasLiked
			? Math.max(0, currentLikeCount - 1)
			: currentLikeCount + 1;

		// TikTok-style haptic feedback and pulse animation (only on like, not unlike)
		if (!wasLiked) {
			// Haptic feedback for like - medium impact for satisfying feel
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

			// TikTok-style pulse animation - quick bounce, heart doesn't stay big for more than 0.5s
			Animated.sequence([
				Animated.timing(likePulseAnim, {
					toValue: 1.4,
					duration: 150, // Quick scale up in 150ms
					useNativeDriver: true,
				}),
				Animated.timing(likePulseAnim, {
					toValue: 1,
					duration: 300, // Scale back down in 300ms (total < 500ms)
					useNativeDriver: true,
				}),
			]).start();
		}

		// Update UI instantly (no loading state)
		setIsLiked(newLikedState);
		setLikeCount(newLikeCount);

		// Process in background (fire and forget)
		// Works even if user switches games - operation continues
		if (wasLiked) {
			unlikeGame(puzzle.id, user.uid).catch((error) => {
				// On error, revert optimistic update
				console.error("[GameWrapper] Error unliking:", error);
				setIsLiked(true);
				setLikeCount(currentLikeCount);
			});
		} else {
			likeGame(puzzle.id, user.uid).catch((error) => {
				// On error, revert optimistic update
				console.error("[GameWrapper] Error liking:", error);
				setIsLiked(false);
				setLikeCount(currentLikeCount);
			});
		}
	};

	// Handle share before play (from intro screen - top left share icon)
	const handleShareBeforePlay = async () => {
		try {
			const gameLink = `thinktok://game/${puzzle.id}`;
			const iosAppStoreLink = "https://apps.apple.com/app/thinktok/id6739000000";
			const androidPlayStoreLink = "https://play.google.com/store/apps/details?id=com.aakgna.gear";
			const message = `Try this ${formatGameType(puzzle.type)} puzzle on ThinkTok!\n\nPlay: ${gameLink}\nOr search for game ID: ${puzzle.id} in ThinkTok\n\nDon't have ThinkTok? Download it:\niOS: ${iosAppStoreLink}\nAndroid: ${androidPlayStoreLink}`;
			const shareOptions: any = { message };
			if (Platform.OS === "android") {
				shareOptions.title = "Share Game";
			}
			await Share.share(shareOptions);
		} catch (error: any) {
			if (error?.message !== "User did not share") {
				console.error("Error sharing:", error);
			}
		}
	};

	// Register share handlers with feed so fixed share pill can trigger intro share
	useEffect(() => {
		if (!onRegisterShareHandlers) return;
		if (showIntro && isActive) {
			onRegisterShareHandlers(
				{
					shareExternal: handleShareBeforePlay,
					shareInternal: () => setShowShareModal(true),
					openShareMenu: () => setShowShareMenu(true),
				},
				puzzle.id
			);
		} else {
			onRegisterShareHandlers(null, puzzle.id);
		}
		return () => {
			onRegisterShareHandlers(null, puzzle.id);
		};
	}, [showIntro, isActive, puzzle.id, onRegisterShareHandlers]);

	// Handle share
	const handleShare = async () => {
		if (!completedResult) {
			console.log("[handleShare] No completed result");
			return;
		}

		try {
			console.log("[handleShare] Starting share...");
			// Create shareable link - using game ID that can be used in the app
			const gameLink = `thinktok://game/${puzzle.id}`;
			
			// App store links for users without the app
			const iosAppStoreLink = "https://apps.apple.com/app/thinktok/id6739000000"; // Update with actual App Store ID
			const androidPlayStoreLink = "https://play.google.com/store/apps/details?id=com.aakgna.gear";

			let message = `I just completed ${formatGameType(
				puzzle.type
			)} on ThinkTok!\n\n`;
			message += `Time: ${formatTime(completedResult.timeTaken)}\n`;

			if (completedResult.attempts !== undefined) {
				message += `Tries: ${completedResult.attempts}\n`;
			}

			message += `\nCan you beat my score?\n\n`;
			message += `Play this game: ${gameLink}\n\n`;
			message += `Or search for game ID: ${puzzle.id} in ThinkTok\n\n`;
			message += `Don't have ThinkTok? Download it:\n`;
			message += `iOS: ${iosAppStoreLink}\n`;
			message += `Android: ${androidPlayStoreLink}`;

			// Share with message - the link will be shareable as text
			// On iOS, Share.share with message will allow sharing to iMessage, Instagram, etc.
			// On Android, message is used for sharing
			const shareOptions: any = {
				message,
			};

			// Add title for Android
			if (Platform.OS === "android") {
				shareOptions.title = "Share Game Result";
			}

			console.log(
				"[handleShare] Calling Share.share with options:",
				JSON.stringify(shareOptions)
			);

			// Use Share API to open native share sheet
			// The share sheet should appear immediately when Share.share is called
			const result = await Share.share(shareOptions);
			console.log("[handleShare] Share result:", result);

			// Check if sharing was successful
			if (result && result.action) {
				if (result.action === Share.sharedAction) {
					if (result.activityType) {
						console.log("Shared with activity type:", result.activityType);
					} else {
						console.log("Shared successfully");
					}
				} else if (result.action === Share.dismissedAction) {
					console.log("Share dismissed");
				}
			}
		} catch (error: any) {
			// User cancelled sharing - this is expected, don't log as error
			console.error("[handleShare] Error:", error);
			if (error?.message !== "User did not share") {
				console.error("Error sharing:", error);
			}
		}
	};
	const renderGame = () => {
		// Use actualStartTime if game has started, otherwise don't pass startTime
		const gameStartTime = gameStarted ? actualStartTime : undefined;

		switch (puzzle.type) {
			case "wordform":
				return (
					<WordFormGame
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
			case "codebreaker":
				return (
					<CodeBreakerGame
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
			case "inference":
				return (
					<InferenceGame
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
			case "maze":
				return (
					<MazeGame
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
			case "trailfinder":
				return (
					<TrailFinderGame
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
						style={styles.gameContainer}
					>
						{renderGame()}
						{/* Social Overlay - rendered directly in GameWrapper for instant display */}
						{gameStarted &&
							completedInSession &&
							completedResult &&
							getCurrentUser() && (
								<View style={socialOverlayStyles.container}>
									{/* Creator Profile Button */}
									{puzzle.uid && (
										<View style={socialOverlayStyles.creatorButton}>
											<View style={socialOverlayStyles.avatarContainer}>
												<TouchableOpacity
													onPress={handleCreatorPress}
													activeOpacity={0.7}
													style={socialOverlayStyles.avatarTouchable}
												>
													{puzzle.profilePicture ? (
														<Image
															source={{ uri: puzzle.profilePicture }}
															style={socialOverlayStyles.avatar}
														/>
													) : (
														<View style={socialOverlayStyles.avatarPlaceholder}>
															<Ionicons
																name="person"
																size={28}
																color={Colors.text.secondary}
															/>
														</View>
													)}
												</TouchableOpacity>
												{getCurrentUser()?.uid !== puzzle.uid && (
													<TouchableOpacity
														style={socialOverlayStyles.followBadge}
														onPress={handleFollowPress}
														activeOpacity={0.7}
														disabled={loadingFollow}
													>
														{loadingFollow ? (
															<ActivityIndicator
																size="small"
																color={Colors.text.white}
															/>
														) : (
															<Ionicons
																name={
																	isFollowingCreator ? "checkmark" : "add"
																}
																size={14}
																color={Colors.text.white}
															/>
														)}
													</TouchableOpacity>
												)}
											</View>
										</View>
									)}

									{/* Like Button - Optimistic updates with TikTok-style pulse */}
									<TouchableOpacity
										style={socialOverlayStyles.actionButton}
										onPress={handleLikePress}
										activeOpacity={0.7}
									>
										<Animated.View
											style={{
												transform: [{ scale: likePulseAnim }],
											}}
										>
											<Ionicons
												name={isLiked ? "heart" : "heart-outline"}
												size={28}
												color={isLiked ? Colors.accent : Colors.text.primary}
											/>
										</Animated.View>
										<Text style={socialOverlayStyles.actionCount}>
											{likeCount}
										</Text>
									</TouchableOpacity>

									{/* Comment Button */}
									<TouchableOpacity
										style={socialOverlayStyles.actionButton}
										onPress={() => setShowCommentsModal(true)}
										activeOpacity={0.7}
									>
										<Ionicons
											name="chatbubble-outline"
											size={28}
											color={Colors.text.primary}
										/>
										<Text style={socialOverlayStyles.actionCount}>
											{commentCount}
										</Text>
									</TouchableOpacity>

									{/* Share Button */}
									<TouchableOpacity
										style={socialOverlayStyles.actionButton}
										onPress={() => setShowShareMenu(true)}
										activeOpacity={0.7}
									>
										<Ionicons
											name="share-social-outline"
											size={28}
											color={Colors.text.primary}
										/>
									</TouchableOpacity>

									{/* Share Menu Modal */}
									<Modal
										visible={showShareMenu}
										transparent={true}
										animationType="fade"
										onRequestClose={() => setShowShareMenu(false)}
									>
										<TouchableOpacity
											style={socialOverlayStyles.shareMenuOverlay}
											activeOpacity={1}
											onPress={() => setShowShareMenu(false)}
										>
											<View style={socialOverlayStyles.shareMenuContainer}>
												<TouchableOpacity
													style={socialOverlayStyles.shareMenuItem}
													onPress={() => {
														setShowShareMenu(false);
														setShowShareModal(true);
													}}
													activeOpacity={0.7}
												>
													<Ionicons
														name="chatbubbles-outline"
														size={24}
														color={Colors.text.primary}
													/>
													<Text style={socialOverlayStyles.shareMenuText}>
														Share to DM
													</Text>
												</TouchableOpacity>
												{completedResult && (
													<TouchableOpacity
														style={socialOverlayStyles.shareMenuItem}
														onPress={async () => {
															setShowShareMenu(false);
															setTimeout(async () => {
																try {
																	await handleShare();
																} catch (error) {
																	console.error(
																		"[GameWrapper] Error calling handleShare:",
																		error
																	);
																}
															}, 300);
														}}
														activeOpacity={0.7}
													>
														<Ionicons
															name="share-outline"
															size={24}
															color={Colors.text.primary}
														/>
														<Text style={socialOverlayStyles.shareMenuText}>
															Share Result
														</Text>
													</TouchableOpacity>
												)}
											</View>
										</TouchableOpacity>
									</Modal>
								</View>
							)}
					</View>
				)
			)}

			{/* Share menu when on intro (opened from feed pill) - same flow as sidebar so Share.share works */}
			{showIntro && (
				<Modal
					visible={showShareMenu}
					transparent={true}
					animationType="fade"
					onRequestClose={() => setShowShareMenu(false)}
				>
					<TouchableOpacity
						style={socialOverlayStyles.shareMenuOverlay}
						activeOpacity={1}
						onPress={() => setShowShareMenu(false)}
					>
						<View style={socialOverlayStyles.shareMenuContainer}>
							<TouchableOpacity
								style={socialOverlayStyles.shareMenuItem}
								onPress={() => {
									setShowShareMenu(false);
									setShowShareModal(true);
								}}
								activeOpacity={0.7}
							>
								<Ionicons name="chatbubbles-outline" size={24} color={Colors.text.primary} />
								<Text style={socialOverlayStyles.shareMenuText}>Share to DM</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={socialOverlayStyles.shareMenuItem}
								onPress={() => {
									setShowShareMenu(false);
									handleShareBeforePlay();
								}}
								activeOpacity={0.7}
							>
								<Ionicons name="share-outline" size={24} color={Colors.text.primary} />
								<Text style={socialOverlayStyles.shareMenuText}>Share game</Text>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</Modal>
			)}

			{/* Stats Modal */}
			<Modal
				visible={showStats && !!completedResult}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowStats(false)}
			>
				<TouchableWithoutFeedback onPress={() => setShowStats(false)}>
					<View style={styles.modalOverlay}>
						<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
							<View style={styles.statsModal}>
								<View style={styles.statsHeader}>
									<Text style={styles.statsHeaderText}>Comparison Stats</Text>
									<TouchableOpacity
										onPress={() => setShowStats(false)}
										style={styles.closeButton}
									>
										<Ionicons name="close" size={24} color={Colors.text.primary} />
									</TouchableOpacity>
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
										userTime={completedResult?.timeTaken ?? 0}
										userAttempts={completedResult?.attempts}
										userMistakes={completedResult?.mistakes}
									/>
								</ScrollView>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			{/* Comments Modal */}
			<CommentsModal
				visible={showCommentsModal}
				gameId={puzzle.id}
				onClose={() => setShowCommentsModal(false)}
				onCommentAdded={() => {
					// Optimistically increment comment count
					setCommentCount((prev) => prev + 1);
				}}
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

// Social overlay styles - merged directly into GameWrapper for instant rendering
const socialOverlayStyles = StyleSheet.create({
	container: {
		position: "absolute",
		right: Spacing.md,
		bottom: 120,
		alignItems: "center",
		gap: Spacing.lg,
		zIndex: 10,
	},
	creatorButton: {
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	avatarContainer: {
		position: "relative",
		width: 56,
		height: 56,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarTouchable: {
		width: 52,
		height: 52,
	},
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 26,
		borderWidth: 2,
		borderColor: Colors.background.primary,
	},
	avatarPlaceholder: {
		width: 52,
		height: 52,
		borderRadius: 26,
		backgroundColor: Colors.background.tertiary,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2,
		borderColor: Colors.background.primary,
	},
	followBadge: {
		position: "absolute",
		bottom: -2,
		right: -2,
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2.5,
		borderColor: Colors.background.primary,
	},
	actionButton: {
		alignItems: "center",
		gap: Spacing.xs,
	},
	actionCount: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	shareMenuOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	shareMenuContainer: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.sm,
		minWidth: 200,
		...Shadows.heavy,
	},
	shareMenuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	shareMenuText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		fontWeight: Typography.fontWeight.medium,
	},
});

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: SCREEN_WIDTH,
		backgroundColor: Colors.background.secondary,
		flexDirection: "column",
		overflow: "hidden",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	gameContainer: {
		flex: 1,
		overflow: "hidden",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	gameContainerWithStats: {
		flex: 0.55, // Takes 55% when stats are shown
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	statsModal: {
		width: "85%",
		maxHeight: "75%",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		...Shadows.medium,
	},
	statsHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	statsHeaderText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	statsScrollView: {
		maxHeight: 400,
	},
	statsContent: {
		padding: Spacing.lg,
		paddingTop: Spacing.md,
	},
	error: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background.secondary,
	},
});

export default React.memo(GameWrapper, (prevProps, nextProps) => {
	// Only re-render if puzzle ID changes or active state changes
	return (
		prevProps.puzzle.id === nextProps.puzzle.id &&
		prevProps.isActive === nextProps.isActive &&
		prevProps.startTime === nextProps.startTime
	);
});
