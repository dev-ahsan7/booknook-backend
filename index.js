import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('bookNook');
const booksCollection = db.collection('books');
const borrowsCollection = db.collection('borrows');

app.get('/', (req, res) => {
  res.send({ message: 'BookNook server is running' });
});

app.get('/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.send({ database: 'connected' });
  } catch (error) {
    console.error('Database ping failed:', error);
    res.status(500).send({ database: 'not connected' });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

export default app;
