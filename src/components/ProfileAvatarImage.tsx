/**
 * Renders a profile picture. When profileUserId === currentUserId (viewing own profile),
 * attempts to decrypt E2E profile images. Otherwise shows the URL as-is (legacy or others' pics).
 */
import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { ChatImageContent } from '@/components/ChatImageContent';

type ProfileAvatarImageProps = {
  imageUrl: string | null | undefined;
  profileUserId: string | undefined;
  currentUserId: string | undefined;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
};

export const ProfileAvatarImage: React.FC<ProfileAvatarImageProps> = ({
  imageUrl,
  profileUserId,
  currentUserId,
  style,
  onError,
}) => {
  const isOwnProfile = profileUserId && currentUserId && profileUserId === currentUserId;
  return (
    <ChatImageContent
      imageUrl={imageUrl}
      contentFormat={isOwnProfile ? 'e2e' : 'plain'}
      context={isOwnProfile && currentUserId ? { type: 'profile', userId: currentUserId } : null}
      style={style}
      onError={onError}
    />
  );
};
