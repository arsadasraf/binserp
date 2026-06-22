const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://localhost:27017/binsanalytics_master');
    const companies = await mongoose.connection.collection('companies').find({}).toArray();
    
    for (const company of companies) {
        console.log(`Checking DB for ${company.name}: ${company.dbName}`);
        const db = mongoose.connection.useDb(company.dbName);
        const vendors = await db.collection('vendors').find({}).toArray();
        const jobworksuppliers = await db.collection('jobworksuppliers').find({}).toArray();
        
        console.log(`VENDORS: ${vendors.length}, JWS: ${jobworksuppliers.length}`);
        if(vendors.length > 0) console.log(vendors[0]);
        if(jobworksuppliers.length > 0) console.log(jobworksuppliers[0]);
    }
    
    process.exit(0);
}
test().catch(console.error);
