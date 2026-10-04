from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from .extensions import db
from .models import Review


def rating_data_for(product_ids):
    ids = list(product_ids)
    result = {pid: {"avg": 0, "count": 0, "latest": None} for pid in ids}
    if not ids:
        return result

    rows = (
        db.session.query(Review.product_id, func.count(Review.id), func.avg(Review.rating))
        .filter(Review.product_id.in_(ids))
        .group_by(Review.product_id)
        .all()
    )
    for pid, n, avg in rows:
        result[pid]["count"] = int(n)
        result[pid]["avg"] = round(float(avg), 1)

    latest_ids = (
        select(func.max(Review.id))
        .where(Review.product_id.in_(ids))
        .group_by(Review.product_id)
    )
    latest = (
        Review.query.options(joinedload(Review.user), selectinload(Review.images))
        .filter(Review.id.in_(latest_ids))
        .all()
    )
    for r in latest:
        result[r.product_id]["latest"] = {
            "text": r.comment or "",
            "userName": r.user.username if r.user else "Pengguna",
            "hasImages": bool(r.images),
        }
    return result
