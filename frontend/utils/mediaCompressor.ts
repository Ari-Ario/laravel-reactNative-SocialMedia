// utils/mediaCompressor.ts
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

type MediaType = 'photo' | 'video';
type CompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  videoBitrate?: number; // For video compression (bits per second)
};

export class MediaCompressor {
  static async compressImage(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.7,
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: finalOptions.maxWidth,
              height: finalOptions.maxHeight,
            },
          },
        ],
        {
          compress: finalOptions.quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Image compression failed:', error);
      return uri; // Return original if compression fails
    }
  }

  static async compressVideo(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      videoBitrate: 2000000, // 2 Mbps
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // On native, we can't easily compress video without additional libraries
    // For now, we'll just return the original URI
    // In production, consider using a library like ffmpeg-kit-react-native
    
    console.log('Video compression not fully implemented. Using original video.');
    return uri;
    
    // For web, we could use the browser's MediaRecorder API
    // For native, you'd need to implement with ffmpeg or similar
  }

  static async compressMedia(
    uri: string,
    type: MediaType,
    options: CompressionOptions = {}
  ): Promise<{ uri: string; size?: number; compressedSize?: number }> {
    try {
      // Get original file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const originalSize = fileInfo.size || 0;
      
      let compressedUri = uri;
      
      if (type === 'photo') {
        compressedUri = await this.compressImage(uri, options);
      } else if (type === 'video') {
        compressedUri = await this.compressVideo(uri, options);
      }
      
      // Get compressed file size
      const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
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
      return { uri }; // Return original if compression fails
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
    // Determine media type
    const mediaType = this.getMediaTypeFromUri(uri);
    
    // Compress the media
    const compressed = await this.compressMedia(uri, mediaType, {
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.7,
    });
    
    // Generate filename if not provided
    const finalFileName = fileName || 
      `${mediaType}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
    
    return {
      uri: compressed.uri,
      type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      fileName: finalFileName,
    };
  }
}