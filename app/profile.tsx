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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionEndRefresh } from "../utils/sessionRefresh";
import { useRouter, usePathname, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGameStore } from "../stores/gameStore";
import {
	getCurrentUser,
	getUserData,
	signOut,
	deleteAccount,
	UserData,
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
import { fetchGameHistory, GameHistoryEntry } from "../config/firebase";
import {
	fetchCreatedGames,
	GameSummary,
	getUnreadNotificationCount,
} from "../config/social";
import { fetchConversations } from "../config/messaging";
import { PuzzleType } from "../config/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOTTOM_NAV_HEIGHT = 70;

type TabType = "created" | "completed" | "attempted";

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

const getGameIcon = (gameType: string): keyof typeof Ionicons.glyphMap => {
	const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
		wordle: "text-outline",
		riddle: "help-circle-outline",
		quickMath: "calculator-outline",
		alias: "book-outline",
		wordChain: "link-outline",
		trivia: "trophy-outline",
		mastermind: "color-palette-outline",
		sequencing: "list-outline",
		sudoku: "grid-outline",
		futoshiki: "code-working-outline",
		hidato: "navigate-outline",
		zip: "git-branch-outline",
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
	const [completedGames, setCompletedGames] = useState<GameHistoryEntry[]>([]);
	const [attemptedGames, setAttemptedGames] = useState<GameHistoryEntry[]>([]);
	const [loadingGames, setLoadingGames] = useState(false);
	const [deletingAccount, setDeletingAccount] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const [unreadMessageCount, setUnreadMessageCount] = useState(0);
	// Cache flags to track which tabs have been loaded
	const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set());
	const currentUser = getCurrentUser();

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

	// Tab indicator animation
	const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

	// Animation refs for header icon pop animations
	const searchScale = useRef(new Animated.Value(1)).current;
	const notificationsScale = useRef(new Animated.Value(1)).current;
	const inboxScale = useRef(new Animated.Value(1)).current;
	const menuScale = useRef(new Animated.Value(1)).current;
	
	// Animation refs for avatar bounce
	const avatarScale = useRef(new Animated.Value(0)).current;
	const avatarOpacity = useRef(new Animated.Value(0)).current;
	
	// Animation refs for staggered stats (bottom to top)
	const stat1Opacity = useRef(new Animated.Value(0)).current; // Avg Time (bottom)
	const stat2Opacity = useRef(new Animated.Value(0)).current; // Streak
	const stat3Opacity = useRef(new Animated.Value(0)).current; // Completed
	const stat4Opacity = useRef(new Animated.Value(0)).current; // Games
	const stat5Opacity = useRef(new Animated.Value(0)).current; // Followers
	const stat6Opacity = useRef(new Animated.Value(0)).current; // Following (top)

	// Page-level fade animation
	const pageOpacity = useRef(new Animated.Value(0)).current;

	// Game card animations - use Map to store per-card animations
	const gameCardAnimations = useRef<Map<number, Animated.Value>>(new Map()).current;

	// Helper to get or create animation value for a card
	const getCardAnimation = (index: number): Animated.Value => {
		if (!gameCardAnimations.has(index)) {
			gameCardAnimations.set(index, new Animated.Value(1));
		}
		return gameCardAnimations.get(index)!;
	};

	useEffect(() => {
		const tabIndex =
			activeTab === "created" ? 0 : activeTab === "completed" ? 1 : 2;
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
					activeTab === "created" ? createdGames :
					activeTab === "completed" ? completedGames :
					attemptedGames;
				
				if (currentGames.length > 0) {
					// Animate ALL cards, not just first 8
					const cardAnimations = Array.from({ length: currentGames.length }, (_, i) => {
						const anim = getCardAnimation(i);
						return Animated.timing(anim, {
							toValue: 1,
							duration: 300,
							delay: i * 20,
							useNativeDriver: true,
						});
					});
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
			// Load notification count
			const count = await getUnreadNotificationCount(user.uid);
			setUnreadNotificationCount(count);
			// Load unread message count
			const conversations = await fetchConversations(user.uid);
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
			} else if (tab === "completed") {
				const history = await fetchGameHistory(user.uid, {
					action: "completed",
					limit: 50,
				});
				// Filter out completed games where answer was revealed (to match totalGamesPlayed)
				const filteredHistory = history.filter(
					(game) => !game.answerRevealed
				);

				setCompletedGames(filteredHistory);
			} else if (tab === "attempted") {
				const attempted = await fetchGameHistory(user.uid, {
					action: "attempted",
					limit: 50,
				});

				setAttemptedGames(attempted);
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
		completed: 0,
		attempted: 0,
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

	const renderGameCard = useCallback(
		(item: GameSummary | GameHistoryEntry, index: number) => {
			const gameType =
				"gameType" in item ? item.gameType : item.category || "wordle";
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

			// Check if this is a GameHistoryEntry with completionCount (only show on completed tab)
			const isGameHistoryEntry = "action" in item;
			const showCompletionCount =
				activeTab === "completed" &&
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
						activeOpacity={0.7}
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
						onPress={() => handleIconPress(searchScale, () => router.push("/search-friends"))}
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
						onPress={() => handleIconPress(notificationsScale, () => router.push("/notifications"))}
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
						onPress={() => handleIconPress(inboxScale, () => router.push("/inbox"))}
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
				<Animated.View style={{ transform: [{ scale: menuScale }] }}>
					<TouchableOpacity
						style={styles.menuButton}
						onPress={() => handleIconPress(menuScale, () => setShowMenu(!showMenu))}
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
									cache="force-cache"
								/>
							) : (
								<Ionicons name="person-circle" size={100} color={Colors.accent} />
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

						{/* Bio */}
						{userData?.bio && <Text style={styles.bioText}>{userData.bio}</Text>}
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
												inputRange: [0, 1, 2],
												outputRange: [
													0,
													SCREEN_WIDTH / 3,
													(SCREEN_WIDTH / 3) * 2,
												],
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
							<Text
								style={[
									styles.tabText,
									activeTab === "created" && styles.activeTabText,
								]}
							>
								Created ({userData?.createdGamesCount || 0})
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.tab}
							onPress={() => setActiveTab("completed")}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									activeTab === "completed" && styles.activeTabText,
								]}
							>
								Completed ({userData?.totalGamesPlayed || 0})
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.tab}
							onPress={() => setActiveTab("attempted")}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									activeTab === "attempted" && styles.activeTabText,
								]}
							>
								Attempted ({totalAttemptedGames || 0})
							</Text>
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
							{activeTab === "completed" &&
								completedGames.map((game, index) => renderGameCard(game, index))}
							{activeTab === "attempted" &&
								attemptedGames.map((game, index) => renderGameCard(game, index))}
						</View>
					)}

					{/* Empty State */}
					{!loadingGames &&
						((activeTab === "created" && createdGames.length === 0) ||
							(activeTab === "completed" && completedGames.length === 0) ||
							(activeTab === "attempted" && attemptedGames.length === 0)) && (
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
		backgroundColor: "rgba(255, 255, 255, 0.95)",
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
		backgroundColor: Colors.error,
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
		backgroundColor: Colors.background.primary,
		marginBottom: 0,
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
		gap: Spacing.lg
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
		backgroundColor: Colors.background.primary,
		borderBottomWidth: 0.5,
		borderBottomColor: Colors.border,
		marginBottom: Spacing.sm,
		position: "relative",
		overflow: "hidden",
		paddingHorizontal: Spacing.md,
		gap: Spacing.md,
	},
	tabIndicator: {
		position: "absolute",
		bottom: 0,
		left: 0,
		width: SCREEN_WIDTH / 3,
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
});

// Export the component for use in MainAppContainer
export { ProfileScreen };
// Default export returns null - MainAppContainer handles rendering
export default function ProfileRoute() {
	return null;
}