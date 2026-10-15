import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { StoryAnalysisAccount, StoryAnalysisConfiguration, StoryAnalysisCredential } from "../../../../shared/story-analysis";
import { apiRequest } from "../../../api/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

const CONFIG_KEY = ["story-analysis", "configuration"];
const STATUS_KEY = ["story-analysis", "local-status"];
const CREDENTIALS_KEY = ["story-analysis", "credentials"];
const CONFIG_PATH = "/api/v1/story-analysis/configuration";
const CREDENTIALS_PATH = "/api/v1/story-analysis/credentials";
const GEMINI_MODELS = [
  { id: "gemini-3.8-flash-lite", label: "Gemini 3.8 Flash Lite" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro High" },
] as const;

const ERROR_LABELS: Record<string, string> = {
  OAUTH_NOT_CONFIGURED: "Chưa có OAuth client. Xem hướng dẫn cấu hình bên dưới.",
  OAUTH_CLIENT_MISSING: "Chưa có OAuth client. Xem hướng dẫn cấu hình bên dưới.",
  OAUTH_CLIENT_INVALID: "OAuth client ID không hợp lệ (phải kết thúc bằng .apps.googleusercontent.com).",
  OAUTH_SCOPE_INVALID: "Danh sách scope OAuth không hợp lệ.",
  OAUTH_PROFILE_INVALID: "Tệp oauth-client.json không đọc được hoặc sai định dạng.",
  API_BASE_URL_INVALID: "Địa chỉ API phải là HTTPS thuộc googleapis.com.",
  LOGIN_IN_PROGRESS: "Đang chờ đăng nhập Google ở trình duyệt.",
  LOGIN_TIMEOUT: "Hết thời gian chờ đăng nhập. Thử lại.",
  LOGIN_CANCELLED: "Đã hủy đăng nhập.",
  LOGIN_DENIED: "Bạn đã từ chối cấp quyền trên màn hình Google.",
  LOGIN_FAILED: "Đăng nhập Google không hoàn tất. Thử lại.",
  SCOPE_NOT_GRANTED: "Chưa cấp đủ quyền. Hãy đăng nhập lại và giữ nguyên các quyền được yêu cầu.",
  NO_REFRESH_TOKEN: "Google không trả về quyền truy cập lâu dài. Đăng nhập lại và chấp nhận màn hình cấp quyền.",
  IDENTITY_UNAVAILABLE: "Không đọc được danh tính tài khoản Google.",
  ACCOUNT_LIMIT_REACHED: "Đã đạt số tài khoản tối đa.",
  DEVICE_UNPAIRED: "Kết nối Desktop này với backend để dùng cho phân tích.",
  ANALYSIS_IN_PROGRESS: "Chờ lượt phân tích của tài khoản này hoàn tất rồi thử lại.",
  BACKEND_UNAVAILABLE: "Chưa liên lạc được backend nên chưa xóa tài khoản. Thử lại.",
  AUTH_REQUIRED: "Không xác thực được tài khoản Google. Hãy đăng nhập lại tài khoản này.",
  ACCOUNT_NOT_ONBOARDED: "Tài khoản chưa được Antigravity cấp dự án. Hãy đăng nhập Antigravity một lần bằng tài khoản này.",
  PROVIDER_UNAVAILABLE: "Chưa kết nối được dịch vụ Antigravity. Sẽ tự thử lại.",
  MODEL_UNAVAILABLE: "Model không khả dụng với tài khoản này. Kiểm tra tên model.",
  QUOTA_EXHAUSTED: "Hạn mức tài khoản đã hết. Tài khoản khác vẫn tiếp tục chạy.",
  RATE_LIMITED: "Antigravity đang giới hạn lượt dùng. Tài khoản tạm nghỉ rồi tự chạy lại.",
  CONTENT_BLOCKED: "Nội dung bị bộ lọc an toàn chặn. Chưa lưu vào storyboard.",
  PROVIDER_REFUSAL: "Dịch vụ từ chối yêu cầu. Chưa lưu vào storyboard.",
  OUTPUT_LIMIT_EXCEEDED: "Kết quả vượt giới hạn cho phép. Chưa lưu vào storyboard.",
  INPUT_TOO_LARGE: "Chương quá dài cho một lượt phân tích.",
  SCHEMA_INVALID: "Kết quả không khớp nguồn truyện hoặc cấu trúc phân tích. Chưa lưu vào storyboard.",
  USER_CANCELLED: "Đã dừng tác vụ theo yêu cầu.",
  AMBIGUOUS_OUTCOME: "Tác vụ bị gián đoạn và chưa rõ kết quả. Ứng dụng sẽ không tự gửi lại.",
  RESULT_DELIVERY_PENDING: "Chưa đồng bộ được với backend. Kết quả đã lưu sẽ được gửi lại mà không phân tích lại.",
};
const CONNECTION_LABEL: Record<StoryAnalysisAccount["connectionState"], string> = {
  CONNECTED: "Đã kết nối", AUTH_REQUIRED: "Cần đăng nhập lại", UNAVAILABLE: "Tạm thời không khả dụng", UNKNOWN: "Đang kiểm tra",
};
const QUOTA_LABEL: Record<StoryAnalysisAccount["quotaState"], string> = {
  AVAILABLE: "Còn lượt", UNKNOWN: "Chưa rõ hạn mức", RATE_LIMITED: "Đang bị giới hạn lượt", EXHAUSTED: "Hết hạn mức",
};

const describe = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const code = Object.keys(ERROR_LABELS).find(key => message.includes(key));
  return code ? ERROR_LABELS[code] : message || "Không thể tải kết nối phân tích.";
};

export function AnalysisAccounts() {
  const queryClient = useQueryClient();
  const bridge = window.narrativex?.storyAnalysis;
  const [mode, setMode] = useState<StoryAnalysisConfiguration["executionMode"]>("ANTIGRAVITY_API");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState<StoryAnalysisConfiguration["effort"]>("HIGH");
  const [parallel, setParallel] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const config = useQuery({ queryKey: CONFIG_KEY, queryFn: () => apiRequest<StoryAnalysisConfiguration>(CONFIG_PATH), retry: false });
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: () => bridge!.status(), enabled: Boolean(bridge), refetchInterval: 4_000, retry: false });
  const credentials = useQuery({ queryKey: CREDENTIALS_KEY, queryFn: () => apiRequest<StoryAnalysisCredential[]>(CREDENTIALS_PATH), refetchInterval: 10_000, retry: false });

  useEffect(() => {
    if (!config.data) return;
    setMode(config.data.executionMode);
    setModel(config.data.executionMode === "ANTIGRAVITY_API" ? config.data.model : "gemini-3.1-pro-high");
    setEffort(config.data.effort);
    setParallel(config.data.maxConcurrentAnalyses);
  }, [config.data]);

  const addAccount = useMutation({
    mutationFn: () => bridge!.addAccount(),
    onSuccess: data => { queryClient.setQueryData(STATUS_KEY, data); setNotice("Đã thêm tài khoản Google. Có thể thêm tài khoản khác để chạy song song."); void credentials.refetch(); },
  });
  const removeAccount = useMutation({
    mutationFn: (accountId: string) => bridge!.removeAccount(accountId),
    onSuccess: data => { queryClient.setQueryData(STATUS_KEY, data); void credentials.refetch(); },
  });
  const toggle = useMutation({
    mutationFn: (item: StoryAnalysisCredential) => apiRequest<StoryAnalysisCredential>(`${CREDENTIALS_PATH}/${item.credentialRef}`, {
      method: "PUT", body: JSON.stringify({ enabled: !item.enabled, maxConcurrent: item.maxConcurrent }),
    }),
    onSuccess: () => { void credentials.refetch(); },
  });
  const save = useMutation({
    mutationFn: () => apiRequest<StoryAnalysisConfiguration>(CONFIG_PATH, { method: "PUT", body: JSON.stringify({
      executionMode: mode, model: mode === "ANTIGRAVITY_API" ? model.trim() : config.data?.model ?? "gemini-3.8-flash",
      effort, maxConcurrentAnalyses: parallel, rowVersion: config.data!.rowVersion,
    }) }),
    onSuccess: data => {
      queryClient.setQueryData(CONFIG_KEY, data);
      setModel(data.model);
      setNotice(
        data.executionMode === "ANTIGRAVITY_API"
          ? `Đã lưu model ${data.model}. Các lượt phân tích mới sẽ dùng cấu hình này.`
          : "Đã lưu. Các lượt phân tích mới sẽ dùng cấu hình này.",
      );
    },
  });

  const runtime = status.data;
  const accounts = runtime?.accounts ?? [];
  const remote = new Map((credentials.data ?? []).map(item => [item.credentialRef, item]));
  const modelValid = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model.trim());
  const error = config.error ?? status.error ?? addAccount.error ?? removeAccount.error ?? toggle.error ?? save.error;
  const connected = accounts.filter(a => a.connectionState === "CONNECTED" && !(a.lastError === "PROVIDER_REFUSAL" && a.lastDiagnostic?.httpStatus === 403)).length;
  const chip = !bridge ? "Chỉ có trong ứng dụng Desktop"
    : status.isPending ? "Đang kiểm tra…"
    : !runtime?.configured ? "Chưa cấu hình OAuth"
    : accounts.length === 0 ? "Chưa có tài khoản" : `${connected}/${accounts.length} tài khoản sẵn sàng`;

  return <div className="mx-auto grid w-full max-w-4xl gap-5">
    <section aria-labelledby="account-provider-title" className="rounded-xl border border-border-subtle bg-surface-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-caption font-semibold text-text-dim">Phân tích truyện</p><h2 id="account-provider-title" className="mt-1 text-lg font-semibold text-foreground">Tài khoản Google · Antigravity</h2></div>
        <span role="status" className="rounded-full border border-border-subtle px-3 py-1 text-caption text-text-secondary">{chip}</span>
      </div>
      <p className="mt-4 text-body leading-6 text-text-secondary">Đăng nhập Google trực tiếp trong NarrativeX (OAuth qua trình duyệt, không cần cài CLI). Mỗi tài khoản chạy một chương tại một thời điểm; thêm nhiều tài khoản để phân tích nhiều chương song song.</p>
      <p className="mt-2 text-label leading-5 text-text-muted">Tích hợp thử nghiệm. Antigravity hạn chế truy cập bằng phần mềm bên thứ ba và có thể đình chỉ tài khoản. NarrativeX lưu token mã hóa bằng kho bảo mật của hệ điều hành, không gửi token lên backend, và không xác nhận gói Pro/Ultra hay hạn mức còn lại.</p>
      {!bridge && <p role="alert" className="mt-3 text-label text-warning">Mở bằng ứng dụng Desktop để đăng nhập tài khoản.</p>}
      {runtime && !runtime.configured && <div role="alert" className="mt-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-label leading-6 text-warning">
        <p>{ERROR_LABELS[runtime.profileIssue ?? "OAUTH_CLIENT_MISSING"] ?? runtime.profileIssue}</p>
        <p className="mt-1">Tạo tệp <code>oauth-client.json</code> trong thư mục dữ liệu ứng dụng (<code>story-analysis</code>) với <code>{"{ \"clientId\": \"…apps.googleusercontent.com\", \"clientSecret\": \"…\" }"}</code>, hoặc đặt biến môi trường <code>NARRATIVEX_ANTIGRAVITY_CLIENT_ID</code> / <code>NARRATIVEX_ANTIGRAVITY_CLIENT_SECRET</code>, rồi mở lại ứng dụng. OAuth client không được lưu trong mã nguồn.</p>
      </div>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={!bridge || !runtime?.configured || addAccount.isPending || Boolean(runtime?.loginInProgress)} onClick={() => { setNotice(null); addAccount.mutate(); }}><Plus size={14} /> {addAccount.isPending || runtime?.loginInProgress ? "Đang chờ đăng nhập Google…" : "Thêm tài khoản Google"}</Button>
        {(addAccount.isPending || runtime?.loginInProgress) && <Button variant="outline" onClick={() => { void bridge?.cancelLogin(); }}><X size={14} /> Hủy đăng nhập</Button>}
        <Button variant="outline" disabled={!bridge || status.isFetching} onClick={() => { void status.refetch(); void credentials.refetch(); }}><RefreshCw size={14} /> Làm mới</Button>
        <Button variant="ghost" disabled={!bridge} onClick={() => { void bridge?.openTerms(); }}><ExternalLink size={14} /> Điều khoản Antigravity</Button>
      </div>
    </section>

    {accounts.length > 0 && <section aria-labelledby="account-list-title" className="rounded-xl border border-border-subtle bg-surface-panel p-5 sm:p-6">
      <h2 id="account-list-title" className="text-base font-semibold text-foreground">Tài khoản đã đăng nhập</h2>
      <ul className="mt-4 grid gap-3">
        {accounts.map(account => {
          const desired = account.credentialRef ? remote.get(account.credentialRef) : undefined;
          const permissionDenied = account.lastError === "PROVIDER_REFUSAL" && account.lastDiagnostic?.httpStatus === 403;
          return <li key={account.accountId} className="rounded-lg border border-border-subtle px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{account.label}</p>
                <p className="mt-1 text-caption text-text-muted">{permissionDenied ? "Đã đăng nhập · Chưa có quyền truy cập" : CONNECTION_LABEL[account.connectionState]} · {QUOTA_LABEL[account.quotaState]}{account.activeJobId ? " · Đang phân tích một chương" : ""}{desired && !desired.enabled ? " · Đang tắt" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {account.connectionState === "AUTH_REQUIRED" && <Button variant="outline" disabled={addAccount.isPending} onClick={() => { setNotice(null); addAccount.mutate(); }}>Đăng nhập lại</Button>}
                {desired && <Button variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(desired)}>{desired.enabled ? "Tắt" : "Bật"}</Button>}
                <Button variant="ghost" aria-label={`Xóa ${account.label}`} disabled={removeAccount.isPending || Boolean(account.activeJobId)} onClick={() => { setNotice(null); removeAccount.mutate(account.accountId); }}><Trash2 size={14} /></Button>
              </div>
            </div>
            {account.lastError && <p role="status" className="mt-2 text-label leading-5 text-warning">{permissionDenied
              ? "Antigravity từ chối quyền truy cập. Kiểm tra quyền của tài khoản, OAuth client và model; đăng nhập lại không tự cấp quyền này."
              : ERROR_LABELS[account.lastError] ?? account.lastError}</p>}
            {account.lastError && account.lastDiagnostic && <p className="mt-1 break-words text-caption leading-5 text-text-muted">
              {account.lastDiagnostic.source === "GOOGLE_OAUTH" ? "Google OAuth" : "Antigravity"}
              {account.lastDiagnostic.httpStatus !== null ? ` · HTTP ${account.lastDiagnostic.httpStatus}` : " · Chưa nhận được phản hồi HTTP"}
              {account.lastDiagnostic.reason ? ` · ${account.lastDiagnostic.reason}` : ""}
            </p>}
          </li>;
        })}
      </ul>
    </section>}

    <form className="rounded-xl border border-border-subtle bg-surface-panel p-5 sm:p-6" onSubmit={event => { event.preventDefault(); setNotice(null); save.mutate(); }}>
      <h2 className="text-base font-semibold text-foreground">Mặc định cho lượt phân tích mới</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><label htmlFor="analysis-provider" className="text-label text-text-secondary">Phương thức phân tích</label>
          <Select disabled={!config.data || save.isPending} value={mode} onValueChange={value => setMode(value as typeof mode)}><SelectTrigger id="analysis-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANTIGRAVITY_API">Tài khoản Google · Antigravity</SelectItem><SelectItem value="VERTEX_API">Vertex Gemini · API hiện tại</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><label htmlFor="analysis-effort" className="text-label text-text-secondary">Mức suy luận</label>
          <Select disabled={!config.data || save.isPending} value={effort} onValueChange={value => setEffort(value as typeof effort)}><SelectTrigger id="analysis-effort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HIGH">Cao</SelectItem><SelectItem value="MEDIUM">Trung bình</SelectItem><SelectItem value="LOW">Thấp</SelectItem></SelectContent></Select></div>
        {mode === "ANTIGRAVITY_API" && <>
          <div className="grid gap-2"><label htmlFor="analysis-model" className="text-label text-text-secondary">Model Gemini</label>
            <Select disabled={!config.data || save.isPending} value={model} onValueChange={setModel}><SelectTrigger id="analysis-model" aria-describedby="analysis-model-help"><SelectValue placeholder={config.isPending ? "Đang tải cấu hình…" : config.error ? "Không tải được cấu hình" : "Chọn model Gemini"}>{model || undefined}</SelectValue></SelectTrigger><SelectContent>
              {!GEMINI_MODELS.some(option => option.id === model) && model && <SelectItem value={model}>{model} (đang lưu)</SelectItem>}
              {GEMINI_MODELS.map(option => <SelectItem key={option.id} value={option.id}>{option.label} · {option.id}</SelectItem>)}
            </SelectContent></Select>
            <p id="analysis-model-help" className="text-caption text-text-muted">Chọn model Gemini mà tài khoản Antigravity được phép gọi. Model chưa được cấp quyền có thể báo lỗi.</p>
          </div>
          <div className="grid gap-2"><label htmlFor="analysis-parallel" className="text-label text-text-secondary">Số chương phân tích song song tối đa</label><Input id="analysis-parallel" type="number" min={1} max={32} value={parallel} disabled={!config.data || save.isPending} onChange={event => setParallel(Math.min(32, Math.max(1, Number(event.target.value) || 1)))} /><p className="text-caption text-text-muted">Thực tế không vượt quá số tài khoản đang bật.</p></div>
        </>}
      </div>
      <Button type="submit" className="mt-5" disabled={!config.data || save.isPending || (mode === "ANTIGRAVITY_API" && !modelValid)}>{save.isPending ? "Đang lưu…" : "Lưu cấu hình"}</Button>
    </form>
    {notice && <p role="status" className="rounded-lg border border-border-subtle bg-surface-dark/50 px-4 py-3 text-label leading-6 text-text-secondary">{notice}</p>}
    {error && <div role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-label leading-6 text-warning">{describe(error)}<Button variant="ghost" className="ml-2" onClick={() => { void config.refetch(); void status.refetch(); void credentials.refetch(); }}>Thử lại</Button></div>}
  </div>;
}
