import { useState } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Alert,
	TextInput,
	ScrollView,
	SafeAreaView,
	Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const REPORT_REASONS = [
	"FLIRTATION",
	"INSULT",
	"PROFANITY",
	"SEVERE_TOXICITY",
	"SEXUALLY_EXPLICIT",
	"THREAT",
	"TOXICITY",
	"IDENTITY_ATTACK (Doxxing)",
	"I just don't like it",
];
const minor = ["FLIRTATION", "INSULT", "PROFANITY", "TOXICITY"];
const medium = ["SEVERE_TOXICITY", "SEXUALLY_EXPLICIT"];
const major = ["THREAT", "IDENTITY_ATTACK (Doxxing)"];

export default function ReportScreen() {
	const router = useRouter();
	const { messageId, messageText, question, user, question_text } =
		useLocalSearchParams();
	const [selectedReason, setSelectedReason] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleBlockUser = async () => {
		const currentUserId = auth().currentUser?.uid;
		if (!currentUserId || !user) {
			router.navigate("/");
			return;
		}

		await firestore()
			.collection("users")
			.doc(currentUserId)
			.update({
				blockedUsers: firestore.FieldValue.arrayUnion(user),
			});

		Alert.alert("User blocked. You will no longer see their messages.");
		router.navigate("/start");
	};

	const handleSubmit = async () => {
		if (!selectedReason) {
			Alert.alert("Please select a reason.");
			return;
		}
		try {
			setIsSubmitting(true);
			if (
				selectedReason !== "IDENTITY_ATTACK (Doxxing)" &&
				selectedReason !== "OTHER" &&
				selectedReason !== "I just don't like it"
			) {
				const res = await fetch(
					"https://us-central1-commonground-e78a9.cloudfunctions.net/analyze_toxicity",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ content: messageText }),
					}
				);
				const data = await res.json();
				const scores = data["attributeScores"];
				var flag = false;
				for (const [category, details] of Object.entries(scores)) {
					if (details.summaryScore.value > 0.6 && category == selectedReason) {
						if (minor.includes(category)) {
							await firestore()
								.collection("users")
								.doc(user)
								.update({
									strikes: firestore.FieldValue.increment(-1),
								});
						} else if (medium.includes(category)) {
							await firestore()
								.collection("users")
								.doc(user)
								.update({
									strikes: firestore.FieldValue.increment(-3),
								});
						} else if (major.includes(category)) {
							await firestore()
								.collection("users")
								.doc(user)
								.update({
									strikes: firestore.FieldValue.increment(-5),
								});
						}
						flag = true;
					}
				}
				if (flag) {
					await firestore()
						.collection("discussions")
						.doc(question)
						.collection("messages")
						.doc(messageId)
						.update({
							isToxic: true,
						});
					await firestore()
						.collection("users")
						.doc(user)
						.update({
							infractions: firestore.FieldValue.increment(1),
						});
				}
				router.navigate("/start");
				return;
			} else if (selectedReason == "I just don't like it") {
				router.navigate("/start");
				return;
			} else if (selectedReason == "IDENTITY_ATTACK (Doxxing)") {
				const res = await fetch(
					"https://us-central1-commonground-e78a9.cloudfunctions.net/is_doxxing",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ content: messageText }),
					}
				);
				const dox_res = await res.json();
				console.log(dox_res);
				if (dox_res["is_doxxing"]) {
					console.log(dox_res["is_doxxing"]);

					await firestore()
						.collection("users")
						.doc(user)
						.update({
							strikes: firestore.FieldValue.increment(-5),
						});

					await firestore()
						.collection("discussions")
						.doc(question)
						.collection("messages")
						.doc(messageId)
						.delete();

					await firestore()
						.collection("users")
						.doc(user)
						.update({
							infractions: firestore.FieldValue.increment(1),
						});
				}
				router.navigate("/start");
				return;
			}
		} catch (error) {
			console.error("Error submitting report:", error);
			Alert.alert("Error", "Failed to submit report. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
		Alert.alert("Report submitted. Thank you!");
		router.navigate("/start");
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
			>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
					disabled={isSubmitting}
				>
					<Text style={styles.backButtonText}>{"< Back"}</Text>
				</TouchableOpacity>
				<Text style={styles.header}>Report Message</Text>
				<Text style={styles.message}>{messageText}</Text>
				{REPORT_REASONS.map((reason) => (
					<View key={reason}>
						<TouchableOpacity
							style={[
								styles.reasonButton,
								selectedReason === reason && styles.selectedReason,
							]}
							onPress={() => setSelectedReason(reason)}
						>
							<Text style={styles.reasonText}>{reason}</Text>
						</TouchableOpacity>
					</View>
				))}
				<TouchableOpacity
					style={[
						styles.submitButton,
						isSubmitting && styles.submitButtonDisabled,
					]}
					onPress={handleSubmit}
					disabled={isSubmitting}
				>
					<Text style={styles.submitButtonText}>
						{isSubmitting ? "Loading ..." : "Send Report"}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={handleBlockUser}>
					<Text style={styles.blockUserText}>Block User</Text>
				</TouchableOpacity>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	submitButtonDisabled: {
		backgroundColor: "#4F1880",
		opacity: 0.7,
	},
	safeArea: {
		flex: 1,
		backgroundColor: "#000",
	},
	scrollContainer: {
		padding: 24,
		paddingTop: Platform.OS === "ios" ? 24 : 36, // Extra top padding for notch
	},
	header: {
		color: "#fff",
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 16,
		textAlign: "center",
	},
	message: {
		color: "#fff",
		marginBottom: 24,
		fontSize: 16,
		textAlign: "center",
	},
	reasonButton: {
		backgroundColor: "#1A1A1A",
		borderColor: "#9B30FF",
		borderWidth: 1,
		borderRadius: 8,
		padding: 14,
		marginBottom: 10,
	},
	selectedReason: {
		backgroundColor: "#9B30FF",
	},
	reasonText: { color: "#fff", fontSize: 16 },
	submitButton: {
		backgroundColor: "#9B30FF",
		padding: 16,
		borderRadius: 8,
		alignItems: "center",
		marginTop: 24,
	},
	submitButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
	otherInput: {
		backgroundColor: "#1A1A1A",
		borderColor: "#9B30FF",
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginTop: -4,
		marginBottom: 12,
		color: "#FFFFFF",
		textAlignVertical: "top",
		minHeight: 80,
		fontSize: 15,
	},
	blockUserText: {
		color: "#BF5FFF",
		textAlign: "center",
		marginTop: 28,
		fontWeight: "600",
		fontSize: 16,
	},
	backButton: {
		position: "absolute",
		top: Platform.OS === "ios" ? 24 : 36,
		left: 16,
		zIndex: 10,
		padding: 8,
	},
	backButtonText: {
		color: "#BF5FFF",
		fontSize: 16,
		fontWeight: "600",
	},
});
