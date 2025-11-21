from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============= Models =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GroupMember(BaseModel):
    user_id: str
    name: str

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    currency: str = "USD"
    members: List[GroupMember] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupCreate(BaseModel):
    name: str
    description: str = ""
    currency: str = "USD"
    member_names: List[str] = []

class Split(BaseModel):
    user_id: str
    name: str
    amount: float

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    description: str
    amount: float
    category: str = "Other"
    paid_by: str
    paid_by_name: str
    split_type: str  # equal, custom, percentage
    splits: List[Split] = []
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str = "Other"
    paid_by: str
    paid_by_name: str
    split_type: str
    splits: List[Split]
    date: str

class Settlement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    amount: float
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettlementCreate(BaseModel):
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    amount: float
    date: str

# ============= Auth Helpers =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"user_id": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return decode_token(credentials.credentials)

# ============= Auth Routes =============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(name=user_data.name, email=user_data.email)
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password_hash'] = hash_password(user_data.password)
    
    await db.users.insert_one(doc)
    token = create_token(user.id)
    
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'])
    return {"token": token, "user": {"id": user['id'], "name": user['name'], "email": user['email']}}

@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============= Group Routes =============

@api_router.post("/groups", response_model=Group)
async def create_group(group_data: GroupCreate, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    members = [GroupMember(user_id=user_id, name=user['name'])]
    for name in group_data.member_names:
        if name.strip():
            members.append(GroupMember(user_id=str(uuid.uuid4()), name=name.strip()))
    
    group = Group(
        name=group_data.name,
        description=group_data.description,
        currency=group_data.currency,
        members=[m.model_dump() for m in members],
        created_by=user_id
    )
    
    doc = group.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.groups.insert_one(doc)
    
    return group

@api_router.get("/groups", response_model=List[Group])
async def get_groups(user_id: str = Depends(get_current_user)):
    groups = await db.groups.find(
        {"members.user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    
    for group in groups:
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return groups

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    if isinstance(group.get('created_at'), str):
        group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    return group

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group['created_by'] != user_id:
        raise HTTPException(status_code=403, detail="Only creator can delete group")
    
    await db.groups.delete_one({"id": group_id})
    await db.expenses.delete_many({"group_id": group_id})
    await db.settlements.delete_many({"group_id": group_id})
    
    return {"message": "Group deleted successfully"}

# ============= Expense Routes =============

@api_router.post("/groups/{group_id}/expenses", response_model=Expense)
async def create_expense(group_id: str, expense_data: ExpenseCreate, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    expense = Expense(
        group_id=group_id,
        description=expense_data.description,
        amount=expense_data.amount,
        category=expense_data.category,
        paid_by=expense_data.paid_by,
        paid_by_name=expense_data.paid_by_name,
        split_type=expense_data.split_type,
        splits=[s.model_dump() for s in expense_data.splits],
        date=expense_data.date
    )
    
    doc = expense.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.expenses.insert_one(doc)
    
    return expense

@api_router.get("/groups/{group_id}/expenses", response_model=List[Expense])
async def get_expenses(group_id: str, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    expenses = await db.expenses.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    
    return expenses

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user_id: str = Depends(get_current_user)):
    expense = await db.expenses.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    group = await db.groups.find_one({"id": expense['group_id']})
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    await db.expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted successfully"}

# ============= Balance Calculation =============

@api_router.get("/groups/{group_id}/balances")
async def get_balances(group_id: str, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    expenses = await db.expenses.find({"group_id": group_id}).to_list(1000)
    settlements = await db.settlements.find({"group_id": group_id}).to_list(1000)
    
    # Calculate net balances
    balances = defaultdict(float)
    
    # Add expenses
    for expense in expenses:
        balances[expense['paid_by']] += expense['amount']
        for split in expense['splits']:
            balances[split['user_id']] -= split['amount']
    
    # Subtract settlements
    for settlement in settlements:
        balances[settlement['from_user_id']] += settlement['amount']
        balances[settlement['to_user_id']] -= settlement['amount']
    
    # Create member map
    member_map = {m['user_id']: m['name'] for m in group['members']}
    
    # Calculate who owes whom
    creditors = [(uid, amt) for uid, amt in balances.items() if amt > 0.01]
    debtors = [(uid, -amt) for uid, amt in balances.items() if amt < -0.01]
    
    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)
    
    transactions = []
    i, j = 0, 0
    
    while i < len(creditors) and j < len(debtors):
        creditor_id, credit = creditors[i]
        debtor_id, debt = debtors[j]
        
        amount = min(credit, debt)
        
        transactions.append({
            "from_user_id": debtor_id,
            "from_user_name": member_map.get(debtor_id, "Unknown"),
            "to_user_id": creditor_id,
            "to_user_name": member_map.get(creditor_id, "Unknown"),
            "amount": round(amount, 2)
        })
        
        creditors[i] = (creditor_id, credit - amount)
        debtors[j] = (debtor_id, debt - amount)
        
        if creditors[i][1] < 0.01:
            i += 1
        if debtors[j][1] < 0.01:
            j += 1
    
    # Calculate member summaries
    member_balances = []
    for member in group['members']:
        balance = balances.get(member['user_id'], 0)
        member_balances.append({
            "user_id": member['user_id'],
            "name": member['name'],
            "balance": round(balance, 2)
        })
    
    return {
        "transactions": transactions,
        "member_balances": member_balances,
        "currency": group['currency']
    }

# ============= Settlement Routes =============

@api_router.post("/groups/{group_id}/settle", response_model=Settlement)
async def create_settlement(group_id: str, settlement_data: SettlementCreate, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    settlement = Settlement(
        group_id=group_id,
        from_user_id=settlement_data.from_user_id,
        from_user_name=settlement_data.from_user_name,
        to_user_id=settlement_data.to_user_id,
        to_user_name=settlement_data.to_user_name,
        amount=settlement_data.amount,
        date=settlement_data.date
    )
    
    doc = settlement.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.settlements.insert_one(doc)
    
    return settlement

@api_router.get("/groups/{group_id}/settlements", response_model=List[Settlement])
async def get_settlements(group_id: str, user_id: str = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not any(m['user_id'] == user_id for m in group['members']):
        raise HTTPException(status_code=403, detail="Not a group member")
    
    settlements = await db.settlements.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    for settlement in settlements:
        if isinstance(settlement.get('created_at'), str):
            settlement['created_at'] = datetime.fromisoformat(settlement['created_at'])
    
    return settlements

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()