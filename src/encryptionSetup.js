const { MongoClient, Binary, ClientEncryption } = require('mongodb');
require('dotenv').config();

// Get encryption configuration
function getEncryptionConfig() {
  return {
    useAutoEncryption: process.env.USE_AUTO_ENCRYPTION !== 'false', // Default to true
    database: process.env.MONGODB_DATABASE || 'myDb',
    encryptedFields: ['field_1', 'field_2', 'field_3']
  };
}

// Build JSON schema for automatic field encryption
function getEncryptionSchema() {
  const encryptionConfig = getEncryptionConfig();
  
  if (!encryptionConfig.useAutoEncryption) {
    return null; // No schema means manual encryption
  }

  return {
    bson_type: 'object',
    properties: {
      field_1: {
        encrypt: {
          bson_type: 'string',
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
        }
      },
      field_2: {
        encrypt: {
          bson_type: 'string',
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
        }
      },
      field_3: {
        encrypt: {
          bson_type: 'string',
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
        }
      }
    }
  };
}

// Build MongoDB connection URI from environment variables
function buildMongoDbUri() {
  const username = process.env.MONGODB_USERNAME || '';
  const password = process.env.MONGODB_PASSWORD || '';
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const useIamAuth = process.env.USE_IAM_AUTH === 'true';
  
  if (useIamAuth && username) {
    // IAM authentication (for DocumentDB or MongoDB Atlas with AWS IAM)
    return `mongodb://${encodeURIComponent(username)}@${host}:${port}/?authSource=$external&authMechanism=MONGODB-AWS`;
  } else if (username && password) {
    // Standard username/password authentication
    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/`;
  }
  return `mongodb://${host}:${port}/`;
}

// Generate a local master key (96 bytes for development)
// In production, use a proper KMS provider (AWS, Azure, GCP)
function generateLocalMasterKey() {
  return Buffer.alloc(96);
}

// Auto encryption configuration
function getAutoEncryptionOptions(keyVaultNamespace, kmsProviders, useAutoEncryption = true) {
  const encryptionConfig = getEncryptionConfig();
  const database = encryptionConfig.database;
  const schema = getEncryptionSchema();
  
  return {
    keyVaultNamespace,
    kmsProviders,
    bypassAutoEncryption: !useAutoEncryption, // Enable or disable auto encryption
    schemaMap: useAutoEncryption && schema ? {
      [`${database}.source_data`]: schema,
      [`${database}.encrypted_data`]: schema
    } : {}
  };
}

// Get KMS providers configuration based on deployment environment
function getKmsProviders() {
  const deploymentEnv = process.env.DEPLOYMENT_ENV || 'local';
  
  if (deploymentEnv === 'aws') {
    // AWS KMS configuration
    const useIamForKms = process.env.USE_IAM_FOR_KMS !== 'false'; // Default to true
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    // Use IAM authentication for KMS (recommended for production)
    if (useIamForKms || (!awsAccessKeyId || !awsSecretAccessKey)) {
      console.log('Using AWS KMS with IAM authentication (credential chain)');
      // Empty object uses AWS SDK default credential provider chain:
      // - IAM instance roles (EC2)
      // - ECS task roles
      // - Lambda execution roles
      // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
      // - ~/.aws/credentials file
      return {
        aws: {}
      };
    } else {
      // Use explicit credentials (for local development)
      console.log('Using AWS KMS with explicit credentials');
      return {
        aws: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey
        }
      };
    }
  } else {
    // Local key configuration (development)
    console.log('Using local master key for encryption');
    const localMasterKey = generateLocalMasterKey();
    return {
      local: {
        key: localMasterKey
      }
    };
  }
}

// Create or get data encryption key
async function createDataEncryptionKey(client) {
  const keyVaultNamespace = 'encryption.__keyVault';
  const kmsProviders = getKmsProviders();
  const deploymentEnv = process.env.DEPLOYMENT_ENV || 'local';
  
  const encryption = new ClientEncryption(client, {
    keyVaultNamespace,
    kmsProviders,
  });

  // Check if key already exists
  const keyVaultDB = keyVaultNamespace.split('.')[0];
  const keyVaultColl = keyVaultNamespace.split('.')[1];
  
  const keyVault = client.db(keyVaultDB).collection(keyVaultColl);
  const existingKey = await keyVault.findOne({ keyAltNames: 'dataKey' });
  
  if (existingKey) {
    console.log('Using existing data encryption key');
    return existingKey._id;
  }

  console.log('Creating new data encryption key');
  
  // Create data key based on deployment environment
  let dataKeyId;
  if (deploymentEnv === 'aws') {
    const awsKmsKeyArn = process.env.AWS_KMS_KEY_ARN;
    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    
    if (!awsKmsKeyArn) {
      throw new Error('AWS_KMS_KEY_ARN is required when DEPLOYMENT_ENV=aws');
    }
    
    dataKeyId = await encryption.createDataKey('aws', {
      masterKey: {
        key: awsKmsKeyArn,
        region: awsRegion
      },
      keyAltNames: ['dataKey']
    });
  } else {
    dataKeyId = await encryption.createDataKey('local', {
      keyAltNames: ['dataKey']
    });
  }

  return dataKeyId;
}

// Create regular MongoClient for manual encryption mode
async function createRegularClient() {
  const uri = buildMongoDbUri();
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// Create encrypted MongoClient
async function createEncryptedClient(useAutoEncryption = true) {
  const uri = buildMongoDbUri();
  const keyVaultNamespace = 'encryption.__keyVault';
  const kmsProviders = getKmsProviders();

  const client = new MongoClient(uri, {
    autoEncryption: getAutoEncryptionOptions(keyVaultNamespace, kmsProviders, useAutoEncryption)
  });

  await client.connect();
  return client;
}

// Get ClientEncryption instance for manual encryption
async function getClientEncryption(client) {
  const keyVaultNamespace = 'encryption.__keyVault';
  const kmsProviders = getKmsProviders();

  return new ClientEncryption(client, {
    keyVaultNamespace,
    kmsProviders,
  });
}

module.exports = {
  buildMongoDbUri,
  createRegularClient,
  createEncryptedClient,
  createDataEncryptionKey,
  getClientEncryption,
  getKmsProviders,
  getEncryptionConfig,
  getEncryptionSchema
};
