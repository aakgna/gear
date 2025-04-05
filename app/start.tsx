// StartPage.tsx
import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	SafeAreaView,
	StyleSheet,
	Alert,
	ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const StartPage = () => {
	const [question, setQuestion] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [hasVoted, setHasVoted] = useState(false);
	const [agreeCount, setAgreeCount] = useState(0);
	const [disagreeCount, setDisagreeCount] = useState(0);
	const router = useRouter();

	useEffect(() => {
		fetchDailyQuestion();
		checkUserVote();
	}, []);

	const fetchDailyQuestion = async () => {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const questionDoc = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.orderBy("date", "asc")
				.limit(1)
				.get();

			if (!questionDoc.empty) {
				const questionData = questionDoc.docs[0].data();
				setQuestion(questionData.question);
				setAgreeCount(questionData.agreeCount || 0);
				setDisagreeCount(questionData.disagreeCount || 0);
			} else {
				setQuestion("No question available for today");
			}
		} catch (error) {
			console.error("Error fetching question:", error);
			Alert.alert("Error", "Failed to load today's question");
		} finally {
			setIsLoading(false);
		}
	};

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
					});
					setHasVoted(false);
				} else {
					setHasVoted(userData.voted);
				}
			} else {
				setHasVoted(false);
			}
		} catch (error) {
			console.error("Error checking vote:", error);
		}
	};

	const handleVote = async (choice) => {
		const userId = auth().currentUser?.uid;
		if (!userId) {
			Alert.alert("Error", "You must be logged in to vote");
			return;
		}

		try {
			setIsLoading(true);
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const questionRef = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.limit(1)
				.get();

			if (!questionRef.empty) {
				const questionDoc = questionRef.docs[0];
				const batch = firestore().batch();

				// Update vote count
				const field = choice === "agree" ? "agreeCount" : "disagreeCount";
				batch.update(questionDoc.ref, {
					[field]: firestore.FieldValue.increment(1),
				});

				// Update user's voted status and updatedAt field
				const userRef = firestore().collection("users").doc(userId);
				batch.update(userRef, {
					voted: true,
					updatedAt: today.toISOString().split("T")[0], // Store date as YYYY-MM-DD
				});

				await batch.commit();

				// Get updated counts
				const updatedDoc = await questionDoc.ref.get();
				const data = updatedDoc.data();

				setHasVoted(true);
				setAgreeCount(data.agreeCount);
				setDisagreeCount(data.disagreeCount);
			}
		} catch (error) {
			console.error("Error voting:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogout = async () => {
		try {
			await auth().signOut();
			router.replace("/"); // Navigate to home page
		} catch (error) {
			console.error("Error signing out:", error);
			Alert.alert("Error", "Failed to sign out");
		}
	};

	const handleDiscussionNavigation = async () => {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const questionDoc = await firestore()
				.collection("dailyQuestions")
				.where("date", ">=", today)
				.orderBy("date", "asc")
				.limit(1)
				.get();
			const question = questionDoc.docs[0].data().question;
			const questionId = questionDoc.docs[0].id;
			router.push({
				pathname: "/discussion",
				params: {
					question: question,
					questionId: questionId,
				},
			});
		} catch (error) {
			console.error("Error navigating to discussion:", error);
		}
	};

	const totalVotes = agreeCount + disagreeCount;
	const agreePercentage = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;
	const disagreePercentage =
		totalVotes > 0 ? (disagreeCount / totalVotes) * 100 : 0;

	if (isLoading) {
		return (
			<View style={styles.container}>
				<ActivityIndicator size="large" color="#0EA5E9" />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
				<Text style={styles.logoutButtonText}>Logout</Text>
			</TouchableOpacity>

			<Text style={styles.title}>Today's Question</Text>

			<View style={styles.questionContainer}>
				<Text style={styles.questionText}>{question}</Text>
			</View>

			{!hasVoted ? (
				<View style={styles.buttonContainer}>
					<TouchableOpacity
						style={[styles.button, styles.agreeButton]}
						onPress={() => handleVote("agree")}
						disabled={isLoading}
					>
						<Text style={styles.buttonText}>Agree</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.button, styles.disagreeButton]}
						onPress={() => handleVote("disagree")}
						disabled={isLoading}
					>
						<Text style={styles.buttonText}>Disagree</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={styles.resultsContainer}>
					<Text style={styles.resultsTitle}>Results</Text>
					<View style={styles.resultBar}>
						<View style={[styles.agreeBar, { width: `${agreePercentage}%` }]} />
					</View>
					<View style={styles.resultsTextContainer}>
						<Text style={styles.resultsText}>
							Agree: {agreePercentage.toFixed(1)}% ({agreeCount})
						</Text>
						<Text style={styles.resultsText}>
							Disagree: {disagreePercentage.toFixed(1)}% ({disagreeCount})
						</Text>
					</View>
				</View>
			)}

			{hasVoted && (
				<TouchableOpacity
					style={styles.discussionButton}
					onPress={handleDiscussionNavigation}
				>
					<Text style={styles.buttonText}>Join Discussion</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
		padding: 20,
	},
	title: {
		color: "#0EA5E9",
		fontSize: 28,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 30,
		marginTop: 100,
	},
	questionContainer: {
		backgroundColor: "rgba(2, 132, 199, 0.15)",
		borderRadius: 15,
		padding: 20,
		marginBottom: 30,
		borderWidth: 1,
		borderColor: "#0EA5E9",
	},
	questionText: {
		color: "#A5F3FC",
		fontSize: 20,
		textAlign: "center",
		lineHeight: 28,
	},
	buttonContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 15,
	},
	button: {
		flex: 1,
		height: 50,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	agreeButton: {
		backgroundColor: "#0284C7",
	},
	disagreeButton: {
		backgroundColor: "#EF4444",
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
	},
	resultsContainer: {
		marginTop: 20,
	},
	resultsTitle: {
		color: "#A5F3FC",
		fontSize: 20,
		textAlign: "center",
		marginBottom: 15,
	},
	resultBar: {
		height: 20,
		backgroundColor: "#EF4444",
		borderRadius: 10,
		overflow: "hidden",
	},
	agreeBar: {
		height: "100%",
		backgroundColor: "#0284C7",
	},
	resultsTextContainer: {
		marginTop: 15,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	resultsText: {
		color: "#A5F3FC",
		fontSize: 16,
	},
	logoutButton: {
		position: "absolute",
		top: 50,
		right: 20,
		backgroundColor: "rgba(239, 68, 68, 0.2)",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#EF4444",
		zIndex: 1,
	},
	logoutButtonText: {
		color: "#EF4444",
		fontSize: 16,
		fontWeight: "600",
	},
	discussionButton: {
		position: "absolute",
		top: 50,
		left: 20,
		backgroundColor: "rgba(2, 132, 199, 0.2)",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#0EA5E9",
		zIndex: 1,
	},
});

export default StartPage;
