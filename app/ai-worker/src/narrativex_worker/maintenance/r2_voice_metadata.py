"""Repair SHA-256 metadata on an existing R2 voice-reference object.

This maintenance command is for legacy objects that predate the immutable upload path.
Runtime downloads remain fail-closed when integrity metadata is absent or invalid.
"""

from __future__ import annotations

import argparse
import hashlib
from typing import Any, Protocol

from narrativex_worker.config import get_settings
from narrativex_worker.narration.storage import MediaAssetConflictError, S3MediaStorage


class S3RepairClient(Protocol):
    def get_object(self, **kwargs: Any) -> dict[str, Any]: ...

    def copy_object(self, **kwargs: Any) -> dict[str, Any]: ...

    def head_object(self, **kwargs: Any) -> dict[str, Any]: ...


def repair_object_metadata(
    client: S3RepairClient,
    *,
    bucket: str,
    storage_key: str,
) -> dict[str, str | int]:
    response = client.get_object(Bucket=bucket, Key=storage_key)
    body = response["Body"]
    digest = hashlib.sha256()
    total = 0
    try:
        while chunk := body.read(1024 * 1024):
            data = bytes(chunk)
            digest.update(data)
            total += len(data)
    finally:
        body.close()

    content_length = int(response.get("ContentLength", -1))
    if content_length < 0 or total != content_length:
        raise MediaAssetConflictError(
            f"stored object {storage_key} changed or has an invalid content length"
        )

    checksum = digest.hexdigest()
    content_type = str(response.get("ContentType") or "application/octet-stream")
    metadata = {str(key): str(value) for key, value in response.get("Metadata", {}).items()}

    if metadata.get("sha256", "").lower() != checksum:
        repaired_metadata = dict(metadata)
        repaired_metadata["sha256"] = checksum
        client.copy_object(
            Bucket=bucket,
            Key=storage_key,
            CopySource={"Bucket": bucket, "Key": storage_key},
            MetadataDirective="REPLACE",
            Metadata=repaired_metadata,
            ContentType=content_type,
        )

        verified = client.head_object(Bucket=bucket, Key=storage_key)
        verified_metadata = {
            str(key): str(value) for key, value in verified.get("Metadata", {}).items()
        }
        if verified_metadata.get("sha256", "").lower() != checksum:
            raise MediaAssetConflictError(
                f"stored object {storage_key} sha256 metadata repair could not be verified"
            )
        if int(verified.get("ContentLength", -1)) != content_length:
            raise MediaAssetConflictError(
                f"stored object {storage_key} size changed during metadata repair"
            )

    return {
        "storageKey": storage_key,
        "sha256": checksum,
        "sizeBytes": content_length,
        "contentType": content_type,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "storage_key",
        help="R2 object key to repair, for example narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    storage = S3MediaStorage(get_settings())
    result = repair_object_metadata(
        storage.client,
        bucket=storage.bucket,
        storage_key=args.storage_key,
    )
    print(
        "Repaired R2 voice metadata "
        f"storageKey={result['storageKey']} "
        f"sizeBytes={result['sizeBytes']} "
        f"sha256={result['sha256']}"
    )


if __name__ == "__main__":
    main()
