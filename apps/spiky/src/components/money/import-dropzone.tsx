import { useId, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_IMPORT_POLICY,
  filterStatementFiles,
  type ImportPolicy,
} from "@/lib/money/statement-import";

type ImportDropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  policy?: ImportPolicy;
};

export function ImportDropzone({
  onFiles,
  disabled,
  policy = DEFAULT_IMPORT_POLICY,
}: ImportDropzoneProps) {
  const inputId = useId();
  const rejectId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  function handleFiles(list: FileList | File[]) {
    const { accepted, rejected } = filterStatementFiles(list, policy);
    if (rejected.length > 0) {
      setRejectMessage(
        rejected.map((r) => `${r.name}: ${r.reason}`).join(" · "),
      );
    } else {
      setRejectMessage(null);
    }
    if (accepted.length > 0) onFiles(accepted);
  }

  const maxMb = Math.floor(policy.maxBytesPerFile / (1024 * 1024));

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        aria-describedby={rejectMessage ? rejectId : undefined}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-surface-container-lowest/50 px-6 py-12 transition-colors",
          dragging && "border-primary/50 bg-primary/5",
          disabled && "pointer-events-none opacity-50",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileUp className="h-6 w-6" aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-body-base font-medium text-white">
            Drop statement PDFs here
          </p>
          <p className="mt-1 text-body-sm text-on-surface/50">
            or choose files · PDF only · up to {policy.maxFilesPerBatch} files ·{" "}
            {maxMb}MB each
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            inputRef.current?.click();
          }}
        >
          Select files
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files) handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {rejectMessage ? (
        <p id={rejectId} className="text-body-sm text-error" role="alert">
          {rejectMessage}
        </p>
      ) : null}
    </div>
  );
}
