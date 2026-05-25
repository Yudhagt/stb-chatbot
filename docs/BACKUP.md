# Database Backup

Basic daily backup example:

```bash
mkdir -p /var/backups/urbanmotion-ai
pg_dump "postgresql://urbanmotion_prod:STRONG_PASSWORD@127.0.0.1:5432/urbanmotion_ai" \
  | gzip > /var/backups/urbanmotion-ai/urbanmotion_ai_$(date +%F).sql.gz
```

Add to cron:

```bash
crontab -e
```

```cron
0 2 * * * pg_dump "postgresql://urbanmotion_prod:STRONG_PASSWORD@127.0.0.1:5432/urbanmotion_ai" | gzip > /var/backups/urbanmotion-ai/urbanmotion_ai_$(date +\%F).sql.gz
```
