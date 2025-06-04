import express from 'express';
import * as dotenv from 'dotenv';
import identifyRouter from './routes/identify';

dotenv.config();
const app = express();
app.use(express.json());
app.use('/identify', identifyRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
