import hmac,hashlib,base64,json,time,os
key=base64.b64decode(os.environ["SECRET_B64"])
def b(o): return base64.urlsafe_b64encode(json.dumps(o,separators=(",",":")).encode()).rstrip(b"=").decode()
def sign(p):
    h=b({"alg":"HS256","typ":"JWT"})+"."+b(p)
    sig=base64.urlsafe_b64encode(hmac.new(key,h.encode(),hashlib.sha256).digest()).rstrip(b"=").decode()
    return h+"."+sig
now=int(time.time()); uid=os.environ["LMUID"]
print(json.dumps({"access":sign({"email":"test@lmthing.cloud","sub":uid,"iat":now,"exp":now+43200}),"refresh":sign({"type":"refresh","sub":uid,"iat":now,"exp":now+2592000}),"exp":(now+43200)*1000,"uid":uid}))
