import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import AppleMusicTest from '@/components/AppleMusicTest';
import AppleMusicIntegration from '@/components/AppleMusicIntegration';

const AppleMusicTestPage: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <AppleMusicTest />
        <AppleMusicIntegration 
          onDataUpdated={() => {
            console.log('Apple Music data updated');
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 10,
  },
});

export default AppleMusicTestPage;