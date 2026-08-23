import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface RenderFailureProps {
  message: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

export function RenderFailure({ message, onRetry, retryDisabled = false }: Readonly<RenderFailureProps>) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
        <div>
          <p className="font-semibold">Render thất bại</p>
          <p className="mt-1 break-words text-rose-200/85">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={retryDisabled}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
