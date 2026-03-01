/**
 * Image that works with private Supabase storage buckets.
 * If the URI is from our Supabase storage, fetches via authenticated download
 * and displays the result; otherwise uses the URI as-is.
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
  // For storage URLs, start with null so we don't render the raw URL (fails with 400 on private buckets)
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
    getAuthenticatedStorageImageUri(sourceUri).then((uri) => {
      if (!cancelled && uri) setDisplayUri(uri);
      else if (!cancelled) setDisplayUri(sourceUri);
    }).catch(() => {
      if (!cancelled) setDisplayUri(sourceUri);
    });
    return () => { cancelled = true; };
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
