import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	TextInput,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Send, ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Updated Firebase import to use new modular SDK
import { getAuth } from "@react-native-firebase/auth";
import {
	getFirestore,
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	doc,
	updateDoc,
	arrayUnion,
	getDoc,
} from "@react-native-firebase/firestore";
import { useLocalSearchParams } from "expo-router";

const AIBotPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { question } = useLocalSearchParams();
	const [messages, setMessages] = useState<
		Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>
	>([
		{
			id: "1",
			text: "Hi! I'm Agora, your AI assistant. Ask me anything about today's topic or any other questions you have.",
			isUser: false,
			timestamp: new Date(),
		},
	]);
	const [inputText, setInputText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const scrollViewRef = useRef<ScrollView>(null);

	// Function to scroll to bottom
	const scrollToBottom = () => {
		setTimeout(() => {
			scrollViewRef.current?.scrollToEnd({ animated: true });
		}, 100);
	};

	// Scroll to bottom when component mounts (entering the page)
	useEffect(() => {
		scrollToBottom();
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Scroll to bottom when loading state changes (for typing indicator)
	useEffect(() => {
		scrollToBottom();
	}, [isLoading]);

	// Check if user is authenticated
	useEffect(() => {
		const auth = getAuth();
		if (!auth.currentUser) {
			router.replace("/");
			return;
		}
	}, []);

	// Load conversation history on component mount
	useEffect(() => {
		const loadConversationHistory = async () => {
			try {
				const auth = getAuth();
				const userId = auth.currentUser?.uid;

				if (!userId) return;

				const firestore = getFirestore();
				const userDocRef = doc(firestore, "users", userId);
				const userDoc = await getDoc(userDocRef);

				if (userDoc.exists()) {
					const userData = userDoc.data();
					const questionHistory = userData?.questionHistory || [];
					const answerHistory = userData?.answerHistory || [];

					// Create messages from history
					const historyMessages: Array<{
						id: string;
						text: string;
						isUser: boolean;
						timestamp: Date;
					}> = [];

					// Add initial greeting
					historyMessages.push({
						id: "1",
						text: "Hi! I'm Agora, your AI assistant. Ask me anything about today's topic or any other questions you have.",
						isUser: false,
						timestamp: new Date(),
					});

					// Add conversation history (questions and answers)
					const maxLength = Math.max(
						questionHistory.length,
						answerHistory.length
					);

					for (let i = 0; i < maxLength; i++) {
						// Add user question if it exists
						if (questionHistory[i]) {
							historyMessages.push({
								id: `history-q-${i}`,
								text: questionHistory[i],
								isUser: true,
								timestamp: new Date(Date.now() - (maxLength - i) * 60000), // Space them out by minutes
							});
						}

						// Add AI answer if it exists
						if (answerHistory[i]) {
							historyMessages.push({
								id: `history-a-${i}`,
								text: answerHistory[i],
								isUser: false,
								timestamp: new Date(
									Date.now() - (maxLength - i) * 60000 + 30000
								), // 30 seconds after question
							});
						}
					}

					await setMessages(historyMessages);
				}
			} catch (error) {
				console.error("Error loading conversation history:", error);
				// Keep default messages if history loading fails
			}
		};

		loadConversationHistory();
	}, []);

	const handleSend = async () => {
		if (!inputText.trim()) return;

		const userMessage = {
			id: Date.now().toString(),
			text: inputText.trim(),
			isUser: true,
			timestamp: new Date(),
		};

		// Add user message and verify it's added
		await setMessages((prev) => {
			const newMessages = [...prev, userMessage];
			return newMessages;
		});
		setInputText("");
		setIsLoading(true);

		try {
			// Get current user
			const auth = getAuth();
			const userId = auth.currentUser?.uid;

			if (!userId) {
				Alert.alert("Error", "User not authenticated");
				setIsLoading(false);
				return;
			}

			// Fetch today's question for context
			let topic = question || "No topic provided";

			let input = [
				{
					role: "system",
					content:
						"You are a helpful research assistant for a debate app. This is the topic: " +
						topic +
						". Please do not output any special characters including Bold, Italic, Underline, endline, etc.",
				},
			];

			// Build conversation history for context (including stored history)
			const recentMessages = messages
				.filter((msg) => msg.id !== "1") // Exclude the initial greeting
				.slice(-10) // Get last 10 messages
				.map((msg) => ({
					role: msg.isUser ? "user" : "assistant",
					content: msg.text,
				}));
			if (recentMessages.length === 0) {
				input.push({
					role: "user",
					content: inputText.trim(),
				});
			} else {
				for (let i = 0; i < recentMessages.length; i++) {
					if (recentMessages[i].role === "user") {
						input.push({
							role: "user",
							content: recentMessages[i].content,
						});
					} else {
						input.push({
							role: "assistant",
							content: recentMessages[i].content,
						});
					}
				}
				input.push({
					role: "user",
					content: inputText.trim(),
				});
			}

			// Call Perplexity API through Firebase Cloud Function
			const response = await fetch(
				"https://us-central1-thecommonground-6259d.cloudfunctions.net/perplexity_chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						input: input,
					}),
				}
			);
			const data = await response.json();

			// Check response status first
			if (!response.ok) {
				throw new Error(data.error || "Failed to get AI response");
			}

			// Validate that we have a reply
			if (!data.reply) {
				throw new Error("No reply received from AI service");
			}

			let responseData = data.reply;
			// Remove citation patterns like [1], [2], etc.
			responseData = responseData.replace(/\[\d+\]/g, "");

			responseData = responseData.replace("*", "");

			const aiResponse = {
				id: (Date.now() + 1).toString(),
				text: responseData, // ✅ Use cleaned data
				isUser: false,
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, aiResponse]);
			const firestore = getFirestore();
			const userDoc = doc(firestore, "users", userId);
			await updateDoc(userDoc, {
				answerHistory: arrayUnion(responseData),
				questionHistory: arrayUnion(inputText.trim()),
			});
		} catch (error) {
			console.error("Error calling AI API:", error);

			const errorResponse = {
				id: (Date.now() + 1).toString(),
				text: "Sorry, I'm having trouble connecting right now. Please try again later.",
				isUser: false,
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, errorResponse]);
		} finally {
			setIsLoading(false);
		}
	};

	const renderMessage = (message: any) => (
		<View
			key={message.id}
			style={[
				styles.messageContainer,
				message.isUser ? styles.userMessage : styles.aiMessage,
			]}
		>
			<LinearGradient
				colors={
					message.isUser ? ["#9D00FF", "#6A0DAD"] : ["#333333", "#222222"]
				}
				style={styles.messageBubble}
			>
				<Text style={styles.messageText}>{message.text}</Text>
				<Text style={styles.timestamp}>
					{message.timestamp.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</Text>
			</LinearGradient>
		</View>
	);

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>

			{/* Header */}
			<View style={[styles.header, { paddingTop: insets.top + 10 }]}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<ArrowLeft size={24} color="#FFFFFF" />
				</Pressable>
				<Text style={styles.headerTitle}>Agora AI</Text>
				<View style={styles.placeholder} />
			</View>

			{/* Messages */}
			<ScrollView
				ref={scrollViewRef}
				style={styles.messagesContainer}
				contentContainerStyle={{ paddingBottom: 20 }}
				showsVerticalScrollIndicator={false}
			>
				{messages.map(renderMessage)}
				{isLoading && (
					<View style={[styles.messageContainer, styles.aiMessage]}>
						<LinearGradient
							colors={["#333333", "#222222"]}
							style={styles.messageBubble}
						>
							<Text style={styles.messageText}>Typing...</Text>
						</LinearGradient>
					</View>
				)}
			</ScrollView>

			{/* Input */}
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.inputContainer}
			>
				<View style={styles.inputWrapper}>
					<TextInput
						value={inputText}
						onChangeText={setInputText}
						placeholder="Ask me anything..."
						placeholderTextColor="#888"
						style={styles.textInput}
						multiline
						maxLength={500}
					/>
					<Pressable
						onPress={handleSend}
						disabled={!inputText.trim() || isLoading}
						style={[
							styles.sendButton,
							(!inputText.trim() || isLoading) && styles.sendButtonDisabled,
						]}
					>
						<Send
							size={20}
							color={inputText.trim() && !isLoading ? "#FFFFFF" : "#666"}
						/>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: "#333333",
	},
	backButton: {
		padding: 8,
	},
	headerTitle: {
		fontSize: 30,
		fontWeight: "bold",
		color: "#FFFFFF",
		fontFamily: "Inter-Bold",
	},
	placeholder: {
		width: 40,
	},
	messagesContainer: {
		flex: 1,
		paddingHorizontal: 20,
	},
	messageContainer: {
		marginVertical: 8,
		flexDirection: "row",
	},
	userMessage: {
		justifyContent: "flex-end",
	},
	aiMessage: {
		justifyContent: "flex-start",
	},
	messageBubble: {
		maxWidth: "80%",
		padding: 16,
		borderRadius: 20,
		borderBottomRightRadius: 4,
	},
	messageText: {
		color: "#FFFFFF",
		fontSize: 16,
		lineHeight: 22,
		fontFamily: "Inter-Regular",
	},
	timestamp: {
		color: "#CCCCCC",
		fontSize: 12,
		marginTop: 4,
		opacity: 0.7,
	},
	inputContainer: {
		paddingHorizontal: 20,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: "#333333",
		alignSelf: "center",
		width: "100%",
		marginBottom: 10,
	},
	inputWrapper: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#1A1A1A",
		borderRadius: 25,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: "#333333",
	},
	textInput: {
		flex: 1,
		color: "#FFFFFF",
		fontSize: 16,
		maxHeight: 100,
		paddingRight: 12,
		fontFamily: "Inter-Regular",
		textAlign: "left",
	},
	sendButton: {
		backgroundColor: "#9D00FF",
		borderRadius: 20,
		padding: 8,
		marginLeft: 8,
	},
	sendButtonDisabled: {
		backgroundColor: "#333333",
	},
});

export default AIBotPage;
