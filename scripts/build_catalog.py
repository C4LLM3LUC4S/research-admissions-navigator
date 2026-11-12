"""Normalize the curated official-source seed without network access or inference.

Run this script to build data/catalog.json and dist/catalog.js. --check validates
both existing outputs against the source packs without rewriting any file.
"""
import argparse
import hashlib
from html import escape
import json
import re
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CHECKED = "2026-11-11"
BASE_SOURCE_DATE = "2026-10-26"
CYCLE = "2027/28"
TAGS = ("人工智能", "机器学习", "计算机视觉", "自然语言处理", "机器人与控制", "数据挖掘", "网络与系统", "理论与优化", "数学与统计", "金融与精算", "生物医学与健康", "软件工程与编程语言", "网络安全", "人机交互", "数据库与数据系统", "计算机图形学", "计算机音乐与音频", "环境与可持续发展", "物理与化学", "材料与能源", "土木与机械工程", "经济与管理", "人文与社会科学", "教育学", "设计与创意", "旅游与酒店管理", "电子与集成电路", "生命科学与生物工程", "化学工程")
# Exact aliases only: generic words such as 'systems' do not create extra fields.
ALIASES = {
    "人工智能": {"人工智能", "ai", "ai4science", "ai theory", "大语言模型", "智能体", "人工智能与通信网络融合"},
    "机器学习": {"机器学习", "machine learning", "deep learning", "distributed machine learning", "graph machine learning", "图机器学习", "深度学习", "神经计算"},
    "计算机视觉": {"computer vision", "计算机视觉", "视觉计算", "三维生成与设计", "三维重建"},
    "自然语言处理": {"自然语言处理", "natural language processing", "大语言模型", "large language models"},
    "机器人与控制": {"automatic control", "cyber-physical systems", "networked sensing", "multi-agent autonomous systems", "智能控制", "控制", "智能系统与机器人"},
    "数据挖掘": {"data mining", "数据挖掘", "推荐系统", "大数据"},
    "网络与系统": {"networking", "分布式系统", "无线感知", "移动与边缘计算", "通信网络", "人工智能与通信网络融合", "网络智能"},
    "理论与优化": {"game theory", "ai theory", "优化", "optimization"},
    "数学与统计": {"数学与统计"},
    "金融与精算": {"金融与精算"},
    "生物医学与健康": {"生物医学与健康"},
}
UNIVERSITIES = [
    {"id": "hku", "name": "香港大学", "short": "港大", "en": "The University of Hong Kong", "region": "香港", "entryUrl": "https://gradsch.hku.hk/prospective_students/application/application_period"},
    {"id": "cuhk", "name": "香港中文大学", "short": "港中文（香港）", "en": "The Chinese University of Hong Kong", "region": "香港", "entryUrl": "https://www.gs.cuhk.edu.hk/programmes/engineering/mphil-phd-computer-science-and-engineering"},
    {"id": "hkust", "name": "香港科技大学", "short": "港科大（香港）", "en": "The Hong Kong University of Science and Technology", "region": "香港", "entryUrl": "https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-cse"},
    {"id": "polyu", "name": "香港理工大学", "short": "港理工", "en": "The Hong Kong Polytechnic University", "region": "香港", "entryUrl": "https://www.polyu.edu.hk/study/pg/research-postgraduate"},
    {"id": "cityu", "name": "香港城市大学", "short": "港城大", "en": "City University of Hong Kong", "region": "香港", "entryUrl": "https://www.cs.cityu.edu.hk/en/academic-programmes/master-philosophy-doctor-philosophy/admissions"},
    {"id": "cuhksz", "name": "香港中文大学（深圳）", "short": "港中文（深圳）", "en": "The Chinese University of Hong Kong, Shenzhen", "region": "深圳", "entryUrl": "https://gs.cuhk.edu.cn/page/144"},
    {"id": "hkustgz", "name": "香港科技大学（广州）", "short": "港科大（广州）", "en": "The Hong Kong University of Science and Technology (Guangzhou)", "region": "广州", "entryUrl": "https://fytgs.hkust-gz.edu.cn/admissions/apply-now"},
]


def load(name):
    return json.loads((ROOT / "data/research" / name).read_text(encoding="utf-8"))


def topics(words):
    words = {word.casefold().strip() for word in words}
    return [tag for tag in TAGS if words & ALIASES.get(tag, {tag})]


def deadline(label, date, ids, *, clock=None, degree=None, route="常规申请", cycle=CYCLE):
    # A date alone never becomes an invented midnight/end-of-day timestamp.
    return {"label": f"{label}：{date}" + (f" {clock}（UTC+8）" if clock else "（官网未说明具体时间）"),
            "date": date,
            "at": f"{date}T{clock}:00+08:00" if clock else None,
            "degree": degree, "route": route, "cycle": cycle, "sourceIds": ids}


def program(pid, uid, name, degrees, scope, status, contact, contact_ids, selection,
            selection_ids, deadlines, source_ids, note, *, cycle=CYCLE):
    return {"id": pid, "universityId": uid, "name": name, "degrees": degrees, "cycle": cycle,
            "scope": scope, "contact": {"status": status, "text": contact, "sourceIds": contact_ids},
            "selection": {"text": selection, "sourceIds": selection_ids},
            "deadlines": deadlines, "sourceIds": source_ids, "evidenceNote": note}


def normalize_sources(packs):
    result = []
    for pack in packs:
        for raw in pack["sources"]:
            claims = raw.get("claims") or [raw.get("claim_paraphrase_zh") or raw.get("claim")]
            issues = []
            if raw.get("source_date") is None:
                issues.append("本条尚未记录网页发布时间，请不要把核查日期当作政策发布时间。")
            result.append({"id": raw["id"], "url": raw["url"],
                "title": raw.get("page_title") or raw["title"],
                "checkedAt": raw.get("checked_date") or raw.get("checked_at"),
                "evidenceLevel": raw.get("evidence_level") or "official_verified_page_scoped",
                "scope": raw.get("scope") or "; ".join(raw.get("supports", [])),
                "claims": [claim for claim in claims if claim], "knownIssues": issues})
    by_id = {source["id"]: source for source in result}
    by_id["HKU-EARLY-2027"]["knownIssues"].append("页面仍写开放，但明确截止2026-08-31已过；不能按横幅判断现在可申请。")
    by_id["HKU-EARLY-CONTACT-FAQ"]["knownIssues"].append("仅提前招生；旧cs.hku常见问题链接已404，不能把搜索缓存当最新常规流程。")
    by_id["CUHK-CSE-REGULAR-2027"]["knownIssues"].append("系内暂定面试批次与研究院主轮/奖学金日期分别保存，不挑最晚日期替代全部路线。")
    by_id["cityu-ee"]["knownIssues"].append("正文日期与旧更新标记不一致；金额存在年额/月额混写，本目录不采用金额，也不把EE规则外推CS。")
    by_id["cityu-steps"]["knownIssues"].append("中央主域直接访问403；使用可读的官方cb子域步骤，不登录或绕过限制。CS独立规则待核实。")
    by_id["polyu-calendar"]["knownIssues"].append("这是中央日程，未核到Computing当前周期的独立截止日。")
    by_id["gz-timeline"]["knownIssues"].append("具体AI thrust的2027/28目录未成功读取；本目录只确认总入口，不推定每个thrust有名额。")
    by_id["cityu-jun-wang"]["knownIssues"].append("接收博士的标记没有年份，当前学年名额仍未知。")
    by_id["gz-hui-xiong"]["knownIssues"].append("招收文字没有注明入学年，不升级为当前周期有名额。")
    by_id["gz-lingjie-duan"]["knownIssues"].append("公告写2026和2027；不改写成2027/28已确认余位。")
    result.extend([
        {"id": "rgc-hkpfs-2027", "url": "https://www.ugc.edu.hk/eng/rgc/funding_opport/hkpfs/",
         "title": "Hong Kong PhD Fellowship Scheme", "checkedAt": BASE_SOURCE_DATE,
         "evidenceLevel": "official_funding_call_current_cycle", "scope": "HKPFS 2027/28初申请；只适用于博士",
         "claims": ["2027/28初申请截止2026-12-01香港时间中午12:00；仍需向所选大学递交博士正式申请。"],
         "knownIssues": ["同页奖学金金额标注2026/27，不作为2027/28金额使用。"]},
        {"id": "rgc-hkpfs-institutions", "url": "https://cerg1.ugc.edu.hk/hkpfs/institutions.html",
         "title": "Hong Kong PhD Fellowship Scheme — Participating Universities", "checkedAt": BASE_SOURCE_DATE,
         "evidenceLevel": "official_funding_participating_institutions", "scope": "八所香港参与大学；本目录仅包含其中五所",
         "claims": ["参与列表包含港大、港中文香港、港科大香港、港理工与港城大；深圳和广州机构没有列在该参与名单中。"],
         "knownIssues": ["不能从香港同名大学向深圳或广州继承资助资格。"]},
    ])
    return result


def build_programs(hk, ust, other):
    p = []
    hku_dates = [deadline("主轮截止", "2026-12-01", ["HKU-CENTRAL-PERIOD"], clock="23:59"),
        deadline("第一轮补录截止（看余位）", "2027-04-30", ["HKU-CENTRAL-PERIOD"], clock="23:59", route="补录"),
        deadline("第二轮补录截止（看余位）", "2027-08-31", ["HKU-CENTRAL-PERIOD"], clock="23:59", route="补录")]
    p.append(program("hku-cs-rpg", "hku", "计算机科学研究学位", ["MPhil", "PhD"], "CS / CDS；2027/28常规轮",
        "unknown", "常规轮是否须先取得导师同意，这次没有核实。不要把提前招生FAQ直接套过来。", ["HKU-PROGRAMMES"],
        "须走正式申请。当前所读常规资料没有写清最终审批委员会层级，不能当成导师一人决定。", ["HKU-PROGRAMMES"],
        hku_dates, ["HKU-PROGRAMMES", "HKU-CENTRAL-PERIOD"], "中央日期已核；导师要求按具体常规项目再确认。"))
    p.append(program("hku-cds-early-2027", "hku", "CDS提前招生（该轮已结束）", ["MPhil", "PhD"], "CDS 2027提前招生第二轮，非当前常规轮",
        "not_required", "提前轮FAQ说，申请前可以找老师讨论研究计划，不强制先取得导师同意。", ["HKU-EARLY-CONTACT-FAQ"],
        "短名单会安排面试；页面没有说明完整审批委员会组成。", ["HKU-EARLY-2027"],
        [deadline("第二轮已截止", "2026-08-31", ["HKU-EARLY-2027"], clock="23:59", route="提前招生")],
        ["HKU-EARLY-2027", "HKU-EARLY-CONTACT-FAQ"], "原文写2027入学，本目录与2027/28秋季对齐；明确截止日已过，遗留横幅不代表仍可申请。"))
    c = hk["programme_routes"][2]
    cuhk_dates = [deadline("研究院主轮截止", "2026-12-01", ["CUHK-CSE-PROGRAMME"]),
                  deadline("研究院补录截止（看余位）", "2027-03-31", ["CUHK-CSE-PROGRAMME"], route="补录")]
    for i, batch in enumerate(c["department_batches"], 1):
        cuhk_dates.append(deadline(f"系内第{i}面试批次申请截止（暂定）", batch["application_deadline_date"], ["CUHK-CSE-REGULAR-2027"], route="系内面试批次"))
    cuhk_dates.append(deadline("HKPFS学校完整申请截止", "2026-12-01", ["CUHK-CSE-PROGRAMME"], clock="23:59", degree="PhD", route="HKPFS学校申请"))
    p.append(program("cuhk-cse-rpg", "cuhk", "计算机科学与工程 MPhil/PhD", ["MPhil", "PhD"], "香港本部CSE；2027/28常规招生",
        "recommended", "准备申请时鼓励先联系；评审通过或获面试豁免后，还必须落实愿意指导的老师。这不是说申请前就必须拿到老师同意。", ["CUHK-CSE-REGULAR-2027"],
        "院系评审与导师接收是两道环节。老师的非正式接收意见不等于正式大学录取。", ["CUHK-CSE-REGULAR-2027"],
        cuhk_dates, ["CUHK-CSE-PROGRAMME", "CUHK-CSE-REGULAR-2027"], "研究院截止与系内面试批次不同；系内说HKPFS走首批，具体路线要再核，不挑最晚日期。"))
    for raw in ust["programs"]:
        ids = raw["sources"]
        if raw["institution"] == "HKUST":
            source = ids[0]
            dates = [deadline("秋季非本地申请截止", raw["deadline_chinese_mainland_nonlocal"], [source]),
                     deadline("秋季本地申请截止", raw["deadline_local"], [source]),
                     deadline("2027春季非本地申请截止", "2026-11-01", [source], cycle="2026/27 Spring"),
                     deadline("HKPFS学校完整申请截止", "2026-12-01", [source], clock="23:59", degree="PhD", route="HKPFS学校申请")]
            name = "计算机科学与工程" if "cse" in raw["id"] else "电子与计算机工程"
            p.append(program(raw["id"], "hkust", name, raw["degrees"], "香港校区；2027/28秋季；本地与非本地分开",
                "unknown", "工学院FAQ通常不要求事先口头同意，并建议提交后交流；本项目独立要求尚未核清，不能直接视为无须联系。", ["hk-engineering-faq"],
                "申请由教师/项目审核，正式结果经学校发出；本次未核实院系委员会的具体组成。", ids,
                dates, ids, "使用工学院通用指引时保留院系差异；春季截止不能替代秋季截止。"))
        elif raw["id"] == "hkust-gz-rbm":
            p.append(program(raw["id"], "hkustgz", "红鸟硕士 MPhil (General)", ["MPhil"], "广州；红鸟硕士2027/28秋季",
                "not_required", "该项目不要求申请前联系老师；先入学探索，再进行导师/学域双向选择。", ["gz-redbird"],
                "通过大学统一申请，由选拔与面试委员会审阅；不是先拿某位老师承诺才能申请。", ["gz-redbird"],
                [deadline("本轮截止", "2027-03-01", ["gz-redbird"], clock="23:59")], ids, "仅红鸟硕士规则，不代表广州所有博士或学域。"))
        else:
            p.append(program(raw["id"], "hkustgz", "博士申请总入口（须再选具体项目）", ["PhD"], "广州；2027/28秋季；总入口而非每个学域名额确认",
                "unknown", "总FAQ提供研究方向与教师检索方法，没有证明所有博士项目都须先取得导师同意。按所选学域再核实。", ["gz-central-faq"],
                "正式结果经学校OAS；具体AI学域的最终委员会组成，本次未核清。", ["gz-central-faq"],
                [deadline("中国籍申请截止", "2027-07-15", ["gz-timeline"], clock="23:59", degree="PhD"),
                 deadline("国际申请截止", "2027-06-15", ["gz-timeline"], clock="23:59", degree="PhD"),
                 deadline("春季中国籍申请截止", "2026-12-25", ["gz-timeline"], clock="23:59", degree="PhD", cycle="2026/27 Spring"),
                 deadline("春季国际申请截止", "2026-12-04", ["gz-timeline"], clock="23:59", degree="PhD", cycle="2026/27 Spring")],
                ids, "AI学域通用页已核，仍未确认2027/28具体余位；中央总截止不代表每个学域或导师都有名额。"))
    mapping = {"polyu-hong-kong": "polyu", "cityu-hong-kong": "cityu", "cuhk-shenzhen": "cuhksz"}
    for inst in other["institutions"]:
        uid = mapping[inst["id"]]
        for raw in inst["programmes"]:
            if uid == "polyu":
                dates = [deadline("中央一般申请截止", "2027-05-31", ["polyu-calendar"]),
                         deadline("HKPFS学校完整申请截止", "2026-12-01", ["polyu-calendar"], clock="23:59", degree="PhD", route="HKPFS学校申请")]
                status, text, contacts = "recommended", inst["supervisor_process"]["copy_zh"], ["polyu-faq"]
                name = "计算学研究学位"
                note = "中央FAQ与日期已核；Computing当前周期独立截止和额外要求仍待核。"
            elif uid == "cityu":
                dates = [deadline("一般主轮截止", "2026-12-01", ["cityu-steps"], clock="23:59")]
                is_cs = raw["id"] == "cityu-cs-rpg"
                status = "unknown" if is_cs else "recommended"
                text = "本次CS招生页没有说明申请前导师同意要求；通用建议及EE规则不能代替CS要求。" if is_cs else "仅EE普通轮：鼓励先联系，但申请前联系不是强制。"
                contacts = ["cityu-cs"] if is_cs else ["cityu-ee"]
                name = "计算机科学研究学位" if is_cs else "电机工程博士申请路线"
                note = "中央主域曾403；用可读官方步骤与院系页核对，院系独立日程仍需确认。"
            else:
                dates = [deadline("CIE秋季截止", "2027-05-31", ["cuhksz-cie"]),
                         deadline("CIE旧春季已截止", "2026-10-15", ["cuhksz-cie"], route="春季申请", cycle="2026/27 Spring")]
                status, text, contacts = "recommended", inst["supervisor_process"]["copy_zh"], ["cuhksz-cie"]
                name, note = "计算机与信息工程", "深圳独立项目，不能沿用香港本部HKPFS资格；日期未写时刻，不补23:59。"
            ids = list(dict.fromkeys(raw["source_ids"] + contacts))
            p.append(program(raw["id"], uid, name, raw["degrees"], f"{inst['display_name']}；{raw['unit']}；2027/28所读范围",
                status, text, contacts, inst["supervisor_process"]["formal_offer"], inst["supervisor_process"]["source_ids"],
                dates, ids, note))
    return p


def build_faculty(hk, ust, other, sources):
    by_id = {s["id"]: s for s in sources}
    result = []
    for raw in hk["faculty"]:
        uid = "hku" if raw["university"] == "HKU" else "cuhk"
        ids = raw["source_ids"]
        result.append({"id": raw["id"], "universityId": uid, "name": raw["name"], "department": raw["unit"],
            "topics": topics(raw["research_keywords_zh"]), "summary": "、".join(raw["research_keywords_zh"]) + "。方向已核，当前招生名额未知。",
            "researchKeywords": raw["research_keywords_zh"], "keywordSourceIds": [ids[0]],
            "profileUrl": by_id[ids[0]]["url"], "sourceIds": ids,
            "availability": {"state": "unknown", "text": "未核到明确当前学年的招生名额；研究方向和职务不代表有空位。", "cycle": None, "sourceIds": ids}})
    for raw in ust["faculty_candidates"]:
        ids = raw["sources"]
        advertised = raw["id"] == "lingjie-duan"
        result.append({"id": raw["id"], "universityId": "hkust" if raw["institution"] == "HKUST" else "hkustgz",
            "name": raw["name"], "department": "A2E实验室；具体申请学域需另行确认" if advertised else raw["unit"], "topics": topics(raw["fit_keywords"]),
            "summary": "主页提到的方向包括：" + "、".join(topics(raw["fit_keywords"])) + "。可以先读主页了解，是否招人还需要另外确认。",
            "researchKeywords": raw["fit_keywords"], "keywordSourceIds": [ids[0]],
            "profileUrl": by_id[ids[0]]["url"], "sourceIds": ids,
            "availability": {"state": "advertised" if advertised else "unknown",
                "text": "公告公开征集2026、2027申请；不代表仍有余位，也不改写为2027/28已确认。" if advertised else "没有核实当前学年的可用名额；未注明年份的招收文字仍保留未知。",
                "cycle": "2026 / 2027（公告原用语）" if advertised else None, "sourceIds": ids}})
    mapping = {"polyu-hong-kong": "polyu", "cityu-hong-kong": "cityu", "cuhk-shenzhen": "cuhksz"}
    for inst in other["institutions"]:
        for raw in inst["faculty"]:
            result.append({"id": raw["source_ids"][0], "universityId": mapping[inst["id"]],
                "name": raw["name_en"] + " / " + raw["name_zh"], "department": raw["affiliation_verified"],
                "topics": topics(raw["keywords_zh"]), "summary": "、".join(raw["keywords_zh"]) + "。" + raw["copy_zh"],
                "researchKeywords": raw["keywords_zh"], "keywordSourceIds": [raw["source_ids"][0]],
                "profileUrl": raw["profile_url"], "sourceIds": raw["source_ids"],
                "availability": {"state": "unknown", "text": raw["copy_zh"], "cycle": None, "sourceIds": raw["source_ids"]}})
    return result


def build_catalog():
    hk, ust, other = [load(name) for name in ("hku-cuhk.json", "hkust.json", "polyu-cityu-cuhksz.json")]
    sources = normalize_sources((hk, ust, other))
    extra = load("faculty-expansion-20261026.json")
    extra_terms = {"polyu-wenhua-chen": ["高级控制", "自主飞行器", "传感融合", "计算机视觉"],
                   "cuhksz-xiaoqiang-ji": ["智能控制系统", "具身智能", "控制理论与AI"]}
    for f in extra["faculty"]:
        f["researchKeywords"] = extra_terms[f["id"]]
        f["keywordSourceIds"] = [f["sourceIds"][0]]
    catalog = {"schemaVersion": 1, "checkedDate": CHECKED, "cycle": CYCLE,
        "universities": UNIVERSITIES, "programs": build_programs(hk, ust, other) + extra["programs"],
        "faculty": build_faculty(hk, ust, other, sources) + extra["faculty"], "sources": sources + extra["sources"],
        "funding": [{"id": "hkpfs-2027", "title": "香港博士研究生奖学金计划：RGC初申请",
            "universities": ["hku", "cuhk", "hkust", "polyu", "cityu"], "degree": "PhD", "cycle": CYCLE,
            "deadline": "2026-12-01T12:00:00+08:00", "sourceIds": ["rgc-hkpfs-2027", "rgc-hkpfs-institutions"],
            "note": "这是RGC初申请，不代替大学正式申请。仅适用于参与大学的博士；不向深圳或广州继承。原页金额属于2026/27，本目录不转作2027/28金额。"}]}
    requirements = load("requirements-20261026.json")
    catalog["sources"].extend(requirements["sources"])
    source_by_id = {s["id"]: s for s in catalog["sources"]}
    for sid, updates in requirements["sourceUpdates"].items():
        source_by_id[sid]["claims"].extend(updates["claims"])
    program_by_id = {p["id"]: p for p in catalog["programs"]}
    for pid, items in requirements["programRequirements"].items():
        program_by_id[pid].setdefault("requirements", []).extend(items)
    for group in requirements["sharedRequirements"]:
        for pid in group["programIds"]:
            items = [{**item, "sourceIds": [group["sourceByProgram"][pid]]} for item in group["items"]]
            program_by_id[pid].setdefault("requirements", []).extend(items)
    costs = load("costs-cie-20261026.json")
    catalog["sources"].extend(costs["sources"])
    for sid, updates in costs["sourceUpdates"].items():
        source_by_id[sid]["claims"].extend(updates["claims"])
    for pid, items in costs["programRequirements"].items():
        program_by_id[pid].setdefault("requirements", []).extend(items)
    for pid, items in costs["programFinances"].items():
        program_by_id[pid]["finances"] = items
    for p in catalog["programs"]:
        items = p.get("requirements", []) + p.get("finances", [])
        p["sourceIds"] = list(dict.fromkeys(p["sourceIds"] + [sid for item in items for sid in item["sourceIds"]]))
    wide = load("faculty-wide-20261026.json")
    catalog["sources"].extend(wide["sources"])
    catalog["faculty"].extend(wide["faculty"])
    catalog["directories"] = wide["directories"]
    extended = load("faculty-math-finance-20261026.json")
    catalog["sources"].extend(extended["sources"])
    catalog["faculty"].extend(extended["faculty"])
    catalog["directories"].extend(extended["directories"])
    quantitative = load("quantitative-programmes-20261026.json")
    catalog["directApplicationRoutes"] = quantitative["directApplicationRoutes"]
    catalog["sources"].extend(quantitative["sources"])
    catalog["programs"].extend(quantitative["programs"])
    census = load("hkust-cse-census-20261026.json")
    catalog["sources"].extend(census["sources"])
    faculty_by_id = {f["id"]: f for f in catalog["faculty"]}
    for row in census["faculty"]:
        if row["id"] in faculty_by_id:
            faculty_by_id[row["id"]].update(row)
        else:
            catalog["faculty"].append(row)
    catalog["directories"].append(census["directory"])
    academic_map = load("university-academic-map-20261026.json")
    catalog["sources"].extend(academic_map["sources"])
    catalog["academicCoverage"] = academic_map["universities"]
    reviewed = load("reviewed-directory-profiles-20261026.json")
    catalog["sources"].extend(reviewed["sources"])
    catalog["faculty"].extend(reviewed["faculty"])
    by_id = {f["id"]: f for f in catalog["faculty"]}
    for update in reviewed["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        for field in ("academicUnitIds", "directoryRole", "identityNote", "reviewedProfileUrl"):
            old[field] = update[field]
        for link in old.get("extraLinks", []):
            if link["url"] == update["reviewedProfileUrl"]:
                link.update(bodyStatus="body_read", sourceId=update["sourceIds"][0])
    reviews = {r["url"]: r for r in reviewed["profileReviews"]}
    for overview in catalog["academicCoverage"]:
        for unit in overview["units"]:
            for entry in unit["staffEntries"]:
                for lead in entry.get("profileLeads", []):
                    review = reviews[lead["url"]]
                    lead.update(profileBodyStatus=review["profileBodyStatus"], bodySha256=review["bodySha256"],
                                researchReviewStatus=review["researchReviewStatus"], facultyId=review["facultyId"])
    entry_progress = load("academic-entry-progress-20261026.json")
    catalog["sources"].extend(entry_progress["sources"])
    entry_by_url = {row["url"]: row for row in entry_progress["entries"]}
    catalog["academicEntryProgress"] = entry_progress["counts"]
    for overview in catalog["academicCoverage"]:
        for unit in overview["units"]:
            for child in unit["children"]:
                row = entry_by_url.get((child.get("url") or "").split("#", 1)[0])
                if row:
                    child.update(entryBodyStatus=row["bodyStatus"], sourceIds=row["sourceIds"],
                                 bodySha256=row["bodySha256"], retrievedUrl=row["retrievedUrl"],
                                 staffRoutes=row["staffRoutes"], failure=row["failure"])
    cityu = load("cityu-ds-reviewed-20261026.json")
    catalog["sources"].extend(cityu["sources"])
    catalog["faculty"].extend(cityu["faculty"])
    for update in cityu["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        old.update(directoryRole=update["directoryRole"], identityNote=update["identityNote"])
    directory = next(d for d in catalog["directories"] if d["id"] == cityu["directoryUpdate"]["id"])
    directory["sourceIds"].extend(cityu["directoryUpdate"]["sourceIds"])
    directory["coverageNotes"] = cityu["directoryUpdate"]["coverageNotes"]
    sai = load("cuhksz-sai-census-20261027.json")
    catalog["sources"].extend(sai["sources"])
    catalog["faculty"].extend(sai["faculty"])
    for update in sai["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        old.update(directoryRole=update["directoryRole"], identityNote=update["identityNote"], availability=update["availability"])
        old["extraLinks"] = list({link["url"]: link for link in old.get("extraLinks", []) + update["extraLinks"]}.values())
    directory = next(d for d in catalog["directories"] if d["id"] == sai["directoryUpdate"]["id"])
    directory["sourceIds"].extend(sai["directoryUpdate"]["sourceIds"])
    directory.update({key: value for key, value in sai["directoryUpdate"].items() if key not in {"id", "sourceIds"}})
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cuhksz-8")
    unit["staffEntries"].extend(sai["staffEntries"])
    update = sai["programUpdate"]
    programme = next(p for p in catalog["programs"] if p["id"] == update["id"])
    programme["sourceIds"].extend(update["sourceIds"])
    programme["requirements"].extend(update["requirements"])
    programme.setdefault("finances", []).extend(update["finances"])
    programme["evidenceNote"] = update["evidenceNote"]
    programme["contact"]["sourceIds"].append(update["applicationSourceId"])
    for entry_deadline in programme["deadlines"]:
        entry_deadline["sourceIds"].append(update["applicationSourceId"])
    gz = load("hkustgz-function-census-20261027.json")
    catalog["sources"].extend(gz["sources"])
    catalog["faculty"].extend(gz["faculty"])
    for update in gz["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        for field in ("directoryRole", "identityNote", "reviewedProfileUrl", "department"):
            old[field] = update[field]
    catalog["directories"].append(gz["directory"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hkustgz-1")
    unit["staffEntries"].extend(gz["staffEntries"])
    gz_programmes = load("hkustgz-function-programmes-20261027.json")
    catalog["sources"].extend(gz_programmes["sources"])
    catalog["programs"].extend(gz_programmes["programs"])
    cse = load("cuhk-cse-census-20261027.json")
    catalog["sources"].extend(cse["sources"])
    catalog["faculty"].extend(cse["faculty"])
    for update in cse["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        old.update(directoryRole=update["directoryRole"], identityNote=update["identityNote"])
        old["extraLinks"] = list({link["url"]: link for link in old.get("extraLinks", []) + update["extraLinks"]}.values())
    directory = next(d for d in catalog["directories"] if d["id"] == cse["directoryUpdate"]["id"])
    directory["sourceIds"].extend(cse["directoryUpdate"]["sourceIds"])
    directory.update({k: v for k, v in cse["directoryUpdate"].items() if k not in {"id", "sourceIds"}})
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cuhk-4")
    unit["staffEntries"].extend(cse["staffEntries"])
    hku = load("hku-cds-census-20261027.json")
    catalog["sources"].extend(hku["sources"])
    catalog["faculty"].extend(hku["faculty"])
    for update in hku["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        for field in ("directoryRole", "identityNote", "reviewedProfileUrl", "department", "summary", "applicationNotes"):
            old[field] = update[field]
        old["extraLinks"] = list({link["url"]: link for link in old.get("extraLinks", []) + update["extraLinks"]}.values())
    directory = next(d for d in catalog["directories"] if d["id"] == hku["directoryUpdate"]["id"])
    directory["sourceIds"].extend(hku["directoryUpdate"]["sourceIds"])
    directory.update({k: v for k, v in hku["directoryUpdate"].items() if k not in {"id", "sourceIds"}})
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hku-6")
    unit["staffEntries"].extend(hku["staffEntries"])
    catalog["programs"].extend(hku["programmes"])
    polyu = load("polyu-fcms-census-20261027.json")
    catalog["sources"].extend(polyu["sources"])
    catalog["faculty"].extend(polyu["faculty"])
    for update in polyu["facultyUpdates"]:
        old = by_id[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords", "topics", "directorySourceIds", "academicUnitIds"):
            old[field] = list(dict.fromkeys(old.get(field, []) + update[field]))
        for field in ("directoryRole", "identityNote", "reviewedProfileUrl", "department", "summary", "applicationNotes"):
            if field in update:
                old[field] = update[field]
        old["extraLinks"] = list({(link["url"], link["parentSourceId"]): link for link in old.get("extraLinks", []) + update["extraLinks"]}.values())
    for update in polyu["directoryUpdates"]:
        directory = next((d for d in catalog["directories"] if d["id"] == update["id"]), None)
        if directory is None:
            catalog["directories"].append(update)
        else:
            directory["sourceIds"].extend(update["sourceIds"])
            directory.update({k: v for k, v in update.items() if k not in {"id", "sourceIds"}})
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "polyu-2")
    unit["staffEntries"].extend(polyu["staffEntries"])
    catalog["programs"].extend(polyu["programmes"])
    for update in polyu["programmeUpdates"]:
        old = next(p for p in catalog["programs"] if p["id"] == update["id"])
        old.update(update)
    cbe = load("hkust-cbe-census-20261027.json")
    catalog["sources"].extend(cbe["sources"])
    catalog["faculty"].extend(cbe["faculty"])
    for update in cbe["facultyUpdates"]:
        previous = by_id[update["id"]]
        previous.update(update)
    catalog["directories"].extend(cbe["directories"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hkust-2")
    unit["staffEntries"].extend(cbe["staffEntries"])
    catalog["programs"].extend(cbe["programmes"])
    dao = load("cityu-dao-census-20261028.json")
    catalog["sources"].extend(dao["sources"])
    catalog["faculty"].extend(dao["faculty"])
    catalog["directories"].extend(dao["directories"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cityu-2")
    unit["staffEntries"].extend(dao["staffEntries"])
    sme = load("cuhksz-sme-census-20261028.json")
    catalog["sources"].extend(sme["sources"])
    catalog["faculty"].extend(sme["faculty"])
    catalog["directories"].extend(sme["directories"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cuhksz-1")
    unit["staffEntries"].extend(sme["staffEntries"])
    catalog["programs"].extend(sme["programmes"])
    dase = load("hku-dase-census-20261028.json")
    catalog["sources"].extend(dase["sources"])
    catalog["faculty"].extend(dase["faculty"])
    catalog["directories"].extend(dase["directories"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hku-6")
    unit["staffEntries"].extend(dase["staffEntries"])
    catalog["programs"].extend(dase["programmes"])
    seem = load("cuhk-seem-census-20261028.json")
    catalog["sources"].extend(seem["sources"])
    catalog["faculty"].extend(seem["faculty"])
    catalog["directories"].extend(seem["directories"])
    unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cuhk-4")
    unit["staffEntries"].extend(seem["staffEntries"])
    catalog["programs"].extend(seem["programmes"])
    physics = load("hkust-physics-census-20261028.json")
    catalog["sources"].extend(physics["sources"])
    catalog["faculty"].extend(physics["faculty"])
    catalog["directories"].extend(physics["directories"])
    catalog["programs"].extend(physics["programmes"])
    science_unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hkust-1")
    science_unit["staffEntries"].extend(physics["staffEntries"])
    science_unit["children"].extend(physics["unitChildren"])
    mathematics = load("hkust-math-census-20261028.json")
    catalog["sources"].extend(mathematics["sources"])
    catalog["faculty"].extend(mathematics["faculty"])
    catalog["directories"].extend(mathematics["directories"])
    science_unit["staffEntries"].extend(mathematics["staffEntries"])
    bme = load("cuhk-bme-census-20261028.json")
    catalog["sources"].extend(bme["sources"])
    catalog["faculty"].extend(bme["faculty"])
    catalog["directories"].extend(bme["directories"])
    catalog["programs"].extend(bme["programmes"])
    engineering_unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cuhk-4")
    engineering_unit["staffEntries"].extend(bme["staffEntries"])
    chemistry = load("hkust-chemistry-census-20261028.json")
    catalog["sources"].extend(chemistry["sources"])
    catalog["faculty"].extend(chemistry["faculty"])
    catalog["directories"].extend(chemistry["directories"])
    catalog["programs"].extend(chemistry["programmes"])
    science_unit["staffEntries"].extend(chemistry["staffEntries"])
    mechanical = load("hku-mechanical-census-20261029.json")
    catalog["sources"].extend(mechanical["sources"])
    catalog["faculty"].extend(mechanical["faculty"])
    catalog["directories"].extend(mechanical["directories"])
    catalog["programs"].extend(mechanical["programmes"])
    hku_engineering = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "hku-6")
    hku_engineering["staffEntries"].extend(mechanical["staffEntries"])
    cityu_ee = load("cityu-ee-census-20261029.json")
    catalog["sources"].extend(cityu_ee["sources"])
    catalog["faculty"].extend(cityu_ee["faculty"])
    catalog["directories"].extend(cityu_ee["directories"])
    catalog["programs"].extend(cityu_ee["programmes"])
    polyu_cee = load("polyu-cee-census-20261029.json")
    catalog["sources"].extend(polyu_cee["sources"])
    catalog["faculty"].extend(polyu_cee["faculty"])
    catalog["directories"].extend(polyu_cee["directories"])
    catalog["programs"].extend(polyu_cee["programmes"])
    construction = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "polyu-3")
    construction["staffEntries"].extend(polyu_cee["staffEntries"])
    cityu_engineering = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == "cityu-4")
    cityu_engineering["staffEntries"].extend(cityu_ee["staffEntries"])
    college_review = load("college-priority-20261029.json")
    catalog["sources"].extend(college_review["sources"])
    for review in college_review["reviews"]:
        overview = next(m for m in catalog["academicCoverage"] if m["universityId"] == review["universityId"])
        overview["listReview"] = review
        overview["note"] = review["scopeNote"]
        overview["sourceIds"] = review["sourceIds"]
        if review.get("reportedCounts"):
            overview["reportedCounts"] = review["reportedCounts"]
    child_inventory = load("child-unit-inventory-20261029.json")
    catalog["sources"].extend(child_inventory["sources"])
    for reviewed in child_inventory["units"]:
        unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == reviewed["unitId"])
        unit["children"] = reviewed["children"]
        unit["childInventoryReview"] = {key: reviewed[key] for key in ("checkedAt", "sourceIds", "summary")}
        unit["childInventoryReview"].update(status="observed_parent_list_matched", observedChildren=len(reviewed["children"]), facultyComplete=False)
        unit["relatedTeachingEntries"] = reviewed["relatedEntries"]
    deferred_organization_sources = []
    for organization_path in ("organization-scope-20261029.json", "stem-college-structure-20261029.json", "college-batch-hierarchy-20261029.json", "scope-clarifications-20261102.json", "college-deep-scope-20261102.json", "college-models-20261104.json", "law-business-organization-20261105.json", "science-interdisciplinary-scopes-20261105.json", "college-links-programmes-20261105.json", "cuhksz-med-organization-routes-20261109.json"):
        organization = load(organization_path)
        if organization.get("appendSourcesAfterExisting"):
            deferred_organization_sources.extend(organization["sources"])
        else:
            catalog["sources"].extend(organization["sources"])
        reused_ids = set(organization.get("reusedSourceIds", []))
        organization_sources = {s["id"]: s for s in catalog["sources"] if s["id"] in reused_ids}
        assert set(organization_sources) == reused_ids, "Reused structure sources must already exist"
        organization_sources.update({s["id"]: s for s in organization["sources"]})
        for reviewed in organization["units"]:
            unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == reviewed["unitId"])
            entry_source = organization_sources[reviewed["entrySourceId"]]
            if reviewed.get("updateEntry", True):
                if unit.get("accessNote"):
                    unit["previousAccessNote"] = {"checkedAt": load("university-academic-map-20261026.json")["checkedAt"], "text": unit["accessNote"]}
                    unit["accessNote"] = reviewed["organizationReview"]["checkedAt"] + "已读到本次入口正文；2026-10-26的读取问题另作历史保留，不代表本次仍读取失败。"
                unit.update(entryBodyStatus="body_read", sourceIds=list(dict.fromkeys(unit["sourceIds"] + [entry_source["id"]])),
                            url=entry_source["url"], readMethod="anonymous_HTTP", bodySha256=reviewed["entryBodySha256"], retrievedUrl=reviewed["retrievedUrl"])
            if reviewed.get("appendPriorReview"):
                unit.setdefault("organizationReviewHistory", []).append(unit["organizationReview"])
            if reviewed.get("preservePriorReview"):
                unit["priorOrganizationReview"] = unit["organizationReview"]
            unit.update(organizationReview=reviewed["organizationReview"], relatedNavigationGroups=reviewed["navigationGroups"])
            if "reviewedNavigation" in reviewed:
                unit["reviewedNavigation"] = reviewed["reviewedNavigation"]
            if "children" in reviewed:
                unit["children"] = reviewed["children"]
            for entry in reviewed.get("staffEntries", []):
                if not any(old["url"] == entry["url"] for old in unit["staffEntries"]):
                    unit["staffEntries"].append(entry)
    access = load("entry-access-review-20261027.json")
    failed = {row["url"]: row for row in access["entries"]}
    corrected_sources = {sid for row in access["entries"] for sid in row["sourceIds"]}
    for source in catalog["sources"]:
        if source["id"] in corrected_sources:
            assert source["bodySha256"] == access["responseSha256"]
            source.update(evidenceLevel="official_entry_access_failed", title="未读到正文 · " + source["title"],
                          scope=access["failure"], claims=[access["failure"]], responseKind="access_challenge",
                          classificationReviewedAt=access["reviewedAt"])
            source["knownIssues"].append("原核查日期保留；2026-10-27根据已存响应摘要纠正分类，不是重新核实院系正文。")
    for overview in catalog["academicCoverage"]:
        for unit in overview["units"]:
            for child in unit["children"]:
                if child.get("url") in failed:
                    assert child["bodySha256"] == access["responseSha256"]
                    child.update(entryBodyStatus="access_failed", responseKind="access_challenge", failure=access["failure"],
                                 classificationReviewedAt=access["reviewedAt"])
    catalog["academicEntryProgress"].update(childBodiesRead=entry_progress["counts"]["childBodiesRead"]-len(failed),
                                          childFailures=entry_progress["counts"]["childFailures"]+len(failed),
                                          knownAccessChallenges=len(failed))
    for supplied_path in ("provided-college-entries-20261104.json", "law-business-organization-20261105.json"):
        for supplied in load(supplied_path)["entries"]:
            unit = next(u for m in catalog["academicCoverage"] for u in m["units"] if u["id"] == supplied["unitId"])
            child = next(c for c in unit["children"] if c["name"] == supplied["childName"])
            entries = child.setdefault("providedEntries", [])
            assert not any(e["url"] == supplied["entry"]["url"] for e in entries), "Duplicate supplied entrance"
            entries.append(supplied["entry"])
    institutional = load("institution-references-20261104.json")
    catalog["sources"].extend(institutional["sources"])
    for reference in institutional["references"]:
        overview = next(m for m in catalog["academicCoverage"] if m["universityId"] == reference["universityId"])
        overview.setdefault("institutionalReferences", []).append(reference)
    followups = load("unit-entry-followups-20261104.json")
    catalog["sources"].extend(followups["sources"])
    catalog["academicEntryFollowups"] = followups["entries"]
    catalog["sources"].extend(deferred_organization_sources)
    science_queue = load("hku-science-unit-queue-20261105.json")
    catalog["sources"].extend(science_queue["sources"])
    catalog["academicEntryFollowups"].extend(science_queue["entries"])
    catalog["directories"].extend(science_queue["directories"])
    cuhk_science = load("cuhk-science-unit-entrances-20261105.json")
    catalog["sources"].extend(cuhk_science["sources"])
    catalog["academicEntryFollowups"].extend(cuhk_science["entries"])
    stem_queue = load("stem-unit-queue-20261105.json")
    catalog["sources"].extend(stem_queue["sources"])
    catalog["academicEntryFollowups"].extend(stem_queue["entries"])
    catalog["academicUnitNotes"] = stem_queue["academicUnitNotes"]
    architecture = load("hku-architecture-unit-entrances-20261105.json")
    catalog["sources"].extend(architecture["sources"])
    catalog["academicEntryFollowups"].extend(architecture["entries"])
    ais = load("hkust-ais-unit-entrances-20261105.json")
    catalog["sources"].extend(ais["sources"])
    catalog["academicEntryFollowups"].extend(ais["entries"])
    medicine_and_environment = load("cuhk-medicine-envr-entrances-20261106.json")
    catalog["sources"].extend(medicine_and_environment["sources"])
    catalog["academicEntryFollowups"].extend(medicine_and_environment["entries"])
    catalog["academicChildDocuments"] = [medicine_and_environment["childDocument"]]
    structures = load("medicine-environment-structure-20261106.json")
    catalog["sources"].extend(structures["sources"])
    catalog["academicChildDocuments"].extend(structures["documents"])
    polyu_september = load("polyu-sept-2027-programmes-20261106.json")
    catalog["sources"].extend(polyu_september["sources"])
    catalog["programs"].extend(polyu_september["programmes"])
    hku_materials = load("hku-materials-energy-20261106.json")
    catalog["sources"].extend(hku_materials["sources"])
    catalog["academicChildDocuments"].extend(hku_materials["documents"])
    polyu_science = load("polyu-science-sept-2027-20261106.json")
    catalog["sources"].extend(polyu_science["sources"])
    catalog["programs"].extend(polyu_science["programmes"])
    for name in ("cuhk-zhizhen-establishment-20261106.json", "hkust-medicine-scope-20261106.json",
                 "hkustgz-cft-establishment-20261106.json"):
        scope = load(name)
        catalog["sources"].extend(scope["sources"])
        unit = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == scope["unitId"])
        unit["organizationReview"]["sourceIds"].extend(source["id"] for source in scope["sources"])
        unit.setdefault("reviewedNavigation", []).extend(scope["reviewedNavigation"])
    cityu_report = load("cityu-annual-report-scope-20261106.json")
    catalog["sources"].extend(cityu_report["sources"])
    cityu_overview = next(row for row in catalog["academicCoverage"] if row["universityId"] == "cityu")
    cityu_overview.setdefault("institutionalReferences", []).extend(cityu_report["references"])
    sse_routes = load("cuhksz-sse-research-routes-20261106.json")
    catalog["sources"].extend(sse_routes["sources"])
    catalog["programs"].extend(sse_routes["programmes"])
    catalog["programs"].extend(load("cuhksz-med-organization-routes-20261109.json")["programmes"])
    polyu_me = load("polyu-me-census-20261107.json")
    catalog["sources"].extend(polyu_me["sources"])
    catalog["faculty"].extend(polyu_me["faculty"])
    catalog["directories"].extend(polyu_me["directories"])
    catalog["programs"].extend(polyu_me["programmes"])
    engineering = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == "polyu-4")
    engineering["staffEntries"].extend(polyu_me["staffEntries"])
    materials = load("hkust-materials-portal-20261107.json")
    catalog["sources"].extend(materials["sources"])
    catalog["faculty"].extend(materials["faculty"])
    catalog["directories"].extend(materials["directories"])
    engineering = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == materials["unitId"])
    engineering["organizationReview"]["sourceIds"].append(materials["sources"][0]["id"])
    engineering.setdefault("reviewedNavigation", []).extend(materials["reviewedNavigation"])
    engineering["staffEntries"].extend(materials["staffEntries"])
    physics = load("hku-physics-census-20261107.json")
    catalog["sources"].extend(physics["sources"])
    catalog["faculty"].extend(physics["faculty"])
    directory = next(d for d in catalog["directories"] if d["id"] == physics["directoryUpdate"]["id"])
    assert directory["census"] == physics["directoryUpdate"]["priorCensus"]
    directory.setdefault("censusHistory", []).append({
        "batch": "hku-physics-census-20261107",
        "census": directory["census"], "coverageNotes": directory["coverageNotes"]})
    directory["census"] = physics["directoryUpdate"]["census"]
    directory["coverageNotes"] = physics["directoryUpdate"]["coverageNotes"]
    science = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == physics["unitId"])
    science["staffEntries"].append(physics["staffEntry"])
    science["organizationReview"]["sourceIds"].append("hku-physics-rpg-scope-20261107")
    science.setdefault("reviewedNavigation", []).extend(physics["reviewedNavigation"])
    medicine = load("cuhk-medical-unit-scope-20261107.json")
    catalog["sources"].extend(medicine["sources"])
    unit = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == medicine["unitId"])
    unit["organizationReview"]["sourceIds"].extend(s["id"] for s in medicine["sources"])
    unit.setdefault("relatedNavigationGroups", []).append(medicine["navigationGroup"])
    unit.setdefault("reviewedNavigation", []).extend(medicine["reviewedNavigation"])
    robotics = load("hkustgz-roas-census-20261107.json")
    catalog["sources"].extend(robotics["sources"])
    faculty_by_id = {f["id"]: f for f in catalog["faculty"]}
    for update in robotics["facultyUpdates"]:
        faculty = faculty_by_id[update["id"]]
        assert faculty["universityId"] == "hkustgz", "Keep campus records separate"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            faculty[field] = list(dict.fromkeys(faculty.get(field, []) + update[field]))
        for field in ("reviewedProfileUrl", "directoryRole", "identityNote", "role"):
            if update[field]:
                faculty[field] = update[field]
        links = faculty.setdefault("extraLinks", [])
        for link in update["extraLinks"]:
            if not any(old["url"] == link["url"] for old in links):
                links.append(link)
    catalog["faculty"].extend(robotics["faculty"])
    catalog["directories"].append(robotics["directory"])
    systems = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == robotics["unitId"])
    systems["staffEntries"].append(robotics["staffEntry"])
    systems["organizationReview"]["sourceIds"].extend(route["sourceId"] for route in robotics["reviewedNavigation"])
    systems.setdefault("reviewedNavigation", []).extend(robotics["reviewedNavigation"])
    sse_staff = load("cuhksz-sse-staff-20261107.json")
    catalog["sources"].extend(sse_staff["sources"])
    catalog["directories"].append(sse_staff["directory"])
    sse = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == sse_staff["unitId"])
    old_staff = sse["staffEntries"]
    assert {entry["url"] for entry in old_staff} == {sse_staff["staffEntry"]["url"], sse_staff["nonStaffEntryUrl"]}
    # The second old entry is a doctoral student list, not an additional staff roster.
    sse["staffEntries"] = [sse_staff["staffEntry"]]
    design = load("polyu-design-application-20261107.json")
    catalog["sources"].append(design["source"])
    design_unit = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == design["unitId"])
    design_unit["organizationReview"]["sourceIds"].append(design["source"]["id"])
    design_unit.setdefault("reviewedNavigation", []).append(design["navigation"])
    design_program = next(p for p in catalog["programs"] if p["id"] == design["programId"])
    design_program["sourceIds"].append(design["source"]["id"])
    assert design_program["requirements"][0]["label"] == design["requirementUpdates"][1]["label"]
    design_program["requirements"][:1] = design["requirementUpdates"]
    sse_stem = load("cuhksz-sse-stem-20261107.json")
    assert sse_stem["unitId"] == sse["id"]
    catalog["sources"].extend(sse_stem["sources"])
    for update in sse_stem["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "cuhksz", "Keep campus records separate"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    catalog["faculty"].extend(sse_stem["faculty"])
    lead_by_url = {lead["url"]: lead for lead in sse["staffEntries"][0]["profileLeads"]}
    for update in sse_stem["leadUpdates"]:
        lead_by_url[update["url"]].update(update)
    unit_routes = load("official-unit-route-evidence-20261107.json")
    catalog["sources"].extend(unit_routes["sources"])
    information = next(u for row in catalog["academicCoverage"] for u in row["units"] if u["id"] == "hkustgz-2")
    information["organizationReview"]["sourceIds"].extend(unit_routes["information"]["organizationSourceIds"])
    information["relatedNavigationGroups"].extend(unit_routes["information"]["navigationGroups"])
    information["staffEntries"].extend(unit_routes["information"]["staffEntries"])
    cityu_overview["institutionalReferences"].append(unit_routes["cityuReference"])
    cma = load("hkustgz-cma-reviewed-20261108.json")
    catalog["sources"].extend(cma["sources"])
    catalog["faculty"].extend(cma["faculty"])
    information["staffEntries"].append(cma["staffEntry"])
    information["relatedNavigationGroups"].append(cma["navigationGroup"])
    hku_chemistry = load("hku-chemistry-roster-20261108.json")
    catalog["sources"].extend(hku_chemistry["sources"])
    catalog["faculty"].extend(hku_chemistry["faculty"])
    chemistry_directory = next(d for d in catalog["directories"] if d["id"] == hku_chemistry["directoryId"])
    chemistry_directory["reviewSourceIds"] = [s["id"] for s in hku_chemistry["sources"]]
    updates = {r["name"]: r for r in hku_chemistry["directoryUpdates"]}
    for card in chemistry_directory["census"]["unlinkedEntries"]:
        card.update(updates[card["name"]])
    existing = next(f for f in catalog["faculty"] if f["id"] == hku_chemistry["existingFacultyId"])
    chemistry_source = hku_chemistry["faculty"][0]["directoryEvidenceSourceId"]
    existing["sourceIds"].append(chemistry_source)
    existing["academicUnitIds"] = list(dict.fromkeys(existing.get("academicUnitIds", []) + ["hku-9"]))
    life_sciences = load("cuhk-life-sciences-20261108.json")
    catalog["sources"].extend(life_sciences["sources"])
    catalog["faculty"].extend(life_sciences["faculty"])
    catalog["directories"].extend(life_sciences["directories"])
    life_unit = next(e for e in catalog["academicEntryFollowups"] if e["url"] == "http://www.cuhk.edu.hk/lifesciences")
    directories_by_url = {d["url"]: d for d in life_sciences["directories"]}
    for entry in life_unit["nextEntries"]:
        if entry["url"] in directories_by_url:
            directory = directories_by_url[entry["url"]]
            entry.update(bodyStatus="body_read", sourceIds=directory["sourceIds"], directoryId=directory["id"])
        elif entry["url"] == life_sciences["unitGuideUrl"]:
            entry.update(bodyStatus="body_read", sourceIds=[life_sciences["unitGuideSourceId"]])
    physics_materials = load("polyu-pm-20261109.json")
    catalog["sources"].extend(physics_materials["sources"])
    catalog["faculty"].extend(physics_materials["faculty"])
    catalog["directories"].extend(physics_materials["directories"])
    sse_continuation = load("cuhksz-sse-continuation-20261109.json")
    catalog["sources"].extend(sse_continuation["sources"])
    catalog["faculty"].extend(sse_continuation["faculty"])
    for update in sse_continuation["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "cuhksz"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    for update in sse_continuation["leadUpdates"]:
        lead_by_url[update["url"]].update(update)
    sse_roles = load("cuhksz-sse-roles-20261111.json")
    catalog["sources"].extend(sse_roles["sources"])
    catalog["faculty"].extend(sse_roles["faculty"])
    for update in sse_roles["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "cuhksz"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    for update in sse_roles["leadUpdates"]:
        lead_by_url[update["url"]].update(update)
    ieda = load("hkust-ieda-20261109.json")
    catalog["sources"].extend(ieda["sources"])
    catalog["faculty"].extend(ieda["faculty"])
    catalog["directories"].extend(ieda["directories"])
    for update in ieda["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "hkust"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]

    ieda_source = ["hkust-ieda-20261109-programme"]
    ieda_programme = program(
        "hkust-ieda-rpg", "hkust", "工业工程及决策分析研究学位", ["MPhil", "PhD"],
        "港科大香港校区，设全日制及兼读。2027 年 9 月秋季和 2 月春季分列。",
        "unknown", "可先在学系目录了解老师的研究方向。", ieda_source,
        "官网列明滚动审理。", ieda_source,
        [deadline("秋季非本地申请截止", "2027-06-01", ieda_source),
         deadline("秋季本地申请截止", "2027-07-15", ieda_source),
         deadline("春季非本地申请截止", "2026-11-01", ieda_source, route="春季申请", cycle="2026/27 Spring"),
         deadline("春季本地申请截止", "2026-12-15", ieda_source, route="春季申请", cycle="2026/27 Spring")],
        ieda_source, "2027/28 项目页也列上一学年春季（2027 年 2 月入学）；春秋截止日期分别适用。")
    ieda_programme.update(
        entryUrl="https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-ieda",
        researchKeywords=["工业工程", "决策分析", "运筹学", "Industrial Engineering", "Decision Analytics", "IEDA", "Operations Research"],
        requirements=[
            {"label": "MPhil 学历要求", "text": "认可院校的学士学位，或认可的同等学历。", "degrees": ["MPhil"], "sourceIds": ieda_source},
            {"label": "PhD 学历要求", "text": "认可院校的学士学位且表现优异，或有至少一年全日制或两年兼读的合格研究生阶段学习经历。", "degrees": ["PhD"], "sourceIds": ieda_source},
            {"label": "英语要求", "text": "雅思学术类总分至少 6.5，单项至少 5.5。TOEFL iBT 在 2026 年 1 月 21 日前考试为至少 80 分，当天起为至少 4.5 分。须单次达标，不接受居家考试。第一语言为英语，或学士及同等学历的授课语言为英语，可免交上述成绩。", "sourceIds": ieda_source},
        ],
        finances=[{"id": "hkust-ieda-application-fee", "kind": "application_fee", "label": "申请费",
                   "text": "每份申请 180 港元。", "action": "提交网上申请时查看缴费步骤。", "sourceIds": ieda_source,
                   "rates": [{"value": 180, "currency": "HKD", "unit": "application", "basis": "academic_year",
                              "cycle": "2027/28", "condition": "项目页所列申请费"}]}],
    )
    catalog["programs"].append(ieda_programme)

    chemistry = load("cuhk-chemistry-20261109.json")
    catalog["sources"].extend(chemistry["sources"])
    catalog["faculty"].extend(chemistry["faculty"])
    catalog["directories"].extend(chemistry["directories"])
    chemistry_unit = next(e for e in catalog["academicEntryFollowups"] if e["url"] == "http://www.chem.cuhk.edu.hk/")
    chemistry_directories = {d["url"]: d for d in chemistry["directories"]}
    for entry in chemistry_unit["nextEntries"]:
        directory = chemistry_directories.get(entry["url"])
        if directory:
            entry.update(bodyStatus="body_read", sourceIds=directory["sourceIds"], directoryId=directory["id"])
        elif entry["url"] == "https://chem.cuhk.edu.hk/postgraduate/mphil-phd/":
            entry.update(bodyStatus="body_read", sourceIds=["cuhk-chemistry-20261109-department-programme"])
    support_directory = chemistry["directories"][2]
    chemistry_unit["nextEntries"].append({
        "label": "支援人员", "url": support_directory["url"], "bodyStatus": "body_read",
        "sourceIds": support_directory["sourceIds"], "directoryId": support_directory["id"],
        "availability": "unknown", "supervisionEligibility": "unknown",
    })

    chemistry_gs = ["cuhk-chemistry-20261109-graduate-school"]
    chemistry_sources = chemistry_gs + ["cuhk-chemistry-20261109-department-programme"]
    chemistry_programme = program(
        "cuhk-chemistry-rpg", "cuhk", "化学研究学位", ["MPhil", "PhD"],
        "港中文香港校本部，2027/28 学年。方向包括分析与环境化学、无机、有机、物理、化学生物学与材料科学。",
        "unknown", "可先通过化学系目录了解课题组。", chemistry_sources,
        "清理轮只在有学额时审理。", chemistry_gs,
        [deadline("主轮截止", "2026-12-01", chemistry_gs),
         deadline("清理轮截止（如仍有学额）", "2027-03-31", chemistry_gs)],
        chemistry_sources, "常规轮日期取自研究院化学项目页。学系页提供研究方向及培养要求。")
    chemistry_programme.update(
        entryUrl="https://www.gs.cuhk.edu.hk/programmes/science/mphil-phd-chemistry",
        requirements=[
            {"label": "专业背景", "text": "申请人须主修化学或相关学科，并满足研究院的通用入学要求。",
             "action": "在研究院项目页打开通用入学要求，核对学位及英语证明。", "sourceIds": chemistry_gs},
        ],
        finances=[{"id": "cuhk-chemistry-tuition", "kind": "tuition", "label": "学费",
                   "text": "2027/28 学年每年 49,500 港元，全日制和兼读相同。",
                   "action": "符合本地全日制研究生身份时，可在项目页查看学费豁免。", "sourceIds": chemistry_sources,
                   "rates": [{"value": 49500, "currency": "HKD", "unit": "academic_year", "basis": "academic_year",
                              "cycle": "2027/28", "condition": "全日制与兼读"}]}],
    )
    catalog["programs"].append(chemistry_programme)

    iot = load("hkustgz-iot-20261109.json")
    catalog["sources"].extend(iot["sources"])
    catalog["faculty"].extend(iot["faculty"])
    catalog["directories"].extend(iot["directories"])
    information["relatedNavigationGroups"].append(iot["navigationGroup"])
    for update in iot["facultyUpdates"]:
        original = next(f for f in catalog["faculty"] if f["id"] == update["id"])
        assert original["universityId"] == "hkustgz"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    polyu_chemistry = load("polyu-chemistry-20261109.json")
    catalog["sources"].extend(polyu_chemistry["sources"])
    catalog["faculty"].extend(polyu_chemistry["faculty"])
    catalog["directories"].extend(polyu_chemistry["directories"])
    polyu_chemistry_programme = next(p for p in catalog["programs"] if p["id"] == "polyu-chem-rpg-sept-2027")
    polyu_chemistry_programme["sourceIds"].extend([
        "polyu-chemistry-20261109-sept-supervisors", "polyu-chemistry-20261109-department-programme",
    ])
    earth = load("hku-earth-20261109.json")
    catalog["sources"].extend(earth["sources"])
    catalog["faculty"].extend(earth["faculty"])
    earth_directory = next(d for d in catalog["directories"] if d["id"] == earth["directories"][0]["id"])
    earth_directory.clear()
    earth_directory.update(earth["directories"][0])
    catalog["directories"].extend(earth["directories"][1:])
    for update in earth["facultyUpdates"]:
        original = next(f for f in catalog["faculty"] if f["id"] == update["id"])
        assert original["universityId"] == "hku"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        original.setdefault("extraLinks", []).extend(update["extraLinks"])
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]

    earth_application = ["hku-earth-20261109-apply"]
    hku_period = ["HKU-CENTRAL-PERIOD"]
    earth_programme = program(
        "hku-earth-rpg", "hku", "地球与行星科学研究学位", ["MPhil", "PhD"],
        "港大地球与行星科学系。可了解地球演化、气候、行星与太空、地质及水文等方向。",
        "required", "提交申请前须联系意向导师，讨论课题和接收安排。", earth_application,
        "可向学系确认审核安排。", earth_application,
        [deadline("校级主轮截止", "2026-12-01", hku_period, clock="23:59"),
         deadline("校级第一轮补录截止", "2027-04-30", hku_period, clock="23:59"),
         deadline("校级第二轮补录截止", "2027-08-31", hku_period, clock="23:59")],
        earth_application + hku_period, "轮次为港大研究院的校级安排。联系导师与研究计划要求来自学系。")
    earth_programme.update(
        entryUrl="https://www.earthsciences.hku.hk/education/postgraduate_students/research_postgraduates/how_to_apply/",
        requirements=[{"label": "研究计划", "text": "随申请提交研究计划，说明研究重点与开展研究的能力。",
                       "action": "先与意向导师讨论课题，再准备研究计划。", "sourceIds": earth_application}],
    )
    catalog["programs"].append(earth_programme)
    civl = load("hkust-civl-20261109.json")
    catalog["sources"].extend(civl["sources"])
    catalog["faculty"].extend(civl["faculty"])
    catalog["directories"].extend(civl["directories"])
    for update in civl["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "hkust"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]

    civl_admission = ["hkust-civl-20261109-admission"]
    civil_routes = [
        ("civl", "土木工程", "可申请能源技术、纳米技术或科学计算培养方向，网申时选择对应项目选项。"),
        ("evng", "环境工程", "可了解水与废水处理、废物回收、污染土地修复、空气质量和可持续能源。"),
    ]
    for code, subject, detail in civil_routes:
        civil_source = ["hkust-civl-20261109-" + code]
        civil_programme = program(
            "hkust-" + code + "-rpg", "hkust", subject + "研究学位", ["MPhil", "PhD"],
            "港科大香港校区，设全日制与兼读。" + detail,
            "unknown", "网申时填写意向研究方向或教师。", civl_admission,
            "学系根据学习或研究背景及研究计划选出面试人选，申请滚动审理。", civl_admission + civil_source,
            [deadline("秋季非本地申请截止", "2027-06-01", civil_source),
             deadline("秋季本地申请截止", "2027-07-15", civil_source),
             deadline("春季非本地申请截止", "2026-11-01", civil_source, route="春季申请", cycle="2026/27 Spring"),
             deadline("春季本地申请截止", "2026-12-15", civil_source, route="春季申请", cycle="2026/27 Spring")],
            civil_source + civl_admission, "项目页分别列 2027 年 9 月与 2 月入学，非本地兼读限制见原页。")
        civil_programme.update(
            entryUrl="https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-" + code,
            requirements=[
                {"label": "专业背景", "text": "学系通常要求土木工程、环境工程或相关领域的学士背景，并有良好的学业表现。", "sourceIds": civl_admission},
                {"label": "英语要求", "text": "雅思学术类总分至少 6.5，单项至少 5.5。TOEFL iBT 在 2026 年 1 月 21 日前考试至少 80 分，当天起至少 4.5 分。须单次达标，不接受居家考试，豁免条件见项目页。", "sourceIds": civil_source},
            ],
            finances=[{"id": "hkust-" + code + "-application-fee", "kind": "application_fee", "label": "申请费",
                       "text": "每份申请 180 港元。", "action": "提交网申时查看缴费步骤。", "sourceIds": civil_source,
                       "rates": [{"value": 180, "currency": "HKD", "unit": "application", "basis": "academic_year",
                                  "cycle": "2027/28", "condition": "项目页所列申请费"}]}],
        )
        catalog["programs"].append(civil_programme)
    med_faculty = load("cuhksz-med-faculty-20261109.json")
    catalog["sources"].extend(med_faculty["sources"])
    catalog["faculty"].extend(med_faculty["faculty"])
    catalog["directories"].extend(med_faculty["directories"])
    math = load("hku-math-20261109.json")
    catalog["sources"].extend(math["sources"])
    catalog["faculty"].extend(math["faculty"])
    catalog["directories"].extend(math["directories"])
    for update in math["facultyUpdates"]:
        original = faculty_by_id[update["id"]]
        assert original["universityId"] == "hku"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    math_areas = ["hku-math-20261109-graduate-areas"]
    math_apply = ["hku-math-20261109-science-apply"]
    math_faq = ["hku-math-20261109-science-faq"]
    math_programme = program(
        "hku-math-rpg", "hku", "数学研究学位", ["MPhil", "PhD"],
        "香港大学理学院数学系。可从数论、几何、概率、优化与科学计算等方向了解课题。",
        "recommended", "理学院建议先联系意向导师，讨论研究计划。", math_apply,
        "在港大研究院申请系统选择数学系，按理学院清单准备材料。", math_areas + math_apply,
        [deadline("校级主轮截止", "2026-12-01", hku_period, clock="23:59"),
         deadline("校级第一轮补录截止（视余位）", "2027-04-30", hku_period, clock="23:59"),
         deadline("校级第二轮补录截止（视余位）", "2027-08-31", hku_period, clock="23:59")],
        math_areas + math_apply + math_faq + hku_period,
        "日期来自研究院 2027/28 校级安排。系网站所列 2023/24 日期已过。")
    math_programme.update(entryUrl="https://www.scifac.hku.hk/rpg/apply", requirements=[{
        "label": "申请材料", "text": "准备成绩单、学历证明、研究兴趣陈述或研究计划，以及校方要求的推荐材料。",
        "action": "查看理学院材料清单，再与意向导师讨论研究计划。", "sourceIds": math_apply + math_faq}])
    catalog["programs"].append(math_programme)
    ees = load("cuhk-ees-20261110.json")
    catalog["sources"].extend(ees["sources"])
    catalog["faculty"].extend(ees["faculty"])
    catalog["directories"].extend(ees["directories"])
    for update in ees["facultyUpdates"]:
        original = next(row for row in catalog["faculty"] if row["id"] == update["id"])
        assert original["universityId"] == "cuhk"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
        original["identityNote"] = "。".join(filter(None, [original.get("identityNote", "").rstrip("。"), update["additionalAppointment"]])) + "。"

    ees_school = ["cuhk-ees-20261110-graduate-school"]
    ees_department = ["cuhk-ees-20261110-department-programme"]
    ees_sources = ees_school + ees_department
    ees_programme = program(
        "cuhk-ees-rpg", "cuhk", "地球与环境科学研究学位", ["MPhil", "PhD"],
        "港中文香港校本部，2027/28 学年。研究方向包括大气与气候、生物地球化学、大地测量和地震学。",
        "unknown", "可从学系师资名录了解研究方向，再到项目页核对申请流程。", ees_department,
        "学系通常从 2026 年 12 月 2 日前后开始审理。学系说明，常规截止后提交的申请可能无法获考虑资助。", ees_department,
        [deadline("常规申请截止", "2027-01-31", ees_sources),
         deadline("HKPFS 学校完整申请截止", "2026-12-01", ees_school, clock="23:59", degree="PhD", route="HKPFS学校申请")],
        ees_sources, "常规日期、博士 HKPFS 路线及学费来自 2027/28 研究院项目页，并与学系页核对。")
    ees_programme.update(
        entryUrl="https://www.gs.cuhk.edu.hk/programmes/science/mphil-phd-earth-and-environmental-sciences",
        requirements=[
            {"label": "专业背景", "text": "须主修理科、工程或相关学科，并满足研究院通用要求。",
             "action": "从研究院项目页核对学历与语言要求。", "sourceIds": ees_school},
            {"label": "成绩单与推荐信", "text": "学系列明官方成绩单和三封保密推荐信。请核对学系的送件方式与送达日期。",
             "action": "按学系清单安排成绩单与推荐信。", "sourceIds": ees_department},
            {"label": "博士申请材料", "text": "博士申请者还须提交个人陈述和研究计划。个人陈述需写明拟研究的领域和问题。",
             "action": "准备博士申请的个人陈述与研究计划。", "degrees": ["PhD"], "sourceIds": ees_department},
        ],
        finances=[{"id": "cuhk-ees-tuition", "kind": "tuition", "label": "学费",
                   "text": "2027/28 学年每年 49,500 港元，全日制和兼读相同。",
                   "action": "在研究院项目页查看学费说明。", "sourceIds": ees_school,
                   "rates": [{"value": 49500, "currency": "HKD", "unit": "academic_year", "basis": "academic_year",
                              "cycle": "2027/28", "condition": "全日制与兼读"}]}],
    )
    catalog["programs"].append(ees_programme)

    beee = load("polyu-beee-20261110.json")
    catalog["sources"].extend(beee["sources"])
    catalog["faculty"].extend(beee["faculty"])
    catalog["directories"].extend(beee["directories"])
    for update in beee["facultyUpdates"]:
        original = next(row for row in catalog["faculty"] if row["id"] == update["id"])
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
        original["identityNote"] = "港理工建筑环境及能源工程学系个人页列明主聘于该系，同时在化学系任职。"

    beee_page = ["polyu-beee-20261110-programme"]
    beee_finder = ["polyu-beee-20261110-finder"]
    beee_procedure = ["polyu-beee-20261110-procedure"]
    beee_eligibility = ["polyu-beee-20261110-eligibility"]
    beee_programme = program(
        "polyu-beee-rpg-sept-2027", "polyu", "建筑环境及能源工程研究学位", ["MPhil", "PhD"],
        "2027 年 9 月入学，可全日制或兼读。研究方向包括建筑与环境、建筑能源、安全与韧性、建筑电气及设施管理。",
        "recommended", "按校方流程，提交前联系意向导师。提交后把申请编号告知拟任主导师。", beee_procedure + beee_page,
        "网申前核对所有已申报学历的证明。提交后留意补件通知。", beee_page,
        [deadline("学系申请截止", "2027-04-11", beee_page + beee_finder)],
        beee_page + beee_finder + beee_eligibility + beee_procedure + ["polyu-beee-20261110-period"],
        "项目页与校级项目查询均列 4 月 11 日，学系说明逾期不予考虑。")
    beee_programme.update(entryUrl="https://www.polyu.edu.hk/study/pg/rpg/2027/beee", requirements=[
        {"label": "MPhil 学历要求", "text": "须持获认可大学颁发的二等荣誉或以上学士学位，或同等资格。",
         "degrees": ["MPhil"], "sourceIds": beee_eligibility},
        {"label": "博士学历要求", "text": "全日制三年或兼读六年路线通常要求学士和研究型硕士或同等资格。全日制四年或兼读八年路线通常接受硕士加学士，或一等荣誉学士或同等资格。",
         "degrees": ["PhD"], "sourceIds": beee_eligibility},
        {"label": "研究计划与推荐材料", "text": "用 GSB/1A 表格准备研究计划，并安排两份学术推荐报告。推荐人须用大学或机构邮箱。",
         "action": "下载 GSB/1A，联系两位合适的学术推荐人。", "sourceIds": beee_page},
        {"label": "学历证明与英语材料", "text": "提交各段高等教育的官方成绩单和相应证明。若无认可大学的英语授课学位，校级门槛为学术类雅思总分 6.5 或托福网考 80。项目页要求考试结果在两年有效期内。",
         "action": "核对成绩单和英语证明，按项目页准备适用于自己的材料。", "sourceIds": beee_page + beee_eligibility},
    ])
    catalog["programs"].append(beee_programme)

    dsa_sources = [
        ("gz-dsa-regular", "https://dsa.hkust-gz.edu.cn/people/faculty/regular/",
         "港科广数据科学与分析 · 常规师资", "学域页面提供 36 个具名个人入口。", "45f454eb5f1a85cfdd668a171549629a9aae6135ed239ee7a390492669780933"),
        ("gz-dsa-adjunct", "https://dsa.hkust-gz.edu.cn/people/faculty/adjunct/",
         "港科广数据科学与分析 · 兼任与实践任职", "学域另列六项兼任及实践任职。", "49ed02baa9e31b35668ee93a51f202e485d70d49bd52d731884f5cc0a75662d6"),
        ("gz-dsa-phd", "https://dsa.hkust-gz.edu.cn/wp-content/uploads/2026/09/DSA-Brochure-202606.pdf",
         "港科广数据科学与分析 · 2027/28 博士手册", "博士栏列学历与英语要求，全日制四年、非全日制六年。", "be0632603bd3f036e861b3886cdeb9112a62f990e7bd99b552716866a818ad22"),
        ("gz-dsa-mphil", "https://dsa.hkust-gz.edu.cn/programs/research-postgraduate-program/mphil-in-data-science-and-analytics/",
         "港科广数据科学与分析 · MPhil 项目入口", "项目页链接至未来技术学院红鸟硕士入口。", "5effd0439b838fdfcd8d2b771a4e49fec228029379702970d0c7bf46d50786ee"),
    ]
    for sid, url, title, claim, digest in dsa_sources:
        catalog["sources"].append(dict(id=sid, url=url, title=title, checkedAt=CHECKED,
            evidenceLevel="official_scoped_body_read", scope=claim, claims=[claim], knownIssues=[],
            readMethod="anonymous_HTTP", bodySha256=digest))
    for sid, url, title, _, _ in dsa_sources[:2]:
        catalog["directories"].append(dict(id=sid + "-directory", universityId="hkustgz", unit=title, url=url,
            coverageComplete=False, sourceIds=[sid], coverageNotes="从学域官网按任职类别浏览个人入口。"))

    dsa_phd = ["gz-dsa-phd"]
    dsa = program("hkustgz-dsa-phd-2027", "hkustgz", "数据科学与分析博士", ["PhD"],
        "港科大（广州）2027/28 秋季。全日制四年，非全日制六年。",
        "unknown", "可从学域师资页了解研究方向，并按学域最新申请指引准备。", dsa_phd,
        "按研究生院流程在申请系统递交，申请滚动审理。", ["gz-timeline"],
        [deadline("国际申请者校级截止", "2027-06-15", ["gz-timeline"], clock="23:59", degree="PhD"),
         deadline("中国申请者校级截止", "2027-07-15", ["gz-timeline"], clock="23:59", degree="PhD")],
        dsa_phd + ["gz-timeline"], "学历及英语要求来自学域博士手册。截止日期来自研究生院校级时间表。")
    dsa.update(entryUrl="https://dsa.hkust-gz.edu.cn/programs/research-postgraduate-program/phd-in-data-science-and-analytics/",
        requirements=[
            {"label": "学历要求", "text": "须具有获认可院校颁授的学士学位且成绩优异，或具有至少一年全日制或两年非全日制的研究生学习经历，并能证明表现合格。", "sourceIds": dsa_phd},
            {"label": "英语要求", "text": "学术类雅思总分至少 6.5，单项至少 5.5。托福网考按考试日期分档，2026 年 1 月 21 日前至少 80 分，当日起至少 4.5 分。其他成绩选项见博士手册。", "sourceIds": dsa_phd},
        ])
    catalog["programs"].append(dsa)
    rbm = next(row for row in catalog["programs"] if row["id"] == "hkust-gz-rbm")
    rbm["sourceIds"].append("gz-dsa-mphil")
    rbm.setdefault("requirements", []).append({"label": "对数据科学与分析感兴趣",
        "text": "学域 MPhil 页面链接至红鸟硕士。申请时在系统选择 MPhil (General)，入学后再按红鸟项目安排探索研究方向并确定学域。",
        "sourceIds": ["gz-dsa-mphil", "gz-redbird"]})
    dsa_faculty = load("hkustgz-dsa-20261110.json")
    catalog["sources"].extend(dsa_faculty["sources"])
    catalog["faculty"].extend(dsa_faculty["faculty"])
    for reviewed_directory in dsa_faculty["directories"]:
        original_directory = next(row for row in catalog["directories"] if row["id"] == reviewed_directory["id"])
        original_directory.clear()
        original_directory.update(reviewed_directory)
    for update in dsa_faculty["facultyUpdates"]:
        original = next(row for row in catalog["faculty"] if row["id"] == update["id"])
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    civil_hku = load("hku-civil-20261110.json")
    catalog["sources"].extend(civil_hku["sources"])
    catalog["faculty"].extend(civil_hku["faculty"])
    catalog["directories"].extend(civil_hku["directories"])
    civil_department = ["hku-civil-20261110-programme"]
    civil_programme = program(
        "hku-civil-rpg-2027", "hku", "土木工程研究学位", ["MPhil", "PhD"],
        "香港大学土木工程学系。可从建造管理、岩土、结构、交通、水与环境五类方向了解研究。",
        "unknown", "可先从学系名录查看研究方向，再核对研究院申请步骤。", civil_department,
        "在港大研究院申请系统核对学历、语言及材料要求。", civil_department,
        [deadline("校级主轮截止", "2026-12-01", ["HKU-CENTRAL-PERIOD"], clock="23:59"),
         deadline("校级第一轮补录截止（视余位）", "2027-04-30", ["HKU-CENTRAL-PERIOD"], clock="23:59"),
         deadline("校级第二轮补录截止（视余位）", "2027-08-31", ["HKU-CENTRAL-PERIOD"], clock="23:59")],
        civil_department + ["HKU-CENTRAL-PERIOD"], "研究路线来自学系介绍，2027/28 日期来自研究院校级申请时间表。")
    civil_programme["entryUrl"] = "https://www.civil.hku.hk/h4_pros_pg_MPhil_PhD.html"
    catalog["programs"].append(civil_programme)
    physics_cuhk = load("cuhk-physics-20261111.json")
    for section in ("sources", "faculty", "directories"):
        catalog[section].extend(physics_cuhk[section])
    phys_sources = ["cuhk-physics-20261111-programme"]
    phys = program(
        "cuhk-physics-rpg-2027", "cuhk", "物理学 MPhil/PhD", ["MPhil", "PhD"],
        "2027/28 学年，全日制。申请时可按偏好填写最多五个研究项目编号。",
        "recommended", "选择项目之前，建议联系相关教师了解研究和课题组。", phys_sources,
        "MPhil 申请者须具物理或相关学士学位；PhD 可凭相关学士或硕士申请。", phys_sources,
        [deadline("主轮截止", "2026-12-01", phys_sources), deadline("清理轮截止（视余位）", "2027-03-31", phys_sources)],
        phys_sources, "常规轮与已结束的提前申请流程分别核对。")
    phys["entryUrl"] = "https://app.phy.cuhk.edu.hk/postgraduate-admissions/mphil-phd-in-physics/"
    phys["requirements"] = [
        {"label":"学历与成绩", "text":"相关专业学位；学系给出典型主修 GPA 3.2/4.0 或二等一级荣誉学位，具体资格以项目评审为准。", "action":"对照学系和研究院的学历与语言条件。", "sourceIds":phys_sources},
        {"label":"材料与项目选择", "text":"上传成绩单及评分说明、学位或学籍证明、身份证明、简历、个人或研究陈述。按偏好填写最多五个项目编号。语言成绩如适用，须在2027年4月1日前补交。", "action":"按原页清单准备并上传文件。", "sourceIds":phys_sources},
        {"label":"MPhil 推荐与面试", "text":"提供两位推荐人，由系统邀请在线推荐；入围者由相关教师安排面试。", "action":"提前安排两位推荐人。", "degrees":["MPhil"], "sourceIds":phys_sources},
        {"label":"PhD 推荐与考试", "text":"提供三位推荐人；入围者获邀参加2026年12月或2027年2月的入学考试。GRE学科成绩为选交。", "action":"提前安排三位推荐人并留意考试邀请。", "degrees":["PhD"], "sourceIds":phys_sources}]
    phys["finances"] = [
        {"id":"cuhk-physics-tuition", "kind":"tuition", "label":"学费", "text":"2027/28 学年全日制 MPhil/PhD 每年49,500港元。", "action":"查看项目学费与资助说明。", "sourceIds":phys_sources, "rates":[{"value":49500,"currency":"HKD","unit":"academic_year","basis":"academic_year","cycle":"2027/28","condition":"全日制 MPhil/PhD"}]},
        {"id":"cuhk-physics-application-fee", "kind":"application_fee", "label":"申请费", "rates":[], "text":"申请费500港元。", "action":"在正式申请系统核对付款安排。", "sourceIds":phys_sources}]
    catalog["programs"].append(phys)
    ocean = load("hkust-oces-20261111.json")
    for section in ("sources", "faculty", "directories"):
        catalog[section].extend(ocean[section])
    for update in ocean["facultyUpdates"]:
        original = next(f for f in catalog["faculty"] if f["id"] == update["id"])
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known)
    ocean_sources = ["hkust-oces-20261111-programme"]
    mes = program("hkust-mes-rpg-2027", "hkust", "海洋环境科学 MPhil/PhD", ["MPhil", "PhD"],
        "香港校区，2027/28秋季。方向包括海洋生态、海洋学与海洋技术；全日制和兼读分开核对。",
        "unknown", "先查看项目要求与相关教师研究方向。", ocean_sources,
        "MPhil须具认可学士或同等资格；PhD可凭表现优异学士，或满足原页规定的研究生学习经历申请。", ocean_sources,
        [deadline("秋季非本地申请截止", "2027-06-01", ocean_sources),
         deadline("秋季本地申请截止", "2027-07-15", ocean_sources)],
        ocean_sources, "研究学位与联合博士培养分开；不套用授课型项目或广州校区要求。")
    mes.update(entryUrl="https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-mes", requirements=[
        {"label":"学历背景", "text":"MPhil须具认可学士或同等资格。PhD须具表现优异学士，或已完成至少一年全日制或两年兼读研究生学习并表现合格。", "action":"对照研究院原页核对学历条件。", "sourceIds":ocean_sources},
        {"label":"语言成绩", "text":"IELTS学术类总分6.5、各项5.5。TOEFL iBT在2026年1月21日前考试须80分，此日起须4.5分。须单次成绩，不接受居家考试；英语母语或英语授课学士豁免另核。", "action":"按实际考试日期和考试类型核对，不自行换算。", "sourceIds":ocean_sources},
        {"label":"兼读与身份", "text":"本地与非本地的截止日期分别列出；持学生签证或入境许可的非本地学生不能在香港修读兼读研究学位。", "action":"按签证身份与修读模式核对申请安排。", "sourceIds":ocean_sources}],
        finances=[{"id":"hkust-mes-application-fee", "kind":"application_fee", "label":"申请费", "text":"研究学位申请费180港元。", "action":"在正式系统查看付款安排。", "sourceIds":ocean_sources, "rates":[]}])
    catalog["programs"].append(mes)
    amc = load("hkust-amc-admissions-20261111.json")
    catalog["sources"].extend(amc["sources"])
    amc_source = ["hkust-amc-2027-catalog"]
    amc_fee_source = ["hkust-amc-2027-tuition"]
    amc_contact_sources = amc_source + ["hkust-amc-2027-division"]
    amc_program = program(
        "hkust-amc-rpg-2027", "hkust", "艺术与机器创造力 MPhil/PhD", ["MPhil", "PhD"],
        "香港校区，2027/28 秋季。研究方向包括机器创造力、机器辅助艺术实践、艺术管理和批判研究。",
        "recommended", "建议先联系相关老师讨论书面研究计划。课程目录建议由学部教师担任主导师，学部旧页另列书面同意步骤，请向项目确认本轮流程。",
        amc_contact_sources, "滚动审理。按申请学位核对学历条件，准备书面研究计划。", amc_source,
        [deadline("秋季常规申请截止（本地及非本地）", "2027-06-01", amc_source),
         deadline("HKPFS 第一步：研究资助局", "2026-12-01", amc_source, clock="12:00", degree="PhD", route="HKPFS"),
         deadline("HKPFS 第二步：港科大", "2026-12-01", amc_source, clock="23:59", degree="PhD", route="HKPFS")],
        amc_contact_sources, "学部旧页使用 2025/26 截止日期，当前日期和要求见 2027/28 课程目录。")
    amc_program.update(entryUrl="https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-amc", requirements=[
        {"label": "MPhil 学历", "text": "认可院校的学士学位或获认可的同等资格。", "action": "按 MPhil 条件核对学历。", "sourceIds": amc_source},
        {"label": "PhD 学历", "text": "认可院校的学士学位及优异成绩，或至少一年全日制、两年兼读的研究生阶段合格学习经历。", "action": "按 PhD 条件准备成绩或研究生学习证明。", "sourceIds": amc_source},
        {"label": "语言成绩", "text": "IELTS 学术类总分 6.5、各项 5.5。TOEFL iBT 在 2026 年 1 月 21 日前考试须 80 分，自该日起须 4.5 分。须单次成绩，居家考试不受理。英语母语或英语授课学士可按原页核对豁免。", "action": "核对考试日期、类型和豁免条件。", "sourceIds": amc_source},
        {"label": "研究计划与导师组", "text": "须提交书面研究计划。课程目录建议申请前组建至少两位不同学术背景教师的导师组，主导师来自该学部。", "action": "拟好研究计划，向项目核对导师同意书的提交要求。", "sourceIds": amc_contact_sources},
        {"label": "兼读资格", "text": "持香港学生签证或入境许可的非本地申请人不能在香港修读兼读研究学位。", "action": "按签证类别核对修读方式。", "sourceIds": amc_source}], finances=[
        {"id": "hkust-amc-application-fee", "kind": "application_fee", "label": "申请费", "text": "180 港元。", "action": "在申请系统核对付款。", "sourceIds": amc_source, "rates": []},
        {"id": "hkust-amc-tuition", "kind": "tuition", "label": "学费", "text": "2027/28 学年全日制与兼读研究学位均为每年 49,500 港元。", "action": "查看教务处学费说明。", "sourceIds": amc_fee_source,
         "rates": [{"value": 49500, "currency": "HKD", "unit": "academic_year", "basis": "academic_year", "cycle": "2027/28", "condition": "全日制或兼读"}]}])
    catalog["programs"].append(amc_program)
    amc_adjunct = load("hkust-amc-adjunct-20261112.json")
    catalog["sources"].extend(amc_adjunct["sources"])
    catalog["faculty"].extend(amc_adjunct["faculty"])
    catalog["directories"].extend(amc_adjunct["directories"])
    amc_unlinked = load("hkust-amc-unlinked-20261112.json")
    catalog["faculty"].extend(amc_unlinked["faculty"])
    amc_adjunct["directories"][0]["census"] = amc_unlinked["census"]
    amc_yinghao = load("hkust-amc-yinghao-20261112.json")
    teacher = next(row for row in catalog["faculty"] if row["id"] == amc_yinghao["facultyId"])
    assert teacher["universityId"] == "hkust"
    card = next(row for row in amc_unlinked["census"]["unlinkedEntries"] if row["name"] == amc_yinghao["directoryName"])
    card.update(facultyId=teacher["id"], reason="学部名录未给逐人主页。已关联同一老师的计算机科学与工程学系档案。")
    directory_source = amc_adjunct["directories"][0]["sourceIds"][0]
    teacher["sourceIds"].append(directory_source)
    teacher.setdefault("directorySourceIds", []).append(directory_source)
    teacher.setdefault("academicUnitIds", []).append("hkust-6")
    teacher["directoryRole"] = "艺术与机器创造学部 · 联合任职"
    home, lab = amc_yinghao["sources"]
    catalog["sources"].extend((home, lab))
    teacher["sourceIds"].extend((home["id"], lab["id"]))
    link = next(row for row in teacher["extraLinks"] if row["url"] == home["originalUrl"] and row["parentSourceId"] == home["parentSourceId"])
    link.update(bodyStatus="body_read", sourceId=home["id"])
    amc_research_links = load("hkust-amc-research-links-20261112.json")
    catalog["sources"].extend(amc_research_links["sources"])
    for update in amc_research_links["updates"]:
        teacher = next(row for row in catalog["faculty"] if row["id"] == update["id"])
        parent = next(row for row in catalog["sources"] if row["id"] == update["parentSourceId"])
        assert parent["id"] in teacher["sourceIds"] and parent["url"] == teacher["profileUrl"]
        link = update["link"]
        parent.setdefault("discoveredLinks", []).append(link["url"])
        teacher["sourceIds"].extend(update["sourceIds"])
        teacher.setdefault("extraLinks", []).append(link)
    sse_platforms = load("cuhksz-sse-platforms-20261111.json")
    catalog["sources"].append(sse_platforms["source"])
    sse_unit = next(unit for row in catalog["academicCoverage"] for unit in row["units"] if unit["id"] == sse_platforms["parentUnitId"])
    sse_unit["researchPlatforms"] = {key: value for key, value in sse_platforms.items() if key not in {"source", "parentUnitId"}}
    sse_remaining = load("cuhksz-sse-remaining-20261111.json")
    catalog["sources"].extend(sse_remaining["sources"])
    catalog["faculty"].extend(sse_remaining["faculty"])
    for update in sse_remaining["facultyUpdates"]:
        original = next(f for f in catalog["faculty"] if f["id"] == update["id"])
        assert original["universityId"] == "cuhksz"
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "academicUnitIds", "researchKeywords"):
            original[field] = list(dict.fromkeys(original.get(field, []) + update[field]))
        known_links = {link["url"] for link in original.get("extraLinks", [])}
        original.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known_links)
        original["reviewedProfileUrl"] = update["reviewedProfileUrl"]
    for update in sse_remaining["leadUpdates"]:
        lead_by_url[update["url"]].update(update)
    sse_labs = load("cuhksz-sse-labs-20261111.json")
    catalog["sources"].extend(sse_labs["sources"])
    current_faculty = {f["id"]: f for f in catalog["faculty"]}
    for update in sse_labs["linkUpdates"]:
        person = current_faculty[update["facultyId"]]
        link = next(link for link in person["extraLinks"] if link["url"] == update["url"])
        link.update({k: v for k, v in update.items() if k != "facultyId"})
        if update.get("sourceId"):
            person["sourceIds"] = list(dict.fromkeys(person["sourceIds"] + [update["sourceId"]]))
    research_links = load("research-links-20261111.json")
    catalog["sources"].extend(research_links["sources"])
    catalog["faculty"].extend(research_links["faculty"])
    people = {f["id"]: f for f in catalog["faculty"]}
    for update in research_links["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords"):
            person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
        person["summary"] = update["summary"]
        if update.get("reviewedProfileUrl"):
            person["reviewedProfileUrl"] = update["reviewedProfileUrl"]
        known = {link["url"] for link in person.get("extraLinks", [])}
        person.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known)
    for update in research_links["linkUpdates"] + research_links["navigationLinks"]:
        person = people[update["facultyId"]]
        link = next(link for link in person["extraLinks"] if link["url"] == update["url"])
        link.update({key: value for key, value in update.items() if key != "facultyId"})
        if update.get("sourceId"):
            person["sourceIds"] = list(dict.fromkeys(person["sourceIds"] + [update["sourceId"]]))
    for update in research_links["directoryUpdates"]:
        directory = next(d for d in catalog["directories"] if d["id"] == update["id"])
        card = next(row for row in directory["census"]["entries"] if row["profileUrl"] == update["profileUrl"])
        card.update({key: value for key, value in update.items() if key not in {"id", "profileUrl"}})
    sse_completion = load("cuhksz-sse-completion-20261111.json")
    catalog["sources"].extend(sse_completion["sources"])
    catalog["faculty"].extend(sse_completion["faculty"])
    people = {f["id"]: f for f in catalog["faculty"]}
    for update in sse_completion["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords"):
            person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
        known = {link["url"] for link in person.get("extraLinks", [])}
        person.setdefault("extraLinks", []).extend(link for link in update["extraLinks"] if link["url"] not in known)
    for update in sse_completion["leadUpdates"]:
        lead_by_url[update["url"]].update(update)
    life_categories = load("hkust-life-science-categories-20261111.json")
    catalog["sources"].append(life_categories["source"])
    catalog["directories"].append(life_categories["directory"])
    science = next(unit for row in catalog["academicCoverage"] for unit in row["units"] if unit["id"] == life_categories["parentUnitId"])
    science["staffEntries"].extend(life_categories["staffEntries"])
    life_research = load("hkust-life-science-research-20261111.json")
    catalog["sources"].extend(life_research["sources"])
    catalog["faculty"].extend(life_research["faculty"])
    people = {person["id"]: person for person in catalog["faculty"]}
    for update in life_research["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "keywordSourceIds", "researchKeywords"):
            person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
    life_leads = {lead["url"]: lead for entry in life_categories["staffEntries"] for lead in entry["profileLeads"]}
    life_census = life_categories["directory"]["census"]
    life_cards = {card["profileUrl"]: card for card in life_census["entries"]}
    reviewed_sources = []
    for update in life_research["rosterUpdates"]:
        lead = life_leads[update["url"]]
        card = life_cards[update["url"]]
        if update.get("facultyId"):
            lead.update(facultyId=update["facultyId"], researchReviewStatus="research_excerpt_and_directory_role_reviewed")
            card["facultyId"] = update["facultyId"]
        if update.get("profileSourceId"):
            lead.update(profileBodyStatus="body_read", bodySha256=update["bodySha256"])
            card.update(profileRead=True, reviewStatus="body_read")
            reviewed_sources.append(update["profileSourceId"])
    life_division = load("hkust-life-science-division-20261111.json")
    catalog["sources"].extend(life_division["sources"])
    for update in life_division["updates"]:
        url, faculty_id, source_id = update["url"], update["facultyId"], update["sourceId"]
        person = people[faculty_id]
        person["sourceIds"] = list(dict.fromkeys(person["sourceIds"] + [source_id]))
        if update["researchKeywords"]:
            person["keywordSourceIds"] = list(dict.fromkeys(person.get("keywordSourceIds", []) + [source_id]))
            person["researchKeywords"] = list(dict.fromkeys(person["researchKeywords"] + update["researchKeywords"]))
        life_leads[url].update(facultyId=faculty_id, researchReviewStatus="research_excerpt_and_directory_role_reviewed",
                               profileBodyStatus="body_read", bodySha256=update["bodySha256"])
        life_cards[url].update(facultyId=faculty_id, profileRead=True, reviewStatus="body_read")
        reviewed_sources.append(source_id)
    life_census["profilesRead"] = len(reviewed_sources)
    life_census["profilesFailed"] = life_census["observedTotal"] - len(reviewed_sources)
    life_census["pendingReasonCounts"] = {"not_read": life_census["profilesFailed"]}
    life_categories["directory"]["reviewSourceIds"] = reviewed_sources
    life_programme = load("hkust-life-science-programme-20261111.json")
    catalog["sources"].extend(life_programme["sources"])
    life_refs = [life_programme["sources"][0]["id"]]
    materials_refs = [life_programme["sources"][1]["id"]]
    life = program(life_programme["programId"], "hkust", "生命科学 MPhil/PhD", ["MPhil", "PhD"],
        "香港校区，2027/28秋季。可了解神经科学、癌症、细胞与发育生物学、结构生物学等方向。", "unknown",
        "先查看项目要求与相关教师研究方向。", life_refs,
        "MPhil须具认可学士或同等资格；PhD可凭表现优异学士，或满足规定的研究生学习经历申请。", life_refs,
        [deadline("秋季非本地申请截止", "2027-06-01", life_refs), deadline("秋季本地申请截止", "2027-07-15", life_refs)],
        life_refs, "分子医学、科学计算是培养方向；联合博士路线另看对应项目。")
    life.update(entryUrl=life_programme["entryUrl"], requirements=[
        {"label":"MPhil学历条件", "degrees":["MPhil"], "text":"须具认可院校学士学位或获准的同等资格。", "action":"对照自己的学历准备成绩单与学位证明。", "sourceIds":life_refs},
        {"label":"PhD学历条件", "degrees":["PhD"], "text":"须具表现优异的认可学士，或已完成至少一年全日制或两年兼读研究生学习并表现合格。", "action":"按实际学历路径核对博士申请条件。", "sourceIds":life_refs},
        {"label":"语言成绩", "text":"IELTS学术类总分6.5、各项5.5。TOEFL iBT在2026年1月21日前考试须80分，此日起须4.5分。须单次成绩，不接受居家考试；英语母语或英语授课学士的豁免另看原页。", "action":"按考试日期与类型核对成绩要求。", "sourceIds":life_refs},
        {"label":"申请材料", "text":"准备身份文件、成绩单与学位证明、院校评分制度、语言证明，以及两封学术推荐信。学部未标年说明另列平均成绩3或同等资格。", "action":"在当期申请系统核对材料格式并安排推荐人。", "sourceIds":materials_refs},
        {"label":"兼读与身份", "text":"持学生签证或入境许可的非本地学生不能在香港修读兼读研究学位。", "action":"按签证身份选择修读模式。", "sourceIds":life_refs}],
        finances=[{"id":"hkust-life-science-application-fee", "kind":"application_fee", "label":"申请费", "text":"研究学位申请费180港元。", "action":"在正式申请系统查看付款安排。", "sourceIds":life_refs, "rates":[]}])
    life["sourceIds"] = life_refs + materials_refs
    catalog["programs"].append(life)
    bsbe = load("hkustgz-bsbe-20261111.json")
    catalog["sources"].extend(bsbe["sources"])
    catalog["faculty"].extend(bsbe["faculty"])
    catalog["directories"].append(bsbe["directory"])
    systems = next(unit for row in catalog["academicCoverage"] for unit in row["units"] if unit["id"] == "hkustgz-3")
    systems["staffEntries"].extend(bsbe["staffEntries"])
    next(child for child in systems["children"] if child["name"] == "生命科学与生物医学工程").update(bsbe["childUpdate"])
    for update in bsbe["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            if field in update:
                person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
        person["identityNote"] = update["identityNote"]
    bsbe_ref = ["hkustgz-bsbe-phd-source-2027"]
    gz_requirements = ["gz-central-requirements"]
    gz_dates = ["gz-timeline"]
    bsbe_program = program("hkustgz-bsbe-phd-2027", "hkustgz", "生命科学与生物医学工程博士", ["PhD"],
        "广州校区，2027/28秋季。研究方向包括组织工程、分子与细胞生物学、精准医学和生物信息学。", "unknown",
        "可先查看学域师资和研究方向，再准备申请材料。", bsbe_ref,
        "按博士项目在研究生院系统递交。研究型硕士从红鸟硕士 MPhil (General) 入口申请。", bsbe_ref,
        [deadline("国际申请者校级截止", "2027-06-15", gz_dates, clock="23:59", degree="PhD"),
         deadline("中国申请者校级截止", "2027-07-15", gz_dates, clock="23:59", degree="PhD")],
        bsbe_ref + gz_dates + gz_requirements + ["hkustgz-bsbe-materials-20261111", "gz-scholarships-fees"],
        "学位及申请入口见2027/28项目目录，材料和截止日期见广州研究生院。")
    bsbe_program.update(entryUrl="https://pcc.hkust-gz.edu.cn/postgraduate/program-catalog", requirements=[
        {"label": "博士学历", "text": "认可学士且表现优异，或有至少一年全日制或两年非全日制的合格研究生学习经历。",
         "action": "按所走的学历路径准备证明。", "sourceIds": gz_requirements},
        {"label": "英语成绩", "text": "学术类雅思总分6.5、各项5.5。托福网考在2026年1月21日前考试须80分，当日起须4.5分。须单次成绩，居家考试不获接受。英语母语及英语授课学历豁免见原页。",
         "action": "按考试日期核对分数与豁免条件。", "sourceIds": gz_requirements},
        {"label": "申请材料", "text": "准备身份证明、完整高等教育成绩与学历文件、评分制度、语言证明、研究计划及过往研究经历。校级说明列2至5位推荐人。",
         "action": "对照申请系统检查项目表格与推荐人要求。", "sourceIds": ["hkustgz-bsbe-materials-20261111"]}],
        finances=[{"id": "hkustgz-bsbe-phd-application-fee", "kind": "application_fee", "label": "申请费",
                   "text": "申请费人民币150元。", "action": "在正式申请系统核对支付安排。",
                   "sourceIds": bsbe_ref, "rates": [{"value": 150, "currency": "CNY", "unit": "application", "basis": "intake",
                                                    "cycle": "2027/28", "condition": "2027/28博士申请"}]},
                  {"id": "hkustgz-bsbe-phd-tuition", "kind": "tuition", "label": "学费",
                   "text": "2027/28起，获研究生助学金的全日制研究生每学年人民币6万元，自费每学年人民币15万元。",
                   "action": "按录取及资助安排核对学费。", "sourceIds": ["gz-scholarships-fees"], "rates": []}])
    catalog["programs"].append(bsbe_program)
    systems_followup = load("hkustgz-systems-routes-and-labs-20261111.json")
    catalog["sources"].extend(systems_followup["sources"])
    catalog["faculty"].extend(systems_followup["faculty"])
    people.update({person["id"]: person for person in bsbe["faculty"] + systems_followup["faculty"]})
    for update in systems_followup["facultyUpdates"]:
        person = people[update["id"]]
        person["sourceIds"] = list(dict.fromkeys(person["sourceIds"] + update["sourceIds"]))
        if update["researchKeywords"]:
            for field, values in (("researchKeywords", update["researchKeywords"]), ("keywordSourceIds", update["sourceIds"])):
                person[field] = list(dict.fromkeys(person.get(field, []) + values))
    for update in systems_followup["linkUpdates"]:
        person = people[update["facultyId"]]
        link = next(link for link in person["extraLinks"] if link["url"] == update["url"])
        link.update({key: value for key, value in update.items() if key != "facultyId"})
    goto = systems_followup["rosterUpdate"]
    next(card for card in bsbe["directory"]["census"]["entries"] if card["profileUrl"] == goto["url"])["facultyId"] = goto["facultyId"]
    lead = next(lead for entry in bsbe["staffEntries"] for lead in entry["profileLeads"] if lead["url"] == goto["url"])
    lead.update(facultyId=goto["facultyId"], researchReviewStatus="research_excerpt_and_directory_role_reviewed")
    lead.pop("reviewNote", None)
    for route in systems_followup["routes"]:
        route_refs = [route["sourceId"]]
        route_id = route["id"]
        route_program = program(route_id, "hkustgz", route["name"], ["PhD"], route["scope"], "unknown",
            bsbe_program["contact"]["text"], route_refs, bsbe_program["selection"]["text"], route_refs,
            bsbe_program["deadlines"], route_refs + bsbe_program["sourceIds"][1:], bsbe_program["evidenceNote"])
        route_program.update(entryUrl=bsbe_program["entryUrl"], requirements=bsbe_program["requirements"], finances=[
            {**fee, "id": f"{route_id}-{fee['kind'].replace('_', '-')}",
             "sourceIds": route_refs if fee["kind"] == "application_fee" else fee["sourceIds"]}
            for fee in bsbe_program["finances"]])
        catalog["programs"].append(route_program)
    systems_rosters = load("hkustgz-intr-smmg-rosters-20261111.json")
    for field in ("sources", "faculty", "directories"):
        catalog[field].extend(systems_rosters[field])
    systems["staffEntries"].extend(systems_rosters["staffEntries"])
    for update in systems_rosters["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
        person["identityNote"] = " ".join(filter(None, (person.get("identityNote"), update["additionalIdentityNote"])))
    reviewed_links = load("hkustgz-intr-smmg-reviewed-links-20261111.json")
    catalog["sources"].extend(reviewed_links["sources"])
    new_systems_people = {person["id"]: person for person in systems_rosters["faculty"]}
    for update in reviewed_links["linkUpdates"]:
        person = new_systems_people[update["facultyId"]]
        link = next(link for link in person["extraLinks"] if
                    (link["url"], link["parentSourceId"]) == (update["url"], update["parentSourceId"]))
        link.update(bodyStatus=update["bodyStatus"], sourceId=update["sourceId"], readNote=update["readNote"])
        person["sourceIds"].append(update["sourceId"])

    eee = load("polyu-eee-20261111.json")
    for field in ("sources", "faculty", "directories"):
        catalog[field].extend(eee[field])
    engineering = next(unit for row in catalog["academicCoverage"] for unit in row["units"] if unit["id"] == "polyu-4")
    engineering.setdefault("staffEntries", []).extend(eee["staffEntries"])
    for update in eee["stableDirectoryUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "directorySourceIds"):
            person[field] = list(dict.fromkeys(person.get(field, []) + [update["directoryId"]]))
    for update in eee["stableResearchUpdates"]:
        person = people[update["id"]]
        person["sourceIds"].append(update["profileSourceId"])
        person["keywordSourceIds"].append(update["profileSourceId"])
        person["researchKeywords"] = list(dict.fromkeys(person["researchKeywords"] + update["terms"]))
        person["academicUnitIds"] = list(dict.fromkeys(person.get("academicUnitIds", []) + ["polyu-4"]))
        eee_note = "电机及电子工程学系名录另列此档案。该学系个人页与数据科学及人工智能学系档案共享同一个 PolyU Scholars Hub 个人入口。"
        person["identityNote"] = " ".join(filter(None, (person.get("identityNote"), eee_note)))
    eee_page = ["polyu-eee-20261111-programme"]
    eee_fee = ["polyu-eee-20261111-fee"]
    eee_tuition = ["polyu-eee-20261111-tuition"]
    eee_programme = program(
        "polyu-eee-rpg-sept-2027", "polyu", "电机及电子工程研究学位", ["MPhil", "PhD"],
        "2027 年 9 月入学，可全日制或兼读。方向涵盖通信与信息安全、光子器件、电力能源、智能出行、微电子与量子、人工智能与机器人。",
        "recommended", "先联系研究方向相符的意向导师，再准备网申。", beee_procedure + eee_page,
        "准备研究计划、个人陈述及学历证明，并安排两位学术推荐人。", eee_page,
        [deadline("学系申请截止", "2027-05-31", eee_page)],
        eee_page + beee_eligibility + beee_procedure + eee_fee + eee_tuition,
        "日期适用于 2027 年 9 月 MPhil 和 PhD。HKPFS 另有申请安排。")
    eee_programme.update(
        entryUrl="https://www.polyu.edu.hk/study/pg/rpg/2027/eee",
        requirements=beee_programme["requirements"][:2] + [
            {"label": "申请材料", "text": "提交简历、个人陈述、研究计划、各段学历和成绩证明，以及两份学术推荐。拟任导师不能作为学术推荐人。",
             "action": "联系两位熟悉你学术表现的推荐人，核对院校邮箱及材料。", "sourceIds": eee_page},
            {"label": "英语证明", "text": "没有获认可的英语授课学位时，校级要求学术类雅思总分 6.5 或托福网考 80，成绩两年内有效。",
             "sourceIds": beee_eligibility},
        ],
        finances=[
            {"id": "polyu-eee-application-fee", "kind": "application_fee", "label": "申请费",
             "text": "2027/28 申请费为 600 港元，提交网申时支付。",
             "action": "在校方网申系统核对缴费。", "sourceIds": eee_fee,
             "rates": [{"value": 600, "currency": "HKD", "unit": "application", "basis": "intake",
                        "cycle": "2027/28", "condition": "MPhil / PhD"}]},
            {"id": "polyu-eee-tuition", "kind": "tuition", "label": "学费",
             "text": "2027/28 全日制无助学金每年 99,000 港元。有助学金的全日制或兼读每年 49,500 港元。录取后另有注册费及抵扣安排。",
             "action": "按录取及资助条件核对学费和注册费。", "sourceIds": eee_tuition,
             "rates": [{"value": value, "currency": "HKD", "unit": "academic_year", "basis": "academic_year",
                        "cycle": "2027/28", "condition": condition}
                       for value, condition in [(99000, "全日制无助学金"), (49500, "全日制有助学金或兼读")]]},
        ])
    catalog["programs"].append(eee_programme)
    cuhk_ee = load("cuhk-ee-20261111.json")
    catalog["sources"].extend(cuhk_ee["sources"])
    ee_page = ["cuhk-ee-20261111-programme"]
    ee_general = ["cuhk-ee-20261111-eligibility"]
    ee_fees = ["cuhk-gs-fees"]
    cuhk_ee_programme = program(
        "cuhk-ee-rpg-2027", "cuhk", "电子工程研究学位", ["MPhil", "PhD"],
        "2027/28 香港校区。可探索机器人与感知、多媒体与信号处理、集成电路与系统、固态电子与光子学。",
        "unknown", "先看项目材料和研究组方向，再向学系核对联系导师的安排。", ee_page,
        "准备简历、研究成果材料及相关证明。博士申请另需英文研究或目的陈述。", ee_page,
        [deadline("主轮申请截止", "2026-12-01", ee_page),
         deadline("补录轮截止（视学额）", "2027-03-31", ee_page)],
        ee_page + ee_general + ee_fees,
        "补录视学额安排。申请博士奖学金 HKPFS 请分别核对 RGC 和中大两项提交时间。")
    cuhk_ee_programme.update(
        entryUrl="https://www.gs.cuhk.edu.hk/programmes/engineering/mphil-phd-electronic-engineering",
        requirements=[
            {"label": "MPhil 学历要求", "degrees": ["MPhil"],
             "text": "通常须持认可院校二等荣誉或以上学士，或认可荣誉课程学士平均成绩 B 或以上，或同等资格。",
             "sourceIds": ee_general},
            {"label": "博士方向学历要求", "degrees": ["PhD"],
             "text": "可凭认可硕士申请，也可按研究院列出的荣誉学士、B 或以上成绩或同等专业资格路线申请。",
             "sourceIds": ee_general},
            {"label": "专业背景与 GRE", "text": "通常为电子工程、计算机工程、含电子方向的物理或相关专业。学系强烈建议非香港大学毕业生提交 GRE General。",
             "sourceIds": ee_page},
            {"label": "申请材料", "text": "提交简历、研究成果清单或相关资料，以及奖项与其他证明（如适用）。",
             "sourceIds": ee_page},
            {"label": "博士研究陈述", "degrees": ["PhD"], "text": "另交约 600 至 800 英文词的研究或目的陈述。",
             "sourceIds": ee_page},
            {"label": "英语要求", "text": "可用符合要求的英语授课学位或认可成绩。学术类雅思 6.5，托福 79/120 或 4.5/6；雅思和托福成绩有效期为两年，其他认可路径见研究院。",
             "sourceIds": ee_general},
        ],
        finances=[
            {"id": "cuhk-ee-application-fee", "kind": "application_fee", "label": "申请费",
             "text": "每个项目申请费为 500 港元。", "action": "在研究院网申核对费用及缴费安排。", "sourceIds": ee_fees,
             "rates": [{"value": 500, "currency": "HKD", "unit": "application", "basis": "intake",
                        "cycle": "2027/28", "condition": "MPhil / PhD"}]},
            {"id": "cuhk-ee-tuition", "kind": "tuition", "label": "学费",
             "text": "2027/28 学费为每年 49,500 港元，适用于全日制和兼读。",
             "action": "打开研究院费用页核对学费和适用的减免。", "sourceIds": ee_page + ee_fees,
             "rates": [{"value": 49500, "currency": "HKD", "unit": "academic_year", "basis": "academic_year",
                        "cycle": "2027/28", "condition": "所有修读模式"}]},
        ])
    catalog["programs"].append(cuhk_ee_programme)
    ie = load("cuhk-ie-20261111.json")
    catalog["sources"].extend(ie["sources"])
    catalog["faculty"].extend(ie["faculty"])
    catalog["directories"].append(ie["directory"])
    ie_parent = next(unit for row in catalog["academicCoverage"] for unit in row["units"] if unit["id"] == "cuhk-4")
    ie_parent.setdefault("staffEntries", []).extend(ie["staffEntries"])
    for update in ie["facultyUpdates"]:
        person = people[update["id"]]
        for field in ("sourceIds", "directorySourceIds", "keywordSourceIds", "researchKeywords"):
            person[field] = list(dict.fromkeys(person.get(field, []) + update[field]))
        person["identityNote"] = " ".join(filter(None, (person.get("identityNote"), update["identityNote"])))
    ie_page = ["cuhk-ie-20261111-programme"]
    ie_admission = ["cuhk-ie-20261111-admission"]
    ie_programme = program(
        "cuhk-ie-rpg-2027", "cuhk", "信息工程研究学位", ["MPhil", "PhD"],
        "2027/28 香港校区。方向涵盖人工智能与多媒体、网络安全、信息论与编码、互联网、光通信及无线通信。",
        "unknown", "先核对项目要求和研究方向。导师及资助安排须与学系确认。", ie_admission,
        "两页研究或目的陈述，以及列明研究项目和成果的简历。可能安排面试。", ie_page,
        [deadline("主轮截止（建议11月15日前提交）", "2026-12-01", ie_page + ie_admission),
         deadline("补录截止（视学额）", "2027-03-31", ie_page + ie_admission)],
        ie_page + ie_admission + ee_general + ee_fees,
        "11月15日是学系希望收到申请及开始审阅的时间，主轮正式截止为12月1日。")
    ie_programme.update(
        entryUrl="https://www.ie.cuhk.edu.hk/programmes/mphil-phd-in-information-engineering/admission-to-mphil-phd/",
        requirements=[
            {"label": "学历与专业", "text": "通常须计算机、信息、电子或相关工程和理科的二等荣誉学士，或荣誉课程学士平均成绩 B 或以上，或同等资格。预计本学年毕业者可获有条件录取。",
             "sourceIds": ie_admission},
            {"label": "研究陈述与简历", "text": "所有申请均交两页研究或目的陈述，并在简历列明研究领域、研究项目和发表成果。",
             "sourceIds": ie_page + ie_admission},
            {"label": "博士推荐报告", "degrees": ["PhD"], "text": "全日制研究博士须邀请至少三位推荐人完成保密推荐报告。",
             "sourceIds": ie_admission},
            {"label": "硕士推荐报告", "degrees": ["MPhil"], "text": "安排两位推荐人完成保密推荐报告。",
             "sourceIds": ie_admission},
            {"label": "学历材料与提交", "text": "网申上传完整成绩单、评分制度、学历及身份等证明。学系另要求发送材料电子副本，并邮寄指定原件。",
             "action": "按学系清单检查扫描件、原件、密封及内地学历核验要求。", "sourceIds": ie_admission},
            {"label": "英语证明", "text": "研究院认可英语授课学位及其他英语能力途径。学术类雅思 6.5，托福 79/120 或 4.5/6，成绩两年有效。",
             "sourceIds": ee_general},
        ],
        finances=[{**fee, "id": fee["id"].replace("cuhk-ee-", "cuhk-ie-"),
                   "sourceIds": ie_page + ee_fees if fee["kind"] == "tuition" else ee_fees}
                  for fee in cuhk_ee_programme["finances"]])
    catalog["programs"].append(ie_programme)
    return catalog


def validate_read_receipt(record):
    """A web-reader receipt is not the server's raw response body."""
    if "readReceiptSha256" in record:
        assert "bodySha256" not in record, "Do not label tool text as a raw HTTP body"
        assert record.get("readMethod") in {"web_reader", "web_tool_actual_body"}
        if record["readMethod"] == "web_reader":
            assert record.get("receiptKind") == "web_reader_returned_text"
            assert record.get("receiptScope") == "batched_tool_response"
        assert re.fullmatch("[a-f0-9]{64}", record["readReceiptSha256"])
    else:
        assert re.fullmatch("[a-f0-9]{64}", record["bodySha256"])


def application_degrees(catalog, program):
    route = catalog.get("directApplicationRoutes", {}).get(program["id"])
    return route["degrees"] if route and route["cycle"] == program["cycle"] else program["degrees"]


def validate(catalog):
    assert catalog["schemaVersion"] == 1 and catalog["checkedDate"] == CHECKED
    unis = {u["id"] for u in catalog["universities"]}
    assert unis == {"hku", "cuhk", "hkust", "polyu", "cityu", "cuhksz", "hkustgz"}
    sources = {s["id"]: s for s in catalog["sources"]}
    assert len(sources) == len(catalog["sources"]) and len(sources) >= 34
    programmes = {p["id"]: p for p in catalog["programs"]}
    for pid, route in catalog.get("directApplicationRoutes", {}).items():
        programme = programmes[pid]
        assert route["cycle"] == programme["cycle"]
        assert route["degrees"] and set(route["degrees"]) < set(programme["degrees"])
        assert route["sourceId"] in programme["sourceIds"] and route["sourceId"] in sources
        assert date.fromisoformat(sources[route["sourceId"]]["checkedAt"]) <= date.fromisoformat(route["checkedAt"]) <= date.fromisoformat(CHECKED)
    for source in sources.values():
        if source.get("navigationEvidence"):
            navigation = source["navigationEvidence"]
            assert navigation["kind"] == "html_meta_refresh"
            original = sources.get(navigation["sourceId"])
            assert original and original["evidenceLevel"] == "official_profile_redirect"
            assert navigation["bodySha256"] == original["bodySha256"]
            assert source["originalUrl"] == original["originalUrl"]
            assert navigation["documentUrl"] == original["url"]
            assert source["parentSourceId"] == original["parentSourceId"]
            assert navigation["declaredTarget"] == source["url"]
            assert source["url"] in original["discoveredLinks"], "A declared refresh cannot invent another target"
        if "readReceiptSha256" in source:
            validate_read_receipt(source)
        if source.get("bodySha256") == "d02032286070b4dd9d8fbd985a7bdca8af8edf52b89ff177db3bfcb2c8a9c43d":
            assert source["evidenceLevel"] == "official_entry_access_failed" and source.get("responseKind") == "access_challenge", "A known access-check response is not verified institutional content"
        if source["url"].startswith("http://"):
            # Keep actual supplied legacy HTTP evidence without silently upgrading it.
            # The web link policy remains HTTPS-only.
            assert source.get("transportScope") == "read_only_http_source_not_clickable"
            assert source.get("retrievedUrl") == source["url"]
            assert source.get("readMethod") == "anonymous_HTTP"
            assert re.fullmatch("[a-f0-9]{64}", source.get("bodySha256", ""))
            assert source.get("originalUrl", "").startswith("http://")
        else:
            assert source["url"].startswith("https://")
        assert source["claims"]
        checked = source["checkedAt"]
        assert isinstance(checked, str) and re.fullmatch(r"\d{4}-\d\d-\d\d", checked), "Record the actual source verification date"
        assert datetime.fromisoformat(checked).date().isoformat() == checked and checked <= catalog["checkedDate"], "Source verification cannot be after the catalogue version"
        assert isinstance(source["knownIssues"], list)
    def refs(ids):
        assert ids and set(ids) <= sources.keys(), ids
    seen = set()
    finance_ids = set()
    for p in catalog["programs"]:
        assert p["id"] not in seen and p["universityId"] in unis
        seen.add(p["id"])
        assert p["degrees"] and set(p["degrees"]) <= {"MPhil", "PhD"}
        if p.get("cycleVerified") is False:
            assert p["cycle"] is None and not p["deadlines"], "An undated route must not acquire an intake or deadline"
        assert p["contact"]["status"] in {"recommended", "required", "not_required", "after_admission", "unknown"}
        refs(p["sourceIds"]); refs(p["contact"]["sourceIds"]); refs(p["selection"]["sourceIds"])
        for item in p.get("requirements", []):
            assert item["label"] and item["text"]
            refs(item["sourceIds"])
            if "degrees" in item:
                assert item["degrees"] and set(item["degrees"]) <= set(p["degrees"])
            if "action" in item:
                assert 0 < len(item["action"]) <= 300
            if "url" in item:
                assert item["url"].startswith("https://")
        for item in p.get("finances", []):
            assert item["id"] not in finance_ids
            finance_ids.add(item["id"])
            assert item["kind"] in {"tuition", "studentship", "application_fee"}
            assert item["label"] and item["text"] and 0 < len(item["action"]) <= 300
            refs(item["sourceIds"])
            assert "degrees" not in item or (item["degrees"] and set(item["degrees"]) <= set(p["degrees"]))
            for rate in item["rates"]:
                assert type(rate["value"]) is int and rate["value"] > 0
                assert rate["currency"] in {"HKD", "CNY"} and rate["unit"] in {"academic_year", "year", "month", "application"}
                assert rate["basis"] in {"academic_year", "intake", "page_reference"} and rate["condition"]
                if rate["basis"] == "page_reference":
                    assert rate["cycle"] is None
                else:
                    assert re.fullmatch(r"\d{4}/\d{2}( Spring)?", rate["cycle"])
        for d in p["deadlines"]:
            refs(d["sourceIds"])
            assert d["cycle"] and d["degree"] in {None, "MPhil", "PhD"}
            assert d["degree"] is None or d["degree"] in p["degrees"]
            if d["at"] is not None:
                assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:00\+08:00", d["at"])
                datetime.fromisoformat(d["at"])
            else:
                assert "官网未说明具体时间" in d["label"] and re.fullmatch(r"\d{4}-\d\d-\d\d", d["date"])
    by_id = {p["id"]: p for p in catalog["programs"]}
    assert by_id["hku-cs-rpg"]["contact"]["status"] == "unknown"
    assert by_id["cityu-cs-rpg"]["contact"]["status"] == "unknown"
    assert by_id["hku-cds-early-2027"]["deadlines"][0]["at"] < CHECKED
    assert by_id["hkust-gz-rbm"]["degrees"] == ["MPhil"]
    assert any(d["at"] is None for p in catalog["programs"] for d in p["deadlines"])
    faculty_ids, profile_keys = set(), set()
    directory_by_source = {sid: d for d in catalog.get("directories", []) for sid in d["sourceIds"]}
    for f in catalog["faculty"]:
        assert f["id"] not in faculty_ids
        faculty_ids.add(f["id"])
        if f.get("recordKind") == "directory_research":
            assert f["profileUrl"] is None, "Do not invent an unprovided individual profile URL"
            sid = f["directoryEvidenceSourceId"]
            assert sid in f["directorySourceIds"] and sid in f["sourceIds"]
            directory = directory_by_source[sid]
            assert directory["universityId"] == f["universityId"] and directory["url"] == sources[sid]["url"]
            assert any(row.get("facultyId") == f["id"] and row["name"] == f["name"] for row in directory["census"].get("unlinkedEntries", [])), "Bind directory-only research to its actual named card"
            key = (f["universityId"], "directory_research", sid, f["name"])
        else:
            assert isinstance(f.get("profileUrl"), str) and f["profileUrl"], "An individual profile needs its actual supplied URL"
            key = (f["universityId"], f["profileUrl"].rstrip("/").lower())
        assert key not in profile_keys, "Duplicate official faculty profile"
        profile_keys.add(key)
        assert f["universityId"] in unis and f["topics"] and set(f["topics"]) <= set(TAGS)
        refs(f["sourceIds"]); refs(f["availability"]["sourceIds"])
        assert f["researchKeywords"] and len(f["researchKeywords"]) == len(set(f["researchKeywords"]))
        assert all(isinstance(term, str) and 1 < len(term) <= 200 for term in f["researchKeywords"])
        refs(f["keywordSourceIds"])
        for link in f.get("extraLinks", []):
            parent = sources[link["parentSourceId"]]
            from_profile = parent["url"] in {f["profileUrl"], f.get("reviewedProfileUrl")}
            from_directory = parent["id"] in f.get("directorySourceIds", []) and link["url"] in parent.get("teacherLinksByProfile", {}).get(f["profileUrl"], [])
            assert link["parentSourceId"] in f["sourceIds"] and (from_profile or from_directory)
            assert link["url"] in parent["discoveredLinks"]
            assert link["bodyStatus"] in {"not_read", "body_read"}
            if link.get("linkIssue"):
                assert link["linkIssue"] == "malformed_href" and link["bodyStatus"] == "not_read" and link["readNote"]
            if link["bodyStatus"] == "body_read":
                target = sources[link["sourceId"]]
                if target["url"] != link["url"]:
                    assert target["evidenceLevel"] == "teacher_page_linked_from_official_profile"
                    assert target["originalUrl"] == link["url"] and target["retrievedUrl"] == target["url"]
                    assert target["parentSourceId"] == parent["id"] and target["id"] in f["sourceIds"]
                    if not target["url"].startswith("https://"):
                        # Retained HTTP redirects are evidence only; the UI still rejects HTTP.
                        assert link["url"].startswith("http://")
                        assert target.get("transportScope") == "read_only_http_source_not_clickable"
        for note in f.get("applicationNotes", []):
            assert note["kind"] in {"official_supervisor_list", "teacher_statement", "page_conflict"}
            assert note["label"] and note["text"]
            refs(note["sourceIds"])
            assert set(note["sourceIds"]) <= set(f["sourceIds"])
            if "degrees" in note:
                assert note["degrees"] and set(note["degrees"]) <= {"MPhil", "PhD"}
            for intake in note.get("mentionedIntakes", []):
                assert re.fullmatch(r"\d{4}/\d{2}( Spring)?", intake["cycle"])
                assert re.fullmatch(r"\d{4} (Spring|Fall)", intake["intake"])
        for sid in f.get("directorySourceIds", []):
            assert sid in directory_by_source and directory_by_source[sid]["universityId"] == f["universityId"]
        assert f["availability"]["state"] in {"unknown", "advertised"}
        if f["id"] == "lingjie-duan":
            assert f["availability"]["state"] == "advertised" and "2027/28" not in f["availability"]["cycle"]
        elif f["availability"]["state"] == "unknown":
            assert f["availability"]["state"] == "unknown" and f["availability"]["cycle"] is None
        elif f["availability"].get("noticeKind") == "dated_teacher_statement":
            notice = f["availability"]
            assert re.fullmatch(r"\d{4}/\d{2}", notice["cycle"])
            assert notice["intake"] == notice["cycle"][:4] + " Fall"
            assert notice["degrees"] and set(notice["degrees"]) <= {"PhD", "MPhil"}
            assert all(sources[sid]["evidenceLevel"] == "teacher_page_linked_from_official_profile" for sid in notice["sourceIds"])
        else:
            assert f["availability"]["sourceIds"] and f["availability"]["text"]
            assert f["availability"].get("degrees") == ["PhD"]
            assert f["availability"]["cycle"] is None, "An undated notice must not acquire a current intake"
    directory_ids = set()
    for d in catalog.get("directories", []):
        assert d["id"] not in directory_ids and d["universityId"] in unis
        directory_ids.add(d["id"])
        assert d["unit"] and d["url"].startswith("https://") and d["coverageComplete"] is False
        refs(d["sourceIds"])
        if d.get("reviewSourceIds"):
            refs(d["reviewSourceIds"])
        if "applicationGuideSourceId" in d:
            guide_id = d["applicationGuideSourceId"]
            assert guide_id in d["sourceIds"], "An application guide must be one of the directory's sources"
            assert sources[guide_id]["evidenceLevel"] == "official_scoped_body_read"
            validate_read_receipt(sources[guide_id])
        if "census" in d:
            census = d["census"]
            if "observedNamedCards" in d:
                assert d["enumerationScope"] == "saved_body_cards_only"
                observed = census["entries"] + census.get("unlinkedEntries", [])
                assert d["observedNamedCards"] == len(observed), "Named-card count must exclude filters and navigation"
                actual = [card for sid in d["sourceIds"] for card in sources[sid].get("observedStaffCards", [])]
                projection = lambda row: {key: row[key] for key in ("name", "directoryPosition", "profileUrl", "providedLinks")}
                assert sorted(map(projection, observed), key=lambda r: (r["name"], r["profileUrl"] or "")) == sorted(actual, key=lambda r: (r["name"], r["profileUrl"] or "")), "Every named card must retain its own observed identity, role and links"
                for row in observed:
                    for link in row["providedLinks"]:
                        assert link["bodyStatus"] == "not_read"
                        assert any(link["url"] in sources[sid]["discoveredLinks"] for sid in d["sourceIds"])
            assert census["observedTotal"] == len(census["entries"])
            assert len({e["profileUrl"] for e in census["entries"]}) == census["observedTotal"]
            assert sum(e["profileRead"] for e in census["entries"]) == census["profilesRead"]
            assert census["profilesRead"] + census["profilesFailed"] == census["observedTotal"]
            assert all(e["reviewStatus"] in {"body_read", "network_timeout", "not_read", "access_failed"} for e in census["entries"])
            assert all(e["profileRead"] == (e["reviewStatus"] == "body_read") for e in census["entries"])
            if "pendingReasonCounts" in census:
                assert all(type(n) is int and n >= 0 for n in census["pendingReasonCounts"].values())
                assert sum(census["pendingReasonCounts"].values()) == census["profilesFailed"]
            for row in census.get("unlinkedEntries", []):
                assert row["name"] and row["reason"] and not row.get("profileUrl"), "Never invent an unprovided profile URL"
                if row.get("facultyId"):
                    assert row["facultyId"] in faculty_ids
    for fund in catalog["funding"]:
        refs(fund["sourceIds"])
        assert fund["degree"] == "PhD" and set(fund["universities"]) == {"hku", "cuhk", "hkust", "polyu", "cityu"}
        assert "cuhksz" not in fund["universities"] and "hkustgz" not in fund["universities"]
    maps = catalog.get("academicCoverage", [])
    assert len(maps) == len(unis) and {m["universityId"] for m in maps} == unis
    child_urls = {child.get("url") for row in maps for unit in row["units"] for child in unit["children"]}
    child_urls.update(entry["url"] for row in maps for unit in row["units"] for child in unit["children"] for entry in child.get("providedEntries", []))
    followed_urls = set()
    for followup in catalog.get("academicEntryFollowups", []):
        assert followup["url"] in child_urls and followup["url"] not in followed_urls
        followed_urls.add(followup["url"])
        assert followup["organizationComplete"] is followup["facultyComplete"] is False
        if followup["bodyStatus"] == "read_failed":
            assert followup["failureKind"] in {"certificate_verification_failed", "http_403"} and not followup["sourceIds"]
            if followup["failureKind"] == "http_403":
                assert followup["httpStatus"] == 403 and followup["retrievedUrl"] is None
            assert "bodySha256" not in followup, "Failed handshake has no response body receipt"
            continue
        assert followup["bodyStatus"] == "body_read"
        refs(followup["sourceIds"])
        for sid in followup["sourceIds"]:
            source = sources[sid]
            validate_read_receipt(source)
            assert source["originalUrl"] == followup["url"] and source["retrievedUrl"] == followup["retrievedUrl"], "Unit follow-up must bind its own original and actual URL"
            assert source["bodySha256"] == followup["bodySha256"] and source["checkedAt"] == followup["checkedAt"], "Unit follow-up must retain its actual body and date"
        chain = followup.get("unitNavigationChain", [])
        if chain:
            assert sources[chain[0]["sourceId"]]["originalUrl"] == followup["url"]
            for index, hop in enumerate(chain):
                stub = sources[hop["sourceId"]]
                assert stub["evidenceLevel"] == "official_navigation_stub_read"
                validate_read_receipt(stub)
                assert hop["declaredTarget"] == stub["declaredTarget"] and hop["declaredTarget"] in stub["discoveredLinks"], "Unit refresh must use the page's actual declared target"
                assert urljoin(stub["retrievedUrl"], hop["suppliedHref"]) == hop["declaredTarget"]
                final_source = sources[followup["sourceIds"][0]]
                next_original = sources[chain[index+1]["sourceId"]]["originalUrl"] if index+1 < len(chain) else final_source.get("requestedUrl", followup["retrievedUrl"])
                assert hop["declaredTarget"] == next_original, "Unit refresh chain must retain every supplied hop"
        for entry in followup["nextEntries"]:
            assert entry["bodyStatus"] in {"not_read", "body_read"} and entry["availability"] == entry["supervisionEligibility"] == "unknown"
            assert any(entry["url"] in sources[sid]["discoveredLinks"] for sid in followup["sourceIds"]), "Next entry must be provided by the actual unit body"
            if entry["bodyStatus"] == "body_read":
                refs(entry["sourceIds"])
                for sid in entry["sourceIds"]:
                    validate_read_receipt(sources[sid])
                    assert sources[sid].get("originalUrl", sources[sid]["url"]) == entry["url"]
                    if "checkedAt" in entry:
                        assert entry["checkedAt"] == sources[sid]["checkedAt"], "Reused body must retain its own original verification date"
                if entry.get("directoryId"):
                    directory = next(d for d in catalog["directories"] if d["id"] == entry["directoryId"])
                    assert directory["sourceIds"] == entry["sourceIds"] and directory["url"] == entry["url"]
                if entry.get("contentScope") == "embedded_directory_shell":
                    failure = entry["embeddedRead"]
                    assert failure["bodyStatus"] == "read_failed" and failure["namesRead"] == 0 and failure["failureKind"] == "redirect_limit_exceeded"
                    assert any(failure["url"] in sources[sid]["discoveredLinks"] for sid in entry["sourceIds"])
    parents = {u["id"]: u for overview in maps for u in overview["units"]}
    for document in catalog.get("academicChildDocuments", []):
        parent = parents[document["parentUnitId"]]
        child = next(child for child in parent["children"] if child["url"] == document["childUrl"])
        source = sources[document["sourceId"]]
        validate_read_receipt(source)
        assert source["evidenceLevel"] == "official_scoped_body_read"
        assert source["url"] == source["originalUrl"] == source["retrievedUrl"]
        assert source["url"] != child["url"], "A related page must keep its own URL and body receipt"
        if "providedBySourceId" in document:
            provider_id = document["providedBySourceId"]
            assert source["url"] in sources[provider_id]["discoveredLinks"]
            assert any(provider_id in followup["sourceIds"] and followup["url"] == child["url"]
                       for followup in catalog["academicEntryFollowups"]) or any(
                           old["sourceId"] == provider_id and old["childUrl"] == child["url"]
                           and old["parentUnitId"] == parent["id"]
                           for old in catalog["academicChildDocuments"])
        else:
            assert urlsplit(source["url"]).netloc == urlsplit(child["url"]).netloc
        if "bodySha256" in source:
            assert child.get("bodySha256") != source["bodySha256"], "Do not substitute the separate document for the unit root"
        if document.get("items"):
            kind = document["itemKind"]
            assert kind in {"research_centres", "research_themes"}
            names = [item["observedLabel"] for item in document["items"]]
            assert len(names) == len(set(names)) and all(names)
            for item in document["items"]:
                assert item["label"]
                if item["url"] is not None:
                    assert kind == "research_centres" and item["url"] in source["discoveredLinks"]
        for entry in document["nextEntries"]:
            assert entry["url"] in source["discoveredLinks"]
            assert entry["bodyStatus"] == "not_read"
            assert entry["availability"] == entry["supervisionEligibility"] == "unknown"
    for note in catalog.get("academicUnitNotes", []):
        parent = parents[note["parentUnitId"]]
        assert any(child["name"] == note["childName"] and child["url"] is None for child in parent["children"]), "A dated unit note must bind its original unlinked child; do not invent a homepage"
        refs(note["sourceIds"])
        assert all(sources[sid]["unitName"] == note["childName"] for sid in note["sourceIds"])
        established = sources[note["establishmentSourceId"]]
        announced = sources[note["announcementSourceId"]]
        assert note["establishmentSourceId"] in note["sourceIds"] and note["announcementSourceId"] in note["sourceIds"]
        assert note["establishedEffectiveAt"] == established["establishedEffectiveAt"]
        assert note["publishedAt"] == announced["publishedAt"]
        assert note["announcedProgrammes"] == announced["announcedProgrammes"], "Announcement must retain its own degrees and years without inventing MPhil or open admissions"
        assert note["organizationComplete"] is note["facultyComplete"] is False
        assert note["availability"] == note["supervisionEligibility"] == "unknown"
    unit_ids = set()
    for overview in maps:
        assert overview["coverageComplete"] is False
        refs(overview["sourceIds"])
        for reference in overview.get("institutionalReferences", []):
            assert reference["universityId"] == overview["universityId"], "Institutional scope must retain its university"
            assert reference["kind"] in {"mixed_academic_index", "quality_manual_introduction", "historical_annual_report", "historical_admissions_handbook"}
            assert reference["organizationComplete"] is reference["facultyComplete"] is False
            assert reference["summary"] and reference["caution"] and reference["entryNote"]
            refs([reference["sourceId"]])
            source = sources[reference["sourceId"]]
            assert source["checkedAt"] == reference["checkedAt"]
            if reference["kind"] == "historical_annual_report":
                assert source["readMethod"] == "web_reader" and "readReceiptSha256" in source
                assert source["evidenceLevel"] == "official_scoped_body_read" and not reference["entries"]
                assert re.fullmatch(r"\d{4}/\d{2}", source["academicYear"])
            elif reference["kind"] == "historical_admissions_handbook":
                assert source["readMethod"] == "web_reader" and source["evidenceLevel"] == "official_scoped_body_read"
                assert re.fullmatch(r"\d{4}-\d{2}", source["publishedMonth"])
            else:
                assert source["readMethod"] == "anonymous_HTTP"
            validate_read_receipt(source)
            seen_entries = set()
            for entry in reference["entries"]:
                assert entry["url"] in source["discoveredLinks"], "Institutional entry must be provided by its own source"
                assert entry["url"] not in seen_entries
                seen_entries.add(entry["url"])
                assert entry["bodyStatus"] == "not_read", "A supplied link is not a body-read receipt"
                assert entry["supervisionEligibility"] == entry["availability"] == "unknown"
                allowed = {"department", "division"} if reference["kind"] in {"mixed_academic_index", "historical_admissions_handbook"} else {"manual_chapter"}
                assert entry["kind"] in allowed, "Do not mix facilities, campuses or manual chapters with departments"
        review = overview["listReview"]
        refs(review["sourceIds"])
        assert review["universityId"] == overview["universityId"]
        assert isinstance(review["summary"], str) and review["summary"].strip()
        assert review["status"] in {"central_list_matched", "research_degree_list_matched"}
        academic_ids = set(review["academicUnitIds"])
        support_ids = set(review["supportUnitIds"])
        assert len(academic_ids) == len(review["academicUnitIds"]) == review["academicUnitsListed"]
        assert not academic_ids & support_ids
        assert academic_ids | support_ids == {u["id"] for u in overview["units"]}, "Every listed unit needs a scoped classification"
        assert support_ids == {u["id"] for u in overview["units"] if u["kind"] in {"graduate_school", "undergraduate_college"}}
        assert review["departmentInventoryStatus"] == review["facultyInventoryStatus"] == "pending"
        assert review["wholeUniversityHierarchyComplete"] is False, "A matched top-level list does not finish departments or teachers"
        for count in overview["reportedCounts"]:
            assert count["label"] and type(count["value"]) is int and count["value"] > 0
        for unit in overview["units"]:
            assert unit["id"] not in unit_ids and unit["name"] != "Read more"
            unit_ids.add(unit["id"])
            assert unit["teacherProfilesTotal"] is None, "Unknown school headcount is not zero or available places"
            assert unit["entryBodyStatus"] in {"body_read", "not_read", "access_failed"}
            if unit["entryBodyStatus"] == "body_read":
                refs(unit["sourceIds"])
                assert unit["readMethod"] in {"anonymous_HTTP", "web_reader"}
            if "childInventoryReview" in unit:
                child_review = unit["childInventoryReview"]
                refs(child_review["sourceIds"])
                assert child_review["status"] == "observed_parent_list_matched" and child_review["facultyComplete"] is False
                assert child_review["observedChildren"] == len(unit["children"])
                assert len({child["name"] for child in unit["children"]}) == len(unit["children"])
                for child in unit["children"]:
                    refs(child["sourceIds"])
                    assert child["supervisionEligibility"] == child["availability"] == "unknown"
                    assert any(child["url"] in sources[sid].get("discoveredLinks", []) for sid in child["sourceIds"]), "Child navigation must come from its actual parent evidence"
                    if child["kind"] == "affiliated_school":
                        assert child["relationship"] == "affiliated_school", "An affiliated School is not a direct department"
                for entry in unit.get("relatedTeachingEntries", []):
                    assert any(entry["url"] in sources[sid].get("discoveredLinks", []) for sid in child_review["sourceIds"])
            if "organizationReview" in unit:
                org = unit["organizationReview"]
                if "sourceAcademicYear" in org:
                    assert re.fullmatch(r"\d{4}/\d{2}", org["sourceAcademicYear"])
                    refs(org["datedSourceIds"])
                    assert org["datedSourceIds"] and set(org["datedSourceIds"]) <= set(org["sourceIds"])
                    assert all(sources[sid].get("academicYear") == org["sourceAcademicYear"] for sid in org["datedSourceIds"]), "Dated organization scope must retain its own source academic year"
                refs(org["sourceIds"])
                assert org["status"] in {"not_listed_in_reviewed_pages", "listed_children_matched", "conflicting_scopes", "components_only", "unitary_faculty_department", "unitary_faculty"}
                assert org["organizationComplete"] is org["facultyComplete"] is False, "A scoped structure review cannot finish the university or teacher census"
                if org["status"] in {"unitary_faculty_department", "unitary_faculty"}:
                    refs(org["modelSourceIds"])
                    assert set(org["modelSourceIds"]) <= set(org["sourceIds"])
                    assert org["modelSourceIds"] and all(sources[sid].get("declaredOrganizationModel") == org["status"] for sid in org["modelSourceIds"]), "Unitary model requires its own explicit official source"
                    if org["status"] == "unitary_faculty":
                        assert org["modelScope"] == "faculty_administration"
                        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", org["effectiveFrom"])
                        assert all(sources[sid].get("declaredEffectiveFrom") == org["effectiveFrom"] and sources[sid].get("declaredModelScope") == org["modelScope"] for sid in org["modelSourceIds"]), "Dated administrative model must retain its own effective date and scope"
                if "listedChildren" in org:
                    assert org["listedChildren"] == len(unit["children"])
                navigation_kinds = {"research_fields": {"research_field"}, "academic_subjects": {"academic_subject"}, "research_degree_navigation": {"research_degree_navigation"}, "teaching_support": {"teaching_support"}, "administrative_support": {"administrative_support"}, "college_components": {"college_component"},
                    "academic_subunits": {"department", "division", "centre", "unit", "department_or_programme"},
                    "related_academic_units": {"other_academic_unit", "institute", "teaching_unit", "centre", "division", "teaching_support", "research_field"},
                    "research_organizations": {"centre", "research_lab", "institute"}}
                for group in unit.get("relatedNavigationGroups", []):
                    assert group["kind"] in navigation_kinds and group["title"] and group["note"]
                    if group["kind"] == "academic_subunits":
                        assert group["parentUnitName"] in {child["name"] for child in unit["children"]}, "Nested academic units need their actual listed parent"
                    else:
                        assert not group.get("parentUnitName"), "A parent binding requires explicit nested classification"
                    refs(group["sourceIds"])
                    for entry in group["entries"]:
                        refs(entry["sourceIds"])
                        assert set(entry["sourceIds"]) <= set(group["sourceIds"])
                        assert entry["kind"] in navigation_kinds[group["kind"]]
                        if "offeredDegrees" in entry:
                            assert group["kind"] == "research_degree_navigation"
                            assert entry["offeredDegrees"] and set(entry["offeredDegrees"]) <= {"MPhil", "PhD"}
                            assert any({"name": entry["observedName"], "degrees": entry["offeredDegrees"]} in sources[sid].get("listedResearchDegrees", []) for sid in entry["sourceIds"]), "Degree navigation must retain its own observed degree kinds"
                        if group["kind"] == "academic_subunits":
                            assert any({"collegeUnitId": unit["id"], "parentUnitName": group["parentUnitName"]} in sources[sid].get("academicParentBindings", []) for sid in entry["sourceIds"]), "Nested source must belong to this actual parent"
                            named_lists = [sources[sid] for sid in entry["sourceIds"] if "observedDepartmentCards" in sources[sid]]
                            if named_lists:
                                assert any({"name": entry["observedName"], "url": entry["url"]} in source["observedDepartmentCards"] for source in named_lists), "Named department entrance must retain its observed name and URL pairing"
                        assert entry["entryBodyStatus"] in {"not_read", "body_read"}
                        assert entry["supervisionEligibility"] == entry["availability"] == "unknown"
                        if entry["entryBodyStatus"] == "body_read":
                            assert entry.get("readMethod") in {"anonymous_HTTP", "web_reader"}
                            validate_read_receipt(entry)
                            receipt_key = "readReceiptSha256" if "readReceiptSha256" in entry else "bodySha256"
                            assert (entry["readMethod"] == "web_reader") == (receipt_key == "readReceiptSha256"), "Web text and HTTP bytes need different receipt kinds"
                            assert any(sources[sid].get(receipt_key) == entry[receipt_key]
                                and sources[sid].get("readMethod") == entry["readMethod"]
                                and sources[sid]["url"] == entry.get("retrievedUrl")
                                and entry["url"] in {sources[sid]["url"], sources[sid].get("originalUrl")}
                                for sid in entry["sourceIds"]), "Read unit entry needs its own exact target body, not its parent receipt"
                        if entry["url"] is not None:
                            assert any(entry["url"] in sources[sid].get("discoveredLinks", []) for sid in entry["sourceIds"])
                        else:
                            assert any(entry["observedName"] in sources[sid].get("listedNames", []) for sid in entry["sourceIds"]), "An unlinked name still needs actual parent evidence"
                for child in unit["children"]:
                    refs(child["inventorySourceIds"])
                    assert child["supervisionEligibility"] == child["availability"] == "unknown"
                    if "inventoryListing" in child:
                        listing = child["inventoryListing"]
                        assert listing["sourceIds"] == child["inventorySourceIds"]
                        assert any(listing["name"] in sources[sid].get("listedNames", []) for sid in listing["sourceIds"]), "Current list name needs parent evidence"
                        if listing["url"] is not None:
                            assert any(listing["url"] in sources[sid].get("discoveredLinks", []) for sid in listing["sourceIds"]), "Current list address needs parent evidence"
                        # Original URL/read receipt stays separate from a newly provided list entry.
                        continue
                    if "listedUrl" in child:
                        assert child["listedUrl"].rstrip("/") == child["url"].rstrip("/"), "List spelling must retain the original navigation"
                    if child["url"] is not None:
                        assert any(child.get("listedUrl", child["url"]) in sources[sid].get("discoveredLinks", []) for sid in child["inventorySourceIds"])
                    else:
                        assert any(child["observedName"] in sources[sid].get("listedNames", []) for sid in child["inventorySourceIds"])
            for navigation in unit.get("reviewedNavigation", []):
                assert navigation["label"] and navigation["scope"]
                assert navigation["kind"] in {"training_scope", "research_directory", "college_scope", "document_entry", "research_admission_notice", "staff_directory"}
                sid = navigation["sourceId"]
                assert sid in unit["organizationReview"]["sourceIds"], "Reviewed action must retain its actual scope source"
                source = sources[sid]
                assert source["url"].startswith("https://")
                assert (source["readMethod"] == "anonymous_HTTP" or
                        (source["readMethod"] == "web_reader" and "readReceiptSha256" in source
                         and source["evidenceLevel"] == "official_scoped_body_read"))
                validate_read_receipt(source)
            for child in unit["children"]:
                for extra in child.get("providedEntries", []):
                    assert extra["bodyStatus"] == "not_read", "Supplied entry is not a body-read receipt"
                    assert extra["availability"] == extra["supervisionEligibility"] == "unknown"
                    assert extra["url"].startswith("https://")
                    assert any(extra["url"] in sources[sid].get("discoveredLinks", []) for sid in extra["sourceIds"]), "Extra college entry not supplied by its source"
            for entry in unit["staffEntries"]:
                assert entry["enumerationComplete"] is False and entry["teacherProfilesTotal"] is None
                assert isinstance(entry.get("profileLeads"), list), "Staff navigation needs an explicit observed-lead list; unknown totals remain unknown"
                if entry["entryBodyStatus"] == "body_read":
                    refs(entry["sourceIds"])
                leads = entry["profileLeads"]
                assert len({lead["url"] for lead in leads}) == len(leads)
                page_ids = entry.get("pageSourceIds")
                if page_ids is not None:
                    assert entry["entryBodyStatus"] == "body_read" and entry["scopeNote"]
                    assert page_ids and len(page_ids) == len(set(page_ids))
                    assert set(page_ids) <= set(entry["sourceIds"])
                    pages = [sources[sid] for sid in page_ids]
                    assert pages[0]["url"] == entry["url"]
                    for page in pages:
                        assert page["evidenceLevel"] == "official_scoped_body_read"
                        assert page["readMethod"] == "anonymous_HTTP" and re.fullmatch("[a-f0-9]{64}", page["bodySha256"])
                    for left, right in zip(pages, pages[1:]):
                        assert right["url"] in left["discoveredLinks"], "Roster pagination must come from the previous page"
                    sources_by_page = {page["url"]: page for page in pages}
                else:
                    sources_by_page = {}
                for lead in leads:
                    assert lead["directoryLabel"]
                    if page_ids is not None:
                        assert lead["observedOn"] in sources_by_page
                        assert lead["url"] in sources_by_page[lead["observedOn"]]["discoveredLinks"], "Profile must be supplied by its own roster page"
                    else:
                        assert lead["observedOn"] == entry["url"]
                    assert lead["profileBodyStatus"] in {"not_read", "body_read", "access_failed"} and lead["supervisionEligibility"] == lead["availability"] == "unknown"
                    if lead["profileBodyStatus"] == "body_read":
                        validate_read_receipt(lead)
                    if lead.get("facultyId"):
                        assert lead["facultyId"] in faculty_ids
                        assert lead["researchReviewStatus"] == "research_excerpt_and_directory_role_reviewed"
                    assert any(lead["url"] in sources[sid].get("discoveredLinks", []) for sid in entry["sourceIds"])
            for child in unit["children"]:
                if child.get("bodySha256") == "d02032286070b4dd9d8fbd985a7bdca8af8edf52b89ff177db3bfcb2c8a9c43d":
                    assert child["entryBodyStatus"] == "access_failed" and child.get("responseKind") == "access_challenge", "HTTP200 access checks must stay unread"
                assert child["teacherProfilesTotal"] is None and child["teacherReviewStatus"] == "pending"
                assert child["entryBodyStatus"] in {"not_read", "body_read", "access_failed"}
                if child["entryBodyStatus"] == "body_read":
                    assert re.fullmatch("[a-f0-9]{64}", child["bodySha256"])
                    if child["retrievedUrl"].startswith("https://"):
                        refs(child["sourceIds"])
                for route in child.get("staffRoutes", []):
                    assert route["completeFacultyEnumeration"] is False
                    if route["bodyStatus"] == "body_read" and route.get("retrievedUrl", "").startswith("https://"):
                        refs(route["sourceIds"])
    counts = {"universities": len(unis), "programs": len(catalog["programs"]), "faculty": len(catalog["faculty"]), "sources": len(sources),
        "funding": len(catalog["funding"]), "degreeRoutes": sum(len(application_degrees(catalog, p)) for p in catalog["programs"]),
        "facultyByUniversity": dict(Counter(f["universityId"] for f in catalog["faculty"])),
        "unknownRecruitment": sum(f["availability"]["state"] == "unknown" for f in catalog["faculty"]),
        "dateOnlyDeadlines": sum(d["at"] is None for p in catalog["programs"] for d in p["deadlines"]),
        "programsWithRequirements": sum(bool(p.get("requirements")) for p in catalog["programs"]),
        "requirementItems": sum(len(p.get("requirements", [])) for p in catalog["programs"]),
        "programsWithFinances": sum(bool(p.get("finances")) for p in catalog["programs"]),
        "financeItems": len(finance_ids), "officialDirectories": len(directory_ids),
        "directoriesByUniversity": dict(Counter(d["universityId"] for d in catalog.get("directories", []))),
        "academicUnitRows": len(unit_ids),
        "listedChildUnits": sum(len(u["children"]) for m in maps for u in m["units"])}
    assert set(counts["facultyByUniversity"]) == unis
    return {"status": "passed", "checkedDate": CHECKED, "counts": counts,
        "assertions": ["seven institution identities stay separate", "all claims retain source references", "no invented clock for date-only deadlines", "HKU regular and CityU CS contact remain unknown", "past early round retained", "faculty topics use exact aliases only", "dated advert is not confirmed capacity", "HKPFS is PhD-only and does not cross to SZ/GZ"]}


def asset_versioned_html(html, assets):
    for name, content in assets.items():
        digest = hashlib.sha256(content).hexdigest()[:16]
        pattern = r'((?:src|href)=")' + re.escape(name) + r'(?:\?v=[a-f0-9]+)?"'
        html, count = re.subn(pattern, lambda match, name=name, digest=digest: match[1] + name + '?v=' + digest + '"', html)
        assert count == 1, f"Expected one local page asset: {name}"
    return html


def startup_project_html(catalog):
    sources = {source["id"]: source for source in catalog["sources"]}
    groups = []
    for school in catalog["universities"]:
        projects = []
        for project in catalog["programs"]:
            if project["universityId"] != school["id"]:
                continue
            url = project.get("entryUrl") or next(
                sources[sid]["url"] for sid in project["sourceIds"]
                if sources[sid]["url"].startswith("https://")
            )
            assert url.startswith("https://")
            cycle = "入学轮次待核" if project.get("cycleVerified") is False else project["cycle"]
            projects.append(
                '<li><a target="_blank" rel="noopener noreferrer" data-project-id="'
                + escape(project["id"], quote=True) + '" href="' + escape(url, quote=True) + '">'
                + escape(project["name"]) + ' ↗</a><small>'
                + escape(" / ".join(application_degrees(catalog, project)) + " · " + cycle) + '</small></li>'
            )
        groups.append('<details><summary>' + escape(school["short"])
                      + '</summary><ul>' + "".join(projects) + '</ul></details>')
    return (
        '<section id="startup-projects" class="startup-projects" aria-labelledby="startup-project-title">'
        '<h2 id="startup-project-title">按学校查看项目官网</h2>'
        '<p>选择学校，先查看学位、材料和申请时间。</p>'
        '<form id="startup-search" hidden>'
        '<label for="startup-research-query">按研究关键词找老师</label>'
        '<input id="startup-research-query" type="search" maxlength="160" placeholder="例如：机器人、APOE4">'
        '<button class="button secondary" type="submit">搜索</button>'
        '<p id="startup-search-status" role="status"></p><ul id="startup-search-results"></ul>'
        '<button id="startup-search-more" class="button secondary" type="button" hidden>显示更多</button>'
        '</form>'
        '<div class="startup-school-grid">' + "".join(groups) + '</div>'
        '<a href="./index.html#explore">重新载入完整页面</a></section>'
    )


def browser_catalog(catalog):
    """Keep link provenance used by the app without transferring archival navigation."""
    referenced = set()

    def collect(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key != "discoveredLinks":
                    collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, str):
            referenced.add(value)

    collect(catalog)
    sources = [
        {**source, "discoveredLinks": [url for url in source["discoveredLinks"] if url in referenced]}
        if "discoveredLinks" in source else source
        for source in catalog["sources"]
    ]
    return {**catalog, "sources": sources}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    catalog = build_catalog()
    identity = hashlib.sha256(json.dumps(catalog,ensure_ascii=False,sort_keys=True,separators=(",", ":"),allow_nan=False).encode("utf-8")).hexdigest()
    catalog["snapshotId"] = "sha256:" + identity
    quality = validate(catalog)
    encoded = json.dumps(catalog, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    js = "window.APP_CATALOG = " + json.dumps(
        browser_catalog(catalog), ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ) + ";\n"
    search_index = {
        "schools": {school["id"]: school["short"] for school in catalog["universities"]},
        "faculty": [[person["name"], person["universityId"], person["profileUrl"],
                     person["researchKeywords"]] for person in catalog["faculty"]],
    }
    index_js = "window.APP_FACULTY_INDEX = " + json.dumps(
        search_index, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ) + ";\n"
    outputs = {ROOT / "data/catalog.json": encoded, ROOT / "dist/catalog.js": js,
               ROOT / "dist/faculty-index.js": index_js,
               ROOT / "data/coverage.json": json.dumps(quality, ensure_ascii=False, indent=2) + "\n",
               ROOT / "data/snapshots" / (identity + ".json"): encoded}
    assets = {name: (js.encode("utf-8") if name == "catalog.js" else (ROOT / "dist" / name).read_text(encoding="utf-8").encode("utf-8"))
              for name in ("catalog.js", "logic.js", "app.js", "styles.css", "discovery.css", "startup-search.js")}
    assets["faculty-index.js"] = index_js.encode("utf-8")
    index = ROOT / "dist/index.html"
    html = index.read_text(encoding="utf-8")
    html, count = re.subn(
        r"<!-- STARTUP_PROJECTS_START -->.*?<!-- STARTUP_PROJECTS_END -->",
        "<!-- STARTUP_PROJECTS_START -->\n" + startup_project_html(catalog)
        + "\n<!-- STARTUP_PROJECTS_END -->", html, flags=re.S,
    )
    assert count == 1
    outputs[index] = asset_versioned_html(html, assets)
    # GitHub Pages serves this generated mirror; --check prevents it drifting from the offline page.
    outputs.update({ROOT / "docs" / name: content.decode("utf-8") for name, content in assets.items()})
    outputs[ROOT / "docs/index.html"] = outputs[index]
    outputs[ROOT / "docs/.nojekyll"] = ""
    for path, content in outputs.items():
        if args.check:
            assert path.read_text(encoding="utf-8") == content, f"Stale generated catalog: {path.name}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.parent.name == "snapshots" and path.exists():
                assert path.read_text(encoding="utf-8") == content, "Existing source snapshot must not be replaced"
            path.write_text(content, encoding="utf-8", newline="\n")
    print(json.dumps(quality, ensure_ascii=False))


if __name__ == "__main__":
    main()
