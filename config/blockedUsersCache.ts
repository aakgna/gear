// Cache for blocked users to avoid repeated Firestore queries
// This significantly improves performance for social features

import { getBlockedUsers, getBlockedByUsers } from "./social";

// Cache structure
interface BlockedUsersCache {
	blockedUserIds: Set<string>;
	blockedByUserIds: Set<string>;
	timestamp: number;
	userId: string;
}

// Simple in-memory cache
let cache: BlockedUsersCache | null = null;

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get cached blocked users or fetch from Firestore if cache is stale/empty
 * @param userId Current user's ID
 * @returns Set of user IDs that current user has blocked
 */
export async function getCachedBlockedUsers(
	userId: string
): Promise<Set<string>> {
	// Check if cache is valid (same user, not expired)
	if (
		cache &&
		cache.userId === userId &&
		Date.now() - cache.timestamp < CACHE_TTL
	) {
		return cache.blockedUserIds;
	}

	// Fetch fresh data
	const blockedIds = await getBlockedUsers(userId);
	const blockedByIds = await getBlockedByUsers(userId);

	// Update cache
	cache = {
		blockedUserIds: new Set(blockedIds),
		blockedByUserIds: new Set(blockedByIds),
		timestamp: Date.now(),
		userId,
	};

	return cache.blockedUserIds;
}

/**
 * Get cached users who blocked current user or fetch from Firestore if cache is stale/empty
 * @param userId Current user's ID
 * @returns Set of user IDs who have blocked current user
 */
export async function getCachedBlockedByUsers(
	userId: string
): Promise<Set<string>> {
	// Check if cache is valid (same user, not expired)
	if (
		cache &&
		cache.userId === userId &&
		Date.now() - cache.timestamp < CACHE_TTL
	) {
		return cache.blockedByUserIds;
	}

	// Fetch fresh data (this will also update blockedUserIds)
	const blockedIds = await getBlockedUsers(userId);
	const blockedByIds = await getBlockedByUsers(userId);

	// Update cache
	cache = {
		blockedUserIds: new Set(blockedIds),
		blockedByUserIds: new Set(blockedByIds),
		timestamp: Date.now(),
		userId,
	};

	return cache.blockedByUserIds;
}

/**
 * Invalidate cache - call this when user blocks/unblocks someone
 * Forces fresh fetch on next access
 */
export function invalidateBlockedUsersCache(): void {
	cache = null;
}

/**
 * Get both blocked and blockedBy sets in one call (optimized)
 * @param userId Current user's ID
 * @returns Object with both sets
 */
export async function getCachedBlockedUsersAll(userId: string): Promise<{
	blocked: Set<string>;
	blockedBy: Set<string>;
}> {
	// Check if cache is valid
	if (
		cache &&
		cache.userId === userId &&
		Date.now() - cache.timestamp < CACHE_TTL
	) {
		return {
			blocked: cache.blockedUserIds,
			blockedBy: cache.blockedByUserIds,
		};
	}

	// Fetch fresh data in parallel
	const [blockedIds, blockedByIds] = await Promise.all([
		getBlockedUsers(userId),
		getBlockedByUsers(userId),
	]);

	// Update cache
	cache = {
		blockedUserIds: new Set(blockedIds),
		blockedByUserIds: new Set(blockedByIds),
		timestamp: Date.now(),
		userId,
	};

	return {
		blocked: cache.blockedUserIds,
		blockedBy: cache.blockedByUserIds,
	};
}

