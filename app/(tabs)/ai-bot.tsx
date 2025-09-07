import React, { useState, useEffect } from "react";
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

const AIBotPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [messages, setMessages] = useState<
		Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>
	>([
		{
			id: "1",
			text: "Hi! I'm your AI assistant. Ask me anything about today's topic or any other questions you have.",
			isUser: false,
			timestamp: new Date(),
		},
	]);
	const [inputText, setInputText] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// Check if user is authenticated
	useEffect(() => {
		const auth = getAuth();
		if (!auth.currentUser) {
			router.replace("/");
			return;
		}
	}, []);

	const handleSend = async () => {
		if (!inputText.trim()) return;

		const userMessage = {
			id: Date.now().toString(),
			text: inputText.trim(),
			isUser: true,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInputText("");
		setIsLoading(true);

		// TODO: Integrate with OpenAI API here
		// For now, just show a placeholder response
		setTimeout(() => {
			const aiResponse = {
				id: (Date.now() + 1).toString(),
				text: "This is a placeholder response. OpenAI integration coming soon!",
				isUser: false,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, aiResponse]);
			setIsLoading(false);
		}, 1000);
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
				<Text style={styles.headerTitle}>AI Assistant</Text>
				<View style={styles.placeholder} />
			</View>

			{/* Messages */}
			<ScrollView
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
		fontSize: 20,
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
