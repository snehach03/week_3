import io
import csv
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.database.models import PrepListItem, ForecastItem, ForecastRun
from app.schemas.forecast_schemas import PrepItemUpdate, PrepItemOut, PrepListResponse, PrepListSaveRequest

class PrepListService:
    """Handles the baker prep list workflow, human overrides, notes, and CSV export."""

    def get_latest_prep_list(self, db: Session, target_date: Optional[str] = None) -> Optional[PrepListResponse]:
        if not target_date:
            latest_entry = db.query(PrepListItem.target_date).order_by(PrepListItem.target_date.desc()).first()
            if not latest_entry:
                return None
            target_date = latest_entry[0]

        items = db.query(PrepListItem).filter(PrepListItem.target_date == target_date).all()
        if not items:
            return None

        out_items = [
            PrepItemOut(
                item=item.item,
                target_date=item.target_date,
                forecast_point=item.forecast_point,
                suggested_prep=item.suggested_prep,
                final_quantity=item.final_quantity,
                is_overridden=item.is_overridden,
                baker_notes=item.baker_notes or "",
                reason=item.reason or ""
            )
            for item in items
        ]

        latest_update = max((item.updated_at for item in items if item.updated_at), default=datetime.utcnow())

        return PrepListResponse(
            target_date=target_date,
            updated_at=latest_update.isoformat(),
            items=out_items
        )

    def save_prep_list(self, db: Session, req: PrepListSaveRequest) -> PrepListResponse:
        for update in req.items:
            db_item = db.query(PrepListItem).filter(
                PrepListItem.target_date == req.target_date,
                PrepListItem.item == update.item
            ).first()

            if db_item:
                # Retain original suggestion while updating baker override
                db_item.final_quantity = update.final_quantity
                db_item.is_overridden = bool(update.final_quantity != db_item.suggested_prep or update.is_overridden)
                db_item.baker_notes = update.baker_notes
                db_item.updated_at = datetime.utcnow()
            else:
                db_item = PrepListItem(
                    target_date=req.target_date,
                    item=update.item,
                    forecast_point=float(update.final_quantity),
                    suggested_prep=int(update.final_quantity),
                    final_quantity=int(update.final_quantity),
                    is_overridden=update.is_overridden,
                    baker_notes=update.baker_notes,
                    reason="Manual entry"
                )
                db.add(db_item)

        db.commit()
        return self.get_latest_prep_list(db, req.target_date)

    def export_csv(self, db: Session, target_date: Optional[str] = None) -> Tuple[str, str]:
        """
        Exports the preparation list as a downloadable CSV.
        Returns (csv_string, filename).
        """
        prep_data = self.get_latest_prep_list(db, target_date)
        if not prep_data or not prep_data.items:
            # Fallback empty CSV
            return "Item,Target Date,Expected Demand,Suggested Prep,Final Baker Quantity,Overridden,Baker Notes,AI Reason\n", "prep_list.csv"

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Item",
            "Target Date",
            "Expected Demand (AI)",
            "Suggested Prep (AI)",
            "Final Baker Quantity",
            "Overridden",
            "Difference",
            "Baker Notes",
            "AI Reason"
        ])

        for it in prep_data.items:
            diff = it.final_quantity - it.suggested_prep
            diff_str = f"+{diff}" if diff > 0 else (str(diff) if diff < 0 else "0")
            writer.writerow([
                it.item,
                it.target_date,
                f"{it.forecast_point:.1f}",
                it.suggested_prep,
                it.final_quantity,
                "YES" if it.is_overridden else "NO",
                diff_str,
                it.baker_notes,
                it.reason
            ])

        filename = f"tomorrows_tray_prep_list_{prep_data.target_date}.csv"
        return output.getvalue(), filename

prep_list_service = PrepListService()
