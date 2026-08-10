import { config } from "./config";
import { fetchUrlWithLimit } from "./ssrf";

export async function loadFileBytes(input: {
  fileBase64?: string;
  fileUrl?: string;
  filename: string;
}): Promise<{ bytes: Uint8Array; filename: string }> {
  if (input.fileBase64) {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(input.fileBase64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Invalid fileBase64");
    }
    if (bytes.byteLength > config.maxUploadBytes) {
      throw new Error(
        `File exceeds max size of ${config.maxUploadBytes} bytes`,
      );
    }
    return { bytes, filename: input.filename };
  }

  if (input.fileUrl) {
    const bytes = await fetchUrlWithLimit(
      input.fileUrl,
      config.maxUploadBytes,
    );
    return { bytes, filename: input.filename };
  }

  throw new Error("Provide fileBase64 or fileUrl");
}

export function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}
