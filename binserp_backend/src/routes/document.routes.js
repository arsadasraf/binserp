import express from 'express';
import { generatePDF } from '../utils/documentGenerator/pdfGenerator.js';
import { generateExcel } from '../utils/documentGenerator/excelGenerator.js';

const router = express.Router();

router.post('/pdf/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { doc, companyInfo } = req.body;

        // Ensure template type is valid to avoid directory traversal
        const validTypes = ['invoice', 'po', 'dc', 'quotation', 'returnable_dc', 'incoming_rfq'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: 'Invalid document type' });
        }

        const pdfBuffer = await generatePDF(type, { doc, companyInfo });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error(`Error generating ${req.params.type} PDF:`, error);
        res.status(500).json({ message: 'Error generating PDF document' });
    }
});

router.post('/excel/export', async (req, res) => {
    try {
        const { data, type } = req.body;
        
        if (!data || !type) {
            return res.status(400).json({ message: 'Data and type are required' });
        }

        const excelBuffer = await generateExcel(data, type);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ message: 'Error generating Excel document' });
    }
});

export default router;
