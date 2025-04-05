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
				source={require("../assets/images/icon.png")} // Adjust the path to your logo
				style={styles.logo} // Add styles for the logo
			/>
			<View style={styles.logoContainer}>
				<Text style={styles.logoTextOne}>Common</Text>
				<Text style={styles.logoTextTwo}>Ground</Text>
			</View>

			<View style={styles.taglineContainer}>
				<Text style={styles.tagline}>
					Find understanding through discussion
				</Text>
			</View>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.textInput}
					placeholder="Enter your phone number"
					placeholderTextColor="#B0BEC5"
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
						{isLoading ? "Sending..." : "Sign In / Get Started"}
					</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.footerContainer}>
				<Text style={styles.footerText}>
					By continuing, you agree to our{" "}
					<Link
						href="https://v0-interview-prep-gateway.vercel.app/privacy-policy"
						style={{ textDecorationLine: "underline" }}
					>
						Privacy Policy
					</Link>{" "}
					and{" "}
					<Link
						href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
						style={{ textDecorationLine: "underline" }}
					>
						Apple's Licensed Application End User License Agreement
					</Link>
					. To delete your account please press{" "}
					<Text
						style={{ textDecorationLine: "underline" }}
						onPress={handleDeleteAccount}
					>
						here
					</Text>
					.
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
		backgroundColor: "black",
		padding: 20,
		justifyContent: "center",
	},
	logoContainer: {
		alignItems: "center",
	},
	logoTextOne: {
		fontSize: 48,
		fontWeight: "700",
		color: "#0EA5E9", // Rich electric blue
	},
	logoTextTwo: {
		fontSize: 48,
		fontWeight: "700",
		color: "#EF4444", // Vibrant red
	},
	taglineContainer: {
		marginVertical: 20,
		alignItems: "center",
	},
	tagline: {
		fontSize: 20,
		color: "#A5F3FC", // Bright cyan
		textAlign: "center",
	},
	inputContainer: {
		alignItems: "center",
	},
	textInput: {
		width: "100%",
		height: 50,
		paddingHorizontal: 16,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: "#0EA5E9", // Matching electric blue
		borderRadius: 10,
		color: "#FFFFFF",
		backgroundColor: "rgba(2, 132, 199, 0.15)", // Semi-transparent deep blue
	},
	button: {
		width: "100%",
		height: 50,
		backgroundColor: "#0284C7", // Deep saturated blue
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	footerContainer: {
		marginTop: 40,
	},
	footerText: {
		color: "#7DD3FC", // Bright sky blue
		textAlign: "center",
		fontSize: 14,
	},
});

export default LandingPage;
