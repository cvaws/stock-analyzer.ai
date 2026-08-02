# Project Rules & Software Engineering Standards

## 1. Modular & Decoupled Architecture
- **Single Responsibility Principle**: Never lump distinct indicators, tools, or strategies into monolithic scripts.
- **Dedicated Modules**: Place all technical indicators in individual python scripts under `src/indicators/<indicator_name>.py`.
- **Clean Package Exports**: Use `src/indicators/__init__.py` to export clean interface APIs for node consumers.

## 2. Professional Standards
- Provide clear docstrings, type annotations (`pd.DataFrame`, `pd.Series`, `float`, `int`), and error handling for all functions.
- Keep Pine Script parity mathematically accurate and documented.
