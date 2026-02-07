# EC2 Deployment Guide

## Prerequisites

- Raw Ubuntu EC2 instance
- SSH key configured (`ssh -i key.pem ubuntu@ec2-ip` works)
- EC2 security group: allow inbound TCP 22 (SSH) and 3000 (app)

## Quick Deploy

1. **Create `.env.production`** in the project root:

```bash
cp scripts/env.example .env.production
# Edit .env.production with your real keys
```

2. **Run the deploy script** from your local machine. EC2 uses SSH key auth (no password):

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh -i ~/.ssh/your-ec2-key.pem ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com
```

Or set the key once and run with just the host:

```bash
export SSH_KEY=~/.ssh/your-ec2-key.pem
./scripts/deploy.sh ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com
```

3. **Open the app** at `http://<ec2-public-ip>:3000`

## What the Script Does

1. Installs Node.js 20, git, PM2 on Ubuntu
2. Clones the repo from GitHub to `/opt/copilot`
3. Copies `.env.production` to the server
4. Runs `npm ci && npm run build`
5. Starts the app with PM2 (restarts on reboot)

## Useful Commands (run via SSH)

```bash
ssh ubuntu@ec2-ip

# App status
pm2 status

# Logs
pm2 logs copilot

# Restart
pm2 restart copilot

# Stop
pm2 stop copilot
```

## Re-deploy (update code)

Run the same script again. It will `git pull` and rebuild:

```bash
./scripts/deploy.sh ubuntu@ec2-ip
```

## Troubleshooting

### "Can't open the page" / "Server dropped connection"

**Cause:** EC2 Security Group is blocking inbound traffic on port 3000.

**Fix:** In AWS Console → EC2 → Security Groups → select your instance's security group → **Edit inbound rules** → **Add rule**:
- Type: Custom TCP
- Port: 3000
- Source: Anywhere IPv4 (0.0.0.0/0) or your IP for added security
- Save

---

## Optional: Nginx + SSL

For production with HTTPS, add Nginx as a reverse proxy:

1. Install Nginx on EC2
2. Configure to proxy `:80` → `localhost:3000`
3. Use Let's Encrypt (certbot) for SSL
4. Update security group: allow 80, 443

See `docs/integrations/` for external service setup.
