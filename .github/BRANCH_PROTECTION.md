# Required review and regression gate

The P6 configuration for `main` requires `Journal required checks` from the GitHub Actions app (app ID 15368), with the branch up to date. That job runs even when its dependency fails, is cancelled or is skipped; it accepts only `success`.

The journal workflow runs for every pull request to `main`, pushes to `main`, merge groups and manual dispatch. It checks source/artifact drift before build, V6 financial/storage/lifecycle regressions, deliberate financial mutations, root unit/type/build/API tests, V6 browser suites, two-tab Classic/V6 sync with both transports, Classic sample-clear/reset, and cloud sync ownership/conflicts. Tests use isolated synthetic journals.

Branch protection also requires at least one approving review, code-owner review, dismissal of stale approvals, approval of the latest push by another reviewer, and resolved conversations. It applies to administrators and disallows force pushes and deletions. `schema/` and `src/core/` are owned by `@Tuand2222` in CODEOWNERS. CODEOWNERS on the base branch takes effect after the PR containing it is approved and merged.

Before P6, API inspection returned “Branch not protected” and an empty ruleset list. The P6 evidence report records the actual API response after configuration, the deliberately failing PR revision, and the corrected revision's CI. Do not substitute local test success for remote CI evidence.

GitHub documentation: [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

Do not bypass these controls or merge on an AI's own approval. Keep existing controls if the project later adds a ruleset or other required checks.
