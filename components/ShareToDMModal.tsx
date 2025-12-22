import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableOpacity,
	FlatList,
	Modal,
	ActivityIndicator,
	Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Layout,
} from "../constants/DesignSystem";
import { getCurrentUser } from "../config/auth";
import { getMutualFollowers, shareGameToDM } from "../config/messaging";
import { UserSummary } from "../config/social";

interface ShareToDMModalProps {
	visible: boolean;
	gameId: string;
	onClose: () => void;
}

const ShareToDMModal: React.FC<ShareToDMModalProps> = ({
	visible,
	gameId,
	onClose,
}) => {
	const insets = useSafeAreaInsets();
	const currentUser = getCurrentUser();
	const [mutualFollowers, setMutualFollowers] = useState<UserSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [sharingTo, setSharingTo] = useState<string | null>(null);

	useEffect(() => {
		if (visible && currentUser) {
			loadMutualFollowers();
		} else {
			setMutualFollowers([]);
		}
	}, [visible, currentUser]);

	const loadMutualFollowers = async () => {
		if (!currentUser) return;

		setLoading(true);
		try {
			const followers = await getMutualFollowers(currentUser.uid);
			setMutualFollowers(followers);
		} catch (error) {
			console.error("[ShareToDMModal] Error loading mutual followers:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleShareToUser = async (recipientId: string) => {
		if (!currentUser || sharingTo) return;

		setSharingTo(recipientId);
		try {
			await shareGameToDM(gameId, currentUser.uid, recipientId);
			onClose();
		} catch (error) {
			console.error("[ShareToDMModal] Error sharing game:", error);
		} finally {
			setSharingTo(null);
		}
	};

	const renderUser = ({ item }: { item: UserSummary }) => {
		const isSharing = sharingTo === item.uid;

		return (
			<TouchableOpacity
				style={styles.userItem}
				onPress={() => handleShareToUser(item.uid)}
				disabled={isSharing}
				activeOpacity={0.7}
			>
				<View style={styles.userInfo}>
					{item.profilePicture ? (
						<Image
							source={{ uri: item.profilePicture }}
							style={styles.userAvatar}
						/>
					) : (
						<Ionicons
							name="person-circle"
							size={48}
							color={Colors.text.secondary}
						/>
					)}
					<View style={styles.userDetails}>
						<Text style={styles.username}>{item.username || "user"}</Text>
						{item.bio && (
							<Text style={styles.bio} numberOfLines={1}>
								{item.bio}
							</Text>
						)}
					</View>
				</View>
				{isSharing ? (
					<ActivityIndicator size="small" color={Colors.accent} />
				) : (
					<Ionicons
						name="chevron-forward"
						size={20}
						color={Colors.text.secondary}
					/>
				)}
			</TouchableOpacity>
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={true}
			onRequestClose={onClose}
		>
			<View style={styles.modalContainer}>
				<View
					style={[
						styles.modalContent,
						{ paddingBottom: insets.bottom + Spacing.md },
					]}
				>
					{/* Header */}
					<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
						<Text style={styles.headerTitle}>Share to</Text>
						<TouchableOpacity onPress={onClose} style={styles.closeButton}>
							<Ionicons name="close" size={24} color={Colors.text.primary} />
						</TouchableOpacity>
					</View>

					{/* Users List */}
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={Colors.accent} />
						</View>
					) : (
						<FlatList
							data={mutualFollowers}
							renderItem={renderUser}
							keyExtractor={(item) => item.uid}
							contentContainerStyle={styles.usersList}
							ListEmptyComponent={
								<View style={styles.emptyContainer}>
									<Ionicons
										name="people-outline"
										size={48}
										color={Colors.text.secondary}
									/>
									<Text style={styles.emptyText}>
										No mutual followers
									</Text>
									<Text style={styles.emptySubtext}>
										Follow users who follow you back to share games with them
									</Text>
								</View>
							}
						/>
					)}
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: Colors.background.primary,
		borderTopLeftRadius: BorderRadius.xl,
		borderTopRightRadius: BorderRadius.xl,
		maxHeight: "80%",
		...Shadows.heavy,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Layout.margin,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	headerTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	loadingContainer: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	usersList: {
		padding: Layout.margin,
	},
	userItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "#F0F0F0",
	},
	userInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
		gap: Spacing.md,
	},
	userAvatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
	},
	userDetails: {
		flex: 1,
	},
	username: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginBottom: Spacing.xxs,
	},
	bio: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
	},
	emptyContainer: {
		padding: Spacing.xl,
		alignItems: "center",
	},
	emptyText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginTop: Spacing.md,
		marginBottom: Spacing.xs,
	},
	emptySubtext: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		textAlign: "center",
	},
});

export default ShareToDMModal;

