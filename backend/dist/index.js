import express from 'express';
import dotenv from 'dotenv';
import loanRouter from './routes/loan.js';
import authRouter from './routes/auth.js';
import { middleware } from './middleware.js';
dotenv.config();
const PORT = Number(process.env.PORT) || 3000;
const app = express();
// The Expo web client runs on a different origin during development. Allow
// its JSON and bearer-token requests, including browser preflight requests.
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    return next();
});
app.use(express.json());
app.use("/loan", middleware, loanRouter);
app.use("/auth", authRouter);
app.get("/health", (req, res) => {
    console.log("hello server");
    res.status(200).json({ message: "server hello" });
});
app.listen(PORT, () => {
    console.log('start', PORT);
});
//# sourceMappingURL=index.js.map