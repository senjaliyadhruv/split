from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from collections import defaultdict
import os
import logging

from database import get_async_connection, init_async_pool, close_async_pool, test_connection

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer()

app = FastAPI()

# ============= CRITICAL FIX: ADD CORS MIDDLEWARE FIRST =============
# CORS middleware MUST be added BEFORE any other middleware or routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:30000",
        "http://localhost:30001",
        "http://18.209.176.95:30001",  # Frontend URL
        "http://18.209.176.95:30000",  # Backend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    split_type: str
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
    try:
        async with get_async_connection() as cursor:
            # Check if email exists
            await cursor.execute("SELECT id FROM users WHERE email = %s", (user_data.email,))
            existing = await cursor.fetchone()
            
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")
            
            user = User(name=user_data.name, email=user_data.email)
            password_hash = hash_password(user_data.password)
            
            # Insert user
            await cursor.execute(
                "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (%s, %s, %s, %s, %s)",
                (user.id, user.name, user.email, password_hash, user.created_at)
            )
            
            token = create_token(user.id)
            return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    try:
        async with get_async_connection() as cursor:
            await cursor.execute(
                "SELECT id, name, email, password_hash FROM users WHERE email = %s",
                (credentials.email,)
            )
            user = await cursor.fetchone()
            
            if not user or not verify_password(credentials.password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            token = create_token(user['id'])
            return {"token": token, "user": {"id": user['id'], "name": user['name'], "email": user['email']}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        await cursor.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = %s",
            (user_id,)
        )
        user = await cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user

# ============= Group Routes =============

@api_router.post("/groups", response_model=Group)
async def create_group(group_data: GroupCreate, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Get user info
        await cursor.execute("SELECT name FROM users WHERE id = %s", (user_id,))
        user = await cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        group_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)
        
        # Insert group
        await cursor.execute(
            "INSERT INTO `groups` (id, name, description, currency, created_by, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (group_id, group_data.name, group_data.description, group_data.currency, user_id, created_at)
        )
        
        # Add creator as member
        members = [GroupMember(user_id=user_id, name=user['name'])]
        await cursor.execute(
            "INSERT INTO group_members (group_id, user_id, name) VALUES (%s, %s, %s)",
            (group_id, user_id, user['name'])
        )
        
        # Add other members
        for name in group_data.member_names:
            if name.strip():
                member_id = str(uuid.uuid4())
                members.append(GroupMember(user_id=member_id, name=name.strip()))
                await cursor.execute(
                    "INSERT INTO group_members (group_id, user_id, name) VALUES (%s, %s, %s)",
                    (group_id, member_id, name.strip())
                )
        
        return Group(
            id=group_id,
            name=group_data.name,
            description=group_data.description,
            currency=group_data.currency,
            members=[m.model_dump() for m in members],
            created_by=user_id,
            created_at=created_at
        )

@api_router.get("/groups", response_model=List[Group])
async def get_groups(user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Get groups where user is a member
        await cursor.execute(
            """
            SELECT DISTINCT g.* 
            FROM `groups` g
            INNER JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = %s
            ORDER BY g.created_at DESC
            """,
            (user_id,)
        )
        groups_data = await cursor.fetchall()
        
        groups = []
        for group_data in groups_data:
            # Get members for each group
            await cursor.execute(
                "SELECT user_id, name FROM group_members WHERE group_id = %s",
                (group_data['id'],)
            )
            members = await cursor.fetchall()
            
            groups.append(Group(
                id=group_data['id'],
                name=group_data['name'],
                description=group_data['description'],
                currency=group_data['currency'],
                members=members,
                created_by=group_data['created_by'],
                created_at=group_data['created_at']
            ))
        
        return groups

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Get group
        await cursor.execute("SELECT * FROM `groups` WHERE id = %s", (group_id,))
        group_data = await cursor.fetchone()
        
        if not group_data:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if user is a member
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        # Get members
        await cursor.execute(
            "SELECT user_id, name FROM group_members WHERE group_id = %s",
            (group_id,)
        )
        members = await cursor.fetchall()
        
        return Group(
            id=group_data['id'],
            name=group_data['name'],
            description=group_data['description'],
            currency=group_data['currency'],
            members=members,
            created_by=group_data['created_by'],
            created_at=group_data['created_at']
        )

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Check if group exists and user is creator
        await cursor.execute(
            "SELECT created_by FROM `groups` WHERE id = %s",
            (group_id,)
        )
        group = await cursor.fetchone()
        
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if group['created_by'] != user_id:
            raise HTTPException(status_code=403, detail="Only creator can delete group")
        
        # Delete group (cascade will handle related records)
        await cursor.execute("DELETE FROM `groups` WHERE id = %s", (group_id,))
        
        return {"message": "Group deleted successfully"}

# ============= Expense Routes =============

@api_router.post("/groups/{group_id}/expenses", response_model=Expense)
async def create_expense(group_id: str, expense_data: ExpenseCreate, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Verify user is a member
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        expense_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)
        
        # Insert expense
        await cursor.execute(
            """
            INSERT INTO expenses (id, group_id, description, amount, category, paid_by, paid_by_name, split_type, date, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (expense_id, group_id, expense_data.description, expense_data.amount, expense_data.category,
             expense_data.paid_by, expense_data.paid_by_name, expense_data.split_type, expense_data.date, created_at)
        )
        
        # Insert splits
        for split in expense_data.splits:
            await cursor.execute(
                "INSERT INTO expense_splits (expense_id, user_id, name, amount) VALUES (%s, %s, %s, %s)",
                (expense_id, split.user_id, split.name, split.amount)
            )
        
        return Expense(
            id=expense_id,
            group_id=group_id,
            description=expense_data.description,
            amount=expense_data.amount,
            category=expense_data.category,
            paid_by=expense_data.paid_by,
            paid_by_name=expense_data.paid_by_name,
            split_type=expense_data.split_type,
            splits=[s.model_dump() for s in expense_data.splits],
            date=expense_data.date,
            created_at=created_at
        )

@api_router.get("/groups/{group_id}/expenses", response_model=List[Expense])
async def get_expenses(group_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Verify membership
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        # Get expenses
        await cursor.execute(
            "SELECT * FROM expenses WHERE group_id = %s ORDER BY date DESC, created_at DESC",
            (group_id,)
        )
        expenses_data = await cursor.fetchall()
        
        expenses = []
        for expense_data in expenses_data:
            # Get splits for each expense
            await cursor.execute(
                "SELECT user_id, name, amount FROM expense_splits WHERE expense_id = %s",
                (expense_data['id'],)
            )
            splits = await cursor.fetchall()
            
            expenses.append(Expense(
                id=expense_data['id'],
                group_id=expense_data['group_id'],
                description=expense_data['description'],
                amount=float(expense_data['amount']),
                category=expense_data['category'],
                paid_by=expense_data['paid_by'],
                paid_by_name=expense_data['paid_by_name'],
                split_type=expense_data['split_type'],
                splits=splits,
                date=str(expense_data['date']),
                created_at=expense_data['created_at']
            ))
        
        return expenses

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Get expense and verify membership
        await cursor.execute(
            """
            SELECT e.group_id 
            FROM expenses e
            INNER JOIN group_members gm ON e.group_id = gm.group_id
            WHERE e.id = %s AND gm.user_id = %s
            """,
            (expense_id, user_id)
        )
        expense = await cursor.fetchone()
        
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found or access denied")
        
        # Delete expense (cascade will handle splits)
        await cursor.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
        
        return {"message": "Expense deleted successfully"}

# ============= Balance Calculation =============

@api_router.get("/groups/{group_id}/balances")
async def get_balances(group_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Verify membership
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        # Get group currency
        await cursor.execute("SELECT currency FROM `groups` WHERE id = %s", (group_id,))
        group_data = await cursor.fetchone()
        
        # Get all expenses with splits
        await cursor.execute(
            """
            SELECT e.paid_by, e.amount, es.user_id, es.amount as split_amount
            FROM expenses e
            INNER JOIN expense_splits es ON e.id = es.expense_id
            WHERE e.group_id = %s
            """,
            (group_id,)
        )
        expense_splits = await cursor.fetchall()
        
        # Get all settlements
        await cursor.execute(
            "SELECT from_user_id, to_user_id, amount FROM settlements WHERE group_id = %s",
            (group_id,)
        )
        settlements_data = await cursor.fetchall()
        
        # Calculate balances
        balances = defaultdict(float)
        
        for row in expense_splits:
            balances[row['paid_by']] += float(row['amount'])
            balances[row['user_id']] -= float(row['split_amount'])
        
        for settlement in settlements_data:
            balances[settlement['from_user_id']] += float(settlement['amount'])
            balances[settlement['to_user_id']] -= float(settlement['amount'])
        
        # Get member names
        await cursor.execute(
            "SELECT user_id, name FROM group_members WHERE group_id = %s",
            (group_id,)
        )
        members = await cursor.fetchall()
        member_map = {m['user_id']: m['name'] for m in members}
        
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
        
        # Member balances
        member_balances = [
            {
                "user_id": member['user_id'],
                "name": member['name'],
                "balance": round(balances.get(member['user_id'], 0), 2)
            }
            for member in members
        ]
        
        return {
            "transactions": transactions,
            "member_balances": member_balances,
            "currency": group_data['currency']
        }

# ============= Settlement Routes =============

@api_router.post("/groups/{group_id}/settle", response_model=Settlement)
async def create_settlement(group_id: str, settlement_data: SettlementCreate, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Verify membership
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        settlement_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)
        
        # Insert settlement
        await cursor.execute(
            """
            INSERT INTO settlements (id, group_id, from_user_id, from_user_name, to_user_id, to_user_name, amount, date, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (settlement_id, group_id, settlement_data.from_user_id, settlement_data.from_user_name,
             settlement_data.to_user_id, settlement_data.to_user_name, settlement_data.amount,
             settlement_data.date, created_at)
        )
        
        return Settlement(
            id=settlement_id,
            group_id=group_id,
            from_user_id=settlement_data.from_user_id,
            from_user_name=settlement_data.from_user_name,
            to_user_id=settlement_data.to_user_id,
            to_user_name=settlement_data.to_user_name,
            amount=settlement_data.amount,
            date=settlement_data.date,
            created_at=created_at
        )

@api_router.get("/groups/{group_id}/settlements", response_model=List[Settlement])
async def get_settlements(group_id: str, user_id: str = Depends(get_current_user)):
    async with get_async_connection() as cursor:
        # Verify membership
        await cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, user_id)
        )
        is_member = await cursor.fetchone()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a group member")
        
        # Get settlements
        await cursor.execute(
            "SELECT * FROM settlements WHERE group_id = %s ORDER BY date DESC, created_at DESC",
            (group_id,)
        )
        settlements_data = await cursor.fetchall()
        
        return [
            Settlement(
                id=s['id'],
                group_id=s['group_id'],
                from_user_id=s['from_user_id'],
                from_user_name=s['from_user_name'],
                to_user_id=s['to_user_id'],
                to_user_name=s['to_user_name'],
                amount=float(s['amount']),
                date=str(s['date']),
                created_at=s['created_at']
            )
            for s in settlements_data
        ]

# ============= Include router AFTER CORS middleware =============
app.include_router(api_router)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize database connection pool on startup"""
    await init_async_pool()
    if test_connection():
        logger.info("✓ Database connection successful")
    else:
        logger.error("✗ Database connection failed")

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on shutdown"""
    await close_async_pool()
    logger.info("Application shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
