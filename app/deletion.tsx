import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	SafeAreaView,
	StyleSheet,
	Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const DeletionPage = () => {
	const params = useLocalSearchParams(); // Get parameters from navigation
	const [verificationCode, setVerificationCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const { verificationId } = params;

	const handleConfirmDeletion = async () => {
		// Function to confirm account deletion
		if (!verificationCode || verificationCode.length !== 6) {
			Alert.alert("Please enter a valid 6-digit code");
			return;
		}

		try {
			setIsLoading(true);
			const credential = auth.PhoneAuthProvider.credential(
				verificationId as string,
				verificationCode
			);

			const userCredential = await auth().signInWithCredential(credential);
			const userDoc = await firestore()
				.collection("users")
				.doc(userCredential.user.uid)
				.get();

			if (!userDoc.exists) {
				Alert.alert("Error", "No user is currently signed in.");
				router.back();
				return;
			} else {
				await firestore()
					.collection("users")
					.doc(userCredential.user.uid)
					.delete();
				await userCredential.user.delete();

				Alert.alert("Success", "Your account has been deleted successfully.");
				router.navigate("/");
				return;
			}
		} catch (error) {
			Alert.alert("Error", "Failed to delete account. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.headerTitle}>Delete Your Account</Text>
			</View>

			<View style={styles.icon}>
				<Text style={styles.iconText}>🗑️</Text>
			</View>

			<View style={styles.formContainer}>
				<Text style={styles.subtitle}>
					Please enter the verification code sent to your phone:
				</Text>

				<TextInput
					style={styles.textInput}
					placeholder="Enter 6-digit code"
					placeholderTextColor="#B0BEC5"
					keyboardType="number-pad"
					value={verificationCode}
					onChangeText={setVerificationCode}
					enablesReturnKeyAutomatically={true}
					returnKeyType="done"
					editable={!isLoading}
					maxLength={6}
				/>

				<TouchableOpacity
					style={[styles.sendButton, isLoading && styles.buttonDisabled]}
					onPress={handleConfirmDeletion}
					disabled={isLoading}
				>
					<Text style={styles.sendButtonText}>
						{isLoading ? "Deleting..." : "Confirm Deletion"}
					</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 20,
	},
	headerContainer: {
		marginBottom: 30,
	},
	headerTitle: {
		color: "#0EA5E9", // Rich electric blue
		fontSize: 28,
		fontWeight: "bold",
		textAlign: "center",
	},
	icon: {
		width: 64,
		height: 64,
		backgroundColor: "rgba(2, 132, 199, 0.15)", // Semi-transparent deep blue
		borderRadius: 32,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 20,
		borderWidth: 1,
		borderColor: "#0EA5E9", // Rich electric blue
	},
	iconText: {
		fontSize: 36,
		color: "#7DD3FC", // Bright sky blue
	},
	formContainer: {
		width: "70%",
	},
	subtitle: {
		fontSize: 16,
		color: "#A5F3FC", // Bright cyan
		marginBottom: 15,
		textAlign: "center",
	},
	textInput: {
		width: "100%",
		height: 50,
		paddingHorizontal: 16,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: "#0EA5E9", // Rich electric blue
		borderRadius: 10,
		color: "#FFFFFF",
		backgroundColor: "rgba(2, 132, 199, 0.15)", // Semi-transparent deep blue
	},
	sendButton: {
		width: "100%",
		height: 50,
		backgroundColor: "#EF4444", // Red for deletion
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	sendButtonText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
});

export default DeletionPage;
