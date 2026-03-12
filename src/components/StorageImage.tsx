/**
 * Image that works with private Supabase storage buckets.
 * For Supabase storage URLs, uses signed URLs so private buckets work on web and native
 * (React Native Image cannot send auth headers; signed URLs avoid data-URI issues on Android).
 */
import React, { useState, useEffect } from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';
import { getAuthenticatedStorageImageUri } from '@/lib/e2e/e2eService';

const SUPABASE_STORAGE_REGEX = /\/storage\/v1\/object\/(?:public|authenticated)\//;

type StorageImageProps = {
  sourceUri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onError?: () => void;
};

export const StorageImage: React.FC<StorageImageProps> = ({
  sourceUri,
  style,
  resizeMode = 'cover',
  onError,
}) => {
  // For storage URLs, start with null so we don't render the raw URL (fails on private buckets)
  const [displayUri, setDisplayUri] = useState<string | null>(() => {
    if (!sourceUri) return null;
    if (SUPABASE_STORAGE_REGEX.test(sourceUri)) return null;
    return sourceUri;
  });

  useEffect(() => {
    if (!sourceUri) {
      setDisplayUri(null);
      return;
    }
    const isOurStorage = SUPABASE_STORAGE_REGEX.test(sourceUri);
    if (!isOurStorage) {
      setDisplayUri(sourceUri);
      return;
    }
    let cancelled = false;
    getAuthenticatedStorageImageUri(sourceUri)
      .then((uri) => {
        if (!cancelled && uri) setDisplayUri(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sourceUri]);

  if (!displayUri) return null;
  return (
    <Image
      source={{ uri: displayUri }}
      style={style}
      resizeMode={resizeMode}
      onError={onError}
    />
  );
};
