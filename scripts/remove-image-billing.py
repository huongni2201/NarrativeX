from pathlib import Path
import re


def read(path): return Path(path).read_text(encoding='utf-8')
def write(path, text): Path(path).write_text(text, encoding='utf-8')
def sub(path, pattern, replacement, count=1, flags=0):
    text = read(path)
    new, n = re.subn(pattern, replacement, text, count=count, flags=flags)
    if n != count: raise RuntimeError(f'{path}: {pattern[:60]!r} matched {n}, expected {count}')
    write(path, new)

def rep(path, old, new):
    text=read(path)
    if text.count(old)!=1: raise RuntimeError(f'{path}: replacement matched {text.count(old)}')
    write(path,text.replace(old,new))

# Backend public create-image API: no estimate endpoint and no user cost authorization.
p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/controller/MediaGenerationController.java'
t=read(p)
for line in [
'import com.narrativex.backend.feature.generation.api.request.EstimateMediaJobRequest;\n',
'import com.narrativex.backend.feature.generation.api.response.MediaCostEstimateResponse;\n',
'import com.narrativex.backend.feature.generation.application.command.EstimateMediaJobCommand;\n',
'import com.narrativex.backend.feature.generation.application.usecase.EstimateMediaJobUseCase;\n',
'  private final EstimateMediaJobUseCase estimateMediaJobUseCase;\n']:
    if line not in t: raise RuntimeError(f'{p}: missing {line.strip()}')
    t=t.replace(line,'')
t=t.replace('                request.aspectRatio(),\n                request.maxAuthorizedCost(),\n                ImageStyle.from(request.imageStyle()),','                request.aspectRatio(),\n                ImageStyle.from(request.imageStyle()),')
t,n=re.subn(r'\n  @PostMapping\("/projects/\{projectId\}/chapters/\{chapterId\}/media-jobs/estimate"\).*?\n  }\n(?=\n  @GetMapping)', '', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: estimate endpoint block not found')
write(p,t)

# Create image jobs reserve concurrency only. No estimate, pricing snapshot, operation-plan cost, or cost fingerprint input.
p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCase.java'
t=read(p)
for line in [
'import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;\n',
'import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;\n',
'  private final OperationPlanRepository operationPlanRepository;\n']:
    if line not in t: raise RuntimeError(f'{p}: missing {line.strip()}')
    t=t.replace(line,'')
t,n=re.subn(r'    int beatCount = .*?\n    var imageProfile = imageGenerationCatalog\.resolve\(\);\n    BigDecimal expectedCost = imageProfile\.estimateCost\(beatCount\);\n    if \(expectedCost\.compareTo\(command\.maxAuthorizedCost\(\)\) > 0\) \{.*?\n    \}\n', '    int beatCount = planningSource.scenes().stream().mapToInt(scene -> scene.beats().size()).sum();\n    var imageProfile = imageGenerationCatalog.resolve();\n', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: expectedCost block not found')
t=t.replace('                expectedCost,\n                command.aspectRatio(),\n                imageProfile.providerKey(),\n                imageProfile.model(),\n                imageProfile.pricingSnapshot(),\n                imageProfile.pricingFingerprint(),','                BigDecimal.ZERO,\n                command.aspectRatio(),\n                imageProfile.providerKey(),\n                imageProfile.model(),\n                null,\n                null,')
t=t.replace('.reserve(userId, command.maxAuthorizedCost(), quota.maxConcurrentExpensiveJobs())','.reserve(userId, BigDecimal.ZERO, quota.maxConcurrentExpensiveJobs())')
t,n=re.subn(r'\n    OperationPlan operationPlan =.*?operationPlanRepository\.save\(operationPlan\.withGenerationJobId\(job\.getId\(\)\)\);', '', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: operation plan block not found')
t=t.replace('        "Created shot-image media job id={} planId={} beats={} provider={} model={} estimatedCost={} projectId={} chapterId={}",','        "Created shot-image media job id={} planId={} beats={} provider={} model={} projectId={} chapterId={}",')
t=t.replace('        imageProfile.model(),\n        expectedCost,\n        command.projectId(),','        imageProfile.model(),\n        command.projectId(),')
t=t.replace('            + ":"\n            + imageProvider\n            + ":"\n            + command.maxAuthorizedCost().toPlainString());','            + ":"\n            + imageProvider);')
write(p,t)

# Selective image regeneration also has no monetary admission; keep generic legacy DB fields at zero only.
p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateRegenerationPlanUseCase.java'
t=read(p)
t=t.replace('import java.nio.charset.StandardCharsets;','import java.math.BigDecimal;\nimport java.nio.charset.StandardCharsets;')
t=t.replace('    var estimatedCost = imageProfile.estimateCost(affected.size());','    var estimatedCost = BigDecimal.ZERO;')
write(p,t)

p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateRegenerationJobUseCase.java'
t=read(p)
t=t.replace('import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;\n','').replace('import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;\n','').replace('  private final OperationPlanRepository operationPlanRepository;\n','')
t=t.replace('      BigDecimal maxAuthorizedCost,\n      String idempotencyHeader)', '      String idempotencyHeader)')
t,n=re.subn(r'\n    if \(regenerationPlan\.estimatedCost\(\)\.compareTo\(maxAuthorizedCost\) > 0\) \{.*?\n    \}\n', '\n', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: regen cost check not found')
t=t.replace('.reserve(userId, maxAuthorizedCost, quota.maxConcurrentExpensiveJobs())','.reserve(userId, BigDecimal.ZERO, quota.maxConcurrentExpensiveJobs())')
t=t.replace('                regenerationPlan.estimatedCost(),\n                settings.aspectRatio(),\n                imageProfile.providerKey(),\n                imageProfile.model(),\n                imageProfile.pricingSnapshot(),\n                imageProfile.pricingFingerprint(),','                BigDecimal.ZERO,\n                settings.aspectRatio(),\n                imageProfile.providerKey(),\n                imageProfile.model(),\n                null,\n                null,')
t,n=re.subn(r'\n    OperationPlan operationPlan =.*?operationPlanRepository\.save\(operationPlan\.withGenerationJobId\(job\.getId\(\)\)\);', '', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: regen operation plan block not found')
write(p,t)

# Regeneration request/controller stop accepting cost caps.
p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/CreateRegenerationJobRequest.java'
write(p, '''package com.narrativex.backend.feature.generation.api.request;\n\nimport jakarta.validation.constraints.NotNull;\nimport java.util.UUID;\n\npublic record CreateRegenerationJobRequest(@NotNull UUID regenerationPlanId) {}\n''')
p='app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/controller/ContinuityController.java'
if Path(p).exists():
    t=read(p)
    t=t.replace('request.regenerationPlanId(), request.maxAuthorizedCost(), idempotencyKey','request.regenerationPlanId(), idempotencyKey')
    write(p,t)

# Public TypeScript contracts contain no image cost/usage concepts.
p='packages/client-contracts/src/generation.ts'
t=read(p)
t=t.replace('  estimatedCost: string;\n  currency: string;\n','')
t=t.replace('  maxAuthorizedCost: number;\n','')
t,n=re.subn(r'\nexport interface MediaJobCostEstimate \{.*?\n\}\n', '\n', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: MediaJobCostEstimate not found')
write(p,t)
p='packages/client-contracts/src/index.ts'; t=read(p); t=t.replace('  MediaJobCostEstimate,\n',''); write(p,t)

# Desktop generation API/query layer: remove estimate call/hook.
p='app/desktop/src/renderer/features/generation/api/generation.api.ts'
t=read(p).replace('  MediaJobCostEstimate,\n','')
t,n=re.subn(r'\n  estimate: \(projectId: string, chapterId: string\) =>.*?\n    \),', '', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: estimate api not found')
write(p,t)
p='app/desktop/src/renderer/features/generation/queries/generation.queries.ts'
t=read(p)
t,n=re.subn(r'\nexport function useEstimateMediaJob\(\) \{.*?\n\}\n', '\n', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: estimate hook not found')
write(p,t)

# Images screen: generate directly; no estimate button/state/messages/cap.
p='app/desktop/src/renderer/features/generation/screens/ImagesScreen.tsx'
t=read(p)
t=t.replace('  MediaJobCostEstimate,\n','').replace('  useEstimateMediaJob,\n','').replace('  const estimate = useEstimateMediaJob();\n','').replace('  const [costEstimate, setCostEstimate] = useState<MediaJobCostEstimate | null>(null);\n','').replace('    setCostEstimate(null);\n','')
t,n=re.subn(r'\n  async function estimateCost\(\): Promise<MediaJobCostEstimate \| null> \{.*?\n  \}\n', '\n', t, count=1, flags=re.S)
if n!=1: raise RuntimeError(f'{p}: estimateCost function not found')
t=t.replace('      const latestEstimate = await estimateCost();\n      if (!latestEstimate) return;\n      const maxAuthorizedCost = Number(latestEstimate.estimatedCost);\n      if (!Number.isFinite(maxAuthorizedCost) || maxAuthorizedCost <= 0) {\n        setNotice("Không có chi phí image generation hợp lệ để authorize.");\n        return;\n      }\n','')
t=t.replace(', latestEstimate.estimatedCost].join(":")', '].join(":")')
t=t.replace('          maxAuthorizedCost,\n','')
t=t.replace('      setNotice(`Media job ${job.jobId.slice(0, 8)} đã được queue; mỗi visual beat sẽ tạo một ảnh mới bằng profile chất lượng cao mặc định. Cap ${latestEstimate.estimatedCost} ${latestEstimate.currency}.`);','      setNotice(`Media job ${job.jobId.slice(0, 8)} đã được queue; mỗi visual beat sẽ tạo một ảnh mới bằng profile chất lượng cao mặc định.`);')
t,n=re.subn(r'\n            <Button variant="ghost" size="sm" onClick=\{\(\) => void estimateCost\(\)\}.*?</Button>', '', t, count=1)
if n!=1: raise RuntimeError(f'{p}: estimate button not found')
t=t.replace(' || estimate.isPending','')
t=t.replace('              { label: "estimate", value: costEstimate ? `${costEstimate.estimatedCost} ${costEstimate.currency}` : "—" },\n','')
write(p,t)

# Worker image result has no usage or actual_cost fields and adapters do not parse usage metadata.
p='app/ai-worker/src/narrativex_worker/providers/image.py'
t=read(p).replace('from decimal import Decimal\n','').replace('    usage: dict[str, int | str] = field(default_factory=dict)\n    actual_cost: Decimal | None = None\n','')
write(p,t)
for p in ['app/ai-worker/src/narrativex_worker/providers/vertex_image.py','app/ai-worker/src/narrativex_worker/providers/vertex_image_batch.py']:
    t=read(p)
    t=t.replace('            _usage(raw),\n            None,\n','').replace('        _usage(raw),\n        None,\n','')
    t,n=re.subn(r'\n\ndef _usage\(raw: dict\[str, object\]\) -> dict\[str, int \| str\]:.*?(?=\n\ndef |\Z)', '', t, count=1, flags=re.S)
    if n!=1: raise RuntimeError(f'{p}: _usage helper not found')
    write(p,t)

# Remove image pricing config from runtime configuration files.
for p in ['docker-compose.yml','.env.example','app/backend-service/src/main/resources/application.yml']:
    t=read(p)
    lines=[]
    for line in t.splitlines(True):
        upper=line.upper()
        if ('IMAGE_' in upper or 'IMAGE.' in upper or 'IMAGE:' in upper) and any(k in upper for k in ['UNIT_COST','PRICING_VERSION']):
            continue
        if 'unit-cost:' in line or 'pricing-version:' in line:
            continue
        lines.append(line)
    write(p,''.join(lines))
