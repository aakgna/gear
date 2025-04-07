// VerifyPhonePage.tsx
import React, { useState, useEffect } from "react";
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
import auth, { signInWithPhoneNumber } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const VerifyPhonePage = () => {
	const [verificationCode, setVerificationCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const params = useLocalSearchParams();
	const [countdown, setCountdown] = useState(60);
	const [canResend, setCanResend] = useState(false);

	useEffect(() => {
		const subscriber = auth().onAuthStateChanged((user) => {
			if (user && !user.phoneNumber) {
				router.navigate("/start");
			}
		});
		return subscriber;
	}, []);

	useEffect(() => {
		// Start countdown for resend button
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		} else {
			setCanResend(true);
		}
	}, [countdown]);

	const handleVerifyCode = async () => {
		if (!verificationCode || verificationCode.length !== 6) {
			Alert.alert("Please enter a valid 6-digit code");
			return;
		}

		try {
			setIsLoading(true);
			const { verificationId } = params;
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
				await firestore().collection("users").doc(userCredential.user.uid).set({
					phoneNumber: params.phoneNumber,
					voted: false,
					createdAt: firestore.FieldValue.serverTimestamp(),
					messages: 3,
				});
			}

			router.navigate("/start");
		} catch (error) {
			Alert.alert("Invalid verification code");
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleResendCode = async () => {
		try {
			setIsLoading(true);
			setCanResend(false);
			setCountdown(60);

			const confirmation = await auth().signInWithPhoneNumber(
				params.phoneNumber as string
			);
			// Update verification ID in params
			router.setParams({ verificationId: confirmation.verificationId });

			Alert.alert(
				"Code Resent",
				"A new verification code has been sent to your phone."
			);
		} catch (error) {
			console.error(error);
			Alert.alert(
				"Error",
				"Failed to resend verification code. Please try again."
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.headerTitle}>Verify Your Number</Text>
			</View>

			<View style={styles.taglineContainer}>
				<Text style={styles.tagline}>
					Enter the verification code sent to {params.phoneNumber}
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
					onPress={handleVerifyCode}
					disabled={isLoading}
				>
					<Text style={styles.buttonText}>
						{isLoading ? "Verifying..." : "Verify Code"}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.resendButton,
						(!canResend || isLoading) && styles.buttonDisabled,
					]}
					onPress={handleResendCode}
					disabled={!canResend || isLoading}
				>
					<Text style={styles.resendButtonText}>
						{canResend ? "Resend Code" : `Resend Code (${countdown}s)`}
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
		paddingHorizontal: 20, // Add padding for header text
	},
	headerTitle: {
		fontSize: 32,
		fontWeight: "700",
		color: "#5C8374", // White
		textAlign: "center",
	},
	taglineContainer: {
		marginBottom: 40,
		alignItems: "center",
		paddingHorizontal: 20, // Add padding for tagline text
	},
	tagline: {
		fontSize: 14,
		color: "#A0A0A0", // Soft Gray
		textAlign: "center",
	},
	inputContainer: {
		alignItems: "center",
		width: "100%",
		paddingHorizontal: 20, // Add padding for input container
	},
	textInput: {
		width: "90%", // Reduce width to prevent edge touching
		height: 50,
		paddingHorizontal: 16,
		marginBottom: 20,
		borderRadius: 12,
		color: "#FFFFFF", // White
		backgroundColor: "#1E1E1E", // Deep Gray
		fontSize: 16,
		alignSelf: "center", // Center the input
	},
	button: {
		width: "90%", // Match input width
		height: 50,
		backgroundColor: "#5C8374", // Neutral Teal
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
		alignSelf: "center", // Center the button
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	resendButton: {
		padding: 12,
	},
	resendButtonText: {
		color: "#5C8374", // Neutral Teal
		fontSize: 14,
		textAlign: "center",
		textDecorationLine: "underline",
	},
});

export default VerifyPhonePage;
