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
	strikeCount?: number; // Number of strikes for moderation
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
	gameStrikeCount?: number; // Number of strikes for game moderation
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
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s"
			],
			[
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS"
			],
			[
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR"
			],
			[
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C"
			],
			[
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7"
			],
			[
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd"
			],
			[
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE"
			],
			[
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"trailfinder_easy_065CONLp6F775VHVyLU6"
			],
			[
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ"
			],
			[
			"wordform_easy_Gufam8TFDQVDSI8Yxb1C",
			"quickMath_easy_aMv2WFso2X2OwjHBm9HC",
			"trivia_easy_AowSvqDsHcSRgKU2Aabh",
			"maze_easy_GVOjo5A8Abrpq2jYXy3G",
			"futoshiki_easy_SPGQGWQun1XdkmH3KWpV",
			"wordChain_easy_opYtGSIoZxdjrkTBFkEf",
			"riddle_easy_DIfSZFLpL56TDBFUFIYp",
			"wordform_easy_BMalKmkZ8qP1WyszZrXy",
			"codebreaker_easy_eKydFK2Sgn7AfxvJqCRQ",
			"codebreaker_easy_QjhOO00ubo3NFMk2LwhF",
			"riddle_easy_5XqO2TkbPygerQPofDLB",
			"quickMath_easy_ERYsGDH6wuLrO9AOAaFo",
			"wordChain_easy_SOlplsaqt2Gh652U9FK3",
			"maze_easy_D59nSNNglEs8SM4DP269",
			"sudoku_easy_jxIxqQv0xaWuie6qnPSX",
			"codebreaker_easy_RmMWFrkUjsNfWQt6aUsB",
			"sequencing_easy_BGx4DjHlgDRT2sNPyE9Y",
			"sudoku_easy_CJkC6DVXf2wi2Za1dz2M",
			"trailfinder_easy_4PMjuFvhhKHCdDDyeAii",
			"inference_easy_5Aou65GSXNHV2peyE84i",
			"futoshiki_easy_9rsWFyXfEFYhUQU08bq7",
			"trailfinder_easy_VfL1HqLRRK5va9MTWjzR",
			"sequencing_easy_rMLEHSwMLgn3kXNDl4jj",
			"inference_easy_MXMMUXngvEZvNxhnd9MA",
			"wordform_easy_PNn8xx3RiFDSGjBzHh4j",
			"riddle_easy_76jb1tIgWFA2SB6xYhAH",
			"quickMath_easy_05UGivOSyi04Mn0o8oTc",
			"magicSquare_easy_Vfo9xrHwkD3CrARdNkc8",
			"wordChain_easy_Ac6K6dGYxB72MbBLgt33",
			"wordform_easy_7JTA0pXEt4GaHxr5IJij",
			"futoshiki_easy_2KPb3UGl98kHpDA617Fd",
			"wordChain_easy_0m4wpyg4P7dBbiBEovPC",
			"maze_easy_5sr9LMS9mgcFuzNm478K",
			"sudoku_easy_RIy4jR6oXHGgszRjXW3I",
			"magicSquare_easy_H6b8YCJ2sD1NX3uult6G",
			"codebreaker_easy_I8aqPUhDmNEaJGoq79DE",
			"sudoku_easy_QP749ofNj60kVHrSPemB",
			"inference_easy_JhyugySsH2N4dtvplPC2",
			"magicSquare_easy_AUVf1rIGlG5TfoCGRdT3",
			"quickMath_easy_mfGvIxDtOPakeykTBu7Q",
			"trivia_easy_lLk3P7gvVepWyfHClvl0",
			"sequencing_easy_F0P0EiezZXpSvndk9Rgx",
			"trivia_easy_mV3b21QH4RrGqXH49EtM",
			"sequencing_easy_8oJZwjqgUHZSpGmQhpvn",
			"inference_easy_Mq0v2cTpKQ4MHPQtbRwS",
			"trailfinder_easy_065CONLp6F775VHVyLU6",
			"futoshiki_easy_9vR8FcSNa3ftySkzRs07",
			"riddle_easy_DuDiYfThW4yD4qCMnMwd",
			"trailfinder_easy_3TatZW5Q9OWczle5pl9s",
			"trivia_easy_8JEaHhqwSizvgitCNym9",
			"quickMath_easy_ShOkOQ0Gm4tStmdCWQEV",
			"inference_easy_10niV1cRwPd8tQg22GTP",
			"wordChain_easy_Knn1rtRczTnajrrMiMHv",
			"futoshiki_easy_GJy6mHwzLWLYkKo4RMQE",
			"maze_easy_5TheitOaVQLGeIU6grLS",
			"riddle_easy_BimKkdo3XMGjylMOeuA1",
			"magicSquare_easy_XF0PWdnDSqVCFBm44QJj",
			"sequencing_easy_x46dC3Hf6B6GjDPLTQk7",
			"trivia_easy_rAsIzxcAjCYGVBNbHkAJ",
			"codebreaker_easy_GGRCulJNZvGprXAYBELA",
			"maze_easy_Lkoez3ATOHMdwSLWiFZe",
			"sudoku_easy_qhWFRAdumXlLb4XbLJcs",
			"trailfinder_easy_XEj86SGw5HJNyngwm4Fr",
			"magicSquare_easy_7EiP86tSTFhe9N9WidIJ",
			"wordform_easy_DIhScTt7CXxD2aQ4JBFX"
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
