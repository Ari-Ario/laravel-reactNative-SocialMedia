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
        fileName?: string,
        type?: MediaType
    ): Promise<{ uri: string; type: string; fileName: string }> {
        const mediaType = type || this.getMediaTypeFromUri(uri);

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

    /**
     * Hardened video duration prober for web (mobile Safari/Chrome safe).
     *
     * Key fixes (based on expo-image-picker ExponentImagePicker.web.ts source study):
     *  1. muted + playsInline + webkit-playsinline: required on iOS Safari for the
     *     media pipeline to initialize without a user-gesture interaction.
     *  2. video.load() called explicitly after setting .src: Safari requires this;
     *     without it onloadedmetadata NEVER fires on blob: URIs or large files.
     *  3. Returns seconds (not ms) — raw browser standard. Callers convert as needed.
     *  4. Returns Infinity for unseekable MediaRecorder blobs so callers can route to trimmer.
     *  5. 8-second safety timeout prevents UI hangs on constrained 4G connections.
     */
    static getVideoDuration(uri: string, timeoutMs = 8000): Promise<number> {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(0);

            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');

            let settled = false;
            const done = (val: number) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                video.onloadedmetadata = null;
                video.onerror = null;
                video.src = '';
                try { video.load(); } catch (_) {}
                resolve(val);
            };

            const timer = setTimeout(() => {
                console.warn('[MediaCompressor] Duration probe timed out:', uri);
                done(0);
            }, timeoutMs);

            video.onloadedmetadata = () => {
                // duration in SECONDS (browser standard). Infinity = unseekable stream.
                done(isNaN(video.duration) ? 0 : video.duration);
            };
            video.onerror = () => done(0);

            video.src = uri;
            video.load(); // mandatory on iOS Safari
        });
    }

    /**
     * Hardened thumbnail generator for web.
     * Returns a JPEG data URL or null on failure/timeout.
     */
    static generateThumbnail(uri: string, timeoutMs = 10000): Promise<string | null> {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(null);

            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            // crossOrigin only for remote URLs — blob: URIs break with it on Safari
            if (!uri.startsWith('blob:')) video.crossOrigin = 'anonymous';

            let settled = false;
            const done = (val: string | null) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                video.onseeked = null;
                video.onloadedmetadata = null;
                video.onerror = null;
                video.src = '';
                try { video.load(); } catch (_) {}
                resolve(val);
            };

            const timer = setTimeout(() => {
                console.warn('[MediaCompressor] Thumbnail probe timed out:', uri);
                done(null);
            }, timeoutMs);

            video.onloadedmetadata = () => {
                // Seek to 0.5s or 10% into the video to avoid a black first frame
                video.currentTime = Math.min(0.5, isFinite(video.duration) ? video.duration * 0.1 : 0.5);
            };

            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 320;
                    canvas.height = video.videoHeight || 240;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        done(canvas.toDataURL('image/jpeg', 0.7));
                    } else {
                        done(null);
                    }
                } catch (e) {
                    console.warn('[MediaCompressor] Thumbnail canvas failed:', e);
                    done(null);
                }
            };

            video.onerror = () => done(null);

            video.src = uri;
            video.load(); // mandatory on iOS Safari
        });
    }

    /**
     * Revokes a blob: URL to free browser memory.
     * Safe no-op for non-blob URIs or when called on server.
     */
    static cleanupMedia(uri: string | null | undefined): void {
        if (uri && uri.startsWith('blob:') && typeof window !== 'undefined') {
            try { URL.revokeObjectURL(uri); } catch (_) {}
        }
    }
}
