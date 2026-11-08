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
CHECKED = "2026-11-08"
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
    for deadline in programme["deadlines"]:
        deadline["sourceIds"].append(update["applicationSourceId"])
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
    for organization_path in ("organization-scope-20261029.json", "stem-college-structure-20261029.json", "college-batch-hierarchy-20261029.json", "scope-clarifications-20261102.json", "college-deep-scope-20261102.json", "college-models-20261104.json", "law-business-organization-20261105.json", "science-interdisciplinary-scopes-20261105.json", "college-links-programmes-20261105.json"):
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
        '<p>选择学校，先查看学位、材料和申请时间。教师检索与清单正在载入。</p>'
        '<div class="startup-school-grid">' + "".join(groups) + '</div>'
        '<a href="./index.html#explore">重新载入完整页面</a></section>'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    catalog = build_catalog()
    identity = hashlib.sha256(json.dumps(catalog,ensure_ascii=False,sort_keys=True,separators=(",", ":"),allow_nan=False).encode("utf-8")).hexdigest()
    catalog["snapshotId"] = "sha256:" + identity
    quality = validate(catalog)
    encoded = json.dumps(catalog, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    js = "window.APP_CATALOG = " + encoded.rstrip() + ";\n"
    outputs = {ROOT / "data/catalog.json": encoded, ROOT / "dist/catalog.js": js,
               ROOT / "data/coverage.json": json.dumps(quality, ensure_ascii=False, indent=2) + "\n",
               ROOT / "data/snapshots" / (identity + ".json"): encoded}
    assets = {name: (js.encode("utf-8") if name == "catalog.js" else (ROOT / "dist" / name).read_bytes())
              for name in ("catalog.js", "logic.js", "app.js", "styles.css", "discovery.css")}
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
