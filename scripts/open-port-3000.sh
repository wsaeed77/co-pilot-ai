#!/bin/bash
#
# Open port 3000 in the EC2 security group so the app is reachable.
# Requires: AWS CLI configured (aws configure)
#
# Usage: ./scripts/open-port-3000.sh [instance-ip]
#   Default IP: 54.146.102.189
#

set -e

IP="${1:-54.146.102.189}"

echo ">>> Finding instance and security group for $IP..."

# Get instance ID and security group
OUT=$(aws ec2 describe-instances \
  --filters "Name=ip-address,Values=$IP" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].[InstanceId,SecurityGroups[0].GroupId]" \
  --output text 2>/dev/null)

if [[ -z "$OUT" || "$OUT" == "None"* ]]; then
  # Try by public IP in instance data
  OUT=$(aws ec2 describe-instances \
    --query "Reservations[*].Instances[?PublicIpAddress=='$IP'].[InstanceId,SecurityGroups[0].GroupId]" \
    --output text 2>/dev/null | head -1)
fi

if [[ -z "$OUT" || "$OUT" == "None"* ]]; then
  echo "Could not find instance. Is AWS CLI configured? Run: aws configure"
  echo "Or add the rule manually in AWS Console: EC2 → Security Groups → Inbound rules → Add TCP 3000"
  exit 1
fi

INSTANCE_ID=$(echo "$OUT" | awk '{print $1}')
SG_ID=$(echo "$OUT" | awk '{print $2}')

echo ">>> Instance: $INSTANCE_ID"
echo ">>> Security Group: $SG_ID"

# Check if rule already exists
EXISTS=$(aws ec2 describe-security-groups \
  --group-ids "$SG_ID" \
  --query "SecurityGroups[0].IpPermissions[?FromPort==\`3000\`]" \
  --output text 2>/dev/null)

if [[ -n "$EXISTS" ]]; then
  echo ">>> Port 3000 is already open."
  exit 0
fi

echo ">>> Adding inbound rule: TCP 3000 from 0.0.0.0/0..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0

echo ">>> Done. App should be reachable at http://$IP:3000"
