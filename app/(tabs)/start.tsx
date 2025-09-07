// StartPage.tsx
import React, { useState, useEffect, useRef } from "react";
import {
	logDailyOpen,
	logDropOff,
	logScreenView,
	logVoted,
} from "@/analytics/analyticsEvents";
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	ActivityIndicator,
	Platform,
	AppState,
	Alert,
	ScrollView,
	Linking,
	Switch,
	Modal,
	PermissionsAndroid,
	RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import Animated, {
	FadeIn,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
	LogOut,
	Bell,
	BellOff,
	Star,
	Trophy,
	Award,
	Crown,
	Gem,
} from "lucide-react-native";
import DeviceInfo from "react-native-device-info";
import { useLayoutEffect } from "react";
import { useNavigation } from "expo-router";
import messaging from "@react-native-firebase/messaging";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressDots } from "@/components/CreativeStreakComponents";

const getBadgeForStreak = (streakCount: number) => {
	if (streakCount >= 360) {
		return { icon: Award, color: "#9370DB", name: "Legendary" }; // Lavender
	} else if (streakCount >= 320) {
		return { icon: Trophy, color: "#9370DB", name: "Plum" }; // Plum
	} else if (streakCount >= 280) {
		return { icon: Crown, color: "#6A5ACD", name: "Orchid" }; // Orchid
	} else if (streakCount >= 240) {
		return { icon: Gem, color: "#6A5ACD", name: "Medium Orchid" }; // Medium Orchid
	} else if (streakCount >= 200) {
		return { icon: Star, color: "#6A5ACD", name: "Dark Orchid" }; // Dark Orchid
	} else if (streakCount >= 160) {
		return { icon: Award, color: "#6A5ACD", name: "Medium Purple" }; // Medium Purple Good
	} else if (streakCount >= 120) {
		return { icon: Trophy, color: "#6A5ACD", name: "Blue Violet" }; // Blue Violet
	} else if (streakCount >= 80) {
		return { icon: Crown, color: "#9D00FF", name: "Medium Slate Blue" }; // Medium Slate Blue
	} else if (streakCount >= 40) {
		return { icon: Gem, color: "#9D00FF", name: "Slate Blue" }; // Slate Blue Good
	} else if (streakCount >= 20) {
		return { icon: Star, color: "#9D00FF", name: "Rebecca Purple" }; // Rebecca Purple
	} else if (streakCount >= 10) {
		return { icon: Award, color: "#9D00FF", name: "Indigo" }; // Indigo
	} else if (streakCount >= 5) {
		return { icon: Trophy, color: "#9D00FF", name: "Electric Purple" }; // Electric Purple (matches your theme) Good
	}
	return null;
};

// Header badge component
const HeaderBadge = ({ streakCount }: { streakCount: number }) => {
	const badge = getBadgeForStreak(streakCount);

	if (!badge) return null;

	const { icon: IconComponent, color, name } = badge;

	return (
		<Animated.View
			entering={FadeIn.duration(800)}
			style={[
				styles.headerBadgeContainer,
				{
					shadowColor: color,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.4,
					shadowRadius: 4,
					elevation: 6,
				},
			]}
		>
			<LinearGradient
				colors={[`${color}30`, `${color}15`]}
				style={styles.headerBadgeGradient}
			>
				<IconComponent size={20} color={color} />
			</LinearGradient>
		</Animated.View>
	);
};

// Replace with your backend endpoints
const REGISTER_TOKEN_URL = "https://your-backend.com/api/register-fcm-token";
const REMOVE_TOKEN_URL = "https://your-backend.com/api/remove-fcm-token";

const StartPage = () => {
	const router = useRouter();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const [question, setQuestion] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [hasVoted, setHasVoted] = useState(false);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);
	const [topCount, settopCount] = useState(0);
	const [bottomCount, setbottomCount] = useState(0);
	const [strikes, setStrikes] = useState(0);
	const [top, settop] = useState("");
	const [bottom, setbottom] = useState("");
	const [messageCount, setMessageCount] = useState();
	const [streakCount, setStreakCount] = useState(0);

	// Add these missing state variables
	const [modalVisible, setModalVisible] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [showNotifPrompt, setShowNotifPrompt] = useState(false);

	const [refreshing, setRefreshing] = useState(false);

	// animation hooks
	const topScale = useSharedValue(1);
	const bottomScale = useSharedValue(1);
	const agreeAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: topScale.value }],
	}));
	const disagreeAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: bottomScale.value }],
	}));

	// log screen view
	useEffect(() => {
		const uid = auth().currentUser?.uid;
		(async () => {
			try {
				await logScreenView("Start", uid);
			} catch (error) {
				console.error("Analytics error:", error);
			}
		})();
	}, []);

	// AppState refetch
	function useAppState() {
		const [state, setState] = useState(AppState.currentState);
		useEffect(() => {
			const sub = AppState.addEventListener("change", setState);
			return () => sub.remove();
		}, []);
		return state;
	}
	const app = useAppState();
	useEffect(() => {
		if (app === "active") {
			checkForUpdate();
			checkUserVote();
			fetchDailyQuestion();
		}
	}, [app]);

	// initial load
	useEffect(() => {
		if (!auth().currentUser) {
			router.replace("/");
			return;
		}
		checkForUpdate();
		fetchDailyQuestion();
		checkUserVote();

		const uid = auth().currentUser?.uid;
		if (!uid) return;
		const unsub = firestore()
			.collection("users")
			.doc(uid)
			.onSnapshot((doc) => {
				const data = doc.data();
				if (data?.strikes !== undefined) {
					setStrikes(data.strikes);
					setMessageCount(data.messageCount);
				}
				if (data?.createdAt) {
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const todayStr = today.toISOString().substring(0, 10);
					if (data.createdAt === todayStr && !data.fcmToken) {
						setShowNotifPrompt(true);
					}
				}
			});
		return () => unsub();
	}, []);

	// Check backend token status on mount
	useEffect(() => {
		const checkBackendNotificationStatus = async () => {
			const uid = auth().currentUser?.uid;
			if (!uid) return;
			try {
				const userDoc = await firestore().collection("users").doc(uid).get();
				const data = userDoc.data();
				const token = data?.fcmToken;

				setNotificationsEnabled(!!token && token !== "null");
			} catch (error) {
				console.error("Failed to check notification status:", error);
			}
		};
		checkBackendNotificationStatus();
	}, []);

	useEffect(() => {
		if (showNotifPrompt) {
			Alert.alert(
				"Enable Notifications?",
				"Would you like to turn on notifications to stay updated?",
				[
					{
						text: "No, thanks",
						onPress: () => {
							setShowNotifPrompt(false);
							optOut();
						},
					},
					{
						text: "Yes",
						onPress: () => {
							setShowNotifPrompt(false);
							optIn();
						},
					},
				]
			);
		}
	}, [showNotifPrompt]);

	const checkForUpdate = async () => {
		try {
			const version = await firestore().collection("version").get();
			const versionDoc = version.docs[0];
			const latestVersion = versionDoc.data().number;
			const currentVersion = DeviceInfo.getVersion();

			if (currentVersion !== latestVersion) {
				const storeURL =
					Platform.OS === "ios"
						? "https://apps.apple.com/us/app/the-common-ground/id6744280175"
						: "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

				Alert.alert(
					"Update Required",
					"Please update the app to continue.",
					[
						{
							text: "Update",
							onPress: () => Linking.openURL(storeURL),
						},
					],
					{ cancelable: false }
				);
			}
		} catch (err) {
			console.error("Remote Config version check failed:", err);
		}
	};

	// ✨ ADDED: pull-to-refresh handler
	const onRefresh = async () => {
		try {
			setRefreshing(true);
			await Promise.all([fetchDailyQuestion(), checkUserVote()]);
		} finally {
			setRefreshing(false);
		}
	};

	// fetch today's question
	const fetchDailyQuestion = async () => {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const snap = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.where("date", "<", new Date(today.setUTCHours(24)))
				.orderBy("date", "asc")
				.limit(1)
				.get();

			if (!snap.empty) {
				const data = snap.docs[0].data();
				setQuestion(data.question);
				settopCount(data.topCount || 0);
				setbottomCount(data.bottomCount || 0);
				settop(data.top);
				setbottom(data.bottom);
			} else {
				setQuestion("No question available for today");
			}
		} catch (e) {
			console.error(e);
			Alert.alert("Error", "Failed to load today's question");
		} finally {
			setIsLoading(false);
		}
	};

	// check if user has voted today
	const checkUserVote = async () => {
		const uid = auth().currentUser?.uid;
		if (!uid) return;

		try {
			const userDoc = await firestore().collection("users").doc(uid).get();
			const data = userDoc.data();
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			// Update streakCount from user data
			if (data?.streakCount !== undefined) {
				setStreakCount(data.streakCount);
			}

			if (data?.updatedAt) {
				const lastDate = data.updatedAt.substring(0, 10);
				const todayStr = today.toISOString().substring(0, 10);
				const hasVotedToday = lastDate === todayStr;
				if (!hasVotedToday || !data.voted) {
					await userDoc.ref.update({ voted: false, messageCount: 100 });
					if (data?.opened !== todayStr) {
						(async () => {
							try {
								await logDailyOpen();
							} catch (error) {
								console.error("Analytics error:", error);
							}
						})();
						await userDoc.ref.update({ opened: todayStr });
					}
					setHasVoted(false);
					setSelectedOption(null);
				} else {
					setHasVoted(true);
				}
			} else {
				setHasVoted(false);
				setSelectedOption(null);
			}
		} catch (e) {
			console.error(e);
		}
	};

	// handle vote press
	const handleVote = async (choice: "top" | "bottom") => {
		const uid = auth().currentUser?.uid;
		if (!uid) {
			Alert.alert("Error", "You must be logged in to vote");
			router.replace("/");
			return;
		}

		// animate
		if (choice === "top") {
			topScale.value = withSpring(
				1.05,
				{ damping: 15 },
				() => (topScale.value = withSpring(1))
			);
		} else {
			bottomScale.value = withSpring(
				1.05,
				{ damping: 15 },
				() => (bottomScale.value = withSpring(1))
			);
		}
		setSelectedOption(choice);
		setIsLoading(true);

		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const qSnap = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.where("date", "<", new Date(today.setUTCHours(24)))
				.orderBy("date", "asc")
				.limit(1)
				.get();

			if (!qSnap.empty) {
				const qDoc = qSnap.docs[0];
				const batch = firestore().batch();
				const field = choice === "top" ? "topCount" : "bottomCount";

				batch.update(qDoc.ref, {
					[field]: firestore.FieldValue.increment(1),
				});
				const uRef = firestore().collection("users").doc(uid);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const todayDate = today.toISOString().substring(0, 10);

				batch.set(
					uRef,
					{
						voted: true,
						updatedAt: todayDate,
						messageCount: 100,
					},
					{ merge: true }
				);
				await batch.commit();

				const updated = await qDoc.ref.get();
				const data = updated.data()!;
				settopCount(data.topCount);
				setbottomCount(data.bottomCount);
				setHasVoted(true);
				try {
					await logVoted(qDoc.id);
				} catch (error) {
					console.error("Analytics error:", error);
				}
			}
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	};

	// logout
	const handleLogout = async () => {
		try {
			// Log drop-off if user hasn't voted
			if (!hasVoted) {
				try {
					await logDropOff("log_out", "no_vote");
				} catch (error) {
					console.error("Analytics error:", error);
				}
			}

			await auth().signOut();
			router.replace("/");
		} catch (e) {
			console.error(e);
			Alert.alert("Error", "Failed to sign out");
		}
	};

	// discussion nav
	const handleDiscussionNavigation = async () => {
		try {
			const uid = auth().currentUser?.uid;
			if (!uid) return;
			const userDoc = await firestore().collection("users").doc(uid).get();
			const data = userDoc.data();
			if (!data || data.strikes === undefined) {
				Alert.alert("Error", "User data not found.");
				return;
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const qSnap = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.where("date", "<", new Date(today.setUTCHours(24)))
				.orderBy("date", "asc")
				.limit(1)
				.get();

			if (qSnap.empty) {
				Alert.alert("No question available for today");
				return;
			}
			const doc = qSnap.docs[0];

			router.push({
				pathname: "/discussion",
				params: { question: doc.data().question, questionId: doc.id },
			});
		} catch (e) {
			console.error(e);
		}
	};

	// compute percentages
	const totalVotes = topCount + bottomCount;
	const topPct = totalVotes > 0 ? (topCount / totalVotes) * 100 : 0;
	const bottomPct = totalVotes > 0 ? (bottomCount / totalVotes) * 100 : 0;

	// Add this useEffect to listen for FCM token refresh
	// useEffect(() => {
	//   const unsubscribe = messaging().onTokenRefresh(async (token) => {
	//     if (notificationsEnabled) {
	//       await registerTokenWithBackend(auth().currentUser?.uid, token);
	//     }
	//   });
	//   return unsubscribe;
	// }, [notificationsEnabled]);

	// Add this useLayoutEffect to set up the header with bell icon
	useLayoutEffect(() => {
		navigation.setOptions({
			headerLeft: () => (
				<Pressable
					onPress={() => setModalVisible(true)}
					style={{ marginRight: 16 }}
				>
					{notificationsEnabled ? (
						<Bell color="#9D00FF" size={24} />
					) : (
						<BellOff color="#777" size={24} />
					)}
				</Pressable>
			),
		});
	}, [navigation, notificationsEnabled]);

	// Add these missing functions
	// optIn now immediately re-checks backend token
	const optIn = async () => {
		try {
			// Android 13+ (API 33+) needs explicit POST_NOTIFICATIONS permission
			if (Platform.OS === "android" && Platform.Version >= 33) {
				const granted = await PermissionsAndroid.request(
					PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
				);
				if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
					Alert.alert(
						"Permission denied",
						"Enable notifications in your device settings."
					);
					return;
				}
			}

			// iOS and Android (after permission granted)
			await messaging().registerDeviceForRemoteMessages();
			const authStatus = await messaging().requestPermission();
			if (
				authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
				authStatus === messaging.AuthorizationStatus.PROVISIONAL
			) {
				const token = await messaging().getToken();
				await registerTokenWithBackend(auth().currentUser?.uid, token);

				// Minimal backend re-check
				const uid = auth().currentUser?.uid;
				if (uid) {
					const userDoc = await firestore().collection("users").doc(uid).get();
					const data = userDoc.data();
					const fcmToken = data?.fcmToken;

					setNotificationsEnabled(!!fcmToken && fcmToken !== "null");
				}
			} else {
				Alert.alert(
					"Permission denied",
					"Enable notifications in your device settings."
				);
			}
		} catch (err) {
			console.error("Error getting FCM token:", err);
			Alert.alert("Error", err?.message || String(err));
		}
	};
	// optOut now immediately re-checks backend token
	const optOut = async () => {
		try {
			await removeTokenFromBackend(auth().currentUser?.uid);

			// Minimal backend re-check
			const uid = auth().currentUser?.uid;
			if (uid) {
				const userDoc = await firestore().collection("users").doc(uid).get();
				const data = userDoc.data();
				const fcmToken = data?.fcmToken;

				setNotificationsEnabled(!!fcmToken && fcmToken !== "null");
			}
		} catch (err) {
			Alert.alert("Error", "Failed to disable notifications.");
		}
	};
	const onToggle = (value: boolean) => {
		if (value) {
			optIn();
			setModalVisible(false);
		} else {
			optOut();
			setModalVisible(false);
		}
	};

	if (isLoading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>

			{/* Header */}
			<View style={styles.header}>
				{/* Bell icon on the left - aligned with other header elements */}
				<Pressable
					onPress={() => {
						setModalVisible(true);
					}}
					style={[
						styles.headerIconButton,
						{
							position: "absolute",
							top: Platform.OS === "ios" ? 60 : 40,
							left: 24,
							zIndex: 10, // Increase zIndex significantly
						},
					]}
					hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} // Increase hitSlop
				>
					{notificationsEnabled ? (
						<Bell color="#9D00FF" size={24} />
					) : (
						<BellOff color="#777" size={24} />
					)}
				</Pressable>

				{/* Badge in the center - aligned with other header elements */}
				<View style={styles.headerCenterContainer}>
					<HeaderBadge streakCount={streakCount} />
				</View>

				{/* Logout button on the right - aligned with other header elements */}
				<View style={styles.headerRightContainer}>
					<Pressable style={styles.logoutButton} onPress={handleLogout}>
						<Text style={styles.logoutText}>Logout</Text>
						<LogOut size={16} color="#E6E6FA" />
					</Pressable>
				</View>

				{/* Title container below the header icons */}
				<View
					style={[
						styles.titleContainer,
						{ paddingTop: streakCount >= 0 ? 60 : 80 },
					]}
				>
					{/* Progress dots for streak */}
					{streakCount > 0 && <ProgressDots streakCount={streakCount} />}

					<Text style={styles.headerTitle}>Today's Topic</Text>
				</View>
			</View>

			{/* ✨ ADDED: Wrap content in ScrollView with RefreshControl */}
			<ScrollView
				contentContainerStyle={{ flexGrow: 1 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing} // tracks spinner
						onRefresh={onRefresh} // calls pull-to-refresh handler
						tintColor="#9D00FF" // iOS spinner color
						colors={["#9D00FF"]} // Android spinner colors
					/>
				}
			>
				{/* Content */}
				<Animated.View entering={FadeIn.duration(800)} style={styles.content}>
					<View style={styles.questionContainer}>
						<LinearGradient
							colors={["#9D00FF20", "#6A0DAD20"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={[styles.topicCard, { maxHeight: 200 }]}
						>
							<ScrollView>
								<Text style={styles.topicText}>{question}</Text>
							</ScrollView>
						</LinearGradient>

						{hasVoted ? (
							<>
								{/* Results */}
								<View style={styles.resultsContainer}>
									<Text style={styles.resultsTitle}>Results</Text>
									<View style={styles.barContainer}>
										<View style={[styles.bar, { width: `${topPct}%` }]} />
									</View>
									<View style={styles.resultsTextContainer}>
										<Text style={styles.resultsText}>
											{top}: {topPct.toFixed(1)}% ({topCount})
										</Text>
										<Text style={styles.resultsText}>
											{bottom}: {bottomPct.toFixed(1)}% ({bottomCount})
										</Text>
									</View>
								</View>

								{/* Join Discussion */}
								<Pressable
									style={styles.joinDiscussionButton}
									onPress={handleDiscussionNavigation}
								>
									<Text style={styles.discussionButtonText}>
										Join Discussion
									</Text>
									<Text style={styles.underDiscussionButtonText}>
										Messages Remaining: {messageCount}
									</Text>
									<Text style={styles.strikesText}>
										Strikes Remaining: {strikes}
									</Text>
								</Pressable>

								{/* Need Info pill below Join Discussion */}
								<Pressable
									onPress={() => router.push("/(tabs)/ai-bot")}
									style={styles.needInfoPill}
									hitSlop={8}
								>
									<Text style={styles.needInfoText}>Need Info?</Text>
								</Pressable>
							</>
						) : (
							/* Voting Options */
							<View style={styles.optionsContainer}>
								<Animated.View
									style={[styles.optionWrapper, agreeAnimatedStyle]}
								>
									<Pressable
										style={({ pressed }) => [
											styles.optionButton,
											selectedOption === "top" && styles.selectedOption,
											{ opacity: pressed ? 0.9 : 1 },
										]}
										onPress={() => handleVote("top")}
										disabled={!!selectedOption}
									>
										<LinearGradient
											colors={
												selectedOption === "top"
													? ["#9D00FF", "#6A0DAD"]
													: ["#333333", "#222222"]
											}
											start={{ x: 0, y: 0 }}
											end={{ x: 1, y: 1 }}
											style={styles.optionGradient}
										>
											<Text style={styles.optionText}>{top}</Text>
										</LinearGradient>
									</Pressable>
								</Animated.View>

								<Animated.View
									style={[styles.optionWrapper, disagreeAnimatedStyle]}
								>
									<Pressable
										style={({ pressed }) => [
											styles.optionButton,
											selectedOption === "bottom" && styles.selectedOption,
											{ opacity: pressed ? 0.9 : 1 },
										]}
										onPress={() => handleVote("bottom")}
										disabled={!!selectedOption}
									>
										<LinearGradient
											colors={
												selectedOption === "bottom"
													? ["#9D00FF", "#6A0DAD"]
													: ["#333333", "#222222"]
											}
											start={{ x: 0, y: 0 }}
											end={{ x: 1, y: 1 }}
											style={styles.optionGradient}
										>
											<Text style={styles.optionText}>{bottom}</Text>
										</LinearGradient>
									</Pressable>
								</Animated.View>
							</View>
						)}
					</View>

					{!hasVoted && (
						<View style={styles.footer}>
							<Text style={styles.footerText}>
								Choose carefully – your response contributes to finding common
								ground.
							</Text>
						</View>
					)}
				</Animated.View>
			</ScrollView>

			{/* Notification Toggle Modal */}
			<Modal
				visible={modalVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setModalVisible(false)}
			>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => setModalVisible(false)}
				>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>Push Notifications</Text>
						<Text style={styles.modalDesc}>
							Get notified when your messages are liked or replied to.
						</Text>
						<View style={styles.toggleRow}>
							<Text style={styles.toggleLabel}>Enable Notifications</Text>
							<Switch
								value={notificationsEnabled}
								onValueChange={onToggle}
								trackColor={{ false: "#767577", true: "#9D00FF" }}
								thumbColor={notificationsEnabled ? "#FFFFFF" : "#f4f3f4"}
							/>
						</View>
					</View>
				</Pressable>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212",
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: "#121212",
		justifyContent: "center",
		alignItems: "center",
	},
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 40,
		paddingHorizontal: 24,
		paddingBottom: 10,
		position: "relative",
	},
	headerCenterContainer: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 40,
		left: 0,
		right: 0,
		zIndex: 1,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	headerIconButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 20,
		backgroundColor: "#333333",
		borderWidth: 1,
		borderColor: "#444444",
		overflow: "visible",
	},
	headerRightContainer: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 40,
		right: 24,
		zIndex: 1,
		height: 40,
		justifyContent: "center",
	},
	logoutContainer: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 40,
		right: 24,
		zIndex: 1,
	},
	logoutButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#333333",
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#444444",
	},
	logoutText: {
		color: "#E6E6FA",
		marginRight: 6,
		fontSize: 14,
		fontFamily: "Inter-Medium",
	},
	titleContainer: {
		alignItems: "center",
		// paddingTop: 70,
	},
	headerTitle: {
		fontSize: 32,
		color: "#ffffff",
		fontFamily: "Inter-Bold",
		fontWeight: "bold",
		textAlign: "center",
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		justifyContent: "space-between",
	},
	questionContainer: { flex: 1, justifyContent: "flex-start" },
	topicCard: {
		borderRadius: Platform.OS == "android" ? 24 : 16,
		padding: 24,
		marginTop: 30,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: "#9D00FF40",
		//always include background color for android
		backgroundColor: Platform.OS == "android" ? "#1a0026" : "transparent",
		elevation: 8,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	topicText: {
		fontSize: 24,
		color: "#ffffff",
		textAlign: "center",
		lineHeight: 34,
		fontFamily: "Inter-Bold",
	},
	optionsContainer: {
		flexDirection: "column",
		marginTop: 24,
		gap: 16,
		paddingHorizontal: 24,
	},
	optionWrapper: { width: "100%" },
	optionButton: {
		borderRadius: 28,
		overflow: "hidden",
		elevation: 5,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.8,
		shadowRadius: 8,
	},
	optionGradient: {
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	optionText: {
		color: "#ffffff",
		fontSize: 18,
		fontFamily: "Inter-Bold",
	},
	selectedOption: {
		borderWidth: 2,
		borderColor: "#9D00FF",
	},
	resultsContainer: {
		marginTop: 20,
		width: "100%",
		alignItems: "center",
	},
	resultsTitle: {
		color: "#FFFFFF",
		fontSize: 20,
		marginBottom: 15,
	},
	barContainer: {
		width: "90%",
		height: 20,
		borderRadius: 12,
		backgroundColor: "#1A1A1A",
		overflow: "hidden",
		marginVertical: 10,
	},
	bar: {
		height: "100%",
		backgroundColor: "#8A2BE2",
	},
	resultsTextContainer: {
		width: "90%",
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 10,
	},
	resultsText: {
		color: "#FFFFFF",
		fontSize: 14,
	},
	joinDiscussionButton: {
		backgroundColor: "#1A1A1A",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 12,
		alignItems: "center",
		marginTop: 30,
		borderWidth: 1,
		borderColor: "#BF5FFF",
	},
	discussionButtonText: {
		color: "#FFFFFF",
		fontSize: 20,
		fontWeight: "600",
		padding: 5,
	},
	underDiscussionButtonText: {
		color: "#BF5FFF",
		fontSize: 12,
		fontWeight: "600",
	},
	strikesText: {
		color: "#BF5FFF",
		fontSize: 12,
		fontWeight: "600",
		marginTop: 4,
	},
	footer: { paddingBottom: 40, paddingTop: 40, alignItems: "center" },
	footerText: {
		color: "#999999",
		textAlign: "center",
		fontSize: 14,
		fontFamily: "Inter-Regular",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		width: 320,
		backgroundColor: "#222",
		borderRadius: 16,
		padding: 24,
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#fff",
		marginBottom: 8,
	},
	modalDesc: {
		fontSize: 14,
		color: "#ccc",
		marginBottom: 24,
		textAlign: "center",
	},
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
	},
	toggleLabel: {
		fontSize: 16,
		color: "#fff",
		marginRight: 12,
	},
	chatBot: {
		position: "absolute",
		right: 24,
		width: 50,
		height: 50,
		borderRadius: 25,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 10,
	},
	chatBotText: {
		color: "#FFFFFF",
		fontSize: 16, // Increased from 14 for better fit
		fontWeight: "600",
	},
	needInfoPill: {
		alignSelf: "center",
		marginTop: 40,
		marginBottom: 20,
		height: 40,
		justifyContent: "center",
		paddingHorizontal: 90,
		borderRadius: 25,
		backgroundColor: "#1A1A1A",
		borderWidth: 1,
		borderColor: "#BF5FFF",
		alignItems: "center",
		overflow: "hidden",
		//zIndex: 1,
	},
	needInfoText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	headerBadgeContainer: {
		borderRadius: 20,
		overflow: "hidden",
	},
	headerBadgeGradient: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "rgba(255,255,255,0.2)",
	},
});

export default StartPage;

// Helper: Register token with backend
async function registerTokenWithBackend(userId: any, token: any) {
	if (!userId) return;
	await firestore().collection("users").doc(userId).update({ fcmToken: token });
}

// Helper: Remove token from backend
async function removeTokenFromBackend(userId: any) {
	if (!userId) return;
	await firestore()
		.collection("users")
		.doc(userId)
		.update({ fcmToken: "null" });
}
