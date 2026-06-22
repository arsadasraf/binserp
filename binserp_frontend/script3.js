const fs = require('fs');
let code = fs.readFileSync('app/dashboard/store/components/modals/BillingModal.tsx', 'utf8');

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
        const newItems = [...formData.items];

        if (type === 'MAT') {
            const selectedMaterial = materials.find((item: any) => item._id === id);
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
        setFormData({ ...formData, items: newItems });
    };`;
    code = code.replace(oldFunc, newFunc);
}

const oldSelectPattern = /<select[\s\S]*?value={item.material}[\s\S]*?onChange={\(e\) => handleMaterialChange\(index, e.target.value\)}/;
const newSelect = `<select
                                                        value={item.material ? \`MAT_\${item.material}\` : item.component ? \`FG_\${item.component}\` : ''}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}`;

if (code.match(oldSelectPattern)) {
  code = code.replace(oldSelectPattern, newSelect);
} else {
  code = code.replace('value={item.material}', 'value={item.material ? \`MAT_\${item.material}\` : item.component ? \`FG_\${item.component}\` : \'\'}');
}

const oldOptionsPattern = /<option value="">Select Material<\/option>[\s\S]*?<\/option>\r?\n\s*\}\)\}\r?\n\s*<\/select>/;

const newOptions = `<option value="">Select Item</option>
                                                        <optgroup label="Materials (RM/BO)">
                                                            {materials.map((m: any) => (
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
                                                        )}
                                                    </select>`;

if (code.match(oldOptionsPattern)) {
  code = code.replace(oldOptionsPattern, newOptions);
}

fs.writeFileSync('app/dashboard/store/components/modals/BillingModal.tsx', code);
console.log('BillingModal updated!');
