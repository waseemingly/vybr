/**
 * Renders a chat message image. If contentFormat is e2e, fetches the encrypted
 * blob and decrypts it before displaying.
 */
import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleProp, ImageStyle } from 'react-native';
import { getDecryptedImageUri } from '@/lib/e2e/e2eService';
import type { E2EContext } from '@/lib/e2e/e2eService';

export type ChatImageContentProps = {
  imageUrl: string | null | undefined;
  contentFormat?: string | null;
  context: E2EContext | null;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
};

export const ChatImageContent: React.FC<ChatImageContentProps> = ({
  imageUrl,
  contentFormat,
  context,
  style,
  onError,
}) => {
  const [displayUri, setDisplayUri] = useState<string | null>(imageUrl ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setDisplayUri(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDecryptedImageUri(imageUrl, contentFormat, context)
      .then((uri) => {
        if (cancelled) return;
        setDisplayUri(uri ?? imageUrl);
        if (!uri) onError?.();
      })
      .catch(() => {
        if (!cancelled) onError?.();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, contentFormat, context]);

  if (!imageUrl) return null;
  if (loading) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', minHeight: 120 }]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }
  if (!displayUri) return null;
  return (
    <Image
      source={{ uri: displayUri }}
      style={style}
      resizeMode="cover"
      onError={onError}
    />
  );
};
