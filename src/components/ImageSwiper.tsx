import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  ViewStyle,
  ImageStyle,
  StyleProp,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ImageSwiperProps {
  images: string[];
  defaultImage: string;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  height: number; // Explicit height required
}

const ImageSwiper: React.FC<ImageSwiperProps> = ({
  images,
  defaultImage,
  containerStyle,
  imageStyle,
  height,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = Dimensions.get('window'); // Use screen width for calculation initially

  // Determine the actual width based on container style if provided, otherwise fallback to screen width
  const resolvedStyle = StyleSheet.flatten(containerStyle);
  const containerWidth = typeof resolvedStyle?.width === 'number' ? resolvedStyle.width : width;

  const imageUris = images && images.length > 0 ? images : [defaultImage];

  const onScroll = (nativeEvent: any) => {
    if (nativeEvent) {
      const slide = Math.round(nativeEvent.contentOffset.x / containerWidth); // Use containerWidth
      if (slide !== currentImageIndex && slide >= 0 && slide < imageUris.length) {
        setCurrentImageIndex(slide);
      }
    }
  };

  const goToPrevious = () => {
    const newIndex = currentImageIndex - 1;
    if (newIndex >= 0) {
      scrollViewRef.current?.scrollTo({ x: containerWidth * newIndex, animated: true });
      // setCurrentImageIndex(newIndex); // Let onScroll handle index update for consistency
    }
  };

  const goToNext = () => {
    const newIndex = currentImageIndex + 1;
    if (newIndex < imageUris.length) {
      scrollViewRef.current?.scrollTo({ x: containerWidth * newIndex, animated: true });
      // setCurrentImageIndex(newIndex); // Let onScroll handle index update for consistency
    }
  };

  return (
    <View style={[styles.swiperContainer, { height: height }, containerStyle]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => onScroll(e.nativeEvent)}
        scrollEventThrottle={16} // throttle event frequency
        style={{ width: containerWidth, height: height }}
      >
        {imageUris.map((uri, index) => (
          <Image
            key={`${uri}-${index}`} // Use uri and index for key
            source={{ uri: uri }}
            style={[styles.image, { width: containerWidth, height: height }, imageStyle]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {imageUris.length > 1 && (
        <View style={styles.paginationContainer}>
          {imageUris.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentImageIndex ? styles.paginationDotActive : {},
              ]}
            />
          ))}
        </View>
      )}

      {/* Arrow Buttons (Web Only) */}
      {Platform.OS === 'web' && imageUris.length > 1 && (
        <>
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowLeft]}
            onPress={goToPrevious}
            disabled={currentImageIndex === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <Feather
              name="chevron-left"
              size={24} // Slightly smaller for cards
              color={currentImageIndex === 0 ? 'rgba(255, 255, 255, 0.3)' : '#FFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowRight]}
            onPress={goToNext}
            disabled={currentImageIndex === imageUris.length - 1}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <Feather
              name="chevron-right"
              size={24} // Slightly smaller for cards
              color={
                currentImageIndex === imageUris.length - 1
                  ? 'rgba(255, 255, 255, 0.3)'
                  : '#FFF'
              }
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  swiperContainer: {
    position: 'relative',
    backgroundColor: '#F3F4F6', // Default background
    overflow: 'hidden', // Ensure images don't bleed out
  },
  image: {
    // Basic image styles, height/width set dynamically
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 8, // Closer to bottom for cards
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  paginationDot: {
    width: 6, // Smaller dots for cards
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -16, // Adjust based on size (24) + padding
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 16,
    zIndex: 2,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
});

export default ImageSwiper; 