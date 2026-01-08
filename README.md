# MongoDB Encryption Project

Node.js project demonstrating MongoDB Enterprise native field-level encryption (Client-Side Field Level Encryption - CSFLE).

## Features

- Connects to MongoDB Enterprise using native mongodb driver
- Reads documents from `source_data` collection
- Encrypts specific fields using MongoDB's native encryption
- Stores both original and encrypted values in `encrypted_data` collection
- Decrypts and displays encrypted field values

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Enterprise Server
- MongoDB Enterprise features enabled

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from the example:
```bash
cp .env.example .env
```

3. Update `.env` with your MongoDB connection details:

**Standard Authentication:**
```
MONGODB_USERNAME=admin
MONGODB_PASSWORD=password
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=myDb
USE_IAM_AUTH=false
DEPLOYMENT_ENV=local
```

**AWS IAM Authentication (for DocumentDB or MongoDB Atlas):**
```
MONGODB_USERNAME=your_aws_access_key_id
MONGODB_HOST=your-cluster.docdb.amazonaws.com
MONGODB_PORT=27017
MONGODB_DATABASE=myDb
USE_IAM_AUTH=true
DEPLOYMENT_ENV=aws
AWS_REGION=us-east-1
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/your-key-id
```

Note: When using IAM authentication with IAM roles (EC2, ECS, Lambda), AWS credentials are automatically provided and don't need to be set in `.env`.

For AWS KMS deployment, set `DEPLOYMENT_ENV=aws` and configure IAM authentication:

**With IAM roles for KMS access (Recommended for Production):**
```
DEPLOYMENT_ENV=aws
USE_IAM_FOR_KMS=true
AWS_REGION=us-east-1
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/your-key-id
```
No AWS credentials needed! The system will automatically use IAM roles from:
- EC2 instance roles
- ECS task roles  
- Lambda execution roles
- AWS credentials file (~/.aws/credentials)
- Environment variables

**With explicit AWS credentials (for local development):**
```
DEPLOYMENT_ENV=aws
USE_IAM_FOR_KMS=false
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/your-key-id
```

## Usage

### Prepare Test Data

First, insert some test data into the `source_data` collection:

```javascript
// Connect to MongoDB and run:
use myDb
db.source_data.insertMany([
  { field_1: "value1", field_2: "value2", field_3: "value3" },
  { field_1: "test1", field_2: "test2", field_3: "test3" },
  { field_1: "sample1", field_2: "sample2", field_3: "sample3" },
  { field_1: "O08J7N787", field_2: "873G2DYBUW", field_3: "732HEDNIXWQ" },
  { field_1: "813HDUQI", field_2: "823HWNUXQ", field_3: "KDWCNXA87" }
]);
```

### Encrypt Data

Run the encryption script to read from `source_data`, encrypt fields, and save to `encrypted_data`:

```bash
npm run encrypt
```

This will:
- Read the first 10 documents from `myDb.source_data`
- Extract values from `field_1`, `field_2`, `field_3`
- Encrypt these values using MongoDB's native encryption
- Create new encrypted fields: `field_1_enc`, `field_2_enc`, `field_3_enc`
- Save documents with both original and encrypted values to `myDb.encrypted_data`

### Decrypt and Display Data

Run the decryption script to read from `encrypted_data` and display values:

```bash
npm run decrypt
```

This will:
- Read all documents from `myDb.encrypted_data`
- Display original field values
- Decrypt encrypted fields
- Show comparison between original and decrypted values

## Project Structure

```
mongo_encrypt/
├── src/
│   ├── encryptionSetup.js  # Encryption configuration and key management
│   ├── encryptData.js      # Script to encrypt data
│   └── decryptData.js      # Script to decrypt and display data
├── package.json
├── .env.example
└── README.md
```

## How It Works

### 1. **Key Management**: 
   - **Local Mode** (`DEPLOYMENT_ENV=local`): Uses a local master key for development
   - **AWS Mode** (`DEPLOYMENT_ENV=aws`): Uses AWS KMS for production-grade key management
     - **IAM Authentication** (`USE_IAM_FOR_KMS=true`): KMS keys accessed via IAM roles (recommended)
     - **Explicit Credentials** (`USE_IAM_FOR_KMS=false`): KMS keys accessed with AWS access keys

2. **Data Encryption Key**: A data encryption key (DEK) is created and stored in the `encryption.__keyVault` collection.

3. **Field Encryption**: Each field is encrypted using the deterministic algorithm `AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic`, which allows for queryable encrypted fields.

4. **Storage**: Documents are stored with both original and encrypted values for comparison purposes.

### Decryption Process

1. Uses the same encryption setup to access the data encryption key
2. Reads encrypted fields from the database
3. Decrypts using MongoDB's ClientEncryption API
4. Displays both original and decrypted values

## Security Notes

⚠️ **Important**: This example uses a local master key for development purposes. In production:

- Use a proper Key Management Service (KMS):
  - AWS KMS
  - Azure Key Vault
  - Google Cloud KMS
- **AWS IAM Authentication**: For DocumentDB or MongoDB Atlas, use IAM authentication instead of username/password
- **IAM Roles**: When running on AWS infrastructure (EC2, ECS, Lambda), use IAM roles instead of hardcoded credentials
- Store sensitive credentials securely
- Never commit `.env` files or master keys to version control
- Implement proper access controls

### Authentication Options

1. **Standard Username/Password** (Development)
   - Set `USE_IAM_AUTH=false`
   - Provide `MONGODB_USERNAME` and `MONGODB_PASSWORD`

2. **AWS IAM Authentication** (Production)
   - Set `USE_IAM_AUTH=true`
   - Set `MONGODB_USERNAME` to AWS access key ID or leave empty for IAM role
   - The connection will use `authMechanism=MONGODB-AWS`
   - Perfect for AWS DocumentDB or MongoDB Atlas with AWS IAM integration

3. **AWS Credentials for KMS**
   - **IAM roles** (recommended): Set `USE_IAM_FOR_KMS=true` and use EC2 instance roles, ECS task roles, or Lambda execution roles
   - **Explicit credentials**: Set `USE_IAM_FOR_KMS=false` and provide `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

The system uses AWS SDK's credential provider chain for IAM authentication, which checks:
1. IAM roles attached to your compute resource (EC2, ECS, Lambda)
2. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`)
3. AWS credentials file (`~/.aws/credentials`)
4. AWS config file (`~/.aws/config`)

## Algorithm Choice

The project uses `AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic` algorithm, which:
- Produces the same encrypted output for the same input value
- Allows for equality queries on encrypted fields
- Suitable for fields that need to be searchable

For random encryption (higher security, no queries), use:
- `AEAD_AES_256_CBC_HMAC_SHA_512-Random`

## License

ISC
