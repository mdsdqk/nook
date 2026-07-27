import type { DetectionResult } from "@nook/contracts";
import { PdfReader } from "@nook/readers";
import { BankDetector } from "@nook/detectors";

export async function detectFile(
  path: string,
): Promise<DetectionResult | null> {
  const reader = new PdfReader();
  const doc = await reader.read(path);
  const detector = new BankDetector();
  return detector.detect(doc);
}
