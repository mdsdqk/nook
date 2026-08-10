import type { DetectionResult } from "@nook/contracts";
import { PdfReader } from "@nook/readers";
import { BankDetector } from "@nook/detectors";

export async function detectBytes(
  bytes: Uint8Array,
): Promise<DetectionResult | null> {
  const reader = new PdfReader();
  const doc = await reader.readBytes(bytes);
  const detector = new BankDetector();
  return detector.detect(doc);
}
