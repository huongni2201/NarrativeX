import "./gemini-web-automation";

declare module "./gemini-web-automation" {
  interface GeminiWebReferenceFile {
    referenceRole?: string | null;
    priority?: number;
    contentType?: string | null;
    sha256?: string | null;
  }
}

export {};
