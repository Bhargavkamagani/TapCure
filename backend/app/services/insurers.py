"""The ONE list of insurance companies and government health schemes (2026-11-03).

Hospitals tick the ones they accept; patients will pick theirs from the same
list (Phase 2). Nobody types an insurer's name, so there is no "Star health" /
"STAR Health Ins." drift and search always matches.

The database stores only the CODE (e.g. "star_health"). If a company or a
scheme is renamed — Bajaj Allianz -> Bajaj General, Future Generali ->
Generali Central, YSR Aarogyasri -> Dr NTR Vaidya Seva all happened in
2024-26 — change the `name` here and every hospital shows the new name at
once; nobody re-ticks anything. NEVER change or reuse a code once shipped.

To add one: append a line. To retire one: leave the line and set
active=False, so hospitals that already ticked it still show a name.

Groups (in picker order):
    government  national schemes, every state's scheme, govt-employee schemes
    health      standalone health insurers
    general     private general insurers
    psu         public-sector general insurers

`state` is set on state schemes only; the picker shows the hospital's own
state first, but every hospital can tick every scheme.
`initials` + `color` draw the small badge shown until a real logo file is
placed at frontend public/insurers/<code>.png (or .svg).

We only record WHO ACCEPTS WHAT. Claims, approvals and payments stay with the
hospital's insurance desk — the UI says so.
"""
from typing import Iterable, Optional

GROUPS = [
    ("government", "Government schemes"),
    ("health", "Health insurers"),
    ("general", "General insurers"),
    ("psu", "Public sector insurers"),
]

# (code, display name, group, state or None, initials, badge colour)
_ROWS = [
    # ---- Government: national ----
    ("pmjay", "Ayushman Bharat PM-JAY", "government", None, "AB", "#E8701A"),
    ("cghs", "CGHS (Central Govt Health Scheme)", "government", None, "CG", "#1E3A8A"),
    ("echs", "ECHS (Ex-Servicemen)", "government", None, "EC", "#365314"),
    ("esi", "ESI (Employees' State Insurance)", "government", None, "ES", "#0F766E"),
    ("railways_umid", "Railways (UMID)", "government", None, "RL", "#7F1D1D"),
    # ---- Government: state schemes ----
    ("ap_ntr_vaidya_seva", "Dr NTR Vaidya Seva (formerly YSR Aarogyasri)", "government", "Andhra Pradesh", "NV", "#B45309"),
    ("ar_cm_arogya", "CM Arogya Arunachal Yojana", "government", "Arunachal Pradesh", "CA", "#047857"),
    ("as_atal_amrit", "Atal Amrit Abhiyan", "government", "Assam", "AA", "#9A3412"),
    ("br_mjay", "Mukhyamantri Jan Arogya Yojana (Bihar)", "government", "Bihar", "MJ", "#6D28D9"),
    ("cg_svnsasy", "Shaheed Veer Narayan Singh Ayushman Swasthya Yojana", "government", "Chhattisgarh", "SV", "#15803D"),
    ("dl_ab_delhi", "Ayushman Bharat Delhi", "government", "Delhi", "AD", "#C2410C"),
    ("ga_ddssy", "Deen Dayal Swasthya Seva Yojana", "government", "Goa", "DD", "#0369A1"),
    ("gj_pmjay_ma", "PMJAY-MA (Mukhyamantri Amrutum)", "government", "Gujarat", "MA", "#BE123C"),
    ("hr_chirayu", "Chirayu Ayushman Haryana", "government", "Haryana", "CH", "#4D7C0F"),
    ("hp_himcare", "HIMCARE", "government", "Himachal Pradesh", "HC", "#0E7490"),
    ("jk_sehat", "AB-PMJAY SEHAT", "government", "Jammu and Kashmir", "SE", "#9F1239"),
    ("jh_abua", "Abua Swasthya Suraksha Yojana", "government", "Jharkhand", "AS", "#166534"),
    ("ka_ab_ark", "Ayushman Bharat Arogya Karnataka", "government", "Karnataka", "AK", "#B91C1C"),
    ("ka_yeshasvini", "Yeshasvini", "government", "Karnataka", "YE", "#A16207"),
    ("kl_kasp", "KASP (Karunya Arogya Suraksha Padhathi)", "government", "Kerala", "KA", "#065F46"),
    ("mp_niramayam", "Ayushman Bharat Niramayam", "government", "Madhya Pradesh", "NI", "#7C2D12"),
    ("mh_mjpjay", "Mahatma Jyotirao Phule Jan Arogya Yojana", "government", "Maharashtra", "MP", "#EA580C"),
    ("mn_cmht", "CM-gi Hakshelgi Tengbang", "government", "Manipur", "HT", "#86198F"),
    ("ml_mhis", "Megha Health Insurance Scheme (MHIS)", "government", "Meghalaya", "MH", "#1D4ED8"),
    ("mz_mshcs", "Mizoram State Health Care Scheme", "government", "Mizoram", "MZ", "#0F766E"),
    ("nl_cmhis", "CM Health Insurance Scheme (Nagaland)", "government", "Nagaland", "NL", "#991B1B"),
    ("od_gjay", "Gopabandhu Jan Arogya Yojana (formerly BSKY)", "government", "Odisha", "GJ", "#C2410C"),
    ("py_cmhas", "CM Health Assurance Scheme (Puducherry)", "government", "Puducherry", "PY", "#1E40AF"),
    ("pb_mmsy", "Mukh Mantri Sehat Yojana", "government", "Punjab", "MS", "#B45309"),
    ("rj_maa", "MAA Yojana (formerly Chiranjeevi)", "government", "Rajasthan", "MY", "#BE185D"),
    ("sk_su_swasthya", "Su-Swasthya Yojana", "government", "Sikkim", "SS", "#047857"),
    ("tn_cmchis", "CM Comprehensive Health Insurance Scheme (CMCHIS)", "government", "Tamil Nadu", "CM", "#B91C1C"),
    ("ts_aarogyasri", "Aarogyasri", "government", "Telangana", "AR", "#DB2777"),
    ("tr_mjay", "Mukhyamantri Jan Arogya Yojana (Tripura)", "government", "Tripura", "TJ", "#5B21B6"),
    ("up_mjaa", "Mukhyamantri Jan Arogya Abhiyan", "government", "Uttar Pradesh", "UP", "#9A3412"),
    ("uk_atal_ayushman", "Atal Ayushman Uttarakhand", "government", "Uttarakhand", "AU", "#0369A1"),
    ("wb_swasthya_sathi", "Swasthya Sathi", "government", "West Bengal", "SW", "#15803D"),
    # ---- Government: employee / journalist schemes ----
    ("ts_ehs", "Telangana Employees Health Scheme (EHS)", "government", "Telangana", "TE", "#BE185D"),
    ("ts_jhs", "Telangana Journalists Health Scheme (JHS)", "government", "Telangana", "TJ", "#9D174D"),
    ("ap_ehs", "AP Employees Health Scheme (EHS)", "government", "Andhra Pradesh", "AE", "#92400E"),
    # ---- Standalone health insurers ----
    ("star_health", "Star Health Insurance", "health", None, "SH", "#1D4ED8"),
    ("care_health", "Care Health Insurance (formerly Religare)", "health", None, "CH", "#16A34A"),
    ("niva_bupa", "Niva Bupa Health Insurance (formerly Max Bupa)", "health", None, "NB", "#0EA5E9"),
    ("aditya_birla_health", "Aditya Birla Health Insurance", "health", None, "AB", "#B91C1C"),
    ("manipalcigna", "ManipalCigna Health Insurance", "health", None, "MC", "#0369A1"),
    ("galaxy_health", "Galaxy Health Insurance", "health", None, "GH", "#7C3AED"),
    ("narayana_health_ins", "Narayana Health Insurance", "health", None, "NH", "#059669"),
    ("prudential_hcl_health", "Prudential HCL Health Insurance", "health", None, "PH", "#DC2626"),
    # ---- Private general insurers ----
    ("hdfc_ergo", "HDFC ERGO General Insurance", "general", None, "HE", "#DC2626"),
    ("icici_lombard", "ICICI Lombard General Insurance", "general", None, "IL", "#EA580C"),
    ("tata_aig", "Tata AIG General Insurance", "general", None, "TA", "#1E40AF"),
    ("bajaj_general", "Bajaj General Insurance (formerly Bajaj Allianz)", "general", None, "BG", "#0284C7"),
    ("sbi_general", "SBI General Insurance", "general", None, "SB", "#1D4ED8"),
    ("iffco_tokio", "IFFCO Tokio General Insurance", "general", None, "IT", "#15803D"),
    ("go_digit", "Go Digit General Insurance", "general", None, "GD", "#CA8A04"),
    ("acko", "Acko General Insurance", "general", None, "AC", "#6D28D9"),
    ("reliance_general", "Reliance General Insurance", "general", None, "RG", "#B91C1C"),
    ("zurich_kotak", "Zurich Kotak General Insurance", "general", None, "ZK", "#1E3A8A"),
    ("royal_sundaram", "Royal Sundaram General Insurance", "general", None, "RS", "#9D174D"),
    ("chola_ms", "Cholamandalam MS General Insurance", "general", None, "CM", "#B45309"),
    ("generali_central", "Generali Central Insurance (formerly Future Generali)", "general", None, "GC", "#BE123C"),
    ("universal_sompo", "Universal Sompo General Insurance", "general", None, "US", "#C2410C"),
    ("zuno", "Zuno General Insurance", "general", None, "ZU", "#7C3AED"),
    ("qbe", "QBE General Insurance (formerly Raheja QBE)", "general", None, "QB", "#0F766E"),
    ("liberty_general", "Liberty General Insurance", "general", None, "LG", "#CA8A04"),
    ("shriram_general", "Shriram General Insurance", "general", None, "SG", "#15803D"),
    ("magma_general", "Magma General Insurance", "general", None, "MG", "#9333EA"),
    ("kshema_general", "Kshema General Insurance", "general", None, "KG", "#047857"),
    # ---- Public sector general insurers ----
    ("new_india", "The New India Assurance", "psu", None, "NI", "#1E3A8A"),
    ("united_india", "United India Insurance", "psu", None, "UI", "#0369A1"),
    ("oriental", "The Oriental Insurance", "psu", None, "OI", "#B91C1C"),
    ("national_insurance", "National Insurance", "psu", None, "NA", "#15803D"),
]

INSURERS: dict[str, dict] = {
    code: {"code": code, "name": name, "group": group, "state": state,
           "initials": initials, "color": color, "active": True}
    for code, name, group, state, initials, color in _ROWS
}
assert len(INSURERS) == len(_ROWS), "duplicate insurer code in _ROWS"


def _norm_state(s: Optional[str]) -> str:
    """'Jammu & Kashmir', 'jammu and kashmir ', 'TELANGANA' -> comparable keys."""
    return "".join(ch for ch in (s or "").lower().replace("&", "and") if ch.isalnum())


def grouped(hospital_state: Optional[str] = None) -> list[dict]:
    """The picker list: 4 groups in order. With `hospital_state`, that state's
    schemes come first inside Government; everything stays selectable."""
    mine = _norm_state(hospital_state)
    out = []
    for key, label in GROUPS:
        items = [i for i in INSURERS.values() if i["group"] == key and i["active"]]
        if key == "government" and mine:
            items.sort(key=lambda i: 0 if i["state"] and _norm_state(i["state"]) == mine else 1)
        out.append({"key": key, "label": label, "items": items})
    return out


def clean_codes(codes: Optional[Iterable[str]]) -> list[str]:
    """Validate a list of codes from a request: trimmed, lower-cased, de-duplicated
    (first order kept). Raises ValueError naming any unknown code."""
    seen: list[str] = []
    bad: list[str] = []
    for raw in codes or []:
        code = str(raw or "").strip().lower()
        if not code:
            continue
        if code not in INSURERS:
            bad.append(code)
        elif code not in seen:
            seen.append(code)
    if bad:
        raise ValueError(f"Unknown insurance code(s): {', '.join(bad)}")
    return seen


def known(codes: Optional[Iterable[str]]) -> list[str]:
    """For output: drop anything not in the list (e.g. a hand-edited DB row)."""
    return [c for c in (codes or []) if c in INSURERS]
