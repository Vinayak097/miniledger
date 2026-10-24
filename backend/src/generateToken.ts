import jwt from 'jsonwebtoken'
export function generateToken(userId:string){
    const token=jwt.sign({userId},process.env.JWT_SECRET!)
    return token
}

