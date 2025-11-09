// Analytics events for Gear app

// Temporarily disable Firebase analytics until import issues are resolved
// import { getAnalytics, logEvent, setUserId } from "@react-native-firebase/analytics";

// Mock analytics for MVP
const mockGetAnalytics = () => ({});
const mockLogEvent = () => Promise.resolve();
const mockSetUserId = () => Promise.resolve();

const DEBUG_ANALYTICS = __DEV__;

/**
 * Log app open
 */
export async function logAppOpen(): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "app_open");
	} catch (error) {
		console.error("Analytics error in logAppOpen:", error);
	}
}

/**
 * Log screen view
 */
export async function logScreenView(
	screenName: string,
	userId?: string
): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "screen_view", {
			screen_name: screenName,
			screen_class: screenName,
		});

		if (userId) {
			await mockSetUserId(analytics, userId);
		}
	} catch (error) {
		console.error("Analytics error in logScreenView:", error);
	}
}

/**
 * Log puzzle started
 */
export async function logPuzzleStarted(
	puzzleId: string,
	type: string,
	difficulty: number
): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "puzzle_started", {
			puzzle_id: puzzleId,
			puzzle_type: type,
			difficulty: difficulty,
		});
	} catch (error) {
		console.error("Analytics error in logPuzzleStarted:", error);
	}
}

/**
 * Log puzzle completed
 */
export async function logPuzzleCompleted(
	puzzleId: string,
	type: string,
	timeTaken: number,
	attempts?: number,
	completed: boolean
): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "puzzle_completed", {
			puzzle_id: puzzleId,
			puzzle_type: type,
			time_taken: timeTaken,
			attempts: attempts || 0,
			completed: completed,
		});
	} catch (error) {
		console.error("Analytics error in logPuzzleCompleted:", error);
	}
}

/**
 * Log filter changed
 */
export async function logFilterChanged(filter: string): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "filter_changed", {
			filter_type: filter,
		});
	} catch (error) {
		console.error("Analytics error in logFilterChanged:", error);
	}
}

/**
 * Log profile viewed
 */
export async function logProfileViewed(): Promise<void> {
	try {
		const analytics = mockGetAnalytics();
		await mockLogEvent(analytics, "profile_viewed");
	} catch (error) {
		console.error("Analytics error in logProfileViewed:", error);
	}
}
