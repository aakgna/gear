import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	ActivityIndicator,
	Platform,
	Alert,
} from "react-native";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, MessageCircle, Heart, Reply } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface NotificationItem {
	id: string;
	type: "Discussion Reply" | "Thread Like" | "Discussion Like";
	text: string;
	originalNotification: string;
	answerId?: string;
	replyId?: string;
}

export default function NotificationsScreen() {
	const router = useRouter();
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		fetchNotifications();
	}, []);

	const fetchNotifications = async () => {
		try {
			const uid = auth().currentUser?.uid;
			if (!uid) {
				router.replace("/");
				return;
			}

			const userDoc = await firestore().collection("users").doc(uid).get();
			const userData = userDoc.data();
			const rawNotifications = userData?.notifications || [];

			// Process all notifications in parallel
			const processPromises = rawNotifications
				.map((notification, index) => {
					// Ensure notification is a string
					if (typeof notification === "string" && notification.trim() !== "") {
						return processNotification(
							notification,
							rawNotifications.length - 1 - index
						);
					}
					return Promise.resolve(null);
				})
				.reverse(); // Reverse to maintain newest-to-oldest order

			const results = await Promise.all(processPromises);
			const processedNotifications = results.filter(
				Boolean
			) as NotificationItem[];

			setNotifications(processedNotifications);
		} catch (error) {
			Alert.alert("Error", "Failed to load notifications");
		} finally {
			setIsLoading(false);
		}
	};

	const processNotification = async (
		notification: string,
		index: number
	): Promise<NotificationItem | null> => {
		try {
			// Ensure we have a valid string
			if (typeof notification !== "string" || !notification.trim()) {
				return null;
			}

			let type: "Discussion Reply" | "Thread Like" | "Discussion Like";
			let text = "";
			let answerId = "";
			let replyId = "";

			if (notification.startsWith("discussion-liked_")) {
				type = "Discussion Like";
				answerId = notification.replace("discussion-liked_", "");
				text = await getDiscussionAnswerText(answerId);
			} else if (notification.startsWith("reply-like_")) {
				type = "Thread Like";
				const ids = notification.replace("reply-like_", "").split("_");
				answerId = ids[0];
				replyId = ids[1];
				text = await getReplyText(answerId, replyId);
			} else if (notification.startsWith("discussion-reply_")) {
				type = "Discussion Reply";
				answerId = notification.replace("discussion-reply_", "");
				text = await getDiscussionAnswerText(answerId);
			} else {
				return null;
			}

			// Ensure text is always a string
			const safeText = String(text || "Content not available");
			const truncatedText = truncateText(safeText, 2);

			return {
				id: `${index}_${Date.now()}_${Math.random()}`,
				type,
				text: truncatedText,
				originalNotification: notification,
				answerId,
				replyId,
			};
		} catch (error) {
			return {
				id: `${index}_${Date.now()}_error`,
				type: "Discussion Like",
				text: "Error loading notification content",
				originalNotification: notification,
			};
		}
	};

	const getDiscussionAnswerText = async (answerId: string): Promise<string> => {
		try {
			// Validate answerId
			if (!answerId || typeof answerId !== "string") {
				return "Invalid answer ID";
			}

			// Search through recent daily questions to find the answer
			const today = new Date();
			const searchDates = [];

			// Check today and previous 7 days
			for (let i = 0; i < 7; i++) {
				const date = new Date(today);
				date.setDate(date.getDate() - i);
				date.setHours(0, 0, 0, 0);
				searchDates.push(date);
			}

			for (const searchDate of searchDates) {
				const endDate = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);

				const questionSnap = await firestore()
					.collection("dailyQuestions")
					.where("date", ">=", searchDate)
					.where("date", "<", endDate)
					.orderBy("date", "asc")
					.limit(1)
					.get();

				if (!questionSnap.empty) {
					const questionId = questionSnap.docs[0].id;
					const answerDoc = await firestore()
						.collection("discussion")
						.doc(questionId)
						.collection("answers")
						.doc(answerId)
						.get();

					if (answerDoc.exists) {
						const data = answerDoc.data();
						const message = data?.message;
						if (message && typeof message === "string") {
							return message;
						}
					}
				}
			}

			return "Message not available";
		} catch (error) {
			return "Error loading message";
		}
	};

	const getReplyText = async (
		answerId: string,
		replyId: string
	): Promise<string> => {
		try {
			// Validate IDs
			if (
				!answerId ||
				!replyId ||
				typeof answerId !== "string" ||
				typeof replyId !== "string"
			) {
				return "Invalid reply ID";
			}

			// Search through recent daily questions to find the reply
			const today = new Date();
			const searchDates = [];

			// Check today and previous 7 days
			for (let i = 0; i < 7; i++) {
				const date = new Date(today);
				date.setDate(date.getDate() - i);
				date.setHours(0, 0, 0, 0);
				searchDates.push(date);
			}

			for (const searchDate of searchDates) {
				const endDate = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);

				const questionSnap = await firestore()
					.collection("dailyQuestions")
					.where("date", ">=", searchDate)
					.where("date", "<", endDate)
					.orderBy("date", "asc")
					.limit(1)
					.get();

				if (!questionSnap.empty) {
					const questionId = questionSnap.docs[0].id;
					const replyDoc = await firestore()
						.collection("discussion")
						.doc(questionId)
						.collection("comments")
						.doc(answerId)
						.collection("comment")
						.doc(replyId)
						.get();

					if (replyDoc.exists) {
						const data = replyDoc.data();
						const message = data?.message;
						if (message && typeof message === "string") {
							return message;
						}
					}
				}
			}

			return "Reply not available";
		} catch (error) {
			return "Error loading reply";
		}
	};

	const truncateText = (text: string, maxLines: number): string => {
		// Ensure text is a string
		if (typeof text !== "string") {
			return "Content not available";
		}

		// Clean the text
		const cleanText = text.trim();
		if (!cleanText) {
			return "Content not available";
		}

		const words = cleanText.split(" ");
		const wordsPerLine = 8;
		const maxWords = maxLines * wordsPerLine;

		if (words.length <= maxWords) {
			return cleanText;
		}

		return words.slice(0, maxWords).join(" ") + "...";
	};

	const handleNotificationPress = async (notification: NotificationItem) => {
		try {
			if (notification.type === "Discussion Like") {
				// Navigate to discussion and scroll to the specific message
				router.push({
					pathname: "/(tabs)/discussion",
					params: {
						scrollToMessage: notification.answerId,
					},
				});
			} else if (notification.type === "Discussion Reply") {
				// Navigate to discussion and open thread for that message
				router.push({
					pathname: "/(tabs)/discussion",
					params: {
						openThread: notification.answerId,
					},
				});
			} else if (notification.type === "Thread Like") {
				// Navigate to discussion, open thread, and scroll to specific reply
				router.push({
					pathname: "/(tabs)/discussion",
					params: {
						openThread: notification.answerId,
						scrollToReply: notification.replyId,
					},
				});
			}
		} catch (error) {
			console.error("Error navigating to discussion:", error);
			Alert.alert("Error", "Failed to navigate to discussion");
		}
	};

	const getNotificationIcon = (type: string) => {
		switch (type) {
			case "Discussion Like":
				return <Heart size={20} color="#9D00FF" fill="#9D00FF" />;
			case "Thread Like":
				return <Heart size={20} color="#9D00FF" fill="#9D00FF" />;
			case "Discussion Reply":
				return <Reply size={20} color="#9D00FF" />;
			default:
				return <MessageCircle size={20} color="#9D00FF" />;
		}
	};

	const handleBack = () => {
		router.back();
	};

	if (isLoading) {
		return (
			<View style={styles.loadingContainer}>
				<LinearGradient
					colors={["#120318", "#1C0529"]}
					style={StyleSheet.absoluteFill}
				/>
				<ActivityIndicator size="large" color="#9D00FF" />
				<Text style={styles.loadingText}>Loading notifications...</Text>
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
				<Pressable style={styles.backButton} onPress={handleBack}>
					<ArrowLeft size={24} color="#9D00FF" />
					<Text style={styles.backText}>Back</Text>
				</Pressable>
				<Text style={styles.headerTitle}>Notifications</Text>
				<View style={{ width: 60 }} />
			</View>

			{/* Notifications List */}
			<ScrollView
				style={styles.notificationsList}
				contentContainerStyle={styles.notificationsContent}
				showsVerticalScrollIndicator={false}
			>
				{notifications.length === 0 ? (
					<View style={styles.emptyContainer}>
						<MessageCircle size={48} color="#666" />
						<Text style={styles.emptyText}>No notifications yet</Text>
						<Text style={styles.emptySubtext}>
							You'll see notifications here when people interact with your
							messages
						</Text>
					</View>
				) : (
					notifications.map((notification, index) => {
						// Extra safety check
						if (
							!notification ||
							!notification.id ||
							!notification.type ||
							!notification.text
						) {
							return null;
						}

						return (
							<Animated.View
								key={notification.id}
								entering={FadeIn.delay(index * 50)}
								style={styles.notificationCard}
							>
								<Pressable
									onPress={() => handleNotificationPress(notification)}
									style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
								>
									<LinearGradient
										colors={["#222222", "#1A1A1A"]}
										start={{ x: 0, y: 0 }}
										end={{ x: 1, y: 1 }}
										style={styles.notificationGradient}
									>
										<View style={styles.notificationHeader}>
											<View style={styles.notificationIconContainer}>
												{getNotificationIcon(notification.type)}
											</View>
											<Text style={styles.notificationType}>
												{String(notification.type)}
											</Text>
										</View>

										<Text style={styles.notificationText}>
											{String(notification.text)}
										</Text>

										{/* Add tap hint */}
										<Text style={styles.tapHint}>
											Tap to view in discussion
										</Text>
									</LinearGradient>
								</Pressable>
							</Animated.View>
						);
					})
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#121212",
	},
	loadingText: {
		color: "#9D00FF",
		fontSize: 16,
		marginTop: 16,
		fontFamily: "Inter-Medium",
	},
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 30,
		paddingHorizontal: 24,
		marginBottom: 20,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	backButton: {
		flexDirection: "row",
		alignItems: "center",
	},
	backText: {
		color: "#9D00FF",
		fontSize: 18,
		marginLeft: 8,
		fontFamily: "Inter-Medium",
	},
	headerTitle: {
		color: "#fff",
		fontSize: 24,
		fontFamily: "Inter-Bold",
		textAlign: "center",
	},
	notificationsList: {
		flex: 1,
		paddingHorizontal: 24,
	},
	notificationsContent: {
		paddingBottom: 20,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 100,
	},
	emptyText: {
		color: "#fff",
		fontSize: 20,
		fontFamily: "Inter-Bold",
		marginTop: 16,
		textAlign: "center",
	},
	emptySubtext: {
		color: "#999",
		fontSize: 16,
		fontFamily: "Inter-Regular",
		marginTop: 8,
		textAlign: "center",
		paddingHorizontal: 40,
		lineHeight: 22,
	},
	notificationCard: {
		marginBottom: 12,
		borderRadius: 16,
		overflow: "hidden",
	},
	notificationGradient: {
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#333333",
	},
	notificationHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	notificationIconContainer: {
		marginRight: 12,
		padding: 4,
	},
	notificationType: {
		color: "#9D00FF",
		fontSize: 16,
		fontFamily: "Inter-Bold",
	},
	notificationText: {
		color: "#fff",
		fontSize: 15,
		fontFamily: "Inter-Regular",
		lineHeight: 22,
		marginLeft: 36,
		marginBottom: 4,
	},
	tapHint: {
		color: "#666",
		fontSize: 12,
		fontFamily: "Inter-Regular",
		marginLeft: 36,
		fontStyle: "italic",
	},
});
