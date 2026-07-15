const fs = require('fs');
const path = require('path');
const dir = 'src/controllers/sales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for(const file of files) {
  const p = path.join(dir, file);
  let c = fs.readFileSync(p, 'utf8');
  
  // Fix the literal bad replacement
  c = c.replace(/\"\.\.\/\.\.\/models\/store\/index\.js\";\`nimport \{ incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema \} from \"\.\.\/\.\.\/models\/sales\/index\.js/g, '"../../models/store/index.js";\nimport { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js');

  // We need to also remove 'salesOrderSchema', 'quotationSchema', etc from the FIRST import from store.
  c = c.replace(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/\.\.\/models\/store\/index\.js['"]/g, (match, p1) => {
     let imports = p1.split(',').map(s => s.trim());
     imports = imports.filter(i => !['quotationSchema', 'salesOrderSchema', 'salesOrderDispatchHistorySchema', 'deliveryChallanSchema', 'invoiceSchema'].includes(i));
     return `import { ${imports.join(', ')} } from "../../models/store/index.js"`;
  });
  
  fs.writeFileSync(p, c);
}
