import type { NextFunction } from "express";
import jwt, { type JwtPayload } from 'jsonwebtoken'
import type{ Request,Response } from "express";

export function middleware(req:Request,res:Response,next:NextFunction){
    const authHeader = req.headers.authorization;
    try{
    const token=authHeader?.split(" ")[1]
    if(!token){
        return res.status(403).json({message:"unAuthorized"})
    }
    const decode = jwt.verify(token,process.env.JWT_SECRET!) as JwtPayload
    console.log("decoded " , decode)
    req.userId=decode.userId
    next()
    
}catch(e){
    
    res.status(500).json({message:"Internal server error"})
    return
}
}