# Production Checklist

## Local Final Test

- [ ] Register email/password
- [ ] Email verification
- [ ] Login email/password
- [ ] Forgot password
- [ ] Reset password
- [ ] Google OAuth local
- [ ] GitHub OAuth local
- [ ] Chat text
- [ ] Upload PDF/DOCX/code file
- [ ] GitHub repo context
- [ ] Rename chat
- [ ] Delete chat
- [ ] Delete all chats
- [ ] Settings profile
- [ ] Avatar upload
- [ ] Admin dashboard
- [ ] Suspend user
- [ ] Custom daily limit
- [ ] Reset user usage

## Production Security

- [ ] `JWT_SECRET` is random and 64+ characters
- [ ] `DATABASE_URL` uses a strong password
- [ ] `.env` is not committed
- [ ] OAuth secrets are not committed
- [ ] CORS only allows production domain
- [ ] HTTPS is active
- [ ] SMTP works
- [ ] X5Lab token is valid
- [ ] Upload limits work
- [ ] Repo scan limit works
- [ ] Health check works

## Legal

- [ ] LICENSE
- [ ] SECURITY.md
- [ ] PRIVACY.md
- [ ] TERMS.md

## Monitoring

- [ ] PM2 process saved
- [ ] Nginx logs checked
- [ ] API logs checked
- [ ] Uptime monitoring configured
- [ ] Database backup configured
