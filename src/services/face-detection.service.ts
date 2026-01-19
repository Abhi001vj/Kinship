
import { Injectable } from '@angular/core';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import * as pdfjsLib from 'pdfjs-dist';

export interface DetectedFace {
  id: string;
  blob: Blob;
  url: string; // Object URL for display
  base64: string; // For API calls
  origin: string; // Original filename
}

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private faceDetector: FaceDetector | null = null;
  private isInitializing = false;

  constructor() {
    // Configure PDF.js worker
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  }

  async init() {
    if (this.faceDetector || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      this.faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
          delegate: "GPU"
        },
        runningMode: "IMAGE"
      });
      console.log('Face Detector Initialized');
    } catch (e) {
      console.error('Failed to init Face Detector', e);
    } finally {
      this.isInitializing = false;
    }
  }

  async processImage(file: File): Promise<DetectedFace[]> {
    if (!this.faceDetector) await this.init();
    if (!this.faceDetector) return [];

    const img = await this.loadImage(file);
    return this.detectAndExtract(img, file.name);
  }

  async processPdf(file: File): Promise<DetectedFace[]> {
    if (!this.faceDetector) await this.init();
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allFaces: DetectedFace[] = [];
    let extractedImagesCount = 0;

    console.log(`Processing PDF: ${file.name} with ${pdf.numPages} pages.`);

    // PHASE 1: Try to extract embedded images (Better quality, ignores layout)
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const images = await this.extractImagesFromPage(page);
        
        if (images.length > 0) {
            extractedImagesCount += images.length;
            for (const img of images) {
                const faces = await this.detectAndExtract(img, `${file.name}-img-${i}`);
                allFaces.push(...faces);
            }
        }
      }
    } catch (e) {
      console.warn('Direct image extraction encountered issues. Proceeding to fallback.', e);
    }

    // PHASE 2: Fallback to Page Rendering (300 DPI) if no faces found
    // We do this if extraction yielded no faces, implying the PDF might be scanned pages 
    // or the extraction failed to parse specific encodings.
    if (allFaces.length === 0) {
      console.log('No faces detected via extraction. Falling back to high-res page rendering (300 DPI).');
      
      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          // Standard screen DPI is 72. 300 DPI / 72 DPI ≈ 4.166.
          // We use 4.17 to ensure high clarity for the Face Detector.
          const viewport = page.getViewport({ scale: 4.17 }); 
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
              canvasContext: context,
              viewport: viewport
          }).promise;

          const img = new Image();
          img.src = canvas.toDataURL('image/jpeg', 0.8);
          await new Promise(r => img.onload = r);

          const faces = await this.detectAndExtract(img, `${file.name}-page-${i}`);
          allFaces.push(...faces);
      }
    } else {
        console.log(`Successfully extracted ${extractedImagesCount} images and found ${allFaces.length} faces without rendering pages.`);
    }

    return allFaces;
  }

  private async extractImagesFromPage(page: any): Promise<HTMLImageElement[]> {
     const ops = await page.getOperatorList();
     const images: HTMLImageElement[] = [];
     
     // Look for paintImageXObject operations
     for (let i = 0; i < ops.fnArray.length; i++) {
       if (ops.fnArray[i] === (pdfjsLib as any).OPS.paintImageXObject) {
         const opArg = ops.argsArray[i][0]; // ID of the image
         
         try {
             const imgObj = await page.objs.get(opArg);
             if (imgObj && (imgObj.data || imgObj.bitmap)) {
                const imgCanvas = document.createElement('canvas');
                imgCanvas.width = imgObj.width;
                imgCanvas.height = imgObj.height;
                const ctx = imgCanvas.getContext('2d');
                
                if(ctx) {
                    if (imgObj.bitmap) {
                        // If PDF.js returns a bitmap (modern browsers)
                        ctx.drawImage(imgObj.bitmap, 0, 0);
                    } else if (imgObj.data) {
                        // Construct ImageData
                        const imageData = ctx.createImageData(imgObj.width, imgObj.height);
                        
                        // Handle Color Spaces roughly
                        if (imgObj.kind === 'RGB') {
                           let j = 0;
                           for (let k = 0; k < imgObj.data.length; k+=3) {
                               imageData.data[j++] = imgObj.data[k];
                               imageData.data[j++] = imgObj.data[k+1];
                               imageData.data[j++] = imgObj.data[k+2];
                               imageData.data[j++] = 255; // Alpha
                           }
                        } else if (imgObj.kind === 'RGBA') {
                           imageData.data.set(imgObj.data);
                        } else if (imgObj.kind === 'Grayscale') {
                            let j = 0;
                           for (let k = 0; k < imgObj.data.length; k++) {
                               const val = imgObj.data[k];
                               imageData.data[j++] = val;
                               imageData.data[j++] = val;
                               imageData.data[j++] = val;
                               imageData.data[j++] = 255;
                           }
                        } else {
                            // Fallback for other formats (CMYK etc) - might look weird but better than nothing
                            // Just copy raw if size matches 4 bytes
                            if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                                imageData.data.set(imgObj.data);
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }
                    
                    const newImg = new Image();
                    newImg.src = imgCanvas.toDataURL();
                    await new Promise(r => newImg.onload = r);
                    images.push(newImg);
                }
             }
         } catch(e) {
            // Ignore individual image extraction failures
         }
       }
     }
     return images;
  }

  private async detectAndExtract(img: HTMLImageElement, originName: string): Promise<DetectedFace[]> {
    if (!this.faceDetector) return [];

    const detections = this.faceDetector.detect(img);
    const faces: DetectedFace[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return [];

    for (const detection of detections.detections) {
      const box = detection.boundingBox;
      if (!box) continue;

      const padding = 20;
      const x = Math.max(0, box.originX - padding);
      const y = Math.max(0, box.originY - padding);
      const w = Math.min(img.width - x, box.width + (padding * 2));
      const h = Math.min(img.height - y, box.height + (padding * 2));

      const size = Math.max(w, h);
      
      canvas.width = size;
      canvas.height = size;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, x, y, w, h, 0, 0, size, size);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        faces.push({
          id: crypto.randomUUID(),
          blob,
          url,
          base64,
          origin: originName
        });
      }
    }
    return faces;
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}
