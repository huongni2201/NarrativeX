# Test Credentials Rule

When performing automated or manual testing, browser verification, or API testing,
read the disposable test account from the process environment:

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

Use an ignored `.env.e2e.local` file for local development, or GitHub Actions
Secrets for CI. Never commit, paste, print, or hardcode the values. If the
account is reusable or can access real data, rotate its password and revoke
active sessions before using it again.

Playwright authenticated tests use `e2e/global-setup.ts` to log in once and save
an ignored `playwright/.auth/user.json` storage state. This skips repeating the
login screen in each test while preserving the real Spring Security session and
CSRF contract; never add a development-only authentication bypass.
