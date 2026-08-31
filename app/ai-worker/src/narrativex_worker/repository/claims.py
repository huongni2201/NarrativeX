"""Claim and lease repository seam.

Compatibility re-export for callers that still import from this module. Keep the
public facade here so claim-owner fencing and analysis-preference hydration are
never bypassed by an alternate import path.
"""

from narrativex_worker.repository import WorkerRepository

__all__ = ["WorkerRepository"]
