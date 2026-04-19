"""
Download public SMS/email spam datasets, combine with Indian SMS data,
and retrain phish_pipeline.joblib.

Run from NexoraAI/scanner/ml/:
    python download_and_retrain.py
"""

import joblib
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, recall_score
import re
import os
import json
import shutil

# ── Preprocessing (must match model.py exactly) ───────────────────
def preprocess(text):
    text = re.sub(r'http\S+|www\S+', '__URL__', str(text))
    text = re.sub(r'\b\d{10,}\b', '__PHONE__', text)
    text = re.sub(r'(?:rs\.?|inr|INR|Rs\.?)\s?\d+(?:,\d+)*(?:\.\d+)?',
                  '__MONEY__', text, flags=re.IGNORECASE)
    return text.lower().strip()

# ── Indian phishing SMS (hardcoded, same as retrain_indian.py) ────
INDIAN_PHISHING = [
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
    # Legitimate OTP messages
    "Your OTP for SBI net banking login is 847291. Valid for 10 mins. Do not share with anyone. -SBI",
    "398469 is your One Time Password for completing your transaction valid for 5 min. Do not disclose OTP. If not done by you report on 18001802222 as FRAUD.-PNB",
    "180695 is your OTP to log in to Jiomart with your Reliance Retail Account valid for 3 mins. Do not share it for security reasons /8d7mt6Qa7D",
    "Your DigiLocker OTP is 234891. Valid for 10 minutes. Do not share this OTP with anyone. -DigiLocker",
    "284761 is your OTP for HDFC Bank UPI transaction of Rs.500. Valid 10 mins. NEVER share OTP.-HDFC",
    "Your IRCTC login OTP is 567234. Valid for 5 minutes. Do not share with anyone.",
    "Paytm OTP: 123456. Use this to complete your transaction. Never share OTP with anyone.",
    "Your Aadhaar OTP is 847261. Use it within 10 minutes. Never share OTP with anyone. -UIDAI",
    "756291 is OTP for Amazon Pay transaction of Rs.299. OTP valid for 5 min. Do not share.",
    "Your Google verification code is 123456. Do not share it with anyone.",
    "Your PhonePe UPI PIN reset OTP is 847291. Valid 10 mins. NEVER share with anyone.-PhonePe",
    "Zomato OTP: 234567 for your login. Do not share this with anyone.",
    "Your EPF UAN activation OTP is 567890. Valid for 30 mins. Do not share.-EPFO",
    "CRED OTP: 123789 for login. This OTP is valid for 5 minutes. Do not share.",
    "Your Meesho OTP is 456123. Valid for 10 minutes. Don't share with anyone.",
    # Legitimate BLOCKUPI / transaction alerts
    "Rs.26.00 paid thru A/C XX0163 on 17-4-26 19:50:35 to cafe noorani mi UPI Ref 64733101. If not done SMS BLOCKUPI to 9901771222.-Canara Bank",
    "Online txn for a/cXXXX2781 allowed up to 25% of Annual Credit Limit till 30.06.2026. Contact bank to modify.-PNB",
    "Priority Support Unlocked! Your Jio account has been upgraded. Enjoy priority customer service.",
    "Rs.730 paid thru A/C XX0163 to ADNAN F PATEL UPI Ref 646616852689. If not done SMS BLOCKUPI to 9901771222.-Canara Bank",
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

# ── Indian-specific held-out test set (never used for training) ───
INDIAN_TEST_PHISHING = [
    "Your HDFC account is at risk. Confirm details at http://hdfc-alert.xyz now",
    "Win Rs.1 lakh in Paytm contest. Register at http://paytm-contest.top",
    "Your Aadhaar suspended. Update at http://aadhaar-update.xyz immediately",
    "SBI: KYC pending, account closes in 24h. Click http://sbi-kyc.buzz",
    "Claim your EPFO pension bonus at http://epfo-bonus.xyz before March 31",
    "IRCTC refund Rs.5000 pending. Submit bank details at http://irctc-claim.xyz",
    "Congratulations! UPI reward of Rs.10000 at http://upi-reward.club",
    "Income tax dept notice. Pay Rs.3500 at http://incometax-pay.xyz or face arrest",
    "Your SIM KYC expires today. Reactivate at http://sim-kyc.top by 6PM",
    "Free LPG subsidy Rs.800 pending. Link Aadhaar at http://lpg-link.xyz",
]

INDIAN_TEST_SAFE = [
    "Your OTP for ICICI Bank login is 384729. Valid 10 mins. Do not share. -ICICI",
    "Rs.2500 debited from A/C XX4521 to BigBazaar on 20-Apr-26. Avl Bal Rs.12340. -SBI",
    "Your Airtel prepaid recharge of Rs.149 is done. Validity: 28 days.",
    "Amazon: Order #405-1234 shipped. Track at amazon.in/orders.",
    "Swiggy: Your order from Pizza Hut is out for delivery. ETA 20 mins.",
    "598234 is OTP for PhonePe transaction. Valid 5 min. Never share. -PhonePe",
    "IRCTC: Your ticket PNR 2345678901 confirmed. Rajdhani Exp on 22-Apr-26.",
    "If not done SMS BLOCKUPI to 9223766666 to block UPI transactions. -SBI",
    "Your Jio number 9876543210 data balance: 12.5GB. Validity: 15 days.",
    "HDFC: EMI of Rs.4500 auto-debited for loan A/C XX8901 on 01-Apr-26.",
]

# ── Download public datasets ───────────────────────────────────────
GITHUB_DATASETS = [
    {
        'name': 'Kaggle SMS Spam (GitHub mirror)',
        'url': 'https://raw.githubusercontent.com/mohitgupta-omg/Kaggle-SMS-Spam-Collection-Dataset-/master/spam.csv',
        'text_col': 'v2',
        'label_col': 'v1',
        'spam_label': 'spam',
        'sep': ',',
    },
    {
        'name': 'PyConUS 2016 SMS',
        'url': 'https://raw.githubusercontent.com/justmarkham/pycon-2016-tutorial/master/data/sms.tsv',
        'text_col': 'message',
        'label_col': 'label',
        'spam_label': 'spam',
        'sep': '\t',
    },
]

print("=" * 60)
print("Downloading public spam datasets")
print("=" * 60)

all_dfs = []
source_counts = {}

for ds in GITHUB_DATASETS:
    try:
        df = pd.read_csv(ds['url'], sep=ds['sep'], encoding='latin-1')
        df = df[[ds['text_col'], ds['label_col']]].copy()
        df.columns = ['text', 'label_str']
        df['label'] = (df['label_str'] == ds['spam_label']).astype(int)
        df = df[['text', 'label']].dropna()
        all_dfs.append(df)
        source_counts[ds['name']] = len(df)
        print(f"[OK] {ds['name']}: {len(df)} msgs ({df['label'].sum()} spam)")
    except Exception as e:
        print(f"[SKIP] {ds['name']}: {e}")

# HuggingFace UCI
try:
    from datasets import load_dataset
    uci = load_dataset("sms_spam", split="train")
    uci_df = pd.DataFrame(uci).rename(columns={'sms': 'text'})
    uci_df['label'] = uci_df['label']  # already 0/1
    uci_df = uci_df[['text', 'label']].dropna()
    all_dfs.append(uci_df)
    source_counts['HuggingFace UCI'] = len(uci_df)
    print(f"[OK] HuggingFace UCI: {len(uci_df)} msgs ({uci_df['label'].sum()} spam)")
except Exception as e:
    print(f"[SKIP] HuggingFace UCI: {e}")

# Enron email subjects (short ones only)
try:
    enron_url = 'https://raw.githubusercontent.com/MWiechmann/enron_spam_data/master/enron_spam_data.csv'
    enron = pd.read_csv(enron_url, encoding='latin-1')
    enron_sms = enron[['Subject', 'Spam/Ham']].copy()
    enron_sms.columns = ['text', 'label_str']
    enron_sms['label'] = (enron_sms['label_str'] == 'spam').astype(int)
    enron_sms = enron_sms[enron_sms['text'].str.len().between(5, 200)].dropna()
    all_dfs.append(enron_sms[['text', 'label']])
    source_counts['Enron subjects'] = len(enron_sms)
    print(f"[OK] Enron subjects: {len(enron_sms)} msgs ({enron_sms['label'].sum()} spam)")
except Exception as e:
    print(f"[SKIP] Enron: {e}")

if not all_dfs:
    print("No external datasets downloaded — using Indian data only.")

# ── Combine with Indian data (8x oversample) ──────────────────────
indian_df = pd.DataFrame({
    'text':  INDIAN_PHISHING + INDIAN_SAFE,
    'label': [1] * len(INDIAN_PHISHING) + [0] * len(INDIAN_SAFE),
})
indian_oversampled = pd.concat([indian_df] * 8, ignore_index=True)
source_counts['Indian SMS (8x)'] = len(indian_oversampled)

external_df = pd.concat(all_dfs, ignore_index=True) if all_dfs else pd.DataFrame({'text': [], 'label': []})
combined_df = pd.concat([external_df, indian_oversampled], ignore_index=True)
combined_df['text'] = combined_df['text'].apply(preprocess)
combined_df = combined_df.dropna(subset=['text', 'label'])
combined_df = combined_df.sample(frac=1, random_state=42).reset_index(drop=True)

print()
print("=" * 60)
print("Dataset composition")
print("=" * 60)
for src, cnt in source_counts.items():
    print(f"  {src:<35} {cnt:>6} msgs")
print(f"  {'TOTAL':<35} {len(combined_df):>6} msgs")
print(f"  Phishing : {combined_df['label'].sum()}")
print(f"  Safe     : {(combined_df['label'] == 0).sum()}")

# ── Train / test split ────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    combined_df['text'], combined_df['label'],
    test_size=0.2, random_state=42, stratify=combined_df['label']
)

# ── Retrain ───────────────────────────────────────────────────────
print()
print("=" * 60)
print("Training")
print("=" * 60)
new_model = Pipeline([
    ('tfidf', TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=25000,
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
new_model.fit(X_train, y_train)
print("Done.")

# ── Overall evaluation ────────────────────────────────────────────
y_pred = new_model.predict(X_test)
overall_acc   = accuracy_score(y_test, y_pred)
overall_recall = recall_score(y_test, y_pred, pos_label=1)

print()
print("=== OVERALL TEST SET ===")
print(classification_report(y_test, y_pred, target_names=['Safe', 'Phishing']))

# ── Indian-specific evaluation ────────────────────────────────────
indian_test_texts  = [preprocess(t) for t in INDIAN_TEST_PHISHING + INDIAN_TEST_SAFE]
indian_test_labels = [1] * len(INDIAN_TEST_PHISHING) + [0] * len(INDIAN_TEST_SAFE)
indian_pred = new_model.predict(indian_test_texts)
indian_acc  = accuracy_score(indian_test_labels, indian_pred)
indian_recall = recall_score(indian_test_labels, indian_pred, pos_label=1)

print("=== INDIAN-SPECIFIC TEST SET ===")
print(classification_report(indian_test_labels, indian_pred, target_names=['Safe', 'Phishing']))
print(f"Indian accuracy : {indian_acc:.4f}")
print(f"Indian recall   : {indian_recall:.4f}")

# ── Save only if Indian accuracy >= 80% ──────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'saved_model', 'phish_pipeline.joblib')
META_PATH  = os.path.join(os.path.dirname(__file__), 'saved_model', 'model_meta.json')

print()
if indian_acc >= 0.80:
    backup_path = MODEL_PATH.replace('.joblib', '_backup.joblib')
    shutil.copy(MODEL_PATH, backup_path)
    print(f"Old model backed up -> {backup_path}")

    joblib.dump(new_model, MODEL_PATH)
    print(f"New model saved -> {MODEL_PATH}")

    meta = {
        "accuracy":       round(overall_acc, 4),
        "spam_recall":    round(overall_recall, 4),
        "indian_accuracy": round(indian_acc, 4),
        "indian_recall":  round(indian_recall, 4),
        "model_type":     "TF-IDF(trigram) + LogisticRegression(balanced)",
        "features":       25000,
        "ngram_range":    [1, 3],
        "augmented":      True,
        "indian_data":    True,
        "sources":        list(source_counts.keys()),
        "train_size":     len(X_train),
    }
    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"Meta updated -> {META_PATH}")
    print()
    print(f"[SAVED] Overall accuracy {overall_acc:.2%} | Indian accuracy {indian_acc:.2%}")
else:
    print(f"[WARNING] Indian accuracy {indian_acc:.2%} is below 80% threshold.")
    print("Existing model kept unchanged.")

print()
print("Done.")
