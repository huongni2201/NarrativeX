"""Compatibility import for the SQLite journal adapter."""

from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)

ExecutionJournal = SqliteExecutionJournalAdapter

__all__ = ["ExecutionJournal"]
