step 1 
database design

User 
id: string,
mobile_no: number,
created_at:DATE

Loan 
id:string,
userId : string,
friend_name:string,
due_date:string,
repaid:string,
created_at:DATE


step 2  Auth
1. post  /create/otp
payload :{
    mobile_no
}
response : 200/400/500

2. get   /validate/otp

payload : {
    otp:23232
}
response :
 {
    message,
    token,
    user:{
        id,
        mobile_no
    }
 }

<!--  -->
step 3 Loan routes

1. post /loan-add

payload:{
    friend_name:string,
    due_date:string,

}
response 201/400/500

2. patch /loan/:id/repay
response 200/500

3. get /loan/summary

response 
    {
  "totalLent": 3500,
  "totalRepaid": 500,
  "overdueAmount": 1000
}


<!--  -->
step 3 











