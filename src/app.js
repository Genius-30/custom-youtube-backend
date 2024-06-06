import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
const limit = '16kb';

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: limit }));
app.use(urlencoded({ etended: true, limit: limit }));
app.use(express.static('public'));
app.use(cookieParser());

export { app };
