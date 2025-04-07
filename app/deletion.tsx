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

			<View style={styles.taglineContainer}>
				<Text style={styles.tagline}>
					Please enter the verification code sent to your phone
				</Text>
			</View>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.textInput}
					placeholder="Enter 6-digit code"
					placeholderTextColor="#888888"
					keyboardType="number-pad"
					value={verificationCode}
					onChangeText={setVerificationCode}
					enablesReturnKeyAutomatically={true}
					returnKeyType="done"
					editable={!isLoading}
					maxLength={6}
				/>

				<TouchableOpacity
					style={[styles.button, isLoading && styles.buttonDisabled]}
					onPress={handleConfirmDeletion}
					disabled={isLoading}
				>
					<Text style={styles.buttonText}>
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
		backgroundColor: "#121212", // Charcoal Black
		paddingHorizontal: "5%", // Use percentage for dynamic side padding
		justifyContent: "center",
	},
	headerContainer: {
		alignItems: "center",
		marginBottom: 40,
		paddingHorizontal: 20,
	},
	headerTitle: {
		fontSize: 32,
		fontWeight: "700",
		color: "#EF4444",
		textAlign: "center",
	},
	taglineContainer: {
		marginBottom: 40,
		alignItems: "center",
		paddingHorizontal: 20,
	},
	tagline: {
		fontSize: 14,
		color: "#A0A0A0", // Soft Gray
		textAlign: "center",
	},
	inputContainer: {
		alignItems: "center",
		width: "100%",
		paddingHorizontal: 20,
	},
	textInput: {
		width: "90%",
		height: 50,
		paddingHorizontal: 16,
		marginBottom: 20,
		borderRadius: 12,
		color: "#FFFFFF",
		backgroundColor: "#1E1E1E", // Deep Gray
		fontSize: 16,
		alignSelf: "center",
	},
	button: {
		width: "90%",
		height: 50,
		backgroundColor: "#EF4444", // Keep red for deletion action
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
		alignSelf: "center",
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
});

export default DeletionPage;
