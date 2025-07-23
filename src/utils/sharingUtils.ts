import { Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface ShareOptions {
  title?: string;
  message?: string;
  url?: string;
  type?: string;
}

export const shareContent = async (options: ShareOptions): Promise<void> => {
  const { title = 'Shared Content', message = '', url, type = 'text/plain' } = options;

  try {
    if (Platform.OS === 'web') {
      // Web sharing using Web Share API
      if (navigator.share) {
        await navigator.share({
          title,
          text: message,
          url: url || window.location.href
        });
      } else {
        // Fallback for browsers without Web Share API
        if (url) {
          window.open(url, '_blank');
        } else {
          // Copy to clipboard fallback
          await copyToClipboard(message);
          Alert.alert('Copied', 'Content copied to clipboard');
        }
      }
    } else {
      // Mobile platforms - use URL schemes or fallback to clipboard
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          await copyToClipboard(url);
          Alert.alert('Copied', 'URL copied to clipboard');
        }
      } else {
        await copyToClipboard(message);
        Alert.alert('Copied', 'Content copied to clipboard');
      }
    }
  } catch (error) {
    console.error('Share failed:', error);
    Alert.alert('Share Failed', 'Could not share content');
  }
};

export const shareImage = async (imageUrl: string, title: string = 'Shared Image'): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      // Web sharing for images
      if (navigator.share) {
        await navigator.share({
          title,
          url: imageUrl
        });
      } else {
        // Fallback: open image in new tab
        window.open(imageUrl, '_blank');
      }
    } else {
      // Mobile: download and share via URL schemes
      const filename = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
      const fileUri = (FileSystem.cacheDirectory || '/tmp/') + filename;
      
      if (FileSystem.downloadAsync) {
        await FileSystem.downloadAsync(imageUrl, fileUri);
        
        // Try to open with system share intent via URL scheme
        const fileUrl = `file://${fileUri}`;
        const canOpen = await Linking.canOpenURL(fileUrl);
        
        if (canOpen) {
          await Linking.openURL(fileUrl);
        } else {
          // Fallback to copying image URL
          await copyToClipboard(imageUrl);
          Alert.alert('Copied', 'Image URL copied to clipboard');
        }
      } else {
        // Fallback to copying image URL
        await copyToClipboard(imageUrl);
        Alert.alert('Copied', 'Image URL copied to clipboard');
      }
    }
  } catch (error) {
    console.error('Image share failed:', error);
    Alert.alert('Share Failed', 'Could not share image');
  }
};

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      // Web clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } catch (err) {
          throw new Error('Copy command failed');
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } else {
      // Mobile platforms - we'll use a simple approach without native modules
      // For now, we'll show the text in an alert so user can copy manually
      Alert.alert(
        'Copy to Clipboard',
        `Please copy this text manually:\n\n${text}`,
        [
          { text: 'OK', style: 'default' }
        ]
      );
    }
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    Alert.alert('Copy Failed', 'Could not copy to clipboard');
  }
};

export const downloadImage = async (imageUrl: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      // Web download
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      Alert.alert('Download', 'File download started');
    } else {
      // Mobile: save to cache and show options
      const filename = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
      const fileUri = (FileSystem.cacheDirectory || '/tmp/') + filename;
      
      if (FileSystem.downloadAsync) {
        await FileSystem.downloadAsync(imageUrl, fileUri);
        Alert.alert(
          'Image Saved',
          `Image saved to: ${fileUri}`,
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Download Failed', 'Download not supported on this platform');
      }
    }
  } catch (error) {
    console.error('Download failed:', error);
    Alert.alert('Download Failed', 'Could not download image');
  }
}; 