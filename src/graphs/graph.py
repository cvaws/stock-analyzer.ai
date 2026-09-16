# Auto-generated LangGraph workflow definition
from langgraph.graph import StateGraph, START, END
from graphs.state import GraphState

from graphs.nodes.ingest_etfs import ingest_etfs
from graphs.nodes.calculate_indicators import calculate_indicators
from graphs.nodes.detect_patterns import detect_patterns
from graphs.nodes.optimize_strategies import optimize_strategies
from graphs.nodes.run_backtests import run_backtests
from graphs.nodes.ai_analysis import ai_analysis
from graphs.nodes.export_reports import export_reports


def build_workflow(include_optimization: bool = True):
    """
    Builds and compiles the StateGraph workflow.
    If include_optimization is False, skips the heavy optimize_strategies node (15-min grid search).
    """
    workflow = StateGraph(GraphState)

    # Add Nodes
    workflow.add_node('ingest_etfs', ingest_etfs)
    workflow.add_node('calculate_indicators', calculate_indicators)
    workflow.add_node('detect_patterns', detect_patterns)

    if include_optimization:
        workflow.add_node('optimize_strategies', optimize_strategies)

    workflow.add_node('run_backtests', run_backtests)
    workflow.add_node('ai_analysis', ai_analysis)
    workflow.add_node('export_reports', export_reports)

    # Add Edges
    workflow.add_edge(START, 'ingest_etfs')
    workflow.add_edge('ingest_etfs', 'calculate_indicators')
    workflow.add_edge('calculate_indicators', 'detect_patterns')

    if include_optimization:
        workflow.add_edge('detect_patterns', 'optimize_strategies')
        workflow.add_edge('optimize_strategies', 'run_backtests')
    else:
        workflow.add_edge('detect_patterns', 'run_backtests')

    workflow.add_edge('run_backtests', 'ai_analysis')
    workflow.add_edge('ai_analysis', 'export_reports')
    workflow.add_edge('export_reports', END)

    return workflow.compile()


# Default app compiled graph with optimization included
app = build_workflow(include_optimization=True)
