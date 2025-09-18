// SignInScreen.tsx
import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Image,
	Alert,
	Platform,
	Linking,
	AppState,
	Keyboard,
	TouchableWithoutFeedback,
} from "react-native";
import { router, Link } from "expo-router";
// Updated Firebase imports to use new modular SDK
import {
	getAuth,
	onAuthStateChanged,
	GoogleAuthProvider,
	signInWithCredential,
} from "@react-native-firebase/auth";
import {
	getFirestore,
	collection,
	getDocs,
	doc,
	setDoc,
	getDoc,
	deleteDoc, // Add this
} from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import DeviceInfo from "react-native-device-info";

export default function SignInScreen() {
	const [isLoading, setIsLoading] = useState(false);

	// If user is already signed in, jump to /start immediately
	useEffect(() => {
		checkForUpdate();

		// Configure Google Sign-In
		GoogleSignin.configure({
			webClientId:
				"899431350542-igho9j6qlvujo8vi0vg2ikj07ec7b6fe.apps.googleusercontent.com",
		});

		const auth = getAuth();
		const subscriber = onAuthStateChanged(auth, async (user) => {
			if (user) {
				const firestore = getFirestore();
				const userDocRef = doc(firestore, "users", user.uid);
				const userDoc = await getDoc(userDocRef);
				if (!userDoc.exists()) {
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const todayDate = today.toISOString().substring(0, 10);
					let school = user.email?.split("@")[1];
					school = school?.split(".")[0];
					if (school == "ucr" || school == "berkeley") {
						await setDoc(userDocRef, {
							email: user.email,
							school: school,
							strikes: 6,
							strikeCount: 0,
							messageCount: 100,
							voted: false,
							updatedAt: todayDate,
							createdAt: todayDate,
						});
					} else if (user.email?.split("@")[0] == "thecommonground366") {
						const today = new Date();
						today.setHours(0, 0, 0, 0);
						const todayDate = today.toISOString().substring(0, 10);
						await setDoc(userDocRef, {
							email: user.email,
							school: "berkeley",
							strikes: 6,
							strikeCount: 0,
							messageCount: 100,
							voted: false,
							updatedAt: todayDate,
							createdAt: todayDate,
						});
					} else {
						await user.delete();
						Alert.alert(
							"School Not Found",
							"It looks like your school is not in our system yet. Please fill out this form to request it be added.",
							[
								{
									text: "Submit Form",
									onPress: () =>
										Linking.openURL(
											"https://docs.google.com/forms/d/e/1FAIpQLSc3rHKJ0B5pST33mAB79_JGxoGXHieGp_XmNiAssqm5dZQN2A/viewform?usp=header"
										),
								},
							],
							{ cancelable: false }
						);

						return;
					}
				}
				router.replace("/(tabs)/start");
			}
		});
		return subscriber; // unsubscribe on unmount
	}, []);

	function useAppState() {
		const [state, setState] = useState(AppState.currentState);
		useEffect(() => {
			const sub = AppState.addEventListener("change", setState);
			return () => sub.remove();
		}, []);
		return state;
	}
	const app = useAppState();
	useEffect(() => {
		if (app === "active") {
			checkForUpdate();
		}
	}, [app]);

	const checkForUpdate = async () => {
		try {
			const firestore = getFirestore();
			const versionQuery = collection(firestore, "version");
			const versionSnapshot = await getDocs(versionQuery);
			const versionDoc = versionSnapshot.docs[0];
			const latestVersion = versionDoc.data().number;
			const currentVersion = DeviceInfo.getVersion();

			if (currentVersion !== latestVersion) {
				const storeURL =
					Platform.OS === "ios"
						? "https://apps.apple.com/us/app/the-common-ground/id6744280175"
						: "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

				Alert.alert(
					"Update Required",
					"Please update the app to continue.",
					[
						{
							text: "Update",
							onPress: () => Linking.openURL(storeURL),
						},
					],
					{ cancelable: false }
				);
			}
		} catch (err) {
			console.error("Remote Config version check failed:", err);
		}
	};

	// Google Sign-In handler
	const handleGoogleSignIn = async () => {
		setIsLoading(true);
		try {
			// Check if device supports Google Play Services
			const hasPlayServices = await GoogleSignin.hasPlayServices({
				showPlayServicesUpdateDialog: true,
			});
			// Get the user's ID token
			const signInResult = await GoogleSignin.signIn();
			// Handle different versions of google-signin library
			let idToken = signInResult.data?.idToken;
			if (!idToken) {
				idToken = signInResult.idToken;
			}
			if (!idToken) {
				throw new Error("No ID token found");
			}
			// Create a Google credential with the token
			const googleCredential = GoogleAuthProvider.credential(idToken);
			// Sign-in the user with the credential
			const auth = getAuth();
			await signInWithCredential(auth, googleCredential);
			// Navigation will be handled by the onAuthStateChanged listener
		} catch (error) {
			console.error("Google Sign-In failed:", error);

			// Handle user cancellation
			if (error.code === "SIGN_IN_CANCELLED") {
				// User cancelled the sign-in, don't show error
				return;
			}

			Alert.alert(
				"Sign-In Failed",
				"Please try again or check your internet connection."
			);
		} finally {
			setIsLoading(false);
		}
	};

	// Handle account deletion - simplified since no phone verification needed
	const handleDeleteAccount = async () => {
		Alert.alert(
			"Delete Account",
			"You'll need to sign in to verify your identity before deleting your account. This action cannot be undone.",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Sign In & Delete",
					style: "destructive",
					onPress: async () => {
						setIsLoading(true);

						try {
							// Check if device supports Google Play Services
							const hasPlayServices = await GoogleSignin.hasPlayServices({
								showPlayServicesUpdateDialog: true,
							});

							// Get the user's ID token
							const signInResult = await GoogleSignin.signIn();

							// Handle different versions of google-signin library
							let idToken = signInResult.data?.idToken;
							if (!idToken) {
								idToken = signInResult.idToken;
							}
							if (!idToken) {
								throw new Error("No ID token found");
							}

							// Create a Google credential with the token
							const googleCredential = GoogleAuthProvider.credential(idToken);

							// Sign-in the user with the credential
							const auth = getAuth();
							await signInWithCredential(auth, googleCredential);
						} catch (error) {
							console.error("Google Sign-In failed:", error);

							// Handle user cancellation
							if (error.code === "SIGN_IN_CANCELLED") {
								return;
							}

							Alert.alert(
								"Sign-In Failed",
								"Please try again or check your internet connection."
							);
							return; // Exit early if sign-in failed
						} finally {
							setIsLoading(false);
						}

						// Delete the user after successful sign-in
						try {
							const auth = getAuth();
							const user = auth.currentUser;

							if (user) {
								// Delete user document from Firestore first
								const firestore = getFirestore();
								const userDocRef = doc(firestore, "users", user.uid);
								const userDoc = await getDoc(userDocRef);

								if (userDoc.exists()) {
									await deleteDoc(userDocRef);
								}

								// Then delete the Firebase Auth user
								await user.delete();

								Alert.alert(
									"Account Deleted",
									"Your account has been successfully deleted."
								);
							}
						} catch (deleteError) {
							console.error("Error deleting account:", deleteError);
							Alert.alert(
								"Error",
								"Failed to delete account. Please try again."
							);
						}
						// Navigate to deletion screen - you may need to modify this screen
						// to handle Google-authenticated users instead of phone verification
						router.push("/");
					},
				},
			]
		);
	};

	return (
		<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
			<View style={styles.container}>
				{/* Full‐screen gradient background */}
				<LinearGradient
					colors={["#120318", "#1C0529"]}
					style={StyleSheet.absoluteFill}
				/>

				<Animated.View entering={FadeIn.duration(800)} style={styles.content}>
					<Animated.View
						entering={SlideInUp.delay(200).duration(800)}
						style={styles.logoContainer}
					>
						<Image
							source={require("../assets/images/CG2.png")}
							style={styles.logoImage}
						/>

						<Text style={styles.appTitle}>The Common Ground</Text>
						<Text style={styles.subtitle}>
							Find understanding in disagreement
						</Text>
					</Animated.View>

					<Animated.View
						entering={SlideInUp.delay(400).duration(800)}
						style={styles.formContainer}
					>
						<Pressable
							style={({ pressed }) => [
								styles.googleButton,
								{ opacity: pressed ? 0.9 : 1 },
								isLoading && styles.disabledButton,
							]}
							onPress={handleGoogleSignIn}
							disabled={isLoading}
						>
							<LinearGradient
								colors={["#BF5FFF", "#6A0DAD"]}
								//locations={[0, 0.35, 0.7, 1]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={styles.gradientButton}
							>
								<View style={styles.buttonContent}>
									<Image
										source={{
											uri: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3LjY0IDkuMjA0NTVDMTcuNjQgOC41NjY4MiAxNy41ODI3IDcuOTUyMjcgMTcuNDc2NCA3LjM2MzY0SDE5VjkuMjA0NTVIMTcuNjRaIiBmaWxsPSIjNDI4NUY0Ii8+CjxwYXRoIGQ9Ik05IDYuNTgxODJMMTMuOTA5MSA2LjU4MTgyQzE0LjQ1NDUgOS4yIDEzLjkwOTEgMTEuODE4MiA5IDExLjgxODJWMTMuNjM2NEMxNS4yIDEzLjYzNjQgMTggOS4yIDk5IDkuMjAwOThWNi41ODE4MloiIGZpbGw9IiMzNEE4NTMiLz4KPHBhdGggZD0iTTkgMTMuNjM2NEM2LjQ1IDEzLjYzNjQgNC4zNjM2NCAxMS41NSA0LjM2MzY0IDlTNi40NSA0LjM2MzY0IDkgNC4zNjM2NEM5Ljc1IDQuMzYzNjQgMTAuNDU0NSA0LjU5MDkxIDExLjA1NDUgNC45NDU0NUwxMy4wMzY0IDIuOTYzNjRDMTEuNDQgMS41ODgxOCA5LjI1NSAwIDkgMEM1LjE4MTgyIDAgMi4yNSAyLjkzMTgyIDIuMjUgNi43NVMtNS4xODE4MiAxMy41IDIuMjUgMTMuNSIgZmlsbD0iI0ZCQkMwNSIvPgo8L3N2Zz4K",
										}}
										style={styles.googleIcon}
									/>
									<Text style={styles.buttonText}>
										{isLoading
											? "Signing in..."
											: "Continue with your school email"}
									</Text>
								</View>
							</LinearGradient>
						</Pressable>

						<View style={styles.termsContainer}>
							<Text style={styles.termsText}>
								By continuing, you agree to our{" "}
								<Link
									href="https://v0-the-common-ground-website.vercel.app/privacy-policy"
									style={styles.link}
								>
									Privacy Policy
								</Link>{" "}
								,{" "}
								<Link
									href="https://v0-the-common-ground-website.vercel.app/eula"
									style={styles.link}
								>
									Apple's EULA
								</Link>
								, and{" "}
								<Link
									href="https://v0-the-common-ground-website.vercel.app/terms-of-service"
									style={styles.link}
								>
									our Terms of Services
								</Link>
								.{"\n\n"}
								Messages containing content related to profanity, derogatory
								language, sexual topics, death or harm, violence, or public
								safety concerns are not permitted. These actions may lead to
								account suspension or ban. Contact{" "}
								<Link
									href="https://v0-the-common-ground-website.vercel.app/#contact"
									style={styles.link}
								>
									support
								</Link>{" "}
								for help.{"\n\n"}
								Click{" "}
								<Text onPress={handleDeleteAccount} style={styles.link}>
									here
								</Text>{" "}
								to delete your account.
							</Text>
						</View>
					</Animated.View>
				</Animated.View>
			</View>
		</TouchableWithoutFeedback>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		justifyContent: "center",
	},
	logoContainer: {
		alignItems: "center",
		marginBottom: 32,
	},
	logoBackground: {
		width: 100,
		height: 100,
		borderRadius: 50,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 16,
		elevation: 10,
		shadowColor: "#9D00FF",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	logoImage: {
		width: 140,
		height: 140,
		borderRadius: 35,
	},
	appTitle: {
		fontSize: Platform.OS === "ios" ? 34 : 34,
		fontFamily: Platform.OS === "ios" ? "Inter-Bold" : "Poppins-Black",
		fontWeight: Platform.OS === "ios" ? "900" : "900",
		color: "#FFFFFF",
		textAlign: "center",
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: "#A0A0A0",
		fontFamily: "Inter-Regular",
		textAlign: "center",
	},
	formContainer: {
		width: "100%",
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		borderRadius: 24,
		padding: 24,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
	},
	googleButton: {
		marginTop: 10,
		borderRadius: 16,
		overflow: "hidden",
		// alignSelf: "center",
	},
	gradientButton: {
		paddingVertical: 14,
		borderRadius: 16,
		alignItems: "center",
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	googleIcon: {
		width: 20,
		height: 20,
		marginRight: 12,
		position: "absolute",
		left: 16,
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontFamily: "Inter-SemiBold",
		flex: 1,
		textAlign: "center",
	},
	disabledButton: {
		opacity: 0.6,
	},
	termsContainer: {
		marginTop: 20,
	},
	termsText: {
		color: "#A0A0A0",
		fontSize: 12,
		lineHeight: 18,
		fontFamily: "Inter-Regular",
		textAlign: "center",
	},
	link: {
		color: "#BF5FFF",
		textDecorationLine: "underline",
	},
});
