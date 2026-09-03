import json

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import _parse_image_references
from narrativex_worker.image_generation_worker import _partition_batches
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest, ImageReference
from narrativex_worker.providers.vertex_image_reference_batch import _reference_request_body
from narrativex_worker.schema import ImageAspectRatio


def _reference(asset_id: str, checksum: str, name: str = "Lan") -> ImageReference:
    return ImageReference(
        asset_id=asset_id,
        character_name=name,
        role="IDENTITY",
        storage_key=f"private/references/{asset_id}.png",
        mime_type="image/png",
        sha256=checksum,
    )


def _request(
    *references: ImageReference, prompt: str = "Lan in a rainy alley"
) -> ImageGenerationRequest:
    return ImageGenerationRequest(
        request_fingerprint="f" * 64,
        prompt=prompt,
        negative_prompt="watermark",
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
        provider_key="vertex",
        model_key="gemini-2.5-flash-image",
        location="global",
        references=tuple(references),
    )


def test_snapshot_parser_rebuilds_selected_private_references() -> None:
    snapshot = json.dumps(
        {
            "characters": [
                {
                    "canonicalName": "Lan",
                    "references": [
                        {
                            "assetId": "11111111-1111-1111-1111-111111111111",
                            "role": "IDENTITY",
                            "priority": 0,
                            "storageKey": "private/characters/lan.png",
                            "contentType": "image/png",
                            "sha256": "a" * 64,
                        }
                    ],
                }
            ]
        }
    )

    references = _parse_image_references(snapshot)

    assert references == (
        ImageReference(
            asset_id="11111111-1111-1111-1111-111111111111",
            character_name="Lan",
            role="IDENTITY",
            storage_key="private/characters/lan.png",
            mime_type="image/png",
            sha256="a" * 64,
        ),
    )


def test_vertex_batch_body_interleaves_identity_labels_and_file_data() -> None:
    reference = _reference("11111111-1111-1111-1111-111111111111", "a" * 64)
    item = ImageBatchItem("beat-1", _request(reference))
    settings = WorkerSettings(vertex_image_batch_gcs_bucket="narrativex-stage")

    body = _reference_request_body(item, settings)
    parts = body["contents"][0]["parts"]  # type: ignore[index]

    assert parts[0]["text"].startswith("Character identity reference for Lan")
    assert parts[1] == {
        "fileData": {
            "fileUri": "gs://narrativex-stage/narrativex/image-batches/references/aa/" + "a" * 64,
            "mimeType": "image/png",
        }
    }
    assert "Lan in a rainy alley" in parts[-1]["text"]
    assert "watermark" in parts[-1]["text"]


def test_batch_partition_treats_reference_identity_as_part_of_provider_body() -> None:
    first = ImageBatchItem(
        "beat-1",
        _request(_reference("11111111-1111-1111-1111-111111111111", "a" * 64)),
    )
    second = ImageBatchItem(
        "beat-2",
        _request(_reference("22222222-2222-2222-2222-222222222222", "b" * 64)),
    )

    batches = _partition_batches([first, second], 50)

    assert len(batches) == 1
    assert [item.item_key for item in batches[0]] == ["beat-1", "beat-2"]


def test_snapshot_parser_never_forwards_more_than_three_references() -> None:
    snapshot = json.dumps(
        {
            "characters": [
                {
                    "canonicalName": "Lan",
                    "references": [
                        {
                            "assetId": f"00000000-0000-0000-0000-00000000000{index}",
                            "role": "IDENTITY",
                            "priority": index,
                            "storageKey": f"private/ref-{index}.png",
                            "contentType": "image/png",
                            "sha256": str(index) * 64,
                        }
                        for index in range(1, 5)
                    ],
                }
            ]
        }
    )

    assert len(_parse_image_references(snapshot)) == 3
