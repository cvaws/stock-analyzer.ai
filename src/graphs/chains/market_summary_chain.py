"""
A placeholder runnable chain.
"""
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# --- LLM Configuration (Openai) ---
# TODO: Uncomment and configure your preferred LLM provider:
# from langchain_openai import ChatOpenAI
# llm = ChatOpenAI(model="ollama/qwen2.5:14b", temperature=0.0)


# --- Prompt Template ---
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
])

# --- Chain Definition ---
# Replace `StrOutputParser()` with your desired output parser.
# If using an LLM: market_summary_chain = prompt | llm | StrOutputParser()
market_summary_chain = prompt | StrOutputParser()
