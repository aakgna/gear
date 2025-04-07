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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

const DiscussionScreen = () => {
	const params = useLocalSearchParams();
	const { question, questionId } = params;
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const router = useRouter();
	const flatListRef = useRef(null);

	useEffect(() => {
		const checkUserStatus = async () => {
			const userId = auth().currentUser?.uid;
			if (!userId) {
				router.replace("/");
				return;
			}
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

	// Add effect to scroll to bottom when messages change
	useEffect(() => {
		if (flatListRef.current && messages.length > 0) {
			flatListRef.current.scrollToEnd({ animated: true });
		}
	}, [messages]);

	const sendMessage = async () => {
		if (!newMessage.trim()) return;

		try {
			const userId = auth().currentUser?.uid;
			const userDoc = await firestore().collection("users").doc(userId).get();
			const userData = userDoc.data();
			if (userData?.messages <= 0) {
				Alert.alert("You have no messages left");
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

	return (
		<View style={styles.container}>
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
				renderItem={({ item }) => (
					<View style={styles.messageContainer}>
						<Text style={styles.messageText}>{item.text}</Text>
						<Text style={styles.timestamp}>
							{new Date(item.timestamp?.toDate()).toLocaleTimeString()}
						</Text>
					</View>
				)}
				onContentSizeChange={() =>
					flatListRef.current?.scrollToEnd({ animated: true })
				}
			/>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.input}
					value={newMessage}
					onChangeText={setNewMessage}
					placeholder="Type your message..."
					placeholderTextColor="#808080"
				/>
				<TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
					<Text style={styles.sendButtonText}>Send</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212",
		paddingTop: Platform.OS === "ios" ? 60 : 30,
	},
	headerContainer: {
		paddingHorizontal: "5%",
		paddingBottom: 15,
	},
	questionContainer: {
		backgroundColor: "#1E1E1E",
		borderRadius: 12,
		padding: 20,
		borderWidth: 1,
		borderColor: "#5C8374",
	},
	questionText: {
		color: "#A0A0A0",
		fontSize: 20,
		textAlign: "center",
		lineHeight: 28,
	},
	messagesList: {
		flex: 1,
		paddingHorizontal: "5%",
	},
	messageContainer: {
		backgroundColor: "#1E1E1E",
		padding: 12,
		borderRadius: 12,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: "#5C8374",
	},
	messageText: {
		color: "#A0A0A0",
		fontSize: 16,
		marginBottom: 4,
	},
	timestamp: {
		color: "#808080",
		fontSize: 12,
		alignSelf: "flex-end",
	},
	inputContainer: {
		flexDirection: "row",
		padding: 16,
		backgroundColor: "#1E1E1E",
		borderTopWidth: 1,
		borderTopColor: "#5C8374",
		alignItems: "center",
	},
	input: {
		flex: 1,
		color: "#FFFFFF",
		fontSize: 16,
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: "#2A2A2A",
		borderRadius: 20,
		marginRight: 8,
	},
	sendButton: {
		backgroundColor: "#5C8374",
		padding: 10,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		width: 70,
	},
	sendButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	discussionButton: {
		backgroundColor: "#4A90E2",
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
