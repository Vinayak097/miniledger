import express from 'express';
import dotenv from 'dotenv';
import loanRouter from './routes/loan.js';
import authRouter from './routes/auth.js';
dotenv.config();
const PORT = 3000;
const app = express();
app.use(express.json());
app.use("/loan", loanRouter);
app.use("/auth", authRouter);
app.get("/health", (req, res) => {
    console.log("hello server");
    res.status(200).json({ message: "server hello" });
});
console.log("");
app.listen(PORT, () => {
    console.log('start', PORT);
});
//# sourceMappingURL=index.js.map