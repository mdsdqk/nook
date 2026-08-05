import { cn } from "@/lib/utils";

type ProcessingViewProps = {
  title: string;
  detail?: string;
  className?: string;
};

/** Shared processing chrome for import / transfer wizards. Stage labels are UX only. */
export function ProcessingView({
  title,
  detail,
  className,
}: ProcessingViewProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 py-10 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="statement-processing-orb" aria-hidden>
        <span className="statement-processing-ring" />
        <span className="statement-processing-ring statement-processing-ring-delay" />
        <span className="statement-processing-core" />
      </div>
      <div className="space-y-1.5">
        <p className="text-title-md font-medium text-white">{title}</p>
        {detail ? (
          <p className="max-w-sm text-body-sm text-on-surface/60">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
