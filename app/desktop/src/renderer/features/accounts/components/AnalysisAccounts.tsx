import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogIn, RefreshCw, TriangleAlert } from "lucide-react";
import type { AgyUsageGroup, StoryAnalysisConfiguration } from "../../../../shared/story-analysis";
import { apiRequest } from "../../../api/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

const CONFIG_KEY = ["story-analysis", "configuration"];
const STATUS_KEY = ["story-analysis", "local-status"];
const MODELS_KEY = ["story-analysis", "models"];
const CONFIG_PATH = "/api/v1/story-analysis/configuration";

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Đã đăng nhập trong agy",
  AUTH_REQUIRED: "Chưa đăng nhập trong agy",
  UNAVAILABLE: "agy chưa khả dụng",
  UNKNOWN: "Chưa kiểm tra",
};

const ERROR_LABELS: Record<string, string> = {
  AGY_NOT_FOUND: "Chưa cài agy. Cài Antigravity CLI hoặc đặt đường dẫn trong NARRATIVEX_AGY_PATH rồi kiểm tra lại.",
  AGY_VERSION_UNSUPPORTED: "Phiên bản agy chưa được hỗ trợ (cần 1.3.0 trở lên).",
  PLATFORM_UNSUPPORTED: "Phân tích bằng agy hiện chỉ hỗ trợ Windows.",
  AUTH_REQUIRED: "Đăng nhập tài khoản Google AI Pro trong agy rồi kiểm tra lại.",
  PROVIDER_UNAVAILABLE: "Không đọc được trạng thái từ agy.",
  ISOLATION_NOT_VERIFIED: "Đang khóa gửi nội dung chương cho đến khi vượt qua kiểm tra cô lập ở bước 6b.",
  DEVICE_UNPAIRED: "Kết nối Desktop với backend trước khi phân tích.",
  CONFIGURATION_UNAVAILABLE: "Chưa đọc được cấu hình phân tích từ backend.",
  QUOTA_EXHAUSTED: "Hạn mức agy đã hết; tự chạy lại sau thời điểm reset.",
  RATE_LIMITED: "agy đang giới hạn lượt dùng; tạm dừng một lúc.",
  TOOL_DENIED: "Một lượt phân tích không có kết quả vì agy cố chạy công cụ bị chặn; chương sẽ được thử lại, tài khoản không bị tạm dừng.",
  PROVIDER_REFUSAL: "agy từ chối yêu cầu; tạm dừng 30 phút. Kiểm tra gói tài khoản.",
  MODEL_UNAVAILABLE: "Model đã chọn không có trong agy.",
  MODEL_NOT_AVAILABLE: "Model đã cấu hình không có trong `agy models`. Chọn lại bên dưới; các chương sẽ chưa được nhận cho đến lúc đó.",
  MODEL_NOT_CONFIGURED: "Chưa chọn model phân tích.",
  RESULT_DELIVERY_PENDING: "Kết quả đã được giữ an toàn trên máy và sẽ gửi lại khi backend sẵn sàng.",
  AMBIGUOUS_OUTCOME: "Một lượt phân tích chưa xác định kết quả và sẽ không tự chạy lại.",
  ANALYSIS_TIMEOUT: "Một lượt phân tích chạy quá thời gian nên đã bị dừng; chương có thể quá dài.",
  PROCESS_FAILED: "agy thoát mà không trả kết quả cho một lượt phân tích.",
  APP_INTERRUPTED: "Một lượt phân tích bị gián đoạn do ứng dụng đóng. Mở chương và bấm Phân tích chương để chạy lại.",
};

function quotaText(remaining: number | null, resetsAt: string | null): string {
  if (remaining === null) return "Chưa rõ";
  const reset = resetsAt ? ` · reset ${new Date(resetsAt).toLocaleString()}` : "";
  return `Còn ${Math.round(remaining * 100)}%${reset}`;
}

function UsageBar({ label, remaining, resetsAt }: { label: string; remaining: number | null; resetsAt: string | null }) {
  const percent = remaining === null ? 0 : Math.round(remaining * 100);
  return <div>
    <div className="flex items-baseline justify-between gap-2 text-caption text-text-muted">
      <span>{label}</span><span>{quotaText(remaining, resetsAt)}</span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-elevated" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className={percent < 10 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

function UsageGroupView({ title, group }: { title: string; group: AgyUsageGroup | undefined }) {
  return <div className="grid gap-2">
    <p className="text-caption uppercase tracking-wide text-text-muted">{title}</p>
    {group
      ? <>
        <UsageBar label="5 giờ" remaining={group.fiveHourRemaining} resetsAt={group.fiveHourResetsAt} />
        <UsageBar label="Tuần" remaining={group.weeklyRemaining} resetsAt={group.weeklyResetsAt} />
      </>
      : <p className="text-label text-foreground">Chưa có số liệu</p>}
  </div>;
}

export function AnalysisAccounts() {
  const queryClient = useQueryClient();
  const bridge = window.narrativex?.storyAnalysis;
  const [model, setModel] = useState("");
  const [parallel, setParallel] = useState(2);
  const [notice, setNotice] = useState<string | null>(null);
  const config = useQuery({ queryKey: CONFIG_KEY, queryFn: () => apiRequest<StoryAnalysisConfiguration>(CONFIG_PATH), retry: false });
  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => bridge!.status(),
    enabled: Boolean(bridge),
    refetchInterval: 15_000,
    retry: false,
  });
  const loggedIn = status.data?.loggedIn === true;
  const models = useQuery({
    queryKey: MODELS_KEY,
    queryFn: () => bridge!.models(),
    enabled: Boolean(bridge) && loggedIn,
    retry: false,
  });

  useEffect(() => {
    if (!config.data) return;
    setModel(config.data.model);
    setParallel(Math.min(3, Math.max(1, config.data.maxConcurrentAnalyses)));
  }, [config.data]);

  const refresh = useMutation({
    mutationFn: () => bridge!.refresh(),
    onSuccess: value => {
      queryClient.setQueryData(STATUS_KEY, value);
      void queryClient.invalidateQueries({ queryKey: MODELS_KEY });
    },
  });
  const openAgy = useMutation({ mutationFn: () => bridge!.openAgy() });
  const save = useMutation({
    mutationFn: () => apiRequest<StoryAnalysisConfiguration>(CONFIG_PATH, {
      method: "PUT",
      body: JSON.stringify({
        executionMode: "ANTIGRAVITY_CLI",
        model: model.trim(),
        effort: config.data?.effort ?? "HIGH",
        maxConcurrentAnalyses: parallel,
        rowVersion: config.data?.rowVersion ?? 0,
      }),
    }),
    onSuccess: async value => {
      queryClient.setQueryData(CONFIG_KEY, value);
      setNotice("Đã lưu cấu hình cho các lượt phân tích mới.");
      void refresh.mutateAsync().catch(() => undefined);
    },
  });

  const data = status.data;
  const modelOptions = models.data ?? [];
  const modelKnown = modelOptions.some(option => option.slug === model);
  const modelValid = model.trim().length > 0 && model.trim().length <= 128;
  const gemini = data?.usage.find(group => group.family === "gemini");
  const thirdParty = data?.usage.find(group => group.family === "third-party");
  const problem = data?.modelIssue ?? data?.lastError ?? null;
  const errorMessage = (error: unknown) => {
    const value = error instanceof Error ? error.message : "";
    return (ERROR_LABELS[value] ?? value) || "Không thể tải trạng thái phân tích.";
  };

  return <div className="grid min-w-0 gap-4">
    <section className="rounded-xl border border-border-subtle bg-surface-panel p-5 sm:p-6" aria-labelledby="agy-session-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="agy-session-heading" className="text-base font-semibold text-foreground">Antigravity CLI</h2>
          <p className="mt-1 max-w-2xl text-label leading-6 text-text-muted">
            NarrativeX chạy phân tích chương qua agy bằng phiên đăng nhập mà agy tự quản lý. Ứng dụng không lưu hay đọc token Google và chỉ dùng một tài khoản.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.cliReady && !loggedIn && <Button variant="outline" disabled={!bridge || openAgy.isPending} onClick={() => openAgy.mutate()}>
            <LogIn size={14} />Mở agy để đăng nhập
          </Button>}
          <Button variant="outline" disabled={!bridge || refresh.isPending} onClick={() => refresh.mutate()}>
            <RefreshCw size={14} className={refresh.isPending ? "animate-spin" : undefined} />
            {refresh.isPending ? "Đang kiểm tra…" : "Kiểm tra lại"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-border-subtle bg-surface-dark/40 p-4 sm:grid-cols-2">
        <div>
          <p className="text-caption uppercase tracking-wide text-text-muted">Cài đặt</p>
          <p className="mt-1 text-label text-foreground">
            {status.isPending ? "Đang kiểm tra…" : data?.cliReady ? `agy ${data.cliVersion}` : ERROR_LABELS[data?.cliIssue ?? ""] ?? "Chưa phát hiện agy"}
          </p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-text-muted">Phiên đăng nhập</p>
          <p className={loggedIn ? "mt-1 text-label text-success" : "mt-1 text-label text-warning"}>
            {STATUS_LABELS[data?.connectionState ?? "UNKNOWN"]}
          </p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-text-muted">Kết nối backend</p>
          <p className="mt-1 text-label text-foreground">{data?.deviceReady ? "Đã kết nối" : "Chưa kết nối"}</p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-text-muted">Đang chạy</p>
          <p className="mt-1 text-label text-foreground">{data ? `${data.runningJobs}/${data.maxParallel} chương` : "—"}</p>
        </div>
        <UsageGroupView title="Hạn mức Gemini" group={gemini} />
        <UsageGroupView title="Hạn mức Claude và GPT" group={thirdParty} />
        {data?.nextEligibleAt && <p className="text-caption text-warning sm:col-span-2">Tạm dừng nhận chương đến {new Date(data.nextEligibleAt).toLocaleString()}.</p>}
        {data?.usageObservedAt && <p className="text-caption text-text-muted sm:col-span-2">Đọc hạn mức lúc {new Date(data.usageObservedAt).toLocaleString()}.</p>}
      </div>

      {data?.isolationVerified === false && <div className="mt-3 flex gap-2 rounded-lg border border-warning/30 bg-warning-bg p-3 text-label leading-6 text-warning">
        <TriangleAlert size={16} className="mt-1 shrink-0" />
        <span>{ERROR_LABELS.ISOLATION_NOT_VERIFIED} Chỉ đặt <code>NARRATIVEX_AGY_ISOLATION_VERIFIED=1</code> sau khi báo cáo <code>scripts/agy-cli-spike.ps1</code> xác nhận <code>sandboxLeaked=false</code> và <code>fileCreated=false</code>.</span>
      </div>}
      {problem && problem !== "ISOLATION_NOT_VERIFIED" && <p role="status" className="mt-3 text-label leading-5 text-warning">
        {ERROR_LABELS[problem] ?? problem}
      </p>}
      <button type="button" className="mt-3 inline-flex items-center gap-1 text-caption text-text-muted underline-offset-2 hover:text-foreground hover:underline" onClick={() => void bridge?.openTerms()}>
        Điều khoản sử dụng của Google <ExternalLink size={12} />
      </button>
    </section>

    <form className="rounded-xl border border-border-subtle bg-surface-panel p-5 sm:p-6" onSubmit={event => { event.preventDefault(); setNotice(null); save.mutate(); }}>
      <h2 className="text-base font-semibold text-foreground">Cấu hình cho lượt phân tích mới</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <label htmlFor="analysis-model" className="text-label text-text-secondary">Model agy</label>
          {/* Radix's hidden form select can emit an empty value while restoring async options. */}
          {modelOptions.length > 0
            ? <Select value={model} onValueChange={value => { if (value) setModel(value); }} disabled={!config.data || save.isPending}>
              <SelectTrigger id="analysis-model" aria-describedby="analysis-model-help"><SelectValue placeholder="Chọn model" /></SelectTrigger>
              <SelectContent>
                {!modelKnown && model && <SelectItem value={model}>{model} (không có trong agy)</SelectItem>}
                {modelOptions.map(option => <SelectItem key={option.slug} value={option.slug}>{option.slug}</SelectItem>)}
              </SelectContent>
            </Select>
            : <Input id="analysis-model" value={model} maxLength={128} disabled={!config.data || save.isPending} onChange={event => setModel(event.target.value)} aria-describedby="analysis-model-help" />}
          <p id="analysis-model-help" className="text-caption text-text-muted">
            Danh sách lấy từ <code>agy models</code>; mức suy luận nằm trong tên model nên không có ô riêng. Gợi ý: <code>gemini-3.8-flash-low</code> (đã đo: nhanh nhất; <code>high</code> có thể suy nghĩ hàng chục nghìn token và quá thời gian).
          </p>
        </div>
        <div className="grid gap-2">
          <label htmlFor="analysis-parallel" className="text-label text-text-secondary">Số chương chạy đồng thời</label>
          <Input id="analysis-parallel" type="number" min={1} max={3} value={parallel} disabled={!config.data || save.isPending} onChange={event => setParallel(Math.min(3, Math.max(1, Number(event.target.value) || 1)))} />
          <p className="text-caption text-text-muted">Tối đa 3, cùng một tài khoản. Mỗi lượt gọi tốn khoảng 13k token cố định.</p>
        </div>
      </div>
      <Button type="submit" className="mt-5" disabled={!config.data || save.isPending || !modelValid}>
        {save.isPending ? "Đang lưu…" : "Lưu cấu hình"}
      </Button>
    </form>
    {notice && <p role="status" className="rounded-lg border border-border-subtle bg-surface-dark/50 px-4 py-3 text-label leading-6 text-text-secondary">{notice}</p>}
    {(config.error || status.error || refresh.error || save.error || openAgy.error) && <div role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-label leading-6 text-warning">
      {errorMessage(config.error ?? status.error ?? refresh.error ?? save.error ?? openAgy.error)}
      <Button variant="ghost" className="ml-2" onClick={() => { void config.refetch(); void status.refetch(); }}>Thử lại</Button>
    </div>}
  </div>;
}
