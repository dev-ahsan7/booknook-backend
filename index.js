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

const CATEGORIES = ['Fiction', 'Science', 'History', 'Kids', 'Others'];

// Keeps only the fields a user can set, so nobody can send their own owner or dates
const getBookFields = (body) => {
  const { title, author, category, image, description } = body;
  const totalCopies = Number(body.totalCopies);

  if (!title || !author || !image || !description) {
    return { error: 'Please fill in all the fields' };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: 'Please choose a valid category' };
  }
  if (!Number.isInteger(totalCopies) || totalCopies < 1) {
    return { error: 'Total copies must be at least 1' };
  }

  return { fields: { title, author, category, image, description, totalCopies } };
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

app.post('/books', verifyToken, async (req, res) => {
  const { fields, error } = getBookFields(req.body);
  if (error) {
    return res.status(400).send({ message: error });
  }

  const result = await booksCollection.insertOne({
    ...fields,
    availableCopies: fields.totalCopies,
    userName: req.user.name,
    userEmail: req.user.email,
    addedAt: new Date(),
  });

  res.status(201).send({ message: 'Book added', id: result.insertedId });
});

app.patch('/books/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(404).send({ message: 'Book not found' });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: 'Book not found' });
  }
  if (book.userEmail !== req.user.email) {
    return res.status(403).send({ message: 'You can only edit your own books' });
  }

  const { fields, error } = getBookFields(req.body);
  if (error) {
    return res.status(400).send({ message: error });
  }

  const borrowedCopies = book.totalCopies - book.availableCopies;
  if (fields.totalCopies < borrowedCopies) {
    return res.status(400).send({
      message: `${borrowedCopies} copies are borrowed right now, so total copies can't be lower than that`,
    });
  }

  await booksCollection.updateOne(
    { _id: book._id },
    {
      $set: {
        ...fields,
        availableCopies: fields.totalCopies - borrowedCopies,
      },
    },
  );

  res.send({ message: 'Book updated' });
});

app.delete('/books/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(404).send({ message: 'Book not found' });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: 'Book not found' });
  }
  if (book.userEmail !== req.user.email) {
    return res.status(403).send({ message: 'You can only delete your own books' });
  }

  await booksCollection.deleteOne({ _id: book._id });

  res.send({ message: 'Book deleted' });
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
