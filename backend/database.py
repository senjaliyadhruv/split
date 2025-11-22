from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager, asynccontextmanager
import os
import logging
from typing import AsyncGenerator
import aiomysql

logger = logging.getLogger(__name__)

# Database configuration
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', 3306))
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_NAME = os.environ.get('DB_NAME', 'splitwise_db')

# Construct database URL
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    echo=False  # Set to True for SQL logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async connection pool for aiomysql
async_pool = None


async def init_async_pool():
    """Initialize async connection pool"""
    global async_pool
    async_pool = await aiomysql.create_pool(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        charset='utf8mb4',
        minsize=1,
        maxsize=10,
        autocommit=False
    )
    logger.info("Async database pool initialized")


async def close_async_pool():
    """Close async connection pool"""
    global async_pool
    if async_pool:
        async_pool.close()
        await async_pool.wait_closed()
        logger.info("Async database pool closed")


@asynccontextmanager
async def get_async_connection():
    """Get async database connection from pool"""
    global async_pool
    if async_pool is None:
        await init_async_pool()
    
    async with async_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            yield cursor
            await conn.commit()


def get_db() -> Session:
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create tables"""
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # Test connection
        result = conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    
    logger.info("Database initialized")


def test_connection():
    """Test database connection"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT VERSION()"))
            version = result.fetchone()[0]
            logger.info(f"Connected to MySQL version: {version}")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return False
