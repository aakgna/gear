import React, { useState, useEffect } from "react";
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
	followUser,
	isFollowing,
	Notification,
} from "../config/social";

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

	useEffect(() => {
		loadNotifications();
	}, []);

	useEffect(() => {
		if (notifications.length > 0 && currentUser) {
			checkFollowingStatus();
		}
	}, [notifications]);

	const loadNotifications = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			const notifs = await fetchNotifications(currentUser.uid, 50);
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

	const checkFollowingStatus = async () => {
		if (!currentUser) return;

		const followNotifications = notifications.filter((n) => n.type === "follow");
		const statusMap: Record<string, boolean> = {};

		await Promise.all(
			followNotifications.map(async (notif) => {
				const following = await isFollowing(currentUser.uid, notif.fromUserId);
				statusMap[notif.fromUserId] = following;
			})
		);
		setFollowingMap(statusMap);
	};

	const handleMarkAllAsRead = async () => {
		if (!currentUser || markingAllRead) return;

		setMarkingAllRead(true);
		try {
			await markAllNotificationsAsRead(currentUser.uid);
			// Update local state
			setNotifications((prev) =>
				prev.map((n) => ({ ...n, read: true }))
			);
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
					prev.map((n) =>
						n.id === notification.id ? { ...n, read: true } : n
					)
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

		try {
			// Check if already following before attempting
			const alreadyFollowing = await isFollowing(currentUser.uid, notification.fromUserId);
			if (alreadyFollowing) {
				setFollowingMap((prev) => ({
					...prev,
					[notification.fromUserId]: true,
				}));
				return;
			}
			await followUser(currentUser.uid, notification.fromUserId);
			setFollowingMap((prev) => ({
				...prev,
				[notification.fromUserId]: true,
			}));
			// Refresh notifications to update any UI that might show counts
			await loadNotifications();
		} catch (error: any) {
			console.error("Error following back:", error);
			// If already following, update state
			if (error.message && error.message.includes("Already following")) {
				setFollowingMap((prev) => ({
					...prev,
					[notification.fromUserId]: true,
				}));
			}
		}
	};

	const renderNotification = ({ item: notification }: { item: Notification }) => {
		if (notification.type !== "follow") return null;

		const isFollowingUser = followingMap[notification.fromUserId] || false;
		const isUnread = !notification.read;

		return (
			<TouchableOpacity
				style={[styles.notificationItem, isUnread && styles.unreadItem]}
				onPress={() => handleNotificationPress(notification)}
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
						<Ionicons
							name="person-circle"
							size={50}
							color={Colors.accent}
						/>
					)}
				</TouchableOpacity>
				<View style={styles.notificationContent}>
					<Text style={styles.notificationText}>
						<Text style={styles.username}>
							@{notification.fromUsername}
						</Text>
						{" followed you"}
					</Text>
					<Text style={styles.timestamp}>
						{formatTimestamp(notification.createdAt)}
					</Text>
				</View>
				{!isFollowingUser && (
					<TouchableOpacity
						style={styles.followBackButton}
						onPress={(e) => {
							e.stopPropagation();
							handleFollowBack(notification);
						}}
					>
						<Text style={styles.followBackText}>Follow Back</Text>
					</TouchableOpacity>
				)}
			</TouchableOpacity>
		);
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Header */}
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Notifications</Text>
				<TouchableOpacity
					style={styles.markAllButton}
					onPress={handleMarkAllAsRead}
					disabled={markingAllRead || notifications.every((n) => n.read)}
				>
					{markingAllRead ? (
						<ActivityIndicator size="small" color={Colors.accent} />
					) : (
						<Text style={styles.markAllText}>Mark all read</Text>
					)}
				</TouchableOpacity>
			</View>

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
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		...Shadows.light,
	},
	backButton: {
		padding: Spacing.xs,
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		flex: 1,
		textAlign: "center",
	},
	markAllButton: {
		padding: Spacing.xs,
		minWidth: 100,
		alignItems: "flex-end",
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
		...Shadows.light,
	},
	unreadItem: {
		backgroundColor: "#F5F5F5",
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
	followBackButton: {
		backgroundColor: Colors.accent,
		paddingVertical: Spacing.xs,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.md,
		marginLeft: Spacing.sm,
	},
	followBackText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.white,
	},
});

export default NotificationsScreen;

