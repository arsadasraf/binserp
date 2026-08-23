/**
 * Client-Side Image Compression Utility
 * Resizes and compresses image files or base64 data URLs using HTML5 Canvas
 * to prevent heavy payloads, memory spikes, and MongoDB 16MB document limits.
 */

export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0.1 to 1.0 (default 0.8)
    mimeType?: string; // 'image/jpeg' | 'image/webp'
}

/**
 * Compresses an image File or Base64 data URL string.
 * @param input - File object or Base64 string (e.g. data:image/png;base64,...)
 * @param options - Compression settings (default: max 1280px, 80% JPEG quality)
 * @returns Promise<string> - Compressed Base64 JPEG data URL
 */
export async function compressImage(
    input: File | string,
    options: CompressOptions = {}
): Promise<string> {
    const {
        maxWidth = 1280,
        maxHeight = 1280,
        quality = 0.8,
        mimeType = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            try {
                let { width, height } = img;

                // Calculate aspect-ratio-preserving dimensions
                if (width > maxWidth || height > maxHeight) {
                    const widthRatio = maxWidth / width;
                    const heightRatio = maxHeight / height;
                    const ratio = Math.min(widthRatio, heightRatio);

                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Create canvas for rendering
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    // Fallback to original if context not supported
                    if (typeof input === 'string') {
                        return resolve(input);
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error('Failed to read image file'));
                    return reader.readAsDataURL(input);
                }

                // Fill background with white in case of transparent PNG conversion to JPEG
                if (mimeType === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL(mimeType, quality);
                resolve(compressedBase64);
            } catch (err) {
                console.error('Image compression error, falling back to original:', err);
                if (typeof input === 'string') {
                    resolve(input);
                } else {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => reject(err);
                    reader.readAsDataURL(input);
                }
            }
        };

        img.onerror = (err) => {
            console.error('Failed to load image for compression:', err);
            reject(new Error('Failed to load image for compression'));
        };

        // Source input handling
        if (typeof input === 'string') {
            img.src = input;
        } else {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    img.src = reader.result;
                } else {
                    reject(new Error('FileReader did not return a valid string'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file from disk'));
            reader.readAsDataURL(input);
        }
    });
}
