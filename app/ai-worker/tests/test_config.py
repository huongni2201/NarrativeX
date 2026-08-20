from narrativex_worker.config import WorkerSettings


def test_r2_endpoint_is_derived_from_account_id() -> None:
    settings = WorkerSettings(
        _env_file=None,
        R2_ACCOUNT_ID="account-123",
        R2_ACCESS_KEY_ID="access-key",
        R2_SECRET_ACCESS_KEY="secret-key",
        R2_BUCKET="narrativex-dev",
    )

    assert settings.resolved_r2_endpoint == "https://account-123.r2.cloudflarestorage.com"
    assert settings.r2_bucket == "narrativex-dev"
    assert settings.r2_access_key_id is not None
    assert settings.r2_access_key_id.get_secret_value() == "access-key"
    assert settings.r2_secret_access_key is not None
    assert settings.r2_secret_access_key.get_secret_value() == "secret-key"


def test_explicit_r2_endpoint_is_normalized() -> None:
    settings = WorkerSettings(
        _env_file=None,
        R2_ACCOUNT_ID="ignored-account",
        R2_ENDPOINT="https://example.r2.cloudflarestorage.com/",
    )

    assert settings.resolved_r2_endpoint == "https://example.r2.cloudflarestorage.com"


def test_r2_endpoint_is_none_without_endpoint_or_account() -> None:
    settings = WorkerSettings(_env_file=None)

    assert settings.resolved_r2_endpoint is None
