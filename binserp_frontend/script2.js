const fs = require('fs');
let code = fs.readFileSync('app/dashboard/store/components/modals/DCModal.tsx', 'utf8');

// 1. Add inHouseItems to props
if (!code.includes('inHouseItems')) {
  code = code.replace('materials,\n    customers,', 'materials,\n    inHouseItems,\n    customers,');
  code = code.replace('materials,\r\n    customers,', 'materials,\r\n    inHouseItems,\r\n    customers,');
}

// 2. Replace handleMaterialChange
const startIdx = code.indexOf('    const handleMaterialChange = (index: number, materialId: string) => {');
if(startIdx !== -1) {
    const endIdx = code.indexOf('    };', startIdx) + 6;
    const oldFunc = code.substring(startIdx, endIdx);
    
    const newFunc = `    const handleMaterialChange = (index: number, selectedValue: string) => {
        const [type, id] = selectedValue.split('_');
        const newItems = [...items];

        if (type === 'MAT') {
            const selectedMaterial = materials.find(item => item._id === id);
            newItems[index] = {
                ...newItems[index],
                material: id,
                component: undefined,
                materialName: selectedMaterial?.name || '',
                unit: getCategoryUnit(selectedMaterial) || 'PCS',
            };
        } else if (type === 'FG') {
            const selectedComponent = inHouseItems?.find((item: any) => item._id === id);
            newItems[index] = {
                ...newItems[index],
                component: id,
                material: undefined,
                materialName: selectedComponent?.partName || '',
                unit: selectedComponent?.unit || 'PCS',
            };
        } else {
            newItems[index] = {
                ...newItems[index],
                material: '',
                component: '',
                materialName: '',
                unit: 'PCS',
            };
        }
        setItems(newItems);
    };`;
    code = code.replace(oldFunc, newFunc);
}

// 3. Update the select options
const oldSelectPattern = /<select[\s\S]*?value={item.material}[\s\S]*?onChange={\(e\) => handleMaterialChange\(index, e.target.value\)}/;
const newSelect = `<select
                                                        value={item.material ? \`MAT_\${item.material}\` : item.component ? \`FG_\${item.component}\` : ''}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}`;

if (code.match(oldSelectPattern)) {
  code = code.replace(oldSelectPattern, newSelect);
} else {
  code = code.replace('value={item.material}', 'value={item.material ? \`MAT_\${item.material}\` : item.component ? \`FG_\${item.component}\` : \'\'}');
}

const oldOptions = `<option value="">Select Material</option>
                                                        {materials.map((m) => (
                                                            <option key={m._id} value={m._id}>
                                                                {m.name} ({m.code || 'N/A'})
                                                            </option>
                                                        ))}`;

const newOptions = `<option value="">Select Item</option>
                                                        <optgroup label="Materials (RM/BO)">
                                                            {materials.map((m) => (
                                                                <option key={m._id} value={\`MAT_\${m._id}\`}>
                                                                    {m.name} ({m.code || 'N/A'})
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                        {inHouseItems && inHouseItems.length > 0 && (
                                                            <optgroup label="Finished Goods (FG)">
                                                                {inHouseItems.map((item: any) => (
                                                                    <option key={item._id} value={\`FG_\${item._id}\`}>
                                                                        {item.partName} ({item.partNumber || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}`;

code = code.replace(oldOptions, newOptions);
code = code.replace(oldOptions.replace(/\n/g, '\r\n'), newOptions.replace(/\n/g, '\r\n'));

fs.writeFileSync('app/dashboard/store/components/modals/DCModal.tsx', code);
console.log('DCModal updated!');

let pageCode = fs.readFileSync('app/dashboard/store/page.tsx', 'utf8');
if (pageCode.includes('<DCModal') && !pageCode.includes('inHouseItems={inHouseItems}')) {
    pageCode = pageCode.replace('<DCModal', '<DCModal\n              inHouseItems={inHouseItems}');
    fs.writeFileSync('app/dashboard/store/page.tsx', pageCode);
    console.log('Passed inHouseItems to DCModal');
}
