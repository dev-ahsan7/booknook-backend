import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('bookNook');
const booksCollection = db.collection('books');
const borrowsCollection = db.collection('borrows');

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'Please log in first' });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
};

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

app.get('/books', async (req, res) => {
  const { email, limit } = req.query;
  const query = email ? { userEmail: email } : {};

  const books = await booksCollection
    .find(query)
    .project({ userEmail: 0 })
    .sort({ addedAt: -1 })
    .limit(Math.max(Number(limit) || 0, 0))
    .toArray();

  res.send(books);
});

app.get('/books/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(404).send({ message: 'Book not found' });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: 'Book not found' });
  }

  res.send(book);
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send({ message: 'Something went wrong on the server' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

export default app;
