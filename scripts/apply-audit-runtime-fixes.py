from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# P2: resolve render replay/conflict before any Auto Edit mutation and include all override fields.
render = "app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java"
replace_once(
    render,
    '''  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    String userId = currentUserId.get();''',
    '''  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    return executeWithPreCreateMutation(command, () -> {});
  }

  @Transactional
  public GenerationJob executeWithPreCreateMutation(
      CreateProjectRenderCommand command, Runnable preCreateMutation) {
    String userId = currentUserId.get();''',
)
replace_once(
    render,
    '''      return existingJob;
    }

    validateLocalDevice(userId, command.localDeviceId());''',
    '''      return existingJob;
    }

    preCreateMutation.run();
    validateLocalDevice(userId, command.localDeviceId());''',
)
replace_once(
    render,
    '''                    override.visualBeatId()
                        + ":"
                        + override.durationMs()
                        + ":"
                        + override.cameraMovement())''',
    '''                    override.visualBeatId()
                        + ":"
                        + override.durationMs()
                        + ":"
                        + override.cameraMovement()
                        + ":"
                        + override.fitMode()
                        + ":"
                        + override.trimStartMs())''',
)

# P2: lock identity includes process incarnation so PID reuse (notably PID 1 in containers)
# cannot make a crash-left lock permanent.
storage = "app/ai-worker/src/narrativex_worker/narration/storage.py"
replace_once(
    storage,
    '''    @contextmanager
    def _writer_lock(self, path: Path) -> Iterator[None]:
        lock_path = self._lock(path)
        while True:
            try:
                descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                with os.fdopen(descriptor, "w", encoding="ascii") as lock:
                    lock.write(str(os.getpid()))
                    lock.flush()
                    os.fsync(lock.fileno())
                break
            except FileExistsError:
                try:
                    owner = int(lock_path.read_text(encoding="ascii").strip())
                    os.kill(owner, 0)
                except ProcessLookupError:
                    try:
                        lock_path.unlink()
                    except FileNotFoundError:
                        pass
                    continue
                except (OSError, ValueError):
                    # Permission errors do not prove that the owner is dead.
                    raise MediaAssetConflictError(
                        "local media object is locked by another writer"
                    ) from None
                raise MediaAssetConflictError(
                    "local media object is locked by another writer"
                ) from None
        try:
            yield
        finally:
            try:
                lock_path.unlink()
            except FileNotFoundError:
                pass
''',
    '''    @staticmethod
    def _process_start_identity(pid: int) -> str | None:
        try:
            # Linux /proc field 22 is the process start time in clock ticks. Parse after the
            # parenthesized comm field so spaces in process names cannot shift the index.
            stat_text = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
            tail = stat_text.rsplit(")", 1)[1].split()
            return tail[19]
        except (FileNotFoundError, IndexError, OSError):
            return None

    @contextmanager
    def _writer_lock(self, path: Path) -> Iterator[None]:
        lock_path = self._lock(path)
        while True:
            try:
                descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                record = {
                    "pid": os.getpid(),
                    "processStart": self._process_start_identity(os.getpid()),
                }
                with os.fdopen(descriptor, "w", encoding="utf-8") as lock:
                    json.dump(record, lock, separators=(",", ":"), sort_keys=True)
                    lock.flush()
                    os.fsync(lock.fileno())
                break
            except FileExistsError:
                try:
                    raw = lock_path.read_text(encoding="utf-8").strip()
                    try:
                        record = json.loads(raw)
                        owner = int(record["pid"])
                        owner_start = record.get("processStart")
                    except (json.JSONDecodeError, KeyError, TypeError):
                        # Read legacy PID-only locks conservatively.
                        owner = int(raw)
                        owner_start = None
                    os.kill(owner, 0)
                    current_start = self._process_start_identity(owner)
                    if (
                        owner_start is not None
                        and current_start is not None
                        and str(owner_start) != current_start
                    ):
                        try:
                            lock_path.unlink()
                        except FileNotFoundError:
                            pass
                        continue
                except ProcessLookupError:
                    try:
                        lock_path.unlink()
                    except FileNotFoundError:
                        pass
                    continue
                except (OSError, ValueError):
                    # Permission errors do not prove that the owner is dead.
                    raise MediaAssetConflictError(
                        "local media object is locked by another writer"
                    ) from None
                raise MediaAssetConflictError(
                    "local media object is locked by another writer"
                ) from None
        try:
            yield
        finally:
            try:
                lock_path.unlink()
            except FileNotFoundError:
                pass
''',
)

# P2: a manifest entry is only a cache hint. Missing/corrupt bytes fall through to the
# authoritative backend download and registerAsset repairs the immutable local destination.
remote = "app/desktop/src/main/local-storage/remote-asset-materializer.ts"
old = '''    if (local) {
      await this.storage.resolveAsset(input.projectId, input.assetId, {
        sizeBytes: local.sizeBytes,
        checksumSha256: local.checksumSha256,
      });
      return {
        assetId: local.assetId,
        kind: local.kind,
        relativePath: local.relativePath,
        sizeBytes: local.sizeBytes,
        checksumSha256: local.checksumSha256,
      };
    }
'''
new = '''    if (local) {
      try {
        await this.storage.resolveAsset(input.projectId, input.assetId, {
          sizeBytes: local.sizeBytes,
          checksumSha256: local.checksumSha256,
        });
        return {
          assetId: local.assetId,
          kind: local.kind,
          relativePath: local.relativePath,
          sizeBytes: local.sizeBytes,
          checksumSha256: local.checksumSha256,
        };
      } catch {
        // The manifest is a local cache index, not proof that bytes are still healthy.
        // Fall through to the backend handoff; registerAsset will repair matching immutable data.
      }
    }
'''
replace_once(remote, old, new)
old_narration = '''    if (local) {
      await this.storage.resolveAsset(input.projectId, input.assetId, {
        sizeBytes: input.sizeBytes,
        checksumSha256: checksum,
      });
      return {
        assetId: local.assetId,
        kind: local.kind,
        relativePath: local.relativePath,
        sizeBytes: local.sizeBytes,
        checksumSha256: local.checksumSha256,
      };
    }
'''
new_narration = '''    if (local) {
      try {
        await this.storage.resolveAsset(input.projectId, input.assetId, {
          sizeBytes: input.sizeBytes,
          checksumSha256: checksum,
        });
        return {
          assetId: local.assetId,
          kind: local.kind,
          relativePath: local.relativePath,
          sizeBytes: local.sizeBytes,
          checksumSha256: local.checksumSha256,
        };
      } catch {
        // Repair a missing/corrupt narration preview from authoritative backend bytes below.
      }
    }
'''
replace_once(remote, old_narration, new_narration)
