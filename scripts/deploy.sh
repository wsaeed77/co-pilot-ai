#!/bin/bash
#
# Deploy Prometheus Call Copilot to a raw Ubuntu EC2 instance.
# Uses SSH key authentication (EC2 requires key-based auth).
#
# Run locally:
#   ./scripts/deploy.sh -i ~/.ssh/your-key.pem ubuntu@ec2-hostname
#
# Or set SSH_KEY env var:
#   export SSH_KEY=~/.ssh/your-key.pem
#   ./scripts/deploy.sh ubuntu@ec2-hostname
#

set -e

if [[ $# -eq 0 ]]; then
  echo "Usage: ./scripts/deploy.sh -i /path/to/key.pem user@hostname"
  echo ""
  echo "EC2 uses key-based SSH (no password). You must specify your .pem key:"
  echo "  ./scripts/deploy.sh -i ~/.ssh/my-ec2-key.pem ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com"
  echo ""
  echo "Or set SSH_KEY and pass only the host:"
  echo "  export SSH_KEY=~/.ssh/my-ec2-key.pem"
  echo "  ./scripts/deploy.sh ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com"
  exit 1
fi

# Last arg = target, rest = ssh options (e.g. -i key.pem)
TARGET="${*: -1}"
SSH_OPTS=("${@:1:$#-1}")

# If SSH_KEY env is set and no -i was passed, use it
if [[ -n "$SSH_KEY" && "$*" != *"-i"* ]]; then
  SSH_OPTS=(-i "$SSH_KEY")
fi
APP_DIR="/opt/copilot"
REPO_URL="https://github.com/wsaeed77/co-pilot-ai.git"

echo ">>> Deploying to $TARGET"
echo ">>> App will be installed at $APP_DIR"
echo ""

# Step 1: Bootstrap Ubuntu (Node.js, git, PM2)
echo ">>> [1/5] Bootstrapping Ubuntu..."
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s << 'BOOTSTRAP'
set -e
export DEBIAN_FRONTEND=noninteractive

# Update and install base packages
sudo apt-get update -qq
sudo apt-get install -y -qq curl git

# Install Node.js 20 (NodeSource)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi

echo "Node $(node -v) | npm $(npm -v)"

# Install PM2 globally
sudo npm install -g pm2 --silent 2>/dev/null || true
BOOTSTRAP

# Step 2: Clone or pull repo
echo ""
echo ">>> [2/5] Syncing code..."
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s << SCRIPT
set -e
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR
  sudo git fetch origin
  sudo git reset --hard origin/main
  sudo git pull origin main
else
  sudo mkdir -p $(dirname $APP_DIR)
  sudo git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi
SCRIPT

# Step 3: Copy env file if it exists locally
echo ""
echo ">>> [3/5] Environment..."
if [ -f ".env.production" ]; then
  echo "    Copying .env.production to server"
  scp "${SSH_OPTS[@]}" .env.production "$TARGET:/tmp/copilot.env"
  ssh "${SSH_OPTS[@]}" "$TARGET" "sudo mv /tmp/copilot.env $APP_DIR/.env.local && sudo chown \$(whoami):\$(whoami) $APP_DIR/.env.local"
else
  echo "    WARNING: No .env.production found. Create it with:"
  echo "    OPENAI_API_KEY=..."
  echo "    DEEPGRAM_API_KEY=..."
  echo "    NEXT_PUBLIC_SUPABASE_URL=..."
  echo "    SUPABASE_SERVICE_ROLE_KEY=..."
  echo ""
  read -p "    Continue without env? App will fail at runtime. [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "    Create .env.production and run again."
    exit 1
  fi
fi

# Step 4: Install deps and build
echo ""
echo ">>> [4/5] Building..."
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s << 'BUILD'
set -e
cd /opt/copilot
sudo chown -R $(whoami):$(whoami) .
npm ci --silent
npm run build
BUILD

# Step 5: Start with PM2
echo ""
echo ">>> [5/5] Starting app..."
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s << 'START'
set -e
cd /opt/copilot
pm2 delete copilot 2>/dev/null || true
HOST=0.0.0.0 pm2 start npm --name copilot -- start
pm2 save
pm2 startup systemd -u $(whoami) --hp /home/$(whoami) 2>/dev/null || echo "Run 'pm2 startup' manually if needed"
START

HOST_IP=$(echo $TARGET | cut -d@ -f2)
echo ""
echo ">>> Done. App is running at http://$HOST_IP:3000"
echo ""
echo ">>> If the page won't load: open port 3000 in EC2 Security Group"
echo "    AWS Console → EC2 → Security Groups → Your instance's SG → Edit inbound rules"
echo "    Add: Type=Custom TCP, Port=3000, Source=0.0.0.0/0"
echo ""
echo ">>> Or run: ./scripts/open-port-3000.sh $HOST_IP  (requires: aws configure)"
echo ""
echo ">>> Check status: ssh ${SSH_OPTS[*]} $TARGET 'pm2 status'"
echo ">>> View logs:   ssh ${SSH_OPTS[*]} $TARGET 'pm2 logs copilot'"
