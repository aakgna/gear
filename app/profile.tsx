import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	Dimensions,
	Image,
	TouchableWithoutFeedback,
	RefreshControl,
	Animated,
	Modal,
	FlatList,
	Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionEndRefresh } from "../utils/sessionRefresh";
import { useRouter, usePathname, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Grid2x2Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGameStore } from "../stores/gameStore";
import {
	getCurrentUser,
	getUserData,
	signOut,
	deleteAccount,
	UserData,
	requestNotificationPermission,
	getFCMToken,
	registerFCMToken,
	removeFCMToken,
} from "../config/auth";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
	getGameColor,
	Gradients,
} from "../constants/DesignSystem";
import { fetchGameHistory, GameHistoryEntry, parsePuzzleId } from "../config/firebase";
import {
	fetchCreatedGames,
	fetchLikedGames,
	GameSummary,
	getUnreadNotificationCount,
	getBlockedUsers,
	unblockUser,
	fetchUserProfile,
	UserPublicProfile,
} from "../config/social";
import { fetchConversations } from "../config/messaging";
import { PuzzleType } from "../config/types";
import { db } from "../config/firebase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOTTOM_NAV_HEIGHT = 70;

type TabType = "created" | "liked";

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

const getGameIcon = (gameType: string): keyof typeof Ionicons.glyphMap => {
	const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
		wordform: "text-outline",
		riddle: "help-circle-outline",
		quickMath: "calculator-outline",
		inference: "book-outline",
		wordChain: "link-outline",
		trivia: "trophy-outline",
		codebreaker: "color-palette-outline",
		sequencing: "list-outline",
		sudoku: "grid-outline",
		futoshiki: "code-working-outline",
		trailfinder: "navigate-outline",
		maze: "git-branch-outline",
		magicSquare: "square-outline",
	};
	return iconMap[gameType] || "game-controller-outline";
};

const ProfileScreen = () => {
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();
	const { userProfile, isAuthenticated, resetProgress } = useGameStore();
	const [userData, setUserData] = useState<UserData | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<TabType>("created");
	const [createdGames, setCreatedGames] = useState<GameSummary[]>([]);
	const [likedGames, setLikedGames] = useState<GameSummary[]>([]);
	const [loadingGames, setLoadingGames] = useState(false);
	const [deletingAccount, setDeletingAccount] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const [unreadMessageCount, setUnreadMessageCount] = useState(0);
	const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
	const [blockedUsers, setBlockedUsers] = useState<UserPublicProfile[]>([]);
	const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
	const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
	// Notification toggle state
	const [showNotifModal, setShowNotifModal] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	// Cache flags to track which tabs have been loaded
	const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set());
	const currentUser = getCurrentUser();

	// Games counter popup state
	const [showGamesPopup, setShowGamesPopup] = useState(false);
	const backdropOpacity = useRef(new Animated.Value(0)).current;
	const popupTranslateY = useRef(new Animated.Value(-20)).current;
	const counterButtonRef = useRef<View>(null);
	const [counterButtonLayout, setCounterButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

	// Delete game modal state
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [selectedGameToDelete, setSelectedGameToDelete] = useState<GameSummary | null>(null);
	const [deletingGame, setDeletingGame] = useState(false);

	const totalAttemptedGames = useMemo(() => {
		if (!userData?.statsByCategory) return 0;
		let total = 0;
		Object.values(userData.statsByCategory).forEach((category) => {
			if (category.attempted && typeof category.attempted === "number") {
				total += category.attempted;
			}
		});
		return total;
	}, [userData?.statsByCategory]);

	// Calculate stats from backend (Firestore) - all values come directly from userData
	const gamesStats = useMemo(() => {
		if (!userData) {
			return { completed: 0, attempted: 0, skipped: 0 };
		}

		// Completed games - directly from backend
		const completed = userData.totalGamesPlayed || 0;

		// Attempted and Skipped - sum from statsByCategory (all from backend)
		let attempted = 0;
		let skipped = 0;
		
		if (userData.statsByCategory) {
			Object.values(userData.statsByCategory).forEach((category) => {
				// These values are already calculated and stored in Firestore
				if (category.attempted && typeof category.attempted === "number") {
					attempted += category.attempted;
				}
				if (category.skipped && typeof category.skipped === "number") {
					skipped += category.skipped;
				}
			});
		}

		return {
			completed, // From userData.totalGamesPlayed (backend)
			attempted, // Sum from userData.statsByCategory[].attempted (backend)
			skipped,   // Sum from userData.statsByCategory[].skipped (backend)
		};
	}, [userData]);

	// Handle counter button press
	const handleCounterPress = () => {
		setShowGamesPopup(true);
		Animated.parallel([
			Animated.timing(backdropOpacity, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.spring(popupTranslateY, {
				toValue: 0,
				tension: 100,
				friction: 8,
				useNativeDriver: true,
			}),
		]).start();
	};

	// Handle close popup
	const handleClosePopup = () => {
		Animated.parallel([
			Animated.timing(backdropOpacity, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}),
			Animated.timing(popupTranslateY, {
				toValue: -20,
				duration: 150,
				useNativeDriver: true,
			}),
		]).start(() => {
			setShowGamesPopup(false);
		});
	};

	// Tab indicator animation
	const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

	// Animation refs for header icon pop animations
	const searchScale = useRef(new Animated.Value(1)).current;
	const notificationsScale = useRef(new Animated.Value(1)).current;
	const inboxScale = useRef(new Animated.Value(1)).current;
	const notificationToggleScale = useRef(new Animated.Value(1)).current;
	const menuScale = useRef(new Animated.Value(1)).current;

	// Animation refs for avatar bounce
	const avatarScale = useRef(new Animated.Value(0)).current;
	const avatarOpacity = useRef(new Animated.Value(0)).current;

	// Animation refs for staggered stats (bottom to top)
	const stat2Opacity = useRef(new Animated.Value(0)).current; // Streak
	const stat5Opacity = useRef(new Animated.Value(0)).current; // Followers
	const stat6Opacity = useRef(new Animated.Value(0)).current; // Following (top)

	// Page-level fade animation
	const pageOpacity = useRef(new Animated.Value(0)).current;

	// Game card animations - use Map to store per-card animations
	const gameCardAnimations = useRef<Map<number, Animated.Value>>(
		new Map()
	).current;

	// Helper to get or create animation value for a card
	const getCardAnimation = (index: number): Animated.Value => {
		if (!gameCardAnimations.has(index)) {
			gameCardAnimations.set(index, new Animated.Value(1));
		}
		return gameCardAnimations.get(index)!;
	};

	useEffect(() => {
		const tabIndex = activeTab === "created" ? 0 : 1;
		Animated.spring(tabIndicatorAnim, {
			toValue: tabIndex,
			useNativeDriver: true,
			tension: 100,
			friction: 8,
		}).start();
	}, [activeTab]);

	// Replace the animation useEffect (lines 161-252) with:
	// Coordinated entrance animations - all at once
	useEffect(() => {
		if (!loading && userData && pathname === "/profile") {
			// Clear animation map
			gameCardAnimations.clear();

			// Reset all animation values
			pageOpacity.setValue(0);
			avatarScale.setValue(0.9);
			avatarOpacity.setValue(0);
			stat2Opacity.setValue(0);
			stat5Opacity.setValue(0);
			stat6Opacity.setValue(0);
			gameCardAnimations.forEach((anim) => anim.setValue(0));

			// Small delay to ensure component is ready
			const timer = setTimeout(() => {
				// All animations run in parallel
				const animations: Animated.CompositeAnimation[] = [
					// Page fade
					Animated.timing(pageOpacity, {
						toValue: 1,
						duration: 300,
						useNativeDriver: true,
					}),
					// Avatar
					Animated.parallel([
						Animated.spring(avatarScale, {
							toValue: 1,
							useNativeDriver: true,
							tension: 100,
							friction: 8,
						}),
						Animated.timing(avatarOpacity, {
							toValue: 1,
							duration: 300,
							useNativeDriver: true,
						}),
					]),
					// Stats (very fast stagger)
					Animated.stagger(30, [
						Animated.timing(stat6Opacity, {
							toValue: 1,
							duration: 300,
							useNativeDriver: true,
						}),
						Animated.timing(stat5Opacity, {
							toValue: 1,
							duration: 300,
							useNativeDriver: true,
						}),
						Animated.timing(stat2Opacity, {
							toValue: 1,
							duration: 300,
							useNativeDriver: true,
						}),
					]),
				];

				// Add game cards for current tab
				if (!loadingGames) {
					const currentGames =
						activeTab === "created" ? createdGames : likedGames;

					if (currentGames.length > 0) {
						// Animate ALL cards, not just first 8
						const cardAnimations = Array.from(
							{ length: currentGames.length },
							(_, i) => {
								const anim = getCardAnimation(i);
								return Animated.timing(anim, {
									toValue: 1,
									duration: 300,
									delay: i * 20,
									useNativeDriver: true,
								});
							}
						);
						animations.push(Animated.parallel(cardAnimations));
					}
				}

				// Start all animations together
				Animated.parallel(animations).start();
			}, 50);

			return () => clearTimeout(timer);
		}
	}, [loading, userData, pathname]);

	const handleIconPress = (scaleAnim: Animated.Value, onPress: () => void) => {
		Animated.sequence([
			Animated.spring(scaleAnim, {
				toValue: 0.85,
				useNativeDriver: true,
				tension: 300,
				friction: 7,
			}),
			Animated.spring(scaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 300,
				friction: 7,
			}),
		]).start();
		onPress();
	};

	useEffect(() => {
		loadUserData();
	}, []);

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);

	const loadUserData = async () => {
		const user = getCurrentUser();
		if (user) {
			const data = await getUserData(user.uid);
			setUserData(data);
			// Check notification status
			setNotificationsEnabled(
				!!data?.fcmToken && data.fcmToken !== "null"
			);
			// Load notification count
			const count = await getUnreadNotificationCount(user.uid);
			setUnreadNotificationCount(count);
			// Load unread message count (using fast version)
			const conversations = await fetchConversations(user.uid, false);
			const totalUnread = conversations.reduce(
				(sum, conv) => sum + (conv.unreadCount || 0),
				0
			);
			setUnreadMessageCount(totalUnread);
			// Load initial tab (created) on first load
			if (activeTab === "created" && !loadedTabs.has("created")) {
				await loadTabData("created", false);
			}
		}
		setLoading(false);
	};

	const loadTabData = async (tab: TabType, forceReload = false) => {
		const user = getCurrentUser();
		if (!user || !userData) return;

		// If tab is already loaded and not forcing reload, skip
		if (!forceReload && loadedTabs.has(tab)) {
			return;
		}

		setLoadingGames(true);
		try {
			if (tab === "created") {
				const games = await fetchCreatedGames(user.uid, 50);
				setCreatedGames(games);
			} else if (tab === "liked") {
				const games = await fetchLikedGames(user.uid, 50);
				setLikedGames(games);
			}

			// Mark tab as loaded
			setLoadedTabs((prev) => new Set(prev).add(tab));

			// Restore scroll position after data loads
			if (scrollViewRef.current && tab === activeTab) {
				const scrollY = scrollPositionsRef.current[tab];
				// Use double requestAnimationFrame to ensure content is rendered
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
					});
				});
			}
		} catch (error) {
			console.error("Error loading tab data:", error);
		} finally {
			setLoadingGames(false);
		}
	};

	// Load tab data when tab changes (only if not already loaded)
	useEffect(() => {
		if (userData && !loadedTabs.has(activeTab)) {
			loadTabData(activeTab, false);
		} else if (loadedTabs.has(activeTab)) {
			// Tab already loaded, just restore scroll position
			if (scrollViewRef.current) {
				const scrollY = scrollPositionsRef.current[activeTab];
				requestAnimationFrame(() => {
					scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
				});
			}
		}
	}, [activeTab, userData]);

	// Track scroll position for each tab
	const scrollViewRef = useRef<ScrollView>(null);
	const scrollPositionsRef = useRef<Record<TabType, number>>({
		created: 0,
		liked: 0,
	});
	const previousPathnameRef = useRef<string>(pathname || "");

	useFocusEffect(
		useCallback(() => {
			// Refresh userData when profile page comes into focus to update tab counts
			const user = getCurrentUser();
			if (user) {
				getUserData(user.uid).then((data) => {
					setUserData(data);
				});
			}
		}, [])
	);

	// Restore scroll position when returning from play-game (but don't reload data)
	// Also refresh notification/message counts when returning from notifications/inbox
	useEffect(() => {
		const previousPath = previousPathnameRef.current;

		// Refresh current tab when returning from play-game to update game list
		if (
			pathname === "/profile" &&
			previousPath.startsWith("/play-game/") &&
			userData
		) {
			// Refresh the current tab's data if it's been loaded
			if (loadedTabs.has(activeTab)) {
				loadTabData(activeTab, true);
			}

			// Restore scroll position for current tab after a short delay
			if (scrollViewRef.current) {
				setTimeout(() => {
					const scrollY = scrollPositionsRef.current[activeTab];
					if (scrollY > 0) {
						requestAnimationFrame(() => {
							scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
						});
					}
				}, 100);
			}
		}

		// Refresh notification count when returning from notifications screen
		if (
			pathname === "/profile" &&
			previousPath === "/notifications" &&
			currentUser
		) {
			const refreshNotificationCount = async () => {
				const count = await getUnreadNotificationCount(currentUser.uid);
				setUnreadNotificationCount(count);
			};
			refreshNotificationCount();
		}

		// Refresh message count when returning from inbox or chat screens
		if (
			pathname === "/profile" &&
			(previousPath === "/inbox" || previousPath.startsWith("/chat/")) &&
			currentUser
		) {
			const refreshMessageCount = async () => {
				const conversations = await fetchConversations(currentUser.uid);
				const totalUnread = conversations.reduce(
					(sum, conv) => sum + (conv.unreadCount || 0),
					0
				);
				setUnreadMessageCount(totalUnread);
			};
			refreshMessageCount();
		}

		// Also refresh counts whenever we're on profile (in case navigation detection fails)
		if (pathname === "/profile" && previousPath !== "/profile" && currentUser) {
			const refreshAllCounts = async () => {
				const notifCount = await getUnreadNotificationCount(currentUser.uid);
				const conversations = await fetchConversations(currentUser.uid);
				const messageCount = conversations.reduce(
					(sum, conv) => sum + (conv.unreadCount || 0),
					0
				);
				setUnreadNotificationCount(notifCount);
				setUnreadMessageCount(messageCount);
			};
			refreshAllCounts();
		}

		previousPathnameRef.current = pathname || "";
	}, [pathname, userData, activeTab, loadedTabs, currentUser]);

	const handleRefresh = async () => {
		setRefreshing(true);
		// Reload user data
		const user = getCurrentUser();
		if (user) {
			const data = await getUserData(user.uid);
			setUserData(data);
			// Reload notification count
			const count = await getUnreadNotificationCount(user.uid);
			setUnreadNotificationCount(count);
			// Reload unread message count
			const conversations = await fetchConversations(user.uid);
			const totalUnread = conversations.reduce(
				(sum, conv) => sum + (conv.unreadCount || 0),
				0
			);
			setUnreadMessageCount(totalUnread);
			// Reload current tab's data
			if (userData) {
				await loadTabData(activeTab, true);
			}
		}
		setRefreshing(false);
	};

	// Function to update local state after follow/unfollow (called from other screens)
	const updateFollowingCount = (increment: number) => {
		if (userData) {
			setUserData({
				...userData,
				followingCount: Math.max(0, (userData.followingCount || 0) + increment),
			});
		}
	};

	// Notification opt-in
	const handleOptIn = async () => {
		try {
			const hasPermission = await requestNotificationPermission();
			if (hasPermission) {
				const token = await getFCMToken();
				if (token && currentUser) {
					await registerFCMToken(currentUser.uid, token);
					setNotificationsEnabled(true);
				} else {
					Alert.alert("Error", "Failed to get notification token.");
				}
			} else {
				Alert.alert(
					"Permission Denied",
					"Please enable notifications in your device settings."
				);
			}
		} catch (error) {
			console.error("Error enabling notifications:", error);
			Alert.alert("Error", "Failed to enable notifications. Please try again.");
		}
	};

	// Notification opt-out
	const handleOptOut = async () => {
		try {
			if (currentUser) {
				await removeFCMToken(currentUser.uid);
				setNotificationsEnabled(false);
			}
		} catch (error) {
			console.error("Error disabling notifications:", error);
			Alert.alert("Error", "Failed to disable notifications. Please try again.");
		}
	};

	// Toggle notification switch
	const handleNotificationToggle = async (value: boolean) => {
		if (value) {
			await handleOptIn();
		} else {
			await handleOptOut();
		}
	};

	const handleLogout = async () => {
		Alert.alert("Logout", "Are you sure you want to logout?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				style: "destructive",
				onPress: async () => {
					try {
						await signOut();
						resetProgress();
						router.replace("/signin");
					} catch (error) {
						Alert.alert("Error", "Failed to sign out. Please try again.");
					}
				},
			},
		]);
	};

	const handleGamePress = (game: GameSummary | GameHistoryEntry) => {
		const gameId = game.gameId;

		// Check if gameId is already a full puzzleId (format: gameType_difficulty_actualId)
		// GameHistoryEntry stores the full puzzleId, while GameSummary stores just the document ID
		const parts = gameId.split("_");
		let puzzleId: string;

		if (parts.length >= 3) {
			// Already a full puzzleId (GameHistoryEntry case)
			puzzleId = gameId;
		} else {
			// Need to construct puzzleId (GameSummary case)
			const gameType = "gameType" in game ? game.gameType : game.category || "";
			const difficulty =
				"difficulty" in game ? game.difficulty : game.difficulty || "";
			puzzleId = `${gameType}_${difficulty}_${gameId}`;
		}

		// Use href format for Expo Router dynamic routes
		router.push({
			pathname: "/play-game/[gameId]",
			params: { gameId: puzzleId },
		} as any);
	};

	// Helper function to delete game from all users' liked subcollections
	const deleteFromLikedCollections = async (
		gameType: string,
		difficulty: string,
		actualGameId: string,
		fullPuzzleId: string
	) => {
		try {
			// Get all users who liked this game
			const likesRef = db
				.collection("games")
				.doc(gameType)
				.collection(difficulty)
				.doc(actualGameId)
				.collection("likes");

			const likesSnapshot = await likesRef.get();

			if (likesSnapshot.empty) {
				console.log("[deleteFromLikedCollections] No likes found for this game");
				return;
			}

			console.log(`[deleteFromLikedCollections] Found ${likesSnapshot.docs.length} users who liked this game`);

			// Helper function to convert lowercase gameType to camelCase
			const toCamelCase = (gameType: string): string => {
				if (gameType === "quickmath") return "quickMath";
				if (gameType === "wordchain") return "wordChain";
				if (gameType === "magicsquare") return "magicSquare";
				return gameType; // wordform, riddle, inference, maze, futoshiki are already correct
			};

			// Generate both lowercase and camelCase versions of puzzleId
			const parts = fullPuzzleId.split("_");
			let camelCasePuzzleId: string | null = null;
			if (parts.length >= 3) {
				const gameTypeLower = parts[0];
				const gameTypeCamel = toCamelCase(gameTypeLower);
				if (gameTypeCamel !== gameTypeLower) {
					camelCasePuzzleId = `${gameTypeCamel}_${parts[1]}_${parts.slice(2).join("_")}`;
				}
			}

			// Delete from each user's liked subcollection
			const deletePromises = likesSnapshot.docs.map(async (likeDoc) => {
				const userId = likeDoc.id;
				
				// Try lowercase version first
				const userLikedRef = db
					.collection("users")
					.doc(userId)
					.collection("liked")
					.doc(fullPuzzleId);
				
				console.log(`[deleteFromLikedCollections] Attempting to delete puzzleId "${fullPuzzleId}" from user ${userId}'s liked collection`);
				
				try {
					// Check if document exists with lowercase puzzleId
					let likedDoc = await userLikedRef.get();
					let exists = typeof likedDoc.exists === "function" 
						? likedDoc.exists() 
						: likedDoc.exists;
					
					// If not found and we have a camelCase version, try that
					if (!exists && camelCasePuzzleId) {
						console.log(`[deleteFromLikedCollections] Trying camelCase version: "${camelCasePuzzleId}"`);
						const camelCaseRef = db
							.collection("users")
							.doc(userId)
							.collection("liked")
							.doc(camelCasePuzzleId);
						likedDoc = await camelCaseRef.get();
						exists = typeof likedDoc.exists === "function" 
							? likedDoc.exists() 
							: likedDoc.exists;
						
						if (exists) {
							await camelCaseRef.delete();
							console.log(`[deleteFromLikedCollections] ✓ Deleted camelCase version from user ${userId}'s liked collection`);
							return;
						}
					}
					
					if (exists) {
						await userLikedRef.delete();
						console.log(`[deleteFromLikedCollections] ✓ Deleted from user ${userId}'s liked collection`);
					} else {
						console.log(`[deleteFromLikedCollections] ⚠ Game not found in user ${userId}'s liked collection (tried both formats)`);
						// Try to find what's actually in their liked collection
						const userLikedSnapshot = await db
							.collection("users")
							.doc(userId)
							.collection("liked")
							.get();
						const likedIds = userLikedSnapshot.docs.map(doc => doc.id);
						// Check if any match our game (case-insensitive comparison)
						const matchingIds = likedIds.filter(id => {
							const idParts = id.split("_");
							const ourParts = fullPuzzleId.split("_");
							if (idParts.length >= 3 && ourParts.length >= 3) {
								return idParts[0].toLowerCase() === ourParts[0].toLowerCase() &&
								       idParts[1] === ourParts[1] &&
								       idParts.slice(2).join("_") === ourParts.slice(2).join("_");
							}
							return false;
						});
						if (matchingIds.length > 0) {
							console.log(`[deleteFromLikedCollections] Found matching game with different casing:`, matchingIds[0]);
							// Delete the matching one
							const matchingRef = db
								.collection("users")
								.doc(userId)
								.collection("liked")
								.doc(matchingIds[0]);
							await matchingRef.delete();
							console.log(`[deleteFromLikedCollections] ✓ Deleted matching game from user ${userId}'s liked collection`);
						} else {
							console.log(`[deleteFromLikedCollections] User ${userId} has ${likedIds.length} liked games. Sample IDs:`, likedIds.slice(0, 3));
						}
					}
				} catch (error) {
					console.error(`[deleteFromLikedCollections] Error deleting from user ${userId}:`, error);
					throw error; // Re-throw to be caught by Promise.all
				}
			});

			// Execute all deletes in parallel
			await Promise.all(deletePromises);
			console.log("[deleteFromLikedCollections] Successfully deleted from all users' liked collections");
		} catch (error) {
			// Log error but don't fail the main operation
			console.error("[deleteFromLikedCollections] Error deleting from liked collections:", error);
			throw error; // Re-throw so caller can handle it
		}
	};

	// Helper function to delete all subcollections within a game document
	const deleteGameSubcollections = async (
		gameType: string,
		difficulty: string,
		actualGameId: string
	) => {
		try {
			const gameRef = db
				.collection("games")
				.doc(gameType)
				.collection(difficulty)
				.doc(actualGameId);

			// List of known subcollections to delete
			const subcollections = ["likes", "comments"];

			// Delete all documents in each subcollection
			const deletePromises = subcollections.map(async (subcollectionName) => {
				try {
					const subcollectionRef = gameRef.collection(subcollectionName);
					const snapshot = await subcollectionRef.get();

					if (snapshot.empty) {
						return;
					}

					// Firestore batch limit is 500 operations, so handle in batches if needed
					const batchSize = 500;
					const docs = snapshot.docs;
					
					for (let i = 0; i < docs.length; i += batchSize) {
						const batch = db.batch();
						const batchDocs = docs.slice(i, i + batchSize);
						
						batchDocs.forEach((doc) => {
							batch.delete(doc.ref);
						});

						await batch.commit();
					}
				} catch (error) {
					// Log error but continue with other subcollections
					console.error(`Error deleting ${subcollectionName} subcollection:`, error);
				}
			});

			// Execute all subcollection deletions in parallel
			await Promise.all(deletePromises);
		} catch (error) {
			// Log error but don't fail the main operation
			console.error("Error deleting game subcollections:", error);
		}
	};

	// Handle long press on game card (2 seconds)
	const handleGameLongPress = (game: GameSummary) => {
		// Only allow deletion on created tab
		if (activeTab !== "created" || !currentUser) return;

		setSelectedGameToDelete(game);
		setShowDeleteModal(true);
	};

	// Handle delete game
	const handleDeleteGame = async () => {
		if (!selectedGameToDelete || !currentUser || deletingGame) return;

		setDeletingGame(true);
		try {
			const firestore = require("@react-native-firebase/firestore").default;
			
			// Get the full puzzleId
			// For created games, gameId is just the document ID, so we need to construct the full puzzleId
			const gameId = selectedGameToDelete.gameId;
			const parts = gameId.split("_");
			let puzzleId: string;

			if (parts.length >= 3) {
				// Already a full puzzleId - normalize gameType to lowercase
				const gameTypePart = parts[0].toLowerCase();
				const difficultyPart = parts[1];
				const actualGameIdPart = parts.slice(2).join("_");
				puzzleId = `${gameTypePart}_${difficultyPart}_${actualGameIdPart}`;
			} else {
				// Need to construct puzzleId
				// Convert gameType to lowercase for puzzleId format (parsePuzzleId expects lowercase)
				const gameTypeLower = (selectedGameToDelete.gameType || "").toLowerCase();
				const difficulty = selectedGameToDelete.difficulty || "";
				puzzleId = `${gameTypeLower}_${difficulty}_${gameId}`;
			}

			console.log(`[handleDeleteGame] Constructed puzzleId: ${puzzleId}`);

			// Parse puzzleId to get gameType, difficulty, and actualGameId
			const parsed = parsePuzzleId(puzzleId);
			if (!parsed) {
				throw new Error("Invalid puzzleId format");
			}

			const { gameType, difficulty, gameId: actualGameId } = parsed;
			console.log(`[handleDeleteGame] Parsed - gameType: ${gameType}, difficulty: ${difficulty}, actualGameId: ${actualGameId}`);

			// Get game reference
			const gameRef = db
				.collection("games")
				.doc(gameType)
				.collection(difficulty)
				.doc(actualGameId);

			const gameDoc = await gameRef.get();
			const gameExists = typeof gameDoc.exists === "function" 
				? gameDoc.exists() 
				: gameDoc.exists;
			
			if (!gameExists) {
				throw new Error("Game not found");
			}

			const gameData = gameDoc.data();
			const creatorUserId = gameData?.uid || gameData?.createdBy;

			// Verify this is the creator
			if (creatorUserId !== currentUser.uid) {
				setDeletingGame(false);
				setShowDeleteModal(false);
				setSelectedGameToDelete(null);
				setTimeout(() => {
					Alert.alert("Error", "You can only delete games you created.");
				}, 300);
				return;
			}

			// Step 1: Delete from all users' liked subcollections
			try {
				await deleteFromLikedCollections(gameType, difficulty, actualGameId, puzzleId);
			} catch (error) {
				console.error("[handleDeleteGame] Error in deleteFromLikedCollections:", error);
				// Continue with deletion even if this step fails
			}

			// Step 2: Delete all subcollections within the game document (likes, comments, etc.)
			await deleteGameSubcollections(gameType, difficulty, actualGameId);

			// Step 3: Delete from creator's createdGames subcollection
			const creatorGameRef = db
				.collection("users")
				.doc(currentUser.uid)
				.collection("createdGames")
				.doc(actualGameId);
			await creatorGameRef.delete();

			// Step 4: Delete the actual game document
			await gameRef.delete();

			// Remove from local state
			setCreatedGames((prev) => prev.filter((g) => g.gameId !== selectedGameToDelete.gameId));

			// Close modal first
			setShowDeleteModal(false);
			setSelectedGameToDelete(null);
			setDeletingGame(false);

			// Show success alert after modal closes
			setTimeout(() => {
				Alert.alert("Success", "Game deleted successfully.");
			}, 300);
		} catch (error: any) {
			console.error("Error deleting game:", error);
			
			// Close modal first
			setShowDeleteModal(false);
			setSelectedGameToDelete(null);
			setDeletingGame(false);

			// Show error alert after modal closes
			setTimeout(() => {
				Alert.alert("Error", error.message || "Failed to delete game. Please try again.");
			}, 300);
		}
	};

	const renderGameCard = useCallback(
		(item: GameSummary | GameHistoryEntry, index: number) => {
			const gameType =
				"gameType" in item ? item.gameType : item.category || "wordform";
			const gameColor = getGameColor(gameType as PuzzleType);
			const cardWidth = (SCREEN_WIDTH - Layout.margin * 2 - Spacing.sm) / 2;

			// Extract document ID from gameId
			// For GameHistoryEntry, gameId is full puzzleId (gameType_difficulty_docId)
			// For GameSummary, gameId is just the document ID
			let documentId = item.gameId;
			const parts = item.gameId.split("_");
			if (parts.length >= 3) {
				// Full puzzleId, extract the last part(s) which is the document ID
				documentId = parts.slice(2).join("_");
			}

			// Truncate ID to match game name width (approximately)
			// Game name is typically 6-12 characters, so truncate ID to similar visual width
			const gameName = formatGameType(gameType);
			const maxIdLength = Math.max(6, Math.min(12, gameName.length + 2));
			const truncatedId =
				documentId.length > maxIdLength
					? `${documentId.substring(0, maxIdLength)}...`
					: documentId;

			// Check if this is a GameHistoryEntry with completionCount
			const isGameHistoryEntry = "action" in item;
			const showCompletionCount =
				isGameHistoryEntry &&
				item.completionCount !== undefined &&
				item.completionCount > 0;

			// Get animation value for this card (only animate if on created tab)
			const cardOpacity = getCardAnimation(index);

			return (
				<Animated.View
					key={index}
					style={{
						opacity: cardOpacity,
						width: cardWidth,
					}}
				>
					<TouchableOpacity
						style={[
							styles.gameCard,
							{ width: cardWidth, borderColor: gameColor },
						]}
						onPress={() => handleGamePress(item)}
						onLongPress={() => {
							// Only allow long press on created tab for GameSummary items
							if (activeTab === "created" && "gameType" in item) {
								handleGameLongPress(item as GameSummary);
							}
						}}
						activeOpacity={0.7}
						delayLongPress={750}
					>
						{showCompletionCount && (
							<View style={styles.completionBadge}>
								<Text style={styles.completionBadgeText}>
									{item.completionCount}
								</Text>
							</View>
						)}
						<View
							style={[
								styles.gameIconContainer,
								{ backgroundColor: gameColor + "20" },
							]}
						>
							<Ionicons
								name={getGameIcon(gameType)}
								size={32}
								color={gameColor}
							/>
						</View>
						<Text style={styles.gameTypeText} numberOfLines={1}>
							{formatGameType(gameType)}
						</Text>
						<Text style={styles.gameIdText} numberOfLines={1}>
							ID: {truncatedId}
						</Text>
						{"playCount" in item && item.playCount > 0 && (
							<Text style={styles.playCountText}>{item.playCount} plays</Text>
						)}
					</TouchableOpacity>
				</Animated.View>
			);
		},
		[activeTab, handleGamePress]
	);

	const handleBlockedUsers = async () => {
		if (!currentUser) return;

		setShowBlockedUsersModal(true);
		setLoadingBlockedUsers(true);
		try {
			const blockedUserIds = await getBlockedUsers(currentUser.uid);
			const profiles = await Promise.all(
				blockedUserIds.map((uid) => fetchUserProfile(uid))
			);
			setBlockedUsers(
				profiles.filter((p): p is UserPublicProfile => p !== null)
			);
		} catch (error) {
			console.error("[ProfileScreen] Error loading blocked users:", error);
			Alert.alert("Error", "Failed to load blocked users");
		} finally {
			setLoadingBlockedUsers(false);
		}
	};

	const handleUnblockUser = async (userId: string, username: string) => {
		if (!currentUser || unblockingUserId) return;

		Alert.alert(
			"Unblock User",
			`Are you sure you want to unblock ${username}?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Unblock",
					style: "default",
					onPress: async () => {
						setUnblockingUserId(userId);
						try {
							await unblockUser(currentUser.uid, userId);
							// Remove from list
							setBlockedUsers((prev) => prev.filter((u) => u.uid !== userId));
							Alert.alert("Success", `${username} has been unblocked`);
						} catch (error) {
							console.error("[ProfileScreen] Error unblocking user:", error);
							Alert.alert("Error", "Failed to unblock user. Please try again.");
						} finally {
							setUnblockingUserId(null);
						}
					},
				},
			]
		);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete Account",
			"Are you sure you want to delete your account? This action cannot be undone. All your data, including game history and statistics, will be permanently deleted.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						// Double confirmation
						Alert.alert(
							"Final Confirmation",
							"This will permanently delete your account and all data. Are you absolutely sure?",
							[
								{ text: "Cancel", style: "cancel" },
								{
									text: "Yes, Delete",
									style: "destructive",
									onPress: async () => {
										setDeletingAccount(true);
										try {
											const user = getCurrentUser();
											if (!user) {
												Alert.alert(
													"Error",
													"No user found. Please sign in again."
												);
												return;
											}

											await deleteAccount(user.uid, userData?.username);
											resetProgress();
											Alert.alert(
												"Account Deleted",
												"Your account has been successfully deleted.",
												[
													{
														text: "OK",
														onPress: () => router.replace("/signin"),
													},
												]
											);
										} catch (error: any) {
											console.error("Error deleting account:", error);
											Alert.alert(
												"Error",
												error.message ||
													"Failed to delete account. Please try again."
											);
										} finally {
											setDeletingAccount(false);
										}
									},
								},
							]
						);
					},
				},
			]
		);
	};

	const formatTime = (seconds: number) => {
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<StatusBar style="dark" />
				<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
					<View style={styles.headerSpacer} />
					<Text style={styles.headerTitle}>Profile</Text>
					<View style={styles.headerSpacer} />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.xs }]}>
				<View style={styles.headerSpacer} />
				<View style={styles.headerActions}>
					<Animated.View style={{ transform: [{ scale: searchScale }] }}>
						<TouchableOpacity
							style={styles.headerButton}
							onPress={() =>
								handleIconPress(searchScale, () =>
									router.push("/search-friends")
								)
							}
							activeOpacity={0.7}
						>
							<Ionicons
								name="search-outline"
								size={22}
								color={Colors.text.primary}
							/>
						</TouchableOpacity>
					</Animated.View>
					<Animated.View style={{ transform: [{ scale: notificationsScale }] }}>
						<TouchableOpacity
							style={styles.headerButton}
							onPress={() =>
								handleIconPress(notificationsScale, () =>
									router.push("/notifications")
								)
							}
							activeOpacity={0.7}
						>
							<Ionicons
								name="notifications-outline"
								size={22}
								color={Colors.text.primary}
							/>
							{unreadNotificationCount > 0 && (
								<View style={styles.badge}>
									<Text style={styles.badgeText}>
										{unreadNotificationCount > 99
											? "99+"
											: unreadNotificationCount}
									</Text>
								</View>
							)}
						</TouchableOpacity>
					</Animated.View>
					<Animated.View style={{ transform: [{ scale: inboxScale }] }}>
						<TouchableOpacity
							style={styles.headerButton}
							onPress={() =>
								handleIconPress(inboxScale, () => router.push("/inbox"))
							}
							activeOpacity={0.7}
						>
							<Ionicons
								name="chatbubbles-outline"
								size={22}
								color={Colors.text.primary}
							/>
							{unreadMessageCount > 0 && (
								<View style={styles.badge}>
									<Text style={styles.badgeText}>
										{unreadMessageCount > 99 ? "99+" : unreadMessageCount}
									</Text>
								</View>
							)}
						</TouchableOpacity>
					</Animated.View>
					<Animated.View style={{ transform: [{ scale: notificationToggleScale }] }}>
						<TouchableOpacity
							style={styles.headerButton}
							onPress={() =>
								handleIconPress(notificationToggleScale, () =>
									setShowNotifModal(true)
								)
							}
							activeOpacity={0.7}
						>
							<Ionicons
								name={notificationsEnabled ? "notifications" : "notifications-off"}
								size={22}
								color={notificationsEnabled ? Colors.accent : Colors.text.secondary}
							/>
						</TouchableOpacity>
					</Animated.View>
					<Animated.View style={{ transform: [{ scale: menuScale }] }}>
						<TouchableOpacity
							style={styles.menuButton}
							onPress={() =>
								handleIconPress(menuScale, () => setShowMenu(!showMenu))
							}
							activeOpacity={0.7}
						>
							<Ionicons
								name="ellipsis-horizontal"
								size={22}
								color={Colors.text.primary}
							/>
						</TouchableOpacity>
					</Animated.View>
				</View>
			</View>

			{/* Menu Dropdown */}
			{showMenu && (
				<>
					<TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
						<View style={styles.menuOverlay} />
					</TouchableWithoutFeedback>
					<View style={styles.menuDropdown}>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setShowMenu(false);
								handleBlockedUsers();
							}}
						>
							<Ionicons
								name="ban-outline"
								size={20}
								color={Colors.text.primary}
							/>
							<Text style={styles.menuItemText}>Blocked Users</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setShowMenu(false);
								handleLogout();
							}}
						>
							<Ionicons name="log-out-outline" size={20} color={Colors.error} />
							<Text style={[styles.menuItemText, { color: Colors.error }]}>
								Logout
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setShowMenu(false);
								handleDeleteAccount();
							}}
							disabled={deletingAccount}
						>
							{deletingAccount ? (
								<ActivityIndicator size="small" color={Colors.error} />
							) : (
								<Ionicons name="trash-outline" size={20} color={Colors.error} />
							)}
							<Text style={[styles.menuItemText, { color: Colors.error }]}>
								{deletingAccount ? "Deleting..." : "Delete Account"}
							</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			<Animated.View style={{ flex: 1, opacity: pageOpacity }}>
				<ScrollView
					ref={scrollViewRef}
					style={styles.content}
					contentContainerStyle={{
						paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
					}}
					showsVerticalScrollIndicator={false}
					onScroll={(event) => {
						// Track scroll position for current tab
						const scrollY = event.nativeEvent.contentOffset.y;
						scrollPositionsRef.current[activeTab] = scrollY;
					}}
					scrollEventThrottle={100}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							tintColor={Colors.accent}
							colors={[Colors.accent]}
						/>
					}
				>
					{/* Profile Header */}
					<View style={styles.profileHeader}>
						<Animated.View
							style={[
								styles.avatarContainer,
								{
									transform: [{ scale: avatarScale }],
									opacity: avatarOpacity,
								},
							]}
						>
							{userData?.profilePicture ? (
								<Image
									source={{ uri: userData.profilePicture }}
									style={styles.avatar}
									resizeMode="cover"
								/>
							) : (
								<Ionicons
									name="person-circle"
									size={100}
									color={Colors.accent}
								/>
							)}
						</Animated.View>

						<Text style={styles.usernameText}>
							{userData?.username || userProfile?.username || "username"}
						</Text>

						{/* Stats Row - Following, Followers, Games Created */}
						<View style={styles.statsRow}>
							<Animated.View style={{ opacity: stat6Opacity }}>
								<TouchableOpacity
									style={styles.statItem}
									onPress={() =>
										router.push(
											`/followers-following?type=following&username=${
												userData?.username || ""
											}`
										)
									}
								>
									<Text style={styles.statNumber}>
										{userData?.followingCount || 0}
									</Text>
									<Text style={styles.statLabel}>Following</Text>
								</TouchableOpacity>
							</Animated.View>
							{/* Divider */}
							<View style={styles.statDivider} />

							<Animated.View style={{ opacity: stat5Opacity }}>
								<TouchableOpacity
									style={styles.statItem}
									onPress={() =>
										router.push(
											`/followers-following?type=followers&username=${
												userData?.username || ""
											}`
										)
									}
								>
									<Text style={styles.statNumber}>
										{userData?.followerCount || 0}
									</Text>
									<Text style={styles.statLabel}>Followers</Text>
								</TouchableOpacity>
							</Animated.View>

							{/* Divider */}
							<View style={styles.statDivider} />

							<Animated.View style={{ opacity: stat2Opacity }}>
								<View style={styles.statItem}>
									<Text style={styles.statNumber}>
										{userData?.streakCount || 0}
									</Text>
									<Text style={styles.statLabel}>Streak</Text>
								</View>
							</Animated.View>
						</View>

						{/* Games Completed Counter */}
						<View
							ref={counterButtonRef}
							style={styles.counterButtonContainer}
							onLayout={(e) => {
								const { x, y, width, height } = e.nativeEvent.layout;
								setCounterButtonLayout({ x, y, width, height });
							}}
						>
							<TouchableOpacity
								style={styles.counterButton}
								onPress={handleCounterPress}
								activeOpacity={0.7}
							>
								<Ionicons name="trophy" size={16} color={Colors.accent} />
								<Text style={styles.counterText}>{gamesStats.completed}</Text>
							</TouchableOpacity>
						</View>

						{/* Bio */}
						{userData?.bio && (
							<Text style={styles.bioText}>{userData.bio}</Text>
						)}
					</View>

					{/* Tabs */}
					<View style={styles.tabContainer}>
						<Animated.View
							style={[
								styles.tabIndicator,
								{
									transform: [
										{
											translateX: tabIndicatorAnim.interpolate({
												inputRange: [0, 1],
												outputRange: [0, SCREEN_WIDTH / 2],
											}),
										},
									],
								},
							]}
						>
							<LinearGradient
								colors={Gradients.primary}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={StyleSheet.absoluteFill}
							/>
						</Animated.View>
						<TouchableOpacity
							style={styles.tab}
							onPress={() => setActiveTab("created")}
							activeOpacity={0.7}
						>
							<View style={styles.tabContent}>
								<Grid2x2Plus
									size={24}
									color={
										activeTab === "created"
											? Colors.accent
											: Colors.text.secondary
									}
									style={styles.tabIcon}
								/>
								<Text
									style={[
										styles.tabText,
										activeTab === "created" && styles.activeTabText,
									]}
								></Text>
							</View>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.tab}
							onPress={() => setActiveTab("liked")}
							activeOpacity={0.7}
						>
							<View style={styles.tabContent}>
								<Ionicons
									name={activeTab === "liked" ? "heart" : "heart-outline"}
									size={24}
									color={
										activeTab === "liked"
											? Colors.accent
											: Colors.text.secondary
									}
									style={styles.tabIcon}
								/>
								<Text
									style={[
										styles.tabText,
										activeTab === "liked" && styles.activeTabText,
									]}
								></Text>
							</View>
						</TouchableOpacity>
					</View>

					{/* Game Grid */}
					{loadingGames ? (
						<View style={styles.loadingGamesContainer}>
							<ActivityIndicator size="small" color={Colors.accent} />
						</View>
					) : (
						<View style={styles.gameGrid}>
							{activeTab === "created" &&
								createdGames.map((game, index) => renderGameCard(game, index))}
							{activeTab === "liked" &&
								likedGames.map((game, index) => renderGameCard(game, index))}
						</View>
					)}

					{/* Empty State */}
					{!loadingGames &&
						((activeTab === "created" && createdGames.length === 0) ||
							(activeTab === "liked" && likedGames.length === 0)) && (
							<View style={styles.emptyState}>
								<Ionicons
									name="game-controller-outline"
									size={48}
									color={Colors.text.secondary}
								/>
								<Text style={styles.emptyStateText}>
									No {activeTab} games yet
								</Text>
							</View>
						)}
				</ScrollView>
			</Animated.View>

			{/* Notification Toggle Modal */}
			<Modal
				visible={showNotifModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowNotifModal(false)}
			>
				<TouchableWithoutFeedback onPress={() => setShowNotifModal(false)}>
					<View style={styles.notifModalOverlay}>
						<TouchableWithoutFeedback>
							<View style={styles.notifModalContent}>
								<Text style={styles.notifModalTitle}>Push Notifications</Text>
								<Text style={styles.notifModalDesc}>
									Get notified when you receive messages, likes, or when new games are available.
								</Text>
								<View style={styles.notifToggleRow}>
									<Text style={styles.notifToggleLabel}>Enable Notifications</Text>
									<Switch
										value={notificationsEnabled}
										onValueChange={handleNotificationToggle}
										trackColor={{ false: Colors.border, true: Colors.accent + "80" }}
										thumbColor={notificationsEnabled ? Colors.accent : Colors.text.secondary}
										ios_backgroundColor={Colors.border}
									/>
								</View>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			{/* Blocked Users Modal */}
			<Modal
				visible={showBlockedUsersModal}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setShowBlockedUsersModal(false)}
			>
				<View style={styles.modalContainer}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Blocked Users</Text>
							<TouchableOpacity
								style={styles.modalCloseButton}
								onPress={() => setShowBlockedUsersModal(false)}
							>
								<Ionicons name="close" size={24} color={Colors.text.primary} />
							</TouchableOpacity>
						</View>

						{loadingBlockedUsers ? (
							<View style={styles.modalLoadingContainer}>
								<ActivityIndicator size="large" color={Colors.accent} />
							</View>
						) : blockedUsers.length === 0 ? (
							<View style={styles.modalEmptyContainer}>
								<Ionicons
									name="ban-outline"
									size={64}
									color={Colors.text.secondary}
								/>
								<Text style={styles.modalEmptyText}>No blocked users</Text>
							</View>
						) : (
							<FlatList
								data={blockedUsers}
								keyExtractor={(item) => item.uid}
								renderItem={({ item }) => (
									<View style={styles.blockedUserItem}>
										<View style={styles.blockedUserInfo}>
											{item.profilePicture ? (
												<Image
													source={{ uri: item.profilePicture }}
													style={styles.blockedUserAvatar}
												/>
											) : (
												<Ionicons
													name="person-circle"
													size={40}
													color={Colors.accent}
												/>
											)}
											<Text style={styles.blockedUserName}>
												{item.username || "Unknown"}
											</Text>
										</View>
										<TouchableOpacity
											style={styles.unblockButton}
											onPress={() =>
												handleUnblockUser(item.uid, item.username || "user")
											}
											disabled={unblockingUserId === item.uid}
										>
											{unblockingUserId === item.uid ? (
												<ActivityIndicator size="small" color={Colors.accent} />
											) : (
												<Text style={styles.unblockButtonText}>Unblock</Text>
											)}
										</TouchableOpacity>
									</View>
								)}
								contentContainerStyle={styles.modalListContent}
							/>
						)}
					</View>
				</View>
			</Modal>

			{/* Games Stats Popup Modal */}
			<Modal
				visible={showGamesPopup}
				transparent={true}
				animationType="none"
				onRequestClose={handleClosePopup}
			>
				<TouchableWithoutFeedback onPress={handleClosePopup}>
					<Animated.View
						style={[
							styles.popupBackdrop,
							{
								opacity: backdropOpacity,
							},
						]}
					>
						<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
							<Animated.View
								style={[
									styles.popupCard,
									{
										transform: [{ translateY: popupTranslateY }],
										top: counterButtonLayout.y + counterButtonLayout.height + 45,
										right: SCREEN_WIDTH - counterButtonLayout.x - counterButtonLayout.width,
									},
								]}
							>
								<View style={styles.popupHeader}>
									<Text style={styles.popupTitle}>Breakdown</Text>
								</View>
								<View style={styles.popupDivider} />
								<View style={styles.popupStats}>
									<View style={styles.popupStatRow}>
										<View style={[styles.popupStatDot, { backgroundColor: Colors.accent }]} />
										<Text style={styles.popupStatLabel}>Completed</Text>
										<Text style={styles.popupStatValue}>{gamesStats.completed}</Text>
									</View>
									<View style={styles.popupStatRow}>
										<View style={[styles.popupStatDot, { backgroundColor: Colors.text.secondary }]} />
										<Text style={styles.popupStatLabel}>Attempted</Text>
										<Text style={styles.popupStatValue}>{gamesStats.attempted}</Text>
									</View>
									<View style={styles.popupStatRow}>
										<View style={[styles.popupStatDot, { backgroundColor: Colors.text.inactive }]} />
										<Text style={styles.popupStatLabel}>Skipped</Text>
										<Text style={styles.popupStatValue}>{gamesStats.skipped}</Text>
									</View>
								</View>
							</Animated.View>
						</TouchableWithoutFeedback>
					</Animated.View>
				</TouchableWithoutFeedback>
			</Modal>

			{/* Delete Game Modal */}
			<Modal
				visible={showDeleteModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => {
					if (!deletingGame) {
						setShowDeleteModal(false);
						setSelectedGameToDelete(null);
					}
				}}
			>
				<View style={styles.deleteModalOverlay}>
					<View style={styles.deleteModalContent}>
						<View style={styles.deleteModalHeader}>
							<Text style={styles.deleteModalTitle}>Delete Game</Text>
							{!deletingGame && (
								<TouchableOpacity
									style={styles.closeButton}
									onPress={() => {
										setShowDeleteModal(false);
										setSelectedGameToDelete(null);
									}}
								>
									<Ionicons name="close" size={24} color={Colors.text.primary} />
								</TouchableOpacity>
							)}
						</View>

						{deletingGame ? (
							<View style={styles.deleteLoadingContainer}>
								<ActivityIndicator size="large" color={Colors.accent} />
								<Text style={styles.deleteLoadingText}>Deleting game...</Text>
							</View>
						) : (
							<>
								<View style={styles.deleteModalBody}>
									<Ionicons
										name="warning-outline"
										size={48}
										color={Colors.error}
										style={styles.deleteWarningIcon}
									/>
									<Text style={styles.deleteModalText}>
										Are you sure you want to delete this game? This action cannot be undone.
									</Text>
									{selectedGameToDelete && (
										<View style={styles.deleteGameInfo}>
											<Text style={styles.deleteGameInfoLabel}>Game Type:</Text>
											<Text style={styles.deleteGameInfoValue}>
												{formatGameType(selectedGameToDelete.gameType || "")}
											</Text>
										</View>
									)}
								</View>
								<View style={styles.deleteModalActions}>
									<TouchableOpacity
										style={styles.deleteConfirmButton}
										onPress={handleDeleteGame}
										activeOpacity={0.7}
									>
										<Text style={styles.deleteConfirmButtonText}>Delete</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.deleteCancelButton}
										onPress={() => {
											setShowDeleteModal(false);
											setSelectedGameToDelete(null);
										}}
										activeOpacity={0.7}
									>
										<Text style={styles.deleteCancelButtonText}>Cancel</Text>
									</TouchableOpacity>
								</View>
							</>
						)}
					</View>
				</View>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		// backgroundColor: "rgba(255, 255, 255, 0.95)",
		backgroundColor: Colors.background.secondary,
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.xs,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		zIndex: 10,
		minHeight: 48,
	},
	headerSpacer: {
		width: 40,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	headerButton: {
		padding: Spacing.xs,
		position: "relative",
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	menuButton: {
		padding: Spacing.xs,
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	badge: {
		position: "absolute",
		top: 4,
		right: 4,
		backgroundColor: Colors.accent,
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
		borderWidth: 2,
		borderColor: Colors.background.primary,
	},
	badgeText: {
		color: Colors.text.white,
		fontSize: 10,
		fontWeight: Typography.fontWeight.bold,
	},
	menuOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 99,
	},
	menuDropdown: {
		position: "absolute",
		top: 60,
		right: Layout.margin,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.xs,
		zIndex: 100,
		...Shadows.medium,
		minWidth: 150,
	},
	menuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.sm,
	},
	menuItemText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
	},
	notifModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
	},
	notifModalContent: {
		width: "85%",
		maxWidth: 400,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.xl,
		...Shadows.medium,
	},
	notifModalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	notifModalDesc: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginBottom: Spacing.lg,
		lineHeight: 22,
	},
	notifToggleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: Spacing.sm,
	},
	notifToggleLabel: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: Colors.background.primary,
		borderTopLeftRadius: BorderRadius.lg,
		borderTopRightRadius: BorderRadius.lg,
		maxHeight: "80%",
		paddingBottom: Spacing.lg,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	modalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	modalCloseButton: {
		padding: Spacing.xs,
	},
	modalLoadingContainer: {
		padding: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 200,
	},
	modalEmptyContainer: {
		padding: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 200,
	},
	modalEmptyText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	modalListContent: {
		padding: Spacing.md,
	},
	blockedUserItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	blockedUserInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
		gap: Spacing.sm,
	},
	blockedUserAvatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	blockedUserName: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	unblockButton: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.sm,
		backgroundColor: Colors.accent + "20",
	},
	unblockButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
	},
	content: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	profileHeader: {
		alignItems: "center",
		paddingVertical: Spacing.lg,
		backgroundColor: Colors.background.secondary,
		marginBottom: 0,
		position: "relative",
	},
	avatarContainer: {
		marginBottom: Spacing.md,
	},
	avatar: {
		width: 100,
		height: 100,
		borderRadius: 50,
	},
	usernameText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.md,
	},
	statsRow: {
		flexDirection: "row",
		justifyContent: "center",
		width: "100%",
		paddingHorizontal: Layout.margin,
		paddingRight: 30,
		marginBottom: Spacing.lg,
		gap: Spacing.lg,
	},
	statDivider: {
		width: 1,
		height: 30,
		backgroundColor: Colors.border,
		marginHorizontal: Spacing.sm,
	},

	statItem: {
		alignItems: "center",
	},
	statNumber: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	statLabel: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	bioText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		paddingHorizontal: Layout.margin,
	},
	tabContainer: {
		flexDirection: "row",
		backgroundColor: Colors.background.secondary,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		marginBottom: Spacing.sm,
		position: "relative",
		overflow: "hidden",
		paddingHorizontal: Spacing.md,
		gap: Spacing.md,
	},
	tabContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
	},

	tabIcon: {
		marginRight: 0, // Gap handles spacing
	},
	tabIndicator: {
		position: "absolute",
		bottom: 0,
		left: 0,
		width: "50%",
		height: 2,
		zIndex: 1,
	},
	tab: {
		flex: 1,
		paddingVertical: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	activeTab: {
		// Indicator handled by animated view
	},
	tabText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
	},
	activeTabText: {
		color: Colors.accent,
		fontWeight: Typography.fontWeight.bold,
	},
	gameGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		paddingHorizontal: Layout.margin,
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	gameCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		padding: Spacing.md,
		marginBottom: 0,
		alignItems: "center",
		borderWidth: 0,
		...Shadows.light,
		position: "relative",
	},
	gameIconContainer: {
		width: 60,
		height: 60,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	gameTypeText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		textAlign: "center",
	},
	gameIdText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		opacity: 0.9,
		marginTop: 2,
		textAlign: "center",
	},
	playCountText: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	completionBadge: {
		position: "absolute",
		top: 4,
		right: 4,
		backgroundColor: Colors.accent,
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 6,
		zIndex: 1,
	},
	completionBadgeText: {
		color: Colors.text.white,
		fontSize: 11,
		fontWeight: Typography.fontWeight.bold,
	},
	loadingGamesContainer: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyState: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyStateText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	// Games counter popup styles
	counterButtonContainer: {
		position: "absolute",
		top: Spacing.md,
		right: Layout.margin,
		zIndex: 11,
	},
	counterButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.md,
		// borderWidth: 0.2,
		...Shadows.light,
	},
	counterText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	popupBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	popupCard: {
		position: "absolute",
		width: 180,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.md,
		...Shadows.medium,
	},
	popupHeader: {
		marginBottom: Spacing.xs,
	},
	popupTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	popupDivider: {
		height: 1,
		backgroundColor: Colors.border,
		marginVertical: Spacing.sm,
	},
	popupStats: {
		gap: Spacing.sm,
	},
	popupStatRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
	},
	popupStatDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	popupStatLabel: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
	},
	popupStatValue: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	// Delete game modal styles (matching report modal design)
	deleteModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	deleteModalContent: {
		width: "85%",
		maxWidth: 400,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		...Shadows.heavy,
	},
	deleteModalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	deleteModalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	deleteModalBody: {
		padding: Spacing.lg,
		alignItems: "center",
	},
	deleteWarningIcon: {
		marginBottom: Spacing.md,
	},
	deleteModalText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		textAlign: "center",
		marginBottom: Spacing.md,
		lineHeight: 22,
	},
	deleteGameInfo: {
		width: "100%",
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		marginTop: Spacing.sm,
	},
	deleteGameInfoLabel: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
		marginBottom: Spacing.xs,
	},
	deleteGameInfoValue: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	deleteModalActions: {
		flexDirection: "column",
		gap: Spacing.md,
		padding: Spacing.lg,
		paddingTop: Spacing.md,
		borderTopWidth: 1,
		borderTopColor: "rgba(255, 255, 255, 0.1)",
	},
	deleteConfirmButton: {
		width: "100%",
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.error,
	},
	deleteConfirmButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	deleteCancelButton: {
		width: "100%",
		paddingVertical: Spacing.md,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background.secondary,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "20",
	},
	deleteCancelButtonText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
	},
	deleteLoadingContainer: {
		alignItems: "center",
		padding: Spacing.xl,
	},
	deleteLoadingText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
});

// Export the component for use in MainAppContainer
export { ProfileScreen };
// Default export returns null - MainAppContainer handles rendering
export default function ProfileRoute() {
	return null;
}
