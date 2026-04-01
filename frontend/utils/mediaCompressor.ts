// utils/mediaCompressor.ts
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type MediaType = 'photo' | 'video';
type CompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  videoBitrate?: number; // For video compression (bits per second)
};

const TWO_MB = 2 * 1024 * 1024;
const NINETEEN_HUNDRED_KB = 1.9 * 1024 * 1024;

export class MediaCompressor {
  static async compressImage(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      maxWidth: 1080, // Cap at 1080p per user req
      quality: 0.8,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const fileInfo = await FileSystem.getInfoAsync(uri) as any;
      if (!fileInfo.exists) return uri;

      let sizeBytes = fileInfo.size || 0;

      // USER REQ: Only reduce if more than 2 MB
      if (sizeBytes <= TWO_MB && !options.maxWidth) {
        return uri;
      }

      let currentQuality = finalOptions.quality;
      let currentWidth = finalOptions.maxWidth;
      let resultUri = uri;

      // Aggressive compression loop to stay under 2MB
      // USER REQ: Laravel limit is 2MB, so we target 1.8MB for safety
      const SAFE_LIMIT = 1.8 * 1024 * 1024;

      for (let attempt = 0; attempt < 6; attempt++) {
        const fileInfo = await FileSystem.getInfoAsync(resultUri) as any;
        if (fileInfo.size <= SAFE_LIMIT && attempt > 0) break;
        if (fileInfo.size <= TWO_MB && !options.maxWidth && attempt === 0) return uri;

        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: currentWidth } }],
          {
            compress: currentQuality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        resultUri = result.uri;
        const newFileInfo = await FileSystem.getInfoAsync(resultUri) as any;
        
        if (newFileInfo.size <= SAFE_LIMIT) break;

        // More aggressive drops
        currentQuality = Math.max(0.1, currentQuality - 0.2);
        currentWidth = Math.floor(currentWidth * 0.7);
      }

      return resultUri;
    } catch (error) {
      console.error('Image compression failed:', error);
      return uri;
    }
  }

  static async compressVideo(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<string> {
    // Note: Standard Expo doesn't have a high-level video compressor.
    // We rely on ImagePicker.launchImageLibraryAsync with videoExportPreset 
    // and videoQuality: Medium/Low which handles the social media standards.
    // However, we can check the size here.
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri) as any;
      if (fileInfo.size > TWO_MB) {
        console.warn(`Video is over 2MB (${(fileInfo.size / 1024 / 1024).toFixed(2)}MB). Ensure it's trimmed and quality is reduced.`);
      }
    } catch (e) {}
    
    return uri;
  }

  static async compressMedia(
    uri: string,
    type: MediaType,
    options: CompressionOptions = {}
  ): Promise<{ uri: string; size?: number; compressedSize?: number }> {
    try {
      if (Platform.OS === 'web') {
        return { uri, size: 0, compressedSize: 0 };
      }

      const fileInfo = await FileSystem.getInfoAsync(uri) as any;
      const originalSize = fileInfo.size || 0;

      let compressedUri = uri;

      if (type === 'photo') {
        compressedUri = await this.compressImage(uri, options);
      } else if (type === 'video') {
        compressedUri = await this.compressVideo(uri, options);
      }

      // Get compressed file size
      const compressedInfo = await FileSystem.getInfoAsync(compressedUri) as any;
      const compressedSize = compressedInfo.size || 0;

      console.log(
        `Compressed ${type}: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
      );

      return {
        uri: compressedUri,
        size: originalSize,
        compressedSize,
      };
    } catch (error) {
      console.error('Media compression failed:', error);
      return { uri };
    }
  }

  static getMediaTypeFromUri(uri: string): MediaType {
    const extension = uri.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'];

    return videoExtensions.includes(extension || '') ? 'video' : 'photo';
  }

  static async prepareMediaForUpload(
    uri: string,
    fileName?: string
  ): Promise<{ uri: string; type: string; fileName: string }> {
    const mediaType = this.getMediaTypeFromUri(uri);

    const compressed = await this.compressMedia(uri, mediaType, {
      maxWidth: 1080, // Cap at 1080p
      quality: 0.8,
    });

    const finalFileName = fileName ||
      `${mediaType}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;

    return {
      uri: compressed.uri,
      type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      fileName: finalFileName,
    };
  }
}