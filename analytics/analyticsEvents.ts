// src/analytics/analyticsEvents.ts

import analytics from "@react-native-firebase/analytics";

const DEBUG_ANALYTICS = __DEV__;

/**
 * 1. Daily Active User (DAU)
 *    Call on cold start and whenever the app
 *    returns to the foreground (e.g. in App.tsx).
 */
export async function logDailyOpen(): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: daily_open", { screen: "Home" });
		}
		await analytics().logEvent("daily_open", {
			screen: "Home",
		});
	} catch (error) {
		console.error("Analytics error in logDailyOpen:", error);
	}
}

/**
 * 2. Generic Screen View
 *    Call from NavigationContainer's onReady/onStateChange
 *    and also from individual screens if desired.
 */
export async function logScreenView(
	screenName: string,
	uID: any
): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: screen_view", {
				screen_name: screenName,
				screen_class: screenName,
				uID: uID,
			});
		}
		await analytics().logScreenView({
			screen_name: screenName,
			screen_class: screenName,
			uID: uID,
		});
	} catch (error) {
		console.error("Analytics error in logScreenView:", error);
	}
}

export async function logdeleted(
	createdAt: string,
	today: string
): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: logdeleted", {
				createdAt: createdAt,
				deletedOn: today,
			});
		}
		await analytics().logEvent("deleted", {
			createdAt: createdAt,
			deletedOn: today,
		});
	} catch (error) {
		console.error("Analytics error in logdeleted:", error);
	}
}

/**
 * 3. User voted on the daily question
 *
 * @param questionId  unique ID of the question
 * @param choice      'agree' or 'disagree'
 */
export async function logVoted(questionId: string): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: voted", {
				question_id: questionId,
			});
		}
		await analytics().logEvent("voted", {
			question_id: questionId,
		});
		await analytics().log;
	} catch (error) {
		console.error("Analytics error in logVoted:", error);
	}
}

/**
 * 4. User posted a top‑level comment or a reply
 *
 * @param questionId  ID of the question being discussed
 * @param threadType  'top_level' or 'reply'
 */
export async function logCommentPosted(
	questionId: string,
	threadType: "top_level" | "reply",
	uID: string
): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: comment_posted", {
				question_id: questionId,
				thread_type: threadType,
				uID: uID,
			});
		}
		await analytics().logEvent("comment_posted", {
			question_id: questionId,
			thread_type: threadType,
			uID: uID,
		});
	} catch (error) {
		console.error("Analytics error in logCommentPosted:", error);
	}
}

/**
 * 5. Authentication Events
 */
export async function logSignUp(method: string): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: sign_up", { method });
		}
		await analytics().logSignUp({ method });
	} catch (error) {
		console.error("Analytics error in logSignUp:", error);
	}
}

export async function logLogin(method: string): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: login", { method });
		}
		await analytics().logLogin({ method });
	} catch (error) {
		console.error("Analytics error in logLogin:", error);
	}
}

/** 6. Drop-off Event */
export async function logDropOff(
	screen: string,
	reason: "no_vote" | "no_comment" | "no_vote_no_comment"
): Promise<void> {
	try {
		if (DEBUG_ANALYTICS) {
			console.log("Analytics: drop_off", { screen, reason });
		}

		await analytics().logEvent("drop_off", {
			screen,
			reason,
		});
	} catch (error) {
		console.error("Analytics error in logDropOff:", error);
	}
}
