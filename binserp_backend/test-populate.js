import mongoose from 'mongoose';
import { priceListSchema } from './src/models/sales/priceList.model.js';
import { fgItemSchema } from './src/models/store/fgItem.model.js';

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/bins_company_bins5460');
  const PriceList = mongoose.connection.model('PriceList', priceListSchema);
  mongoose.connection.model('FGItem', fgItemSchema);
  const data = await PriceList.find().populate('fgItem');
  console.log('POPULATED DATA:', JSON.stringify(data, null, 2));
  process.exit(0);
}
test();
