from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from app.models.database import (  # noqa: E402, F401
    Product,
    TaxSettingsHistory,
    ImportBatch,
    ImportBatchItem,
    SaleItem,
    Account,
    CashTransaction,
    User,
    AppSetting,
    BudgetPlan,
    Warehouse,
    StockMovement,
    Customer,
    Invoice,
    Payment,
)
