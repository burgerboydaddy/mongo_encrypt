const { MongoClient } = require('mongodb');
require('dotenv').config();

async function inspectData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db('myDb');
    const collection = db.collection('encrypted_data');

    const doc = await collection.findOne({});
    
    if (!doc) {
      console.log('No documents found');
      return;
    }

    console.log('Sample document:');
    console.log('_id:', doc._id);
    console.log('\nfield_1:', doc.field_1, '(type:', typeof doc.field_1, ')');
    console.log('field_2:', doc.field_2, '(type:', typeof doc.field_2, ')');
    console.log('field_3:', doc.field_3, '(type:', typeof doc.field_3, ')');
    
    console.log('\nfield_1_enc:', doc.field_1_enc);
    console.log('field_1_enc type:', typeof doc.field_1_enc);
    console.log('field_1_enc constructor:', doc.field_1_enc?.constructor?.name);
    console.log('field_1_enc instanceof Binary:', doc.field_1_enc?._bsontype);
    
    console.log('\nfield_2_enc:', doc.field_2_enc);
    console.log('field_2_enc type:', typeof doc.field_2_enc);
    console.log('field_2_enc constructor:', doc.field_2_enc?.constructor?.name);
    
    console.log('\nfield_3_enc:', doc.field_3_enc);
    console.log('field_3_enc type:', typeof doc.field_3_enc);
    console.log('field_3_enc constructor:', doc.field_3_enc?.constructor?.name);

  } finally {
    await client.close();
  }
}

inspectData().catch(console.error);
