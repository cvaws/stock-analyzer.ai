def calculate_rrg_quadrant(rs_weekly_pct: float, rs_weekly_velocity: float) -> str:
    """
    Relative Rotation Graph (RRG) Quadrant Classification.
    - Leading: RS > 0 and Velocity > 0 (High RS, accelerating momentum)
    - Weakening: RS > 0 and Velocity <= 0 (High RS, decelerating momentum)
    - Lagging: RS <= 0 and Velocity <= 0 (Low RS, decelerating momentum)
    - Improving: RS <= 0 and Velocity > 0 (Low RS, accelerating momentum)
    """
    rs_val = float(rs_weekly_pct) if rs_weekly_pct is not None else 0.0
    vel_val = float(rs_weekly_velocity) if rs_weekly_velocity is not None else 0.0

    if rs_val > 0:
        return "Leading" if vel_val > 0 else "Weakening"
    else:
        return "Improving" if vel_val > 0 else "Lagging"
