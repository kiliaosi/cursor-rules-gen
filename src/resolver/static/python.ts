import { createEcosystemProvider, type KnowledgeTable } from './_table.js'

const TABLE: KnowledgeTable = {
  // ---------- Frameworks ----------
  django: {
    displayName: 'Django', category: 'framework', variant: 'Web framework',
    summary: 'High-level Python web framework',
    conventions: ['Follow Django app conventions (models / views / urls).', 'Prefer class-based views for standard CRUD.'],
    commands: ['python manage.py runserver', 'python manage.py migrate', 'python manage.py test'],
  },
  flask: {
    displayName: 'Flask', category: 'framework', variant: 'Web framework',
    summary: 'Lightweight WSGI web framework',
    conventions: ['Use blueprints for modular apps.', 'Keep routes thin; move logic to a service layer.'],
  },
  fastapi: {
    displayName: 'FastAPI', category: 'framework', variant: 'Web framework',
    summary: 'High-performance async Python web framework',
    conventions: [
      'Use Pydantic models for request / response schemas.',
      'Use dependency injection for shared resources.',
      'Use `async def` for endpoints when calling async I/O.',
    ],
    commands: ['uvicorn main:app --reload'],
  },
  starlette: { displayName: 'Starlette', category: 'framework', variant: 'Web framework', summary: 'ASGI framework / toolkit' },
  tornado: { displayName: 'Tornado', category: 'framework', variant: 'Web framework', summary: 'Async networking library and web framework' },
  sanic: { displayName: 'Sanic', category: 'framework', variant: 'Web framework', summary: 'Async Python web server' },
  litestar: { displayName: 'Litestar', category: 'framework', variant: 'Web framework', summary: 'High-performance ASGI framework' },
  celery: { displayName: 'Celery', category: 'framework', variant: 'Task queue', summary: 'Distributed task queue' },
  scrapy: { displayName: 'Scrapy', category: 'framework', variant: 'Web scraping', summary: 'Web scraping framework' },
  langchain: { displayName: 'LangChain', category: 'framework', variant: 'AI/LLM', summary: 'LLM application framework' },
  llama_index: { displayName: 'LlamaIndex', category: 'framework', variant: 'AI/LLM', summary: 'Data framework for LLM applications' },
  transformers: { displayName: 'Transformers', category: 'framework', variant: 'AI/ML', summary: 'HuggingFace model library' },
  torch: { displayName: 'PyTorch', category: 'framework', variant: 'AI/ML', summary: 'Deep learning framework' },
  tensorflow: { displayName: 'TensorFlow', category: 'framework', variant: 'AI/ML', summary: 'Machine learning platform' },
  numpy: { displayName: 'NumPy', category: 'utility', variant: 'Data science', summary: 'Numerical computing library' },
  pandas: { displayName: 'Pandas', category: 'utility', variant: 'Data science', summary: 'Data analysis library' },
  scipy: { displayName: 'SciPy', category: 'utility', variant: 'Data science', summary: 'Scientific computing library' },
  streamlit: { displayName: 'Streamlit', category: 'framework', variant: 'Data apps', summary: 'Data app framework' },
  gradio: { displayName: 'Gradio', category: 'framework', variant: 'AI demos', summary: 'ML demo interface builder' },

  // ---------- Testing ----------
  pytest: {
    displayName: 'pytest', category: 'testing',
    summary: 'Python testing framework',
    conventions: ['Test files: `test_*.py` or `*_test.py`.', 'Use fixtures for setup.', 'Use `parametrize` for data-driven tests.'],
    commands: ['pytest', 'pytest -v', 'pytest --cov'],
  },
  unittest: { displayName: 'unittest', category: 'testing', summary: 'Python built-in test framework' },
  hypothesis: { displayName: 'Hypothesis', category: 'testing', summary: 'Property-based testing for Python' },
  tox: { displayName: 'tox', category: 'testing', summary: 'Test automation across Python versions', commands: ['tox'] },
  nox: { displayName: 'nox', category: 'testing', summary: 'Flexible test automation', commands: ['nox'] },

  // ---------- Databases ----------
  sqlalchemy: { displayName: 'SQLAlchemy', category: 'database', summary: 'Python SQL toolkit and ORM' },
  tortoise_orm: { displayName: 'Tortoise ORM', category: 'database', summary: 'Async Python ORM' },
  peewee: { displayName: 'Peewee', category: 'database', summary: 'Lightweight Python ORM' },
  mongoengine: { displayName: 'MongoEngine', category: 'database', summary: 'MongoDB ODM for Python' },
  pymongo: { displayName: 'PyMongo', category: 'database', summary: 'MongoDB driver for Python' },
  psycopg2: { displayName: 'PostgreSQL (psycopg2)', category: 'database', summary: 'PostgreSQL adapter for Python' },
  asyncpg: { displayName: 'PostgreSQL (asyncpg)', category: 'database', summary: 'Async PostgreSQL driver' },

  // ---------- Dev tools ----------
  ruff: { displayName: 'Ruff', category: 'devtool', summary: 'Extremely fast Python linter and formatter', commands: ['ruff check .', 'ruff format .'] },
  black: { displayName: 'Black', category: 'devtool', summary: 'Opinionated Python code formatter', commands: ['black .'] },
  isort: { displayName: 'isort', category: 'devtool', summary: 'Python import sorter' },
  mypy: { displayName: 'mypy', category: 'devtool', summary: 'Static type checker for Python', commands: ['mypy .'] },
  pyright: { displayName: 'Pyright', category: 'devtool', summary: 'Static type checker for Python' },
  flake8: { displayName: 'Flake8', category: 'devtool', summary: 'Python style guide enforcer' },
  pylint: { displayName: 'Pylint', category: 'devtool', summary: 'Python code analyzer' },
  bandit: { displayName: 'Bandit', category: 'devtool', summary: 'Python security linter' },
}

export const pythonKnowledge = createEcosystemProvider('static:python', 'python', TABLE)
