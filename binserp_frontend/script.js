const fs = require('fs');
let code = fs.readFileSync('app/dashboard/store/components/modals/POModal.tsx', 'utf8');

// 1. Add milliseconds to PO Number
code = code.replace(
  'const seconds = String(now.getSeconds()).padStart(2, \'0\');\r\n\r\n        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}`;',
  'const seconds = String(now.getSeconds()).padStart(2, \'0\');\n        const milliseconds = String(now.getMilliseconds()).padStart(3, \'0\');\n\n        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;'
);
// Unix style line endings
code = code.replace(
  'const seconds = String(now.getSeconds()).padStart(2, \'0\');\n\n        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}`;',
  'const seconds = String(now.getSeconds()).padStart(2, \'0\');\n        const milliseconds = String(now.getMilliseconds()).padStart(3, \'0\');\n\n        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;'
);

// 2. Add inHouseItems to POModalProps
if (!code.includes('inHouseItems')) {
  code = code.replace('vendors,\n    loading,\n    initialData,', 'vendors,\n    inHouseItems,\n    loading,\n    initialData,');
  code = code.replace('vendors,\r\n    loading,\r\n    initialData,', 'vendors,\r\n    inHouseItems,\r\n    loading,\r\n    initialData,');
}

// 3. Replace handleMaterialChange
const oldFunc = `    const handleMaterialChange = (index: number, materialId: string) => {
        const selectedMaterial = materials.find(item => item._id === materialId);
        const newEntries = [...materialEntries];
        newEntries[index] = {
            ...newEntries[index],
            material: materialId,
            materialName: selectedMaterial?.name || '',
            unit: getCategoryUnit(selectedMaterial) || 'PCS',
            category: getCategoryName(selectedMaterial) || '',
        };
        setMaterialEntries(newEntries);
    };`;

const newFunc = `    const handleMaterialChange = (index: number, selectedValue: string) => {
        const [type, id] = selectedValue.split('_');
        const newEntries = [...materialEntries];

        if (type === 'MAT') {
            const selectedMaterial = materials.find(item => item._id === id);
            newEntries[index] = {
                ...newEntries[index],
                material: id,
                component: undefined,
                materialName: selectedMaterial?.name || '',
                unit: getCategoryUnit(selectedMaterial) || 'PCS',
                category: getCategoryName(selectedMaterial) || '',
            };
        } else if (type === 'FG') {
            const selectedComponent = inHouseItems?.find((item: any) => item._id === id);
            newEntries[index] = {
                ...newEntries[index],
                component: id,
                material: undefined,
                materialName: selectedComponent?.partName || '',
                unit: selectedComponent?.unit || 'PCS',
                category: 'InHouse',
            };
        } else {
             newEntries[index] = {
                ...newEntries[index],
                material: '',
                component: '',
                materialName: '',
                unit: 'PCS',
                category: '',
            };
        }
        setMaterialEntries(newEntries);
    };`;

code = code.replace(oldFunc, newFunc);
code = code.replace(oldFunc.replace(/\n/g, '\r\n'), newFunc.replace(/\n/g, '\r\n'));

// 4. Update the select options
const oldSelect = `                                                    <select
                                                        value={entry.material}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}`;
const newSelect = `                                                    <select
                                                        value={entry.material ? \`MAT_\${entry.material}\` : entry.component ? \`FG_\${entry.component}\` : ''}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}`;

code = code.replace(oldSelect, newSelect);
code = code.replace(oldSelect.replace(/\n/g, '\r\n'), newSelect.replace(/\n/g, '\r\n'));

const oldOptions = `<option value="">Select Material</option>
                                                        {materials.map((item) => (
                                                            <option key={item._id} value={item._id}>
                                                                {item.name} ({item.code || 'N/A'})
                                                            </option>
                                                        ))}`;

const newOptions = `<option value="">Select Item</option>
                                                        <optgroup label="Materials (RM/BO)">
                                                            {materials.map((item) => (
                                                                <option key={item._id} value={\`MAT_\${item._id}\`}>
                                                                    {item.name} ({item.code || 'N/A'})
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

fs.writeFileSync('app/dashboard/store/components/modals/POModal.tsx', code);
console.log('POModal updated successfully via file write!');
