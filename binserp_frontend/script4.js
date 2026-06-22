const fs = require('fs');

let typesCode = fs.readFileSync('app/dashboard/store/types/store.types.ts', 'utf8');
if (!typesCode.includes('materials: Material[];') && typesCode.includes('export interface QuotationModalProps')) {
  typesCode = typesCode.replace('components: any[];', 'components: any[];\n    materials: any[];');
  fs.writeFileSync('app/dashboard/store/types/store.types.ts', typesCode);
  console.log('types updated');
}

let code = fs.readFileSync('app/dashboard/store/components/modals/QuotationModal.tsx', 'utf8');

if (!code.includes('materials = [],')) {
  code = code.replace('components = [],', 'components = [],\n    materials = [],');
  code = code.replace('components = [],\r\n', 'components = [],\r\n    materials = [],\r\n');
}

// Replace handleComponentChange
const startIdx = code.indexOf('    const handleComponentChange = (index: number, componentId: string) => {');
if(startIdx !== -1) {
    const endIdx = code.indexOf('    };', startIdx) + 6;
    const oldFunc = code.substring(startIdx, endIdx);
    
    const newFunc = `    const handleComponentChange = (index: number, selectedValue: string) => {
        const [type, id] = selectedValue.split('_');
        const newItems = [...formData.items];

        if (type === 'FG') {
            const selectedComponent = components.find(item => item._id === id);
            newItems[index] = {
                ...newItems[index],
                component: id,
                material: undefined,
                productName: selectedComponent?.partName || '',
                unit: selectedComponent?.unit || 'PCS',
            };
        } else if (type === 'MAT') {
            const selectedMaterial = materials.find((item: any) => item._id === id);
            newItems[index] = {
                ...newItems[index],
                material: id,
                component: undefined,
                productName: selectedMaterial?.name || '',
                unit: selectedMaterial?.categoryId?.unit || selectedMaterial?.category?.unit || 'PCS',
            };
        } else {
            newItems[index] = {
                ...newItems[index],
                component: '',
                material: '',
                productName: '',
                unit: 'PCS',
            };
        }
        setFormData(prev => ({ ...prev, items: newItems }));
    };`;
    code = code.replace(oldFunc, newFunc);
}

const oldSelectPattern = /<select[\s\S]*?value={item.component}[\s\S]*?onChange={\(e\) => handleComponentChange\(index, e.target.value\)}/;
const newSelect = `<select
                                                        value={item.component ? \`FG_\${item.component}\` : item.material ? \`MAT_\${item.material}\` : ''}
                                                        onChange={(e) => handleComponentChange(index, e.target.value)}`;

if (code.match(oldSelectPattern)) {
  code = code.replace(oldSelectPattern, newSelect);
}

const oldOptionsPattern = /<option value="">Select Component<\/option>[\s\S]*?<\/option>\r?\n\s*\}\)\}\r?\n\s*<\/select>/;

const newOptions = `<option value="">Select Item</option>
                                                        {components && components.length > 0 && (
                                                            <optgroup label="Finished Goods (FG)">
                                                                {components.map((c) => (
                                                                    <option key={c._id} value={\`FG_\${c._id}\`}>
                                                                        {c.partName} ({c.partNumber || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                        {materials && materials.length > 0 && (
                                                            <optgroup label="Materials (RM/BO)">
                                                                {materials.map((m) => (
                                                                    <option key={m._id} value={\`MAT_\${m._id}\`}>
                                                                        {m.name} ({m.code || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>`;

if (code.match(oldOptionsPattern)) {
   code = code.replace(oldOptionsPattern, newOptions);
}

fs.writeFileSync('app/dashboard/store/components/modals/QuotationModal.tsx', code);
console.log('QuotationModal updated!');

let pageCode = fs.readFileSync('app/dashboard/store/page.tsx', 'utf8');
if (pageCode.includes('<QuotationModal') && !pageCode.includes('materials={materials}')) {
    pageCode = pageCode.replace('<QuotationModal', '<QuotationModal\n              materials={materials}');
    fs.writeFileSync('app/dashboard/store/page.tsx', pageCode);
    console.log('Passed materials to QuotationModal');
}
