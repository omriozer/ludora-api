# AWS S3 Setup Guide for Ludora

## Step 1: Create AWS Account & Access AWS Console

1. Go to https://aws.amazon.com/
2. Sign in to AWS Console (or create account if needed)
3. Make sure you're in the correct region (recommend: US East 1 - N. Virginia)

## Step 2: Create S3 Bucket

1. **Navigate to S3 Service:**
   - In AWS Console, search for "S3" and click on it
   - Click "Create bucket"

2. **Bucket Configuration:**
   - **Bucket name**: `ludora-files-[random-suffix]` (must be globally unique)
     - Example: `ludora-files-2024-prod` or `ludora-files-omri`
   - **Region**: US East (N. Virginia) us-east-1
   - **Object Ownership**: ACLs enabled
   - **Block Public Access**: Uncheck "Block all public access"
     - Check "I acknowledge that the current settings might result in this bucket and the objects within becoming public"

3. **Bucket Settings:**
   - **Bucket Versioning**: Disabled (for cost savings)
   - **Default encryption**: Server-side encryption with Amazon S3 managed keys (SSE-S3)
   - Click "Create bucket"

## Step 3: Configure Bucket CORS Policy

1. **Go to your newly created bucket**
2. **Click on "Permissions" tab**
3. **Scroll down to "Cross-origin resource sharing (CORS)"**
4. **Click "Edit" and paste this configuration:**

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

5. **Click "Save changes"**

## Step 4: Create IAM User for API Access

1. **Navigate to IAM Service:**
   - Search for "IAM" in AWS Console and click on it
   - Click "Users" in the left sidebar
   - Click "Create user"

2. **User Configuration:**
   - **User name**: `ludora-api-user`
   - **Select AWS access type**: Programmatic access
   - Click "Next"

3. **Set Permissions:**
   - Select "Attach existing policies directly"
   - Search for and select: `AmazonS3FullAccess`
   - Click "Next" through remaining screens
   - Click "Create user"

4. **Save Credentials (IMPORTANT!):**
   - **Copy the Access Key ID** - you'll need this
   - **Copy the Secret Access Key** - you'll need this (this is the only time you can see it)
   - Download the CSV file as backup

## Step 5: Test Bucket Setup

You can test if your bucket is working by uploading a test file:
1. Go back to your S3 bucket
2. Click "Upload"
3. Add a test image file
4. In "Permissions" section, select "Grant public-read access"
5. Upload the file
6. Click on the uploaded file and copy the "Object URL"
7. Open the URL in a new browser tab - you should see your image

## Step 6: Configure Ludora API

Once you have:
- ✅ Bucket name (e.g., `ludora-files-2024-prod`)
- ✅ AWS Access Key ID
- ✅ AWS Secret Access Key
- ✅ Region (us-east-1)

We'll configure these in Fly.io using the flyctl command.

## Security Notes

- Keep your AWS credentials secure and never commit them to git
- The S3 bucket allows public read access for uploaded files
- Private files are uploaded with restricted access and use signed URLs
- Consider setting up bucket lifecycle policies to manage costs

## Cost Estimation

- S3 storage: ~$0.023 per GB per month
- S3 requests: ~$0.0004 per 1,000 requests
- Data transfer out: First 1 GB free, then ~$0.09 per GB

For a typical app with moderate file usage, expect $5-20/month.