import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageImage } from '@/components/StorageImage';
import { WebNotificationProps } from '../context/NotificationContext';

const { width: screenWidth } = Dimensions.get('window');

interface WebNotificationComponentProps extends WebNotificationProps {
  index: number;
}

const WebNotification: React.FC<WebNotificationComponentProps> = ({
  id,
  title,
  body,
  type,
  data,
  image_url,
  timestamp,
  index,
  onRead,
  onDismiss,
  onClick,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenWidth));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const handleDismiss = () => {
    // Slide out animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handleClick = () => {
    onClick?.();
    // Mark as read when clicked
    onRead?.();
  };

  const getIcon = () => {
    switch (type) {
      case 'new_message':
      case 'new_group_message':
        return 'chatbubble';
      case 'new_match':
        return 'heart';
      case 'event_alert':
        return 'calendar';
      case 'booking_confirmation':
        return 'checkmark-circle';
      case 'system_alert':
        return 'notifications';
      default:
        return 'notifications';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'new_message':
      case 'new_group_message':
        return '#007AFF';
      case 'new_match':
        return '#FF3B30';
      case 'event_alert':
        return '#FF9500';
      case 'booking_confirmation':
        return '#34C759';
      case 'system_alert':
        return '#8E8E93';
      default:
        return '#007AFF';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
          top: 60 + (index * 90), // Stack notifications
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notification}
        onPress={handleClick}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {image_url ? (
              <StorageImage sourceUri={image_url} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.iconBackground, { backgroundColor: getIconColor() + '15' }]}>
                <Ionicons name={getIcon()} size={20} color={getIconColor()} />
              </View>
            )}
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(timestamp)}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#8E8E93" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    left: 16,
    zIndex: 1000,
  },
  notification: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  dismissButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default WebNotification; 