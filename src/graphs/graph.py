# Auto-generated LangGraph workflow definition
from langgraph.graph import StateGraph, START, END
from graphs.state import GraphState
# No checkpointer configured — graph runs statelessly.
# To add persistence, set memory.type in your agent YAML.
_checkpointer = None

from graphs.nodes.ingest_etfs import ingest_etfs
from graphs.nodes.calculate_indicators import calculate_indicators
from graphs.nodes.detect_patterns import detect_patterns
from graphs.nodes.optimize_strategies import optimize_strategies
from graphs.nodes.run_backtests import run_backtests
from graphs.nodes.ai_analysis import ai_analysis
from graphs.nodes.export_reports import export_reports

# Initialize StateGraph
workflow = StateGraph(GraphState)

# Add Nodes
workflow.add_node('ingest_etfs', ingest_etfs)
workflow.add_node('calculate_indicators', calculate_indicators)
workflow.add_node('detect_patterns', detect_patterns)
workflow.add_node('optimize_strategies', optimize_strategies)
workflow.add_node('run_backtests', run_backtests)
workflow.add_node('ai_analysis', ai_analysis)
workflow.add_node('export_reports', export_reports)

# Add Edges
workflow.add_edge(START, 'ingest_etfs')
workflow.add_edge('ingest_etfs', 'calculate_indicators')
workflow.add_edge('calculate_indicators', 'detect_patterns')
workflow.add_edge('detect_patterns', 'optimize_strategies')
workflow.add_edge('optimize_strategies', 'run_backtests')
workflow.add_edge('run_backtests', 'export_reports')
workflow.add_edge('export_reports', END)

# Compile Application Workflow
app = workflow.compile()
