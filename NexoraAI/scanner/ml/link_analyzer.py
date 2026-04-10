import re
from urllib.parse import urlparse
from dataclasses import dataclass


@dataclass
class LinkFeatures:
    url_length: int
    has_ip: bool
    subdomain_count: int
    has_at_sign: bool
    has_double_slash: bool
    tld_suspicious: bool
    is_shortened: bool
    path_depth: int
    has_port: bool
    digit_ratio: float
    special_char_count: int


_SUSPICIOUS_TLDS = {"tk","ml","ga","cf","gq","xyz","top","click","pw","work","loan","online","site","live","link"}
_SHORTENERS = {"bit.ly","tinyurl.com","ow.ly","t.co","goo.gl","is.gd","buff.ly","adf.ly","cutt.ly","rebrand.ly"}
_IP_PATTERN = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")


def extract_features(url: str) -> LinkFeatures:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    path = parsed.path or ""
    parts = hostname.split(".")
    tld = parts[-1].lower() if parts else ""
    digits = sum(c.isdigit() for c in hostname)
    digit_ratio = digits / max(len(hostname), 1)
    special = sum(c in "-_~!$&'()*+,;=:@" for c in url)
    return LinkFeatures(
        url_length=len(url),
        has_ip=bool(_IP_PATTERN.match(hostname)),
        subdomain_count=max(len(parts) - 2, 0),
        has_at_sign="@" in url,
        has_double_slash="//" in path,
        tld_suspicious=tld in _SUSPICIOUS_TLDS,
        is_shortened=hostname in _SHORTENERS,
        path_depth=len([p for p in path.split("/") if p]),
        has_port=parsed.port is not None,
        digit_ratio=round(digit_ratio, 4),
        special_char_count=special,
    )


def features_to_vector(f: LinkFeatures) -> list:
    return [
        f.url_length, int(f.has_ip), f.subdomain_count, int(f.has_at_sign),
        int(f.has_double_slash), int(f.tld_suspicious), int(f.is_shortened),
        f.path_depth, int(f.has_port), f.digit_ratio, f.special_char_count,
    ]
