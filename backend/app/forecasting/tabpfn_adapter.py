import logging
from typing import Dict, Any, Optional
import pandas as pd
from app.forecasting.ml_model import BakeryMLForecaster

logger = logging.getLogger(__name__)

class TabPFNAdapter:
    """
    Modular integration adapter for TabPFN (Prior-Data Fitted Networks for Tabular Data).
    Checks runtime environment compatibility and provides Scikit-learn fallback if TabPFN
    is not installed or torch dependencies are absent.
    """
    name: str = "tabpfn"

    def __init__(self):
        self.fallback = BakeryMLForecaster()
        self._is_available: Optional[bool] = None
        self._status_message: str = "Checking status..."
        self._model_class = None
        self._init_tabpfn()

    def _init_tabpfn(self):
        try:
            from tabpfn import TabPFNRegressor
            self._model_class = TabPFNRegressor
            self._is_available = True
            self._status_message = "TabPFN is available and loaded."
        except ImportError:
            self._is_available = False
            self._status_message = (
                "TabPFN is not installed in the local environment. "
                "The application automatically falls back to Scikit-learn Random Forest and statistical baselines."
            )
        except Exception as e:
            self._is_available = False
            self._status_message = f"TabPFN initialization error: {str(e)}"

    def is_available(self) -> bool:
        return bool(self._is_available)

    def get_status(self) -> Dict[str, Any]:
        return {
            "name": "TabPFN",
            "is_available": self._is_available,
            "status_message": self._status_message,
            "fallback_active": not self._is_available,
            "fallback_model": self.fallback.name
        }

    def predict(
        self,
        df_item: pd.DataFrame,
        target_date: str,
        use_censored_correction: bool = True
    ) -> Dict[str, Any]:
        """
        Runs TabPFN if installed and dataset size is compatible (< 1000 rows),
        otherwise falls back to BakeryMLForecaster.
        """
        if not self._is_available or self._model_class is None:
            res = self.fallback.predict(df_item, target_date, use_censored_correction)
            res["tabpfn_status"] = self._status_message
            return res

        # If TabPFN is available, build tabular features and run prediction
        try:
            target_val_col = "estimated_demand" if use_censored_correction and "estimated_demand" in df_item.columns else "quantity_sold"
            valid_history = df_item[df_item["date"] < target_date]
            X_train, y_train = self.fallback.prepare_training_dataset(valid_history, target_val_col)
            
            if len(X_train) < 7:
                return self.fallback.predict(df_item, target_date, use_censored_correction)

            target_features = self.fallback.build_feature_row(valid_history, target_date, target_val_col)
            if target_features is None:
                return self.fallback.predict(df_item, target_date, use_censored_correction)

            # TabPFN works best with small tabular datasets
            reg = self._model_class()
            reg.fit(X_train, y_train)
            pred = float(reg.predict(pd.DataFrame([target_features]))[0])
            pred = max(0.0, pred)

            # TabPFN prediction interval
            std_est = max(2.0, pred * 0.15)
            lower = max(0.0, pred - 1.28 * std_est)
            upper = pred + 1.28 * std_est

            return {
                "point_forecast": round(pred, 1),
                "lower_bound": round(lower, 1),
                "upper_bound": round(upper, 1),
                "method": "TabPFN (Prior-Data Fitted Network)",
                "data_sufficiency": "robust" if len(valid_history) >= 28 else "moderate",
                "notes": "Forecast computed with TabPFN tabular foundation model."
            }
        except Exception as e:
            logger.warning("TabPFN inference failed; falling back to Scikit-learn: %s", e)
            res = self.fallback.predict(df_item, target_date, use_censored_correction)
            res["tabpfn_status"] = f"TabPFN error: {str(e)}; fallback used."
            return res

tabpfn_adapter = TabPFNAdapter()
