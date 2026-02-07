# Open Port 3000 for EC2 (Required)

The app binds to port 3000. AWS Security Groups block it by default. You must add an inbound rule.

## Option A: AWS Console (Manual)

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Instances** → select your instance (`54.146.102.189`)
3. Open the **Security** tab → click the **Security group** link (e.g. `sg-xxxxx`)
4. Click **Edit inbound rules**
5. **Add rule**:
   - **Type:** Custom TCP
   - **Port range:** 3000
   - **Source:** Anywhere IPv4 (`0.0.0.0/0`)
6. **Save rules**

## Option B: AWS CLI

```bash
# Configure AWS CLI first (one-time)
aws configure

# Run the script
./scripts/open-port-3000.sh 54.146.102.189
```

---

After opening the port, test: **http://54.146.102.189:3000**
