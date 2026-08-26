#!/usr/bin/env python3
"""Deterministic regression tests for the local secret scanner."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "check-secrets.py"
SPEC = importlib.util.spec_from_file_location("check_secrets", CHECKER_PATH)
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECKER
SPEC.loader.exec_module(CHECKER)


class SecretScannerTest(unittest.TestCase):
    def rule_ids(self, text: str, path: str = "fixture.txt") -> set[str]:
        return {item.rule_id for item in CHECKER.scan_text(Path(path), text)}

    def test_provider_specific_credential_classes_are_detected(self) -> None:
        self.assertIn("google-api-key", self.rule_ids("key=" + "AIza" + "A" * 35))
        self.assertIn("google-oauth-client-secret", self.rule_ids("GOCSPX-" + "a" * 24))
        self.assertIn(
            "gcp-service-account-private-key",
            self.rule_ids(
                '{"type":"service_account","private_key":"'
                + "-----BEGIN PRIVATE KEY-----\\n"
                + "A" * 48
                + "\\n-----END PRIVATE KEY-----" + '"}',
                "credentials.json",
            ),
        )
        self.assertIn(
            "cloudflare-tunnel-token",
            self.rule_ids("CLOUDFLARE_TUNNEL_TOKEN=" + "cf-token-" + "a" * 24, ".env.example"),
        )

    def test_cloud_and_messaging_tokens_are_detected(self) -> None:
        aws_access_key = "AWS_ACCESS_KEY_ID=AKIA" + "A" * 16
        r2_secret = "R2_SECRET_ACCESS_KEY=" + "s" * 40
        self.assertIn("aws-or-r2-access-key-id", self.rule_ids(aws_access_key))
        self.assertIn("aws-or-r2-access-key-assignment", self.rule_ids(aws_access_key, ".env.production"))
        self.assertIn("aws-or-r2-secret-access-key", self.rule_ids(r2_secret, ".env.production"))
        self.assertIn("github-token", self.rule_ids("token=ghp_" + "g" * 30))
        self.assertIn("slack-token", self.rule_ids("token=xoxb-" + "1" * 24))

    def test_bearer_jwt_database_and_pem_credentials_are_detected(self) -> None:
        bearer = "Authorization: Bearer " + "b" * 28
        jwt = "eyJ" + "a" * 20 + "." + "b" * 20 + "." + "c" * 20
        database_url = "postgresql://user:supersecret@db.internal:5432/narrativex"  # secret-scan: allow
        pem = (
            "-----BEGIN RSA PRIVATE KEY-----\n"
            + "A" * 48
            + "\n-----END RSA PRIVATE KEY-----"
        )
        self.assertIn("authorization-bearer-token", self.rule_ids(bearer))
        self.assertIn("jwt-like-token", self.rule_ids(jwt))
        self.assertIn("database-url-inline-password", self.rule_ids(database_url))
        self.assertIn("pem-private-key", self.rule_ids(pem))

    def test_named_env_credentials_are_detected(self) -> None:
        self.assertIn(
            "env-credential-assignment",
            self.rule_ids("EXAMPLE_REFRESH_TOKEN=" + "r" * 32, ".env.production"),
        )

    def test_placeholders_and_environment_references_are_ignored(self) -> None:
        safe = "\n".join(
            (
                "CLOUDFLARE_TUNNEL_TOKEN=${ENV_VAR}",
                "R2_SECRET_ACCESS_KEY=<redacted>",
                "GOOGLE_OAUTH_CLIENT_SECRET=replace-with-client-secret",
                "DB_PASSWORD=change-me-local-only",
                "postgresql://user:${DB_PASSWORD}@postgres:5432/narrativex",
            )
        )
        self.assertEqual(self.rule_ids(safe, ".env.example"), set())

    def test_explicit_safe_fixture_marker_is_respected(self) -> None:
        fixture_value = "GOCSPX-" + "a" * 24 + " # secret-scan: allow"
        self.assertEqual(self.rule_ids(fixture_value), set())

    def test_uuid_and_hash_values_are_not_flagged(self) -> None:
        text = (
            "id=550e8400-e29b-41d4-a716-446655440000\n"
            + "sha256="
            + "a" * 64
        )
        self.assertEqual(self.rule_ids(text), set())

    def test_binary_files_are_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "binary.dat"
            path.write_bytes(b"\x00AIza" + b"A" * 35)
            self.assertEqual(CHECKER.scan_path(path), [])

    @patch.object(CHECKER.subprocess, "run")
    def test_tracked_production_env_detection_checks_any_matching_file(
        self, run: Mock
    ) -> None:
        run.return_value.stdout = "README.md\napp/.env.production\n"
        self.assertTrue(CHECKER.prod_env_is_tracked())


if __name__ == "__main__":
    unittest.main()
