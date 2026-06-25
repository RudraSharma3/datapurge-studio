from fastapi import FastAPI, UploadFile, Depends, File, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from email_validator import validate_email, EmailNotValidError
import database, models, auth
import pandas as pd
import io
import json
import os
import jwt  # Using PyJWT under the hood
import openpyxl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from clean_engine import infer_column_types, process_cleaning_rules, calculate_health_analytics
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

models.Base.metadata.create_all(bind=database.engine)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILES_FILE = "cleaning_profiles.json"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── STANDARD SMTP GLOBAL CONFIGS ──
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, token: str = Depends(oauth2_scheme)):
        try:
            payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            user_role = payload.get("role")
            if user_role not in self.allowed_roles:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="RBAC Access Denied.")
            return payload
        except jwt.PyJWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Security context invalid.")

admin_only = RoleChecker(["admin"])
admin_or_user = RoleChecker(["admin", "user"])

SESSION_DATA = {
    "df": None, "clean_df": None, "flagged_df": None, "filename": "", "file_type": "",
    "rescued_ids": [], "all_sheets": None, "clean_sheets_cache": None,  
    "flagged_sheets_cache": None, "sheet_metadata": {}, "raw_excel_bytes": None  
}

class CleanConfig(BaseModel):
    trimWhitespace: bool; removeSalutations: bool; salutationCols: list; standardiseEmail: bool
    emailCols: list; standardisePhone: bool; phoneCols: list; phoneCountry: str; fixDataTypes: bool
    numberCols: list; colTypeOverrides: dict; removeRepetitiveWords: bool; repetitiveCols: list
    removeNulls: bool; nullMode: str; nullColumnThreshold: float; nullCols: list; removeDuplicates: bool
    dupCols: list; removeFuzzyDups: bool; fuzzyCols: list; fuzzyThreshold: float
    anonymizeCols: bool = False; anonymizeFields: list = []

class RescueConfig(BaseModel): rescuedIds: list
class CellUpdateConfig(BaseModel): sheetName: str; rowId: int; column: str; newValue: str
class SaveProfileConfig(BaseModel): profileName: str; config: dict

def send_dynamic_notification_emails(full_name: str, user_email: str, message_content: str):
    """Dispatches transaction notification emails via standard Gmail SMTP Port 587."""
    sender_email = os.getenv("SMTP_SENDER_EMAIL")
    sender_password = os.getenv("SMTP_SENDER_PASSWORD")
    admin_inbox = os.getenv("MY_ADMIN_INBOX")

    if not sender_email or not sender_password:
        print("─── SMTP WARNING: CREDENTIALS NOT FOUND IN ENVIRONMENT ───")
        return
        
    try:
        print("─── SMTP CORE: CONNECTING TO GOOGLE SMTP SERVERS (PORT 587)... ───")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(sender_email, sender_password)
        print("─── SMTP CORE: SECURELY AUTHENTICATED WITH GMAIL ───")

        # Visitor Email
        try:
            user_msg = MIMEMultipart()
            user_msg["From"] = f"DataPurge Studio <{sender_email}>"
            user_msg["To"] = user_email
            user_msg["Subject"] = "✨ We received your message! — DataPurge Studio"
            user_body = f"Hi {full_name},\n\nThank you for reaching out! We have successfully received your inquiry regarding:\n'{message_content}'\n\nOur operations desk will follow up shortly."
            user_msg.attach(MIMEText(user_body, "plain"))
            server.sendmail(sender_email, user_email, user_msg.as_string())
            print(f"─── MAIL SUCCESS: Confirmation delivered to visitor [{user_email}] ───")
        except Exception as e:
            print(f"─── SMTP SUB-REJECTION (VISITOR ROUTE): {str(e)} ───")

        # Admin Email
        if admin_inbox:
            try:
                admin_msg = MIMEMultipart()
                admin_msg["From"] = f"DataPurge Alert System <{sender_email}>"
                admin_msg["To"] = admin_inbox
                admin_msg["Subject"] = f"🚨 New Lead Captured: {full_name}"
                admin_body = f"Hey Admin,\n\nA new lead has submitted an inquiry.\n\nDetails:\n- Name: {full_name}\n- Email: {user_email}\n- Message: {message_content}"
                admin_msg.attach(MIMEText(admin_body, "plain"))
                server.sendmail(sender_email, admin_inbox, admin_msg.as_string())
                print(f"─── MAIL SUCCESS: Admin alert delivered to [{admin_inbox}] ───")
            except Exception as e:
                print(f"─── SMTP SUB-REJECTION (ADMIN ROUTE): {str(e)} ───")

        server.quit()
    except Exception as master_connection_err:
        print(f"─── SMTP CRITICAL EXCEPTION FAILURE: {str(master_connection_err)} ───")

@app.post("/api/auth/signup")
def signup(payload: dict, db: Session = Depends(database.get_db)):
    username, email, password = payload.get("username", "").strip(), payload.get("email", "").strip(), payload.get("password", "")
    if not username or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Invalid submission parameters.")
    try:
        email = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if db.query(models.User).filter(models.User.username == username).first() or db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Credentials already taken.")
    db.add(models.User(username=username, email=email, hashed_password=auth.hash_password(password), role="user"))
    db.commit()
    return {"status": "success", "message": "Account initialized."}

@app.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == payload.get("email", "").strip()).first()
    if not user or not auth.verify_password(payload.get("password", ""), user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid profile credentials.")
    return {"session": {"access_token": auth.create_access_token(data={"sub": user.email, "role": user.role}), "token_type": "bearer", "expires_in": 28800}, "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "created_at": user.created_at.isoformat()}}

@app.post("/api/inquiries")
def create_inquiry(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    full_name, email, message = payload.get("full_name", "").strip(), payload.get("email", "").strip(), payload.get("message", "").strip()
    if not full_name or not email or not message:
        raise HTTPException(status_code=400, detail="All fields required.")
    db.add(models.Inquiry(full_name=full_name, email=email, message=message))
    db.commit()
    background_tasks.add_task(send_dynamic_notification_emails, full_name=full_name, user_email=email, message_content=message)
    return {"status": "success", "message": "Inquiry recorded successfully."}

@app.post("/api/analyze")
async def analyze_file(file: UploadFile = File(...)):
    filename, contents = file.filename.lower(), await file.read()
    SESSION_DATA.update({"df": None, "clean_df": None, "flagged_df": None, "filename": file.filename, "rescued_ids": [], "all_sheets": None, "clean_sheets_cache": None, "flagged_sheets_cache": None, "sheet_metadata": {}, "raw_excel_bytes": contents if (filename.endswith('.xlsx') or filename.endswith('.xls')) else None})
    try:
        if filename.endswith('.csv'):
            preview_df = pd.read_csv(io.BytesIO(contents), nrows=2, header=None)
            skip_rows = 1 if (len(preview_df) > 1 and preview_df.iloc[0].dropna().astype(str).str.strip().replace('', None).notna().sum() == 1 and preview_df.iloc[1].dropna().astype(str).str.strip().replace('', None).notna().sum() > 1) else 0
            df = pd.read_csv(io.BytesIO(contents), skiprows=skip_rows)
            df['_row_id'] = range(len(df))
            SESSION_DATA["df"], SESSION_DATA["file_type"] = df.copy(), "csv"
            SESSION_DATA["sheet_metadata"] = {"Default_Sheet": {"headers": [c for c in df.columns if c != '_row_id' and not str(c).startswith('Unnamed:')], "colTypes": infer_column_types(df), "rowCount": len(df), "rows": df.head(5).astype(object).where(pd.notnull(df.head(5)), None).to_dict(orient="records")}}
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            xl = pd.ExcelFile(io.BytesIO(contents))
            SESSION_DATA["file_type"], SESSION_DATA["all_sheets"] = "excel", {}
            for sheet_name in xl.sheet_names:
                preview_df = xl.parse(sheet_name, nrows=2, header=None)
                skip_rows = 1 if (len(preview_df) > 1 and preview_df.iloc[0].dropna().astype(str).str.strip().replace('', None).notna().sum() == 1 and preview_df.iloc[1].dropna().astype(str).str.strip().replace('', None).notna().sum() > 1) else 0
                sheet_df = xl.parse(sheet_name, skiprows=skip_rows)
                sheet_df['_row_id'] = range(len(sheet_df))
                for col in sheet_df.columns:
                    if col != '_row_id' and sheet_df[col].dtype in ['float64', 'int64']:
                        sheet_df[col] = pd.to_numeric(sheet_df[col], downcast='float' if sheet_df[col].dtype == 'float64' else 'integer')
                SESSION_DATA["all_sheets"][sheet_name] = sheet_df
                SESSION_DATA["sheet_metadata"][sheet_name] = {"headers": [c for c in sheet_df.columns if c != '_row_id' and not str(c).startswith('Unnamed:')], "colTypes": infer_column_types(sheet_df), "rowCount": len(sheet_df), "rows": sheet_df.head(5).astype(object).where(pd.notnull(sheet_df.head(5)), None).to_dict(orient="records")}
            df = SESSION_DATA["all_sheets"][xl.sheet_names[0]]
            SESSION_DATA["df"] = df.copy()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    return {"fileName": file.filename, "fileType": SESSION_DATA["file_type"], "sheets": SESSION_DATA["sheet_metadata"]}

@app.post("/api/clean-preview")
async def clean_preview(config: CleanConfig):
    if SESSION_DATA["file_type"] == "excel" and SESSION_DATA["all_sheets"] is not None:
        cleaned_sheets, flagged_sheets, sheet_previews, total_clean, total_flagged, original_total_rows = {}, {}, {}, 0, 0, 0
        combined_reasons_df = pd.DataFrame(columns=['_reasons'])
        for sheet_name, sheet_df in SESSION_DATA["all_sheets"].items():
            original_total_rows += len(sheet_df)
            c_df, f_df = process_cleaning_rules(sheet_df.copy(), config.dict())
            cleaned_sheets[sheet_name], flagged_sheets[sheet_name] = c_df, f_df
            total_clean += len(c_df); total_flagged += len(f_df)
            if not f_df.empty:
                combined_reasons_df = pd.concat([combined_reasons_df, f_df[['_reasons']]], ignore_index=True)
            sheet_previews[sheet_name] = {"totalCleanRows": len(c_df), "totalFlaggedRows": len(f_df), "cleanRows": c_df.head(50).astype(object).where(pd.notnull(c_df.head(50)), None).to_dict(orient="records"), "flaggedRows": f_df.head(50).astype(object).where(pd.notnull(f_df.head(50)), None).to_dict(orient="records")}
        SESSION_DATA["clean_sheets_cache"], SESSION_DATA["flagged_sheets_cache"] = cleaned_sheets, flagged_sheets
        return {"totalCleanRows": total_clean, "totalFlaggedRows": total_flagged, "isMultiSheet": True, "analytics": calculate_health_analytics(combined_reasons_df, original_total_rows), "sheets": sheet_previews}
    if SESSION_DATA["df"] is None:
        raise HTTPException(status_code=400, detail="No active session found.")
    clean_df, flagged_df = process_cleaning_rules(SESSION_DATA["df"].copy(), config.dict())
    SESSION_DATA["clean_df"], SESSION_DATA["flagged_df"] = clean_df.copy(), flagged_df.copy()
    return {"totalCleanRows": len(clean_df), "totalFlaggedRows": len(flagged_df), "isMultiSheet": False, "analytics": calculate_health_analytics(flagged_df, len(SESSION_DATA["df"])), "sheets": {"Default_Sheet": {"totalCleanRows": len(clean_df), "totalFlaggedRows": len(flagged_df), "cleanRows": clean_df.head(100).astype(object).where(pd.notnull(clean_df.head(100)), None).to_dict(orient="records"), "flaggedRows": flagged_df.head(100).astype(object).where(pd.notnull(flagged_df.head(100)), None).to_dict(orient="records")}}}

@app.post("/api/update-cell")
async def update_cell(payload: CellUpdateConfig):
    try:
        df_target = SESSION_DATA["all_sheets"][payload.sheetName] if (SESSION_DATA["file_type"] == "excel" and SESSION_DATA["all_sheets"] is not None) else SESSION_DATA["df"]
        row_idx = df_target[df_target['_row_id'] == payload.rowId].index
        if not row_idx.empty:
            df_target.at[row_idx[0], payload.column] = payload.newValue
            return {"status": "success", "message": "Cell value adjusted."}
        raise HTTPException(status_code=400, detail="Target record row could not be located.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profiles/save")
async def save_profile(payload: SaveProfileConfig):
    profiles = {}
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE, "r") as f:
            try: profiles = json.load(f)
            except: pass
    profiles[payload.profileName] = payload.config
    with open(PROFILES_FILE, "w") as f: json.dump(profiles, f, indent=4)
    return {"status": "success"}

@app.get("/api/profiles/load")
async def load_profiles():
    return json.load(open(PROFILES_FILE, "r")) if os.path.exists(PROFILES_FILE) else {}

@app.post("/api/rescue-rows")
async def rescue_rows(config: RescueConfig):
    SESSION_DATA["rescued_ids"] = config.rescuedIds
    return {"status": "success"}

@app.get("/api/download")
async def download_file(format: str, audit: bool = False):
    rescued_ids, prefix, output = SESSION_DATA.get("rescued_ids", []), "removed" if audit else "cleaned", io.BytesIO()
    if SESSION_DATA["file_type"] == "excel" and SESSION_DATA["raw_excel_bytes"] is not None:
        wb = openpyxl.load_workbook(io.BytesIO(SESSION_DATA['raw_excel_bytes']))
        for sheet_name in list(wb.sheetnames):
            if sheet_name not in SESSION_DATA["clean_sheets_cache"]: continue
            ws, flagged_df = wb[sheet_name], SESSION_DATA["flagged_sheets_cache"][sheet_name]
            rows_to_drop_set = {idx + 2 for idx, row in flagged_df.iterrows() if (audit and row['_row_id'] in rescued_ids) or (not audit and row['_row_id'] not in rescued_ids)}
            for excel_row_idx in sorted(list(rows_to_drop_set), reverse=True): ws.delete_rows(excel_row_idx, 1)
        wb.save(output); output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.xlsx"})
    if audit:
        final_df = SESSION_DATA["flagged_df"].copy()
        final_df = final_df[~final_df['_row_id'].isin(rescued_ids)].copy()
        if '_reasons' in final_df.columns: final_df.rename(columns={'_reasons': 'Removal Reason'}, inplace=True)
    else:
        final_df = pd.concat([SESSION_DATA["clean_df"], SESSION_DATA["flagged_df"][SESSION_DATA["flagged_df"]['_row_id'].isin(rescued_ids)]]).sort_values('_row_id')
        if '_reasons' in final_df.columns: final_df.drop(columns=['_reasons'], inplace=True)
    if '_row_id' in final_df.columns: final_df.drop(columns=['_row_id'], inplace=True)
    if format == "csv":
        final_df.to_csv(output, index=False); output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.csv"})
    else:
        with pd.ExcelWriter(output, engine='openpyxl') as writer: final_df.to_excel(writer, index=False, sheet_name="Clean Data")
        output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.xlsx"})