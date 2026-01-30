// Authentication service using React Native Firebase
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { db } from "./firebase";
import messaging from "@react-native-firebase/messaging";
import { Platform, PermissionsAndroid, Alert } from "react-native";

export interface CategoryStats {
	completed: number;
	attempted: number; // User started interacting with the game
	skipped: number; // User skipped without interacting
	avgTime: number;
}

export interface UserData {
	email: string;
	username?: string;
	createdAt: any; // Firestore timestamp
	updatedAt: any; // Firestore timestamp
	_historyMigrated?: boolean; // Flag for migration from arrays to gameHistory
	// Stats fields
	totalGamesPlayed?: number;
	totalPlayTime?: number; // in seconds
	averageTimePerGame?: number;
	streakCount?: number;
	lastPlayedAt?: any; // Firestore timestamp
	statsByCategory?: {
		[category: string]: {
			attempted?: number; // Total attempted across all difficulties
			skipped?: number; // Total skipped across all difficulties
			easy?: CategoryStats;
			medium?: CategoryStats;
			hard?: CategoryStats;
		};
	};
	precomputedRecommendations?: {
		gameIds: string[]; // Array of game IDs (50 games)
		computedAt?: any; // Firestore timestamp
	};
	// Social fields
	followerCount?: number;
	followingCount?: number;
	createdGamesCount?: number;
	bio?: string;
	profilePicture?: string;
	unreadNotificationCount?: number;
	// Push notifications
	fcmToken?: string | null; // null = opted out, undefined = never prompted, string = active token
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

// Helper function to get a random game set for new users
const getRandomGameSet = (): string[] => {
	try {
		const sets = [
			[
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs"
			],
			[
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM"
			],
			[
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7"
			],
			[
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"zip_easy_A3qOcb2IAB9B8pe1516C"
			],
			[
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ"
			],
			[
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ"
			],
			[
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7"
			],
			[
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7"
			],
			[
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"wordle_easy_GqkeuaqnerV58KS829IJ",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"hidato_easy_3UI4oGVYACDteZQzU0kY"
			],
			[
			"wordle_easy_MrHxPd4CcXXqiJRN6J39",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_ilGTTl21iKxnNRQjuLyw",
			"zip_easy_7z1JnbJ8f1nLsX3q2Ynu",
			"quickMath_easy_BdtVeQakxhydQbGBllrB",
			"zip_easy_1aATn7OTTQi1XPOGgw7F",
			"wordle_easy_OZiCNBWGnm4aITypyypP",
			"mastermind_easy_JRzSA0x9HTwQIDwnxdw9",
			"wordle_easy_C5iJCGwZaAaNyoY2E9Fi",
			"mastermind_easy_SYm4XuZZ0sEvRsajf0aA",
			"quickMath_easy_6mb5MZ0i2EpkUOzh2BHw",
			"futoshiki_easy_CaYjgve8R0QySo5CEWiV",
			"alias_easy_IJKGKUjSal7OK8auWLic",
			"zip_easy_64XpYKalm7tGvjvJDsho",
			"magicSquare_easy_AdQ9QNqd53bk7pS0SgiJ",
			"wordChain_easy_60D17FcxQNCwPgz0QC6O",
			"magicSquare_easy_3uJoCqFP3ScdMjlYVCHy",
			"wordChain_easy_bXOOCJHqG6qFIdpaR6Xs",
			"magicSquare_easy_HYXE10MBueWEKUzoV6jM",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"riddle_easy_BTaI8AG5glFHLIEcroeX",
			"alias_easy_AkCXutTGKsbu8ZioZlk4",
			"magicSquare_easy_DIgJagcRkZqgEYUgeSIB",
			"hidato_easy_2i9wWYhqJyUUKQKxKeg7",
			"trivia_easy_elZX32LHDODaCXS4eW3A",
			"hidato_easy_K2GWmadPWU6QKOAWmOFD",
			"hidato_easy_3UI4oGVYACDteZQzU0kY",
			"riddle_easy_49Hmx7oKMKjdm4ijm470",
			"wordle_easy_MmV56TbSRb9hqR6vdo5u",
			"wordChain_easy_SdShqvC6Z8yh0AntnCrs",
			"mastermind_easy_Th9OMMiOFYMMROXQ5ym5",
			"riddle_easy_AvtJFCoOP6fEFwfKMsD3",
			"trivia_easy_YEit1DMaRg7hfIV6MDsB",
			"alias_easy_7JfiNzofeXwUFKu2IiqG",
			"quickMath_easy_KpuxVXAH3Ww9KNQejwjH",
			"zip_easy_A3qOcb2IAB9B8pe1516C",
			"trivia_easy_odVc1EkQDbvpXIBSlaYh",
			"futoshiki_easy_EgPKwSSU3RroCsoheEaz",
			"futoshiki_easy_WXtcf9hWTiTYYyKKDnTn",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"wordChain_easy_0FeSsYHgj3NS0YGCmJQ8",
			"mastermind_easy_ZQyP1zVYVEwq6rV7bO5V",
			"hidato_easy_Ref7kVZAYSVvnUrHOi10",
			"mastermind_easy_4WXTeSRTrCEU8n9dbtfn",
			"riddle_easy_IU4WOSBUVXXhXmRrbEFn",
			"alias_easy_AqoGpPia4eXmi3oDR3YC",
			"magicSquare_easy_60SK73aNs8XzzN1FX6xm",
			"zip_easy_CQjvgQ5VWwr3jD97HZCt",
			"futoshiki_easy_Kk2rVOGcXLbApGVfYsFJ",
			"trivia_easy_CFVIVh2EPRTjuZ6lewBB",
			"hidato_easy_NRX0onSdVbIPe1EJxuP8",
			"alias_easy_BsOK7sX4jikPeWT5QJwW",
			"riddle_easy_Q8m8jGhC9D8tZIDrJ64v",
			"quickMath_easy_LfOgkH5nxqMzyApW6cqz",
			"wordle_easy_GqkeuaqnerV58KS829IJ"
			]
		];
		
		if (sets.length === 0) {
			console.warn("No game sets found in game_sets.json");
			return [];
		}
		
		// Pick a random number from 0 to 9 (or sets.length - 1)
		const randomIndex = Math.floor(Math.random() * sets.length);
		return sets[randomIndex] || [];
	} catch (error) {
		console.error("Error loading game sets:", error);
		return [];
	}
};

// Create or update user document in Firestore
export const createOrUpdateUserDocument = async (firebaseUser: any) => {
	if (!firebaseUser) return;

	try {
		const userRef = db.collection("users").doc(firebaseUser.uid);
		const userDoc = await userRef.get();

		const firestore = require("@react-native-firebase/firestore").default;

		if (!userDoc.exists()) {
			// Get a random game set for precomputed recommendations
			const randomGameSet = getRandomGameSet();
			
			// New user - create document with initial stats
			await userRef.set({
				email: firebaseUser.email || "",
				totalGamesPlayed: 0,
				totalPlayTime: 0,
				averageTimePerGame: 0,
				streakCount: 0,
				statsByCategory: {},
				followerCount: 0,
				followingCount: 0,
				createdGamesCount: 0,
				unreadNotificationCount: 0,
				precomputedRecommendations: {
					gameIds: randomGameSet,
					computedAt: firestore.FieldValue.serverTimestamp(),
				},
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		} else {
			// Existing user - update email if changed and ensure counts are initialized
			const updateData: any = {
				email: firebaseUser.email || "",
				updatedAt: firestore.FieldValue.serverTimestamp(),
			};

			const existingData = userDoc.data();
			// Initialize counts if they don't exist
			if (existingData?.followerCount === undefined) {
				updateData.followerCount = 0;
			}
			if (existingData?.followingCount === undefined) {
				updateData.followingCount = 0;
			}
			if (existingData?.createdGamesCount === undefined) {
				updateData.createdGamesCount = 0;
			}
			if (existingData?.unreadNotificationCount === undefined) {
				updateData.unreadNotificationCount = 0;
			}

			await userRef.update(updateData);
		}
	} catch (error: any) {
		console.error("Error creating/updating user document:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		// Don't throw - allow sign-in to proceed even if document creation fails
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
	} catch (error: any) {
		console.error("Error fetching user data:", error);
		if (error?.code === "firestore/permission-denied") {
			console.warn(
				"Firestore permission denied. Please check your Firestore security rules."
			);
		}
		return null;
	}
};

// Helper to check if user data exists
export const hasUserData = (
	userData: UserData | null
): userData is UserData => {
	return userData !== null && userData !== undefined;
};

// Helper to parse game ID and extract category and difficulty
// Extended to support all game types
const parseGameId = (
	gameId: string
): {
	category: string | null;
	difficulty: "easy" | "medium" | "hard" | null;
} => {
	const parts = gameId.split("_");
	if (parts.length < 3) return { category: null, difficulty: null };

	const categoryPart = parts[0].toLowerCase();
	const difficultyPart = parts[1];

	// Map all possible game types
	const categoryMap: Record<string, string> = {
		wordform: "wordform",
		riddle: "riddle",
		quickmath: "quickMath",
		wordchain: "wordChain",
		trivia: "trivia",
		codebreaker: "codebreaker",
		sequencing: "sequencing",
		inference: "inference",
		maze: "maze",
		futoshiki: "futoshiki",
		magicsquare: "magicSquare",
		trailfinder: "trailfinder",
		sudoku: "sudoku",
	};

	const category = categoryMap[categoryPart] || null;

	let difficulty: "easy" | "medium" | "hard" | null = null;
	if (
		difficultyPart === "easy" ||
		difficultyPart === "medium" ||
		difficultyPart === "hard"
	) {
		difficulty = difficultyPart;
	}

	return { category, difficulty };
};

// Helper function to calculate category totals from difficulty stats
const calculateCategoryTotals = (categoryData: {
	easy?: CategoryStats;
	medium?: CategoryStats;
	hard?: CategoryStats;
}): { attempted: number; skipped: number } => {
	let totalAttempted = 0;
	let totalSkipped = 0;

	["easy", "medium", "hard"].forEach((diff) => {
		const diffStats = categoryData[diff as "easy" | "medium" | "hard"];
		if (diffStats) {
			totalAttempted +=
				typeof diffStats.attempted === "number" && isFinite(diffStats.attempted)
					? diffStats.attempted
					: 0;
			totalSkipped +=
				typeof diffStats.skipped === "number" && isFinite(diffStats.skipped)
					? diffStats.skipped
					: 0;
		}
	});

	return { attempted: totalAttempted, skipped: totalSkipped };
};

// Update user stats when a game is completed
export const updateUserStats = async (
	userId: string,
	gameId: string,
	timeTaken: number // in seconds
) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error("User document does not exist");
			return;
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		// Get current stats or initialize defaults
		// Sanitize to ensure they are numbers (handle corrupted data)
		const currentTotalGames =
			typeof userData.totalGamesPlayed === "number" &&
			isFinite(userData.totalGamesPlayed)
				? userData.totalGamesPlayed
				: 0;
		const currentTotalTime =
			typeof userData.totalPlayTime === "number" &&
			isFinite(userData.totalPlayTime)
				? userData.totalPlayTime
				: 0;

		// Calculate new totals
		// Ensure timeTaken is a valid number
		const sanitizedTimeTaken =
			typeof timeTaken === "number" && isFinite(timeTaken) && timeTaken >= 0
				? timeTaken
				: 0;

		const newTotalGames = currentTotalGames + 1;
		const newTotalTime = Number(currentTotalTime) + Number(sanitizedTimeTaken);
		const newAverageTime =
			newTotalGames > 0 ? Math.round(newTotalTime / newTotalGames) : 0;

		// Calculate streak
		const now = new Date();
		now.setHours(0, 0, 0, 0); // Set to start of day for comparison

		let lastPlayedDate: Date | null = null;
		if (userData.lastPlayedAt) {
			// Handle Firestore timestamp
			if (userData.lastPlayedAt.toDate) {
				lastPlayedDate = userData.lastPlayedAt.toDate();
			} else if (userData.lastPlayedAt instanceof Date) {
				lastPlayedDate = userData.lastPlayedAt;
			} else {
				// Try to parse as timestamp
				lastPlayedDate = new Date(userData.lastPlayedAt);
			}
			if (lastPlayedDate) {
				lastPlayedDate.setHours(0, 0, 0, 0); // Set to start of day
			}
		}

		let newStreak = userData.streakCount || 0;

		if (lastPlayedDate) {
			const daysSinceLastPlay = Math.floor(
				(now.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24)
			);
			if (daysSinceLastPlay === 0) {
				// Same day, keep streak (don't increment)
				newStreak = userData.streakCount || 1;
			} else if (daysSinceLastPlay === 1) {
				// Consecutive day, increment streak
				newStreak = (userData.streakCount || 0) + 1;
			} else {
				// Streak broken, reset to 1
				newStreak = 1;
			}
		} else {
			// First game, start streak
			newStreak = 1;
		}

		// Update stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			const catCompleted = currentCatStats.completed + 1;
			const catTotalTime =
				currentCatStats.completed * currentCatStats.avgTime + timeTaken;
			const catAvgTime = Math.round(catTotalTime / catCompleted);

			// Sanitize attempted and skipped to avoid NaN
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed: catCompleted,
					attempted: attempted, // Preserve attempted value
					skipped: skipped, // Preserve skipped value
					avgTime: catAvgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		// Explicitly ensure all numeric values are numbers (not strings)
		const updateData: any = {
			totalGamesPlayed: Number(newTotalGames),
			totalPlayTime: Number(newTotalTime),
			averageTimePerGame: Number(newAverageTime),
			streakCount: Number(newStreak),
			lastPlayedAt: firestore.FieldValue.serverTimestamp(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Final safety check: ensure totalPlayTime is a number before updating
		if (
			typeof updateData.totalPlayTime !== "number" ||
			!isFinite(updateData.totalPlayTime)
		) {
			console.error(
				`[updateUserStats] Invalid totalPlayTime value: ${
					updateData.totalPlayTime
				}, type: ${typeof updateData.totalPlayTime}. Resetting to 0.`
			);
			updateData.totalPlayTime = 0;
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error("Error updating user stats:", error);
	}
};

// Update user's completed games and stats
export const addCompletedGame = async (
	userId: string,
	gameId: string,
	timeTaken?: number, // in seconds
	answerRevealed?: boolean // true if user used "Show Answer" feature
) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection (always add to history)
		await addGameHistory(userId, gameId, "completed", {
			timeTaken,
			timestamp: new Date(),
			answerRevealed,
		});

		// Update stats only if answer was not revealed
		if (timeTaken !== undefined && !answerRevealed) {
			await updateUserStats(userId, gameId, timeTaken);
		}
	} catch (error) {
		console.error("Error adding completed game:", error);
	}
};

// Update skipped stats when a game is skipped
const updateSkippedStats = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error("User document does not exist");
			return;
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		// Update skipped stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const catSkipped = skipped + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted, // Preserve attempted value
					skipped: catSkipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats (preserving completed and avgTime, updating skipped)
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error("Error updating skipped stats:", error);
	}
};

// Update user's skipped games
export const addSkippedGame = async (userId: string, gameId: string) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection
		await addGameHistory(userId, gameId, "skipped", {
			timestamp: new Date(),
		});

		// Update skipped stats by category and difficulty
		await updateSkippedStats(userId, gameId);
	} catch (error) {
		console.error("Error adding skipped game:", error);
	}
};

// Move a game from skipped to attempted (when user comes back and attempts a previously skipped game)
export const moveFromSkippedToAttempted = async (
	userId: string,
	gameId: string
): Promise<boolean> => {
	try {
		const { checkGameHistory, updateGameHistory } = require("./firebase");

		// Check if this game was previously skipped using gameHistory
		const wasSkipped = await checkGameHistory(userId, gameId, "skipped");

		if (!wasSkipped) {
			return false;
		}

		// Update gameHistory document to change action from "skipped" to "attempted"
		await updateGameHistory(userId, gameId, {
			action: "attempted",
			timestamp: new Date(),
		});

		// Decrement skipped stats
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error(
				"[moveFromSkippedToAttempted] User document does not exist"
			);
			return true; // Still return true since we updated the history
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;

			// Decrement skipped, increment attempted
			const newSkipped = Math.max(0, skipped - 1);
			const newAttempted = attempted + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted: newAttempted,
					skipped: newSkipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);

		return true;
	} catch (error) {
		console.error("[moveFromSkippedToAttempted] Error:", error);
		return false;
	}
};

// Update attempted stats when user first interacts with a game
const updateAttemptedStats = async (userId: string, gameId: string) => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists()) {
			console.error("User document does not exist");
			return;
		}

		const userData = userDoc.data() as UserData;
		const { category, difficulty } = parseGameId(gameId);

		// Update attempted stats by category with difficulty breakdown
		const currentCategoryStats = userData.statsByCategory || {};
		let categoryStatsUpdate: any = {};

		if (category && difficulty) {
			// Initialize category if it doesn't exist
			if (!currentCategoryStats[category]) {
				currentCategoryStats[category] = {};
			}

			const currentCatStats = currentCategoryStats[category][difficulty] || {
				completed: 0,
				attempted: 0,
				skipped: 0,
				avgTime: 0,
			};

			// Sanitize values to avoid NaN
			const completed =
				typeof currentCatStats.completed === "number" &&
				isFinite(currentCatStats.completed)
					? currentCatStats.completed
					: 0;
			const attempted =
				typeof currentCatStats.attempted === "number" &&
				isFinite(currentCatStats.attempted)
					? currentCatStats.attempted
					: 0;
			const skipped =
				typeof currentCatStats.skipped === "number" &&
				isFinite(currentCatStats.skipped)
					? currentCatStats.skipped
					: 0;
			const avgTime =
				typeof currentCatStats.avgTime === "number" &&
				isFinite(currentCatStats.avgTime)
					? currentCatStats.avgTime
					: 0;
			const catAttempted = attempted + 1;

			// Update the difficulty-level stats
			const updatedDifficultyStats = {
				...(currentCategoryStats[category] || {}),
				[difficulty]: {
					completed,
					attempted: catAttempted,
					skipped,
					avgTime,
				},
			};

			// Calculate category-level totals (attempted and skipped)
			const categoryTotals = calculateCategoryTotals(updatedDifficultyStats);

			// Update the category with both difficulty breakdown and category totals
			categoryStatsUpdate[category] = {
				...updatedDifficultyStats,
				attempted: categoryTotals.attempted,
				skipped: categoryTotals.skipped,
			};
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: firestore.FieldValue.serverTimestamp(),
		};

		// Merge category stats
		if (Object.keys(categoryStatsUpdate).length > 0) {
			updateData["statsByCategory"] = {
				...(currentCategoryStats || {}),
				...categoryStatsUpdate,
			};
		}

		// Update Firestore
		await userRef.update(updateData);
	} catch (error) {
		console.error(
			"[updateAttemptedStats] Error updating attempted stats:",
			error
		);
	}
};

// Track when user first interacts with a game (types/clicks)
export const addAttemptedGame = async (userId: string, gameId: string) => {
	try {
		const { addGameHistory } = require("./firebase");

		// Add to game history subcollection
		await addGameHistory(userId, gameId, "attempted", {
			timestamp: new Date(),
		});

		// Update attempted stats by category and difficulty
		await updateAttemptedStats(userId, gameId);
	} catch (error) {
		console.error("Error adding attempted game:", error);
	}
};

// Check if username is available
export const checkUsernameAvailability = async (
	username: string
): Promise<boolean> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const lowerUsername = username.toLowerCase();
		const usernameRef = db.collection("usernames").doc(lowerUsername);

		// Check if document exists - handle both property and method cases
		const doc = await usernameRef.get();
		const exists = typeof doc.exists === "function" ? doc.exists() : doc.exists;

		return !exists; // Username is available if document doesn't exist
	} catch (error: any) {
		console.error("Error checking username availability:", error);
		throw new Error("Failed to check username availability");
	}
};

// Save username to user document and usernames collection
export const saveUsername = async (
	userId: string,
	username: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const lowerUsername = username.toLowerCase();

		// Use a transaction to ensure atomicity
		const usernameRef = db.collection("usernames").doc(lowerUsername);
		const userRef = db.collection("users").doc(userId);

		await db.runTransaction(async (transaction) => {
			// Check if username is already taken - handle both property and method cases
			const usernameDoc = await transaction.get(usernameRef);
			const exists =
				typeof usernameDoc.exists === "function"
					? usernameDoc.exists()
					: usernameDoc.exists;
			if (exists) {
				throw new Error("Username is already taken");
			}

			// Create username document with username as document ID
			transaction.set(usernameRef, {
				userId: userId,
				username: lowerUsername,
				createdAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});

			// Create user document if it doesn't exist
			const userDoc = await transaction.get(userRef);
			const userExists =
				typeof userDoc.exists === "function"
					? userDoc.exists()
					: userDoc.exists;
			if (!userExists) {
				const currentUser = getCurrentUser();
				transaction.set(userRef, {
					email: currentUser?.email || "",
					totalGamesPlayed: 0,
					totalPlayTime: 0,
					averageTimePerGame: 0,
					streakCount: 0,
					statsByCategory: {},
					followerCount: 0,
					followingCount: 0,
					createdGamesCount: 0,
					unreadNotificationCount: 0,
					createdAt: firestore.FieldValue.serverTimestamp(),
					updatedAt: firestore.FieldValue.serverTimestamp(),
				});
			}

			// Update user document with username
			transaction.update(userRef, {
				username: lowerUsername,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
		});
	} catch (error: any) {
		console.error("Error saving username:", error);
		if (error.message === "Username is already taken") {
			throw error;
		}
		throw new Error("Failed to save username");
	}
};

// Re-authenticate user with Google (required for sensitive operations like account deletion)
export const reauthenticateWithGoogle = async (): Promise<boolean> => {
	try {
		// Configure if not already configured
		configureGoogleSignIn();

		// Check if device supports Google Play Services (Android)
		await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

		// Get user info from Google (this will prompt the user to sign in again)
		const userInfo = await GoogleSignin.signIn();

		// Check if sign-in was successful and get idToken
		const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

		if (!idToken) {
			throw new Error("No ID token received from Google Sign-In");
		}

		// Create Firebase credential
		const googleCredential = auth.GoogleAuthProvider.credential(idToken);

		// Re-authenticate with Firebase
		const currentUser = auth().currentUser;
		if (!currentUser) {
			throw new Error("No user currently signed in");
		}

		await currentUser.reauthenticateWithCredential(googleCredential);
		return true;
	} catch (error: any) {
		console.error("Re-authentication Error:", error);
		if (error.code === "sign_in_cancelled") {
			throw new Error("Re-authentication was cancelled");
		}
		throw error;
	}
};

// FCM Push Notifications Functions

// Request notification permissions (iOS & Android 13+)
export const requestNotificationPermission = async (): Promise<boolean> => {
	try {
		// Android 13+ (API 33+) needs explicit POST_NOTIFICATIONS permission
		if (Platform.OS === "android" && Platform.Version >= 33) {
			const granted = await PermissionsAndroid.request(
				PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
			);
			if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
				return false;
			}
		}

		// iOS and Android (after permission granted)
		await messaging().registerDeviceForRemoteMessages();
		const authStatus = await messaging().requestPermission();
		
		return (
			authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
			authStatus === messaging.AuthorizationStatus.PROVISIONAL
		);
	} catch (error) {
		console.error("Error requesting notification permission:", error);
		return false;
	}
};

// Get FCM token from device
export const getFCMToken = async (): Promise<string | null> => {
	try {
		const token = await messaging().getToken();
		return token;
	} catch (error) {
		console.error("Error getting FCM token:", error);
		return null;
	}
};

// Register FCM token in Firestore
export const registerFCMToken = async (
	userId: string,
	token: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			fcmToken: token,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error registering FCM token:", error);
		throw error;
	}
};

// Remove FCM token from Firestore (opt-out)
export const removeFCMToken = async (userId: string): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;
		const userRef = db.collection("users").doc(userId);
		await userRef.update({
			fcmToken: "null", // String "null" to indicate opted out
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (error) {
		console.error("Error removing FCM token:", error);
		throw error;
	}
};

// Delete user account (iOS App Store requirement)
export const deleteAccount = async (
	userId: string,
	username?: string
): Promise<void> => {
	try {
		const firestore = require("@react-native-firebase/firestore").default;

		// 1. Get current user FIRST (to ensure we have valid reference before any deletions)
		const currentUser = auth().currentUser;
		if (!currentUser) {
			throw new Error("No user currently signed in");
		}

		// 2. Delete user document from Firestore
		const userRef = db.collection("users").doc(userId);
		await userRef.delete();

		// 3. Delete username document if it exists
		if (username) {
			const lowerUsername = username.toLowerCase();
			const usernameRef = db.collection("usernames").doc(lowerUsername);
			await usernameRef.delete();
		}

		// 4. Delete Firebase Auth account (this automatically signs out the user)
		await currentUser.delete();

		// Note: No need to call signOut() - delete() already signs out the user
	} catch (error: any) {
		console.error("Error deleting account:", error);
		if (error?.code === "auth/requires-recent-login") {
			// Re-authentication is required - try to re-authenticate automatically
			try {
				await reauthenticateWithGoogle();
				// After re-authentication, try to delete again
				const currentUser = auth().currentUser;
				if (currentUser) {
					await currentUser.delete();
				}
				return; // Success after re-authentication
			} catch (reauthError: any) {
				console.error("Re-authentication failed:", reauthError);
				throw new Error(
					"Please sign in again before deleting your account"
				);
			}
		}
		if (error?.code === "auth/no-current-user") {
			// User was already deleted/signed out, which means deletion succeeded
			// This can happen if delete() completed but signOut() was called after
			return; // Success - user is deleted
		}
		throw new Error(
			error.message || "Failed to delete account. Please try again."
		);
	}
};
