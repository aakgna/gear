import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronRight,
	MessageCircle,
	ThumbsUp,
	ThumbsDown,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore"; // or your Firestore import

export default function HistoryScreen() {
	const [historicQuestions, setHistoricQuestions] = useState([]);

	useEffect(() => {
		const fetchHistoricQuestions = async () => {
			// Set 'today' to the start of the current day
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			try {
				const snapshot = await firestore()
					.collection("dailyQuestions")
					.where("date", "<", today)
					.orderBy("date", "desc")
					.get();

				const questions = snapshot.docs.map((doc) => {
					const data = doc.data();
					const totalResponses = (data.topCount || 0) + (data.bottomCount || 0);
					const agreePercentage = totalResponses
						? Math.round((data.topCount / totalResponses) * 100)
						: 0;
					const disagreePercentage = 100 - agreePercentage;

					return {
						id: doc.id,
						text: data.question,
						date: data.date?.toDate().toLocaleDateString() || "",
						agreePercentage,
						disagreePercentage,
						totalResponses,
						hasCommonGround:
							Array.isArray(data.commonGroundNotes) &&
							data.commonGroundNotes.length > 0,
						top: data.top,
						bottom: data.bottom,
						// You can add more fields as needed
					};
				});

				setHistoricQuestions(questions);
			} catch (error) {
				console.error("Error fetching historic questions:", error);
			}
		};

		fetchHistoricQuestions();
	}, []);

	const handleQuestionPress = (questionId: string) => {
		router.push({
			pathname: "/expanded",
			params: { questionId },
		});
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Previous Questions</Text>
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				{historicQuestions.map((question, index) => (
					<Animated.View
						key={question.id}
						entering={SlideInRight.delay(index * 100).duration(400)}
					>
						<Pressable
							style={({ pressed }) => [
								styles.questionCard,
								{ opacity: pressed ? 0.9 : 1 },
							]}
							onPress={() => handleQuestionPress(question.id)}
						>
							<LinearGradient
								colors={["#222222", "#1A1A1A"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={styles.cardGradient}
							>
								<View style={styles.cardHeader}>
									<Text style={styles.dateText}>{question.date}</Text>
									{question.hasCommonGround && (
										<View style={styles.commonGroundBadge}>
											<MessageCircle size={12} color="#9D00FF" />
											<Text style={styles.badgeText}>Common Ground</Text>
										</View>
									)}
								</View>

								<Text style={styles.questionText} numberOfLines={3}>
									{question.text}
								</Text>

								<View style={styles.resultsContainer}>
									<View style={styles.progressBackground}>
										<View
											style={[
												styles.progressForeground,
												{ width: `${question.agreePercentage}%` },
											]}
										>
											<LinearGradient
												colors={["#9D00FF", "#6A0DAD"]}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}
												style={styles.progressGradient}
											/>
										</View>
									</View>

									<View style={styles.resultsFooter}>
										<View style={styles.resultItem}>
											<Text style={styles.resultText}>
												{question.top || "Top"}:
											</Text>
											<Text style={styles.resultText}>
												{question.agreePercentage}%
											</Text>
										</View>

										<Text style={styles.responsesText}>
											{question.totalResponses} responses
										</Text>

										<View style={styles.resultItem}>
											<Text style={styles.resultText}>
												{question.bottom || "Bottom"}:
											</Text>
											<Text style={styles.resultText}>
												{question.disagreePercentage}%
											</Text>
										</View>
									</View>
								</View>

								<View style={styles.cardFooter}>
									<Text style={styles.viewDetailsText}>View Details</Text>
									<ChevronRight size={20} color="#9D00FF" />
								</View>
							</LinearGradient>
						</Pressable>
					</Animated.View>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212",
	},
	header: {
		paddingTop: 60,
		paddingHorizontal: 24,
		marginBottom: 20,
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 32,
		color: "#ffffff",
		fontFamily: "Inter-Bold",
		fontWeight: "bold",
	},
	content: {
		flex: 1,
	},
	contentContainer: {
		paddingHorizontal: 24,
		paddingBottom: 30,
	},
	questionCard: {
		borderRadius: 16,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: "#333333",
		overflow: "hidden",
	},
	cardGradient: {
		padding: 20,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	dateText: {
		fontSize: 14,
		color: "#999999",
		fontFamily: "Inter-Regular",
	},
	commonGroundBadge: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#9D00FF20",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	badgeText: {
		fontSize: 12,
		color: "#9D00FF",
		marginLeft: 4,
		fontFamily: "Inter-Medium",
	},
	questionText: {
		fontSize: 18,
		color: "#ffffff",
		marginBottom: 16,
		lineHeight: 26,
		fontFamily: "Inter-Bold",
	},
	resultsContainer: {
		marginBottom: 16,
	},
	progressBackground: {
		height: 8,
		backgroundColor: "#333333",
		borderRadius: 4,
		overflow: "hidden",
		marginBottom: 8,
	},
	progressForeground: {
		height: "100%",
		borderRadius: 4,
	},
	progressGradient: {
		width: "100%",
		height: "100%",
	},
	resultsFooter: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	resultItem: {
		flexDirection: "row",
		alignItems: "center",
	},
	resultText: {
		fontSize: 14,
		color: "#E6E6FA",
		marginHorizontal: 2,
		fontFamily: "Inter-Medium",
	},
	responsesText: {
		fontSize: 14,
		color: "#999999",
		fontFamily: "Inter-Regular",
	},
	cardFooter: {
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "center",
		marginTop: 8,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#333333",
	},
	viewDetailsText: {
		fontSize: 16,
		color: "#9D00FF",
		marginRight: 4,
		fontFamily: "Inter-Medium",
	},
});
