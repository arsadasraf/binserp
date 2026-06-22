const fs = require('fs');

let p = 'app/dashboard/store/components/tables/MastersTable.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.split('masterTab === "grn-history"').join('(masterTab === "grn-history" || masterTab === "fg-grn-history")');
c = c.split('masterTab !== "grn-history"').join('(masterTab !== "grn-history" && masterTab !== "fg-grn-history")');

c = c.split("masterTab === 'grn-history'").join("(masterTab === 'grn-history' || masterTab === 'fg-grn-history')");
c = c.split("masterTab !== 'grn-history'").join("(masterTab !== 'grn-history' && masterTab !== 'fg-grn-history')");

fs.writeFileSync(p, c);
