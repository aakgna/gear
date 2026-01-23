import React, { useState, useEffect, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	Image,
	RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MinimalHeader from "../components/MinimalHeader";
import TikTokButton from "../components/TikTokButton";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import {
	fetchNotifications,
	markNotificationAsRead,
	markAllNotificationsAsRead,
	deleteNotification,
	followUser,
	batchCheckFollowing,
	Notification,
} from "../config/social";
import { useSessionEndRefresh } from "../utils/sessionRefresh";

const BOTTOM_NAV_HEIGHT = 70;

const formatTimestamp = (timestamp: any): string => {
	if (!timestamp) return "";

	let date: Date;
	if (timestamp.toDate) {
		date = timestamp.toDate();
	} else if (timestamp instanceof Date) {
		date = timestamp;
	} else {
		date = new Date(timestamp);
	}

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString();
};

const NotificationsScreen = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
	const [markingAllRead, setMarkingAllRead] = useState(false);
	const currentUser = getCurrentUser();

	// Session end refresh: Refresh recommendations when app goes to background
	useSessionEndRefresh([]);

	useEffect(() => {
		loadNotifications();
	}, []);

	// OPTIMIZED: Load notifications and following status together to prevent UI flicker
	const loadNotifications = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			const notifs = await fetchNotifications(currentUser.uid, 50);
			
			// OPTIMIZED: Get unique user IDs from follow notifications
			const followNotifications = notifs.filter((n) => n.type === "follow");
			const uniqueUserIds = [...new Set(followNotifications.map((n) => n.fromUserId))];
			
			// OPTIMIZED: Use batch check with caching for efficiency
			const statusMap = uniqueUserIds.length > 0
				? await batchCheckFollowing(currentUser.uid, uniqueUserIds)
				: {};
			
			// Update both states together to prevent flicker
			setFollowingMap(statusMap);
			setNotifications(notifs);
		} catch (error) {
			console.error("Error loading notifications:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		await loadNotifications();
		setRefreshing(false);
	};

	const handleMarkAllAsRead = async () => {
		if (!currentUser || markingAllRead) return;

		setMarkingAllRead(true);
		try {
			await markAllNotificationsAsRead(currentUser.uid);
			// Update local state
			setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
		} catch (error) {
			console.error("Error marking all as read:", error);
		} finally {
			setMarkingAllRead(false);
		}
	};

	const handleNotificationPress = async (notification: Notification) => {
		if (!currentUser) return;

		// Mark as read if unread
		if (!notification.read) {
			try {
				await markNotificationAsRead(currentUser.uid, notification.id);
				setNotifications((prev) =>
					prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
				);
			} catch (error) {
				console.error("Error marking notification as read:", error);
			}
		}

		// Navigate to user profile
		if (notification.type === "follow" && notification.fromUsername) {
			router.push(`/user/${notification.fromUsername}`);
		}
	};

	const handleFollowBack = async (notification: Notification) => {
		if (!currentUser || notification.type !== "follow") return;

		// Optimistic update - show as following immediately
		setFollowingMap((prev) => ({
			...prev,
			[notification.fromUserId]: true,
		}));

		try {
			await followUser(currentUser.uid, notification.fromUserId);
			
			// Mark as read after following (fire and forget)
			if (!notification.read) {
				markNotificationAsRead(currentUser.uid, notification.id)
					.then(() => {
						setNotifications((prev) =>
							prev.map((n) =>
								n.id === notification.id ? { ...n, read: true } : n
							)
						);
					})
					.catch((error) => {
						console.error("Error marking notification as read:", error);
					});
			}
		} catch (error: any) {
			// On error, only revert if not already following
			if (!error.message?.includes("Already following")) {
				setFollowingMap((prev) => ({
					...prev,
					[notification.fromUserId]: false,
				}));
			}
			console.error("Error following back:", error);
		}
	};

	const handleDeleteNotification = async (notification: Notification) => {
		if (!currentUser) return;

		try {
			await deleteNotification(currentUser.uid, notification.id);
			// Remove from local state
			setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
		} catch (error) {
			console.error("Error deleting notification:", error);
		}
	};

	const renderNotification = useCallback(
		({ item: notification }: { item: Notification }) => {
			if (notification.type !== "follow") return null;

			const isFollowingUser = followingMap[notification.fromUserId] || false;
			const isUnread = !notification.read;

			return (
				<TouchableOpacity
					style={[styles.notificationItem, isUnread && styles.unreadItem]}
					onPress={() => handleNotificationPress(notification)}
					activeOpacity={0.7}
				>
					<TouchableOpacity
						onPress={() => {
							if (notification.fromUsername) {
								router.push(`/user/${notification.fromUsername}`);
							}
						}}
					>
						{notification.fromProfilePicture ? (
							<Image
								source={{ uri: notification.fromProfilePicture }}
								style={styles.avatar}
							/>
						) : (
							<Ionicons name="person-circle" size={50} color={Colors.accent} />
						)}
					</TouchableOpacity>
					<View style={styles.notificationContent}>
						<Text style={styles.notificationText}>
							<Text style={styles.username}>{notification.fromUsername}</Text>
							{" followed you"}
						</Text>
						<Text style={styles.timestamp}>
							{formatTimestamp(notification.createdAt)}
						</Text>
					</View>
					<View style={styles.rightActions}>
						{!isFollowingUser && (
							<TikTokButton
								label="Follow Back"
								onPress={() => handleFollowBack(notification)}
								variant="primary"
							/>
						)}
						<TouchableOpacity
							style={styles.trashIconButton}
							onPress={(e) => {
								e.stopPropagation();
								handleDeleteNotification(notification);
							}}
						>
							<Ionicons
								name="trash-outline"
								size={22}
								color={Colors.text.secondary}
							/>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			);
		},
		[
			followingMap,
			handleNotificationPress,
			handleFollowBack,
			handleDeleteNotification,
		]
	);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			<MinimalHeader
				title="Notifications"
				rightAction={
					<TouchableOpacity
						onPress={handleMarkAllAsRead}
						disabled={markingAllRead || notifications.every((n) => n.read)}
					>
						{markingAllRead ? (
							<ActivityIndicator size="small" color={Colors.accent} />
						) : (
							<Text style={styles.markAllText}>Mark all</Text>
						)}
					</TouchableOpacity>
				}
			/>

			{/* Notifications List */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={Colors.accent} />
				</View>
			) : notifications.length === 0 ? (
				<View style={styles.emptyState}>
					<Ionicons
						name="notifications-outline"
						size={64}
						color={Colors.text.secondary}
					/>
					<Text style={styles.emptyStateText}>No notifications yet</Text>
				</View>
			) : (
				<FlatList
					data={notifications}
					renderItem={renderNotification}
					keyExtractor={(item) => item.id}
					windowSize={5}
					initialNumToRender={10}
					maxToRenderPerBatch={5}
					updateCellsBatchingPeriod={50}
					removeClippedSubviews={true}
					getItemLayout={(data, index) => ({
						length: 80,
						offset: 80 * index,
						index,
					})}
					contentContainerStyle={{
						paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + Spacing.lg,
					}}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							tintColor={Colors.accent}
							colors={[Colors.accent]}
						/>
					}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
	},
	markAllText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.accent,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyState: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	emptyStateText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	notificationItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.background.primary,
		marginHorizontal: Layout.margin,
		marginBottom: Spacing.sm,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderWidth: 0,
		...Shadows.light,
	},
	unreadItem: {
		backgroundColor: Colors.accent + "08",
		borderLeftWidth: 3,
		borderLeftColor: Colors.accent,
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
		marginRight: Spacing.md,
	},
	notificationContent: {
		flex: 1,
	},
	notificationText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	username: {
		fontWeight: Typography.fontWeight.semiBold,
	},
	timestamp: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	rightActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	trashIconButton: {
		padding: Spacing.xs,
		marginLeft: Spacing.xs,
	},
});

export default NotificationsScreen;
