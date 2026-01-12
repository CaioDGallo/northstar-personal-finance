# Test Coverage Baseline

## Scope
This document captures current coverage highlights and known gaps to guide the testing roadmap.

## Current Coverage (January 12, 2026)
- Integration tests for core server actions: expenses, income, transfers, budgets, faturas, calendar, tasks, notifications, and dashboard.
- Component tests for dashboard and calendar-related UI.
- Utility tests for recurrence, timezones, and parsers.

## Known Gaps
- Component coverage for finance forms (transactions, transfers, budgets).
- Auth and onboarding action coverage for boundary cases.
- API route edge cases and error handling.
- Minimal smoke coverage for full user journeys (Playwright).

## Target Areas
- Close UI form coverage for finance flows.
- Expand integration and component coverage for auth/access and settings.
- Add lightweight E2E smoke flows once fixtures are stable.
