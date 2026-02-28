// utils/mediaCompressor.web.ts
import { Platform } from 'react-native';

type MediaType = 'photo' | 'video';
type CompressionOptions = {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    videoBitrate?: number;
};

export class MediaCompressor {
    static async compressImage(
        uri: string,
        options: CompressionOptions = {}
    ): Promise<string> {
        // Web implementation: skip compression during SSR
        // In browser, we could use Canvas, but returning URI is safest for SSR
        return uri;
    }

    static async compressVideo(
        uri: string,
        options: CompressionOptions = {}
    ): Promise<string> {
        return uri;
    }

    static async compressMedia(
        uri: string,
        type: MediaType,
        options: CompressionOptions = {}
    ): Promise<{ uri: string; size?: number; compressedSize?: number }> {
        return {
            uri: uri,
            size: 0,
            compressedSize: 0,
        };
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

        const finalFileName = fileName ||
            `${mediaType}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;

        return {
            uri: uri,
            type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
            fileName: finalFileName,
        };
    }
}
