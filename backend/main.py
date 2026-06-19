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

# Auto-generate or update structural database tables smoothly
models.Base.metadata.create_all(bind=database.engine)

# ── DYNAMIC SYSTEM CORS POLICY OVERRIDES ──
# Fall back to development defaults only if external origin hooks evaluate blank
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

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SMTP_SENDER_PASSWORD")
MY_ADMIN_INBOX = os.getenv("MY_ADMIN_INBOX")

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, token: str = Depends(oauth2_scheme)):
        try:
            payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            user_role = payload.get("role")
            if user_role not in self.allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="RBAC Access Denied: Clearance missing."
                )
            return payload
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security context invalid or expired."
            )

admin_only = RoleChecker(["admin"])
admin_or_user = RoleChecker(["admin", "user"])

SESSION_DATA = {
    "df": None,
    "clean_df": None,
    "flagged_df": None,
    "filename": "",
    "file_type": "",
    "rescued_ids": [],
    "all_sheets": None,          
    "clean_sheets_cache": None,  
    "flagged_sheets_cache": None,
    "sheet_metadata": {},
    "raw_excel_bytes": None  
}

class CleanConfig(BaseModel):
    trimWhitespace: bool
    removeSalutations: bool
    salutationCols: list
    standardiseEmail: bool
    emailCols: list
    standardisePhone: bool
    phoneCols: list
    phoneCountry: str
    fixDataTypes: bool
    numberCols: list
    colTypeOverrides: dict
    removeRepetitiveWords: bool
    repetitiveCols: list
    removeNulls: bool
    nullMode: str
    nullColumnThreshold: float
    nullCols: list
    removeDuplicates: bool
    dupCols: list
    removeFuzzyDups: bool
    fuzzyCols: list
    fuzzyThreshold: float
    anonymizeCols: bool = False
    anonymizeFields: list = []

class RescueConfig(BaseModel):
    rescuedIds: list

class CellUpdateConfig(BaseModel):
    sheetName: str
    rowId: int
    column: str
    newValue: str

class SaveProfileConfig(BaseModel):
    profileName: str
    config: dict

def send_dynamic_notification_emails(full_name: str, user_email: str, message_content: str):
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print("--- SMTP CREDENTIALS MISSING: SKIPPING EMAIL ROUTE ---")
        return
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)

        # ── 1. USER AUTO-REPLY ──
        user_msg = MIMEMultipart()
        user_msg["From"] = f"DataPurge Studio <{SENDER_EMAIL}>"
        user_msg["To"] = user_email
        user_msg["Subject"] = "✨ We received your message! — DataPurge Studio"
        
        user_body = f"Hi {full_name},\n\nThank you for reaching out! We have successfully received your inquiry regarding: '{message_content}'.\n\nOur operations desk will follow up shortly.\n\nBest regards,\nDataPurge Automated Core"
        user_msg.attach(MIMEText(user_body, "plain"))
        server.sendmail(SENDER_EMAIL, user_email, user_msg.as_string())

        # ── 2. ADMIN EMAIL NOTIFICATION ──
        if MY_ADMIN_INBOX:
            admin_msg = MIMEMultipart()
            admin_msg["From"] = f"DataPurge Alert <{SENDER_EMAIL}>"
            admin_msg["To"] = MY_ADMIN_INBOX
            admin_msg["Subject"] = f"🚨 New Lead Captured: {full_name}"
            
            admin_body = f"Hey Admin,\n\nA new business lead has just submitted an inquiry.\n\nDetails:\n- Name: {full_name}\n- Email: {user_email}\n- Message: {message_content}"
            admin_msg.attach(MIMEText(admin_body, "plain"))
            server.sendmail(SENDER_EMAIL, MY_ADMIN_INBOX, admin_msg.as_string())

        server.quit()
    except Exception as e:
        print(f"--- MAIL ENGINE EXCEPTION FAILURE: {str(e)} ---")

@app.post("/api/auth/signup")
def signup(payload: dict, db: Session = Depends(database.get_db)):
    username = payload.get("username", "").strip()
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    
    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if not email:
        raise HTTPException(status_code=400, detail="Email field parameters cannot be empty.")
        
    try:
        email_info = validate_email(email, check_deliverability=False)
        email = email_info.normalized
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=f"Invalid email structure: {str(e)}")
        
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="This username is already taken.")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email is already mapped to an account.")
        
    new_user = models.User(username=username, email=email, hashed_password=auth.hash_password(password), role="user")
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "Account initialized successfully."}

@app.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(database.get_db)):
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not auth.verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid profile credentials combination.")
        
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "session": {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 28800
        },
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        }
    }

@app.post("/api/inquiries")
def create_inquiry(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    full_name = payload.get("full_name", "").strip()
    email = payload.get("email", "").strip()
    message = payload.get("message", "").strip()

    if not full_name or not email or not message:
        raise HTTPException(status_code=400, detail="All contact submission form inputs are required.")

    new_inquiry = models.Inquiry(full_name=full_name, email=email, message=message)
    db.add(new_inquiry)
    db.commit()

    background_tasks.add_task(send_dynamic_notification_emails, full_name=full_name, user_email=email, message_content=message)
    return {"status": "success", "message": "Inquiry recorded successfully."}

@app.post("/api/analyze")
async def analyze_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    contents = await file.read()
    
    SESSION_DATA.update({
        "df": None, "clean_df": None, "flagged_df": None, "filename": file.filename,
        "rescued_ids": [], "all_sheets": None, "clean_sheets_cache": None, 
        "flagged_sheets_cache": None, "sheet_metadata": {},
        "raw_excel_bytes": contents if (filename.endswith('.xlsx') or filename.endswith('.xls')) else None
    })

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
            df['_row_id'] = range(len(df))
            SESSION_DATA["df"] = df.copy()
            SESSION_DATA["file_type"] = "csv"
            
            SESSION_DATA["sheet_metadata"] = {
                "Default_Sheet": {
                    "headers": [c for c in df.columns if c != '_row_id'],
                    "colTypes": infer_column_types(df),
                    "rowCount": len(df),
                    "rows": df.head(5).astype(object).where(pd.notnull(df.head(5)), None).to_dict(orient="records")
                }
            }
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            xl = pd.ExcelFile(io.BytesIO(contents))
            SESSION_DATA["file_type"] = "excel"
            SESSION_DATA["all_sheets"] = {}
            
            for sheet_name in xl.sheet_names:
                sheet_df = xl.parse(sheet_name)
                sheet_df['_row_id'] = range(len(sheet_df))
                
                for col in sheet_df.columns:
                    if col == '_row_id': continue
                    if sheet_df[col].dtype == 'float64':
                        sheet_df[col] = pd.to_numeric(sheet_df[col], downcast='float')
                    elif sheet_df[col].dtype == 'int64':
                        sheet_df[col] = pd.to_numeric(sheet_df[col], downcast='integer')
                
                SESSION_DATA["all_sheets"][sheet_name] = sheet_df
                SESSION_DATA["sheet_metadata"][sheet_name] = {
                    "headers": [c for c in sheet_df.columns if c != '_row_id'],
                    "colTypes": infer_column_types(sheet_df),
                    "rowCount": len(sheet_df),
                    "rows": sheet_df.head(5).astype(object).where(pd.notnull(sheet_df.head(5)), None).to_dict(orient="records")
                }
            df = SESSION_DATA["all_sheets"][xl.sheet_names[0]]
            SESSION_DATA["df"] = df.copy()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    return {
        "fileName": file.filename,
        "fileType": SESSION_DATA["file_type"],
        "sheets": SESSION_DATA["sheet_metadata"]
    }

@app.post("/api/clean-preview")
async def clean_preview(config: CleanConfig):
    if SESSION_DATA["file_type"] == "excel" and SESSION_DATA["all_sheets"] is not None:
        cleaned_sheets, flagged_sheets, sheet_previews = {}, {}, {}
        total_clean, total_flagged, original_total_rows = 0, 0, 0
        combined_reasons_df = pd.DataFrame(columns=['_reasons'])
        
        for sheet_name, sheet_df in SESSION_DATA["all_sheets"].items():
            original_total_rows += len(sheet_df)
            c_df, f_df = process_cleaning_rules(sheet_df.copy(), config.dict())
            cleaned_sheets[sheet_name] = c_df
            flagged_sheets[sheet_name] = f_df
            total_clean += len(c_df)
            total_flagged += len(f_df)
            
            if not f_df.empty:
                combined_reasons_df = pd.concat([combined_reasons_df, f_df[['_reasons']]], ignore_index=True)
            
            clean_prev = c_df.head(50).astype(object).where(pd.notnull(c_df.head(50)), None).to_dict(orient="records")
            flagged_prev = f_df.head(50).astype(object).where(pd.notnull(f_df.head(50)), None).to_dict(orient="records")
            
            sheet_previews[sheet_name] = {
                "totalCleanRows": len(c_df),
                "totalFlaggedRows": len(f_df),
                "cleanRows": clean_prev,
                "flaggedRows": flagged_prev
            }
            
        SESSION_DATA["clean_sheets_cache"] = cleaned_sheets
        SESSION_DATA["flagged_sheets_cache"] = flagged_sheets
        analytics = calculate_health_analytics(combined_reasons_df, original_total_rows)
        
        return {
            "totalCleanRows": total_clean,
            "totalFlaggedRows": total_flagged,
            "isMultiSheet": True,
            "analytics": analytics,
            "sheets": sheet_previews
        }
        
    if SESSION_DATA["df"] is None:
        raise HTTPException(status_code=400, detail="No active session found.")
        
    clean_df, flagged_df = process_cleaning_rules(SESSION_DATA["df"].copy(), config.dict())
    SESSION_DATA["clean_df"] = clean_df.copy()
    SESSION_DATA["flagged_df"] = flagged_df.copy()
    
    analytics = calculate_health_analytics(flagged_df, len(SESSION_DATA["df"]))
    clean_prev = clean_df.head(100).astype(object).where(pd.notnull(clean_df.head(100)), None).to_dict(orient="records")
    flagged_prev = flagged_df.head(100).astype(object).where(pd.notnull(flagged_df.head(100)), None).to_dict(orient="records")

    return {
        "totalCleanRows": len(clean_df),
        "totalFlaggedRows": len(flagged_df),
        "isMultiSheet": False,
        "analytics": analytics,
        "sheets": {
            "Default_Sheet": {
                "totalCleanRows": len(clean_df),
                "totalFlaggedRows": len(flagged_df),
                "cleanRows": clean_prev,
                "flaggedRows": flagged_prev
            }
        }
    }

@app.post("/api/update-cell")
async def update_cell(payload: CellUpdateConfig):
    try:
        if SESSION_DATA["file_type"] == "excel" and SESSION_DATA["all_sheets"] is not None:
            if payload.sheetName in SESSION_DATA["all_sheets"]:
                df_target = SESSION_DATA["all_sheets"][payload.sheetName]
                row_idx = df_target[df_target['_row_id'] == payload.rowId].index
                if not row_idx.empty:
                    df_target.at[row_idx[0], payload.column] = payload.newValue
                    return {"status": "success", "message": "Cell value adjusted."}
        elif SESSION_DATA["df"] is not None:
            df_target = SESSION_DATA["df"]
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
    with open(PROFILES_FILE, "w") as f:
        json.dump(profiles, f, indent=4)
    return {"status": "success"}

@app.get("/api/profiles/load")
async def load_profiles():
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE, "r") as f:
            return json.load(f)
    return {}

@app.post("/api/rescue-rows")
async def rescue_rows(config: RescueConfig):
    SESSION_DATA["rescued_ids"] = config.rescuedIds
    return {"status": "success"}

@app.get("/api/download")
async def download_file(format: str, audit: bool = False):
    rescued_ids = SESSION_DATA.get("rescued_ids", [])
    prefix = "removed" if audit else "cleaned"
    output = io.BytesIO()
    
    if SESSION_DATA["file_type"] == "excel" and SESSION_DATA["raw_excel_bytes"] is not None:
        wb = openpyxl.load_workbook(io.BytesIO(SESSION_DATA["raw_excel_bytes"]))
        
        for sheet_name in list(wb.sheetnames):
            if sheet_name not in SESSION_DATA["clean_sheets_cache"]:
                continue
                
            ws = wb[sheet_name]
            clean_df = SESSION_DATA["clean_sheets_cache"][sheet_name]
            flagged_df = SESSION_DATA["flagged_sheets_cache"][sheet_name]
            
            # ── ARCHITECTURAL CORRECTION FOR OPENPYXL ROW RE-INDEXING DRAGS ──
            # Calculate explicitly which matching index items are destined for dropping
            rows_to_drop_set = set()
            
            for idx, row in flagged_df.iterrows():
                if (audit and row['_row_id'] in rescued_ids) or (not audit and row['_row_id'] not in rescued_ids):
                    rows_to_drop_set.add(idx + 2)
                    
            if not audit:
                for idx, row in clean_df.iterrows():
                    pass # Clean records are preserved intact here

            # Delete rows backwards to cleanly sidestep coordinate reference drifts
            for excel_row_idx in sorted(list(rows_to_drop_set), reverse=True):
                ws.delete_rows(excel_row_idx, 1)
                
        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.xlsx"}
        )

    # Flat CSV Router Framework Fallback logic
    if audit:
        final_df = SESSION_DATA["flagged_df"].copy()
        final_df = final_df[~final_df['_row_id'].isin(rescued_ids)].copy()
        if '_reasons' in final_df.columns:
            final_df.rename(columns={'_reasons': 'Removal Reason'}, inplace=True)
    else:
        final_df = pd.concat([SESSION_DATA["clean_df"], SESSION_DATA["flagged_df"][SESSION_DATA["flagged_df"]['_row_id'].isin(rescued_ids)]]).sort_values('_row_id')
        if '_reasons' in final_df.columns: final_df.drop(columns=['_reasons'], inplace=True)

    if '_row_id' in final_df.columns: final_df.drop(columns=['_row_id'], inplace=True)
        
    if format == "csv":
        final_df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.csv"})
    else:
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            final_df.to_excel(writer, index=False, sheet_name="Clean Data")
        output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={prefix}_{SESSION_DATA['filename']}.xlsx"})