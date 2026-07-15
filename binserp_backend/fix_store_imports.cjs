const fs = require('fs');
const path = require('path');
const dir = 'src/controllers/store';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for(const file of files) {
  const p = path.join(dir, file);
  let c = fs.readFileSync(p, 'utf8');
  
  // Find import from models/store/index.js
  const regex = /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/\.\.\/models\/store(\/index\.js)?['"]/g;
  let hasChanges = false;
  
  c = c.replace(regex, (match, p1) => {
     let imports = p1.split(',').map(s => s.trim()).filter(Boolean);
     const salesImports = imports.filter(i => ['quotationSchema', 'salesOrderSchema', 'storeOrderSchema', 'storeDispatchHistorySchema', 'deliveryChallanSchema', 'invoiceSchema'].includes(i));
     const storeImports = imports.filter(i => !['quotationSchema', 'salesOrderSchema', 'storeOrderSchema', 'storeDispatchHistorySchema', 'deliveryChallanSchema', 'invoiceSchema'].includes(i));
     
     if (salesImports.length > 0) {
       hasChanges = true;
       // storeOrderSchema was renamed to salesOrderSchema, so map it
       const mappedSalesImports = salesImports.map(i => i === 'storeOrderSchema' ? 'salesOrderSchema' : (i === 'storeDispatchHistorySchema' ? 'salesOrderDispatchHistorySchema' : i));
       
       let res = '';
       if (storeImports.length > 0) {
         res += `import { ${storeImports.join(', ')} } from "../../models/store/index.js";\n`;
       }
       res += `import { ${mappedSalesImports.join(', ')} } from "../../models/sales/index.js"`;
       return res;
     }
     return match;
  });

  // Also replace any usage of 'storeOrderSchema' to 'salesOrderSchema' in the body
  if (hasChanges || c.includes('storeOrderSchema') || c.includes('storeDispatchHistorySchema')) {
    c = c.replace(/storeOrderSchema/g, 'salesOrderSchema');
    c = c.replace(/storeDispatchHistorySchema/g, 'salesOrderDispatchHistorySchema');
    // careful with 'StoreOrder' to 'SalesOrder'
    c = c.replace(/StoreOrder/g, 'SalesOrder');
    c = c.replace(/storeOrder/g, 'salesOrder');
    fs.writeFileSync(p, c);
  }
}
