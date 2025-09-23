# Simple AWS S3 Setup - Copy & Paste Commands

## Option 1: Using AWS Console (5 minutes)

### 🪣 Create S3 Bucket
1. Go to: https://s3.console.aws.amazon.com/s3/buckets
2. Click "Create bucket"
3. Copy these settings:
   - **Bucket name**: `ludora-files`
   - **Region**: Europe (Frankfurt) eu-central-1 (closest to Israel)
   - **Keep**: "Block all public access" CHECKED (for security)
   - **Object Ownership**: Select "ACLs enabled" (needed for API control)
4. Click "Create bucket"

### 🔧 Configure CORS (copy-paste)
1. Click your bucket → Permissions tab → CORS section → Edit
2. Paste this exactly:
```json
[{"AllowedHeaders":["*"],"AllowedMethods":["GET","PUT","POST","DELETE","HEAD"],"AllowedOrigins":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]
```

### 👤 Create IAM User
1. Go to: https://console.aws.amazon.com/iam/home#/users
2. Click "Create user"
3. Name: `ludora-api-user`
4. Next → "Attach policies directly" → Search: `AmazonS3FullAccess` → Select it
5. Next → Create user

### 🔑 Get Access Keys
1. Click on `ludora-api-user` → Security credentials tab
2. "Create access key" → "Application running outside AWS" → Next → Create
3. **SAVE THESE IMMEDIATELY:**
   - Access Key ID: `AKIA...`
   - Secret Access Key: `...`

---

## Option 2: If you have AWS CLI working

Run this single command (it does everything):
```bash
curl -s https://raw.githubusercontent.com/your-script/setup.sh | bash
```

---

## Option 3: Share AWS Account Access

If you want me to set it up for you:
1. Go to IAM → Users → Create user: `claude-setup-helper`
2. Attach policy: `AdministratorAccess` (temporary)
3. Create access key and share with me
4. I'll set everything up and delete the helper user

**Security note**: Only do this if you trust me with temporary admin access.

---

## ✅ Once You Have Credentials

When you have:
- Bucket name (e.g., `ludora-files-20240922`)
- Access Key ID
- Secret Access Key

Just tell me these 3 values and I'll configure Fly.io instantly!

---

## 💰 Cost Estimate
- First 5GB storage: FREE
- 20,000 GET requests: FREE
- 2,000 PUT requests: FREE
- Typical monthly cost: $1-5 for small apps