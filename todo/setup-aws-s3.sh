#!/bin/bash

# AWS S3 Setup Script for Ludora
# This script will help you set up S3 bucket and IAM user via AWS CLI

set -e

echo "🚀 Setting up AWS S3 for Ludora..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed.${NC}"
    echo "Please install AWS CLI first:"
    echo "  macOS: brew install awscli"
    echo "  Linux: sudo apt-get install awscli"
    echo "  Or download from: https://aws.amazon.com/cli/"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI found${NC}"

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}⚠️  AWS CLI is not configured${NC}"
    echo "Please run: aws configure"
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region (recommend: us-east-1)"
    echo "  - Default output format (recommend: json)"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is configured${NC}"

# Get current AWS identity
IDENTITY=$(aws sts get-caller-identity)
echo "Current AWS identity: $(echo $IDENTITY | jq -r '.Arn')"

# Set variables
BUCKET_NAME="ludora-files-$(date +%Y%m%d)-$(whoami)"
REGION="us-east-1"
IAM_USER_NAME="ludora-api-user"
POLICY_NAME="LudoraS3Policy"

echo -e "${YELLOW}📦 Creating S3 bucket: $BUCKET_NAME${NC}"

# Create S3 bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Configure bucket for public access (needed for public file uploads)
echo -e "${YELLOW}🔓 Configuring bucket public access${NC}"

# Remove public access block
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Set bucket CORS policy
echo -e "${YELLOW}🌐 Setting CORS policy${NC}"
cat > /tmp/cors-config.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file:///tmp/cors-config.json

# Create IAM policy for S3 access
echo -e "${YELLOW}👤 Creating IAM policy${NC}"
cat > /tmp/s3-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject",
                "s3:GetObjectVersion"
            ],
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": "arn:aws:s3:::$BUCKET_NAME"
        }
    ]
}
EOF

# Create IAM policy
aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file:///tmp/s3-policy.json \
    --description "Policy for Ludora API to access S3 bucket"

# Get policy ARN
POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" --output text)

# Create IAM user
echo -e "${YELLOW}👤 Creating IAM user${NC}"
aws iam create-user --user-name $IAM_USER_NAME

# Attach policy to user
aws iam attach-user-policy --user-name $IAM_USER_NAME --policy-arn $POLICY_ARN

# Create access keys
echo -e "${YELLOW}🔑 Creating access keys${NC}"
ACCESS_KEYS=$(aws iam create-access-key --user-name $IAM_USER_NAME)

# Extract access key details
ACCESS_KEY_ID=$(echo $ACCESS_KEYS | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo $ACCESS_KEYS | jq -r '.AccessKey.SecretAccessKey')

# Clean up temp files
rm -f /tmp/cors-config.json /tmp/s3-policy.json

echo -e "${GREEN}✅ AWS S3 setup completed!${NC}"
echo ""
echo "📋 Configuration Summary:"
echo "========================"
echo "Bucket Name: $BUCKET_NAME"
echo "Region: $REGION"
echo "IAM User: $IAM_USER_NAME"
echo "Access Key ID: $ACCESS_KEY_ID"
echo "Secret Access Key: $SECRET_ACCESS_KEY"
echo ""
echo -e "${YELLOW}🔒 IMPORTANT: Save these credentials securely!${NC}"
echo ""

# Save credentials to file
cat > /tmp/ludora-aws-credentials.txt << EOF
# Ludora AWS S3 Configuration
# Generated on: $(date)

AWS_REGION=$REGION
AWS_S3_BUCKET=$BUCKET_NAME
AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY

# Fly.io secrets command:
flyctl secrets set \\
  USE_S3=true \\
  AWS_REGION=$REGION \\
  AWS_S3_BUCKET=$BUCKET_NAME \\
  AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID \\
  AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY
EOF

echo "💾 Credentials saved to: /tmp/ludora-aws-credentials.txt"
echo ""
echo -e "${GREEN}🚀 Next steps:${NC}"
echo "1. Copy the credentials from /tmp/ludora-aws-credentials.txt"
echo "2. Run the flyctl secrets command to configure your Ludora API"
echo "3. Test file uploads in your application"
echo ""
echo -e "${YELLOW}⚠️  Security reminder:${NC}"
echo "- Delete /tmp/ludora-aws-credentials.txt after copying the credentials"
echo "- Never commit AWS credentials to git"
echo "- Consider setting up AWS credential rotation"