export interface MaterializedReferenceResult {
  checksumSha256: string;
}

export class GeminiReferenceMaterializer {
  private readonly inFlight = new Map<string, Promise<void>>();

  async materialize(
    input: { projectId: string; assetId: string; expectedChecksumSha256: string },
    materializeRemoteAsset: (input: { projectId: string; assetId: string }) => Promise<MaterializedReferenceResult>,
  ): Promise<void> {
    const key = `${input.projectId}:${input.assetId}:${input.expectedChecksumSha256}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const operation = (async () => {
      const result = await materializeRemoteAsset({
        projectId: input.projectId,
        assetId: input.assetId,
      });
      if (result.checksumSha256 !== input.expectedChecksumSha256) {
        throw new Error(
          `REFERENCE_INTEGRITY_FAILED: ${input.assetId} materialized checksum does not match the prepared snapshot.`,
        );
      }
    })();
    this.inFlight.set(key, operation);
    try {
      await operation;
    } catch (error) {
      this.inFlight.delete(key);
      throw error;
    }
  }
}
