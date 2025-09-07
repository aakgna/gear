// ReportScreen.tsx
import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	SafeAreaView,
	ScrollView,
	Pressable,
	StyleSheet,
	Alert,
	Platform,
	ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
// Updated Firebase imports to use new modular SDK
import { getAuth } from "@react-native-firebase/auth";
import {
	getFirestore,
	collection,
	doc,
	updateDoc,
	deleteDoc,
	arrayUnion,
	increment,
} from "@react-native-firebase/firestore";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, CircleCheck as CheckCircle2 } from "lucide-react-native";
import { logScreenView } from "@/analytics/analyticsEvents";

const REPORT_REASONS = [
	{ label: "Flirtation", value: "FLIRTATION" },
	{ label: "Insult", value: "INSULT" },
	{ label: "Profanity", value: "PROFANITY" },
	{ label: "Severe Toxicity", value: "SEVERE_TOXICITY" },
	{ label: "Sexually Explicit", value: "SEXUALLY_EXPLICIT" },
	{ label: "Threat", value: "THREAT" },
	{ label: "Toxicity", value: "TOXICITY" },
	{ label: "Identity Attack (Doxxing)", value: "IDENTITY_ATTACK (Doxxing)" },
	{ label: "Slur", value: "IS_Slur" },
	{ label: "I just don't like it", value: "I just don't like it" },
];
const minor = ["FLIRTATION", "INSULT", "PROFANITY", "TOXICITY"];
const medium = ["SEVERE_TOXICITY", "SEXUALLY_EXPLICIT", "IS_Slur"];
const major = ["THREAT", "IDENTITY_ATTACK (Doxxing)"];

export default function ReportScreen() {
	const router = useRouter();
	const { messageId, messageText, question, user, location, answerID } =
		useLocalSearchParams() as {
			messageId: string;
			messageText: string;
			question: string;
			user: string;
			location: string;
			answerID: any;
		};

	const [selectedReason, setSelectedReason] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);

	useEffect(() => {
		const auth = getAuth();
		const uid = auth.currentUser?.uid;
		(async () => {
			try {
				await logScreenView("Report", uid);
			} catch (error) {
				console.error("Analytics error:", error);
			}
		})();
	}, []);

	const handleBack = () => router.back();

	const handleBlockUser = async () => {
		const auth = getAuth();
		const firestore = getFirestore();
		const current = auth.currentUser?.uid;
		if (!current || !user) {
			router.navigate("/");
			return;
		}
		const userDocRef = doc(firestore, "users", current);
		await updateDoc(userDocRef, {
			blocked: arrayUnion(user),
		});
		Alert.alert("User blocked. You will no longer see their messages.");
		router.navigate("/start");
	};

	const handleSubmit = async () => {
		if (!selectedReason) {
			Alert.alert("Please select a reason.");
			return;
		}
		setIsSubmitting(true);

		try {
			const firestore = getFirestore();

			// 1) Toxicity check for most reasons
			if (
				selectedReason !== "IDENTITY_ATTACK (Doxxing)" &&
				selectedReason !== "I just don't like it"
			) {
				const res = await fetch(
					"https://us-central1-thecommonground-6259d.cloudfunctions.net/analyze_toxicity",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ content: messageText }),
					}
				);
				const data = await res.json();
				const scores = data.attributeScores;
				for (const [cat, det] of Object.entries(scores) as [
					string,
					{ summaryScore: { value: number } }
				][]) {
					if (det.summaryScore.value > 0.6 && cat === selectedReason) {
						// deduct strikes
						const dec = minor.includes(cat)
							? 1
							: medium.includes(cat)
							? 3
							: major.includes(cat)
							? 5
							: 0;
						if (dec > 0) {
							const userDocRef = doc(firestore, "users", user);
							await updateDoc(userDocRef, {
								strikes: increment(-dec),
							});
						}
						// mark toxic + infractions
						if (location === "answers") {
							const messageDocRef = doc(
								firestore,
								"discussion",
								question,
								location,
								messageId
							);
							await updateDoc(messageDocRef, {
								isToxic: true,
							});
						} else {
							const replyDocRef = doc(
								firestore,
								"discussion",
								question,
								location,
								answerID,
								"comment",
								messageId
							);
							await updateDoc(replyDocRef, { isToxic: true });
							const answerDocRef = doc(
								firestore,
								"discussion",
								question,
								"answers",
								answerID
							);
							await updateDoc(answerDocRef, {
								replyCount: increment(-1),
							});
						}
						const userDocRef = doc(firestore, "users", user);
						await updateDoc(userDocRef, {
							strikeCount: increment(1),
						});
					}
				}
			}

			// 2) "I just don't like it" → nothing extra

			// 3) Doxxing check
			if (selectedReason === "IDENTITY_ATTACK (Doxxing)") {
				const res = await fetch(
					"https://us-central1-thecommonground-6259d.cloudfunctions.net/is_doxxing",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ content: messageText }),
					}
				);
				const is_doxxing = await res.json();
				if (is_doxxing["is_doxxing"]) {
					const userDocRef = doc(firestore, "users", user);
					await updateDoc(userDocRef, {
						strikes: increment(-5),
					});
					if (location === "answers") {
						const messageDocRef = doc(
							firestore,
							"discussion",
							question,
							location,
							messageId
						);
						await deleteDoc(messageDocRef);
					} else {
						const replyDocRef = doc(
							firestore,
							"discussion",
							question,
							location,
							answerID,
							"comment",
							messageId
						);
						await deleteDoc(replyDocRef);
						const answerDocRef = doc(
							firestore,
							"discussion",
							question,
							"answers",
							answerID
						);
						await updateDoc(answerDocRef, {
							replyCount: increment(-1),
						});
					}
					await updateDoc(userDocRef, {
						strikeCount: increment(1),
					});
				}
			}

			// 4) Slur Check
			if (selectedReason === "IS_Slur") {
				const res = await fetch(
					"https://us-central1-thecommonground-6259d.cloudfunctions.net/is_slur", // <-- Use your slur endpoint
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ content: messageText }),
					}
				);
				const is_slur = await res.json();
				if (is_slur["is_slur"]) {
					const userDocRef = doc(firestore, "users", user);
					await updateDoc(userDocRef, {
						strikes: increment(-3), // or whatever penalty you want
					});
					if (location === "answers") {
						const messageDocRef = doc(
							firestore,
							"discussion",
							question,
							location,
							messageId
						);
						await deleteDoc(messageDocRef);
					} else {
						const replyDocRef = doc(
							firestore,
							"discussion",
							question,
							location,
							answerID,
							"comment",
							messageId
						);
						await deleteDoc(replyDocRef);
						const answerDocRef = doc(
							firestore,
							"discussion",
							question,
							"answers",
							answerID
						);
						await updateDoc(answerDocRef, {
							replyCount: increment(-1),
						});
					}
					await updateDoc(userDocRef, {
						strikeCount: increment(1),
					});
				}
			}
		} catch (err) {
			console.error(err);
			Alert.alert("Error", "Failed to submit report. Please try again.");
		} finally {
			setIsSubmitting(false);
			setIsSubmitted(true);
			setTimeout(() => router.back(), 2000);
		}
	};

	// —— THANK YOU VIEW ——
	if (isSubmitted) {
		return (
			<View style={styles.container}>
				<LinearGradient
					colors={["#120318", "#1C0529"]}
					style={StyleSheet.absoluteFill}
				/>
				<Animated.View entering={FadeIn} style={styles.successContainer}>
					<View style={styles.successCard}>
						<CheckCircle2 size={100} color="#9D00FF" />
						<Text style={styles.successTitle}>Thank You</Text>
						<Text style={styles.successText}>
							Your report has been submitted. Our moderation team will review it
							shortly.
						</Text>
					</View>
				</Animated.View>
			</View>
		);
	}

	// —— MAIN FORM VIEW ——
	return (
		<SafeAreaView style={styles.safeArea}>
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
			>
				<Pressable style={styles.backButton} onPress={handleBack}>
					<ArrowLeft size={24} color="#9D00FF" />
					<Text style={styles.backText}>Back</Text>
				</Pressable>

				<Text style={styles.title}>Report Message</Text>
				<Text style={styles.subtitle}>Why are you reporting this message?</Text>

				<View style={styles.reasonsContainer}>
					{REPORT_REASONS.map((reason, idx) => (
						<View key={reason.value}>
							<Pressable
								style={({ pressed }) => [
									styles.reasonItem,
									selectedReason === reason.value && styles.selectedReason,
									{ opacity: pressed ? 0.8 : 1 },
								]}
								onPress={() => setSelectedReason(reason.value)}
								disabled={isSubmitting}
							>
								<LinearGradient
									colors={
										selectedReason === reason.value
											? ["#9D00FF20", "#6A0DAD20"]
											: ["#22222220", "#22222220"]
									}
									style={styles.reasonGradient}
								>
									<Text
										style={[
											styles.reasonText,
											selectedReason === reason.value &&
												styles.selectedReasonText,
										]}
									>
										{reason.label}
									</Text>
								</LinearGradient>
							</Pressable>
						</View>
					))}
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.submitButton,
						!selectedReason && styles.disabledButton,
						{ opacity: pressed ? 0.9 : 1 },
					]}
					onPress={handleSubmit}
					disabled={!selectedReason || isSubmitting}
				>
					<LinearGradient
						colors={
							selectedReason ? ["#9D00FF", "#6A0DAD"] : ["#555555", "#333333"]
						}
						style={styles.submitGradient}
					>
						{isSubmitting ? (
							<View style={{ flexDirection: "row", alignItems: "center" }}>
								<Text style={styles.submitText}>Loading</Text>
								<ActivityIndicator
									size="small"
									color="#fff"
									style={{ marginLeft: 8 }}
								/>
							</View>
						) : (
							<Text style={styles.submitText}>Submit Report</Text>
						)}
					</LinearGradient>
				</Pressable>

				<Pressable
					style={styles.blockUserButton}
					onPress={handleBlockUser}
					disabled={isSubmitting}
				>
					<Text style={styles.blockUserText}>Block User</Text>
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#000",
	},
	container: {
		flex: 1,
		backgroundColor: "#121212",
	},
	scrollContainer: {
		padding: 24,
		paddingTop: Platform.OS === "ios" ? 30 : 20,
	},
	backButton: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	backText: {
		color: "#9D00FF",
		fontSize: 18,
		marginLeft: 8,
		fontFamily: "Inter-Medium",
	},
	title: {
		fontSize: 32,
		color: "#fff",
		marginBottom: 8,
		fontFamily: "Inter-Bold",
	},
	subtitle: {
		fontSize: 18,
		color: "#FFFFFF",
		marginBottom: 24,
		fontFamily: "Inter-Regular",
	},
	reasonsContainer: {
		marginBottom: 24,
	},
	reasonItem: {
		marginBottom: 16,
		borderRadius: 12,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "#333333",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
	selectedReason: {
		borderColor: "#9D00FF",
	},
	reasonGradient: {
		padding: 16,
	},
	reasonText: {
		fontSize: 18,
		color: "#fff",
		fontFamily: "Inter-Medium",
	},
	selectedReasonText: {
		color: "#FFF",
	},
	submitButton: {
		borderRadius: 12,
		overflow: "hidden",
		marginBottom: 16,
		elevation: 5,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	disabledButton: {
		opacity: 0.6,
	},
	submitGradient: {
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: {
		color: "#fff",
		fontSize: 18,
		fontFamily: "Inter-Bold",
	},
	blockUserButton: {
		marginTop: 12,
		alignItems: "center",
	},
	blockUserText: {
		color: "#BF5FFF",
		fontSize: 16,
		fontFamily: "Inter-Medium",
	},

	// —— NEW Thank-You Card UI ——
	successContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
	},
	successCard: {
		width: "100%",
		maxWidth: 340,
		padding: 32,
		borderRadius: 32,
		backgroundColor: "rgba(29, 0, 52, 0.8)",
		alignItems: "center",
		// subtle glow shadow
		elevation: 5,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.3,
		shadowRadius: 12,
	},
	successTitle: {
		fontSize: 28,
		color: "#FFFFFF",
		fontFamily: "Inter-Bold",
		marginTop: 16,
		marginBottom: 8,
	},
	successText: {
		fontSize: 18,
		color: "#FFFFFF",
		textAlign: "center",
		lineHeight: 24,
		fontFamily: "Inter-Regular",
	},
});
