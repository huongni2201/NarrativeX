# Main branch protection

Branch protection is a GitHub repository setting and cannot be enforced by a committed file.
The repository workflows provide the checks that should be required before merging.

For `main`, configure a ruleset or branch protection rule with:

- pull requests required before merging;
- required status check: `Backend / Java 25 / Maven`;
- required status check: `Frontend / Node 22 / Next.js`;
- required status check: `Security Checks / Repository secret scan`;
- stale approvals dismissed when new commits are pushed;
- direct pushes restricted to maintainers or release automation.

Keep these check names synchronized with `.github/workflows/backend-ci.yml` and
`.github/workflows/frontend-ci.yml`.
