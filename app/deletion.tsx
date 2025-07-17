import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Pressable,
	Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import { logdeleted } from "@/analytics/analyticsEvents";

export default function DeleteAccountScreen() {
	const params = useLocalSearchParams();
	const { verificationId } = params; // exactly like old code
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleConfirmDeletion = async () => {
		// 1) Must be exactly 6 digits
		if (code.length !== 6) {
			setError("Please enter a valid 6-digit code");
			return;
		}

		try {
			setIsLoading(true);

			// 2) Create credential with old PhoneAuthProvider logic
			const credential = auth.PhoneAuthProvider.credential(
				verificationId as string,
				code
			);

			// 3) Re-sign in:
			const userCredential = await auth().signInWithCredential(credential);

			// 4) Look up Firestore document
			const userDoc = await firestore()
				.collection("users")
				.doc(userCredential.user.uid)
				.get();

			if (!userDoc.exists) {
				Alert.alert("Error", "No user is currently signed in.");
				router.back();
				return;
			}

			const createdAt = await firestore()
				.collection("users")
				.doc(userCredential.user.uid)
				.get()
				.then((doc) => {
					if (doc.exists) {
						return doc.data().createdAt;
					} else {
						console.log("No such document!");
					}
				})
				.catch((error) => {
					console.log("Error getting document:", error);
				});

			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const todayDate = today.toISOString().substring(0, 10);

			await logdeleted(createdAt, todayDate);

			// 5) Delete Firestore doc, then delete the user
			await firestore()
				.collection("users")
				.doc(userCredential.user.uid)
				.delete();
			await userCredential.user.delete();

			// 6) Success alert and navigate to "/"
			Alert.alert("Success", "Your account has been deleted successfully.");
			router.replace("/"); // or router.navigate("/"), matching old code
			return;
		} catch (error) {
			console.error("Failed to delete account:", error);
			Alert.alert("Error", "Failed to delete account. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			{/* Background gradient unchanged */}
			<LinearGradient
				colors={["#120318", "#1C0529"]}
				style={StyleSheet.absoluteFill}
			/>

			{/* Back button (same as new UI) */}
			<Pressable style={styles.backButton} onPress={() => router.back()}>
				<ArrowLeft size={24} color="#FF1744" />
				<Text style={styles.backText}>Back</Text>
			</Pressable>

			<Animated.View entering={FadeIn.duration(800)} style={styles.content}>
				<Text style={styles.title}>Delete Your Account</Text>
				<Text style={styles.subtitle}>
					Please enter the verification code sent to your phone
				</Text>

				<View style={styles.inputContainer}>
					<TextInput
						style={styles.input}
						placeholder="000000"
						placeholderTextColor="#6666"
						value={code}
						onChangeText={(text) => {
							setCode(text.replace(/[^0-9]/g, "").slice(0, 6));
							setError("");
						}}
						keyboardType="number-pad"
						maxLength={6}
						editable={!isLoading}
						textAlign="center"
					/>
					{error ? <Text style={styles.errorText}>{error}</Text> : null}
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.deleteButton,
						{ opacity: pressed ? 0.9 : 1 },
						isLoading && { opacity: 0.6 },
					]}
					onPress={handleConfirmDeletion}
					disabled={isLoading}
				>
					<LinearGradient
						colors={["#FF1744", "#D50000"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.gradientButton}
					>
						<Text style={styles.buttonText}>
							{isLoading ? "Deleting..." : "Confirm Deletion"}
						</Text>
					</LinearGradient>
				</Pressable>

				<Text style={styles.warningText}>
					Warning: This action cannot be undone. All your data will be
					permanently deleted.
				</Text>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#121212", // same as your new UI
	},
	backButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 24,
		paddingTop: 60,
		paddingBottom: 20,
	},
	backText: {
		color: "#FF1744",
		fontSize: 18,
		marginLeft: 8,
		fontFamily: "Inter-Medium",
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 36,
		color: "#FF1744",
		marginBottom: 16,
		fontFamily: "Inter-Bold",
		textAlign: "center",
	},
	subtitle: {
		fontSize: 18,
		color: "#E6E6FA",
		marginBottom: 32,
		textAlign: "center",
		fontFamily: "Inter-Regular",
		maxWidth: "80%",
	},
	inputContainer: {
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		borderRadius: 24,
		padding: 24,
		marginBottom: 40,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		width: "100%",
	},
	input: {
		fontSize: 36,
		color: "#ffffff",
		letterSpacing: 8,
		textAlign: "center",
		paddingVertical: 16,
		fontFamily: "Inter-Bold",
		backgroundColor: "transparent", // optional, for consistency
	},
	errorText: {
		color: "#FF1744",
		fontSize: 14,
		marginTop: 8,
		textAlign: "center",
		fontFamily: "Inter-Regular",
	},
	deleteButton: {
		width: "100%",
		borderRadius: 12,
		overflow: "hidden",
		marginBottom: 24,
		elevation: 5,
		shadowColor: "#FF1744",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	gradientButton: {
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 18,
		fontFamily: "Inter-Bold",
	},
	warningText: {
		color: "#FF6B6B",
		fontSize: 14,
		textAlign: "center",
		fontFamily: "Inter-Regular",
		maxWidth: "80%",
	},
});
