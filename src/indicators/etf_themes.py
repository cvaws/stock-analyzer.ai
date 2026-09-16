"""
ETF Theme & Sector Name Mappings for StockWave Theme Tracker.
Maps ticker symbols to clear, human-readable industry / theme names.
"""
from typing import Dict

ETF_THEME_NAMES: Dict[str, str] = {
    # Breadth / Sectors
    "XLF": "Banks & Financials",
    "IYT": "Transports",
    "PAVE": "Infrastructure",
    "XHB": "Home Construction",
    "XRT": "Retail",
    "KRE": "Regional Banks",
    "KIE": "Insurance",
    "XLE": "Energy",
    "XOP": "Oil & Gas Exploration",
    "OIH": "Oil Services",
    "COPX": "Copper Miners",
    "XME": "Metals & Mining",
    "GUNR": "Natural Resources",
    "PPH": "Pharmaceuticals",
    "IHF": "Healthcare Providers",
    "IHI": "Medical Devices",
    
    # Canaries / Major Indices
    "SPY": "S&P 500",
    "QQQ": "Nasdaq 100",
    "IWM": "Russell 2000",
    "SMH": "Semiconductors",
    "SPMO": "S&P Momentum",
    
    # Macro & Intermarket
    "UUP": "US Dollar Index",
    "^TNX": "10Y Treasury Yield",
    "TNX": "10Y Treasury Yield",
    "TLT": "20Y Treasuries",
    "HYG": "High Yield Corporate",
    "IEF": "7-10Y Treasuries",
    "RSP": "Equal Weight S&P",
    "VIXY": "Short-Term VIX",
    
    # Leadership / Themes
    "IGV": "Software",
    "MAGS": "Mag 7 Tech",
    "IBIT": "Bitcoin",
    "ARTY": "AI & Robotics",
    "CIBR": "Cybersecurity",
    "DRAM": "Memory & Storage",
    "WQTM": "Quantum Computing",
    "WGMI": "Bitcoin Miners",
    "ARKQ": "Autonomous Tech",
    "ARKG": "Genomics",
    "ARKF": "Fintech",
    "XBI": "Biotechnology",
    "NASA": "Space Economy",
    "UFO": "Space Exploration",
    "DAPP": "Digital Assets",
    "FOTO": "Photonics",
    
    # Defense / Commodities / Real Estate
    "GLD": "Gold",
    "SLV": "Silver",
    "PLTM": "Platinum",
    "PALL": "Palladium",
    "REET": "Global Real Estate",
    "REM": "Mortgage Real Estate",
    "MLPX": "Energy Infrastructure",
    "USO": "Crude Oil",
    "TAN": "Solar Energy",
    "LIT": "Lithium & Battery",
    "REMX": "Rare Earth Metals",
    "MSOS": "Cannabis"
}

def get_etf_theme_name(ticker: str, fallback_company_name: str = "") -> str:
    """Returns clean theme/industry name for an ETF, or fallback if unmapped."""
    upper = ticker.upper()
    if upper in ETF_THEME_NAMES:
        return ETF_THEME_NAMES[upper]
    if fallback_company_name and fallback_company_name != f"{ticker} ETF":
        return fallback_company_name
    return ticker
