// DiscussionScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ScrollView,
	AppState,
	Pressable,
	Modal,
	TouchableOpacity,
	ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, router } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Animated, {
	FadeIn,
	SlideInDown,
	SlideInRight,
	SlideInUp,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Flag, Send, X, Heart, Reply } from "lucide-react-native";
import type { Dispatch, SetStateAction } from "react";

export default function DiscussionScreen() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const { question, questionId } = params as {
		question: string;
		questionId: string;
	};

	const [currentQuestion, setCurrentQuestion] = useState(question);
	const [currentQuestionId, setCurrentQuestionId] = useState(questionId);
	const [messages, setMessages] = useState<Array<any>>([]);
	const [newMessage, setNewMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const scrollViewRef = useRef<ScrollView>(null);
	const appState = useRef(AppState.currentState);
	const [threadModalVisible, setThreadModalVisible] = useState(false);
	const [threadParentMessage, setThreadParentMessage] = useState<{
		id: string;
		text: string;
		user: string;
	} | null>(null);
	const [replyCounts, setReplyCounts] = useState<Record<string, number>>({}); // { [messageId]: number }
	const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
	const [likedMessages, setLikedMessages] = useState<Record<string, boolean>>(
		{}
	);
	const [likedReplies, setLikedReplies] = useState<Record<string, boolean>>({});
	const [replyLikeCounts, setReplyLikeCounts] = useState<
		Record<string, number>
	>({});
	const repliesScrollViewRef = useRef<ScrollView>(null);
	const [blockedUsers, setBlockedUsers] = useState<string[]>([]); // Add this line
	const prevMessageCount = useRef(messages.length);

	// FIX ME: Do we need this useEffect?
	// Fetch daily question if not passed via params (e.g., from tab bar)
	useEffect(() => {
		const fetchCurrentQuestion = async () => {
			if (!question || !questionId) {
				try {
					const today = new Date();
					today.setHours(0, 0, 0, 0); // Start of today
					const questionDoc = await firestore()
						.collection("dailyQuestions")
						.where("date", ">=", today)
						.where("date", "<", new Date(today.getTime() + 24 * 60 * 60 * 1000)) // End of today
						.orderBy("date", "asc")
						.limit(1)
						.get();

					if (!questionDoc.empty) {
						const qData = questionDoc.docs[0].data();
						setCurrentQuestion(qData.question);
						setCurrentQuestionId(questionDoc.docs[0].id);
					} else {
						Alert.alert("No question available", "Please try again later.");
						router.replace("/start"); // Redirect if no question found
					}
				} catch (error: any) {
					console.error("Error fetching daily question in discussion: ", error);
					Alert.alert("Error", "Failed to load discussion topic.");
					router.replace("/start"); // Redirect on error
				}
			}
		};

		fetchCurrentQuestion();
	}, [question, questionId]);

	// AppState hook to refetch vote-status on resume
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
		if (app === "active") checkUserVote();
	}, [app]);

	// 1. Ensure user is still allowed here
	useEffect(() => {
		(async () => {
			const uid = auth().currentUser?.uid;
			if (!uid) {
				router.replace("/");
				return;
			}
			await checkUserVote();
		})();
	}, []);

	// New: Subscribe to current user's blocked list for real-time updates
	useEffect(() => {
		let unsubscribeBlocked: () => void;
		const uid = auth().currentUser?.uid;

		if (uid) {
			unsubscribeBlocked = firestore()
				.collection("users")
				.doc(uid)
				.onSnapshot((docSnap) => {
					if (docSnap.exists) {
						const userData = docSnap.data();
						setBlockedUsers(userData?.blocked || []);
					} else {
						setBlockedUsers([]); // User document somehow not found
					}
				});
		}

		return () => {
			if (unsubscribeBlocked) {
				unsubscribeBlocked();
			}
		};
	}, []); // Empty dependency array, runs once on mount

	// 2. Subscribe to messages, filtering out toxic/blocked
	useEffect(() => {
		let unsubscribe: any;
		(async () => {
			// Only proceed if currentQuestionId is available
			if (!currentQuestionId) return;

			const uid = auth().currentUser?.uid;
			if (!uid) return router.replace("/");

			// No longer need to fetch blocked here, it's handled by the new useEffect
			// const userDoc = await firestore().collection("users").doc(uid).get();
			// const blocked = userDoc.data()?.blocked || [];

			unsubscribe = firestore()
				.collection("discussion")
				.doc(currentQuestionId) // Use currentQuestionId here
				.collection("answers")
				.orderBy("time", "asc")
				.onSnapshot((snap) => {
					if (!snap) return;
					const fetched = snap.docs
						.map((d) => ({
							id: d.id,
							...d.data(),
							isToxic: d.data().isToxic,
							user: d.data().userID,
							text: d.data().message,
						}))
						.filter(
							// 👇 Use the blockedUsers state here
							(m) =>
								m.isToxic !== true && !blockedUsers.includes(m.user as string)
						);
					setMessages(fetched);
				});
		})();
		// 👇 Add blockedUsers to the dependency array
		return () => unsubscribe && unsubscribe();
	}, [currentQuestionId, blockedUsers]); // Depend on currentQuestionId AND blockedUsers

	// 3. Auto-scroll on new messages
	const scrollToBottom = () => {
		scrollViewRef.current?.scrollToEnd({ animated: true });
	};
	useEffect(() => {
		if (messages.length > prevMessageCount.current) {
			scrollToBottom();
			const t = setTimeout(scrollToBottom, 200);
			prevMessageCount.current = messages.length;
			return () => clearTimeout(t);
		}
		prevMessageCount.current = messages.length;
	}, [messages.length]);

	// -- Logic functions --

	// Check if user voted today & still allowed
	const checkUserVote = async () => {
		const uid = auth().currentUser?.uid;
		if (!uid) return;
		try {
			const userDoc = await firestore().collection("users").doc(uid).get();
			const data = userDoc.data()!;
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			if (data.updatedAt) {
				const last = data.updatedAt.substring(0, 10);
				const todayStr = today.toISOString().substring(0, 10);
				const hasVotedToday = last === todayStr;
				if (!hasVotedToday || !data.voted) {
					await userDoc.ref.update({ voted: false, messageCount: 100 });
					router.replace("/start");
				}
			} else {
				router.replace("/start");
			}
		} catch (e: any) {
			console.error(e);
		}
	};

	// Send a new message
	const sendMessage = async () => {
		if (!newMessage.trim()) return;
		setIsSending(true);

		try {
			const uid = auth().currentUser?.uid;
			if (!uid) {
				Alert.alert("User not logged in");
				return router.replace("/");
			}
			const userDoc = await firestore().collection("users").doc(uid).get();
			const userData = userDoc.data()!;
			if (userData.strikes <= 0) {
				Alert.alert(
					"Access Denied",
					"You have been restricted from participating in discussions."
				);
				return;
			}
			if (userData.messages <= 0) {
				Alert.alert("No Messages Left", "Max 100 Messages Per Day");
				return;
			}

			// Moderation: no emails/phones
			const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(
				newMessage
			);
			const hasPhone = /(\+?1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/.test(
				newMessage
			);
			if (hasEmail || hasPhone) {
				Alert.alert("Message Not Sent", "No emails or phone numbers allowed.");
				setNewMessage("");
				return;
			}

			// Toxicity API
			const res = await fetch(
				"https://us-central1-thecommonground-6259d.cloudfunctions.net/analyze_toxicity",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: newMessage }),
				}
			);
			const result = await res.json();
			const scores = result.attributeScores;
			const tooToxic = Object.values(scores).some(
				(s: any) => s.summaryScore.value > 0.7
			);
			console.log("resulting toxicity", tooToxic);
			if (tooToxic) {
				Alert.alert(
					"Message Not Sent",
					"Your message violates our guidelines."
				);
				setNewMessage("");
				return;
			}

			// All good → write to Firestore
			await firestore()
				.collection("discussion")
				.doc(currentQuestionId) // Use currentQuestionId here
				.collection("answers")
				.add({
					message: newMessage,
					time: firestore.FieldValue.serverTimestamp(),
					isToxic: false,
					userID: uid,
					likeCount: 0,
				});

			// decrement user messages
			await firestore()
				.collection("users")
				.doc(uid)
				.update({ messageCount: firestore.FieldValue.increment(-1) });

			setNewMessage("");
		} catch (e: any) {
			console.error(e);
		} finally {
			setIsSending(false);
		}
	};

	// Navigate back to Start
	const handleBack = () => {
		router.navigate("/start");
	};

	// Flag a message
	const handleFlag = (message: { id: string; text: string; user: string }) => {
		router.push({
			pathname: "/report",
			params: {
				messageId: message.id,
				messageText: message.text,
				question: currentQuestionId, // Use currentQuestion here
				user: message.user,
				location: "answers",
				answerID: null,
			},
		});
	};

	// Initialize likeCounts with placeholder logic
	useEffect(() => {
		const fetchLikeStates = async () => {
			const uid = auth().currentUser?.uid;
			if (!uid) return;

			const liked: Record<string, boolean> = {};
			const counts: Record<string, number> = {};

			for (const msg of messages) {
				const docRef = firestore()
					.collection("discussion")
					.doc(currentQuestionId)
					.collection("answers")
					.doc(msg.id);
				const doc = await docRef.get();
				if (doc.exists) {
					const data = doc.data();
					const likeCount = data?.likeCount || 0;
					const likedBy: string[] = data?.likedBy || [];
					counts[msg.id] = likeCount;
					liked[msg.id] = likedBy.includes(uid);
				}
			}
			setLikeCounts(counts);
			setLikedMessages(liked);
		};

		if (messages.length && currentQuestionId) {
			fetchLikeStates();
		}
	}, [messages, currentQuestionId]);

	// Like handler: increment likeCount in Firestore and update local state
	const handleLike = async (msgId: string) => {
		try {
			const userId = auth().currentUser?.uid;
			if (!userId) return;
			const docRef = firestore()
				.collection("discussion")
				.doc(currentQuestionId)
				.collection("answers")
				.doc(msgId);

			const doc = await docRef.get();
			const data = doc.data();
			const likedBy: string[] = data?.likedBy || [];
			const hasLiked = likedBy.includes(userId);

			if (hasLiked) {
				// Unlike: remove userId and decrement likeCount
				await docRef.update({
					likedBy: firestore.FieldValue.arrayRemove(userId),
					likeCount: firestore.FieldValue.increment(-1),
				});
				setLikeCounts((prev) => ({
					...prev,
					[msgId]: Math.max((prev[msgId] || 1) - 1, 0),
				}));
				setLikedMessages((prev) => ({
					...prev,
					[msgId]: false,
				}));
			} else {
				// Like: add userId and increment likeCount
				await docRef.update({
					likedBy: firestore.FieldValue.arrayUnion(userId),
					likeCount: firestore.FieldValue.increment(1),
				});
				setLikeCounts((prev) => ({
					...prev,
					[msgId]: (prev[msgId] || 0) + 1,
				}));
				setLikedMessages((prev) => ({
					...prev,
					[msgId]: true,
				}));
			}
		} catch (error) {
			console.error("Error toggling like:", error);
		}
	};

	// --- Render UI ---

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.container}
			keyboardVerticalOffset={0}
		>
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>

			{/* Back Button */}
			<View style={styles.header}>
				<Pressable style={styles.backButton} onPress={handleBack}>
					<ArrowLeft size={24} color="#9D00FF" />
					<Text style={styles.backText}>Back</Text>
				</Pressable>
			</View>

			{/* Question Card */}
			<LinearGradient
				colors={["#9D00FF20", "#6A0DAD20"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={styles.topicCard}
			>
				<Text style={styles.topicText}>{currentQuestion}</Text>
				{/* Use currentQuestion here */}
			</LinearGradient>

			{/* Messages */}
			<ScrollView
				ref={scrollViewRef}
				style={styles.messagesContainer}
				contentContainerStyle={styles.messagesContent}
				showsVerticalScrollIndicator={false}
			>
				{messages.map(
					(
						msg: { id: string; text: string; user: string; [key: string]: any },
						i
					) => {
						const parentMsg = {
							id: msg.id,
							text: msg.text || "",
							user: msg.user || "",
						};
						return (
							<Animated.View
								key={msg.id}
								// entering={SlideInDown.delay(i * 60).duration(180)}
								style={styles.messageWrapper}
							>
								<LinearGradient
									colors={["#222222", "#1A1A1A"]}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									style={styles.messageBubble}
								>
									<Text style={styles.messageText}>{msg.text}</Text>
									<View style={styles.messageFooter}>
										<Text style={styles.timestampText}>
											{msg.time
												? new Date(msg.time.toDate()).toLocaleTimeString()
												: ""}
										</Text>
									</View>
									{/* Add Like + Reply + Flag row */}
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											marginTop: 8,
										}}
									>
										<Pressable
											style={styles.likeButton}
											onPress={() => handleLike(msg.id)}
										>
											{likedMessages[msg.id] ? (
												<Heart color="#9D00FF" fill="#9D00FF" size={18} />
											) : (
												<Heart color="#9D00FF" size={18} />
											)}
											<Text style={styles.likeCountText}>
												{likeCounts[msg.id] || 0}
											</Text>
										</Pressable>

										{/* Reply Button */}
										<Pressable
											style={[styles.replyButton, { marginLeft: 10 }]}
											onPress={() => {
												setThreadParentMessage(parentMsg);
												setThreadModalVisible(true);
											}}
										>
											<Reply size={18} color="#9D00FF" />
										</Pressable>

										{/* Spacer to push flag button to right */}
										<View style={{ flex: 1 }} />

										{/* Flag button */}
										<Pressable
											style={[styles.flagButton, { marginLeft: 10 }]}
											onPress={() => handleFlag(msg)}
										>
											<Flag size={16} color="#9D00FF" />
										</Pressable>
									</View>
								</LinearGradient>
							</Animated.View>
						);
					}
				)}
			</ScrollView>

			{/* Input + Send */}
			<View style={styles.inputContainer}>
				<TextInput
					style={styles.input}
					placeholder="Type your message..."
					placeholderTextColor="#999"
					value={newMessage}
					onChangeText={setNewMessage}
					multiline
					editable={!isSending}
					onFocus={scrollToBottom}
				/>
				<Pressable
					style={({ pressed }) => [
						styles.sendButton,
						pressed && { opacity: 0.8 },
					]}
					onPress={sendMessage}
					disabled={isSending}
				>
					<LinearGradient
						colors={["#9D00FF", "#6A0DAD"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.sendButtonGradient}
					>
						<Send size={20} color="#fff" />
					</LinearGradient>
				</Pressable>
			</View>

			{/* Thread Modal */}
			{threadParentMessage && (
				<ThreadModal
					visible={threadModalVisible}
					onClose={() => setThreadModalVisible(false)}
					parentMessage={threadParentMessage}
					canReply={true /* TODO: remove as it is checked multiple times */}
					currentQuestionId={currentQuestionId}
				/>
			)}
		</KeyboardAvoidingView>
	);
}

// --- Thread Modal Component (Placeholder Data) ---
type ThreadModalProps = {
	visible: boolean;
	onClose: () => void;
	parentMessage: { id: string; text: string; user: string };
	canReply: boolean;
	currentQuestionId: string;
};

function ThreadModal({
	visible,
	onClose,
	parentMessage,
	canReply,
	currentQuestionId,
}: ThreadModalProps) {
	const [replies, setReplies] = useState<
		{
			id: string;
			text: string;
			user: string;
			isToxic: boolean;
		}[]
	>([]);
	const [replyText, setReplyText] = useState("");
	const [isSendingReply, setIsSendingReply] = useState(false);
	const [likedReplies, setLikedReplies] = useState<Record<string, boolean>>({});
	const [replyLikeCounts, setReplyLikeCounts] = useState<
		Record<string, number>
	>({});
	const repliesScrollViewRef = useRef<ScrollView>(null);

	// Subscribe to replies for the parent message
	useEffect(() => {
		let unsubscribe: any;
		(async () => {
			if (!visible || !currentQuestionId || !parentMessage.id) return;

			const uid = auth().currentUser?.uid;
			if (!uid) return router.push("/");

			const userDoc = await firestore().collection("users").doc(uid).get();
			const blocked = userDoc.data()?.blocked || [];

			unsubscribe = firestore()
				.collection("discussion")
				.doc(currentQuestionId)
				.collection("comments")
				.doc(parentMessage.id)
				.collection("comment")
				.orderBy("time", "asc")
				.onSnapshot((snap) => {
					if (!snap) return;
					const fetched = snap.docs
						.map((d) => ({
							id: d.id,
							...d.data(),
							isToxic: d.data().isToxic,
							user: d.data().userID,
							text: d.data().message,
							time: d.data().time,
							likedBy: d.data().likedBy || [],
							likeCount: d.data().likeCount || 0,
						}))
						.filter(
							(m) => m.isToxic !== true && !blocked.includes(m.user as string)
						);

					setReplies(fetched);

					// Set likedReplies state
					const liked: Record<string, boolean> = {};
					const likeCounts: Record<string, number> = {};
					fetched.forEach((reply) => {
						liked[reply.id] = reply.likedBy.includes(uid);
						likeCounts[reply.id] = reply.likeCount;
					});
					setLikedReplies(liked);
					setReplyLikeCounts(likeCounts);
				});
		})();
		return () => unsubscribe && unsubscribe();
	}, [visible, currentQuestionId, parentMessage.id]); // Depend on currentQuestionId

	const handleSendReply = async () => {
		if (!replyText.trim()) return;
		setIsSendingReply(true);

		try {
			const uid = auth().currentUser?.uid;
			if (!uid) {
				Alert.alert("User not logged in");
				onClose();
				return;
			}
			const userDoc = await firestore().collection("users").doc(uid).get();
			const userData = userDoc.data()!;

			// Check user message limits and strikes (adapt as needed for replies)
			// Assuming 'messages' count also applies to replies. Adjust if separate limit.
			if (userData.strikes <= 0) {
				Alert.alert(
					"Access Denied",
					"You have been restricted from participating in discussions."
				);
				return;
			}
			if (userData.messages <= 0) {
				Alert.alert("No Messages Left", "Max 100 Messages Per Day");
				return;
			}

			// Moderation: no emails/phones
			const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(
				replyText
			);
			const hasPhone = /(\+?1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/.test(
				replyText
			);
			if (hasEmail || hasPhone) {
				Alert.alert("Reply Not Sent", "No emails or phone numbers allowed.");
				setReplyText("");
				return;
			}

			// Toxicity API
			const res = await fetch(
				"https://us-central1-thecommonground-6259d.cloudfunctions.net/analyze_toxicity",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: replyText }),
				}
			);
			const result = await res.json();
			const scores = result.attributeScores;
			const tooToxic = Object.values(scores).some(
				(s: any) => s.summaryScore.value > 0.7
			);
			if (tooToxic) {
				Alert.alert("Reply Not Sent", "Your reply violates our guidelines.");
				setReplyText("");
				return;
			}

			// All good → write to Firestore
			await firestore()
				.collection("discussion")
				.doc(currentQuestionId)
				.collection("comments")
				.doc(parentMessage.id)
				.collection("comment")
				.add({
					message: replyText,
					time: firestore.FieldValue.serverTimestamp(),
					isToxic: false,
					userID: uid,
					likeCount: 0,
				});

			// Decrement user messages (if applicable for replies)
			await firestore()
				.collection("users")
				.doc(uid)
				.update({ messageCount: firestore.FieldValue.increment(-1) });

			setReplyText("");
		} catch (e: any) {
			console.error("Error sending reply:", e);
			Alert.alert("Error", "Failed to send reply.");
		} finally {
			setIsSendingReply(false);
		}
	};

	const handleLike = async (replyId: string) => {
		try {
			const userId = auth().currentUser?.uid;
			if (!userId) return;

			const docRef = firestore()
				.collection("discussion")
				.doc(currentQuestionId)
				.collection("comments")
				.doc(parentMessage.id)
				.collection("comment")
				.doc(replyId);

			const doc = await docRef.get();
			const data = doc.data();
			const likedBy: string[] = data?.likedBy || [];
			const hasLiked = likedBy.includes(userId);

			if (hasLiked) {
				await docRef.update({
					likedBy: firestore.FieldValue.arrayRemove(userId),
					likeCount: firestore.FieldValue.increment(-1),
				});
			} else {
				await docRef.update({
					likedBy: firestore.FieldValue.arrayUnion(userId),
					likeCount: firestore.FieldValue.increment(1),
				});
			}

			// Fetch the latest value after update
			const updatedDoc = await docRef.get();
			const updatedData = updatedDoc.data();
			const updatedLikedBy: string[] = updatedData?.likedBy || [];
			const updatedLikeCount: number = updatedData?.likeCount || 0;

			setLikedReplies((prev) => ({
				...prev,
				[replyId]: updatedLikedBy.includes(userId),
			}));
			setReplyLikeCounts((prev) => ({
				...prev,
				[replyId]: updatedLikeCount,
			}));
		} catch (error) {
			console.error("Error toggling like for reply:", error);
		}
	};

	const scrollRepliesToBottom = () => {
		repliesScrollViewRef.current?.scrollToEnd({ animated: true });
	};

	useEffect(() => {
		scrollRepliesToBottom();
		const t = setTimeout(scrollRepliesToBottom);
		return () => clearTimeout(t);
	}, [replies]);

	const handleFlagReply = (reply: {
		id: string;
		text: string;
		user: string;
	}) => {
		onClose();
		router.push({
			pathname: "/report",
			params: {
				messageId: reply.id,
				messageText: reply.text,
				question: currentQuestionId,
				user: reply.user,
				location: "comments",
				answerID: parentMessage.id,
			},
		});
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={true}
			onRequestClose={onClose}
		>
			<View style={threadStyles.modalOverlay}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={{ width: "100%", alignItems: "center" }}
					keyboardVerticalOffset={0}
				>
					<View style={threadStyles.modalContainer}>
						{/* Header with X button */}
						<View style={threadStyles.modalHeader}>
							<Text style={threadStyles.modalTitle}>Thread</Text>
							<TouchableOpacity
								onPress={onClose}
								style={threadStyles.closeButton}
							>
								<X size={24} color="#9D00FF" />
							</TouchableOpacity>
						</View>
						{/* Parent message */}
						<ScrollView style={threadStyles.parentMessageCard}>
							<Text style={threadStyles.parentMessageText}>
								{parentMessage.text}
							</Text>
						</ScrollView>
						{/* Replies */}
						<ScrollView
							ref={repliesScrollViewRef}
							style={threadStyles.repliesList}
						>
							{replies.map((reply) => (
								<Animated.View
									key={reply.id}
									style={threadStyles.replyCard}
									entering={FadeIn}
								>
									<Text style={threadStyles.replyText}>{reply.text}</Text>
									<Text style={threadStyles.timestampText}>
										{reply.time
											? new Date(reply.time.toDate()).toLocaleTimeString()
											: ""}
									</Text>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											marginTop: 8,
										}}
									>
										<Pressable
											style={styles.likeButton}
											onPress={() => handleLike(reply.id)}
										>
											{likedReplies[reply.id] ? (
												<Heart color="#9D00FF" fill="#9D00FF" size={18} />
											) : (
												<Heart color="#9D00FF" size={18} />
											)}
											<Text style={styles.likeCountText}>
												{replyLikeCounts[reply.id] || 0}
											</Text>
										</Pressable>
										<Pressable
											style={styles.flagButton}
											onPress={() => handleFlagReply(reply)}
										>
											<Flag size={16} color="#9D00FF" />
										</Pressable>
									</View>
								</Animated.View>
							))}
						</ScrollView>
						{/* Reply input */}
						{canReply ? (
							<View style={threadStyles.replyInputContainer}>
								<TextInput
									style={threadStyles.replyInput}
									placeholder="Type your reply..."
									placeholderTextColor="#999"
									value={replyText}
									onChangeText={setReplyText}
									editable={!isSendingReply}
									multiline
									numberOfLines={1}
									maxLength={500} // limits characters users can type
									textAlignVertical="top"
								/>
								<TouchableOpacity
									style={threadStyles.sendReplyButton}
									onPress={handleSendReply}
									disabled={isSendingReply}
								>
									{isSendingReply ? (
										<ActivityIndicator size="small" color="#fff" />
									) : (
										<Send size={20} color="#fff" />
									)}
								</TouchableOpacity>
							</View>
						) : (
							<Text style={threadStyles.cannotReplyText}>
								You must vote to reply in this thread.
							</Text>
						)}
					</View>
				</KeyboardAvoidingView>
			</View>
		</Modal>
	);
}

// --- Styles for ThreadModal and reply badge ---
const threadStyles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(18,3,24,0.95)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContainer: {
		width: "92%",
		maxHeight: "85%",
		backgroundColor: "#1C0529",
		borderRadius: 18,
		padding: 16,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 12,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	modalTitle: {
		color: "#fff",
		fontSize: 20,
		fontFamily: "Inter-Bold",
	},
	closeButton: {
		padding: 4,
	},
	parentMessageCard: {
		backgroundColor: "#2A2A2A",
		borderRadius: 12,
		padding: 12,
		marginBottom: 10,
		maxHeight: 200,
		// minHeight: 44,
	},
	parentMessageText: {
		color: "#fff",
		fontSize: 16,
		fontFamily: "Inter-Medium",
		paddingBottom: 15,
	},
	repliesList: {
		marginBottom: 10,
		height: 220,
	},
	replyCard: {
		backgroundColor: "#222",
		borderRadius: 10,
		padding: 10,
		marginBottom: 8,
	},
	timestampText: {
		fontSize: 12,
		color: "#999999",
		fontFamily: "Inter-Regular",
		marginTop: 6,
	},
	replyText: {
		color: "#fff",
		fontSize: 15,
		fontFamily: "Inter-Regular",
	},
	replyInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#222",
		borderRadius: 20,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginTop: 6,
	},
	replyInput: {
		flex: 1,
		color: "#fff",
		fontSize: 15,
		fontFamily: "Inter-Regular",
		paddingVertical: 6,
		paddingHorizontal: 10,
		maxHeight: 60,
		minHeight: 20,
	},
	sendReplyButton: {
		backgroundColor: "#9D00FF",
		borderRadius: 16,
		padding: 8,
		marginLeft: 8,
	},
	cannotReplyText: {
		color: "#BF5FFF",
		textAlign: "center",
		marginTop: 10,
		fontSize: 14,
	},
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#121212" },
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 30,
		paddingHorizontal: 24,
		marginBottom: 12,
	},
	backButton: { flexDirection: "row", alignItems: "center" },
	backText: {
		color: "#9D00FF",
		fontSize: 18,
		marginLeft: 8,
		fontFamily: "Inter-Medium",
	},
	topicCard: {
		borderRadius: 16,
		padding: 20,
		marginHorizontal: 24,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: "#9D00FF40",
		elevation: 5,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	topicText: {
		fontSize: 18,
		color: "#fff",
		textAlign: "center",
		lineHeight: 26,
		fontFamily: "Inter-Bold",
	},
	messagesContainer: { flex: 1, paddingHorizontal: 24 },
	messagesContent: { paddingVertical: 10 },
	messageWrapper: { marginBottom: 16 },
	messageBubble: {
		borderRadius: 16,
		padding: 8,
		borderWidth: 1,
		borderColor: "#333333",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
	messageText: {
		fontSize: 16,
		color: "#fff",
		fontFamily: "Inter-Regular",
		lineHeight: 24,
	},
	messageFooter: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 8,
	},
	timestampText: {
		fontSize: 12,
		color: "#999999",
		fontFamily: "Inter-Regular",
	},
	flagButton: { padding: 4 },
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(26,26,26,0.95)",
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderTopWidth: 1,
		borderTopColor: "#333333",
		paddingBottom: 15,
		marginBottom: 0,
	},
	input: {
		flex: 1,
		backgroundColor: "#222222",
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 12,
		marginRight: 12,
		color: "#fff",
		maxHeight: 100,
		fontFamily: "Inter-Regular",
		fontSize: 16,
	},
	sendButton: {
		borderRadius: 20,
		overflow: "hidden",
		elevation: 8,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	sendButtonGradient: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	replyButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "transparent",
		borderRadius: 16,
		paddingVertical: 4,
		paddingHorizontal: 6,
		alignSelf: "center",
	},
	replyButtonText: {
		color: "#9D00FF",
		fontSize: 15,
		fontFamily: "Inter-Bold",
		marginRight: 6,
	},
	replyBadge: {
		backgroundColor: "#9D00FF",
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 2,
		paddingHorizontal: 5,
	},
	replyBadgeText: {
		color: "#fff",
		fontSize: 12,
		fontFamily: "Inter-Bold",
	},
	likeButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "transparent",
		borderRadius: 16,
		paddingVertical: 4,
		paddingHorizontal: 6,
	},
	likeCountText: {
		color: "#aaa",
		fontSize: 14,
		fontFamily: "Inter-Regular",
		marginLeft: 4,
	},
});
