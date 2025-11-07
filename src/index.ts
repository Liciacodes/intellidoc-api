import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const app = express()

app.use(cors())

app.use(express.json());

const prisma = new PrismaClient()

app.get('/api-health', (req, res) => {
    res.json({status: 'ok', message: 'Intellidoc API is running'})
})

app.get('/users', async (req, res) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

app.post('/api/documents/uploads', (req, res) => {
    res.json({message: 'Uploads endpoint ready'})
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
} )