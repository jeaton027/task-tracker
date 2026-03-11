## python script Alembic executes for each migration command. 
# 1. connects Alembic to models (target_metadat = Base.metadata)
# 2. connects Alembic to database (reads url from settings)
## has two modes:
# Offline: generates SQL scripts w/o connecting to the DB ; used for reviewing what will change
# Online: connects to the DB and runs the migration directly ; used for reg use.

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import get_settings
from app.db.base import Base

# gives access to values in alembic.ini
config = context.config

# sets up python logging using the config in alembic.ini
if config.config_file_name is not None:
	fileConfig(config.config_file_name)

# muy importante
# Alembis compares Base.metadata against actual db schema to work out what
# migrations are needed. Every model that inherits from Base is included here automatically.
target_metadata = Base.metadata


def get_url() -> str:
	#alembic runs migration as a one-shot script, not a web server
	#doesn't need async - uses sunc psycopg driver
	return get_settings().database_url


def run_migrations_offline() -> None:
	# Generate SQL w/o a live DB connection
	# for reviewing or manually running migrations
	context.configure(
		url=get_url(),
		target_metadata=target_metadata,
		literal_binds=True,
		dialect_opts={"paramstyle": "named"},
	)
	with context.begin_transation():
		context.run_migrations()


def run_migration_online() -> None:
	#connect to the DB and run migrations directly

	connectable = create_engine(get_url(), poolclass=pool.NullPool) # nullPool: don't maintain connection pool

	with connectable.connect() as connection:
		context.configure(connection=connection, target_metadata=target_metadata)
		with context.begin_transaction():
			context.run_migrations()
	

if context.is_offline_mode():
	run_migrations_offline()
else:
	run_migration_online()