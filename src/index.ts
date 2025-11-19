import dotenv from 'dotenv'
import express, {type Request, type Response} from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import multer from 'multer'

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors({
    origin:  ['http://localhost:5173', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api-health', (req, res) => {
    res.json({status: 'ok', message: 'Intellidoc API is running'})
})

interface UploadDocumentRequest {
    title: string;
}

app.get('/api/documents', async (req: Request, res: Response) => {
    try {
const documents = await prisma.document.findMany({
    orderBy: { uploadedAt: 'desc'}
})

res.json(documents)

    } catch (error: any) {
        console.error('Error fetching documents:' , error)
        res.status(500).json({
             error: 'Error fetching documents',
             details: error.message 
        })
    }
})

app.post('/api/documents/uploads', 
    upload.single('file'),
    async (req: Request<{}, {}, UploadDocumentRequest>, res: Response) => {
        try {
            const { title } = req.body;
            const file = req.file;
            
            console.log('Upload request received:', {
                title: title,
                file: file ? {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
                } : 'No file'
            });
            
            if (!file) {
                return res.status(400).json({error: 'No file uploaded'});
            }
            if (!title) {
                return res.status(400).json({error: 'Missing title'});
            }
            
            const filePath = `documents/${Date.now()}_${file.originalname}`;
            
            console.log('Uploading to Supabase storage...');
            
            // Upload file buffer to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                return res.status(500).json({error: `Storage upload failed: ${uploadError.message}`});
            }
            
            // Get public URL for the uploaded file
            const { data: publicUrlData } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);
            
            console.log('File uploaded to Supabase, URL:', publicUrlData.publicUrl);
            
            // Create document data without userId
            const documentData: any = {
                title: title || file.originalname,
                fileUrl: publicUrlData.publicUrl,
                fileType: file.mimetype,
                textContent: '',
                size: file.size
            };
            
            
            // Save document record
            const savedDoc = await prisma.document.create({
                data: documentData
            });
            
            console.log('Document saved to database successfully:', savedDoc.id);
            
            // FIX: Use createdAt instead of uploadedAt
            res.json({
                id: savedDoc.id,
                title: savedDoc.title,
                fileUrl: savedDoc.fileUrl,
                fileType: savedDoc.fileType,
                uploadedAt: savedDoc.uploadedAt,
                size: savedDoc.size
                // Changed from uploadedAt to createdAt
                // Don't include userId in response
            });
            
        } catch (error: any) {
            console.error('Upload error:', error);
            res.status(500).json({
                error: 'Error uploading document',
                details: error.message
            });
        }
    });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});