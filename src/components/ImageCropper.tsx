import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { APP_CONSTANTS } from '../config/constants';

interface ImageCropperProps {
  visible: boolean;
  imageUri: string;
  aspectRatio: [number, number]; // [width, height] ratio like [1, 1] or [4, 5]
  onCrop: (croppedImageUri: string, croppedBase64: string) => void;
  onCancel: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ImageCropper: React.FC<ImageCropperProps> = ({
  visible,
  imageUri,
  aspectRatio,
  onCrop,
  onCancel,
}) => {
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1); // Add scale state for zoom
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // Add pan offset for zoomed images
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Initialize crop area when image loads
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const maxWidth = Math.min(containerRect.width * 0.8, 400);
      const maxHeight = Math.min(containerRect.height * 0.6, 400);
      
      // Calculate crop size based on aspect ratio
      const [ratioWidth, ratioHeight] = aspectRatio;
      let cropWidth, cropHeight;
      
      if (ratioWidth / ratioHeight > maxWidth / maxHeight) {
        cropWidth = maxWidth;
        cropHeight = (maxWidth * ratioHeight) / ratioWidth;
      } else {
        cropHeight = maxHeight;
        cropWidth = (maxHeight * ratioWidth) / ratioHeight;
      }
      
      setCropArea({
        x: (containerRect.width - cropWidth) / 2,
        y: (containerRect.height - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      });
    }
  }, [aspectRatio]);

  // Zoom controls
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.2, 0.5); // Min zoom 0.5x
      // Reset pan if zooming out too much
      if (newScale <= 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleZoomReset = () => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  // Pan functionality for zoomed images
  const handleImageMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true);
      const startX = e.clientX - panOffset.x;
      const startY = e.clientY - panOffset.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = moveEvent.clientX - startX;
        const newY = moveEvent.clientY - startY;
        
        // Limit pan to reasonable bounds
        const maxPan = 100 * (scale - 1);
        setPanOffset({
          x: Math.max(-maxPan, Math.min(maxPan, newX)),
          y: Math.max(-maxPan, Math.min(maxPan, newY)),
        });
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  }, [scale, panOffset]);

  // Crop area dragging
  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent image panning when dragging crop area
    setIsDragging(true);
    const startX = e.clientX - cropArea.x;
    const startY = e.clientY - cropArea.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(containerRect.width - cropArea.width, moveEvent.clientX - containerRect.left - startX));
        const newY = Math.max(0, Math.min(containerRect.height - cropArea.height, moveEvent.clientY - containerRect.top - startY));
        
        setCropArea(prev => ({ ...prev, x: newX, y: newY }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cropArea]);

  const handleCrop = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const image = imageRef.current;
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Calculate the actual image dimensions vs displayed dimensions
      const displayedWidth = image.offsetWidth * scale;
      const displayedHeight = image.offsetHeight * scale;
      const scaleX = image.naturalWidth / displayedWidth;
      const scaleY = image.naturalHeight / displayedHeight;
      
      // Calculate image position accounting for pan offset
      const imageX = (containerRect.width - displayedWidth) / 2 + panOffset.x;
      const imageY = (containerRect.height - displayedHeight) / 2 + panOffset.y;
      
      // Calculate crop area relative to the actual image
      const cropX = Math.max(0, (cropArea.x - imageX) * scaleX);
      const cropY = Math.max(0, (cropArea.y - imageY) * scaleY);
      const cropWidth = Math.min(cropArea.width * scaleX, image.naturalWidth - cropX);
      const cropHeight = Math.min(cropArea.height * scaleY, image.naturalHeight - cropY);

      // Set canvas size to crop area
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw the cropped portion
      ctx.drawImage(
        image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      // Convert to blob and create object URL
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedImageUri = URL.createObjectURL(blob);
          
          // Convert to base64
          canvas.toBlob((base64Blob) => {
            if (base64Blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                onCrop(croppedImageUri, base64String);
              };
              reader.readAsDataURL(base64Blob);
            }
          }, 'image/jpeg', 0.9);
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  }, [cropArea, scale, panOffset, onCrop]);

  if (Platform.OS !== 'web') {
    return null; // Only render on web
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Crop Image</Text>
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
                <Feather name="zoom-out" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
              <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
                <Feather name="zoom-in" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={handleZoomReset}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <div 
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#f0f0f0',
            }}
            ref={containerRef}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={imageUri}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `scale(${scale}) translate(${panOffset.x / scale}px, ${panOffset.y / scale}px)`,
                cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                transition: isPanning ? 'none' : 'transform 0.2s ease',
                userSelect: 'none',
                pointerEvents: 'auto',
              }}
              onLoad={handleImageLoad}
              onMouseDown={handleImageMouseDown}
              draggable={false}
            />
            
            {/* Crop overlay */}
            <div
              style={{
                position: 'absolute',
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                border: '2px solid #fff',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                cursor: isDragging ? 'grabbing' : 'grab',
                pointerEvents: 'auto',
              }}
              onMouseDown={handleCropMouseDown}
            />
          </div>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cropButton} onPress={handleCrop}>
              <Text style={styles.cropButtonText}>Crop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 600,
    height: '80%',
    maxHeight: 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  } as any,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  } as any,
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as any,
  zoomButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  } as any,
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  } as any,
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  } as any,
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6B7280',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cropButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  cropButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ImageCropper; 