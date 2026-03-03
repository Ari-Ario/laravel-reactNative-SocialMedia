// utils/mediaCompressor.web.ts
import { Platform } from 'react-native';

type MediaType = 'photo' | 'video';
type CompressionOptions = {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    videoBitrate?: number;
};

const TWO_MB = 2 * 1024 * 1024;

export class MediaCompressor {
    static async compressImage(
        uri: string,
        options: CompressionOptions = {}
    ): Promise<string> {
        if (typeof window === 'undefined') return uri;

        const maxWidth = options.maxWidth || 1080;
        const initialQuality = options.quality || 0.8;

        try {
            // 1. Fetch the image to check size
            const response = await fetch(uri);
            const blob = await response.blob();

            // USER REQ: Only reduce if more than 2 MB
            if (blob.size <= TWO_MB && !options.maxWidth) {
                return uri;
            }

            // 2. Load into an Image object
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate dimensions
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(uri);

                    ctx.drawImage(img, 0, 0, width, height);

                    // Iterative compression for Web
                    let quality = initialQuality;

                    const attemptCompression = (q: number) => {
                        canvas.toBlob((resultBlob) => {
                            if (!resultBlob) return resolve(uri);

                            // If still too big and we can drop quality more
                            if (resultBlob.size > TWO_MB && q > 0.1) {
                                attemptCompression(q - 0.15);
                            } else {
                                resolve(URL.createObjectURL(resultBlob));
                            }
                        }, 'image/jpeg', q);
                    };

                    attemptCompression(quality);
                };
                img.onerror = () => resolve(uri);
                img.src = uri;
            });

        } catch (err) {
            console.error('Web image compression error:', err);
            return uri;
        }
    }

    static async compressVideo(
        uri: string,
        options: CompressionOptions = {}
    ): Promise<string> {
        // Broadly speaking, web video compression requires complex client-side setups (ffmpeg.wasm).
        // Returning URI and relying on cloud or backend processing if possible.
        return uri;
    }

    static async compressMedia(
        uri: string,
        type: MediaType,
        options: CompressionOptions = {}
    ): Promise<{ uri: string; size?: number; compressedSize?: number }> {
        if (type === 'photo') {
            const compressedUri = await this.compressImage(uri, options);
            return { uri: compressedUri, size: 0, compressedSize: 0 };
        }
        return {
            uri: uri,
            size: 0,
            compressedSize: 0,
        };
    }

    static getMediaTypeFromUri(uri: string): MediaType {
        if (uri.startsWith('blob:')) {
            // For blobs on web, checking extension isn't always possible. 
            // In AdvancedMediaUploader, we usually know the type from the picker.
            // This is a crude fallback.
            return 'photo';
        }
        const extension = uri.split('.').pop()?.toLowerCase();
        const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'];

        return videoExtensions.includes(extension || '') ? 'video' : 'photo';
    }

    static async prepareMediaForUpload(
        uri: string,
        fileName?: string
    ): Promise<{ uri: string; type: string; fileName: string }> {
        const mediaType = this.getMediaTypeFromUri(uri);

        let finalUri = uri;
        if (mediaType === 'photo') {
            finalUri = await this.compressImage(uri, { maxWidth: 1080, quality: 0.8 });
        }

        const finalFileName = fileName ||
            `${mediaType}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;

        return {
            uri: finalUri,
            type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
            fileName: finalFileName,
        };
    }
}
