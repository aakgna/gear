import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

const DiscussionScreen = () => {
	const params = useLocalSearchParams();
	const question = params.question;
	const questionId = params.questionId;
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");

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

	const sendMessage = async () => {
		if (!newMessage.trim()) return;

		try {
			await firestore()
				.collection("discussions")
				.doc(questionId)
				.collection("messages")
				.add({
					text: newMessage,
					timestamp: firestore.FieldValue.serverTimestamp(),
					// No user identification stored for anonymity
				});
			setNewMessage("");
		} catch (error) {
			console.error("Error sending message:", error);
		}
	};

	return (
		<View style={styles.container}>
			{/* Question display at top */}
			<View style={styles.questionContainer}>
				<Text style={styles.questionText}>{question}</Text>
			</View>

			{/* Messages list */}
			<FlatList
				data={messages}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.messageContainer}>
						<Text style={styles.messageText}>{item.text}</Text>
						<Text style={styles.timestamp}>
							{new Date(item.timestamp?.toDate()).toLocaleTimeString()}
						</Text>
					</View>
				)}
			/>

			{/* Message input */}
			<View style={styles.inputContainer}>
				<TextInput
					style={styles.input}
					value={newMessage}
					onChangeText={setNewMessage}
					placeholder="Type your message..."
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
		backgroundColor: "#1A1A1A", // Dark background
		padding: 16,
	},
	questionContainer: {
		backgroundColor: "#2A2A2A",
		padding: 16,
		borderRadius: 12,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	questionText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
		textAlign: "center",
	},
	messageContainer: {
		backgroundColor: "#2A2A2A",
		padding: 12,
		borderRadius: 8,
		marginBottom: 8,
	},
	messageText: {
		color: "#FFFFFF",
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
		padding: 8,
		backgroundColor: "#2A2A2A",
		borderRadius: 25,
		marginTop: 8,
		alignItems: "center",
	},
	input: {
		flex: 1,
		color: "#FFFFFF",
		fontSize: 16,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	sendButton: {
		backgroundColor: "#4A90E2", // Blue accent color
		padding: 10,
		borderRadius: 20,
		marginLeft: 8,
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
