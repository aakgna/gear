// Authentication service using React Native Firebase
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { db } from "./firebase";

export interface UserData {
	email: string;
	seenGames: string[];
	completedGames: string[];
	skippedGames: string[];
	createdAt: any; // Firestore timestamp
	updatedAt: any; // Firestore timestamp
}

// Configure Google Sign-In (call this once at app startup)
export const configureGoogleSignIn = () => {
	GoogleSignin.configure({
		webClientId:
			"28371093595-lo532pbakpbje0uejblbaltr6gskba2c.apps.googleusercontent.com", // From GoogleService-Info.plist
	});
};

// Sign in with Google
export const signInWithGoogle = async () => {
	try {
		// Configure if not already configured
		configureGoogleSignIn();

		// Check if device supports Google Play Services (Android)
		await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

		// Get user info from Google
		const userInfo = await GoogleSignin.signIn();

		// Check if sign-in was successful and get idToken
		const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

		if (!idToken) {
			throw new Error("No ID token received from Google Sign-In");
		}

		// Create Firebase credential
		const googleCredential = auth.GoogleAuthProvider.credential(idToken);

		// Sign in to Firebase
		const result = await auth().signInWithCredential(googleCredential);

		// Create or update user document in Firestore
		if (result.user) {
			await createOrUpdateUserDocument(result.user);
		}

		return result.user;
	} catch (error: any) {
		console.error("Google Sign-In Error:", error);
		if (error.code === "sign_in_cancelled") {
			throw new Error("Sign in was cancelled");
		}
		throw error;
	}
};

// Sign out
export const signOut = async () => {
	try {
		await auth().signOut();
	} catch (error: any) {
		console.error("Sign Out Error:", error);
		throw error;
	}
};

// Get current user
export const getCurrentUser = () => {
	return auth().currentUser;
};

// Listen to auth state changes
export const onAuthStateChanged = (callback: (user: any) => void) => {
	return auth().onAuthStateChanged(callback);
};

// Create or update user document in Firestore
export const createOrUpdateUserDocument = async (firebaseUser: any) => {
	if (!firebaseUser) return;

	const userRef = db.collection("users").doc(firebaseUser.uid);
	const userDoc = await userRef.get();

	const firestore = require("@react-native-firebase/firestore").default;

	if (!userDoc.exists()) {
		// New user - create document
		await userRef.set({
			email: firebaseUser.email || "",
			seenGames: [],
			completedGames: [],
			skippedGames: [],
			createdAt: firestore.FieldValue.serverTimestamp(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} else {
		// Existing user - update email if changed
		await userRef.update({
			email: firebaseUser.email || "",
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	}
};

// Get user data from Firestore
export const getUserData = async (userId: string): Promise<UserData | null> => {
	try {
		const userDoc = await db.collection("users").doc(userId).get();
		if (userDoc.exists()) {
			return userDoc.data() as UserData;
		}
		return null;
	} catch (error) {
		console.error("Error fetching user data:", error);
		return null;
	}
};

// Helper to check if user data exists
export const hasUserData = (
	userData: UserData | null
): userData is UserData => {
	return userData !== null && userData !== undefined;
};

// Update user's seen games
export const addSeenGame = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			seenGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error adding seen game:", error);
	}
};

// Update user's completed games
export const addCompletedGame = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			completedGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error adding completed game:", error);
	}
};

// Update user's skipped games
export const addSkippedGame = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			skippedGames: firestore.FieldValue.arrayUnion(gameId),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error adding skipped game:", error);
	}
};
