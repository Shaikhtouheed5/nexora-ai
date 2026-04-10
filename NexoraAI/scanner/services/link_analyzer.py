import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict
from ml.model import get_classifier

# Standard regex for URL extraction
URL_PATTERN = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'

# Trusted banking and payment domains to avoid false positives
TRUSTED_DOMAINS = [
    "kotak.com", "icicibank.com", "hdfcbank.com", "sbi.co.in", "axisbank.com",
    "paytm.com", "phonepe.com", "google.com", "amazon.com", "razorpay.com",
    "paypal.com", "onlinesbi.sbi", "axisbank.co.in", "bank.sbi"
]

class LinkAnalyzer:
    def __init__(self):
        # Known malicious list for quick screening
        self.known_malicious_domains = [
            "scam-post.com", "fake-bank-login.net", "win-free-prize.xyz",
            "secure-verify-account.com", "bit.ly/malicious-link"
        ]

    def extract_links(self, text: str) -> List[str]:
        return re.findall(URL_PATTERN, text)

    async def analyze_link(self, url: str) -> Dict:
        # Normalize domain
        clean_url = url.strip().lower()
        domain = clean_url.split("//")[-1].split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        
        # 1. Quick Whitelist Check
        is_trusted = any(domain == td or domain.endswith("." + td) for td in TRUSTED_DOMAINS)
        
        result = {
            "url": url,
            "domain": domain,
            "is_known_malicious": domain in self.known_malicious_domains,
            "is_trusted": is_trusted,
            "title": "Unknown",
            "screenshot_score": 0,
            "ml_score": 0.0,
            "status": "Safe" if is_trusted else "Scanning",
            "suspicious_keywords_found": []
        }

        # If it's a known trusted domain, we can skip aggressive scraping
        if is_trusted:
            result["title"] = f"Official {domain.split('.')[0].title()} Site"
            result["screenshot_score"] = 0
            return result

        # 2. Robust Scraping & ML Prediction
        response_text = None
        final_url = None
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers) as client:
                response = await client.get(url)
                response_text = response.text
                final_url = str(response.url)
                
                # Check for final URL after redirects
                final_domain = final_url.split("//")[-1].split("/")[0]
                if final_domain.startswith("www."):
                    final_domain = final_domain[4:]
                
                result["final_url"] = final_url
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response_text, 'html.parser')
                    result["title"] = soup.title.string.strip() if soup.title else "No Title"
                    
                    # Basic keyword check in title/content
                    suspicious_keywords = ["login", "verify", "account", "suspend", "winner", "prize", "urgent", "kyc", "pan"]
                    found = [k for k in suspicious_keywords if k in response.text.lower()]
                    result["suspicious_keywords_found"] = list(set(found))
                    
        except Exception as e:
            result["error"] = f"Connection Failed: {str(e)}"
            result["status"] = "Unreachable"

        # 3. ML Model Override/Enhancement
        classifier = get_classifier()
        ml_score = classifier.predict_url(url, response_text, final_url)
        result["ml_score"] = round(ml_score, 3)
        
        # Determine status based on ML score (XGBoost is very precise)
        if ml_score > 0.8:
            result["status"] = "Malicious"
            result["screenshot_score"] = int(ml_score * 100)
        elif ml_score > 0.5:
            result["status"] = "Suspicious"
            result["screenshot_score"] = int(ml_score * 100)
        elif ml_score > 0.3:
            result["status"] = "Caution"
            result["screenshot_score"] = int(ml_score * 100)
        else:
            if result["status"] == "Scanning":
                result["status"] = "Safe"

        return result

    async def scan_all(self, text: str) -> List[Dict]:
        links = self.extract_links(text)
        analysis_results = []
        for link in links:
            analysis_results.append(await self.analyze_link(link))
        return analysis_results

# Singleton
link_analyzer = LinkAnalyzer()

def get_link_analyzer():
    return link_analyzer
