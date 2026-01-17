
export const fileToBase64 = (file: File): Promise<{ base64Data: string; mimeType: string; }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({ base64Data, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getMediaDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("File not provided."));
    }
    const url = URL.createObjectURL(file);
    const mediaElement = document.createElement(
      file.type.startsWith('video/') ? 'video' : 'audio'
    );
    // Hide the element so it doesn't appear in the DOM
    mediaElement.style.display = 'none';

    const onLoadedMetadata = () => {
      resolve(mediaElement.duration);
      cleanup();
    };

    const onError = () => {
      reject(new Error('Could not load media metadata. The file may be corrupt or in an unsupported format.'));
      cleanup();
    };

    const cleanup = () => {
        mediaElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        mediaElement.removeEventListener('error', onError);
        document.body.removeChild(mediaElement);
        URL.revokeObjectURL(url);
    }

    mediaElement.addEventListener('loadedmetadata', onLoadedMetadata);
    mediaElement.addEventListener('error', onError);

    mediaElement.src = url;
    document.body.appendChild(mediaElement); // Element needs to be in the DOM to load in some browsers
  });
};
