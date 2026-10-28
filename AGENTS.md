# ChronoNav engineering rules

These rules apply to the entire repository. Read `CONTRIBUTING.md` before changing code.

- Record every product, bug-fix, or engineering-process change in `CHANGELOG.md` under `Unreleased`, in the same commit as the change. Keep unreleased work separate from shipped versions.
- Use the existing `docs/release-checklist.md` for release gates. Record actual test results and outstanding manual checks in the corresponding changelog entry; never infer browser success from mocked tests.
- Put repeatable Node regression tests in `scripts/test-*.cjs`. Reproduce behavioral bugs before fixing them and run relevant tests afterward.
- Validate the actual commit contents when the working tree contains unrelated changes. Do not stage unrelated files or hunks.
- Use `brownielab/fix-<topic>` for bug-fix branches and English Conventional Commit messages, such as `fix(timeline): preserve first-message timestamps`.
- Preserve opt-in Time Context, narrow permissions, and the privacy promises in `PRIVACY.md`. Never invent timestamps for historical messages.
- Keep source, public documentation, and store descriptions consistent when changing behavior. Historical case-study quotations remain historical records.
- Do not commit temporary diagnostics, private chats, credentials, or generated release archives.
- Before a release, complete the checklist, set the manifest version, move the verified changelog entries into a dated version section, and package that exact commit.
- A pushed fix branch is not a published release. Report any unverified browser behavior explicitly.
