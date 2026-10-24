import express from 'express'
import { pool } from '../db.js'
import { createLoanSchema } from '../validation.js'

const router  = express.Router()


router.post("/create/loan",async(req,res)=>{
    const parsed = createLoanSchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ message: "invalid request body", errors: parsed.error.issues })
    }
    const payload=parsed.data
    const userId=req.userId
    try{
        if(!userId){
            res.status(403).json({message:"invalid authorization"})
            return 
        }
    const result=await pool.query(`INSERT INTO loans (user_id, friend_name, amount, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [userId, payload.friend_name, payload.amount, payload.due_date])

     return res.status(201).json({
      message: "Loan created successfully",
      loan: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating loan:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
})


router.get("/summary", async (req, res) => {

  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(amount), 0) AS total_lent,

        COALESCE(
          SUM(amount) FILTER (WHERE status = 'repaid'),
          0
        ) AS total_repaid,

        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'pending'
              AND due_date < CURRENT_DATE
          ),
          0
        ) AS overdue_amount

      FROM loans
      WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({
      summary: result.rows[0],
    });
    
  } catch (error) {
    console.error("Error fetching summary:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});



export default router
