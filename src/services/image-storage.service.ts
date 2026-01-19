
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageStorageService {

  /**
   * CLOUD DEPLOYMENT NOTE:
   * To use Google Cloud Storage (GCS):
   * 1. Change this method to accept the File/Blob.
   * 2. Request a specific "Signed URL" from your backend for PUT access.
   * 3. Fetch/PUT the file to that URL.
   * 4. Return the public (or signed GET) URL of the uploaded asset.
   */
  async uploadImage(blobOrBase64: Blob | string): Promise<string> {
    // START: Local Simulation (Keep this for the demo)
    if (typeof blobOrBase64 === 'string') {
        return blobOrBase64; // Already base64
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blobOrBase64);
    });
    // END: Local Simulation
  }

  /**
   * Helper to convert base64 to Blob if needed for Cloud Upload
   */
  base64ToBlob(base64: string): Blob {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  }
}
