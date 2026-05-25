# Security Policy

## Reporting a Vulnerability

If you find a security issue, do not open a public issue.

Contact:

- Email: security@urbanmotion.web.id
- Owner: Adhim Musafak

Include:

- Affected endpoint or feature
- Steps to reproduce
- Impact
- Screenshots/logs if available

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Security Practices

- Never commit `.env` files.
- Rotate OAuth secrets if they are exposed.
- Use HTTPS in production.
- Use strong `JWT_SECRET`.
- Use strict CORS.
- Keep dependencies updated.
