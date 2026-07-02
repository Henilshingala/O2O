/** Web implementation using hidden file inputs. */
type MediaType = "photo" | "video" | "mixed";

interface Asset {
  uri: string;
  type?: string;
  fileName?: string;
  fileSize?: number;
}

interface ImagePickerResponse {
  didCancel?: boolean;
  assets?: Asset[];
}

function pickFiles(mediaType: MediaType): Promise<ImagePickerResponse> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    if (mediaType === "photo") input.accept = "image/*";
    else if (mediaType === "video") input.accept = "video/*";
    else input.accept = "image/*,video/*,application/*";

    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) {
        resolve({ didCancel: true });
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({
        assets: [{
          uri,
          type: file.type,
          fileName: file.name,
          fileSize: file.size,
        }],
      });
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve({ didCancel: true });
    };

    document.body.appendChild(input);
    input.click();
  });
}

export async function launchImageLibrary(options?: { mediaType?: MediaType; quality?: number }) {
  return pickFiles(options?.mediaType ?? "photo");
}

export async function launchCamera(options?: { mediaType?: MediaType; quality?: number }) {
  return pickFiles(options?.mediaType ?? "photo");
}
