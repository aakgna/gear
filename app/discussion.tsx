import { useEffect, useState, useRef } from "react";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
	Platform,
	KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

const DiscussionScreen = () => {
	const params = useLocalSearchParams();
	const { question, questionId } = params;
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const [isInputFocused, setIsInputFocused] = useState(false);
	const router = useRouter();
	const flatListRef = useRef(null);

	// Define constants for text input
	const MIN_INPUT_HEIGHT = 40;
	const EXPANDED_INPUT_HEIGHT = 150;

	useEffect(() => {
		const checkUserStatus = async () => {
			const userId = auth().currentUser?.uid;
			if (!userId) {
				router.replace("/");
				return;
			}
			checkUserVote();
			const userDoc = await firestore().collection("users").doc(userId).get();
			const userData = userDoc.data();
			if (!userData) {
				router.replace("/");
			} else if (userData.voted === false) {
				router.replace("/start");
			}
		};
		checkUserStatus();
	}, []);

	const checkUserVote = async () => {
		const userId = auth().currentUser?.uid;
		if (!userId) return;

		try {
			const userDoc = await firestore().collection("users").doc(userId).get();

			const userData = userDoc.data();
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			// If updatedAt exists, compare only the date portion (YYYY-MM-DD)
			if (userData?.updatedAt) {
				const lastVoteDate = userData.updatedAt.substring(0, 10); // Get just YYYY-MM-DD
				const todayDate = today.toISOString().substring(0, 10); // Get just YYYY-MM-DD
				const hasVotedToday = lastVoteDate === todayDate;
				console.log(lastVoteDate, todayDate, hasVotedToday);
				if (!hasVotedToday && userData.voted) {
					// Reset voted status if it's a new day
					await userDoc.ref.update({
						voted: false,
						messages: 3,
					});
				}
			}
		} catch (error) {
			console.error("Error checking vote:", error);
		}
	};

	useEffect(() => {
		// Subscribe to real-time messages
		const unsubscribe = firestore()
			.collection("discussions")
			.doc(questionId)
			.collection("messages")
			.orderBy("timestamp", "asc")
			.onSnapshot((snapshot) => {
				const newMessages = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}));
				setMessages(newMessages);
			});

		return () => unsubscribe();
	}, [questionId]);

	// Add this function to handle scrolling
	const scrollToBottom = () => {
		if (flatListRef.current && messages.length > 0) {
			flatListRef.current.scrollToOffset({
				offset: Number.MAX_SAFE_INTEGER,
				animated: true,
			});
		}
	};

	// Update the useEffect for messages
	useEffect(() => {
		// Double scroll attempt with delay to ensure content is rendered
		scrollToBottom();
		const scrollTimer = setTimeout(scrollToBottom, 200);
		return () => clearTimeout(scrollTimer);
	}, [messages]);

	const sendMessage = async () => {
		if (!newMessage.trim()) return;

		try {
			if (!auth().currentUser) {
				Alert.alert("User not logged in");
				router.navigate("/");
			}
			const userId = auth().currentUser?.uid;
			const userDoc = await firestore().collection("users").doc(userId).get();
			const userData = userDoc.data();
			if (userData?.messages <= 0) {
				Alert.alert("No Messages Left", "Max 3 Messages Per Day");
				return;
			}
			await firestore()
				.collection("discussions")
				.doc(questionId)
				.collection("messages")
				.add({
					text: newMessage,
					timestamp: firestore.FieldValue.serverTimestamp(),
				});
			setNewMessage("");
			await firestore()
				.collection("users")
				.doc(userId)
				.update({
					messages: firestore.FieldValue.increment(-1),
				});
		} catch (error) {
			console.error("Error sending message:", error);
		}
	};

	// Handle focus and blur events
	const handleFocus = () => {
		setIsInputFocused(true);
		// Scroll to bottom when input is focused to ensure it's visible
		setTimeout(scrollToBottom, 100);
	};

	const handleBlur = () => {
		// Only collapse if there's no text
		if (!newMessage.trim()) {
			setIsInputFocused(false);
		}
	};

	// Function to handle navigation back to start page
	const handleBack = () => {
		if (!auth().currentUser) {
			Alert.alert("User not logged in");
			router.navigate("/");
		}
		router.navigate("/start");
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.container}
			keyboardVerticalOffset={0}
		>
			{/* Add the Back Button here */}
			<TouchableOpacity style={styles.backButton} onPress={handleBack}>
				<Text style={styles.backButtonText}>{"< Back"}</Text>
			</TouchableOpacity>

			<View style={styles.headerContainer}>
				<View style={styles.questionContainer}>
					<Text style={styles.questionText}>{question}</Text>
				</View>
			</View>

			<FlatList
				ref={flatListRef}
				data={messages}
				keyExtractor={(item) => item.id}
				style={styles.messagesList}
				contentContainerStyle={styles.messagesContent}
				renderItem={({ item }) => (
					<View style={styles.messageContainer}>
						<Text style={styles.messageText}>{item.text}</Text>
						<Text style={styles.timestamp}>
							{new Date(item.timestamp?.toDate()).toLocaleTimeString()}
						</Text>
					</View>
				)}
				onContentSizeChange={scrollToBottom}
				onLayout={scrollToBottom}
				removeClippedSubviews={false}
				initialNumToRender={messages.length}
				maxToRenderPerBatch={messages.length}
				windowSize={21}
			/>

			<View style={styles.inputContainer}>
				<TextInput
					style={[
						styles.input,
						{
							height:
								isInputFocused || newMessage.length > 0
									? EXPANDED_INPUT_HEIGHT
									: MIN_INPUT_HEIGHT,
						},
					]}
					value={newMessage}
					onChangeText={setNewMessage}
					placeholder="Type your message..."
					placeholderTextColor="#808080"
					multiline={true}
					maxLength={1000}
					scrollEnabled={true}
					blurOnSubmit={false}
					textAlignVertical="top"
					onFocus={handleFocus}
					onBlur={handleBlur}
				/>
				<TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
					<Text style={styles.sendButtonText}>Send</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
		paddingTop: Platform.OS === "ios" ? 60 : 30,
	},
	backButton: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 30,
		left: 20,
		zIndex: 10,
		padding: 10,
	},
	backButtonText: {
		color: "#BF5FFF",
		fontSize: 16,
		fontWeight: "600",
	},
	headerContainer: {
		paddingHorizontal: "5%",
		paddingBottom: 15,
		marginTop: 50,
	},
	questionContainer: {
		backgroundColor: "#1A1A1A",
		borderRadius: 12,
		padding: 20,
		borderWidth: 1,
		borderColor: "#9B30FF",
	},
	questionText: {
		color: "#FFFFFF",
		fontSize: 20,
		textAlign: "center",
		lineHeight: 28,
	},
	messagesList: {
		flex: 1,
		paddingHorizontal: "5%",
	},
	messagesContent: {
		paddingBottom: 20,
		flexGrow: 1,
	},
	messageContainer: {
		backgroundColor: "#1A1A1A",
		padding: 12,
		borderRadius: 12,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: "#9B30FF",
		maxWidth: "100%",
	},
	messageText: {
		color: "#FFFFFF",
		fontSize: 16,
		marginBottom: 4,
		flexWrap: "wrap",
	},
	timestamp: {
		color: "#B3B3B3",
		fontSize: 12,
		alignSelf: "flex-end",
	},
	inputContainer: {
		flexDirection: "row",
		padding: 16,
		backgroundColor: "#1A1A1A",
		borderTopWidth: 1,
		borderTopColor: "#9B30FF",
		alignItems: "flex-end",
		paddingBottom: Platform.OS === "ios" ? 30 : 16,
		marginBottom: 0,
	},
	input: {
		flex: 1,
		color: "#FFFFFF",
		fontSize: 16,
		lineHeight: 20,
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: "#2A2A2A",
		borderRadius: 20,
		marginRight: 8,
	},
	sendButton: {
		backgroundColor: "#9B30FF",
		padding: 10,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		width: 70,
		height: 40,
	},
	sendButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	discussionButton: {
		backgroundColor: "#9B30FF",
		padding: 16,
		borderRadius: 25,
		alignItems: "center",
		marginTop: 16,
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
	},
});

export default DiscussionScreen;
