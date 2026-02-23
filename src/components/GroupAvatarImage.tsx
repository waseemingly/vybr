/**
 * Renders a group avatar image. If the image is E2E encrypted (new uploads),
 * fetches and decrypts it. Falls back to raw URL for legacy unencrypted avatars.
 */
import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { ChatImageContent } from '@/components/ChatImageContent';

type GroupAvatarImageProps = {
  imageUrl: string | null | undefined;
  groupId: string | undefined;
  currentUserId: string | undefined;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
};

export const GroupAvatarImage: React.FC<GroupAvatarImageProps> = ({
  imageUrl,
  groupId,
  currentUserId,
  style,
  onError,
}) => {
  return (
    <ChatImageContent
      imageUrl={imageUrl}
      contentFormat="e2e"
      context={currentUserId && groupId ? { type: 'group', userId: currentUserId, groupId } : null}
      style={style}
      onError={onError}
    />
  );
};
