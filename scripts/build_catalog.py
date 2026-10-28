"""Normalize the curated official-source seed without network access or inference.

Run this script to build data/catalog.json and dist/catalog.js. --check validates
both existing outputs against the source packs without rewriting any file.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKED = "2026-10-28"
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


def validate(catalog):
    assert catalog["schemaVersion"] == 1 and catalog["checkedDate"] == CHECKED
    unis = {u["id"] for u in catalog["universities"]}
    assert unis == {"hku", "cuhk", "hkust", "polyu", "cityu", "cuhksz", "hkustgz"}
    sources = {s["id"]: s for s in catalog["sources"]}
    assert len(sources) == len(catalog["sources"]) and len(sources) >= 34
    for source in sources.values():
        if "readReceiptSha256" in source:
            validate_read_receipt(source)
        if source.get("bodySha256") == "d02032286070b4dd9d8fbd985a7bdca8af8edf52b89ff177db3bfcb2c8a9c43d":
            assert source["evidenceLevel"] == "official_entry_access_failed" and source.get("responseKind") == "access_challenge", "A known access-check response is not verified institutional content"
        assert source["url"].startswith("https://") and source["claims"]
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
                    assert target["url"].startswith("https://")
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
        if "census" in d:
            census = d["census"]
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
    for fund in catalog["funding"]:
        refs(fund["sourceIds"])
        assert fund["degree"] == "PhD" and set(fund["universities"]) == {"hku", "cuhk", "hkust", "polyu", "cityu"}
        assert "cuhksz" not in fund["universities"] and "hkustgz" not in fund["universities"]
    maps = catalog.get("academicCoverage", [])
    assert len(maps) == len(unis) and {m["universityId"] for m in maps} == unis
    unit_ids = set()
    for overview in maps:
        assert overview["coverageComplete"] is False
        refs(overview["sourceIds"])
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
            for entry in unit["staffEntries"]:
                assert entry["enumerationComplete"] is False and entry["teacherProfilesTotal"] is None
                if entry["entryBodyStatus"] == "body_read":
                    refs(entry["sourceIds"])
                leads = entry.get("profileLeads", [])
                assert len({lead["url"] for lead in leads}) == len(leads)
                for lead in leads:
                    assert lead["observedOn"] == entry["url"] and lead["directoryLabel"]
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
        "funding": len(catalog["funding"]), "degreeRoutes": sum(len(p["degrees"]) for p in catalog["programs"]),
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
    outputs[index] = asset_versioned_html(index.read_text(encoding="utf-8"), assets)
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
