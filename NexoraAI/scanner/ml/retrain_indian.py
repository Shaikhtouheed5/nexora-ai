"""
Retrain phish_pipeline.joblib with Indian SMS phishing data.
Combines UCI SMS Spam Collection (via HuggingFace) with hardcoded
Indian-context phishing and safe messages, then overwrites the model.

Run from NexoraAI/scanner/ml/:
    python retrain_indian.py
"""

import joblib
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import re
import os
import json
import shutil

# ── preprocessing (must match model.py exactly) ──────────────────
def preprocess(text):
    text = re.sub(r'http\S+|www\S+', '__URL__', str(text))
    text = re.sub(r'\b\d{10,}\b', '__PHONE__', text)
    text = re.sub(r'(?:rs\.?|inr|₹)\s?\d+(?:,\d+)*(?:\.\d+)?',
                  '__MONEY__', text, flags=re.IGNORECASE)
    return text.lower().strip()

# ── Indian phishing SMS dataset (hardcoded) ───────────────────────
INDIAN_PHISHING = [
    # UPI/Banking scams
    "URGENT: Your SBI account will be blocked in 24 hours. Verify now: http://sbi-secure-verify.xyz/login",
    "Dear Customer your KYC is expired. Update immediately at http://hdfc-kyc-update.in or account will be suspended",
    "Your UPI PIN has been compromised. Verify at http://npci-secure.xyz immediately to avoid suspension",
    "ALERT: Unauthorized login detected on your account. Click http://axisbank-secure.in to verify",
    "Your PAN card is not linked to Aadhaar. Link now at http://incometax-pan-link.xyz or face penalty",
    "Congratulations! You have won Rs.50000 in SBI lucky draw. Claim at http://sbi-lucky-draw.in",
    "Your CIBIL score has dropped. Check and fix free at http://cibil-repair.xyz now",
    "OTP for login is 847291. Share with our executive to complete KYC verification. -HDFC",
    "Dear Customer send your Aadhaar and PAN details to complete KYC on http://aadhaar-kyc.xyz",
    "FINAL WARNING: Your account XX1234 will be closed. Verify at http://verify-now-sbi.in",
    "You have won iPhone 15 in Flipkart lucky draw. Claim prize at http://flipkart-prize.xyz",
    "Your Jio number will be deactivated. Update KYC at http://jio-kyc-update.in immediately",
    "FREE: Get Rs.2000 cashback on UPI payment. Click http://upi-cashback-offer.xyz to claim",
    "Income tax refund of Rs.8500 approved. Claim at http://incometax-refund.xyz with your details",
    "BSNL: Your SIM will be blocked in 2 hours. Reactivate at http://bsnl-reactivate.in",
    "Dear User your Paytm wallet is suspended click http://paytm-verify.xyz to restore access",
    "Urgent: TRAI will disconnect your number. Call 9876543210 or visit http://trai-verify.in",
    "Amazon: You are selected for Rs.10000 reward. Provide details at http://amazon-reward.xyz",
    "Your electricity connection will be cut tonight. Pay immediately at http://bescom-pay.xyz",
    "Gas subsidy of Rs.1200 not received? Claim at http://lpg-subsidy.xyz with Aadhaar",
    "IRCTC refund Rs.3200 pending. Collect at http://irctc-refund.xyz enter bank details",
    "Loan approved Rs.500000 at 0% interest. Apply at http://instant-loan-india.xyz",
    "Police complaint filed against your Aadhaar. Call 8800XXXXXX immediately to resolve",
    "Your UPI ID blocked for suspicious activity verify at http://upi-verify-npci.xyz",
    "Dear customer your FD matured collect Rs.75000 at http://fd-collect.xyz today only",
    "Click here to get free Jio recharge worth Rs.999 http://bit.ly/freejio",
    "Congratulations you won 2 business class tickets click http://tinyurl.com/airprize",
    "Your credit card ending 4321 has suspicious transaction call 9999999999 immediately",
    "Send OTP received on your number to 56789 to complete KYC failing which account closes",
    "Dear valued customer claim your reward points before expiry http://hdfc-rewards.xyz",
    "Your Aadhaar biometric is locked unlock at http://uidai-unlock.xyz with OTP",
    "PM Kisan Yojana Rs.6000 pending in your account collect at http://pmkisan-claim.xyz",
    "Voter ID correction last date today update at http://election-id-update.xyz",
    "Your mutual fund KYC rejected resubmit at http://mf-kyc.xyz or lose investment",
    "GST refund Rs.12000 approved collect at http://gst-refund.xyz enter details",
    "Dear Customer we tried to deliver your parcel pay Rs.50 customs at http://india-post-pay.xyz",
    "Your driving license expired renew online at http://rto-license-renew.xyz pay Rs.200",
    "Congratulations your loan EMI waived off for 3 months click http://loan-relief.xyz",
    "Your health insurance claim approved collect Rs.25000 at http://claim-insurance.xyz",
    "EPFO: Your PF withdrawal of Rs.45000 is on hold verify at http://epfo-verify.xyz",
    # Additional Indian phishing patterns
    "Your Aadhaar card is suspended due to suspicious activity. Reactivate at http://aadhaar-reactivate.xyz",
    "HDFC Bank: Your account will be blocked. Update PAN at http://hdfc-pan-update.in today",
    "Axis Bank Alert: Transaction of Rs.49999 initiated. Not you? Cancel at http://axis-cancel.xyz",
    "SBI: Your net banking access suspended. Restore at http://sbi-netbanking-restore.in",
    "Dear Customer your Aadhaar OTP is 738291. Share to complete video KYC process",
    "Flipkart Big Sale: Win Rs.100000 cash prize. Register at http://flipkart-bigwin.xyz",
    "Your PF account will be deactivated. Reactivate at http://epfo-reactivate.xyz urgently",
    "URGENT income tax notice issued on your PAN. Respond at http://incometax-notice.xyz",
    "Jio Fiber free upgrade available. Claim at http://jiofree-upgrade.xyz before midnight",
    "Reward: Rs.5000 Amazon gift card for completing survey at http://amazon-survey.xyz",
]

INDIAN_SAFE = [
    # Legitimate Indian bank/service SMS
    "Rs.500.00 debited from A/C XX1234 on 20-Apr-26. UPI Ref 123456789. -SBI",
    "Rs.1200 credited to your A/C XX5678 on 19-Apr-26. Avl Bal Rs.45230. -HDFC",
    "Your A/C XX9012 credited with Rs.110.00 on 19-4-26 via UPI. -Canara Bank",
    "HDFC Bank: OTP for your transaction is 847291. Valid for 10 mins. Do not share.",
    "Your SBI account XX1234 has been debited Rs.230 on 17-Apr-26. Avl Bal Rs.8920",
    "Transaction of Rs.125 done on your Canara Bank Debit Card at SWIGGY on 19-Apr-26",
    "Dear Customer Rs.5000 transferred to RAHUL via UPI on 10-Apr-26. Ref 610064306574",
    "Your FD of Rs.50000 matures on 30-Apr-26. Contact branch for renewal. -ICICI Bank",
    "NEFT credit Rs.15000 received in your A/C XX3456 from RAHUL SHARMA on 18-Apr-26",
    "Your credit card bill of Rs.8500 is due on 25-Apr-26. Pay at hdfcbank.com -HDFC",
    "Jio: Your recharge of Rs.299 is successful. Validity 28 days. Thank you.",
    "Your Aadhaar has been successfully linked to PAN. No further action needed. -UIDAI",
    "Your UPI transaction of Rs.50 to ZOMATO is successful. UPI Ref 987654321",
    "OTP for Flipkart order payment is 234567. Valid for 5 mins. Do not share with anyone.",
    "Your IRCTC ticket PNR 1234567890 is confirmed. Train 12345 on 25-Apr-26.",
    "Amazon: Your order #123-456 has been shipped. Expected delivery 22-Apr-26.",
    "Your EPF balance is Rs.125000 as of Mar-26. Login at unifiedportal-mem.epfindia.gov.in",
    "BSNL: Your postpaid bill of Rs.450 for Mar-26 is generated. Pay by 15-Apr-26.",
    "Your Axis Bank savings account interest Rs.850 credited on 01-Apr-26.",
    "PhonePe: Rs.200 sent to 9876543210 (RAHUL) successfully. UPI Ref 456789123",
    "Google Pay: Rs.500 received from PRIYA SHARMA. Check your bank account.",
    "Your LPG cylinder booked successfully. Delivery in 3-5 days. -IndianOil",
    "Airtel: Your number 9876543210 recharge of Rs.599 successful. Validity 84 days",
    "ICICI Bank: Your credit card XX4321 payment of Rs.5000 received. Thank you.",
    "Your PAN card application status: Under process. Track at tin.tin.nsdl.com",
    "Swiggy: Your order from McDonald is confirmed. Delivery in 35 mins.",
    "Dear Customer your Canara Bank net banking password changed successfully.",
    "Your PLI premium of Rs.2500 for policy 123456 received for Apr-26. -India Post",
    "Reminder: Your car insurance policy expires on 30-Apr-26. Renew at bajajallianz.com",
    "Your CIBIL score is 750. View full report at cibil.com with your credentials.",
    "Kotak Bank: Rs.3000 debited from A/C XX7890 at BigBazaar on 20-Apr-26",
    "Your Paytm KYC is complete. You can now send up to Rs.1 lakh per month.",
    "IRCTC: Tatkal ticket booked PNR 9876543210 for 21-Apr-26. Coach S4 Seat 23",
    "Airtel Postpaid bill Rs.799 generated for Apr-26. Due date 10-May-26. Pay now.",
    "SBI YONO: Your session has been logged out for security. Login again at onlinesbi.com",
    "Your Zerodha account credited Rs.12500 from trade settlement on 19-Apr-26.",
    "PNB: ATM cash withdrawal of Rs.5000 from A/C XX2345 at SBI ATM on 20-Apr-26",
    "Dear Customer NACH mandate registered for EMI of Rs.8500 from 01-May-26. -HDFC",
    "Vi: Your data pack of 1.5GB/day activated. Balance data 28.5GB. Valid 28 days.",
    "Amazon Pay: Rs.150 cashback credited to your Amazon Pay balance. Valid 30 days.",
]

# ── Load existing model ───────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'saved_model', 'phish_pipeline.joblib')
META_PATH  = os.path.join(os.path.dirname(__file__), 'saved_model', 'model_meta.json')

print(f"Loading existing model from {MODEL_PATH} ...")
existing_model = joblib.load(MODEL_PATH)
print("Existing model loaded.")

# ── Load UCI dataset from HuggingFace ────────────────────────────
uci_df = pd.DataFrame({'text': [], 'label': []})
print("\nDownloading UCI SMS Spam dataset from HuggingFace...")
try:
    from datasets import load_dataset
    uci = load_dataset("sms_spam", split="train")
    uci_df = pd.DataFrame(uci)
    # HuggingFace sms_spam has columns: 'sms' (text) and 'label' (0=ham, 1=spam)
    uci_df = uci_df.rename(columns={'sms': 'text'})
    uci_df = uci_df[['text', 'label']]
    print(f"UCI dataset loaded: {len(uci_df)} messages "
          f"({uci_df['label'].sum()} spam, {(uci_df['label']==0).sum()} ham)")
except Exception as e:
    print(f"HuggingFace unavailable ({e}), continuing with Indian data only.")

# ── Combine datasets ──────────────────────────────────────────────
indian_df = pd.DataFrame({
    'text':  INDIAN_PHISHING + INDIAN_SAFE,
    'label': [1] * len(INDIAN_PHISHING) + [0] * len(INDIAN_SAFE),
})

# Oversample Indian data 5x so it meaningfully influences the model
indian_df = pd.concat([indian_df] * 5, ignore_index=True)

combined_df = pd.concat([uci_df[['text', 'label']], indian_df], ignore_index=True)
combined_df['text'] = combined_df['text'].apply(preprocess)
combined_df = combined_df.sample(frac=1, random_state=42).reset_index(drop=True)

print(f"\nCombined dataset: {len(combined_df)} messages")
print(f"  Phishing : {combined_df['label'].sum()}")
print(f"  Safe     : {(combined_df['label'] == 0).sum()}")

# ── Retrain ───────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    combined_df['text'], combined_df['label'],
    test_size=0.2, random_state=42, stratify=combined_df['label']
)

new_model = Pipeline([
    ('tfidf', TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=20000,   # up from 15 000
        sublinear_tf=True,
        min_df=1,
    )),
    ('clf', LogisticRegression(
        class_weight='balanced',
        max_iter=1000,
        C=1.0,
        solver='lbfgs',
    )),
])

print("\nTraining new model...")
new_model.fit(X_train, y_train)

# ── Evaluate ──────────────────────────────────────────────────────
y_pred  = new_model.predict(X_test)
y_proba = new_model.predict_proba(X_test)[:, 1]

from sklearn.metrics import accuracy_score, recall_score
accuracy     = accuracy_score(y_test, y_pred)
spam_recall  = recall_score(y_test, y_pred, pos_label=1)

print("\n=== RESULTS ===")
print(classification_report(y_test, y_pred, target_names=['Safe', 'Phishing']))
print(f"Accuracy     : {accuracy:.4f}")
print(f"Phish recall : {spam_recall:.4f}")

# ── Save (backup old model first) ─────────────────────────────────
backup_path = MODEL_PATH.replace('.joblib', '_backup.joblib')
shutil.copy(MODEL_PATH, backup_path)
print(f"\nOld model backed up -> {backup_path}")

joblib.dump(new_model, MODEL_PATH)
print(f"New model saved -> {MODEL_PATH}")

# Update meta
meta = {
    "accuracy":     round(accuracy, 4),
    "spam_recall":  round(spam_recall, 4),
    "model_type":   "TF-IDF(trigram) + LogisticRegression(balanced)",
    "features":     20000,
    "ngram_range":  [1, 3],
    "augmented":    True,
    "indian_data":  True,
    "train_size":   len(X_train),
}
with open(META_PATH, 'w') as f:
    json.dump(meta, f, indent=2)
print(f"Meta updated  -> {META_PATH}")
print("\nDone.")
