# Release Process

This document outlines the full release lifecycle for Freighter Mobile, covering
both standard releases and emergency hotfixes.

## Table of Contents

1. [Regular Release Flow](#regular-release-flow)
2. [Emergency Release Flow](#emergency-release-flow)
3. [Post-Merge Manual Steps](#post-merge-manual-steps)
4. [Regular vs Emergency Comparison](#regular-vs-emergency-comparison)
5. [Version Bump Details](#version-bump-details)
6. [Nightly Builds](#nightly-builds)
7. [CI/CD and Test Coverage](#cicd-and-test-coverage)
8. [GitHub App Token Setup](#github-app-token-setup)
9. [Workflow Files Reference](#workflow-files-reference)

## Regular Release Flow

Regular releases are triggered from the `main` branch. The process is
orchestrated by `new-release.yml`.

### Pipeline Diagram

```ascii
[ main ]
   |
   +-- (1) Create 'release' branch from 'main'
   |   |
   |   +-- (2) Create 'vX.Y.Z' branch from 'release'
   |       |
   |       +-- (3) Bump version (5 files)
   |       |
   |       +-- (4) Generate release notes (git log)
   |       |
   |       +-- (5) Create PR: vX.Y.Z -> release
   |       |
   |       +-- (6) Trigger iOS/Android dev builds
   |
   +-- (7) Create 'bump-version' branch from 'main'
       |
       +-- (8) Bump version (5 files)
       |
       +-- (9) Create PR: bump-version -> main
```

### Execution Steps

1. Go to GitHub Actions and select **New Release** (`new-release.yml`).
2. Click **Run workflow**.
3. Enter the `app_version` (e.g., `1.10.24`).
4. Leave `branch_from` as `main`.
5. The workflow validates the version format and ensures branches don't already
   exist.
6. Two PRs are created:
   - `vX.Y.Z` targeting `release`: This is your release candidate.
   - `bump-version` targeting `main`: This synchronizes the version back to the
     development branch.
7. Development builds for iOS and Android are automatically triggered on the
   `vX.Y.Z` branch.

## Emergency Release Flow

Emergency releases (hotfixes) are triggered from a previous release tag rather
than `main`.

### Pipeline Diagram

```ascii
[ vX.Y.Z (Tag) ]
   |
   +-- (1) Create 'emergency-release' branch from Tag
       |
       +-- (2) Create 'vX.Y.Z+1' branch from 'emergency-release'
           |
           +-- (3) Bump version (5 files)
           |
           +-- (4) Add placeholder release notes
           |
           +-- (5) Create PR: vX.Y.Z+1 -> emergency-release
```

### Execution Steps

1. Go to GitHub Actions and select **New Release** (`new-release.yml`).
2. Click **Run workflow**.
3. Enter the new `app_version`.
4. Set `branch_from` to the existing tag version (e.g., `1.9.24`).
5. One PR is created: `vX.Y.Z` targeting `emergency-release`.
6. **Note:** No automatic dev builds are triggered. Developers must push fixes
   to the `vX.Y.Z` branch and manually trigger dev builds to QA the hotfixes.

## Post-Merge Manual Steps

The release process requires manual intervention after PRs are merged.

1. **Tag the release**: Once the release PR is merged into `release` (or
   `emergency-release`), create a git tag `v{version}` on that merge commit.
2. **Trigger production builds**: Manually run `ios.yml` and `android.yml`.
   - Set `ref_name` to the release branch or tag.
   - Set `buildEnv` to `prod`.
3. **App Store / Play Store submission**:
   - iOS builds auto-upload to TestFlight.
   - Android builds auto-upload to the Google Play internal track.
   - Promotion to production tracks must be done manually in the respective
     consoles.
4. **Branch cleanup**: Delete the `release` (or `emergency-release`) branch. The
   `v{version}` and `bump-version` head branches are automatically deleted when
   their PRs are merged.
5. **Sync main**: Ensure the `bump-version` PR is merged into `main` promptly
   for regular releases.

## Regular vs Emergency Comparison

| Aspect              | Regular Release                | Emergency Release                      |
| :------------------ | :----------------------------- | :------------------------------------- |
| `branch_from` input | `main`                         | A tag (e.g., `1.9.24`)                 |
| Release branch      | `release`                      | `emergency-release`                    |
| Version branch      | `v{version}`                   | `v{version}`                           |
| PR target           | `release`                      | `emergency-release`                    |
| Release notes       | Auto-generated from git log    | Placeholder (manual edit needed)       |
| Bump-version PR     | Yes (`bump-version` -> `main`) | No                                     |
| Auto dev builds     | Yes (iOS + Android)            | No                                     |
| Nightly build skip  | Yes (while `release` exists)   | Yes (while `emergency-release` exists) |

## Version Bump Details

The `scripts/set-app-version` script modifies the following files to ensure
version parity across platforms:

- `package.json`: Updates the `version` field.
- `android/app/build.gradle`: Updates `versionName`.
- `ios/freighter-mobile/Info.plist`: Updates `CFBundleShortVersionString`.
- `ios/freighter-mobile/Info-Dev.plist`: Updates `CFBundleShortVersionString`.
- `ios/freighter-mobile.xcodeproj/project.pbxproj`: Updates `MARKETING_VERSION`.

To manually set the version locally (e.g., for testing), run:

```bash
yarn set-app-version 1.10.24
```

## Nightly Builds

The `ios.yml` and `android.yml` workflows run daily at 8:00 AM UTC.

- They check for the existence of a `release` or `emergency-release` branch.
- If either branch exists, the nightly build is skipped.
- This prevents automated builds from overwriting a release candidate currently
  undergoing testing in TestFlight or Google Play.

## CI/CD and Test Coverage

All release-related branches (`release`, `emergency-release`, `v*.*.*`) and PRs
targeting them trigger the following suites:

- **Unit Tests (`test.yml`)**: Runs `yarn test --ci`.
- **iOS E2E (`ios-e2e.yml`)**: Runs Maestro tests on macOS.
- **Android E2E (`android-e2e.yml`)**: Runs Maestro tests on Linux with an
  emulator.

## GitHub App Token Setup (Pending)

GitHub restricts the `GITHUB_TOKEN` from triggering further workflow runs (like
tests) when a PR is created by a bot. This means the release and bump-version
PRs created by `new-release.yml` will not automatically trigger test or E2E
workflows.

**Current workaround:** After the release workflow creates the PRs, manually
push an empty commit to the PR branch to trigger tests:

```bash
git checkout v1.10.24
git commit --allow-empty -m "Trigger Tests"
git push
```

**Planned fix:** A dedicated GitHub App will be configured so that PRs created
by the release workflow will trigger tests automatically.

## Workflow Files Reference

| File                                              | Purpose                                        |
| :------------------------------------------------ | :--------------------------------------------- |
| `.github/workflows/new-release.yml`               | Release orchestrator (branches, PRs, triggers) |
| `.github/workflows/ios.yml`                       | iOS build and TestFlight upload                |
| `.github/workflows/android.yml`                   | Android build and Google Play upload           |
| `.github/workflows/test.yml`                      | Jest unit tests                                |
| `.github/workflows/ios-e2e.yml`                   | Maestro iOS E2E tests                          |
| `.github/workflows/android-e2e.yml`               | Maestro Android E2E tests                      |
| `.github/actions/validate-branch-from/action.yml` | Input validation for release source            |
| `scripts/set-app-version`                         | Multi-platform version update script           |
| `scripts/generate-release-notes.sh`               | Git log based release notes generator          |
| `fastlane/Fastfile`                               | Build lanes for iOS and Android                |
