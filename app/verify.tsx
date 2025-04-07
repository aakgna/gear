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
				<Text style={styles.headerTitle}>Verify Your Phone Number</Text>
			</View>

			<View style={styles.icon}>
				<Text style={styles.iconText}>🔒</Text>
			</View>

			<View style={styles.formContainer}>
				<Text style={styles.subtitle}>
					Enter the verification code sent to {params.phoneNumber}
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
					onPress={handleVerifyCode}
					disabled={isLoading}
				>
					<Text style={styles.sendButtonText}>
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
		backgroundColor: "#0284C7", // Deep saturated blue
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
	resendButton: {
		marginTop: 10,
		padding: 10,
	},
	resendButtonText: {
		color: "#7DD3FC", // Bright sky blue
		fontSize: 16,
		textAlign: "center",
	},
});

export default VerifyPhonePage;
