import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from typing import Dict, List
import ipaddress

def get_hostname(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc

def has_ip(hostname: str) -> int:
    try:
        ipaddress.ip_address(hostname)
        return 1
    except:
        return 0

def get_words(text: str) -> List[str]:
    return re.findall(r'\w+', text)

def extract_url_features(url: str, response_text: str = None, final_url: str = None) -> Dict[str, float]:
    parsed = urlparse(url)
    hostname = parsed.netloc
    path = parsed.path

    # URL Features
    features = {
        "length_url": len(url),
        "length_hostname": len(hostname),
        "ip": has_ip(hostname),
        "nb_dots": url.count('.'),
        "nb_hyphens": url.count('-'),
        "nb_at": url.count('@'),
        "nb_qm": url.count('?'),
        "nb_and": url.count('&'),
        "nb_or": url.count('|'),
        "nb_eq": url.count('='),
        "nb_underscore": url.count('_'),
        "nb_tilde": url.count('~'),
        "nb_percent": url.count('%'),
        "nb_slash": url.count('/'),
        "nb_star": url.count('*'),
        "nb_colon": url.count(':'),
        "nb_comma": url.count(','),
        "nb_semicolumn": url.count(';'),
        "nb_dollar": url.count('$'),
        "nb_space": url.count('%20') + url.count(' '),
        "nb_www": 1 if 'www' in url.lower() else 0,
        "nb_com": url.lower().count('.com'),
        "nb_dslash": url.count('//') - 1, # -1 because of protocol
        "http_in_path": path.lower().count('http'),
        "https_token": 1 if parsed.scheme == 'https' else 0,
        "ratio_digits_url": sum(c.isdigit() for c in url) / len(url) if len(url) > 0 else 0,
        "ratio_digits_host": sum(c.isdigit() for c in hostname) / len(hostname) if len(hostname) > 0 else 0,
        "punycode": 1 if 'xn--' in url.lower() else 0,
        "port": 1 if parsed.port and parsed.port not in [80, 443] else 0,
        "tld_in_path": 0, # Simplified
        "tld_in_subdomain": 0, # Simplified
        "abnormal_subdomain": 0, # Simplified
        "nb_subdomains": hostname.count('.') - 1 if hostname.count('.') > 1 else 0,
        "prefix_suffix": 1 if '-' in hostname else 0,
        "random_domain": 0, # Static placeholder
        "shortening_service": 1 if any(s in hostname for s in ['bit.ly', 'goo.gl', 't.co', 'tinyurl']) else 0,
        "path_extension": path.count('.'),
        "nb_redirection": 0, # Filled by LinkAnalyzer if available
        "nb_external_redirection": 0,
    }

    # Word features
    words = get_words(url)
    features["length_words_raw"] = len(words)
    features["shortest_words_raw"] = min(len(w) for w in words) if words else 0
    features["longest_words_raw"] = max(len(w) for w in words) if words else 0
    features["avg_words_raw"] = sum(len(w) for w in words) / len(words) if words else 0

    host_words = get_words(hostname)
    features["shortest_word_host"] = min(len(w) for w in host_words) if host_words else 0
    features["longest_word_host"] = max(len(w) for w in host_words) if host_words else 0
    features["avg_word_host"] = sum(len(w) for w in host_words) / len(host_words) if host_words else 0

    path_words = get_words(path)
    features["shortest_word_path"] = min(len(w) for w in path_words) if path_words else 0
    features["longest_word_path"] = max(len(w) for w in path_words) if path_words else 0
    features["avg_word_path"] = sum(len(w) for w in path_words) / len(path_words) if path_words else 0

    # Character repeat
    features["char_repeat"] = 0
    if len(url) > 1:
        repeat_counts = [url.count(c) for c in set(url)]
        features["char_repeat"] = sum(1 for count in repeat_counts if count > 1)

    # Phish hints
    phish_hints = ["login", "verify", "account", "update", "bank", "secure", "confirm", "signin"]
    features["phish_hints"] = sum(1 for hint in phish_hints if hint in url.lower())

    # Brand features
    features["domain_in_brand"] = 0
    features["brand_in_subdomain"] = 0
    features["brand_in_path"] = 0
    features["suspecious_tld"] = 1 if any(url.endswith(t) for t in ['.xyz', '.top', '.club', '.buzz']) else 0
    features["statistical_report"] = 0

    # Page features (require response_text)
    if response_text:
        soup = BeautifulSoup(response_text, 'html.parser')
        links = soup.find_all('a', href=True)
        nb_links = len(links)
        features["nb_hyperlinks"] = nb_links

        int_links = [l for l in links if hostname in l['href'] or l['href'].startswith('/') or not l['href'].startswith('http')]
        ext_links = [l for l in links if l not in int_links]
        null_links = [l for l in links if l['href'] in ['#', '#content', '#main', 'javascript:void(0)']]

        features["ratio_intHyperlinks"] = len(int_links) / nb_links if nb_links > 0 else 0
        features["ratio_extHyperlinks"] = len(ext_links) / nb_links if nb_links > 0 else 0
        features["ratio_nullHyperlinks"] = len(null_links) / nb_links if nb_links > 0 else 0

        features["nb_extCSS"] = len(soup.find_all('link', rel='stylesheet', href=True))

        # Redirections
        if final_url and final_url != url:
            features["nb_redirection"] = 1
            if urlparse(final_url).netloc != hostname:
                features["nb_external_redirection"] = 1

        features["ratio_intRedirection"] = 0 # Simplified
        features["ratio_extRedirection"] = 0 # Simplified
        features["ratio_intErrors"] = 0
        features["ratio_extErrors"] = 0

        features["login_form"] = 1 if soup.find('form', action=True) and any(kw in str(soup).lower() for kw in ['login', 'sign', 'password']) else 0
        features["external_favicon"] = 1 if soup.find('link', rel='icon', href=True) and 'http' in soup.find('link', rel='icon')['href'] and hostname not in soup.find('link', rel='icon')['href'] else 0
        features["links_in_tags"] = 0 # Simplified
        features["submit_email"] = 1 if 'mailto:' in response_text.lower() else 0

        media = soup.find_all(['img', 'video', 'audio'], src=True)
        int_media = [m for m in media if hostname in m['src'] or m['src'].startswith('/') or not m['src'].startswith('http')]
        features["ratio_intMedia"] = len(int_media) / len(media) if len(media) > 0 else 0
        features["ratio_extMedia"] = (len(media) - len(int_media)) / len(media) if len(media) > 0 else 0

        features["sfh"] = 1 if soup.find('form', action=lambda x: x in ['', 'about:blank']) else 0
        features["iframe"] = 1 if soup.find('iframe') else 0
        features["popup_window"] = 1 if 'window.open' in response_text else 0
        features["safe_anchor"] = 0 # Simplified
        features["onmouseover"] = 1 if 'onmouseover' in response_text.lower() else 0
        features["right_clic"] = 1 if 'event.button==2' in response_text or 'contextmenu' in response_text.lower() else 0

        title = soup.title.string if soup.title else ""
        features["empty_title"] = 1 if not title else 0
        features["domain_in_title"] = 1 if hostname.lower() in title.lower() else 0
        features["domain_with_copyright"] = 1 if hostname.lower() in response_text.lower() and '©' in response_text else 0
    else:
        # Fill page features with defaults if no scraper data
        page_features = [
            "nb_hyperlinks", "ratio_intHyperlinks", "ratio_extHyperlinks", "ratio_nullHyperlinks",
            "nb_extCSS", "ratio_intRedirection", "ratio_extRedirection", "ratio_intErrors",
            "ratio_extErrors", "login_form", "external_favicon", "links_in_tags", "submit_email",
            "ratio_intMedia", "ratio_extMedia", "sfh", "iframe", "popup_window", "safe_anchor",
            "onmouseover", "right_clic", "empty_title", "domain_in_title", "domain_with_copyright"
        ]
        for pf in page_features:
            features[pf] = 0

    # External Features (Missing data in local env, so use -1 to match dataset's missing indicator)
    external_features = [
        "whois_registered_domain", "domain_registration_length", "domain_age",
        "web_traffic", "dns_record", "google_index", "page_rank"
    ]
    for ef in external_features:
        features[ef] = -1 # Matches dataset convention for missing data

    return features


def extract_features(url: str) -> list:
    """
    Wrapper that returns an ordered list of feature values for use with the URL ML model.
    Uses extract_url_features internally.
    """
    features_dict = extract_url_features(url)
    # Return values in consistent order
    return list(features_dict.values())
