## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see
[Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios upload_build

```sh
[bundle exec] fastlane ios upload_build
```

### ios dev

```sh
[bundle exec] fastlane ios dev
```

Push a new Dev build to TestFlight

### ios prod

```sh
[bundle exec] fastlane ios prod
```

Push a new Prod build to TestFlight

---

## Android

### android upload_build

```sh
[bundle exec] fastlane android upload_build
```

### android dev

```sh
[bundle exec] fastlane android dev
```

Push a new Dev build to the Google Play

### android prod

```sh
[bundle exec] fastlane android prod
```

Push a new Prod build to the Google Play

---

This README.md is auto-generated and will be re-generated every time
[_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on
[fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on
[docs.fastlane.tools](https://docs.fastlane.tools).
