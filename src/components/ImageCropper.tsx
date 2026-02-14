import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import Cropper from 'react-easy-crop';
import { Feather } from '@expo/vector-icons';
import { APP_CONSTANTS } from '../config/constants';

interface ImageCropperProps {
  visible: boolean;
  imageUri: string;
  aspectRatio: [number, number]; // [width, height] ratio like [1, 1] or [4, 5]
  onCrop: (croppedImageUri: string, croppedBase64: string) => void;
  onCancel: () => void;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  visible,
  imageUri,
  aspectRatio,
  onCrop,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: CroppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 1));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: CroppedAreaPixels,
  ): Promise<{ uri: string; base64: string }> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Set canvas size to the cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert to blob and create object URL
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        
        const croppedImageUri = URL.createObjectURL(blob);
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({ uri: croppedImageUri, base64: base64String });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;

    try {
      const { uri, base64 } = await getCroppedImg(imageUri, croppedAreaPixels);
      onCrop(uri, base64);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  }, [croppedAreaPixels, imageUri, onCrop]);

  if (Platform.OS !== 'web') {
    return null; // Only render on web for now
  }

  const calculatedAspectRatio = aspectRatio[0] / aspectRatio[1];

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
              <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
                <Feather name="zoom-in" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={handleZoomReset}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cropContainer}>
            <Cropper
              image={imageUri}
              crop={crop}
              zoom={zoom}
              aspect={calculatedAspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: {
                  backgroundColor: '#f0f0f0',
                },
                cropAreaStyle: {
                  border: '2px solid #fff',
                },
              }}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.helpText}>
              💡 Drag to reposition • Scroll or pinch to zoom
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cropButton} onPress={handleCrop}>
              <Text style={styles.cropButtonText}>Crop & Save</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 600,
    height: '85%',
    maxHeight: 700,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  } as any,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  } as any,
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as any,
  zoomButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'center',
  } as any,
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  cropContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  } as any,
  footer: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  } as any,
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  } as any,
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#6B7280',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cropButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    alignItems: 'center',
  },
  cropButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ImageCropper;
