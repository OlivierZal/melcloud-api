# Security policy

## Supported versions

Only the latest minor release on the current major line receives security fixes. Older majors are not supported — please upgrade.

| Version | Supported          |
| ------- | ------------------ |
| 37.x    | :white_check_mark: |
| < 37    | :x:                |

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:

1. Go to <https://github.com/OlivierZal/melcloud-api/security/advisories/new>
2. Submit a draft advisory describing the issue, reproduction steps, and the affected versions

You can expect an initial acknowledgement within **7 days**. If a fix is warranted, a patch release and a GitHub Security Advisory will be published once a coordinated disclosure date has been agreed.

## Scope

This package handles MELCloud user credentials and API tokens. Reports of particular interest include:

- Credential or token leakage (logs, error messages, persisted state)
- Authentication bypass or session hijacking
- Misuse of the `shouldVerifySSL: false` opt-out enabling unintended trust
- Validation drift allowing untrusted server payloads to reach consumers as typed data
