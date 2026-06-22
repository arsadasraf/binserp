const mongoose = require('mongoose');

async function test() {
    const conn = await mongoose.connect('mongodb://localhost:27017/binsanalytics'); // default connection
    console.log("DB NAME:", mongoose.connection.name);
    const dbs = await mongoose.connection.db.admin().listDatabases();
    console.log("Databases:", dbs.databases.map(d => d.name));
    
    for (const d of dbs.databases) {
        if (d.name.startsWith('bins')) {
            console.log(`\nChecking ${d.name}...`);
            const db = mongoose.connection.useDb(d.name);
            const vendors = await db.collection('vendors').find({}).toArray();
            const jobworksuppliers = await db.collection('jobworksuppliers').find({}).toArray();
            console.log(`VENDORS: ${vendors.length}, JWS: ${jobworksuppliers.length}`);
            if (vendors.length > 0) console.log(vendors[0].name);
            if (jobworksuppliers.length > 0) console.log(jobworksuppliers[0].name);
        }
    }
    
    process.exit(0);
}
test().catch(console.error);
