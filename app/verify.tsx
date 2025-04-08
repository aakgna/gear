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
		backgroundColor: "#000000", // Changed from #121212 to pure black
		paddingHorizontal: "5%",
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
		color: "#9B30FF", // Changed from #5C8374 to Vibrant Purple
		textAlign: "center",
	},
	taglineContainer: {
		marginBottom: 40,
		alignItems: "center",
		paddingHorizontal: 20,
	},
	tagline: {
		fontSize: 14,
		color: "#B3B3B3", // Changed from #A0A0A0 to Light Gray
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
		color: "#FFFFFF", // Changed to pure White
		backgroundColor: "#1A1A1A", // Changed from #1E1E1E to Dark Gray
		fontSize: 16,
		alignSelf: "center",
	},
	button: {
		width: "90%",
		height: 50,
		backgroundColor: "#9B30FF", // Changed from #5C8374 to Vibrant Purple
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
		alignSelf: "center",
	},
	buttonText: {
		color: "#FFFFFF", // Pure White
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
		color: "#BF5FFF", // Changed from #5C8374 to Bright Purple Glow
		fontSize: 14,
		textAlign: "center",
		textDecorationLine: "underline",
	},
});

export default VerifyPhonePage;
