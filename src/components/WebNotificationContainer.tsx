import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { NotificationContext } from '../context/NotificationContext';
import WebNotification from './WebNotification';

const WebNotificationContainer: React.FC = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  const { webNotifications } = ctx;

  if (webNotifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {webNotifications.map((notification, index) => (
        <WebNotification
          key={notification.id}
          {...notification}
          index={index}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});

export default WebNotificationContainer; 