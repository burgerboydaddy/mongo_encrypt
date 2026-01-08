const { MongoClient } = require('mongodb');
const {
  buildMongoDbUri,
  createEncryptedClient,
  getClientEncryption,
  getEncryptionConfig
} = require('./encryptionSetup');
require('dotenv').config();

async function decryptData() {
  let client;

  try {
    const config = getEncryptionConfig();
    
    console.log('Connecting to MongoDB...');
    console.log(`Using ${config.useAutoEncryption ? 'AUTOMATIC' : 'MANUAL'} decryption mode`);
    
    if (config.useAutoEncryption) {
      // Use automatic encryption/decryption client
      client = await createEncryptedClient(true);
    } else {
      // Use regular client for manual decryption
      const uri = buildMongoDbUri();
      client = new MongoClient(uri);
      await client.connect();
    }
    console.log('Connected successfully');

    // Access the encrypted collection
    const db = client.db(config.database);
    const encryptedCollection = db.collection('encrypted_data');

    // Retrieve all documents from encrypted_data
    console.log('\nFetching documents from encrypted_data...');
    const documents = await encryptedCollection.find({}).toArray();
    
    if (documents.length === 0) {
      console.log('No documents found in encrypted_data collection');
      return;
    }

    console.log(`Found ${documents.length} documents\n`);
    console.log('='.repeat(80));

    if (config.useAutoEncryption) {
      // Automatic decryption: MongoDB returns decrypted values automatically
      console.log('Using AUTOMATIC decryption - fields are decrypted transparently\n');

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`\nDocument ${i + 1}:`);
        console.log(`  _id: ${doc._id}`);
        console.log('-'.repeat(80));

        console.log('  Decrypted Values (automatic):');
        console.log(`    field_1: ${doc.field_1}`);
        console.log(`    field_2: ${doc.field_2}`);
        console.log(`    field_3: ${doc.field_3}`);
        console.log('='.repeat(80));
      }
    } else {
      // Manual decryption
      console.log('Using MANUAL decryption - explicitly decrypting fields\n');

      const clientEncryption = await getClientEncryption(client);

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`\nDocument ${i + 1}:`);
        console.log(`  _id: ${doc._id}`);
        console.log('-'.repeat(80));

        // Display original values
        console.log('  Original Values:');
        console.log(`    field_1: ${doc.field_1}`);
        console.log(`    field_2: ${doc.field_2}`);
        console.log(`    field_3: ${doc.field_3}`);

        // Decrypt and display encrypted values
        console.log('\n  Decrypted Values:');
        
        if (doc.field_1_enc) {
          const decrypted1 = await clientEncryption.decrypt(doc.field_1_enc);
          console.log(`    field_1_enc -> ${decrypted1} (matches original: ${decrypted1 === doc.field_1})`);
        } else {
          console.log(`    field_1_enc -> (not encrypted)`);
        }

        if (doc.field_2_enc) {
          const decrypted2 = await clientEncryption.decrypt(doc.field_2_enc);
          console.log(`    field_2_enc -> ${decrypted2} (matches original: ${decrypted2 === doc.field_2})`);
        } else {
          console.log(`    field_2_enc -> (not encrypted)`);
        }

        if (doc.field_3_enc) {
          const decrypted3 = await clientEncryption.decrypt(doc.field_3_enc);
          console.log(`    field_3_enc -> ${decrypted3} (matches original: ${decrypted3 === doc.field_3})`);
        } else {
          console.log(`    field_3_enc -> (not encrypted)`);
        }

        console.log('='.repeat(80));
      }
    }

    console.log('\nDecryption completed successfully!');

  } catch (error) {
    console.error('Error during decryption:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('Connection closed');
    }
  }
}

// Run the decryption
decryptData().catch(console.error);
