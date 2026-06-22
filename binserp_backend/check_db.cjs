const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://localhost:27017/binsanalytics_master');
    const db = mongoose.connection.useDb('binsanalytics_tenant_demo');
    
    // We will just directly query the collections
    const vendors = await db.collection('vendors').find({}).toArray();
    const jobworksuppliers = await db.collection('jobworksuppliers').find({}).toArray();

    console.log("VENDORS COUNT:", vendors.length);
    if(vendors.length > 0) {
        console.log("Vendor 1:", vendors[0]);
    }
    
    console.log("JOB WORKSUPPLIERS COUNT:", jobworksuppliers.length);
    if(jobworksuppliers.length > 0) {
        console.log("JWS 1:", jobworksuppliers[0]);
    }
    
    process.exit(0);
}
test().catch(console.error);
