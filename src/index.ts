import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'

dotenv.config()

const app = express()

app.use(cors())

app.use(express.json());

app.get('/api-health', (req, res) => {
    res.json({status: 'ok', message: 'Intellidoc API is running'})
})

app.post('/api/documents/uploads', (req, res) => {
    res.json({message: 'Uploads endpoint ready'})
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
} )