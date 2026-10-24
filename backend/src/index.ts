import express from 'express'
import dotenv from 'dotenv'
import loanRouter from './routes/loan.js'
import authRouter from './routes/auth.js'
import { middleware } from './middleware.js'

dotenv.config()
const PORT=3000
const app =express()

app.use(express.json())



declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}



app.use("/loan", middleware, loanRouter)

app.use("/auth",authRouter)


app.get("/health",(req,res)=>{console.log("hello server")
  res.status(200).json({message:"server hello"})
})



app.listen(PORT,()=>{
    console.log('start' , PORT)
})
