import { API_BASE_URL } from './config';

export const generateDocument = async (type: 'pdf' | 'excel', documentType: 'invoice' | 'po' | 'dc' | 'quotation' | 'Delivery Challans' | 'Invoices' | 'InHouse Inventory' | 'returnable_dc' | 'Returnable DC' | 'incoming_rfq', data: any) => {
    try {
        const endpoint = type === 'pdf' ? `/api/documents/pdf/${documentType}` : `/api/documents/excel/export`;
        const body = type === 'pdf' ? data : { data, type: documentType };
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`Failed to generate ${type.toUpperCase()}`);
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Determine filename
        let filename = 'document';
        if (type === 'pdf') {
            const id = data.doc?.poNumber || data.doc?.dcNumber || data.doc?.invoiceNumber || data.doc?.quotationNumber || Date.now();
            filename = `${documentType.toUpperCase()}_${id}.pdf`;
        } else {
            filename = `${documentType}_${Date.now()}.xlsx`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(`${type.toUpperCase()} Generation Error:`, error);
        alert(`${type.toUpperCase()} Error: ${(error as any)?.message}`);
    }
};
