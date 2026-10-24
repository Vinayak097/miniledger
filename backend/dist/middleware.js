import jwt, {} from 'jsonwebtoken';
export function middleware(req, res, next) {
    const authHeader = req.headers.authorization;
    try {
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return res.status(403).json({ message: "unAuthorized" });
        }
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        console.log("decoded ", decode);
        req.userId = decode.userId;
        next();
    }
    catch (e) {
        res.status(500).json({ message: "Internal server error" });
        return;
    }
}
//# sourceMappingURL=middleware.js.map