import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { logScreenView } from "@/analytics/analyticsEvents";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
	ArrowLeft,
	ThumbsUp,
	ThumbsDown,
	MessageCircle,
	ArrowRight,
} from "lucide-react-native";
// Updated Firebase imports to use new modular SDK
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";

export default function ExpandedQuestionScreen() {
	// log screen view
	useEffect(() => {
		const auth = getAuth();
		const uid = auth.currentUser?.uid;
		(async () => {
			try {
				await logScreenView("Expanded", uid);
			} catch (error) {
				console.error("Analytics error:", error);
			}
		})();
	}, []);

	const { questionId } = useLocalSearchParams();
	const [activeTab, setActiveTab] = useState("common");
	const [question, setQuestion] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchQuestion = async () => {
			try {
				const firestore = getFirestore();
				const docRef = doc(firestore, "dailyQuestions", questionId);
				const docSnap = await getDoc(docRef);

				if (docSnap.exists()) {
					const data = docSnap.data();
					const topCount = data.topCount || 0;
					const bottomCount = data.bottomCount || 0;
					const totalResponses = topCount + bottomCount;
					const agreePercentage = totalResponses
						? Math.round((topCount / totalResponses) * 100)
						: 0;
					const disagreePercentage = 100 - agreePercentage;

					setQuestion({
						id: docSnap.id,
						text: data.question,
						date: data.date?.toDate().toLocaleDateString() || "",
						agreePercentage,
						disagreePercentage,
						totalResponses,
						agreeArguments: data.topNotes || [],
						disagreeArguments: data.bottomNotes || [],
						commonGround: data.commonGroundNotes || [],
						top: data.top,
						bottom: data.bottom,
					});
				}
			} catch (error) {
				console.error("Error fetching question:", error);
			} finally {
				setLoading(false);
			}
		};

		if (questionId) {
			fetchQuestion();
		}
	}, [questionId]);

	const handleBack = () => {
		router.back();
	};

	const renderTabContent = () => {
		let content;
		let title;
		let icon;
		let color;

		switch (activeTab) {
			case "agree":
				content = question.agreeArguments;
				title = question.top;
				icon = <ArrowLeft size={20} color="#9D00FF" />;
				color = "#9D00FF";
				break;
			case "disagree":
				content = question.disagreeArguments;
				title = question.bottom;
				icon = <ArrowRight size={20} color="#9D00FF" />;
				color = "#9D00FF";
				break;
			case "common":
			default:
				content = question.commonGround;
				title = "Common Ground";
				icon = <MessageCircle size={20} color="#9D00FF" />;
				color = "#9D00FF";
				break;
		}

		return (
			<Animated.View
				entering={FadeIn.duration(300)}
				style={styles.tabContentContainer}
			>
				<View style={styles.tabTitleContainer}>
					{icon}
					<Text style={[styles.tabTitle, { color }]}>{title}</Text>
				</View>

				{activeTab === "common" && content.length === 0 ? (
					<>
						<Text
							style={{
								color: "#aaa",
								fontStyle: "italic",
								textAlign: "center",
								marginTop: 16,
							}}
						>
							No Common Ground has been met.
						</Text>
						<Text
							style={{
								color: "#aaa",
								fontStyle: "italic",
								textAlign: "center",
								marginTop: 7,
							}}
						>
							Better Luck Next Time.
						</Text>
					</>
				) : (
					content.map((item, index) => (
						<Animated.View
							key={index}
							entering={SlideInRight.delay(index * 100).duration(300)}
							style={styles.pointContainer}
						>
							<LinearGradient
								colors={["#22222280", "#1A1A1A80"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={[styles.pointCard, { borderLeftColor: color }]}
							>
								<Text style={styles.pointText}>{item}</Text>
							</LinearGradient>
						</Animated.View>
					))
				)}
			</Animated.View>
		);
	};

	if (loading) {
		return (
			<View style={styles.container}>
				{/* <Text style={{ color: "#fff", textAlign: "center", marginTop: 40 }}>
          Loading...
        </Text> */}
			</View>
		);
	}

	if (!question) {
		return (
			<View style={styles.container}>
				{/* <Text style={{ color: "#fff", textAlign: "center", marginTop: 40 }}>
          Question not found.
        </Text> */}
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>
			<View style={styles.header}>
				<Pressable style={styles.backButton} onPress={handleBack}>
					<ArrowLeft size={24} color="#9D00FF" />
				</Pressable>
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				<LinearGradient
					colors={["#9D00FF20", "#6A0DAD20"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.questionCard}
				>
					<Text style={styles.dateText}>{question?.date}</Text>
					<Text style={styles.questionText}>{question?.text}</Text>

					<View style={styles.resultsContainer}>
						<View style={styles.progressBackground}>
							<View
								style={[
									styles.progressForeground,
									{ width: `${question?.agreePercentage}%` },
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
								<ArrowLeft size={16} color="#E6E6FA" />
								<Text style={styles.resultText}>
									{question?.agreePercentage}%
								</Text>
							</View>

							<Text style={styles.responsesText}>
								{question?.totalResponses.toLocaleString()} responses
							</Text>

							<View style={styles.resultItem}>
								<Text style={styles.resultText}>
									{question?.disagreePercentage}%
								</Text>
								<ArrowRight size={16} color="#E6E6FA" />
							</View>
						</View>
					</View>
				</LinearGradient>

				<View style={styles.tabsContainer}>
					<Pressable
						style={({ pressed }) => [
							styles.tabButton,
							activeTab === "agree" && styles.activeTabButton,
							{ opacity: pressed ? 0.8 : 1 },
						]}
						onPress={() => setActiveTab("agree")}
					>
						<ArrowLeft
							size={20}
							color={activeTab === "agree" ? "#9D00FF" : "#777777"}
						/>
						<Text
							style={[
								styles.tabButtonText,
								activeTab === "agree" && styles.activeTabText,
							]}
						>
							{question.top}
						</Text>
					</Pressable>

					<Pressable
						style={({ pressed }) => [
							styles.tabButton,
							styles.centerTab,
							activeTab === "common" && styles.activeTabButton,
							{ opacity: pressed ? 0.8 : 1 },
						]}
						onPress={() => setActiveTab("common")}
					>
						<MessageCircle
							size={20}
							color={activeTab === "common" ? "#9D00FF" : "#777777"}
						/>
						<Text
							style={[
								styles.tabButtonText,
								activeTab === "common" && styles.activeTabText,
							]}
						>
							Common Ground
						</Text>
					</Pressable>

					<Pressable
						style={({ pressed }) => [
							styles.tabButton,
							activeTab === "disagree" && styles.activeTabButton,
							{ opacity: pressed ? 0.8 : 1 },
						]}
						onPress={() => setActiveTab("disagree")}
					>
						<Text
							style={[
								styles.tabButtonText,
								activeTab === "disagree" && styles.activeTabText,
							]}
						>
							{question.bottom}
						</Text>
						<ArrowRight
							size={20}
							color={activeTab === "disagree" ? "#9D00FF" : "#777777"}
						/>
					</Pressable>
				</View>

				{renderTabContent()}
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
	},
	backButton: {
		flexDirection: "row",
		alignItems: "center",
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
		padding: 20,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: "#9D00FF40",
	},
	dateText: {
		fontSize: 14,
		color: "#999999",
		marginBottom: 8,
		fontFamily: "Inter-Regular",
	},
	questionText: {
		fontSize: 22,
		color: "#ffffff",
		marginBottom: 20,
		lineHeight: 30,
		fontFamily: "Inter-Bold",
	},
	resultsContainer: {
		marginBottom: 8,
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
		marginHorizontal: 6,
		fontFamily: "Inter-Medium",
	},
	responsesText: {
		fontSize: 14,
		color: "#999999",
		fontFamily: "Inter-Regular",
	},
	tabsContainer: {
		flexDirection: "row",
		marginBottom: 16,
		borderRadius: 12,
		backgroundColor: "#1A1A1A",
		overflow: "hidden",
		alignItems: "stretch",
	},
	tabButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		minHeight: 48,
	},
	activeTabButton: {
		backgroundColor: "#2A2A2A",
	},
	tabButtonText: {
		fontSize: 14,
		color: "#777777",
		marginLeft: 6,
		fontFamily: "Inter-Medium",
		paddingHorizontal: 2,
		textAlign: "center",
		flexShrink: 1,
	},
	activeTabText: {
		color: "#9D00FF",
	},
	tabContentContainer: {
		marginBottom: 20,
	},
	tabTitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	tabTitle: {
		fontSize: 20,
		marginLeft: 8,
		fontFamily: "Inter-Bold",
	},
	pointContainer: {
		marginBottom: 12,
	},
	pointCard: {
		borderRadius: 12,
		padding: 16,
		borderLeftWidth: 4,
	},
	pointText: {
		fontSize: 16,
		color: "#ffffff",
		lineHeight: 24,
		fontFamily: "Inter-Regular",
	},
	centerTab: {
		marginHorizontal: 8,
	},
});
