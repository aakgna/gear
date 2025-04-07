// LandingPage.tsx
import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
	Image,
} from "react-native";
import { Link, useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";

const LandingPage = () => {
	const [phoneNumber, setPhoneNumber] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const subscriber = auth().onAuthStateChanged((user) => {
			if (user && user.phoneNumber) {
				router.navigate("/start");
			}
		});
		return subscriber;
	}, []);

	const handleVerification = async () => {
		if (!phoneNumber) {
			Alert.alert(
				"Please enter a phone number",
				"Format: +1 (123)456-7890 into +11234567890"
			);
			return;
		}

		try {
			setIsLoading(true);
			var num: string = "";
			if (phoneNumber.length == 10) {
				num = "+1" + phoneNumber;
			} else if (phoneNumber.length == 11) {
				num = "+" + phoneNumber;
			} else if (phoneNumber.length == 12) {
				num = phoneNumber;
			}

			// const formattedNumber = phoneNumber.startsWith("+")
			// 	? phoneNumber
			// 	: `+${phoneNumber}`;
			const formattedNumber = num;
			const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
			router.navigate({
				pathname: "/verify",
				params: {
					phoneNumber: formattedNumber,
					verificationId: confirmation.verificationId,
				},
			});
		} catch (error) {
			Alert.alert(
				"Failed to send verification code",
				"Please try again with phone number in format: +11234567890"
			);
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (!phoneNumber) {
			Alert.alert("Error", "Phone number is required for verification.");
			return;
		}

		try {
			const formattedNumber = phoneNumber.startsWith("+")
				? phoneNumber
				: `+${phoneNumber}`;
			const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
			const verificationId = confirmation.verificationId;

			// Navigate to the deletion page and pass the verificationId
			router.navigate({
				pathname: "/deletion", // Adjust this to your actual deletion page path
				params: {
					phoneNumber: formattedNumber,
					verificationId: verificationId,
				},
			});
		} catch (error) {
			console.error("Error initiating account deletion:", error);
			Alert.alert(
				"Error",
				"Failed to initiate account deletion. Please try again."
			);
		}
	};

	return (
		<View style={styles.container}>
			<Image
				source={require("../assets/images/icon.png")}
				style={styles.logo}
			/>
			<View style={styles.logoContainer}>
				<Text style={styles.logoTextOne}>Common Ground</Text>
			</View>

			<View style={styles.taglineContainer}>
				<Text style={styles.tagline}>Enter your phone number to sign in</Text>
			</View>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.textInput}
					placeholder="Phone number"
					placeholderTextColor="#888888"
					keyboardType="phone-pad"
					value={phoneNumber}
					onChangeText={setPhoneNumber}
					enablesReturnKeyAutomatically={true}
					returnKeyType="done"
					editable={!isLoading}
				/>

				<TouchableOpacity
					style={[styles.button, isLoading && styles.buttonDisabled]}
					onPress={handleVerification}
					disabled={isLoading}
				>
					<Text style={styles.buttonText}>
						{isLoading ? "Sending..." : "Continue"}
					</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.footerContainer}>
				<Text style={styles.footerText}>
					By continuing, you agree to our{" "}
					<Link href="..." style={styles.link}>
						Privacy Policy
					</Link>{" "}
					and{" "}
					<Link href="..." style={styles.link}>
						Apple's EULA
					</Link>
				</Text>
				<Text style={styles.deleteText}>
					Need help or want to{" "}
					<Text onPress={handleDeleteAccount} style={styles.link}>
						delete your account
					</Text>
					?
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	logo: {
		width: 100,
		height: 100,
		alignSelf: "center",
		marginBottom: 10,
	},
	container: {
		flex: 1,
		backgroundColor: "#121212", // Charcoal Black
		padding: 20,
		justifyContent: "center",
	},
	logoContainer: {
		alignItems: "center",
		marginBottom: 40,
	},
	logoTextOne: {
		fontSize: 45,
		fontWeight: "700",
		color: "#5C8374", // White
	},
	logoTextTwo: {
		fontSize: 48,
		fontWeight: "700",
		color: "#FFFFFF", // White
	},
	taglineContainer: {
		marginBottom: 40,
		alignItems: "center",
	},
	tagline: {
		fontSize: 14,
		color: "#A0A0A0", // Soft Gray
		textAlign: "center",
	},
	inputContainer: {
		alignItems: "center",
		width: "100%",
	},
	textInput: {
		width: "100%",
		height: 50,
		paddingHorizontal: 16,
		marginBottom: 20,
		borderRadius: 12,
		color: "#FFFFFF", // White
		backgroundColor: "#1E1E1E", // Deep Gray
		fontSize: 16,
	},
	button: {
		width: "100%",
		height: 50,
		backgroundColor: "#5C8374", // Neutral Teal
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	footerContainer: {
		marginTop: 40,
		borderTopWidth: 1,
		borderTopColor: "#333333", // Muted Gray
		paddingTop: 20,
	},
	footerText: {
		color: "#A0A0A0", // Soft Gray
		textAlign: "center",
		fontSize: 12,
	},
	link: {
		color: "#5C8374", // Neutral Teal
		textDecorationLine: "underline",
	},
	deleteText: {
		color: "#666666", // Slightly lighter than Muted Gray
		textAlign: "center",
		fontSize: 12,
		marginTop: 10,
	},
});

export default LandingPage;
