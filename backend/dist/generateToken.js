import jwt from 'jsonwebtoken';
export function generateToken(userId) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
    return token;
}
//# sourceMappingURL=generateToken.js.map