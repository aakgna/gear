import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import auth from "@react-native-firebase/auth";
import { getCurrentUser } from "../config/auth";

const REFRESH_RECOMMENDATIONS_URL =
	"https://us-central1-gear-ff009.cloudfunctions.net/refresh_user_recommendations";

// Flag to prevent multiple simultaneous calls
let isRefreshing = false;

// Global ref to store current feed IDs (updated by feed component)
let globalCurrentFeedIds: string[] = [];

// Global AppState listener (singleton pattern)
let appStateSubscription: any = null;
let isListenerSetup = false;

// Shared function to trigger session end refresh
// Can be called from any page when app goes to background
export const triggerSessionEndRefresh = async (
	currentFeedIds: string[] = []
) => {
	// Prevent multiple simultaneous calls
	if (isRefreshing) {
		console.log("[triggerSessionEndRefresh] Already refreshing, skipping");
		return;
	}

	console.log(
		"[triggerSessionEndRefresh] Called with",
		currentFeedIds.length,
		"game IDs"
	);

	const user = getCurrentUser();
	if (!user) {
		console.log("[triggerSessionEndRefresh] No user found, returning");
		return;
	}

	isRefreshing = true;

	// Make this completely fire-and-forget to avoid blocking
	// When app is backgrounded, async operations can hang
	(async () => {
		try {
			// Get auth token first (faster than game history query)
			const currentUser = auth().currentUser;
			if (!currentUser) {
				console.error("[triggerSessionEndRefresh] No current user available");
				isRefreshing = false;
				return;
			}

			console.log("[triggerSessionEndRefresh] Getting ID token...");
			let idToken: string | null = null;

			try {
				// Try to get token with timeout, but don't block
				const tokenPromise = currentUser.getIdToken(false); // false = don't force refresh, use cache
				const tokenTimeoutPromise = new Promise<string | null>((resolve) => {
					setTimeout(() => {
						console.log(
							"[triggerSessionEndRefresh] ID token request timed out"
						);
						resolve(null);
					}, 1500); // 1.5 second timeout for token
				});

				idToken = await Promise.race([tokenPromise, tokenTimeoutPromise]);
			} catch (error) {
				console.error(
					"[triggerSessionEndRefresh] Error getting ID token:",
					error
				);
				idToken = null;
			}

			if (!idToken) {
				console.error("[triggerSessionEndRefresh] No auth token available");
				isRefreshing = false;
				return;
			}

			// Only exclude current feed IDs to avoid duplicates
			// The Firebase function will handle excluding completed games internally
			const excludeIds = currentFeedIds;
			console.log(
				`[triggerSessionEndRefresh] Excluding ${excludeIds.length} game IDs from current feed`
			);

			console.log(
				"[triggerSessionEndRefresh] Making request to",
				REFRESH_RECOMMENDATIONS_URL
			);

			// Call Firebase function via HTTP (non-blocking)
			fetch(REFRESH_RECOMMENDATIONS_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					data: {
						excludeGameIds: excludeIds,
						count: 50,
					},
				}),
			})
				.then((response) => {
					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}
					return response.json();
				})
				.then((data) => {
					console.log(
						"[triggerSessionEndRefresh] Background refresh triggered successfully",
						data
					);
					isRefreshing = false;
				})
				.catch((error) => {
					console.error(
						"[triggerSessionEndRefresh] Background refresh failed:",
						error.message || error
					);
					isRefreshing = false;
				});
		} catch (error) {
			console.error(
				"[triggerSessionEndRefresh] Failed to trigger refresh:",
				error
			);
			isRefreshing = false;
		}
	})();
};

// Set up global AppState listener (singleton - only one listener for entire app)
const setupGlobalAppStateListener = () => {
	if (isListenerSetup) {
		console.log("[setupGlobalAppStateListener] Listener already set up");
		return;
	}

	console.log(
		"[setupGlobalAppStateListener] Setting up global AppState listener"
	);
	isListenerSetup = true;

	appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
		console.log(
			`[GlobalAppStateListener] AppState changed: ${nextAppState}`,
			"Current feed IDs count:",
			globalCurrentFeedIds.length
		);

		// Listen for both "background" and "inactive" to catch app exit
		if (nextAppState === "background" || nextAppState === "inactive") {
			// Check authentication in callback
			const currentUser = getCurrentUser();
			if (!currentUser) {
				console.log(
					"[GlobalAppStateListener] User not authenticated, skipping refresh"
				);
				return;
			}

			console.log(
				`[GlobalAppStateListener] App state: ${nextAppState} - triggering session end refresh with`,
				globalCurrentFeedIds.length,
				"game IDs"
			);

			// User leaving app - refresh pre-computed recommendations
			triggerSessionEndRefresh(globalCurrentFeedIds);
		}
	});

	const currentAppState = AppState.currentState;
	console.log(
		`[setupGlobalAppStateListener] Global listener set up. Current AppState: ${currentAppState}`
	);
};

// Hook to update global feed IDs and ensure listener is set up
export const useSessionEndRefresh = (currentFeedIds: string[] = []) => {
	// Update global feed IDs whenever they change
	useEffect(() => {
		globalCurrentFeedIds = currentFeedIds;
		console.log(
			`[useSessionEndRefresh] Updated global feed IDs: ${currentFeedIds.length}`
		);
	}, [currentFeedIds]);

	// Set up global listener once (singleton pattern)
	useEffect(() => {
		setupGlobalAppStateListener();

		// Don't remove listener on unmount - keep it global
		return () => {
			// Keep listener active even when component unmounts
			console.log(
				"[useSessionEndRefresh] Component unmounting, but keeping global listener active"
			);
		};
	}, []); // Only set up once
};
