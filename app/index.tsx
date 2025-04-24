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
	KeyboardAvoidingView,
	Platform,
	ScrollView,
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
				"Failed to initiate account deletion. Please format number like this +11234567890."
			);
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.keyboardAvoidingContainer}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
			>
				<Image source={require("../assets/images/C.png")} style={styles.logo} />
				<View style={styles.logoContainer}>
					<Text style={styles.logoTextOne}> The Common Ground</Text>
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
						<Link
							href="https://v0-common-ground-three.vercel.app/privacy-policy"
							style={styles.link}
						>
							Privacy Policy
						</Link>{" "}
						and{" "}
						<Link
							href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
							style={styles.link}
						>
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
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	logo: {
		width: 200,
		height: 200,
		alignSelf: "center",
		marginBottom: 10,
	},
	container: {
		flex: 1,
		backgroundColor: "#000000", // Changed from #121212 to pure black
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
		color: "#FFFFFF", // Changed to Vibrant Purple,
		textAlign: "center",
		alignSelf: "center",
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
		color: "#B3B3B3", // Changed to Light Gray for secondary text
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
		color: "#FFFFFF", // Changed to pure White
		backgroundColor: "#1A1A1A", // Changed to Dark Gray for secondary background
		fontSize: 16,
	},
	button: {
		width: "100%",
		height: 50,
		backgroundColor: "#9B30FF", // Changed to Vibrant Purple
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: "#FFFFFF", // Pure White
		fontSize: 16,
		fontWeight: "600",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	footerContainer: {
		marginTop: 40,
		borderTopWidth: 1,
		borderTopColor: "#1A1A1A", // Changed to Dark Gray
		paddingTop: 20,
	},
	footerText: {
		color: "#B3B3B3", // Changed to Light Gray for secondary text
		textAlign: "center",
		fontSize: 12,
	},
	link: {
		color: "#BF5FFF", // Changed to Bright Purple Glow for interactive elements
		textDecorationLine: "underline",
	},
	deleteText: {
		color: "#B3B3B3", // Changed to Light Gray for secondary text
		textAlign: "center",
		fontSize: 12,
		marginTop: 10,
	},
	keyboardAvoidingContainer: {
		flex: 1,
		backgroundColor: "#000000",
	},
	scrollContainer: {
		flexGrow: 1,
		paddingHorizontal: 20,
		justifyContent: "center",
	},
});

export default LandingPage;
