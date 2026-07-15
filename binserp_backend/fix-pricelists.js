import mongoose from 'mongoose';

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/');
  const admin = mongoose.connection.db.admin();
  const { databases } = await admin.listDatabases();
  
  for (const db of databases) {
    if (db.name.startsWith('bins_company_') || db.name === 'binsdb') {
      const tenantDb = mongoose.connection.useDb(db.name);
      const collection = tenantDb.collection('pricelists');
      
      const items = await collection.find({ fgItem: { $type: 'string' } }).toArray();
      
      for (const item of items) {
        try {
          await collection.updateOne(
            { _id: item._id },
            { $set: { fgItem: new mongoose.Types.ObjectId(item.fgItem) } }
          );
          console.log('Fixed:', item._id, 'in', db.name);
        } catch(e) {
          console.error('Error fixing:', item._id, e);
        }
      }
    }
  }
  
  process.exit(0);
}

fix();
