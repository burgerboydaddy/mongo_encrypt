const { Binary } = require('mongodb');
const {
  createEncryptedClient,
  createDataEncryptionKey,
  getClientEncryption,
  getEncryptionConfig
} = require('./encryptionSetup');
require('dotenv').config();

async function encryptData() {
  let client;

  try {
    const config = getEncryptionConfig();
    
    console.log('Connecting to MongoDB...');
    console.log(`Using ${config.useAutoEncryption ? 'AUTOMATIC' : 'MANUAL'} encryption mode`);
    client = await createEncryptedClient(config.useAutoEncryption);
    console.log('Connected successfully');

    // Create or get data encryption key
    const dataKeyId = await createDataEncryptionKey(client);
    console.log('Data encryption key ID:', dataKeyId);

    // Access the source collection
    const db = client.db(config.database);
    const sourceCollection = db.collection('source_data');
    const encryptedCollection = db.collection('encrypted_data');

    // Clear encrypted collection (optional - for testing)
    await encryptedCollection.deleteMany({});
    console.log('Cleared encrypted_data collection');

    // Get first 10 documents from source_data
    console.log('Fetching first 10 documents from source_data...');
    const documents = await sourceCollection.find({}).limit(10).toArray();
    console.log(`Found ${documents.length} documents`);

    if (documents.length === 0) {
      console.log('No documents found in source_data collection');
      return;
    }

    if (config.useAutoEncryption) {
      // Automatic encryption: MongoDB handles it transparently
      console.log('\nUsing AUTOMATIC encryption - fields will be encrypted transparently');
      
      // Documents are automatically encrypted when inserted
      const result = await encryptedCollection.insertMany(documents);
      console.log(`Inserted ${result.insertedIds.length} documents with automatic encryption`);
    } else {
      // Manual encryption
      console.log('\nUsing MANUAL encryption - applying encryption explicitly');
      
      const clientEncryption = await getClientEncryption(client);
      const encryptedDocuments = [];
      
      for (const doc of documents) {
        console.log(`Processing document with _id: ${doc._id}`);
        
        const encryptedDoc = {
          _id: doc._id,
          field_1: doc.field_1,
          field_2: doc.field_2,
          field_3: doc.field_3
        };

        if (doc.field_1 !== undefined && doc.field_1 !== null) {
          const valueToEncrypt = typeof doc.field_1 === 'string' ? doc.field_1 : String(doc.field_1);
          const encrypted1 = await clientEncryption.encrypt(valueToEncrypt, {
            keyId: dataKeyId,
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
          });
          encryptedDoc.field_1_enc = encrypted1;
          console.log(`  Encrypted field_1: ${doc.field_1}`);
        }

        if (doc.field_2 !== undefined && doc.field_2 !== null) {
          const valueToEncrypt = typeof doc.field_2 === 'string' ? doc.field_2 : String(doc.field_2);
          const encrypted2 = await clientEncryption.encrypt(valueToEncrypt, {
            keyId: dataKeyId,
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
          });
          encryptedDoc.field_2_enc = encrypted2;
          console.log(`  Encrypted field_2: ${doc.field_2}`);
        }

        if (doc.field_3 !== undefined && doc.field_3 !== null) {
          const valueToEncrypt = typeof doc.field_3 === 'string' ? doc.field_3 : String(doc.field_3);
          const encrypted3 = await clientEncryption.encrypt(valueToEncrypt, {
            keyId: dataKeyId,
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
          });
          encryptedDoc.field_3_enc = encrypted3;
          console.log(`  Encrypted field_3: ${doc.field_3}`);
        }

        encryptedDocuments.push(encryptedDoc);
      }
      
      if (encryptedDocuments.length > 0) {
        await encryptedCollection.insertMany(encryptedDocuments);
        console.log(`Inserted ${encryptedDocuments.length} documents into encrypted_data collection`);
      }
    }

    console.log('\nEncryption completed successfully!');

  } catch (error) {
    console.error('Error during encryption:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('Connection closed');
    }
  }
}

// Run the encryption
encryptData().catch(console.error);
